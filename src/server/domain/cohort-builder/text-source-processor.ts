import { cohortChunkSchema, cohortWorkspaceSchema, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { readTextArtifact, type CohortTextArtifactKind, type TextArtifactSql } from './text-artifacts';
import { planTextJobs, type TextJobStage } from './text-job-plan';
import type { ClaimedTextJob } from './text-jobs';
import { computeTextStage } from './text-pipeline';

type SourceStage = Exclude<TextJobStage, 'assembly'>;

const prerequisite: Partial<Record<SourceStage, { stage: SourceStage; kind: CohortTextArtifactKind }>> = {
  understanding: { stage: 'acquisition', kind: 'source_raw' },
  chunking: { stage: 'understanding', kind: 'understanding' },
  analysis: { stage: 'chunking', kind: 'chunks' },
};

function stageResult(state: CohortWorkspace, stage: SourceStage, chunks: CohortWorkspace['chunks'] = []): unknown {
  return computeTextStage({
    ...state,
    sources: state.sources.slice(0, 1),
    chunks,
    understanding: [], analyses: [],
    processing: { ...state.processing, stage },
  }).result;
}

/** Deterministic host adapter for one retained pasted-text source. Global assembly is separate. */
export function createTextSourceProcessor(input: {
  sql: TextArtifactSql;
  loadWorkspace: (workspaceId: string) => Promise<unknown>;
}): (job: ClaimedTextJob) => Promise<Uint8Array> {
  return async job => {
    if (!job.sourceId || job.sourceVersion === null || job.stage === 'assembly') throw new Error('INVALID_SOURCE_JOB');
    const state = cohortWorkspaceSchema.parse(await input.loadWorkspace(job.workspaceId));
    const planned = planTextJobs(state).find(intent => intent.stage === job.stage && intent.sourceId === job.sourceId
      && intent.sourceVersion === job.sourceVersion && intent.dependencyFingerprint === job.dependencyFingerprint);
    if (!planned) throw new Error('STALE_SOURCE_JOB');
    const source = state.sources.find(item => item.id === job.sourceId && item.version === job.sourceVersion);
    if (!source) throw new Error('STALE_SOURCE_JOB');
    const isolated: CohortWorkspace = { ...state, sources: [source] };
    const stage = job.stage as SourceStage;
    if (stage === 'acquisition') return Buffer.from(source.text, 'utf8');

    const required = prerequisite[stage];
    if (!required) throw new Error('INVALID_SOURCE_JOB');
    const found = await input.sql.query(`SELECT prior."stage", prior."sourceId", prior."sourceVersion",
        prior."dependencyFingerprint", prior."resultArtifactId", artifact."checksum"
      FROM "cohort_text_job_edges" edge
      JOIN "cohort_text_jobs" prior ON prior."id" = edge."prerequisiteId" AND prior."workspaceId" = edge."workspaceId"
      JOIN "cohort_text_artifacts" artifact ON artifact."id" = prior."resultArtifactId" AND artifact."workspaceId" = prior."workspaceId"
      WHERE edge."workspaceId" = $1 AND edge."jobId" = $2 AND prior."status" = 'accepted'`,
    [job.workspaceId, job.id]);
    if (found.rows.length !== 1) throw new Error('MISSING_SOURCE_PREREQUISITE');
    const row = found.rows[0];
    if (row.stage !== required.stage || row.sourceId !== source.id || Number(row.sourceVersion) !== source.version) throw new Error('FOREIGN_SOURCE_PREREQUISITE');
    const retained = await readTextArtifact(input.sql, job.workspaceId, String(row.resultArtifactId), {
      kind: required.kind, inputFingerprint: String(row.dependencyFingerprint), checksum: String(row.checksum),
    });
    if (retained.ref.sourceId !== source.id || retained.ref.sourceVersion !== source.version) throw new Error('FOREIGN_SOURCE_PREREQUISITE');
    if (stage === 'understanding') {
      if (retained.bytes.toString('utf8') !== source.text) throw new Error('STALE_SOURCE_PREREQUISITE');
      const result = cohortWorkspaceSchema.shape.understanding.parse(stageResult(isolated, stage));
      return Buffer.from(JSON.stringify(result));
    }
    if (stage === 'chunking') {
      const understood = cohortWorkspaceSchema.shape.understanding.parse(JSON.parse(retained.bytes.toString('utf8')));
      if (JSON.stringify(understood) !== JSON.stringify(stageResult(isolated, 'understanding'))) throw new Error('STALE_SOURCE_PREREQUISITE');
      const result = cohortChunkSchema.array().parse(stageResult(isolated, stage));
      return Buffer.from(JSON.stringify(result));
    }
    const chunks = cohortChunkSchema.array().parse(JSON.parse(retained.bytes.toString('utf8')));
    if (JSON.stringify(chunks) !== JSON.stringify(stageResult(isolated, 'chunking'))) throw new Error('STALE_SOURCE_PREREQUISITE');
    const result = cohortWorkspaceSchema.shape.analyses.parse(stageResult(isolated, stage, chunks));
    return Buffer.from(JSON.stringify(result));
  };
}
