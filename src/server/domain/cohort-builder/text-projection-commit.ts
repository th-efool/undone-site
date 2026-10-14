import { deterministicUuid, planActionCommit } from 'interaction-builder/runtime';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactSql } from './text-artifacts';

/** Caller holds the workspace lock and persists the job transition in this transaction. */
export async function commitTextProjection(tx: TextArtifactSql, workspaceId: string, state: CohortWorkspace,
  next: CohortWorkspace, revision: number, actionKey: string, summary: string): Promise<void> {
  const commit = planActionCommit({ state, currentRevision: revision,
    envelope: { actionId: deterministicUuid(actionKey), workspaceId, expectedRevision: revision, entityVersions: [], action: { type: 'text_job_projection' } },
    plan: () => ({ nextState: next, changed: [], invalidated: [], summary, undoable: false }),
  });
  const updated = await tx.query(`UPDATE "interaction_workspaces" SET "snapshot" = $1::jsonb,
    "revision" = $2, "sequence" = "sequence" + 1, "contextEpoch" = "contextEpoch" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = $3 AND "revision" = $4 AND "lifecycle" = 'active' AND "domainId" = 'cohort'
    RETURNING "sequence"`, [JSON.stringify(commit.state), commit.revision, workspaceId, revision]);
  if (updated.rows.length !== 1) throw new Error('TEXT_PROJECTION_CONFLICT');
  await tx.query(`INSERT INTO "interaction_events" ("id", "workspaceId", "sequence", "protocolVersion", "type", "revision", "payload")
    VALUES ($1, $2, $3, 1, 'workspace.committed', $4, $5::jsonb)`, [crypto.randomUUID(), workspaceId,
    Number(updated.rows[0].sequence), commit.revision, JSON.stringify({ receipt: commit.receipt,
      baseRevision: revision, revision: commit.revision, changeSet: commit.receipt.changed })]);
}
