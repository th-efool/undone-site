import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { cohortWorkspaceSchema, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactSql } from '../text-artifacts';
import { claimTextJob } from '../text-jobs';
import { enqueueTextJobPlanInTransaction } from '../text-job-scheduler';
import { planJourneyJobs } from '../journey-job-plan';
import { enqueueJourneyJobPlan, enqueueJourneyJobPlanInTransaction } from '../journey-job-scheduler';
import {
  acceptJourneyJob,
  executeDiscoveryJob,
  executeRecommendationJob,
  failJourneyJob,
  retainJourneyArtifact,
} from '../journey-job-handlers';

const s3Migration = readFileSync(new URL('../../../../../prisma/sql/interaction/interaction-s3-storage.sql', import.meta.url), 'utf8');
const journeyMigration = readFileSync(new URL('../../../../../prisma/sql/interaction/interaction-journey-stages.sql', import.meta.url), 'utf8');

const now = new Date('2030-01-01T12:00:00.000Z');

function createInitialWorkspace(overrides: Partial<CohortWorkspace> = {}): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems',
    intent: 'Learn consensus and replication',
    audience: 'Senior Software Engineers',
    dailyMinutes: 30,
    lessons: [],
    sources: [],
    chunks: [],
    understanding: [],
    analyses: [],
    journey: {
      version: 1,
      step: 'recommendations',
      branch: null,
      processingStarted: false,
      intentVersion: 0,
    },
    ...overrides,
  });
}

async function setupDb() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE "interaction_workspaces" (
      "id" TEXT PRIMARY KEY,
      "snapshot" JSONB NOT NULL,
      "lifecycle" TEXT DEFAULT 'active',
      "domainId" TEXT DEFAULT 'cohort',
      "revision" INTEGER NOT NULL DEFAULT 0,
      "sequence" INTEGER NOT NULL DEFAULT 0,
      "contextEpoch" INTEGER NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "interaction_events" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "sequence" INTEGER NOT NULL,
      "protocolVersion" INTEGER NOT NULL DEFAULT 1,
      "type" TEXT NOT NULL,
      "revision" INTEGER,
      "payload" JSONB NOT NULL,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await db.exec(s3Migration);
  await db.exec(journeyMigration);

  const sql: TextArtifactSql = {
    query: async (statement, parameters) => db.query<Record<string, unknown>>(statement, parameters),
  };

  const port = {
    transaction: <T>(work: (tx: TextArtifactSql) => Promise<T>) =>
      db.transaction(tx => work({ query: async (stmt, params) => tx.query<Record<string, unknown>>(stmt, params) })),
  };

  return { db, sql, port };
}

describe('journey durable job scheduling and reconciliation', () => {
  it('plans and enqueues recommendations job for initial journey state', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = '11111111-1111-4111-8111-111111111111';
      const state = createInitialWorkspace();
      await db.query(`INSERT INTO "interaction_workspaces" ("id", "snapshot") VALUES ($1, $2::jsonb)`, [workspaceId, JSON.stringify(state)]);

      const intents = planJourneyJobs(state);
      expect(intents).toHaveLength(1);
      expect(intents[0]).toMatchObject({
        jobKey: 'journey:recommendations:0',
        stage: 'recommendations',
        handlerVersion: 1,
      });
      expect(intents[0].dependencyFingerprint).toHaveLength(64);

      await enqueueJourneyJobPlan(port, workspaceId, state);

      const rows = (await sql.query(
        `SELECT "id", "workspaceId", "jobKey", "sourceId", "sourceVersion", "stage", "status", "fence", "attempts", "handlerVersion"
         FROM "cohort_text_jobs" WHERE "workspaceId" = $1`,
        [workspaceId]
      )).rows;

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        workspaceId,
        jobKey: 'journey:recommendations:0',
        stage: 'recommendations',
        sourceId: null,
        sourceVersion: null,
        status: 'queued',
        fence: 0,
        attempts: 0,
        handlerVersion: 1,
      });

      // Repeat enqueue is idempotent and preserves the job
      await enqueueJourneyJobPlan(port, workspaceId, state);
      const rowsAfterRepeat = (await sql.query(
        `SELECT "id", "status", "fence" FROM "cohort_text_jobs" WHERE "workspaceId" = $1`,
        [workspaceId]
      )).rows;
      expect(rowsAfterRepeat).toHaveLength(1);
      expect(rowsAfterRepeat[0].id).toBe(rows[0].id);
      expect(rowsAfterRepeat[0].fence).toBe(0);
      expect(rowsAfterRepeat[0].status).toBe('queued');
    } finally {
      await db.close();
    }
  });

  it('preserves separate namespaces: journey reconciliation does not touch text:* jobs and text reconciliation does not touch journey:* jobs', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = '22222222-2222-4222-8222-222222222222';
      const state = createInitialWorkspace({
        sources: [
          { id: 'source-1', version: 0, label: 'Paper', text: 'Paxos made simple.', checksum: null, state: 'queued' },
        ],
        journey: {
          version: 1,
          step: 'recommendations',
          branch: null,
          processingStarted: true,
          intentVersion: 0,
        },
      });

      await db.query(`INSERT INTO "interaction_workspaces" ("id", "snapshot") VALUES ($1, $2::jsonb)`, [workspaceId, JSON.stringify(state)]);

      // Enqueue both text DAG and journey jobs
      await port.transaction(tx => enqueueTextJobPlanInTransaction(tx, workspaceId, state));
      await enqueueJourneyJobPlan(port, workspaceId, state);

      const initialTextJobs = (await sql.query(
        `SELECT "id", "jobKey", "status", "fence" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" LIKE 'text:%'`,
        [workspaceId]
      )).rows;
      expect(initialTextJobs.length).toBeGreaterThan(0);

      const initialJourneyJobs = (await sql.query(
        `SELECT "id", "jobKey", "status", "fence" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" LIKE 'journey:%'`,
        [workspaceId]
      )).rows;
      expect(initialJourneyJobs).toHaveLength(1);
      expect(initialJourneyJobs[0].jobKey).toBe('journey:recommendations:0');

      // 1. Modify text sources and run text reconciliation
      const editedSourcesState = structuredClone(state);
      editedSourcesState.sources[0].version = 1;
      editedSourcesState.sources[0].text = 'Raft consensus algorithm.';

      await port.transaction(tx => enqueueTextJobPlanInTransaction(tx, workspaceId, editedSourcesState));

      // Check that journey jobs were NOT modified or superseded by text reconciliation
      const journeyJobsAfterTextReconciliation = (await sql.query(
        `SELECT "id", "jobKey", "status", "fence" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" LIKE 'journey:%'`,
        [workspaceId]
      )).rows;
      expect(journeyJobsAfterTextReconciliation).toHaveLength(1);
      expect(journeyJobsAfterTextReconciliation[0]).toMatchObject({
        id: initialJourneyJobs[0].id,
        status: 'queued',
        fence: 0,
      });

      const textJobsBeforeJourneyReconciliation = (await sql.query(
        `SELECT "id", "jobKey", "status", "fence" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" LIKE 'text:%' ORDER BY "id"`,
        [workspaceId]
      )).rows;

      // 2. Modify intent/journey and run journey reconciliation
      const editedJourneyState = structuredClone(state);
      editedJourneyState.intent = 'Learn Raft in Depth';
      editedJourneyState.journey!.intentVersion = 1;

      await enqueueJourneyJobPlan(port, workspaceId, editedJourneyState);

      // Check that text jobs were NOT touched by journey reconciliation
      const textJobsAfterJourneyReconciliation = (await sql.query(
        `SELECT "id", "jobKey", "status", "fence" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" LIKE 'text:%' ORDER BY "id"`,
        [workspaceId]
      )).rows;

      // Text jobs count, IDs, statuses and fences must be completely identical
      expect(textJobsAfterJourneyReconciliation).toEqual(textJobsBeforeJourneyReconciliation);
    } finally {
      await db.close();
    }
  });

  it('supersedes previous intent journey recommendations job on intent change', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = '33333333-3333-4333-8333-333333333333';
      const state0 = createInitialWorkspace({
        intent: 'Learn Paxos',
        journey: {
          version: 1,
          step: 'recommendations',
          branch: null,
          processingStarted: false,
          intentVersion: 0,
        },
      });

      await db.query(`INSERT INTO "interaction_workspaces" ("id", "snapshot") VALUES ($1, $2::jsonb)`, [workspaceId, JSON.stringify(state0)]);
      await enqueueJourneyJobPlan(port, workspaceId, state0);

      const job0 = (await sql.query(
        `SELECT "id", "jobKey", "status", "fence" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" = 'journey:recommendations:0'`,
        [workspaceId]
      )).rows[0];
      expect(job0).toMatchObject({ status: 'queued', fence: 0 });

      // User edits intent, bumping intentVersion to 1
      const state1 = structuredClone(state0);
      state1.intent = 'Learn Raft';
      state1.journey!.intentVersion = 1;
      await db.query(`UPDATE "interaction_workspaces" SET "snapshot" = $1::jsonb WHERE "id" = $2`, [JSON.stringify(state1), workspaceId]);

      await enqueueJourneyJobPlan(port, workspaceId, state1);

      // Previous job must be superseded with fence bump
      const job0After = (await sql.query(
        `SELECT "id", "jobKey", "status", "fence", "leaseOwner" FROM "cohort_text_jobs" WHERE "id" = $1`,
        [job0.id]
      )).rows[0];
      expect(job0After).toMatchObject({
        status: 'superseded',
        fence: 1,
        leaseOwner: null,
      });

      // New job must be queued
      const job1 = (await sql.query(
        `SELECT "id", "jobKey", "status", "fence" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" = 'journey:recommendations:1'`,
        [workspaceId]
      )).rows[0];
      expect(job1).toMatchObject({
        status: 'queued',
        fence: 0,
      });
    } finally {
      await db.close();
    }
  });

  it('preserves existing leases, fencing, and atomically accepts journey recommendations', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = '44444444-4444-4444-8444-444444444444';
      const state = createInitialWorkspace();
      await db.query(`INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision") VALUES ($1, $2::jsonb, 0)`, [workspaceId, JSON.stringify(state)]);
      await enqueueJourneyJobPlan(port, workspaceId, state);

      // 1. Claim the recommendations job
      const claimed = await claimTextJob(sql, 'worker-1', now, 10_000);
      expect(claimed).not.toBeNull();
      expect(claimed!).toMatchObject({
        workspaceId,
        stage: 'recommendations',
        sourceId: null,
        sourceVersion: null,
        fence: 1,
      });

      // 2. Execute outside of locks
      const items = await executeRecommendationJob(state, {
        loadCatalog: async () => [
          { id: 'cohort-consensus', label: 'Consensus Systems', url: 'https://undone.app/cohorts/cohort-consensus' },
        ],
      });
      expect(items).toEqual([
        { id: 'cohort-consensus', label: 'Consensus Systems', url: 'https://undone.app/cohorts/cohort-consensus' },
      ]);

      // 3. Retain artifact outside locks
      const artifact = await retainJourneyArtifact(sql, claimed!, items);
      expect(artifact.kind).toBe('recommendations');
      expect(artifact.sourceId).toBeNull();
      expect(artifact.sourceVersion).toBeNull();
      expect(artifact.inputFingerprint).toBe(claimed!.dependencyFingerprint);

      // 4. Stale fence / concurrent edit check:
      // If workspace was modified with a new intent, acceptance must be rejected
      const concurrentState = structuredClone(state);
      concurrentState.intent = 'Changed Intent';
      concurrentState.journey!.intentVersion = 2;
      await db.query(`UPDATE "interaction_workspaces" SET "snapshot" = $1::jsonb WHERE "id" = $2`, [JSON.stringify(concurrentState), workspaceId]);

      const staleAccepted = await port.transaction(tx => acceptJourneyJob(tx, claimed!, artifact, now));
      expect(staleAccepted).toBe(false);

      // Restore workspace state to match claimed job
      await db.query(`UPDATE "interaction_workspaces" SET "snapshot" = $1::jsonb WHERE "id" = $2`, [JSON.stringify(state), workspaceId]);

      // 5. Successful atomic acceptance
      const accepted = await port.transaction(tx => acceptJourneyJob(tx, claimed!, artifact, now));
      expect(accepted).toBe(true);

      // Job is marked accepted in DB
      const jobRow = (await sql.query(
        `SELECT "status", "resultArtifactId", "leaseOwner" FROM "cohort_text_jobs" WHERE "id" = $1`,
        [claimed!.id]
      )).rows[0];
      expect(jobRow).toMatchObject({
        status: 'accepted',
        resultArtifactId: artifact.id,
        leaseOwner: null,
      });

      // Workspace snapshot is updated with projected recommendations
      const wsRow = (await sql.query(
        `SELECT "snapshot", "revision" FROM "interaction_workspaces" WHERE "id" = $1`,
        [workspaceId]
      )).rows[0];
      const wsSnapshot = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);
      expect(wsRow.revision).toBe(1);
      expect(wsSnapshot.recommendations).toBeDefined();
      expect(wsSnapshot.recommendations).toMatchObject({
        status: 'ready',
        resultId: artifact.id,
        fingerprint: claimed!.dependencyFingerprint,
        items: [
          { id: 'cohort-consensus', label: 'Consensus Systems', url: 'https://undone.app/cohorts/cohort-consensus' },
        ],
      });
    } finally {
      await db.close();
    }
  });

  it('handles journey job failure and updates projection status to failed', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = '55555555-5555-4555-8555-555555555555';
      const state = createInitialWorkspace();
      await db.query(`INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision") VALUES ($1, $2::jsonb, 0)`, [workspaceId, JSON.stringify(state)]);
      await enqueueJourneyJobPlan(port, workspaceId, state);

      const claimed = await claimTextJob(sql, 'worker-fail', now, 10_000);
      expect(claimed).not.toBeNull();

      const failed = await port.transaction(tx => failJourneyJob(tx, claimed!, 'UPSTREAM_AI_TIMEOUT', now));
      expect(failed).toBe(true);

      const jobRow = (await sql.query(
        `SELECT "status", "errorCode", "leaseOwner" FROM "cohort_text_jobs" WHERE "id" = $1`,
        [claimed!.id]
      )).rows[0];
      expect(jobRow).toMatchObject({
        status: 'failed',
        errorCode: 'UPSTREAM_AI_TIMEOUT',
        leaseOwner: null,
      });

      const wsRow = (await sql.query(
        `SELECT "snapshot", "revision" FROM "interaction_workspaces" WHERE "id" = $1`,
        [workspaceId]
      )).rows[0];
      const wsSnapshot = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);
      expect(wsRow.revision).toBe(1);
      expect(wsSnapshot.recommendations).toMatchObject({
        status: 'failed',
        fingerprint: claimed!.dependencyFingerprint,
      });
    } finally {
      await db.close();
    }
  });

  it('plans, executes, and accepts a discovery job when in discovery step', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = '66666666-6666-4666-8666-666666666666';
      const state = createInitialWorkspace({
        journey: {
          version: 1,
          step: 'discovery',
          branch: 'find_material',
          processingStarted: false,
          intentVersion: 0,
        },
        recommendations: {
          requestId: 'rec-1',
          fingerprint: 'fp-rec',
          status: 'ready',
          generation: 0,
          items: [],
        },
        discovery: {
          requestId: 'disc-req-1',
          fingerprint: 'pending:0:disc-req-1',
          status: 'queued',
          generation: 0,
          items: [],
        },
      });

      await db.query(`INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision") VALUES ($1, $2::jsonb, 0)`, [workspaceId, JSON.stringify(state)]);

      const intents = planJourneyJobs(state);
      const discIntent = intents.find(i => i.stage === 'discovery');
      expect(discIntent).toBeDefined();
      expect(discIntent!.jobKey).toBe('journey:discovery:0:0');

      await enqueueJourneyJobPlan(port, workspaceId, state);

      const claimed = await claimTextJob(sql, 'worker-disc', now, 10_000);
      expect(claimed).not.toBeNull();
      expect(claimed!.stage).toBe('discovery');

      const items = await executeDiscoveryJob(state, {
        discoverCandidates: async () => [
          { id: 'cand-1', label: 'Raft Paper PDF', kind: 'web', url: 'https://raft.github.io/raft.pdf' },
        ],
      });
      expect(items).toEqual([
        { id: 'cand-1', label: 'Raft Paper PDF', kind: 'web', url: 'https://raft.github.io/raft.pdf' },
      ]);

      const artifact = await retainJourneyArtifact(sql, claimed!, items);
      expect(artifact.kind).toBe('discovery');

      const accepted = await port.transaction(tx => acceptJourneyJob(tx, claimed!, artifact, now));
      expect(accepted).toBe(true);

      const wsRow = (await sql.query(
        `SELECT "snapshot", "revision" FROM "interaction_workspaces" WHERE "id" = $1`,
        [workspaceId]
      )).rows[0];
      const wsSnapshot = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);
      expect(wsSnapshot.discovery).toMatchObject({
        status: 'ready',
        resultId: artifact.id,
        items: [
          { id: 'cand-1', label: 'Raft Paper PDF', kind: 'web', url: 'https://raft.github.io/raft.pdf' },
        ],
      });
    } finally {
      await db.close();
    }
  });

  it('validates migration SQL syntax and constraint expansions in isolated PostgreSQL', async () => {
    expect(journeyMigration).toMatch(/BEGIN;/);
    expect(journeyMigration).toMatch(/COMMIT;/);

    const db = new PGlite();
    try {
      await db.exec(`CREATE TABLE "interaction_workspaces" ("id" TEXT PRIMARY KEY)`);
      await db.exec(s3Migration);
      await db.exec(journeyMigration);

      await db.exec(`INSERT INTO "interaction_workspaces" ("id") VALUES ('ws-mig')`);

      const sha = 'b'.repeat(64);

      // 1. Check artifact kind constraint accepts 'recommendations' and 'discovery'
      await db.query(
        `INSERT INTO "cohort_text_artifacts"
         ("id", "workspaceId", "sourceId", "sourceVersion", "kind", "inputFingerprint", "checksum", "byteLength", "body")
         VALUES ('art-rec', 'ws-mig', NULL, NULL, 'recommendations', 'fp-1', $1, 2, $2)`,
        [sha, new Uint8Array([1, 2])]
      );

      await db.query(
        `INSERT INTO "cohort_text_artifacts"
         ("id", "workspaceId", "sourceId", "sourceVersion", "kind", "inputFingerprint", "checksum", "byteLength", "body")
         VALUES ('art-disc', 'ws-mig', NULL, NULL, 'discovery', 'fp-2', $1, 2, $2)`,
        [sha, new Uint8Array([3, 4])]
      );

      // Unknown kind must be rejected
      await expect(
        db.query(
          `INSERT INTO "cohort_text_artifacts"
           ("id", "workspaceId", "sourceId", "sourceVersion", "kind", "inputFingerprint", "checksum", "byteLength", "body")
           VALUES ('art-bad', 'ws-mig', NULL, NULL, 'invalid_kind', 'fp-3', $1, 2, $2)`,
          [sha, new Uint8Array([5, 6])]
        )
      ).rejects.toThrow();

      // 2. Check jobs stage constraint accepts 'recommendations' and 'discovery' with null source pair
      await db.exec(
        `INSERT INTO "cohort_text_jobs"
         ("id", "workspaceId", "jobKey", "sourceId", "sourceVersion", "stage", "dependencyFingerprint")
         VALUES ('job-rec', 'ws-mig', 'journey:recommendations:0', NULL, NULL, 'recommendations', 'fp-1'),
                ('job-disc', 'ws-mig', 'journey:discovery:0:0', NULL, NULL, 'discovery', 'fp-2')`
      );

      // Unknown stage must be rejected
      await expect(
        db.exec(
          `INSERT INTO "cohort_text_jobs"
           ("id", "workspaceId", "jobKey", "sourceId", "sourceVersion", "stage", "dependencyFingerprint")
           VALUES ('job-bad', 'ws-mig', 'journey:bad', NULL, NULL, 'invalid_stage', 'fp-3')`
        )
      ).rejects.toThrow();

      // Mismatched sourceId/sourceVersion must be rejected by source_pair_ck
      await expect(
        db.exec(
          `INSERT INTO "cohort_text_jobs"
           ("id", "workspaceId", "jobKey", "sourceId", "sourceVersion", "stage", "dependencyFingerprint")
           VALUES ('job-pair-bad', 'ws-mig', 'journey:pair-bad', 'source-1', NULL, 'recommendations', 'fp-4')`
        )
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });
});
