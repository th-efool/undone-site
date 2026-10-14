import { cohortLessonSchema, cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import { readTextArtifact, type TextArtifactRef } from './text-artifacts';
import { planTextJobs } from './text-job-plan';
import { projectGeneratedLessons } from './lesson-projection';
import type { TextJobTransactionPort } from './text-job-scheduler';
import { acceptTextJob, type ClaimedTextJob } from './text-jobs';

/** Atomically accepts assembly and projects only validated generated lessons. */
export async function acceptAssemblyProjection(
  port: TextJobTransactionPort,
  job: ClaimedTextJob,
  artifact: Pick<TextArtifactRef, 'id' | 'workspaceId' | 'kind' | 'inputFingerprint' | 'checksum'>,
  now: Date,
): Promise<boolean> {
  return port.transaction(async tx => {
    const row = (await tx.query(`SELECT "snapshot", "revision" FROM "interaction_workspaces" WHERE "id" = $1 FOR UPDATE`, [job.workspaceId])).rows[0];
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
    if (generated.length !== state.chunks.length || generated.some(lesson => lesson.sourceChunkIds.some(id => !state.chunks.some(chunk => chunk.id === id)))) return false;
    const next = cohortWorkspaceSchema.parse({
      ...state,
      lessons: projectGeneratedLessons(state.lessons, generated, new Set(state.chunks.map(chunk => chunk.id))),
      processing: { ...state.processing, status: 'ready', stage: 'done', error: null },
    });
    const updated = await tx.query(`UPDATE "interaction_workspaces" SET "snapshot" = $1::jsonb, "revision" = "revision" + 1
      WHERE "id" = $2 AND "revision" = $3 RETURNING "revision"`, [JSON.stringify(next), job.workspaceId, Number(row.revision)]);
    if (updated.rows.length !== 1) return false;
    return acceptTextJob(tx, job, artifact, now);
  });
}
