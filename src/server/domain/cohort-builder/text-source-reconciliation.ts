import { cohortWorkspaceSchema, planCohortAction, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { enqueueTextJobPlanInTransaction, type TextJobTransactionPort } from './text-job-scheduler';

/** Applies a source edit and reconciles its durable DAG under one workspace lock. */
export async function editSourceAndReconcileTextJobs(port: TextJobTransactionPort, input: {
  workspaceId: string; sourceId: string; label: string; text: string;
}): Promise<{ revision: number; superseded: number; inserted: number }> {
  return port.transaction(async tx => {
    const row = (await tx.query(`SELECT "snapshot", "revision" FROM "interaction_workspaces" WHERE "id" = $1 FOR UPDATE`, [input.workspaceId])).rows[0];
    if (!row) throw new Error('UNKNOWN_WORKSPACE');
    const state = cohortWorkspaceSchema.parse(typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot);
    const plan = planCohortAction(state, { type: 'edit_text_source', sourceId: input.sourceId, label: input.label, text: input.text }, {
      actionId: `source-edit:${input.sourceId}`, workspaceId: input.workspaceId, expectedRevision: Number(row.revision), currentRevision: Number(row.revision), entityVersions: new Map(),
    });
    const next = cohortWorkspaceSchema.parse(plan.nextState);
    const updated = await tx.query(`UPDATE "interaction_workspaces" SET "snapshot" = $1::jsonb, "revision" = "revision" + 1
      WHERE "id" = $2 AND "revision" = $3 RETURNING "revision"`, [JSON.stringify(next), input.workspaceId, Number(row.revision)]);
    if (updated.rows.length !== 1) throw new Error('STALE_WORKSPACE');
    const graph = await enqueueTextJobPlanInTransaction(tx, input.workspaceId, next);
    return { revision: Number(updated.rows[0].revision), superseded: graph.superseded, inserted: graph.inserted };
  });
}
