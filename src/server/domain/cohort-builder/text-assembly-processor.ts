import { cohortChunkSchema, cohortLessonSchema, cohortWorkspaceSchema, type CohortChunk } from '@/src/shared/cohort-builder/contracts';
import { readTextArtifact, type TextArtifactSql } from './text-artifacts';
import { planTextJobs } from './text-job-plan';
import type { ClaimedTextJob } from './text-jobs';
import { computeTextStage } from './text-pipeline';
import { validateRetainedSourceEvidence } from './source-evidence';

/** Prepared host processor. Emits validated bytes; it never projects lessons into canonical state. */
export function createTextAssemblyProcessor(input: {
  sql: TextArtifactSql;
  loadWorkspace: (workspaceId: string) => Promise<unknown>;
  /** Internal acceptance only, after an exact source preflight proof. */
  reparseSources?: boolean;
}): (job: ClaimedTextJob, signal?: AbortSignal) => Promise<Uint8Array> {
  return async (job, signal) => {
    signal?.throwIfAborted();
    if (job.stage !== 'assembly' || job.sourceId !== null || job.sourceVersion !== null) throw new Error('INVALID_ASSEMBLY_JOB');
    const state = cohortWorkspaceSchema.parse(await input.loadWorkspace(job.workspaceId));
    signal?.throwIfAborted();
    const plan = planTextJobs(state);
    const assembly = plan.find(intent => intent.stage === 'assembly');
    if (!assembly || assembly.dependencyFingerprint !== job.dependencyFingerprint) throw new Error('STALE_ASSEMBLY_JOB');
    await validateRetainedSourceEvidence(input.sql,job.workspaceId,state,input.reparseSources!==false);
    const expected = new Map(plan.filter(intent => intent.stage === 'analysis').map(intent => [intent.jobKey, intent]));
    const result = await input.sql.query(`SELECT analysis."jobKey", analysis."stage" AS "analysisStage", analysis."sourceId", analysis."sourceVersion",
        analysis."dependencyFingerprint" AS "analysisFingerprint", analysis."resultArtifactId" AS "analysisArtifactId",
        analysisArtifact."checksum" AS "analysisChecksum", chunks."jobKey" AS "chunkJobKey",
        chunks."stage" AS "chunkStage", chunks."sourceId" AS "chunkSourceId",
        chunks."sourceVersion" AS "chunkSourceVersion", chunks."dependencyFingerprint" AS "chunkFingerprint",
        chunks."resultArtifactId" AS "chunkArtifactId", chunkArtifact."checksum" AS "chunkChecksum"
      FROM "cohort_text_job_edges" assemblyEdge
      JOIN "cohort_text_jobs" analysis ON analysis."id" = assemblyEdge."prerequisiteId"
        AND analysis."workspaceId" = assemblyEdge."workspaceId" AND analysis."status" = 'accepted'
      JOIN "cohort_text_artifacts" analysisArtifact ON analysisArtifact."id" = analysis."resultArtifactId"
        AND analysisArtifact."workspaceId" = analysis."workspaceId"
      JOIN "cohort_text_job_edges" analysisEdge ON analysisEdge."jobId" = analysis."id"
        AND analysisEdge."workspaceId" = analysis."workspaceId"
      JOIN "cohort_text_jobs" chunks ON chunks."id" = analysisEdge."prerequisiteId"
        AND chunks."workspaceId" = analysisEdge."workspaceId" AND chunks."status" = 'accepted'
      JOIN "cohort_text_artifacts" chunkArtifact ON chunkArtifact."id" = chunks."resultArtifactId"
        AND chunkArtifact."workspaceId" = chunks."workspaceId"
      WHERE assemblyEdge."workspaceId" = $1 AND assemblyEdge."jobId" = $2`, [job.workspaceId, job.id]);
    if (result.rows.length !== expected.size || expected.size !== state.sources.length) throw new Error('MISSING_ASSEMBLY_PREREQUISITE');
    const bySource = new Map<string, CohortChunk[]>();
    const seen = new Set<string>();
    for (const row of result.rows) {
      const key = String(row.jobKey);
      const intent = expected.get(key);
      if (!intent || seen.has(key) || row.analysisStage !== 'analysis' || row.sourceId !== intent.sourceId
        || Number(row.sourceVersion) !== intent.sourceVersion || row.analysisFingerprint !== intent.dependencyFingerprint
        || row.chunkSourceId !== intent.sourceId || Number(row.chunkSourceVersion) !== intent.sourceVersion) {
        throw new Error('FOREIGN_ASSEMBLY_PREREQUISITE');
      }
      seen.add(key);
      const chunkIntent = plan.find(item => item.stage === 'chunking' && item.jobKey === intent.prerequisiteKeys[0]);
      if (!chunkIntent || row.chunkStage !== 'chunking' || row.chunkJobKey !== chunkIntent.jobKey
        || row.chunkFingerprint !== chunkIntent.dependencyFingerprint) throw new Error('FOREIGN_ASSEMBLY_PREREQUISITE');
      const chunksArtifact = await readTextArtifact(input.sql, job.workspaceId, String(row.chunkArtifactId), {
        kind: 'chunks', inputFingerprint: chunkIntent.dependencyFingerprint, checksum: String(row.chunkChecksum),
      });
      const analysisArtifact = await readTextArtifact(input.sql, job.workspaceId, String(row.analysisArtifactId), {
        kind: 'analysis', inputFingerprint: intent.dependencyFingerprint, checksum: String(row.analysisChecksum),
      });
      if (chunksArtifact.ref.sourceId !== intent.sourceId || chunksArtifact.ref.sourceVersion !== intent.sourceVersion
        || analysisArtifact.ref.sourceId !== intent.sourceId || analysisArtifact.ref.sourceVersion !== intent.sourceVersion) {
        throw new Error('FOREIGN_ASSEMBLY_PREREQUISITE');
      }
      const source = state.sources.find(item => item.id === intent.sourceId)!;
      const isolated = { ...state, sources: [source], chunks: [], understanding: [], analyses: [] };
      const chunks = cohortChunkSchema.array().parse(JSON.parse(chunksArtifact.bytes.toString('utf8')));
      const expectedChunks = computeTextStage({ ...isolated, processing: { ...state.processing, stage: 'chunking' } }).result;
      if (JSON.stringify(chunks) !== JSON.stringify(expectedChunks)) throw new Error('FABRICATED_ASSEMBLY_EVIDENCE');
      const analyses = cohortWorkspaceSchema.shape.analyses.parse(JSON.parse(analysisArtifact.bytes.toString('utf8')));
      const expectedAnalyses = computeTextStage({ ...isolated, chunks, processing: { ...state.processing, stage: 'analysis' } }).result;
      if (JSON.stringify(analyses) !== JSON.stringify(expectedAnalyses)) throw new Error('FABRICATED_ASSEMBLY_EVIDENCE');
      bySource.set(source.id, chunks);
    }
    if (seen.size !== expected.size) throw new Error('MISSING_ASSEMBLY_PREREQUISITE');
    const chunks = state.sources.flatMap(source => bySource.get(source.id) ?? []);
    if (chunks.length === 0 || chunks.length > 100) throw new Error('INVALID_ASSEMBLY_SCOPE');
    const lessons = cohortLessonSchema.array().parse(computeTextStage({
      ...state, chunks, processing: { ...state.processing, stage: 'assembly' },
    }).result);
    if (lessons.length !== chunks.length || lessons.some(lesson => lesson.sourceChunkIds.some(id => !chunks.some(chunk => chunk.id === id)))) {
      throw new Error('FABRICATED_ASSEMBLY_EVIDENCE');
    }
    return Buffer.from(JSON.stringify(lessons));
  };
}
