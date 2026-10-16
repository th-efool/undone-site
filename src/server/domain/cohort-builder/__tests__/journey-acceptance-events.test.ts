import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { cohortWorkspaceSchema, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { putTextArtifact, type TextArtifactSql } from '../text-artifacts';
import { claimTextJob } from '../text-jobs';
import type { TextJobTransactionPort } from '../text-job-scheduler';
import { enqueueJourneyJobPlan } from '../journey-job-scheduler';
import {
  acceptJourneyJob,
  failJourneyJob,
  retainJourneyArtifact,
} from '../journey-job-handlers';

const s3Migration = readFileSync(new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url), 'utf8');
const journeyMigration = readFileSync(new URL('../../../../../prisma/interaction-journey-stages.sql', import.meta.url), 'utf8');

const now = new Date('2030-01-01T12:00:00.000Z');

function createInitialWorkspace(overrides: Partial<CohortWorkspace> = {}): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems',
    intent: 'Learn consensus and replication in distributed databases',
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

  const port: TextJobTransactionPort = {
    transaction: <T>(work: (tx: TextArtifactSql) => Promise<T>) =>
      db.transaction(tx => work({ query: async (stmt, params) => tx.query<Record<string, unknown>>(stmt, params) })),
  };

  return { db, sql, port };
}

describe('Checkpoint 1: Canonical Journey Acceptance and Events', () => {
  it('successful recommendations acceptance emits canonical workspace.committed event', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = '11111111-1111-4111-8111-111111111111';
      const state = createInitialWorkspace();
      await db.query(
        `INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision", "sequence", "lifecycle", "domainId")
         VALUES ($1, $2::jsonb, 0, 1, 'active', 'cohort')`,
        [workspaceId, JSON.stringify(state)]
      );
      await enqueueJourneyJobPlan(port, workspaceId, state);

      const claimed = await claimTextJob(sql, 'worker-rec', now, 10_000);
      expect(claimed).not.toBeNull();
      expect(claimed!.stage).toBe('recommendations');

      const items = [
        {
          id: 'cohort-consensus-1',
          label: 'Distributed Systems & Paxos',
          url: 'https://undone.app/cohorts/consensus-1',
        },
      ];
      const artifact = await retainJourneyArtifact(sql, claimed!, items);

      // Accept inside transaction
      const accepted = await port.transaction(tx => acceptJourneyJob(tx, claimed!, artifact, now));
      expect(accepted).toBe(true);

      // Verify job is marked accepted
      const jobRow = (await sql.query(
        `SELECT "status", "resultArtifactId" FROM "cohort_text_jobs" WHERE "id" = $1`,
        [claimed!.id]
      )).rows[0];
      expect(jobRow).toMatchObject({
        status: 'accepted',
        resultArtifactId: artifact.id,
      });

      // Verify workspace projection updated: revision bumped, sequence incremented
      const wsRow = (await sql.query(
        `SELECT "snapshot", "revision", "sequence", "contextEpoch" FROM "interaction_workspaces" WHERE "id" = $1`,
        [workspaceId]
      )).rows[0];
      expect(wsRow.revision).toBe(1);
      expect(wsRow.sequence).toBe(2);
      expect(wsRow.contextEpoch).toBe(1);

      const wsSnapshot = cohortWorkspaceSchema.parse(
        typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot
      );
      expect(wsSnapshot.recommendations).toBeDefined();
      expect(wsSnapshot.recommendations?.status).toBe('ready');
      expect(wsSnapshot.recommendations?.items).toHaveLength(1);
      expect(wsSnapshot.recommendations?.items[0].id).toBe('cohort-consensus-1');

      // Verify canonical event emitted in interaction_events
      const events = (await sql.query(
        `SELECT "id", "workspaceId", "sequence", "protocolVersion", "type", "revision", "payload"
         FROM "interaction_events" WHERE "workspaceId" = $1 ORDER BY "sequence" ASC`,
        [workspaceId]
      )).rows;
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        workspaceId,
        sequence: 2,
        protocolVersion: 1,
        type: 'workspace.committed',
        revision: 1,
      });

      const payload = typeof events[0].payload === 'string' ? JSON.parse(events[0].payload) : events[0].payload;
      expect(payload.receipt.summary).toBe('Journey recommendations accepted.');
      expect(payload.baseRevision).toBe(0);
      expect(payload.revision).toBe(1);
    } finally {
      await db.close();
    }
  });

  it('successful discovery acceptance emits canonical workspace.committed event', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = '22222222-2222-4222-8222-222222222222';
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
      await db.query(
        `INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision", "sequence", "lifecycle", "domainId")
         VALUES ($1, $2::jsonb, 0, 1, 'active', 'cohort')`,
        [workspaceId, JSON.stringify(state)]
      );
      await enqueueJourneyJobPlan(port, workspaceId, state);

      const claimed = await claimTextJob(sql, 'worker-disc', now, 10_000);
      expect(claimed).not.toBeNull();
      expect(claimed!.stage).toBe('discovery');

      const items = [
        {
          id: 'candidate-web-1',
          label: 'Raft Paper PDF',
          kind: 'web' as const,
          url: 'https://raft.github.io/raft.pdf',
        },
      ];
      const artifact = await retainJourneyArtifact(sql, claimed!, items);

      const accepted = await port.transaction(tx => acceptJourneyJob(tx, claimed!, artifact, now));
      expect(accepted).toBe(true);

      const wsRow = (await sql.query(
        `SELECT "snapshot", "revision", "sequence" FROM "interaction_workspaces" WHERE "id" = $1`,
        [workspaceId]
      )).rows[0];
      expect(wsRow.revision).toBe(1);
      expect(wsRow.sequence).toBe(2);

      const events = (await sql.query(
        `SELECT "sequence", "type", "payload" FROM "interaction_events" WHERE "workspaceId" = $1`,
        [workspaceId]
      )).rows;
      expect(events).toHaveLength(1);
      expect(events[0].sequence).toBe(2);
      expect(events[0].type).toBe('workspace.committed');

      const payload = typeof events[0].payload === 'string' ? JSON.parse(events[0].payload) : events[0].payload;
      expect(payload.receipt.summary).toBe('Journey discovery accepted.');
    } finally {
      await db.close();
    }
  });

  it('job failure emits a compatible state change and canonical event', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = '33333333-3333-4333-8333-333333333333';
      const state = createInitialWorkspace();
      await db.query(
        `INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision", "sequence", "lifecycle", "domainId")
         VALUES ($1, $2::jsonb, 0, 1, 'active', 'cohort')`,
        [workspaceId, JSON.stringify(state)]
      );
      await enqueueJourneyJobPlan(port, workspaceId, state);

      const claimed = await claimTextJob(sql, 'worker-fail-test', now, 10_000);
      expect(claimed).not.toBeNull();

      const failed = await port.transaction(tx => failJourneyJob(tx, claimed!, 'AI_RATE_LIMIT', now));
      expect(failed).toBe(true);

      // Verify job is marked failed
      const jobRow = (await sql.query(
        `SELECT "status", "errorCode" FROM "cohort_text_jobs" WHERE "id" = $1`,
        [claimed!.id]
      )).rows[0];
      expect(jobRow.status).toBe('failed');
      expect(jobRow.errorCode).toBe('AI_RATE_LIMIT');

      // Verify workspace projection updated with status failed
      const wsRow = (await sql.query(
        `SELECT "snapshot", "revision", "sequence" FROM "interaction_workspaces" WHERE "id" = $1`,
        [workspaceId]
      )).rows[0];
      expect(wsRow.revision).toBe(1);
      expect(wsRow.sequence).toBe(2);

      const wsSnapshot = cohortWorkspaceSchema.parse(
        typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot
      );
      expect(wsSnapshot.recommendations?.status).toBe('failed');

      // Verify canonical event emitted
      const events = (await sql.query(
        `SELECT "sequence", "type", "payload" FROM "interaction_events" WHERE "workspaceId" = $1`,
        [workspaceId]
      )).rows;
      expect(events).toHaveLength(1);
      expect(events[0].sequence).toBe(2);
      expect(events[0].type).toBe('workspace.committed');
      const payload = typeof events[0].payload === 'string' ? JSON.parse(events[0].payload) : events[0].payload;
      expect(payload.receipt.summary).toBe('Journey recommendations failed; retry status updated.');
    } finally {
      await db.close();
    }
  });

  it('event insertion failure rolls back job acceptance completely', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = '44444444-4444-4444-8444-444444444444';
      const state = createInitialWorkspace();
      await db.query(
        `INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision", "sequence", "lifecycle", "domainId")
         VALUES ($1, $2::jsonb, 0, 1, 'active', 'cohort')`,
        [workspaceId, JSON.stringify(state)]
      );
      await enqueueJourneyJobPlan(port, workspaceId, state);

      const claimed = await claimTextJob(sql, 'worker-rollback', now, 10_000);
      expect(claimed).not.toBeNull();

      const items = [{ id: 'item-1', label: 'Item 1', url: 'https://undone.app/1' }];
      const artifact = await retainJourneyArtifact(sql, claimed!, items);

      // Add a CHECK constraint to interaction_events that sequence must be < 2
      // This will cause event insertion to fail and trigger transaction rollback!
      await db.exec(`ALTER TABLE "interaction_events" ADD CONSTRAINT "reject_event" CHECK ("sequence" < 2)`);

      let threw = false;
      try {
        await port.transaction(tx => acceptJourneyJob(tx, claimed!, artifact, now));
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);

      // Verify rollback: job is still running, NOT accepted
      const jobRow = (await sql.query(
        `SELECT "status", "resultArtifactId" FROM "cohort_text_jobs" WHERE "id" = $1`,
        [claimed!.id]
      )).rows[0];
      expect(jobRow.status).toBe('running');
      expect(jobRow.resultArtifactId).toBeNull();

      // Workspace revision and sequence untouched
      const wsRow = (await sql.query(
        `SELECT "revision", "sequence", "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`,
        [workspaceId]
      )).rows[0];
      expect(wsRow.revision).toBe(0);
      expect(wsRow.sequence).toBe(1);

      const wsSnapshot = cohortWorkspaceSchema.parse(
        typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot
      );
      expect(wsSnapshot.recommendations).toBeUndefined();

      // Zero events inserted
      const events = (await sql.query(
        `SELECT * FROM "interaction_events" WHERE "workspaceId" = $1`,
        [workspaceId]
      )).rows;
      expect(events).toHaveLength(0);
    } finally {
      await db.close();
    }
  });

  it('duplicate acceptance creates no duplicate mutation or event', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = '55555555-5555-4555-8555-555555555555';
      const state = createInitialWorkspace();
      await db.query(
        `INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision", "sequence", "lifecycle", "domainId")
         VALUES ($1, $2::jsonb, 0, 1, 'active', 'cohort')`,
        [workspaceId, JSON.stringify(state)]
      );
      await enqueueJourneyJobPlan(port, workspaceId, state);

      const claimed = await claimTextJob(sql, 'worker-dup', now, 10_000);
      expect(claimed).not.toBeNull();

      const items = [{ id: 'item-1', label: 'Item 1', url: 'https://undone.app/1' }];
      const artifact = await retainJourneyArtifact(sql, claimed!, items);

      // First acceptance succeeds
      const first = await port.transaction(tx => acceptJourneyJob(tx, claimed!, artifact, now));
      expect(first).toBe(true);

      // Second acceptance with identical claimed job must be rejected (job is no longer 'running')
      const second = await port.transaction(tx => acceptJourneyJob(tx, claimed!, artifact, now));
      expect(second).toBe(false);

      // Verify sequence and event count remained exactly 1
      const wsRow = (await sql.query(
        `SELECT "revision", "sequence" FROM "interaction_workspaces" WHERE "id" = $1`,
        [workspaceId]
      )).rows[0];
      expect(wsRow.revision).toBe(1);
      expect(wsRow.sequence).toBe(2);

      const events = (await sql.query(
        `SELECT * FROM "interaction_events" WHERE "workspaceId" = $1`,
        [workspaceId]
      )).rows;
      expect(events).toHaveLength(1);
    } finally {
      await db.close();
    }
  });

  it('expired / replaced / canceled worker cannot project', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = '66666666-6666-4666-8666-666666666666';
      const state = createInitialWorkspace();
      await db.query(
        `INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision", "sequence", "lifecycle", "domainId")
         VALUES ($1, $2::jsonb, 0, 1, 'active', 'cohort')`,
        [workspaceId, JSON.stringify(state)]
      );
      await enqueueJourneyJobPlan(port, workspaceId, state);

      const claimed = await claimTextJob(sql, 'worker-replaced', now, 10_000);
      expect(claimed).not.toBeNull();

      const items = [{ id: 'item-1', label: 'Item 1', url: 'https://undone.app/1' }];
      const artifact = await retainJourneyArtifact(sql, claimed!, items);

      // Case 1: Fence mismatch (e.g. superseded or re-queued)
      const staleClaimed = { ...claimed!, fence: claimed!.fence + 1 };
      const resFenceMismatch = await port.transaction(tx => acceptJourneyJob(tx, staleClaimed, artifact, now));
      expect(resFenceMismatch).toBe(false);

      // Case 2: LeaseToken mismatch (e.g. lease stolen by another worker)
      const staleLease = { ...claimed!, leaseToken: 'other-token' };
      const resLeaseMismatch = await port.transaction(tx => acceptJourneyJob(tx, staleLease, artifact, now));
      expect(resLeaseMismatch).toBe(false);

      // Verify workspace remained untouched
      const wsRow = (await sql.query(
        `SELECT "revision", "sequence" FROM "interaction_workspaces" WHERE "id" = $1`,
        [workspaceId]
      )).rows[0];
      expect(wsRow.revision).toBe(0);
      expect(wsRow.sequence).toBe(1);
    } finally {
      await db.close();
    }
  });

  it('inactive workspace rejects acceptance and prevents projection', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = '77777777-7777-4777-8777-777777777777';
      const state = createInitialWorkspace();
      // Workspace has lifecycle 'paused' (inactive)
      await db.query(
        `INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision", "sequence", "lifecycle", "domainId")
         VALUES ($1, $2::jsonb, 0, 1, 'paused', 'cohort')`,
        [workspaceId, JSON.stringify(state)]
      );
      await enqueueJourneyJobPlan(port, workspaceId, state);

      const claimed = await claimTextJob(sql, 'worker-inactive', now, 10_000);
      expect(claimed).not.toBeNull();

      const items = [{ id: 'item-1', label: 'Item 1', url: 'https://undone.app/1' }];
      const artifact = await retainJourneyArtifact(sql, claimed!, items);

      // Acceptance must be rejected because workspace is not active
      const accepted = await port.transaction(tx => acceptJourneyJob(tx, claimed!, artifact, now));
      expect(accepted).toBe(false);

      // Job remains running
      const jobRow = (await sql.query(
        `SELECT "status" FROM "cohort_text_jobs" WHERE "id" = $1`,
        [claimed!.id]
      )).rows[0];
      expect(jobRow.status).toBe('running');

      // No events inserted
      const events = (await sql.query(
        `SELECT * FROM "interaction_events" WHERE "workspaceId" = $1`,
        [workspaceId]
      )).rows;
      expect(events).toHaveLength(0);
    } finally {
      await db.close();
    }
  });

  it('client SSE query reads canonical events in order without manual reload', async () => {
    const { db, port, sql } = await setupDb();
    try {
      const workspaceId = '88888888-8888-4888-8888-888888888888';
      const state = createInitialWorkspace();
      await db.query(
        `INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision", "sequence", "lifecycle", "domainId")
         VALUES ($1, $2::jsonb, 0, 1, 'active', 'cohort')`,
        [workspaceId, JSON.stringify(state)]
      );
      await enqueueJourneyJobPlan(port, workspaceId, state);

      const claimed = await claimTextJob(sql, 'worker-sse', now, 10_000);
      const items = [{ id: 'item-1', label: 'Raft Paper', url: 'https://raft.github.io' }];
      const artifact = await retainJourneyArtifact(sql, claimed!, items);

      // Client is at cursor sequence: 1
      const clientCursor = 1;

      // Acceptance commits projection and emits event
      await port.transaction(tx => acceptJourneyJob(tx, claimed!, artifact, now));

      // Client SSE poll query: SELECT * FROM "interaction_events" WHERE "workspaceId" = $1 AND "sequence" > $2 ORDER BY "sequence" ASC
      const sseEvents = (await sql.query(
        `SELECT "sequence", "type", "revision", "payload"
         FROM "interaction_events"
         WHERE "workspaceId" = $1 AND "sequence" > $2
         ORDER BY "sequence" ASC`,
        [workspaceId, clientCursor]
      )).rows;

      expect(sseEvents).toHaveLength(1);
      expect(sseEvents[0].sequence).toBe(2);
      expect(sseEvents[0].type).toBe('workspace.committed');
      expect(sseEvents[0].revision).toBe(1);

      const payload = typeof sseEvents[0].payload === 'string' ? JSON.parse(sseEvents[0].payload) : sseEvents[0].payload;
      expect(payload.receipt.summary).toBe('Journey recommendations accepted.');
    } finally {
      await db.close();
    }
  });
});
