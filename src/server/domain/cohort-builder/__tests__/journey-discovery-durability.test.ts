import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { z } from 'zod';

vi.mock('server-only', () => ({}));

import {
  cohortDiscoveryItemSchema,
  cohortWorkspaceSchema,
  planCohortAction,
  type CohortWorkspace,
  type CohortActionContext,
} from '@/src/shared/cohort-builder/contracts';
import type { TextArtifactSql } from '../text-artifacts';
import type { TextJobTransactionPort } from '../text-job-scheduler';
import { claimTextJob } from '../text-jobs';
import {
  enqueueJourneyJobPlan,
  enqueueJourneyJobPlanInTransaction,
  cancelJourneyDiscovery,
} from '../journey-job-scheduler';
import {
  acceptJourneyJob,
  retainJourneyArtifact,
} from '../journey-job-handlers';
import {
  executeCohortDiscovery,
  createJourneyDiscoveryAdapter,
  WorkspaceArtifactStoreAdapter,
} from '../journey-discovery-adapter';
import type {
  ResourceDiscovery,
  DiscoveryCandidate,
  GroundedSearch,
  DiscoverySelection,
} from '../../cohort-creation/discovery.contracts';
import type { DiscoverySourceObserver } from '../../cohort-creation/discovery-observer';
import { CreationFailure, creationFailure } from '../../cohort-creation/errors';
import { reconcileTextAction } from '../text-action-jobs';

const s3Migration = readFileSync(
  new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url),
  'utf8'
);
const journeyMigration = readFileSync(
  new URL('../../../../../prisma/interaction-journey-stages.sql', import.meta.url),
  'utf8'
);

const now = new Date('2030-01-01T12:00:00.000Z');

function createActionContext(overrides: Partial<CohortActionContext> = {}): CohortActionContext {
  return {
    actionId: 'action-test-uuid-1',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    expectedRevision: 0,
    currentRevision: 0,
    entityVersions: new Map(),
    ...overrides,
  };
}

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
      step: 'discovery',
      branch: 'find_material',
      processingStarted: false,
      intentVersion: 0,
    },
    recommendations: {
      requestId: 'rec-1',
      fingerprint: 'fp-rec-ready',
      status: 'ready',
      generation: 0,
      items: [],
    },
    discovery: {
      requestId: 'req-discovery-1',
      fingerprint: 'fp-initial',
      status: 'queued',
      generation: 0,
      items: [],
    },
    ...overrides,
  });
}

function createMockCandidate(
  url: string,
  title: string,
  kind: DiscoveryCandidate['kind'] = 'web'
): DiscoveryCandidate {
  const key = createHash('sha256').update(url).digest('hex');
  return {
    key,
    citationIds: [`cite-${key.slice(0, 8)}`],
    url,
    title,
    kind,
    observedAt: new Date().toISOString(),
    observation: {
      method: kind === 'web' ? 'public_http' : 'youtube_api',
      requestedUrl: url,
      redirects: [],
      titleOrigin: 'observed',
      contentRetained: false,
    },
  };
}

async function setupDb() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS "interaction_workspaces" (
      "id" TEXT PRIMARY KEY,
      "snapshot" JSONB NOT NULL,
      "lifecycle" TEXT NOT NULL DEFAULT 'active',
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

async function insertWorkspace(db: PGlite, workspaceId: string, state: CohortWorkspace) {
  await db.query(
    `INSERT INTO "interaction_workspaces" ("id", "snapshot", "revision", "sequence", "lifecycle", "domainId")
     VALUES ($1, $2::jsonb, 0, 1, 'active', 'cohort')
     ON CONFLICT ("id") DO UPDATE SET "snapshot" = EXCLUDED."snapshot"`,
    [workspaceId, JSON.stringify(state)]
  );
}

describe('Checkpoint 2: Durable Discovery and Correct Journey Controls', () => {
  describe('1. Storage Fail-Closed Behavior', () => {
    it('fails closed in production environment when SQL storage is missing and allowInMemory is false', async () => {
      const env = process.env as Record<string, string | undefined>;
      const origEnv = env.NODE_ENV;
      try {
        env.NODE_ENV = 'production';
        const workspace = createInitialWorkspace();
        await expect(
          executeCohortDiscovery(workspace, { __allowInMemoryStorage: false })
        ).rejects.toThrowError(
          expect.objectContaining({
            name: 'CreationFailure',
            detail: expect.objectContaining({
              code: 'DATA_UNAVAILABLE',
            }),
          })
        );
      } finally {
        env.NODE_ENV = origEnv;
      }
    });

    it('uses SQL storage adapter without requiring in-memory storage fallback', async () => {
      const { db, sql } = await setupDb();
      const workspaceId = '11111111-1111-4111-8111-111111111111';
      const workspace = createInitialWorkspace();
      await insertWorkspace(db, workspaceId, workspace);

      const candidate = createMockCandidate('https://example.com/sql-test', 'SQL Test');
      const mockAi: ResourceDiscovery = {
        search: vi.fn().mockResolvedValue({
          citations: [{ id: candidate.citationIds[0], url: candidate.url, title: candidate.title }],
          attribution: null,
          searchedAt: new Date().toISOString(),
          model: { provider: 'google', id: 'gemini-test' },
        }),
        select: vi.fn().mockResolvedValue({
          selected: [{ candidateKey: candidate.key, reason: 'Selected' }],
        }),
      };
      const mockObserver: Pick<DiscoverySourceObserver, 'observe'> = {
        observe: vi.fn().mockResolvedValue(candidate),
      };

      const result = await executeCohortDiscovery(workspace, {
        ai: mockAi,
        observer: mockObserver,
        sql,
        workspaceId,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(candidate.key);

      // Verify artifacts were stored in PostgreSQL cohort_text_artifacts table:
      const artifacts = await sql.query(
        `SELECT "id", "kind", "inputFingerprint" FROM "cohort_text_artifacts" WHERE "workspaceId" = $1`,
        [workspaceId]
      );
      expect(artifacts.rows.length).toBeGreaterThan(0);
      expect(artifacts.rows.some(r => r.kind === 'discovery')).toBe(true);
    });
  });

  describe('2. Checkpoint Persistence and Resume', () => {
    it('persists discovery checkpoints and resumes without repeating AI search', async () => {
      const { db, sql } = await setupDb();
      const workspaceId = '11111111-1111-4111-8111-111111111111';
      const workspace = createInitialWorkspace();
      await insertWorkspace(db, workspaceId, workspace);

      const c1 = createMockCandidate('https://example.com/res-1', 'Resource 1');
      const c2 = createMockCandidate('https://example.com/res-2', 'Resource 2');

      const mockAi: ResourceDiscovery = {
        search: vi.fn().mockResolvedValue({
          citations: [
            { id: c1.citationIds[0], url: c1.url, title: c1.title },
            { id: c2.citationIds[0], url: c2.url, title: c2.title },
          ],
          attribution: null,
          searchedAt: new Date().toISOString(),
          model: { provider: 'google', id: 'gemini-test' },
        }),
        select: vi.fn().mockResolvedValue({
          selected: [{ candidateKey: c1.key, reason: 'Good' }, { candidateKey: c2.key, reason: 'Good' }],
        }),
      };

      const controller = new AbortController();
      let observeCallCount = 0;
      const mockObserver: Pick<DiscoverySourceObserver, 'observe'> = {
        observe: vi.fn().mockImplementation(async (citation) => {
          observeCallCount++;
          if (observeCallCount === 1) {
            return c1;
          }
          // Abort during second observation to simulate worker interruption
          controller.abort();
          throw new DOMException('The operation was aborted', 'AbortError');
        }),
      };

      // First run aborts halfway through observation after checkpointing c1
      await expect(
        executeCohortDiscovery(
          workspace,
          {
            ai: mockAi,
            observer: mockObserver,
            sql,
            workspaceId,
          },
          controller.signal
        )
      ).rejects.toThrow();

      expect(mockAi.search).toHaveBeenCalledTimes(1);

      // Checkpoint was persisted into cohort_text_artifacts:
      const checkpoints = await sql.query(
        `SELECT "body" FROM "cohort_text_artifacts"
         WHERE "workspaceId" = $1 AND "inputFingerprint" LIKE 'checkpoint:%'`,
        [workspaceId]
      );
      expect(checkpoints.rows.length).toBeGreaterThan(0);

      // Now run again after restart without abort signal: observer succeeds for c2
      mockObserver.observe = vi.fn().mockResolvedValue(c2);

      const resumedResult = await executeCohortDiscovery(workspace, {
        ai: mockAi,
        observer: mockObserver,
        sql,
        workspaceId,
      });

      // Crucial: AI search was NOT called again; it resumed from saved checkpoint!
      expect(mockAi.search).toHaveBeenCalledTimes(1);
      expect(resumedResult.items.length).toBeGreaterThan(0);
    });
  });

  describe('3. Candidate ID Determinism', () => {
    it('produces identical candidate IDs across multiple execution runs', async () => {
      const { db, sql } = await setupDb();
      const workspaceId = '11111111-1111-4111-8111-111111111111';
      const workspace = createInitialWorkspace();
      await insertWorkspace(db, workspaceId, workspace);

      const c1 = createMockCandidate('https://example.com/det-1', 'Deterministic 1');
      const c2 = createMockCandidate('https://example.com/det-2', 'Deterministic 2');

      const mockAi: ResourceDiscovery = {
        search: vi.fn().mockResolvedValue({
          citations: [
            { id: c1.citationIds[0], url: c1.url, title: c1.title },
            { id: c2.citationIds[0], url: c2.url, title: c2.title },
          ],
          attribution: null,
          searchedAt: new Date().toISOString(),
          model: { provider: 'google', id: 'gemini-test' },
        }),
        select: vi.fn().mockResolvedValue({
          selected: [{ candidateKey: c1.key, reason: 'Good' }, { candidateKey: c2.key, reason: 'Good' }],
        }),
      };
      const mockObserver: Pick<DiscoverySourceObserver, 'observe'> = {
        observe: vi.fn().mockImplementation(async (cit) => cit.url === c1.url ? c1 : c2),
      };

      const run1 = await executeCohortDiscovery(workspace, {
        ai: mockAi,
        observer: mockObserver,
        sql,
        workspaceId,
      });

      const run2 = await executeCohortDiscovery(workspace, {
        ai: mockAi,
        observer: mockObserver,
        sql,
        workspaceId,
      });

      expect(run1.items.length).toBe(2);
      expect(run2.items.length).toBe(2);
      expect(run1.items.map(i => i.id)).toEqual(run2.items.map(i => i.id));
      expect(run1.items[0].id).toBe(c1.key);
      expect(run1.items[1].id).toBe(c2.key);
    });
  });

  describe('4. retry_recommendations Canonical Action and Reconciliation', () => {
    it('bumps generation, resets status to queued, and updates scheduler job', async () => {
      const { db, port, sql } = await setupDb();
      const workspaceId = '11111111-1111-4111-8111-111111111111';

      // 1. Initial state with failed recommendations
      const state0: CohortWorkspace = {
        ...createInitialWorkspace(),
        journey: {
          version: 1,
          step: 'recommendations',
          branch: null,
          processingStarted: false,
          intentVersion: 0,
        },
        recommendations: {
          requestId: 'req-rec-0',
          fingerprint: 'fp-rec-0',
          status: 'failed',
          generation: 0,
          items: [],
        },
      };

      await insertWorkspace(db, workspaceId, state0);
      await enqueueJourneyJobPlan(port, workspaceId, state0);

      // Verify recommendations job exists and is failed
      await sql.query(
        `UPDATE "cohort_text_jobs" SET "status" = 'failed', "errorCode" = 'AI_TIMEOUT'
         WHERE "workspaceId" = $1 AND "jobKey" = 'journey:recommendations:0'`,
        [workspaceId]
      );

      // 2. Dispatch retry_recommendations action
      const ctx = createActionContext({ actionId: 'action-retry-1', workspaceId });
      const plan = planCohortAction(state0, { type: 'retry_recommendations' }, ctx);

      expect(plan.nextState.recommendations?.generation).toBe(1);
      expect(plan.nextState.recommendations?.status).toBe('queued');

      // 3. Reconcile with scheduler
      await port.transaction(async tx => {
        await enqueueJourneyJobPlanInTransaction(tx, workspaceId, plan.nextState);
      });

      // 4. Verify job in DB is re-queued with reset attempts and bumped fence
      const jobRow = (await sql.query(
        `SELECT "status", "attempts", "fence", "errorCode"
         FROM "cohort_text_jobs"
         WHERE "workspaceId" = $1 AND "jobKey" = 'journey:recommendations:0'`,
        [workspaceId]
      )).rows[0];

      expect(jobRow.status).toBe('queued');
      expect(Number(jobRow.attempts)).toBe(0);
      expect(Number(jobRow.fence)).toBeGreaterThan(0);
      expect(jobRow.errorCode).toBeNull();
    });
  });

  describe('5. cancel_discovery Action, Scheduler Fencing, and Worker Rejection', () => {
    it('fences running discovery job and prevents subsequent worker acceptance', async () => {
      const { db, port, sql } = await setupDb();
      const workspaceId = '11111111-1111-4111-8111-111111111111';

      const state0 = createInitialWorkspace({
        journey: {
          version: 1,
          step: 'discovery',
          branch: 'find_material',
          processingStarted: false,
          intentVersion: 0,
        },
        discovery: {
          requestId: 'req-disc-0',
          fingerprint: 'fp-disc-0',
          status: 'queued',
          generation: 0,
          items: [],
        },
      });

      await insertWorkspace(db, workspaceId, state0);
      await enqueueJourneyJobPlan(port, workspaceId, state0);

      // Claim the discovery job as a worker: claimTextJob(sql, workerId, now, leaseMs)
      const claimed = await claimTextJob(sql, 'worker-discovery-1', now, 60_000);
      expect(claimed).not.toBeNull();
      expect(claimed!.stage).toBe('discovery');
      const originalFence = claimed!.fence;

      // User cancels discovery
      const ctx = createActionContext({ actionId: 'action-cancel-1', workspaceId });
      const plan = planCohortAction(state0, { type: 'cancel_discovery' }, ctx);

      expect(plan.nextState.discovery?.status).toBe('canceled');

      // Reconcile action (fences discovery job in DB and updates workspace snapshot)
      await port.transaction(async tx => {
        await cancelJourneyDiscovery(tx, workspaceId);
        await tx.query(
          `UPDATE "interaction_workspaces" SET "snapshot" = $1::jsonb, "revision" = 1 WHERE "id" = $2`,
          [JSON.stringify(plan.nextState), workspaceId]
        );
      });

      // Verify job is marked canceled in database with bumped fence
      const jobRow = (await sql.query(
        `SELECT "status", "fence", "leaseToken" FROM "cohort_text_jobs" WHERE "id" = $1`,
        [claimed!.id]
      )).rows[0];
      expect(jobRow.status).toBe('canceled');
      expect(Number(jobRow.fence)).toBe(originalFence + 1);
      expect(jobRow.leaseToken).toBeNull();

      // Worker now finishes and tries to accept with original claimed lease
      const artifact = await retainJourneyArtifact(
        sql,
        claimed!,
        [{ id: 'c1', label: 'C1', kind: 'web', url: 'https://example.com' }]
      );

      const accepted = await port.transaction(async tx => {
        return acceptJourneyJob(tx, claimed!, artifact, now);
      });

      // Acceptance MUST be rejected!
      expect(accepted).toBe(false);

      // Workspace snapshot remains canceled, not overwritten with ready
      const wsRow = (await sql.query(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`, [workspaceId])).rows[0];
      const ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);
      expect(ws.discovery?.status).toBe('canceled');
    });

    it('allows re-starting discovery after cancellation and schedules new job with bumped generation', async () => {
      const { db, port, sql } = await setupDb();
      const workspaceId = '11111111-1111-4111-8111-111111111111';

      const stateCanceled = createInitialWorkspace({
        journey: {
          version: 1,
          step: 'discovery',
          branch: 'find_material',
          processingStarted: false,
          intentVersion: 0,
        },
        discovery: {
          requestId: 'req-disc-0',
          fingerprint: 'fp-disc-0',
          status: 'canceled',
          generation: 0,
          items: [],
        },
      });

      await insertWorkspace(db, workspaceId, stateCanceled);

      // User calls start_discovery again
      const ctx = createActionContext({ actionId: 'action-restart-discovery', workspaceId });
      const plan = planCohortAction(stateCanceled, { type: 'start_discovery' }, ctx);

      expect(plan.nextState.discovery?.status).toBe('queued');
      expect(plan.nextState.discovery?.generation).toBe(1);

      // Enqueue plan
      await enqueueJourneyJobPlan(port, workspaceId, plan.nextState);

      const newJob = (await sql.query(
        `SELECT "jobKey", "status", "attempts" FROM "cohort_text_jobs"
         WHERE "workspaceId" = $1 AND "jobKey" = 'journey:discovery:0:1'`,
        [workspaceId]
      )).rows[0];

      expect(newJob).toBeDefined();
      expect(newJob.status).toBe('queued');
      expect(Number(newJob.attempts)).toBe(0);
    });
  });

  describe('6. reconcileTextAction integration with cancel_discovery', () => {
    it('reconciles cancel_discovery through reconcileTextAction port', async () => {
      const { db, port, sql } = await setupDb();
      const workspaceId = '11111111-1111-4111-8111-111111111111';

      const state0 = createInitialWorkspace({
        journey: {
          version: 1,
          step: 'discovery',
          branch: 'find_material',
          processingStarted: false,
          intentVersion: 0,
        },
        discovery: {
          requestId: 'req-disc-0',
          fingerprint: 'fp-disc-0',
          status: 'queued',
          generation: 0,
          items: [],
        },
      });

      await insertWorkspace(db, workspaceId, state0);
      await enqueueJourneyJobPlan(port, workspaceId, state0);

      // Claim job: claimTextJob(sql, workerId, now, leaseMs)
      const claimed = await claimTextJob(sql, 'worker-1', now, 60_000);
      expect(claimed).not.toBeNull();

      // Reconcile cancel_discovery
      const stateCanceled = {
        ...state0,
        discovery: { ...state0.discovery!, status: 'canceled' as const },
      };

      await port.transaction(async tx => {
        await reconcileTextAction(tx, workspaceId, stateCanceled, { type: 'cancel_discovery' });
      });

      const updatedJob = (await sql.query(
        `SELECT "status" FROM "cohort_text_jobs" WHERE "id" = $1`,
        [claimed!.id]
      )).rows[0];

      expect(updatedJob.status).toBe('canceled');
    });
  });

  describe('7. Checkpoint & Artifact Integrity Verification (Checkpoint 2)', () => {
    it('WorkspaceArtifactStoreAdapter.getJSON rejects when byteLength does not match body length', async () => {
      const workspaceId = 'ws-integrity-len';
      const scope = { ownerId: `workspace:${workspaceId}`, draftId: 'draft-1' };
      const body = Buffer.from(
        JSON.stringify({
          artifactType: 'test-artifact',
          schemaVersion: 1,
          inputFingerprint: 'fp-test-1',
          value: { test: 'data' },
        }),
        'utf8'
      );

      // Mock SQL returning byteLength !== body.byteLength
      const mockSql: TextArtifactSql = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              id: 'art-len-mismatch',
              workspaceId,
              kind: 'discovery',
              inputFingerprint: 'fp-test-1',
              checksum: createHash('sha256').update(body).digest('hex'),
              byteLength: body.byteLength + 10,
              body,
            },
          ],
        }),
      };
      const adapter = new WorkspaceArtifactStoreAdapter(mockSql, workspaceId);

      await expect(
        adapter.getJSON(scope, 'art-len-mismatch', {
          artifactType: 'test-artifact',
          schemaVersion: 1,
          inputFingerprint: 'fp-test-1',
          schema: z.object({ test: z.string() }),
        })
      ).rejects.toThrow('ARTIFACT_LENGTH_MISMATCH');
    });

    it('WorkspaceArtifactStoreAdapter.getJSON rejects when checksum does not match body hash', async () => {
      const { db, sql } = await setupDb();
      const workspaceId = 'ws-integrity-chk';
      await insertWorkspace(db, workspaceId, createInitialWorkspace());
      const adapter = new WorkspaceArtifactStoreAdapter(sql, workspaceId);
      const scope = { ownerId: `workspace:${workspaceId}`, draftId: 'draft-1' };

      const ref = await adapter.putJSON(scope, { test: 'data' }, {
        artifactType: 'test-artifact',
        schemaVersion: 1,
        inputFingerprint: 'fp-test-2',
        schema: z.object({ test: z.string() }),
      });

      // Tamper checksum in database with valid 64-char sha256 hex of different content
      const badChecksum = createHash('sha256').update('different-content').digest('hex');
      await db.query(`UPDATE "cohort_text_artifacts" SET "checksum" = $1 WHERE "id" = $2`, [badChecksum, ref.id]);

      await expect(
        adapter.getJSON(scope, ref.id, {
          artifactType: 'test-artifact',
          schemaVersion: 1,
          inputFingerprint: 'fp-test-2',
          schema: z.object({ test: z.string() }),
        })
      ).rejects.toThrow('ARTIFACT_CHECKSUM_MISMATCH');
    });

    it('WorkspaceArtifactStoreAdapter enforces tenant workspace isolation including missing or unprefixed ownerId', async () => {
      const { sql } = await setupDb();
      const workspaceId = 'ws-tenant-target';
      const adapter = new WorkspaceArtifactStoreAdapter(sql, workspaceId);

      const foreignScope = { ownerId: 'workspace:ws-foreign', draftId: 'draft-1' };
      const unprefixedScope = { ownerId: 'raw-user-id', draftId: 'draft-1' };
      const emptyScope = { ownerId: '', draftId: 'draft-1' };

      for (const badScope of [foreignScope, unprefixedScope, emptyScope]) {
        await expect(
          adapter.putJSON(badScope, { test: 'data' }, {
            artifactType: 'test-artifact',
            schemaVersion: 1,
            inputFingerprint: 'fp-test-3',
            schema: z.object({ test: z.string() }),
          })
        ).rejects.toThrow('Stored content was not found');

        await expect(
          adapter.getJSON(badScope, 'art-1', {
            artifactType: 'test-artifact',
            schemaVersion: 1,
            inputFingerprint: 'fp-test-3',
            schema: z.object({ test: z.string() }),
          })
        ).rejects.toThrow('Stored content was not found');
      }
    });

    it('WorkspaceArtifactStoreAdapter.getJSON rejects missing or mismatched artifactType, schemaVersion, inputFingerprint, or row kind', async () => {
      const workspaceId = 'ws-envelope-strict';
      const scope = { ownerId: `workspace:${workspaceId}`, draftId: 'draft-1' };

      function makeMockAdapter(envelopeObj: unknown, rowOverrides: Record<string, unknown> = {}) {
        const body = Buffer.from(JSON.stringify(envelopeObj), 'utf8');
        const mockSql: TextArtifactSql = {
          query: vi.fn().mockResolvedValue({
            rows: [
              {
                id: 'art-env',
                workspaceId,
                kind: 'discovery',
                inputFingerprint: 'fp-expected',
                checksum: createHash('sha256').update(body).digest('hex'),
                byteLength: body.byteLength,
                body,
                ...rowOverrides,
              },
            ],
          }),
        };
        return new WorkspaceArtifactStoreAdapter(mockSql, workspaceId);
      }

      const opts = {
        artifactType: 'discovery-checkpoint',
        schemaVersion: 1,
        inputFingerprint: 'fp-expected',
        schema: z.object({ test: z.string() }),
      };

      // 1. Missing artifactType in envelope
      await expect(
        makeMockAdapter({ schemaVersion: 1, inputFingerprint: 'fp-expected', value: { test: 'ok' } }).getJSON(
          scope,
          'art-env',
          opts
        )
      ).rejects.toThrow('ARTIFACT_MISSING_TYPE');

      // 2. Mismatched artifactType in envelope
      await expect(
        makeMockAdapter({
          artifactType: 'wrong-type',
          schemaVersion: 1,
          inputFingerprint: 'fp-expected',
          value: { test: 'ok' },
        }).getJSON(scope, 'art-env', opts)
      ).rejects.toThrow('ARTIFACT_TYPE_MISMATCH');

      // 3. Missing schemaVersion in envelope
      await expect(
        makeMockAdapter({
          artifactType: 'discovery-checkpoint',
          inputFingerprint: 'fp-expected',
          value: { test: 'ok' },
        }).getJSON(scope, 'art-env', opts)
      ).rejects.toThrow('ARTIFACT_MISSING_SCHEMA_VERSION');

      // 4. Mismatched schemaVersion in envelope
      await expect(
        makeMockAdapter({
          artifactType: 'discovery-checkpoint',
          schemaVersion: 99,
          inputFingerprint: 'fp-expected',
          value: { test: 'ok' },
        }).getJSON(scope, 'art-env', opts)
      ).rejects.toThrow('ARTIFACT_SCHEMA_VERSION_MISMATCH');

      // 5. Missing inputFingerprint in envelope
      await expect(
        makeMockAdapter({
          artifactType: 'discovery-checkpoint',
          schemaVersion: 1,
          value: { test: 'ok' },
        }).getJSON(scope, 'art-env', opts)
      ).rejects.toThrow('ARTIFACT_MISSING_FINGERPRINT');

      // 6. Mismatched inputFingerprint in envelope
      await expect(
        makeMockAdapter({
          artifactType: 'discovery-checkpoint',
          schemaVersion: 1,
          inputFingerprint: 'fp-wrong',
          value: { test: 'ok' },
        }).getJSON(scope, 'art-env', opts)
      ).rejects.toThrow('ARTIFACT_FINGERPRINT_MISMATCH');

      // 7. Mismatched row.inputFingerprint vs options.inputFingerprint
      await expect(
        makeMockAdapter(
          {
            artifactType: 'discovery-checkpoint',
            schemaVersion: 1,
            inputFingerprint: 'fp-expected',
            value: { test: 'ok' },
          },
          { inputFingerprint: 'fp-db-mismatch' }
        ).getJSON(scope, 'art-env', opts)
      ).rejects.toThrow('ARTIFACT_FINGERPRINT_MISMATCH');

      // 8. Wrong row.kind (e.g. 'recommendations' instead of 'discovery')
      await expect(
        makeMockAdapter(
          {
            artifactType: 'discovery-checkpoint',
            schemaVersion: 1,
            inputFingerprint: 'fp-expected',
            value: { test: 'ok' },
          },
          { kind: 'recommendations' }
        ).getJSON(scope, 'art-env', opts)
      ).rejects.toThrow('ARTIFACT_KIND_MISMATCH');
    });

    it('executeCohortDiscovery halts with DISCOVERY_CHECKPOINT_CORRUPT when saved checkpoint has corrupted checksum', async () => {
      const { db, sql } = await setupDb();
      const workspaceId = 'ws-corrupt-cp';
      const workspace = createInitialWorkspace();
      await insertWorkspace(db, workspaceId, workspace);

      const c1 = createMockCandidate('https://example.com/res-1', 'Resource 1');
      const c2 = createMockCandidate('https://example.com/res-2', 'Resource 2');

      const mockAi: ResourceDiscovery = {
        search: vi.fn().mockResolvedValue({
          citations: [
            { id: c1.citationIds[0], url: c1.url, title: c1.title },
            { id: c2.citationIds[0], url: c2.url, title: c2.title },
          ],
          attribution: null,
          searchedAt: new Date().toISOString(),
          model: { provider: 'google', id: 'gemini-test' },
        }),
        select: vi.fn().mockResolvedValue({
          selected: [{ candidateKey: c1.key, reason: 'Good' }],
        }),
      };

      const controller = new AbortController();
      const mockObserver: Pick<DiscoverySourceObserver, 'observe'> = {
        observe: vi.fn().mockImplementation(async () => {
          controller.abort();
          throw new DOMException('The operation was aborted', 'AbortError');
        }),
      };

      // 1. Initial run: writes a real checkpoint into database and aborts
      await expect(
        executeCohortDiscovery(
          workspace,
          { ai: mockAi, observer: mockObserver, sql, workspaceId },
          controller.signal
        )
      ).rejects.toThrow();

      // Verify checkpoint exists
      const cpRows = await sql.query(
        `SELECT "id" FROM "cohort_text_artifacts"
         WHERE "workspaceId" = $1 AND "inputFingerprint" LIKE 'checkpoint:%'`,
        [workspaceId]
      );
      expect(cpRows.rows.length).toBeGreaterThan(0);

      // 2. Tamper checkpoint checksum in DB
      const badChecksum = createHash('sha256').update('tampered-checkpoint').digest('hex');
      await db.query(
        `UPDATE "cohort_text_artifacts" SET "checksum" = $1
         WHERE "workspaceId" = $2 AND "inputFingerprint" LIKE 'checkpoint:%'`,
        [badChecksum, workspaceId]
      );

      // 3. Second run: must halt with DISCOVERY_CHECKPOINT_CORRUPT
      mockAi.search = vi.fn();
      await expect(
        executeCohortDiscovery(workspace, {
          ai: mockAi,
          sql,
          workspaceId,
        })
      ).rejects.toThrow('DISCOVERY_CHECKPOINT_CORRUPT');

      // AI was never queried on corrupt checkpoint
      expect(mockAi.search).not.toHaveBeenCalled();
    });

    it('executeCohortDiscovery halts with DISCOVERY_CHECKPOINT_CORRUPT when saved checkpoint has mismatched internal inputFingerprint (never silently restarts)', async () => {
      const { db, sql } = await setupDb();
      const workspaceId = 'ws-mismatch-cp-fp';
      const workspace = createInitialWorkspace();
      await insertWorkspace(db, workspaceId, workspace);

      const c1 = createMockCandidate('https://example.com/res-1', 'Resource 1');
      const mockAi: ResourceDiscovery = {
        search: vi.fn().mockResolvedValue({
          citations: [{ id: c1.citationIds[0], url: c1.url, title: c1.title }],
          attribution: null,
          searchedAt: new Date().toISOString(),
          model: { provider: 'google', id: 'gemini-test' },
        }),
        select: vi.fn().mockResolvedValue({
          selected: [{ candidateKey: c1.key, reason: 'Good' }],
        }),
      };

      const controller = new AbortController();
      const mockObserver: Pick<DiscoverySourceObserver, 'observe'> = {
        observe: vi.fn().mockImplementation(async () => {
          controller.abort();
          throw new DOMException('The operation was aborted', 'AbortError');
        }),
      };

      // 1. Write valid checkpoint and abort
      await expect(
        executeCohortDiscovery(
          workspace,
          { ai: mockAi, observer: mockObserver, sql, workspaceId },
          controller.signal
        )
      ).rejects.toThrow();

      // 2. Mutate the internal checkpoint.value.inputFingerprint while keeping valid outer envelope & checksum
      const cpRows = await sql.query(
        `SELECT "id", "body" FROM "cohort_text_artifacts"
         WHERE "workspaceId" = $1 AND "inputFingerprint" LIKE 'checkpoint:%'`,
        [workspaceId]
      );
      expect(cpRows.rows.length).toBeGreaterThan(0);
      const cpRow = cpRows.rows[0];
      const rawBody = Buffer.from(cpRow.body as Uint8Array);
      const parsedEnvelope = JSON.parse(rawBody.toString('utf8'));
      parsedEnvelope.value.inputFingerprint = 'f'.repeat(64); // Mismatched inner fingerprint!
      const newBytes = Buffer.from(JSON.stringify(parsedEnvelope), 'utf8');
      const newChecksum = createHash('sha256').update(newBytes).digest('hex');

      await db.query(
        `UPDATE "cohort_text_artifacts"
         SET "body" = $1, "byteLength" = $2, "checksum" = $3
         WHERE "id" = $4`,
        [newBytes, newBytes.byteLength, newChecksum, cpRow.id]
      );

      // 3. Resume must throw DISCOVERY_CHECKPOINT_CORRUPT and never call AI search
      mockAi.search = vi.fn();
      await expect(
        executeCohortDiscovery(workspace, {
          ai: mockAi,
          sql,
          workspaceId,
        })
      ).rejects.toThrow('DISCOVERY_CHECKPOINT_CORRUPT');
      expect(mockAi.search).not.toHaveBeenCalled();
    });

    it('executeCohortDiscovery propagates DISCOVERY_STORAGE_READ_FAILED when SQL checkpoint read fails and does not query AI', async () => {
      const { db } = await setupDb();
      const workspaceId = 'ws-sql-fail';
      const workspace = createInitialWorkspace();
      await insertWorkspace(db, workspaceId, workspace);

      const failingSql: TextArtifactSql = {
        query: vi.fn().mockRejectedValue(new Error('DATABASE_CONNECTION_LOST')),
      };

      const mockAi: ResourceDiscovery = {
        search: vi.fn(),
        select: vi.fn(),
      };

      await expect(
        executeCohortDiscovery(workspace, {
          ai: mockAi,
          sql: failingSql,
          workspaceId,
        })
      ).rejects.toThrow('DISCOVERY_STORAGE_READ_FAILED');

      expect(mockAi.search).not.toHaveBeenCalled();
    });

    it('executeCohortDiscovery halts with DISCOVERY_CHECKPOINT_WRITE_FAILED when mandatory checkpoint write fails', async () => {
      const { db } = await setupDb();
      const workspaceId = 'ws-write-fail';
      const workspace = createInitialWorkspace();
      await insertWorkspace(db, workspaceId, workspace);

      const candidate = createMockCandidate('https://example.com/item', 'Item');
      const mockAi: ResourceDiscovery = {
        search: vi.fn().mockResolvedValue({
          citations: [{ id: candidate.citationIds[0], url: candidate.url, title: candidate.title }],
          attribution: null,
          searchedAt: new Date().toISOString(),
          model: { provider: 'google', id: 'gemini-test' },
        }),
        select: vi.fn().mockResolvedValue({
          selected: [{ candidateKey: candidate.key, reason: 'Selected' }],
        }),
      };
      const mockObserver: Pick<DiscoverySourceObserver, 'observe'> = {
        observe: vi.fn().mockResolvedValue(candidate),
      };

      const { randomUUID } = await import('node:crypto');
      const failingStorage = {
        putJSON: vi.fn().mockImplementation(async (scope, value, options) => {
          if (options.artifactType === 'discovery-checkpoint') {
            throw new Error('DISK_FULL');
          }
          return { id: randomUUID(), kind: 'artifact' as const, byteLength: 10, checksum: '0'.repeat(64) };
        }),
        getJSON: vi.fn().mockResolvedValue({}),
        ref: vi.fn().mockResolvedValue({ id: randomUUID(), kind: 'artifact' as const, byteLength: 0, checksum: '0'.repeat(64) }),
      };

      await expect(
        executeCohortDiscovery(workspace, {
          ai: mockAi,
          observer: mockObserver,
          storage: failingStorage,
          workspaceId,
        })
      ).rejects.toThrow('DISCOVERY_CHECKPOINT_WRITE_FAILED');
    });
  });
});
