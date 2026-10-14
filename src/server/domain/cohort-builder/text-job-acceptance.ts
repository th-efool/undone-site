import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactRef } from './text-artifacts';
import { planTextJobs } from './text-job-plan';
import type { TextJobTransactionPort } from './text-job-scheduler';
import { acceptTextJob, type ClaimedTextJob } from './text-jobs';
import { textJobStatus } from './text-job-status';
import { commitTextProjection } from './text-projection-commit';

/** Prepared cutover boundary: lock canonical workspace state before fenced result acceptance. */
export async function acceptCurrentTextJob(
  port: TextJobTransactionPort,
  job: ClaimedTextJob,
  artifact: Pick<TextArtifactRef, 'id' | 'workspaceId' | 'kind' | 'inputFingerprint' | 'checksum'>,
  now: Date
): Promise<boolean> {
  return port.transaction(async tx => {
    const workspace = (await tx.query(`SELECT "snapshot", "revision" FROM "interaction_workspaces"
      WHERE "id" = $1 AND "lifecycle" = 'active' AND "domainId" = 'cohort' FOR UPDATE`, [job.workspaceId])).rows[0];
    if (!workspace) return false;
    const state = cohortWorkspaceSchema.parse(typeof workspace.snapshot === 'string'
      ? JSON.parse(workspace.snapshot) : workspace.snapshot);
    const row = (await tx.query(`SELECT "jobKey", "stage", "sourceId", "sourceVersion", "dependencyFingerprint"
      FROM "cohort_text_jobs" WHERE "id" = $1 AND "workspaceId" = $2 FOR UPDATE`,
    [job.id, job.workspaceId])).rows[0];
    if (!row || row.stage !== job.stage || row.sourceId !== job.sourceId
      || (row.sourceVersion === null ? null : Number(row.sourceVersion)) !== job.sourceVersion
      || row.dependencyFingerprint !== job.dependencyFingerprint) return false;
    const current = planTextJobs(state).some(intent => intent.jobKey === row.jobKey
      && intent.stage === job.stage && intent.sourceId === job.sourceId
      && intent.sourceVersion === job.sourceVersion
      && intent.dependencyFingerprint === job.dependencyFingerprint);
    if (!current) return false;
    if (!await acceptTextJob(tx, job, artifact, now)) return false;
    await commitTextProjection(tx, job.workspaceId, state, await textJobStatus(tx, job.workspaceId, state),
      Number(workspace.revision), `text-stage:${job.id}:${job.fence}`, `Source ${job.stage} accepted.`);
    return true;
  });
}
