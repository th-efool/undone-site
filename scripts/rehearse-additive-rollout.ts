/**
 * Rehearsal script for S6A additive schema rollout and safe rollback.
 * Runs on an isolated disposable PostgreSQL instance (never touches shared DB).
 * Validates baseline schema, ordered migration execution, v1 non-interference,
 * v2 durability/worker execution, worker lease recovery, and safe rollback semantics.
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Pool, type Client } from 'pg';
import { cohortWorkspaceSchema, planCohortAction } from '../src/shared/cohort-builder/contracts';
import { claimTextJob } from '../src/server/domain/cohort-builder/text-jobs';
import { putTextArtifact } from '../src/server/domain/cohort-builder/text-artifacts';
import { acceptCurrentTextJob } from '../src/server/domain/cohort-builder/text-job-acceptance';
import { runDurableTextJobTick } from '../src/server/domain/cohort-builder/durable-text-worker';
import { assertTextJobSchema } from '../src/server/domain/cohort-builder/text-schema-readiness';
import { assertSourceSchema } from '../src/server/domain/cohort-builder/source-policy';
import { assertReleaseSchema } from '../src/server/domain/cohort-builder/release-schema-readiness';
import { assertS6OperationalSchema } from '../src/server/domain/cohort-builder/operational-schema-readiness';
import { collectWorkerDiagnostics } from '../src/server/domain/cohort-builder/worker-diagnostics';
import {
  interactionSqlCheck,
  interactionConfigurationChecks,
  getConfigurationProfile,
} from './interaction-readiness';
import type { TextJobTransactionPort } from '../src/server/domain/cohort-builder/text-job-scheduler';

const root = process.cwd();
const port = Number(process.env.S6A_REHEARSAL_PORT ?? 15433);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
  throw new Error('INVALID_REHEARSAL_PORT');
}

const embeddedPostgresModule = resolve(
  process.env.S3_EMBEDDED_POSTGRES_MODULE ??
    '.tmp/s3-postgres-runtime/node_modules/embedded-postgres/dist/index.js'
);

async function main() {
  console.log('=== S6A Additive Rollout & Safe Rollback Local Rehearsal ===\n');

  // Phase 0: Initialize disposable PostgreSQL instance
  console.log(`[Phase 0] Initializing isolated disposable PostgreSQL on port ${port}...`);
  const tempDir = mkdtempSync(resolve(root, '.tmp/s6a-rehearsal-'));
  const { default: EmbeddedPostgres } = await import(pathToFileURL(embeddedPostgresModule).href);

  const database = new EmbeddedPostgres({
    databaseDir: resolve(tempDir, 'data'),
    user: 's3test',
    password: 's3-local-only',
    port,
    persistent: false,
    createPostgresUser: false,
    postgresFlags: ['-h', '127.0.0.1', '-c', 'timezone=UTC'],
    onLog: () => {},
    onError: console.error,
  });

  const connectionString = `postgresql://s3test:s3-local-only@127.0.0.1:${port}/s3test`;

  try {
    await database.initialise();
    await database.start();
    await database.createDatabase('s3test');
    console.log(`[Phase 0] PASS: Isolated database created at ${connectionString}\n`);

    const pool = new Pool({
      connectionString,
      max: 5,
      options: '-c timezone=UTC',
    });

    const client = await pool.connect();

    try {
      // Phase 1: Baseline Schema Preflight
      console.log('[Phase 1] Preflight on baseline schema (v1 production state)...');
      const diffProc = spawnSync(
        process.execPath,
        [
          'node_modules/prisma/build/index.js',
          'migrate',
          'diff',
          '--from-empty',
          '--to-schema',
          'prisma/schema.prisma',
          '--script',
        ],
        { cwd: root, encoding: 'utf8', env: { ...process.env, DATABASE_URL: connectionString }, windowsHide: true }
      );
      if (diffProc.status !== 0) throw new Error(diffProc.stderr);

      // Separate baseline statements from interaction statements
      const statements = diffProc.stdout
        .split(/;\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      const baselineStatements = statements.filter(
        (s) => !/interaction_|cohort_text_/i.test(s)
      );

      console.log(`[Phase 1] Executing ${baselineStatements.length} baseline schema statements...`);
      for (const statement of baselineStatements) {
        await client.query(statement);
      }

      // Verify baseline tables exist
      const baselineTables = [
        'users',
        'accounts',
        'sessions',
        'creation_drafts',
        'creation_jobs',
        'creation_events',
        'cohorts',
        'lessons',
      ];
      const tableCheck = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])",
        [baselineTables]
      );
      assert.equal(tableCheck.rows[0].count, baselineTables.length);

      // Insert representative v1 legacy data
      const legacyOwnerId = 'user-legacy-001';
      const legacyDraftId = 'draft-legacy-001';
      await client.query(
        `INSERT INTO users (id, email, "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP)`,
        [legacyOwnerId, 'legacy@example.test']
      );
      await client.query(
        `INSERT INTO creation_drafts (id, "ownerId", revision, "schemaVersion", snapshot, "updatedAt")
         VALUES ($1, $2, 1, 1, $3, CURRENT_TIMESTAMP)`,
        [
          legacyDraftId,
          legacyOwnerId,
          JSON.stringify({ title: 'Legacy Cohort Draft', intent: 'Legacy learning', audience: 'All', lessons: [] }),
        ]
      );
      await client.query(
        `INSERT INTO creation_jobs (id, "draftId", "ownerId", kind, "requestId", "inputRevision", "inputFingerprint", input, status, "updatedAt")
         VALUES ($1, $2, $3, $4, $5, 1, 'fp-001', '{}', 'completed', CURRENT_TIMESTAMP)`,
        ['job-legacy-001', legacyDraftId, legacyOwnerId, 'chunking', 'req-001']
      );

      const legacyDraftRes = await client.query(
        `SELECT id, "ownerId", snapshot->>'title' AS title FROM creation_drafts WHERE id = $1`,
        [legacyDraftId]
      );
      assert.equal(legacyDraftRes.rows[0]?.title, 'Legacy Cohort Draft');
      console.log('[Phase 1] PASS: Baseline schema preflight verified with active v1 creation data.\n');

      // Phase 2: Apply Migration 1 - packages/interaction-builder/migrations/001_interaction_schema.sql
      console.log('[Phase 2] Applying Migration 1: 001_interaction_schema.sql (8 core engine tables)...');
      const migration1 = readFileSync(
        resolve(root, 'packages/interaction-builder/migrations/001_interaction_schema.sql'),
        'utf8'
      );
      await client.query(migration1);

      const m1Tables = [
        'interaction_workspaces',
        'interaction_requests',
        'interaction_events',
        'interaction_outbox',
        'interaction_messages',
        'interaction_runs',
        'interaction_steps',
        'interaction_proposals',
      ];
      const m1Check = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])",
        [m1Tables]
      );
      assert.equal(m1Check.rows[0].count, m1Tables.length);

      const m1UniqueIdx = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM pg_indexes WHERE schemaname='public' AND tablename='interaction_runs' AND indexname='interaction_runs_active_unique_idx'"
      );
      assert.equal(m1UniqueIdx.rows[0].count, 1);
      console.log('[Phase 2] PASS: Migration 1 applied. 8 interaction tables and active unique index verified.\n');

      // Phase 3: Apply Migration 2 - prisma/interaction-s3-storage.sql
      console.log('[Phase 3] Applying Migration 2: interaction-s3-storage.sql (durable text storage)...');
      const migration2 = readFileSync(
        resolve(root, 'prisma/interaction-s3-storage.sql'),
        'utf8'
      );
      await client.query(migration2);

      const m2Tables = ['cohort_text_artifacts', 'cohort_text_jobs', 'cohort_text_job_edges'];
      const m2Check = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])",
        [m2Tables]
      );
      assert.equal(m2Check.rows[0].count, m2Tables.length);
      console.log('[Phase 3] PASS: Migration 2 applied. 3 durable text tables verified.\n');

      // Phase 4: Apply Migration 3 - prisma/interaction-s4b-sources.sql
      console.log('[Phase 4] Applying Migration 3: interaction-s4b-sources.sql (source constraint expansion)...');
      const migration3 = readFileSync(
        resolve(root, 'prisma/interaction-s4b-sources.sql'),
        'utf8'
      );
      await client.query(migration3);

      const sqlAdapter = { query: (q: string, p: unknown[]) => client.query(q, p) };
      await assertSourceSchema(sqlAdapter);
      console.log('[Phase 4] PASS: Migration 3 applied. S4B source constraints verified.\n');

      // Phase 5: Apply Migration 4 - prisma/interaction-s5-effects.sql
      console.log('[Phase 5] Applying Migration 4: interaction-s5-effects.sql (release effect journaling)...');
      const migration4 = readFileSync(
        resolve(root, 'prisma/interaction-s5-effects.sql'),
        'utf8'
      );
      await client.query(migration4);

      const m4Check = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name = 'interaction_effects'"
      );
      assert.equal(m4Check.rows[0].count, 1);
      await assertReleaseSchema(sqlAdapter);
      console.log('[Phase 5] PASS: Migration 4 applied. interaction_effects table and constraints verified.\n');

      // Phase 5b: Apply Migration 5 - prisma/interaction-s6-operations.sql
      console.log('[Phase 5b] Applying Migration 5: interaction-s6-operations.sql (S6 operations, supervision & governance)...');
      const migration5 = readFileSync(
        resolve(root, 'prisma/interaction-s6-operations.sql'),
        'utf8'
      );
      await client.query(migration5);

      const m5Tables = [
        'cohort_text_artifact_protection',
        'cohort_retention_audit_log',
        'interaction_worker_heartbeats',
        'cohort_admin_controls',
        'cohort_admin_control_audit',
      ];
      const m5Check = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])",
        [m5Tables]
      );
      assert.equal(m5Check.rows[0].count, m5Tables.length);
      await assertS6OperationalSchema(sqlAdapter);
      console.log('[Phase 5b] PASS: Migration 5 applied. 5 operational tables and indexes verified.\n');

      // Phase 6: Automated Schema & Readiness Validation
      console.log('[Phase 6] Validating comprehensive readiness via probe tools...');
      process.env.DATABASE_URL = connectionString;
      process.env.INTERACTION_TEXT_DRIVER = 'durable';
      process.env.INTERACTION_COHORT_V2_ENABLED = '1';

      await assertTextJobSchema(sqlAdapter);
      await assertSourceSchema(sqlAdapter);
      await assertReleaseSchema(sqlAdapter);
      await assertS6OperationalSchema(sqlAdapter);

      const sqlReadiness = await interactionSqlCheck();
      assert.equal(sqlReadiness.status, 'ready', `SQL readiness check must pass, got: ${sqlReadiness.status} (${sqlReadiness.reason})`);

      const configProfile = getConfigurationProfile(process.env);
      console.log(`[Phase 6] Configuration profile detected: ${configProfile}`);
      console.log('[Phase 6] PASS: Schema and readiness probe validated successfully.\n');

      // Phase 7: Verify v1 Backward Compatibility & Non-Interference
      console.log('[Phase 7] Verifying v1 backward compatibility and concurrent operation...');
      // 1. Existing v1 draft still readable
      const existingV1 = await client.query(
        `SELECT id, "ownerId", snapshot->>'title' AS title FROM creation_drafts WHERE id = $1`,
        [legacyDraftId]
      );
      assert.equal(existingV1.rows[0]?.title, 'Legacy Cohort Draft');

      // 2. Insert new v1 draft alongside v2 tables (no constraint interference)
      const newV1DraftId = 'draft-legacy-002';
      await client.query(
        `INSERT INTO creation_drafts (id, "ownerId", revision, "schemaVersion", snapshot, "updatedAt")
         VALUES ($1, $2, 1, 1, $3, CURRENT_TIMESTAMP)`,
        [
          newV1DraftId,
          legacyOwnerId,
          JSON.stringify({ title: 'Concurrent Legacy Draft', intent: 'Legacy v1 write', audience: 'All', lessons: [] }),
        ]
      );
      const newV1DraftRes = await client.query(
        `SELECT id, snapshot->>'title' AS title FROM creation_drafts WHERE id = $1`,
        [newV1DraftId]
      );
      assert.equal(newV1DraftRes.rows[0]?.title, 'Concurrent Legacy Draft');
      console.log('[Phase 7] PASS: v1 creation drafts read and written without interference.\n');

      // Phase 8: Verify v2 Intake, Durability, and Worker Execution
      console.log('[Phase 8] Verifying v2 intake, durability, and worker execution...');
      const { createPostgresInteractionRepository } = await import(
        '../src/server/infrastructure/db/postgres/repositories/interaction.repo'
      );
      const { prisma } = await import('../src/server/infrastructure/db/postgres/client');
      const repo = createPostgresInteractionRepository(prisma);

      const portPort: TextJobTransactionPort = {
        transaction: async (work) => {
          const txClient = await pool.connect();
          try {
            await txClient.query('BEGIN');
            const result = await work({ query: (s, p) => txClient.query(s, p) });
            await txClient.query('COMMIT');
            return result;
          } catch (error) {
            await txClient.query('ROLLBACK');
            throw error;
          } finally {
            txClient.release();
          }
        },
      };

      const v2OwnerId = crypto.randomUUID();
      const v2WorkspaceId = crypto.randomUUID();
      await client.query(
        `INSERT INTO users (id, email, "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP)`,
        [v2OwnerId, 'v2creator@example.test']
      );

      const initialSnapshot = cohortWorkspaceSchema.parse({
        schemaVersion: 1,
        title: 'Rehearsal Cohort',
        intent: 'Test additive rollout',
        audience: 'Operators',
        dailyMinutes: 15,
        lessons: [],
      });

      await repo.createWorkspace({
        id: v2WorkspaceId,
        ownerId: v2OwnerId,
        domainId: 'cohort',
        domainVersion: 1,
        initialSnapshot,
      });

      // Add a text source action
      const actionEnvelope = {
        actionId: crypto.randomUUID(),
        workspaceId: v2WorkspaceId,
        expectedRevision: 0,
        entityVersions: [],
        action: {
          type: 'add_text_source' as const,
          sourceId: 'src-1',
          label: 'Rollout Notes',
          text: 'Additive schema is safe and non-destructive.',
        },
      };

      await repo.commitAction({
        ownerId: v2OwnerId,
        workspaceId: v2WorkspaceId,
        expectedRevision: 0,
        requestId: 'req-rehearsal-001',
        envelope: actionEnvelope,
        plan: planCohortAction,
      });

      // Execute worker ticks to advance stages
      let tickTime = new Date();
      for (let i = 0; i < 5; i++) {
        const tickResult = await runDurableTextJobTick({
          sql: { query: (s: string, p: unknown[]) => client.query(s, p) },
          transaction: portPort,
          workerId: 'rehearsal-worker',
          leaseMs: 60_000,
          now: () => tickTime,
          loadWorkspace: async () => (await repo.loadWorkspace({ ownerId: v2OwnerId, workspaceId: v2WorkspaceId }))!.snapshot,
        });
        if (tickResult.status === 'idle') break;
        assert.equal(tickResult.status, 'accepted');
        tickTime = new Date(tickTime.getTime() + 1_000);
      }

      const postWorkWorkspace = await repo.loadWorkspace({ ownerId: v2OwnerId, workspaceId: v2WorkspaceId });
      assert(postWorkWorkspace, 'Workspace must exist');
      const postSnapshot = cohortWorkspaceSchema.parse(postWorkWorkspace.snapshot);
      assert.equal(postSnapshot.sources.length, 1);
      assert.equal(postSnapshot.processing.status, 'ready');

      // Check operational diagnostics
      const diag = await collectWorkerDiagnostics({ query: (s: string, p: unknown[] = []) => client.query(s, p) });
      assert.equal(diag.backlog.jobs.failed, 0);
      assert.equal(diag.leaseRecovery.expiredRunningJobs, 0);
      console.log(`[Phase 8] Operational diagnostics: totalJobs=${diag.backlog.jobs.total}, failedJobs=${diag.backlog.jobs.failed}`);
      console.log('[Phase 8] PASS: v2 intake, durability, worker ticks, and diagnostics verified.\n');

      // Phase 9: Rehearse Worker Lease Expiry and Replacement Recovery
      console.log('[Phase 9] Rehearsing worker lease expiry, stale commit fence, and replacement recovery...');
      const leaseActionEnvelope = {
        actionId: crypto.randomUUID(),
        workspaceId: v2WorkspaceId,
        expectedRevision: postWorkWorkspace.revision,
        entityVersions: [],
        action: {
          type: 'add_text_source' as const,
          sourceId: 'src-2',
          label: 'Lease Notes',
          text: 'Fencing prevents split-brain commits after worker leases expire.',
        },
      };

      await repo.commitAction({
        ownerId: v2OwnerId,
        workspaceId: v2WorkspaceId,
        expectedRevision: postWorkWorkspace.revision,
        requestId: 'req-rehearsal-lease-001',
        envelope: leaseActionEnvelope,
        plan: planCohortAction,
      });

      // Worker 1 claims job with short 1,000ms lease
      const claimNow = new Date();
      const claimed = (await claimTextJob(
        { query: (s: string, p: unknown[]) => client.query(s, p) },
        'crashed-worker',
        claimNow,
        1_000
      ))!;
      assert(claimed, 'Job must be claimable');
      assert.equal(claimed.sourceId, 'src-2');

      // Simulate Worker 1 crashing: clock advances past lease
      const expiredNow = new Date(claimNow.getTime() + 1_500);

      // Replacement Worker 2 claims expired job and increments fence
      const replacementClaim = (await claimTextJob(
        { query: (s: string, p: unknown[]) => client.query(s, p) },
        'replacement-worker',
        expiredNow,
        60_000
      ))!;
      assert(replacementClaim, 'Replacement worker must recover expired job');
      assert.equal(replacementClaim.id, claimed.id);
      assert.equal(replacementClaim.fence, claimed.fence + 1);

      // Artifact created with matching source input
      const artifact = await putTextArtifact(
        { query: (s: string, p: unknown[]) => client.query(s, p) },
        {
          workspaceId: v2WorkspaceId,
          sourceId: 'src-2',
          sourceVersion: 0,
          kind: 'source_raw',
          inputFingerprint: claimed.dependencyFingerprint,
          bytes: Buffer.from('Fencing prevents split-brain commits after worker leases expire.'),
        }
      );

      // Stale Worker 1 attempts to commit after replacement took over: REJECTED
      const staleAccepted = await acceptCurrentTextJob(portPort, claimed, artifact, expiredNow);
      assert.equal(staleAccepted, false, 'Stale worker commit must be rejected after lease expiry and fence advance');

      // Replacement Worker 2 commits: ACCEPTED
      const replacementAccepted = await acceptCurrentTextJob(portPort, replacementClaim, artifact, expiredNow);
      assert.equal(replacementAccepted, true, 'Replacement worker commit must succeed');
      console.log('[Phase 9] PASS: Stale lease rejected; replacement worker successfully recovered job.\n');

      // Phase 10: Rehearse Safe Rollback / Disable Semantics
      console.log('[Phase 10] Rehearsing safe rollback / disable semantics...');
      // Operator sets INTERACTION_COHORT_V2_ENABLED='0'
      process.env.INTERACTION_COHORT_V2_ENABLED = '0';

      const rollbackProfile = getConfigurationProfile(process.env);
      assert.equal(rollbackProfile, 'disabled_intake');

      const simulatedProdEnv: NodeJS.ProcessEnv = {
        DATABASE_URL: connectionString,
        INTERACTION_TEXT_DRIVER: 'durable',
        INTERACTION_COHORT_V2_ENABLED: '0',
        NODE_ENV: 'production',
      };
      const prodRollbackProfile = getConfigurationProfile(simulatedProdEnv);
      assert.equal(prodRollbackProfile, 'disabled_intake', 'Production rollback profile must be disabled_intake');

      const rollbackChecks = interactionConfigurationChecks(simulatedProdEnv);
      const v2Check = rollbackChecks.find((c) => c.name.includes('V2 Landing Intake'));
      assert(v2Check);
      assert.equal(v2Check.status, 'disabled');
      assert.equal(v2Check.reason, undefined);

      // Verify that previously accepted v2 workspaces remain 100% intact, readable, and queryable
      const persistedWorkspace = await repo.loadWorkspace({ ownerId: v2OwnerId, workspaceId: v2WorkspaceId });
      assert(persistedWorkspace, 'Accepted v2 workspace must still exist after rollback');
      assert.equal(persistedWorkspace.revision, 8);
      const persistedSnapshot = cohortWorkspaceSchema.parse(persistedWorkspace.snapshot);
      assert.equal(persistedSnapshot.sources[0]?.text, 'Additive schema is safe and non-destructive.');
      assert.equal(persistedSnapshot.sources[1]?.text, 'Fencing prevents split-brain commits after worker leases expire.');

      // Verify zero tables dropped
      const finalTableCheck = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])",
        [[...m1Tables, ...m2Tables, 'interaction_effects', ...m5Tables]]
      );
      assert.equal(
        finalTableCheck.rows[0].count,
        m1Tables.length + m2Tables.length + 1 + m5Tables.length,
        'All 17 additive tables must remain present; rollback does not destroy schema or data'
      );
      console.log('[Phase 10] PASS: Safe rollback preserves all data; new intake disabled while existing workspaces stay intact.\n');

      console.log('===========================================================');
      console.log('✅ ALL S6 ADDITIVE ROLLOUT & ROLLBACK PHASES PASSED CLEANLY');
      console.log('===========================================================');
    } finally {
      client.release();
      await pool.end();
    }
  } finally {
    console.log('\n[Teardown] Stopping embedded PostgreSQL instance...');
    await database.stop().catch(() => {});
    rmSync(tempDir, { recursive: true, force: true });
    console.log('[Teardown] Cleaned up temporary database directory.');
  }
}

main().catch((error) => {
  console.error('\n❌ Rehearsal failed:', error);
  process.exit(1);
});
