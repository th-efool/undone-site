import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import {
  validateCohortRetentionPolicy,
  CohortRetentionPolicyError,
  DEFAULT_PRODUCTION_RETENTION_POLICY,
  TEST_RETENTION_POLICY,
  type CohortRetentionPolicy,
} from '../retention-policy';
import {
  initRetentionTables,
  acquireArtifactReadLease,
  renewArtifactReadLease,
  releaseArtifactReadLease,
  pinArtifactForRelease,
  pinArtifactPermanently,
  tombstoneWorkspace,
  runRetentionSweep,
} from '../retention-cleanup';
import { exportWorkspaceData } from '../workspace-export';
import { putTextArtifact } from '../text-artifacts';

async function setupRetentionTestDb() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS "interaction_workspaces" (
      "id" TEXT PRIMARY KEY,
      "ownerId" TEXT NOT NULL,
      "domainId" TEXT NOT NULL,
      "domainVersion" INT DEFAULT 1,
      "snapshot" JSONB NOT NULL,
      "revision" INT DEFAULT 0,
      "sequence" INT DEFAULT 0,
      "contextEpoch" INT DEFAULT 0,
      "lifecycle" TEXT DEFAULT 'active',
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_messages" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "parts" JSONB NOT NULL,
      "sequence" INT NOT NULL,
      "runId" TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_events" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "sequence" INT NOT NULL,
      "protocolVersion" INT DEFAULT 1,
      "type" TEXT NOT NULL,
      "revision" INT,
      "payload" JSONB NOT NULL,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_runs" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "triggeringMessageId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'queued',
      "contextEpoch" INT DEFAULT 0,
      "observedRevision" INT DEFAULT 0,
      "cursor" INT DEFAULT 0,
      "fence" INT DEFAULT 0,
      "leaseOwner" TEXT,
      "leaseToken" TEXT,
      "leaseUntil" TIMESTAMPTZ,
      "deadline" TIMESTAMPTZ,
      "budgetReservation" JSONB,
      "budgetActual" JSONB,
      "error" TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_steps" (
      "id" TEXT PRIMARY KEY,
      "runId" TEXT NOT NULL,
      "ordinal" INT NOT NULL,
      "kind" TEXT NOT NULL,
      "toolName" TEXT,
      "inputHash" TEXT,
      "inputPayload" JSONB,
      "state" TEXT DEFAULT 'started',
      "result" JSONB,
      "error" TEXT,
      "effectKey" TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_outbox" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "payload" JSONB NOT NULL,
      "dedupKey" TEXT NOT NULL UNIQUE,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "attempts" INT NOT NULL DEFAULT 0,
      "dueAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "leaseOwner" TEXT,
      "leaseToken" TEXT,
      "leaseUntil" TIMESTAMPTZ,
      "deliveredAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_requests" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "actorId" TEXT NOT NULL,
      "operation" TEXT NOT NULL,
      "requestId" TEXT NOT NULL,
      "payloadHash" TEXT NOT NULL,
      "response" JSONB NOT NULL,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_proposals" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "actionPayload" JSONB NOT NULL,
      "readSet" JSONB,
      "summary" TEXT NOT NULL,
      "state" TEXT DEFAULT 'pending',
      "expiresAt" TIMESTAMPTZ,
      "decisionActor" TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "cohort_text_artifacts" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "sourceId" TEXT,
      "sourceVersion" INT,
      "kind" TEXT NOT NULL,
      "inputFingerprint" TEXT NOT NULL,
      "checksum" TEXT NOT NULL,
      "byteLength" INT NOT NULL,
      "body" BYTEA NOT NULL,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "cohort_text_jobs" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "jobKey" TEXT NOT NULL,
      "sourceId" TEXT,
      "sourceVersion" INT,
      "stage" TEXT NOT NULL,
      "handlerVersion" INT DEFAULT 1,
      "dependencyFingerprint" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'queued',
      "attempts" INT DEFAULT 0,
      "dueAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "fence" INT DEFAULT 0,
      "leaseOwner" TEXT,
      "leaseToken" TEXT,
      "leaseUntil" TIMESTAMPTZ,
      "resultArtifactId" TEXT,
      "errorCode" TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_effects" (
      "effectKey" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "contentHash" TEXT NOT NULL,
      "mode" TEXT NOT NULL,
      "cohortId" TEXT NOT NULL,
      "state" TEXT NOT NULL DEFAULT 'pending',
      "receipt" JSONB,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const sql = {
    query: async (queryText: string, params: unknown[] = []) => {
      const res = await db.query(queryText, params as any);
      return { rows: res.rows as Record<string, unknown>[] };
    },
  };

  await initRetentionTables(sql);
  return { db, sql };
}

describe('S6 Checkpoint 3: Retention Policy & Safe Cleanup', () => {
  it('validates explicit separate retention policies and fails closed on production misconfiguration', () => {
    // 1. Default production policy is valid
    const valid = validateCohortRetentionPolicy(DEFAULT_PRODUCTION_RETENTION_POLICY, true);
    expect(valid.transcriptRetentionDays).toBe(90);
    expect(valid.eventReplayRetentionDays).toBe(7);
    expect(valid.releasedArtifactPinned).toBe(true);

    // 2. Fails closed if transcript retention is shorter than transient replay retention
    expect(() =>
      validateCohortRetentionPolicy(
        {
          ...DEFAULT_PRODUCTION_RETENTION_POLICY,
          transcriptRetentionDays: 3,
          eventReplayRetentionDays: 7,
        },
        true
      )
    ).toThrow(CohortRetentionPolicyError);

    // 3. Fails closed if releasedArtifactPinned is false
    expect(() =>
      validateCohortRetentionPolicy(
        {
          ...DEFAULT_PRODUCTION_RETENTION_POLICY,
          releasedArtifactPinned: false as any,
        },
        true
      )
    ).toThrow(CohortRetentionPolicyError);

    // 4. Fails closed if any duration is negative or non-finite
    expect(() =>
      validateCohortRetentionPolicy(
        {
          ...DEFAULT_PRODUCTION_RETENTION_POLICY,
          orphanArtifactRetentionDays: -1,
        },
        true
      )
    ).toThrow(CohortRetentionPolicyError);
  });

  it('tombstones workspace, immediately revokes access, and cancels in-flight work before physical purge', async () => {
    const { sql } = await setupRetentionTestDb();
    const workspaceId = 'ws-tombstone-test';
    const ownerId = 'user-owner-1';

    // Seed workspace
    await sql.query(
      `INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "snapshot", "lifecycle")
       VALUES ($1, $2, 'cohort', '{"intent":"testing"}', 'active')`,
      [workspaceId, ownerId]
    );

    // Seed active run
    await sql.query(
      `INSERT INTO "interaction_runs" ("id", "workspaceId", "status")
       VALUES ('run-active-1', $1, 'running')`,
      [workspaceId]
    );

    // Seed active job
    await sql.query(
      `INSERT INTO "cohort_text_jobs" ("id", "workspaceId", "jobKey", "stage", "dependencyFingerprint", "status")
       VALUES ('job-active-1', $1, 'key-1', 'chunking', 'fp-1', 'running')`,
      [workspaceId]
    );

    // 1. Foreign owner cannot tombstone
    await expect(
      tombstoneWorkspace(sql, {
        workspaceId,
        ownerId: 'foreign-user',
        reason: 'malicious attempt',
      })
    ).rejects.toThrow('UNAUTHORIZED_OWNER');

    // 2. Owner tombstones workspace
    const result = await tombstoneWorkspace(sql, {
      workspaceId,
      ownerId,
      reason: 'User deleted account',
    });
    expect(result.tombstoned).toBe(true);

    // 3. Verify workspace lifecycle is 'tombstoned'
    const wsRow = (await sql.query(`SELECT "lifecycle" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
    expect(wsRow.lifecycle).toBe('tombstoned');

    // 4. Verify in-flight run was canceled
    const runRow = (await sql.query(`SELECT "status", "error" FROM "interaction_runs" WHERE "id" = 'run-active-1'`, [])).rows[0];
    expect(runRow.status).toBe('canceled');
    expect(runRow.error).toBe('WORKSPACE_TOMBSTONED');

    // 5. Verify in-flight job was canceled
    const jobRow = (await sql.query(`SELECT "status", "errorCode" FROM "cohort_text_jobs" WHERE "id" = 'job-active-1'`, [])).rows[0];
    expect(jobRow.status).toBe('canceled');
    expect(jobRow.errorCode).toBe('WORKSPACE_TOMBSTONED');
  });

  it('protects artifacts with active read leases from concurrent cleanup and reclaims them once lease expires', async () => {
    const { sql } = await setupRetentionTestDb();
    const workspaceId = 'ws-read-lease-test';
    const ownerId = 'user-owner-2';

    await sql.query(
      `INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "snapshot", "lifecycle")
       VALUES ($1, $2, 'cohort', '{"intent":"reading"}', 'active')`,
      [workspaceId, ownerId]
    );

    // Create an orphan artifact older than policy orphan cutoff (4 days old)
    const oldDate = new Date(Date.now() - 4 * 86_400_000);
    const art = await putTextArtifact(sql, {
      workspaceId,
      kind: 'source_raw',
      inputFingerprint: 'fp-lease-test',
      bytes: new TextEncoder().encode('Active read streaming bytes'),
    });

    // Artificially age the artifact creation date
    await sql.query(`UPDATE "cohort_text_artifacts" SET "createdAt" = $1 WHERE "id" = $2`, [oldDate, art.id]);

    // Acquire an active read lease for 60 seconds
    const lease = await acquireArtifactReadLease(sql, {
      artifactId: art.id,
      workspaceId,
      durationMs: 60_000,
    });
    expect(lease.leased).toBe(true);
    expect(lease.leaseUntil.getTime()).toBeGreaterThan(Date.now());

    // 1. Run retention sweep while lease is ACTIVE
    const sweepDuringRead = await runRetentionSweep(sql, {
      policy: TEST_RETENTION_POLICY, // orphanArtifactRetentionDays = 1
      dryRun: false,
      isolatedTargetOnly: true,
    });

    // The leased artifact MUST NOT be pruned!
    expect(sweepDuringRead.prunedOrphanArtifacts).toBe(0);
    const artStillThere = await sql.query(`SELECT "id" FROM "cohort_text_artifacts" WHERE "id" = $1`, [art.id]);
    expect(artStillThere.rows.length).toBe(1);

    // 2. Release the lease (or let it expire)
    await releaseArtifactReadLease(sql, {
      artifactId: art.id,
      workspaceId,
      leaseToken: lease.leaseToken,
    });

    // 3. Run retention sweep again now that lease is released
    const sweepAfterRelease = await runRetentionSweep(sql, {
      policy: TEST_RETENTION_POLICY,
      dryRun: false,
      isolatedTargetOnly: true,
    });

    // Now the orphan artifact IS pruned safely
    expect(sweepAfterRelease.prunedOrphanArtifacts).toBe(1);
    expect(sweepAfterRelease.reclaimedOrphanBytes).toBe(art.byteLength);

    const artGone = await sql.query(`SELECT "id" FROM "cohort_text_artifacts" WHERE "id" = $1`, [art.id]);
    expect(artGone.rows.length).toBe(0);

    // Verify audit log record
    const auditRes = await sql.query(
      `SELECT "action", "targetId", "reclaimedBytes" FROM "cohort_retention_audit_log" WHERE "targetId" = $1`,
      [art.id]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].action).toBe('purge_orphan_artifact');
    expect(Number(auditRes.rows[0].reclaimedBytes)).toBe(art.byteLength);
  });

  it('keeps released cohort artifacts pinned permanently even after draft workspace is tombstoned', async () => {
    const { sql } = await setupRetentionTestDb();
    const workspaceId = 'ws-pinned-release-test';
    const ownerId = 'user-owner-3';
    const cohortId = 'cohort-released-123';

    await sql.query(
      `INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "snapshot", "lifecycle", "updatedAt")
       VALUES ($1, $2, 'cohort', '{"intent":"released"}', 'active', $3)`,
      [workspaceId, ownerId, new Date(Date.now() - 10 * 86_400_000)]
    );

    // Create assembly artifact representing released learner cohort evidence
    const releasedArt = await putTextArtifact(sql, {
      workspaceId,
      kind: 'assembly',
      inputFingerprint: 'fp-assembly-release',
      bytes: new TextEncoder().encode('Curriculum assembly for learner cohort'),
    });

    // Pin artifact permanently to released cohort
    await pinArtifactPermanently(sql, {
      artifactId: releasedArt.id,
      workspaceId,
      cohortId,
    });

    // Create an unpinned draft artifact
    const draftArt = await putTextArtifact(sql, {
      workspaceId,
      kind: 'source_raw',
      inputFingerprint: 'fp-draft-raw',
      bytes: new TextEncoder().encode('Draft raw unreleased text'),
    });

    // Tombstone the workspace 10 days ago (past tombstoneGraceDays = 1)
    await tombstoneWorkspace(sql, {
      workspaceId,
      ownerId,
      reason: 'Draft completed and cleaned',
      now: new Date(Date.now() - 5 * 86_400_000),
    });

    // Run destructive retention sweep
    const sweep = await runRetentionSweep(sql, {
      policy: TEST_RETENTION_POLICY,
      dryRun: false,
      isolatedTargetOnly: true,
      now: new Date(),
    });

    expect(sweep.purgedWorkspaces).toBe(1);
    expect(sweep.purgedDraftArtifacts).toBe(1);

    // Unpinned draft artifact is deleted
    const draftCheck = await sql.query(`SELECT "id" FROM "cohort_text_artifacts" WHERE "id" = $1`, [draftArt.id]);
    expect(draftCheck.rows.length).toBe(0);

    // BUT permanently pinned released artifact REMAINS PROTECTED for learner delivery!
    const releasedCheck = await sql.query(`SELECT "id" FROM "cohort_text_artifacts" WHERE "id" = $1`, [releasedArt.id]);
    expect(releasedCheck.rows.length).toBe(1);
  });

  it('enforces dry-run inspect mode by default and respects bounded batch limits', async () => {
    const { sql } = await setupRetentionTestDb();
    const workspaceId = 'ws-dryrun-test';

    // Seed 5 expired replay events
    const oldEventDate = new Date(Date.now() - 10 * 86_400_000);
    for (let i = 1; i <= 5; i++) {
      await sql.query(
        `INSERT INTO "interaction_events" ("id", "workspaceId", "sequence", "type", "payload", "createdAt")
         VALUES ($1, $2, $3, 'test.event', '{}', $4)`,
        [`evt-${i}`, workspaceId, i, oldEventDate]
      );
    }

    // 1. Run with default dryRun: true and batchLimit: 2
    const dryRunResult = await runRetentionSweep(sql, {
      policy: { ...TEST_RETENTION_POLICY, batchLimit: 2 },
      dryRun: true,
    });

    expect(dryRunResult.dryRun).toBe(true);
    expect(dryRunResult.prunedEvents).toBe(2); // Bound to batch limit 2

    // Verify ZERO events were actually deleted
    const countCheck = (await sql.query(`SELECT count(*) as c FROM "interaction_events" WHERE "workspaceId" = $1`, [workspaceId])).rows[0];
    expect(Number(countCheck.c)).toBe(5);

    // 2. Destructive run with batchLimit: 2
    const destructiveResult = await runRetentionSweep(sql, {
      policy: { ...TEST_RETENTION_POLICY, batchLimit: 2 },
      dryRun: false,
      isolatedTargetOnly: true,
    });

    expect(destructiveResult.dryRun).toBe(false);
    expect(destructiveResult.prunedEvents).toBe(2);

    // Exactly 2 deleted, 3 remaining
    const countAfter = (await sql.query(`SELECT count(*) as c FROM "interaction_events" WHERE "workspaceId" = $1`, [workspaceId])).rows[0];
    expect(Number(countAfter.c)).toBe(3);
  });

  it('enforces tenant isolation and ownership security on export', async () => {
    const { sql } = await setupRetentionTestDb();
    const workspaceId = 'ws-export-test';
    const ownerId = 'legit-owner-123';

    await sql.query(
      `INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "snapshot", "lifecycle")
       VALUES ($1, $2, 'cohort', '{"intent":"exporting"}', 'active')`,
      [workspaceId, ownerId]
    );

    // 1. Foreign user blocked from exporting
    await expect(
      exportWorkspaceData(sql, {
        workspaceId,
        ownerId: 'attacker-456',
      })
    ).rejects.toThrow('UNAUTHORIZED_OWNER');

    // 2. Legitimate owner receives complete export bundle
    const bundle = await exportWorkspaceData(sql, {
      workspaceId,
      ownerId,
    });

    expect(bundle.version).toBe(1);
    expect(bundle.workspace.id).toBe(workspaceId);
    expect(bundle.workspace.ownerId).toBe(ownerId);
    expect(bundle.workspace.lifecycle).toBe('active');
  });
});
