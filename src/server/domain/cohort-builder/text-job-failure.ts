import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import type { TextJobTransactionPort } from './text-job-scheduler';
import { failTextJob, type ClaimedTextJob } from './text-jobs';
import { textJobStatus } from './text-job-status';
import { commitTextProjection } from './text-projection-commit';

export function failCurrentTextJob(port: TextJobTransactionPort, job: ClaimedTextJob, code: string, now: Date) {
  return port.transaction(async tx => {
    const row = (await tx.query(`SELECT "snapshot", "revision" FROM "interaction_workspaces"
      WHERE "id" = $1 AND "domainId" = 'cohort' AND "lifecycle" = 'active' FOR UPDATE`, [job.workspaceId])).rows[0];
    if (!row || !await failTextJob(tx, job, code, now)) return false;
    const state = cohortWorkspaceSchema.parse(row.snapshot);
    await commitTextProjection(tx, job.workspaceId, state, await textJobStatus(tx, job.workspaceId, state),
      Number(row.revision), `text-failure:${job.id}:${job.fence}`, 'Source processing failed; retry status updated.');
    return true;
  });
}
