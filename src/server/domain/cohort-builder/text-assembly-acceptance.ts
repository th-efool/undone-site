import { cohortLessonSchema, cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import { readTextArtifact, type TextArtifactRef } from './text-artifacts';
import { planTextJobs } from './text-job-plan';
import { projectGeneratedLessons } from './lesson-projection';
import type { TextJobTransactionPort } from './text-job-scheduler';
import { acceptTextJob, type ClaimedTextJob } from './text-jobs';
import { createTextAssemblyProcessor } from './text-assembly-processor';
import { computeTextStage, sourceFingerprint } from './text-pipeline';
import { commitTextProjection } from './text-projection-commit';

/** Atomically accepts assembly and projects only validated generated lessons. */
export async function acceptAssemblyProjection(
  port: TextJobTransactionPort,
  job: ClaimedTextJob,
  artifact: Pick<TextArtifactRef, 'id' | 'workspaceId' | 'kind' | 'inputFingerprint' | 'checksum'>,
  now: Date,
): Promise<boolean> {
  return port.transaction(async tx => {
    if (job.stage !== 'assembly' || job.sourceId !== null || job.sourceVersion !== null) return false;
    const row = (await tx.query(`SELECT "snapshot", "revision" FROM "interaction_workspaces" WHERE "id" = $1 AND "lifecycle" = 'active' AND "domainId" = 'cohort' FOR UPDATE`, [job.workspaceId])).rows[0];
    if (!row) return false;
    const state = cohortWorkspaceSchema.parse(typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot);
    const jobRow = (await tx.query(`SELECT "jobKey", "stage", "sourceId", "sourceVersion", "dependencyFingerprint"
      FROM "cohort_text_jobs" WHERE "id" = $1 AND "workspaceId" = $2 FOR UPDATE`, [job.id, job.workspaceId])).rows[0];
    if (!jobRow || jobRow.stage !== 'assembly' || jobRow.sourceId !== null || jobRow.sourceVersion !== null
      || jobRow.dependencyFingerprint !== job.dependencyFingerprint) return false;
    const planned = planTextJobs(state).find(intent => intent.stage === 'assembly');
    if (!planned || planned.jobKey !== jobRow.jobKey || planned.dependencyFingerprint !== job.dependencyFingerprint) return false;
    const retained = await readTextArtifact(tx, job.workspaceId, artifact.id, {
      kind: 'assembly', inputFingerprint: job.dependencyFingerprint, checksum: artifact.checksum,
    });
    const generated = cohortLessonSchema.array().parse(JSON.parse(retained.bytes.toString('utf8')));
    const expected = await createTextAssemblyProcessor({ sql: tx, loadWorkspace: async () => state })(job);
    if (!retained.bytes.equals(Buffer.from(expected))) return false;
    const chunks = cohortWorkspaceSchema.shape.chunks.parse(computeTextStage({ ...state, chunks: [], processing: { ...state.processing, stage: 'chunking' } }).result);
    const analyses = cohortWorkspaceSchema.shape.analyses.parse(computeTextStage({ ...state, chunks, analyses: [], processing: { ...state.processing, stage: 'analysis' } }).result);
    const understanding = cohortWorkspaceSchema.shape.understanding.parse(computeTextStage({ ...state, understanding: [], processing: { ...state.processing, stage: 'understanding' } }).result);
    const acquired = computeTextStage({ ...state, processing: { ...state.processing, stage: 'acquisition' } }).result as Array<{ id: string; checksum: string }>;
    const next = cohortWorkspaceSchema.parse({
      ...state,
      chunks, analyses, understanding,
      sources: state.sources.map(source => ({ ...source, state: 'ready', checksum: acquired.find(item => item.id === source.id)!.checksum })),
      lessons: projectGeneratedLessons(state.lessons, generated, new Set(chunks.map(chunk => chunk.id))),
      processing: { ...state.processing, status: 'ready', stage: 'done', sourceFingerprint: sourceFingerprint(state), error: null },
    });
    if (!await acceptTextJob(tx, job, artifact, now)) return false;
    await commitTextProjection(tx, job.workspaceId, state, next, Number(row.revision), `text-assembly:${job.id}:${job.fence}`, 'Grounded lessons accepted.');
    return true;
  });
}
