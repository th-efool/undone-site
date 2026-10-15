import 'server-only';
import { randomUUID } from 'node:crypto';
import type { TextArtifactSql } from './text-artifacts';
import type { CohortRetentionPolicy } from './retention-policy';

export interface RetentionSweepOptions {
  policy: CohortRetentionPolicy;
  dryRun?: boolean;
  confirmDestructive?: boolean;
  isolatedTargetOnly?: boolean;
  now?: Date;
}

export interface RetentionSweepResult {
  dryRun: boolean;
  prunedEvents: number;
  prunedOrphanArtifacts: number;
  reclaimedOrphanBytes: number;
  purgedWorkspaces: number;
  purgedDraftArtifacts: number;
  reclaimedDraftBytes: number;
  actions: string[];
}

/**
 * Initializes the retention and protection schema in PostgreSQL / PGlite.
 * Additive only, safe for existing tables.
 */
export async function initRetentionTables(sql: TextArtifactSql): Promise<void> {
  await sql.query(
    `CREATE TABLE IF NOT EXISTS "cohort_text_artifact_protection" (
       "artifactId" TEXT NOT NULL,
       "workspaceId" TEXT NOT NULL,
       "readLeaseUntil" TIMESTAMPTZ,
       "readLeaseToken" TEXT,
       "pendingReleasePinUntil" TIMESTAMPTZ,
       "pinnedPermanently" BOOLEAN NOT NULL DEFAULT FALSE,
       "pinnedCohortId" TEXT,
       "tombstonedAt" TIMESTAMPTZ,
       "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY ("artifactId", "workspaceId")
     )`,
    []
  );

  await sql.query(
    `CREATE INDEX IF NOT EXISTS "cohort_text_artifact_protection_lease_idx"
     ON "cohort_text_artifact_protection"("readLeaseUntil", "pendingReleasePinUntil", "pinnedPermanently")`,
    []
  );

  await sql.query(
    `CREATE TABLE IF NOT EXISTS "cohort_retention_audit_log" (
       "id" TEXT PRIMARY KEY,
       "action" TEXT NOT NULL,
       "targetType" TEXT NOT NULL,
       "targetId" TEXT NOT NULL,
       "workspaceId" TEXT,
       "reclaimedBytes" INTEGER NOT NULL DEFAULT 0,
       "reason" TEXT,
       "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
    []
  );
}

/**
 * Atomically acquires a read lease protecting an artifact from concurrent cleanup while streaming/reading.
 */
export async function acquireArtifactReadLease(
  sql: TextArtifactSql,
  params: {
    artifactId: string;
    workspaceId: string;
    durationMs: number;
    leaseToken?: string;
    now?: Date;
  }
): Promise<{ leased: boolean; leaseUntil: Date; leaseToken: string }> {
  const now = params.now ?? new Date();
  const leaseToken = params.leaseToken ?? randomUUID();
  const leaseUntil = new Date(now.getTime() + params.durationMs);

  await sql.query(
    `INSERT INTO "cohort_text_artifact_protection"
       ("artifactId", "workspaceId", "readLeaseUntil", "readLeaseToken", "updatedAt")
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ("artifactId", "workspaceId") DO UPDATE
       SET "readLeaseUntil" = GREATEST("cohort_text_artifact_protection"."readLeaseUntil", $3),
           "readLeaseToken" = $4,
           "updatedAt" = $5`,
    [params.artifactId, params.workspaceId, leaseUntil, leaseToken, now]
  );

  return { leased: true, leaseUntil, leaseToken };
}

/**
 * Renews an active read lease if token matches or existing lease has not expired.
 */
export async function renewArtifactReadLease(
  sql: TextArtifactSql,
  params: {
    artifactId: string;
    workspaceId: string;
    durationMs: number;
    leaseToken: string;
    now?: Date;
  }
): Promise<boolean> {
  const now = params.now ?? new Date();
  const newLeaseUntil = new Date(now.getTime() + params.durationMs);

  const res = await sql.query(
    `UPDATE "cohort_text_artifact_protection"
     SET "readLeaseUntil" = $1, "updatedAt" = $2
     WHERE "artifactId" = $3 AND "workspaceId" = $4
       AND ("readLeaseToken" = $5 OR "readLeaseUntil" IS NULL OR "readLeaseUntil" < $2)`,
    [newLeaseUntil, now, params.artifactId, params.workspaceId, params.leaseToken]
  );

  return res.rows.length > 0;
}

/**
 * Releases an active read lease immediately upon read completion.
 */
export async function releaseArtifactReadLease(
  sql: TextArtifactSql,
  params: {
    artifactId: string;
    workspaceId: string;
    leaseToken: string;
    now?: Date;
  }
): Promise<boolean> {
  const now = params.now ?? new Date();
  const res = await sql.query(
    `UPDATE "cohort_text_artifact_protection"
     SET "readLeaseUntil" = NULL, "readLeaseToken" = NULL, "updatedAt" = $1
     WHERE "artifactId" = $2 AND "workspaceId" = $3 AND "readLeaseToken" = $4`,
    [now, params.artifactId, params.workspaceId, params.leaseToken]
  );
  return res.rows.length > 0;
}

/**
 * Pins an artifact temporarily during the release validation and candidate freeze window.
 */
export async function pinArtifactForRelease(
  sql: TextArtifactSql,
  params: {
    artifactId: string;
    workspaceId: string;
    durationMs: number;
    now?: Date;
  }
): Promise<{ pinned: boolean; pinUntil: Date }> {
  const now = params.now ?? new Date();
  const pinUntil = new Date(now.getTime() + params.durationMs);

  await sql.query(
    `INSERT INTO "cohort_text_artifact_protection"
       ("artifactId", "workspaceId", "pendingReleasePinUntil", "updatedAt")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("artifactId", "workspaceId") DO UPDATE
       SET "pendingReleasePinUntil" = GREATEST("cohort_text_artifact_protection"."pendingReleasePinUntil", $3),
           "updatedAt" = $4`,
    [params.artifactId, params.workspaceId, pinUntil, now]
  );

  return { pinned: true, pinUntil };
}

/**
 * Permanently pins an artifact upon committed cohort release.
 * Draft cleanup sweeps will NEVER delete permanently pinned artifacts.
 */
export async function pinArtifactPermanently(
  sql: TextArtifactSql,
  params: {
    artifactId: string;
    workspaceId: string;
    cohortId: string;
    now?: Date;
  }
): Promise<void> {
  const now = params.now ?? new Date();
  await sql.query(
    `INSERT INTO "cohort_text_artifact_protection"
       ("artifactId", "workspaceId", "pinnedPermanently", "pinnedCohortId", "updatedAt")
     VALUES ($1, $2, TRUE, $3, $4)
     ON CONFLICT ("artifactId", "workspaceId") DO UPDATE
       SET "pinnedPermanently" = TRUE,
           "pinnedCohortId" = $3,
           "pendingReleasePinUntil" = NULL,
           "updatedAt" = $4`,
    [params.artifactId, params.workspaceId, params.cohortId, now]
  );
}

/**
 * Tombstones a workspace, revokes subsequent access, and cancels in-flight runs/jobs.
 * Deletion first revokes access and cancels work; physical purge occurs only after grace period.
 */
export async function tombstoneWorkspace(
  sql: TextArtifactSql,
  params: {
    workspaceId: string;
    ownerId: string;
    reason: string;
    now?: Date;
  }
): Promise<{ tombstoned: boolean; canceledRuns: number; canceledJobs: number }> {
  const now = params.now ?? new Date();

  // 1. Verify ownership and check current lifecycle
  const wsRes = await sql.query(
    `SELECT "ownerId", "lifecycle" FROM "interaction_workspaces" WHERE "id" = $1`,
    [params.workspaceId]
  );
  const row = wsRes.rows[0];
  if (!row) {
    throw new Error('WORKSPACE_NOT_FOUND');
  }
  if (row.ownerId !== params.ownerId) {
    throw new Error('UNAUTHORIZED_OWNER: Cannot tombstone workspace owned by another user.');
  }

  // 2. Set lifecycle to 'tombstoned'
  await sql.query(
    `UPDATE "interaction_workspaces"
     SET "lifecycle" = 'tombstoned', "updatedAt" = $1
     WHERE "id" = $2`,
    [now, params.workspaceId]
  );

  // 3. Cancel all active in-flight assistant runs
  const cancelRunsRes = await sql.query(
    `UPDATE "interaction_runs"
     SET "status" = 'canceled', "error" = 'WORKSPACE_TOMBSTONED', "updatedAt" = $1
     WHERE "workspaceId" = $2 AND "status" IN ('queued', 'running')`,
    [now, params.workspaceId]
  );

  // 4. Cancel all active in-flight text processing DAG jobs
  const cancelJobsRes = await sql.query(
    `UPDATE "cohort_text_jobs"
     SET "status" = 'canceled', "errorCode" = 'WORKSPACE_TOMBSTONED', "updatedAt" = $1
     WHERE "workspaceId" = $2 AND "status" IN ('queued', 'running')`,
    [now, params.workspaceId]
  );

  // 5. Mark workspace artifacts in protection table with tombstonedAt (unless permanently pinned by release)
  await sql.query(
    `INSERT INTO "cohort_text_artifact_protection" ("artifactId", "workspaceId", "tombstonedAt", "updatedAt")
     SELECT a."id", a."workspaceId", $1, $1
     FROM "cohort_text_artifacts" a
     WHERE a."workspaceId" = $2
     ON CONFLICT ("artifactId", "workspaceId") DO UPDATE
       SET "tombstonedAt" = $1, "updatedAt" = $1
       WHERE "cohort_text_artifact_protection"."pinnedPermanently" = FALSE`,
    [now, params.workspaceId]
  );

  // 6. Record audit log
  await sql.query(
    `INSERT INTO "cohort_retention_audit_log"
       ("id", "action", "targetType", "targetId", "workspaceId", "reclaimedBytes", "reason", "createdAt")
     VALUES ($1, 'workspace_tombstoned', 'workspace', $2, $2, 0, $3, $4)`,
    [randomUUID(), params.workspaceId, params.reason, now]
  );

  return {
    tombstoned: true,
    canceledRuns: cancelRunsRes.rows.length,
    canceledJobs: cancelJobsRes.rows.length,
  };
}

/**
 * Runs a retention and safe cleanup sweep.
 * Default is inspect/dry-run. Destructive execution requires dryRun=false AND confirmation.
 */
export async function runRetentionSweep(
  sql: TextArtifactSql,
  options: RetentionSweepOptions
): Promise<RetentionSweepResult> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun ?? true;
  const batchLimit = options.policy.batchLimit ?? 50;

  if (!dryRun) {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_PRODUCTION_CLEANUP !== '1'
    ) {
      throw new Error(
        'PRODUCTION_CLEANUP_BLOCKED: Destructive cleanup on shared production storage is not authorized.'
      );
    }
    if (!options.confirmDestructive && !options.isolatedTargetOnly) {
      throw new Error(
        'CONFIRMATION_REQUIRED: Destructive cleanup requires explicit confirmDestructive or isolatedTargetOnly flag.'
      );
    }
  }

  const actions: string[] = [];
  let prunedEvents = 0;
  let prunedOrphanArtifacts = 0;
  let reclaimedOrphanBytes = 0;
  let purgedWorkspaces = 0;
  let purgedDraftArtifacts = 0;
  let reclaimedDraftBytes = 0;

  // -------------------------------------------------------------
  // SWEEP 1: Prune transient event replay records older than eventReplayRetentionDays
  // Durable transcript (interaction_messages) is strictly preserved!
  // -------------------------------------------------------------
  const eventCutoff = new Date(now.getTime() - options.policy.eventReplayRetentionDays * 86_400_000);
  const eligibleEventsRes = await sql.query(
    `SELECT "id" FROM "interaction_events"
     WHERE "createdAt" < $1
     ORDER BY "createdAt" ASC
     LIMIT $2`,
    [eventCutoff, batchLimit]
  );

  prunedEvents = eligibleEventsRes.rows.length;
  actions.push(`[Sweep 1] Identified ${prunedEvents} transient replay events older than ${eventCutoff.toISOString()}`);

  if (!dryRun && prunedEvents > 0) {
    const ids = eligibleEventsRes.rows.map(r => String(r.id));
    const inPlaceholders = ids.map((_, i) => `$${i + 1}`).join(',');
    await sql.query(
      `DELETE FROM "interaction_events" WHERE "id" IN (${inPlaceholders})`,
      ids
    );
    await sql.query(
      `INSERT INTO "cohort_retention_audit_log"
         ("id", "action", "targetType", "targetId", "workspaceId", "reclaimedBytes", "reason", "createdAt")
       VALUES ($1, 'prune_events', 'events_batch', $2, NULL, 0, 'expired_replay_window', $3)`,
      [randomUUID(), `batch_${prunedEvents}`, now]
    );
  }

  // -------------------------------------------------------------
  // SWEEP 2: Prune orphan text artifacts
  // An artifact is orphan if:
  // 1. Not referenced by any cohort_text_jobs (resultArtifactId)
  // 2. Not permanently pinned for learner delivery (pinnedPermanently = TRUE)
  // 3. Not currently held by an active read lease (readLeaseUntil > now)
  // 4. Not currently held by a pending release pin (pendingReleasePinUntil > now)
  // 5. Created before orphanArtifactRetentionDays cutoff
  // -------------------------------------------------------------
  const orphanCutoff = new Date(now.getTime() - options.policy.orphanArtifactRetentionDays * 86_400_000);
  const eligibleOrphansRes = await sql.query(
    `SELECT a."id", a."workspaceId", a."byteLength"
     FROM "cohort_text_artifacts" a
     LEFT JOIN "cohort_text_artifact_protection" p
       ON p."artifactId" = a."id" AND p."workspaceId" = a."workspaceId"
     WHERE a."createdAt" < $1
       AND NOT EXISTS (
         SELECT 1 FROM "cohort_text_jobs" j
         WHERE j."resultArtifactId" = a."id" AND j."workspaceId" = a."workspaceId"
       )
       AND (p."pinnedPermanently" IS NULL OR p."pinnedPermanently" = FALSE)
       AND (p."readLeaseUntil" IS NULL OR p."readLeaseUntil" <= $2)
       AND (p."pendingReleasePinUntil" IS NULL OR p."pendingReleasePinUntil" <= $2)
     ORDER BY a."createdAt" ASC
     LIMIT $3`,
    [orphanCutoff, now, batchLimit]
  );

  prunedOrphanArtifacts = eligibleOrphansRes.rows.length;
  reclaimedOrphanBytes = eligibleOrphansRes.rows.reduce(
    (sum, r) => sum + (Number(r.byteLength) || 0),
    0
  );
  actions.push(
    `[Sweep 2] Identified ${prunedOrphanArtifacts} orphan artifacts (${reclaimedOrphanBytes} bytes) older than ${orphanCutoff.toISOString()}`
  );

  if (!dryRun && prunedOrphanArtifacts > 0) {
    for (const r of eligibleOrphansRes.rows) {
      const artId = String(r.id);
      const wsId = String(r.workspaceId);
      const bLen = Number(r.byteLength) || 0;

      await sql.query(
        `DELETE FROM "cohort_text_artifact_protection" WHERE "artifactId" = $1 AND "workspaceId" = $2`,
        [artId, wsId]
      );
      await sql.query(
        `DELETE FROM "cohort_text_artifacts" WHERE "id" = $1 AND "workspaceId" = $2`,
        [artId, wsId]
      );
      await sql.query(
        `INSERT INTO "cohort_retention_audit_log"
           ("id", "action", "targetType", "targetId", "workspaceId", "reclaimedBytes", "reason", "createdAt")
         VALUES ($1, 'purge_orphan_artifact', 'artifact', $2, $3, $4, 'unreferenced_orphan_expired', $5)`,
        [randomUUID(), artId, wsId, bLen, now]
      );
    }
  }

  // -------------------------------------------------------------
  // SWEEP 3: Finalize tombstoned workspaces past tombstoneGraceDays
  // Deletes unreleased draft artifacts, cancels, and purges workspace metadata.
  // Permanently pinned artifacts remain protected!
  // -------------------------------------------------------------
  const tombstoneCutoff = new Date(now.getTime() - options.policy.tombstoneGraceDays * 86_400_000);
  const eligibleTombstonesRes = await sql.query(
    `SELECT "id", "ownerId"
     FROM "interaction_workspaces"
     WHERE "lifecycle" = 'tombstoned' AND "updatedAt" < $1
     ORDER BY "updatedAt" ASC
     LIMIT $2`,
    [tombstoneCutoff, batchLimit]
  );

  purgedWorkspaces = eligibleTombstonesRes.rows.length;
  actions.push(
    `[Sweep 3] Identified ${purgedWorkspaces} tombstoned workspaces past grace period ${tombstoneCutoff.toISOString()}`
  );

  if (!dryRun && purgedWorkspaces > 0) {
    for (const ws of eligibleTombstonesRes.rows) {
      const wsId = String(ws.id);

      // Find draft artifacts that are NOT pinned permanently
      const unpinnedArtifactsRes = await sql.query(
        `SELECT a."id", a."byteLength"
         FROM "cohort_text_artifacts" a
         LEFT JOIN "cohort_text_artifact_protection" p
           ON p."artifactId" = a."id" AND p."workspaceId" = a."workspaceId"
         WHERE a."workspaceId" = $1
           AND (p."pinnedPermanently" IS NULL OR p."pinnedPermanently" = FALSE)`,
        [wsId]
      );

      for (const art of unpinnedArtifactsRes.rows) {
        const artId = String(art.id);
        const bLen = Number(art.byteLength) || 0;
        purgedDraftArtifacts++;
        reclaimedDraftBytes += bLen;

        await sql.query(
          `DELETE FROM "cohort_text_artifact_protection" WHERE "artifactId" = $1 AND "workspaceId" = $2`,
          [artId, wsId]
        );
        await sql.query(
          `DELETE FROM "cohort_text_artifacts" WHERE "id" = $1 AND "workspaceId" = $2`,
          [artId, wsId]
        );
      }

      // Purge workspace dependencies and record
      await sql.query(`DELETE FROM "cohort_text_jobs" WHERE "workspaceId" = $1`, [wsId]);
      await sql.query(`DELETE FROM "interaction_steps" WHERE "runId" IN (SELECT "id" FROM "interaction_runs" WHERE "workspaceId" = $1)`, [wsId]);
      await sql.query(`DELETE FROM "interaction_runs" WHERE "workspaceId" = $1`, [wsId]);
      await sql.query(`DELETE FROM "interaction_messages" WHERE "workspaceId" = $1`, [wsId]);
      await sql.query(`DELETE FROM "interaction_events" WHERE "workspaceId" = $1`, [wsId]);
      await sql.query(`DELETE FROM "interaction_outbox" WHERE "workspaceId" = $1`, [wsId]);
      await sql.query(`DELETE FROM "interaction_requests" WHERE "workspaceId" = $1`, [wsId]);
      await sql.query(`DELETE FROM "interaction_proposals" WHERE "workspaceId" = $1`, [wsId]);
      await sql.query(`DELETE FROM "interaction_workspaces" WHERE "id" = $1`, [wsId]);

      await sql.query(
        `INSERT INTO "cohort_retention_audit_log"
           ("id", "action", "targetType", "targetId", "workspaceId", "reclaimedBytes", "reason", "createdAt")
         VALUES ($1, 'purge_tombstoned_workspace', 'workspace', $2, $2, 0, 'grace_period_expired', $3)`,
        [randomUUID(), wsId, now]
      );
    }
  }

  return {
    dryRun,
    prunedEvents,
    prunedOrphanArtifacts,
    reclaimedOrphanBytes,
    purgedWorkspaces,
    purgedDraftArtifacts,
    reclaimedDraftBytes,
    actions,
  };
}
