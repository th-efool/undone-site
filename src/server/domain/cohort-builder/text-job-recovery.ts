import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import type { TextJobTransactionPort } from './text-job-scheduler';
import { enqueueTextJobPlanInTransaction } from './text-job-scheduler';
import { textJobStatus } from './text-job-status';
import { commitTextProjection } from './text-projection-commit';

/** Bootstrap pre-cutover queued work and expose expired-attempt terminal states. */
export function recoverTextWorkspace(port: TextJobTransactionPort, workspaceId: string) {
  return port.transaction(async tx => {
    const row = (await tx.query(`SELECT "snapshot", "revision" FROM "interaction_workspaces"
      WHERE "id"=$1 AND "domainId"='cohort' AND "lifecycle"='active' FOR UPDATE`, [workspaceId])).rows[0];
    if (!row) return;
    const state = cohortWorkspaceSchema.parse(row.snapshot);
    state.processing.driver = 'durable';
    if (state.processing.status === 'queued' || state.processing.status === 'failed') await enqueueTextJobPlanInTransaction(tx, workspaceId, state);
    const next = await textJobStatus(tx, workspaceId, state);
    if (JSON.stringify(next.processing) !== JSON.stringify(state.processing)) {
      await commitTextProjection(tx, workspaceId, state, next, Number(row.revision),
        `text-recovery:${workspaceId}:${row.revision}`, 'Source processing status refreshed.');
    }
  });
}
