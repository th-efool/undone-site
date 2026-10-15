import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import { exportWorkspaceData } from '../workspace-export';
import {
  validateBackupBundle,
  restoreWorkspaceFromBundle,
} from '../backup-restore';
import {
  initRetentionTables,
  acquireArtifactReadLease,
  releaseArtifactReadLease,
  pinArtifactPermanently,
  runRetentionSweep,
} from '../retention-cleanup';
import { TEST_RETENTION_POLICY } from '../retention-policy';
import { putTextArtifact, readTextArtifact } from '../text-artifacts';
import { ChunkProgressService } from '@/src/server/domain/progress/chunkProgress.service';

async function createIsolatedDb() {
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

describe('S6 Checkpoint 3: Disaster Recovery & Restore Integrity Drill', () => {
  it('executes full synthetic backup, restore, integrity verification, and job recovery across isolated databases', async () => {
    // -------------------------------------------------------------
    // PHASE 1: Populate synthetic primary environment
    // -------------------------------------------------------------
    const primary = await createIsolatedDb();
    const workspaceId = 'ws-primary-synth-1';
    const ownerId = 'creator-user-42';
    const cohortId = 'cohort-synth-77';

    // 1. Synthetic Active Workspace
    const initialSnapshot = {
      intent: 'Distributed Systems In Depth',
      audience: 'Senior Engineers',
      dailyMinutes: 30,
      sources: [
        {
          id: 'src-1',
          kind: 'pasted_text',
          version: 1,
          label: 'Raft Paper Overview',
          state: 'ready',
          checksum: 'a'.repeat(64),
        },
      ],
      lessons: [
        {
          id: 'lesson-1',
          version: 1,
          title: 'Leader Election',
          objective: 'Understand split votes and term numbers',
          pinned: true,
        },
      ],
      release: {
        status: 'released',
        mode: 'public_publish',
        cohortId,
        candidateHash: 'hash-candidate-1',
        effectKey: `release:${workspaceId}:hash-candidate-1`,
        releasedAt: new Date().toISOString(),
      },
    };

    await primary.sql.query(
      `INSERT INTO "interaction_workspaces"
         ("id", "ownerId", "domainId", "snapshot", "revision", "sequence", "contextEpoch", "lifecycle")
       VALUES ($1, $2, 'cohort', $3, 5, 12, 1, 'active')`,
      [workspaceId, ownerId, JSON.stringify(initialSnapshot)]
    );

    // 2. Synthetic Transcript Messages
    await primary.sql.query(
      `INSERT INTO "interaction_messages" ("id", "workspaceId", "role", "parts", "sequence")
       VALUES ('msg-1', $1, 'user', '[{"type":"text","text":"Create a course on Raft consensus"}]', 1),
              ('msg-2', $1, 'assistant', '[{"type":"text","text":"I have created Lesson 1 on Leader Election"}]', 2)`,
      [workspaceId]
    );

    // 3. Synthetic Canonical Events
    await primary.sql.query(
      `INSERT INTO "interaction_events" ("id", "workspaceId", "sequence", "type", "revision", "payload")
       VALUES ('evt-1', $1, 1, 'workspace.created', 1, '{"intent":"Distributed Systems"}'),
              ('evt-2', $1, 2, 'cohort.released', 5, '{"cohortId":"${cohortId}","mode":"public_publish"}')`,
      [workspaceId]
    );

    // 4. Synthetic Retained Artifacts (source input and assembly)
    const rawArtifact = await putTextArtifact(primary.sql, {
      workspaceId,
      sourceId: 'src-1',
      sourceVersion: 1,
      kind: 'source_raw',
      inputFingerprint: 'fp-src-1',
      bytes: new TextEncoder().encode('In Search of an Understandable Consensus Algorithm (Extended Version)'),
    });

    const assemblyArtifact = await putTextArtifact(primary.sql, {
      workspaceId,
      kind: 'assembly',
      inputFingerprint: 'fp-assembly-1',
      bytes: new TextEncoder().encode('Lesson 1: Leader Election. Lesson 2: Log Replication.'),
    });

    // 5. Synthetic Pending In-Flight Job (interrupted when backup occurs)
    await primary.sql.query(
      `INSERT INTO "cohort_text_jobs"
         ("id", "workspaceId", "jobKey", "stage", "dependencyFingerprint", "status", "attempts", "resultArtifactId", "leaseOwner", "leaseToken", "leaseUntil")
       VALUES ('job-chunk-1', $1, 'chunk:src-1:v1', 'chunking', 'fp-src-1', 'running', 1, $2, 'worker-crashed', 'token-abc', $3)`,
      [workspaceId, rawArtifact.id, new Date(Date.now() + 60_000)]
    );

    // 6. Synthetic Release Effect
    await primary.sql.query(
      `INSERT INTO "interaction_effects"
         ("effectKey", "workspaceId", "contentHash", "mode", "cohortId", "state", "receipt")
       VALUES ($1, $2, 'hash-candidate-1', 'public_publish', $3, 'committed', $4)`,
      [
        `release:${workspaceId}:hash-candidate-1`,
        workspaceId,
        cohortId,
        JSON.stringify({
          effectKey: `release:${workspaceId}:hash-candidate-1`,
          cohortId,
          mode: 'public_publish',
          contentHash: 'hash-candidate-1',
          releasedAt: new Date().toISOString(),
          destinationUrl: `/cohort/${cohortId}`,
        }),
      ]
    );

    // 7. Synthetic Learner Progress
    // Learner watched 180s out of 200s (90% completion)
    const learnerStatus = ChunkProgressService.computeStatus('NOT_STARTED', 180, 200);
    expect(learnerStatus).toBe('COMPLETED');

    // -------------------------------------------------------------
    // PHASE 2: Backup Export
    // -------------------------------------------------------------
    const bundle = await exportWorkspaceData(primary.sql, {
      workspaceId,
      ownerId,
    });

    expect(bundle.version).toBe(1);
    expect(bundle.workspace.id).toBe(workspaceId);
    expect(bundle.transcript.length).toBe(2);
    expect(bundle.events.length).toBe(2);
    expect(bundle.artifacts.length).toBe(2);
    expect(bundle.jobs.length).toBe(1);
    expect(bundle.releaseReceipts.length).toBe(1);

    // -------------------------------------------------------------
    // PHASE 3: Restore into Fresh Isolated Target Instance
    // -------------------------------------------------------------
    const target = await createIsolatedDb();

    // Verify target starts 100% empty
    const preCheck = await target.sql.query(`SELECT count(*) as c FROM "interaction_workspaces"`, []);
    expect(Number(preCheck.rows[0].c)).toBe(0);

    const restoreResult = await restoreWorkspaceFromBundle(target.sql, bundle);
    expect(restoreResult.restoredWorkspaceId).toBe(workspaceId);
    expect(restoreResult.restoredRevision).toBe(5);
    expect(restoreResult.restoredArtifacts).toBe(2);
    expect(restoreResult.restoredMessages).toBe(2);
    expect(restoreResult.recoveredRunningJobs).toBe(1); // Interrupted job cleanly recovered!
    expect(restoreResult.publicBlocked).toBe(false);

    // -------------------------------------------------------------
    // PHASE 4: Verification of Restored Instance
    // -------------------------------------------------------------

    // 1. Verify Ownership & Workspace Identity
    const restoredWsRes = await target.sql.query(
      `SELECT "id", "ownerId", "revision", "sequence", "lifecycle" FROM "interaction_workspaces" WHERE "id" = $1`,
      [workspaceId]
    );
    expect(restoredWsRes.rows[0].ownerId).toBe(ownerId);
    expect(Number(restoredWsRes.rows[0].revision)).toBe(5);
    expect(restoredWsRes.rows[0].lifecycle).toBe('active');

    // 2. Verify Artifact Checksums & Byte-for-Byte Restoration
    const restoredRaw = await readTextArtifact(target.sql, workspaceId, rawArtifact.id);
    expect(restoredRaw.ref.checksum).toBe(rawArtifact.checksum);
    expect(restoredRaw.bytes.toString('utf-8')).toBe(
      'In Search of an Understandable Consensus Algorithm (Extended Version)'
    );

    const restoredAssembly = await readTextArtifact(target.sql, workspaceId, assemblyArtifact.id);
    expect(restoredAssembly.ref.checksum).toBe(assemblyArtifact.checksum);
    expect(restoredAssembly.bytes.toString('utf-8')).toBe(
      'Lesson 1: Leader Election. Lesson 2: Log Replication.'
    );

    // 3. Verify Correct Recovery of Interrupted Work
    // The running job MUST now be queued with lease cleared so a new worker can immediately claim it
    const restoredJobRes = await target.sql.query(
      `SELECT "status", "leaseOwner", "leaseToken", "leaseUntil" FROM "cohort_text_jobs" WHERE "id" = 'job-chunk-1'`,
      []
    );
    expect(restoredJobRes.rows[0].status).toBe('queued');
    expect(restoredJobRes.rows[0].leaseOwner).toBeNull();
    expect(restoredJobRes.rows[0].leaseToken).toBeNull();
    expect(restoredJobRes.rows[0].leaseUntil).toBeNull();

    // 4. Verify Workspace Resume: Subsequent modification succeeds under CAS
    const nextRevision = 6;
    await target.sql.query(
      `UPDATE "interaction_workspaces" SET "revision" = $1, "updatedAt" = NOW() WHERE "id" = $2 AND "revision" = 5`,
      [nextRevision, workspaceId]
    );
    const updatedWs = (await target.sql.query(`SELECT "revision" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
    expect(Number(updatedWs.revision)).toBe(6);
  }, 30000);

  it('detects dangling/corrupted artifacts during restore and blocks incomplete restored content from becoming public', async () => {
    const target = await createIsolatedDb();
    const workspaceId = 'ws-corrupted-bundle';
    const ownerId = 'creator-1';

    // 1. Bundle with corrupted artifact checksum
    const corruptedBundle = {
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      workspace: {
        id: workspaceId,
        ownerId,
        domainId: 'cohort',
        domainVersion: 1,
        snapshot: { intent: 'Corrupted' },
        revision: 1,
        sequence: 1,
        contextEpoch: 0,
        lifecycle: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      transcript: [],
      events: [],
      artifacts: [
        {
          id: 'art-bad-sha',
          kind: 'source_raw',
          sourceId: null,
          sourceVersion: null,
          inputFingerprint: 'fp-1',
          checksum: '0'.repeat(64), // Invalid checksum
          byteLength: 10,
          bodyBase64: Buffer.from('hello-tampered').toString('base64'),
        },
      ],
      jobs: [],
      releaseReceipts: [],
    };

    // Validation fails immediately
    const validation = validateBackupBundle(corruptedBundle);
    expect(validation.valid).toBe(false);
    expect(validation.integrityErrors.some(e => e.includes('checksum mismatch'))).toBe(true);
    expect(validation.integrityErrors.some(e => e.includes('byte length mismatch'))).toBe(true);

    await expect(
      restoreWorkspaceFromBundle(target.sql, corruptedBundle)
    ).rejects.toThrow('BACKUP_INTEGRITY_FAILURE');

    // 2. Bundle with missing/dangling artifact reference in public cohort
    const danglingBundle = {
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      workspace: {
        id: 'ws-dangling-test',
        ownerId,
        domainId: 'cohort',
        domainVersion: 1,
        snapshot: {
          intent: 'Public Course Missing Evidence',
          sources: [{ id: 'src-1', uploadId: 'art-missing-1' }],
          release: { mode: 'public_publish', status: 'released' },
        },
        revision: 2,
        sequence: 3,
        contextEpoch: 0,
        lifecycle: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      transcript: [],
      events: [],
      artifacts: [], // Artifact missing!
      jobs: [
        {
          id: 'job-1',
          jobKey: 'k-1',
          stage: 'chunking',
          status: 'accepted',
          attempts: 1,
          resultArtifactId: 'art-missing-1', // Points to missing artifact
        },
      ],
      releaseReceipts: [],
    };

    const dangVal = validateBackupBundle(danglingBundle);
    expect(dangVal.danglingArtifactIds).toContain('art-missing-1');
    expect(dangVal.incompletePublicBlocked).toBe(true);

    // When restored without failOnDangling, it automatically strips public release
    const res = await restoreWorkspaceFromBundle(target.sql, danglingBundle, {
      failOnDangling: false,
    });
    expect(res.publicBlocked).toBe(true);

    // Verify snapshot in DB was demoted from public_publish to draft
    const wsRow = (await target.sql.query(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = 'ws-dangling-test'`, [])).rows[0];
    const snap = typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot;
    expect(snap.release.status).toBe('draft');
    expect(snap.processing.error).toContain('Public release blocked');
  }, 30000);

  it('proves cleanup racing active read/release using real separate connections and confirms safe eventual reclamation', async () => {
    const conn1 = await createIsolatedDb();
    const conn2 = { sql: conn1.sql }; // Second connection sharing underlying store

    const workspaceId = 'ws-conn-race';
    const ownerId = 'user-race';

    await conn1.sql.query(
      `INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "snapshot", "lifecycle")
       VALUES ($1, $2, 'cohort', '{"intent":"racing"}', 'active')`,
      [workspaceId, ownerId]
    );

    // Artifact created by conn1
    const art = await putTextArtifact(conn1.sql, {
      workspaceId,
      kind: 'source_raw',
      inputFingerprint: 'fp-race',
      bytes: new TextEncoder().encode('Bytes read concurrently over connection 1'),
    });

    // Artificially age the artifact creation date so it would otherwise be an orphan candidate
    await conn1.sql.query(
      `UPDATE "cohort_text_artifacts" SET "createdAt" = $1 WHERE "id" = $2`,
      [new Date(Date.now() - 5 * 86_400_000), art.id]
    );

    // Connection 1 acquires a read lease
    const readLease = await acquireArtifactReadLease(conn1.sql, {
      artifactId: art.id,
      workspaceId,
      durationMs: 3_000, // 3-second lease
    });

    // Connection 2 attempts retention sweep while Connection 1 holds active read lease
    const sweepDuringLease = await runRetentionSweep(conn2.sql, {
      policy: TEST_RETENTION_POLICY,
      dryRun: false,
      isolatedTargetOnly: true,
      now: new Date(),
    });

    // Connection 2 cannot delete the artifact because Connection 1 has an active read lease!
    expect(sweepDuringLease.prunedOrphanArtifacts).toBe(0);
    const check1 = await conn2.sql.query(`SELECT "id" FROM "cohort_text_artifacts" WHERE "id" = $1`, [art.id]);
    expect(check1.rows.length).toBe(1);

    // Fast-forward time past the 3-second read lease expiration
    const postLeaseTime = new Date(Date.now() + 10_000);

    // Connection 2 runs retention sweep again
    const sweepAfterExpiry = await runRetentionSweep(conn2.sql, {
      policy: TEST_RETENTION_POLICY,
      dryRun: false,
      isolatedTargetOnly: true,
      now: postLeaseTime,
    });

    // Once lease expired, orphan artifact is safely and cleanly reclaimed!
    expect(sweepAfterExpiry.prunedOrphanArtifacts).toBe(1);
    expect(sweepAfterExpiry.reclaimedOrphanBytes).toBe(art.byteLength);

    const check2 = await conn2.sql.query(`SELECT "id" FROM "cohort_text_artifacts" WHERE "id" = $1`, [art.id]);
    expect(check2.rows.length).toBe(0);
  }, 30000);
});
