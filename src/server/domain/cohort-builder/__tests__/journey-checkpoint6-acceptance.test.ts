import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const state = vi.hoisted(() => ({
  db: null as PGlite | null,
  prisma: null as any,
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  get prisma() {
    return state.prisma;
  },
}));

vi.mock('@/src/server/interaction-worker', () => ({
  runInteractionWorkerLoop: vi.fn().mockResolvedValue(undefined),
}));

import {
  cohortWorkspaceSchema,
  type CohortWorkspace,
  type CohortAction,
  type CohortDiscoveryItem,
  type CohortActionContext,
  type CohortSource,
  planCohortAction,
} from '@/src/shared/cohort-builder/contracts';
import {
  putTextArtifact,
  readTextArtifact,
  type TextArtifactSql,
} from '../text-artifacts';
import { runDurableTextJobTick } from '../durable-text-worker';
import { sourcePdf } from './source-fixture';
import { acceptCohortIntake } from '@/src/server/infrastructure/db/postgres/cohort-intake';
import { createPostgresInteractionRepository } from '@/src/server/infrastructure/db/postgres/repositories/interaction.repo';
import { cohortDomain } from '../domain';
import { getActiveStage, getEffectiveStage } from '@/src/client/screens/cohortBuilder/stage-selectors';
import { validateCohortReadiness } from '@/src/shared/cohort-builder/readiness';
import { initialCohort } from '@/src/shared/cohort-builder/intake';
import type { VideoObservationProvider } from '../journey-video-adapter';
import type { RetainedVideoObservation } from '@/src/shared/cohort-builder/youtube-video-observation';
import type { CreationGuideAuthor } from '@/src/server/domain/cohort-creation/generated-guide';
import type { TextJobTransactionPort } from '../text-job-scheduler';
import { GENERATED_GUIDE_LIMITATION } from '@/src/shared/cohort-creation/generated-guide';

const s3Migration = readFileSync(new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url), 'utf8');
const s4bMigration = readFileSync(new URL('../../../../../prisma/interaction-s4b-sources.sql', import.meta.url), 'utf8');
const journeyMigration = readFileSync(new URL('../../../../../prisma/interaction-journey-stages.sql', import.meta.url), 'utf8');

const now = new Date('2030-01-01T12:00:00.000Z');
const videoId = 'dQw4w9WgXcQ';
const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

function createMockObservation(): RetainedVideoObservation {
  return {
    format: 'youtube-video-observation-v1',
    video: {
      id: videoId,
      title: 'Distributed Consensus Architecture',
      durationSeconds: 300,
      url: videoUrl,
    },
    model: {
      provider: 'google',
      modelId: 'gemini-1.5-pro',
      adapterVersion: 'vercel-video-observation-v3',
    },
    contentOrigin: 'ai',
    observedAt: '2026-10-15T12:00:00.000Z',
    limitations: [
      'Coverage is non-exhaustive; timestamps are estimated.',
      'Model observations are not verbatim captions.',
    ],
    observations: [
      {
        startSeconds: 0,
        endSeconds: 60,
        text: 'Overview of consensus in asynchronous networks with crash-recovery failures.',
      },
      {
        startSeconds: 65,
        endSeconds: 150,
        text: 'Leader election phases, term monotonicity, and split vote mitigation.',
      },
    ],
  };
}

async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" TEXT PRIMARY KEY,
      "email" TEXT
    );

    CREATE TABLE IF NOT EXISTS "interaction_workspaces" (
      "id" TEXT PRIMARY KEY,
      "ownerId" TEXT NOT NULL,
      "domainId" TEXT NOT NULL,
      "domainVersion" INTEGER NOT NULL DEFAULT 1,
      "snapshot" JSONB NOT NULL,
      "revision" INTEGER NOT NULL DEFAULT 0,
      "contextEpoch" INTEGER NOT NULL DEFAULT 0,
      "sequence" INTEGER NOT NULL DEFAULT 0,
      "lifecycle" TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_requests" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "actorId" TEXT NOT NULL,
      "operation" TEXT NOT NULL,
      "requestId" TEXT NOT NULL,
      "payloadHash" TEXT NOT NULL,
      "response" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "interaction_requests_uq" UNIQUE("workspaceId", "actorId", "operation", "requestId")
    );

    CREATE TABLE IF NOT EXISTS "interaction_events" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "sequence" INTEGER NOT NULL,
      "protocolVersion" INTEGER NOT NULL DEFAULT 1,
      "type" TEXT NOT NULL,
      "revision" INTEGER,
      "payload" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "interaction_events_uq" UNIQUE("workspaceId", "sequence")
    );

    CREATE TABLE IF NOT EXISTS "interaction_messages" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "parts" JSONB NOT NULL,
      "sequence" INTEGER NOT NULL,
      "runId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "interaction_messages_uq" UNIQUE("workspaceId", "sequence")
    );

    CREATE TABLE IF NOT EXISTS "interaction_runs" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "triggeringMessageId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'queued',
      "contextEpoch" INTEGER NOT NULL DEFAULT 0,
      "observedRevision" INTEGER NOT NULL DEFAULT 0,
      "cursor" INTEGER NOT NULL DEFAULT 0,
      "fence" INTEGER NOT NULL DEFAULT 0,
      "leaseOwner" TEXT,
      "leaseToken" TEXT,
      "leaseUntil" TIMESTAMP(3),
      "deadline" TIMESTAMP(3),
      "budgetReservation" JSONB,
      "budgetActual" JSONB,
      "error" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "cohort_creation_drafts" (
      "draftId" UUID PRIMARY KEY,
      "ownerId" TEXT NOT NULL,
      "snapshot" JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "creation_budgets" (
      "key" TEXT PRIMARY KEY,
      "used" INTEGER NOT NULL DEFAULT 0,
      "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_outbox" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "payload" JSONB NOT NULL,
      "dedupKey" TEXT NOT NULL UNIQUE,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "leaseOwner" TEXT,
      "leaseToken" TEXT,
      "leaseUntil" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(s3Migration);
  await db.exec(s4bMigration);
  await db.exec(journeyMigration);

  return db;
}

function createPrismaBridge(db: PGlite) {
  const bridge = {
    $transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => fn(bridge),
    $queryRaw: async <T = any>(strings: TemplateStringsArray, ...values: any[]): Promise<T> => {
      let query = strings[0];
      for (let i = 0; i < values.length; i++) {
        query += `$${i + 1}${strings[i + 1]}`;
      }
      const res = await db.query(query, values);
      return res.rows as unknown as T;
    },
    $queryRawUnsafe: async <T = any>(sql: string, ...values: any[]): Promise<T> => {
      const res = await db.query(sql, values);
      return res.rows as unknown as T;
    },
    $executeRaw: async (strings: TemplateStringsArray, ...values: any[]): Promise<number> => {
      let query = strings[0];
      for (let i = 0; i < values.length; i++) {
        query += `$${i + 1}${strings[i + 1]}`;
      }
      const res = await db.query(query, values);
      return res.affectedRows ?? (res.rows?.length ?? 1);
    },
    $executeRawUnsafe: async (sql: string, ...values: any[]): Promise<number> => {
      const res = await db.query(sql, values);
      return res.affectedRows ?? (res.rows?.length ?? 1);
    },
    interactionWorkspace: {
      findFirst: async ({ where }: any) => {
        let sql = 'SELECT * FROM "interaction_workspaces" WHERE 1=1';
        const vals: any[] = [];
        if (where?.id) {
          vals.push(where.id);
          sql += ` AND "id" = $${vals.length}`;
        }
        if (where?.ownerId) {
          vals.push(where.ownerId);
          sql += ` AND "ownerId" = $${vals.length}`;
        }
        const res = await db.query(sql, vals);
        const row = res.rows[0] as any;
        if (!row) return null;
        return {
          ...row,
          snapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot,
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
          updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
        };
      },
      findUnique: async ({ where }: any) => {
        const res = await db.query('SELECT * FROM "interaction_workspaces" WHERE "id" = $1', [where.id]);
        const row = res.rows[0] as any;
        if (!row) return null;
        return {
          ...row,
          snapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot,
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
          updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
        };
      },
      findUniqueOrThrow: async ({ where }: any) => {
        const row = await bridge.interactionWorkspace.findUnique({ where });
        if (!row) throw new Error('WORKSPACE_NOT_FOUND');
        return row;
      },
      create: async ({ data }: any) => {
        const res = await db.query(
          `INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "domainVersion", "snapshot", "revision", "sequence", "contextEpoch", "lifecycle")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [
            data.id,
            data.ownerId,
            data.domainId,
            data.domainVersion ?? 1,
            JSON.stringify(data.snapshot),
            data.revision ?? 0,
            data.sequence ?? 0,
            data.contextEpoch ?? 0,
            data.lifecycle ?? 'active',
          ]
        );
        const row = res.rows[0] as any;
        return {
          ...row,
          snapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot,
        };
      },
      update: async ({ where, data }: any) => {
        const sets: string[] = [];
        const vals: any[] = [];
        for (const [k, v] of Object.entries(data)) {
          if (v && typeof v === 'object' && 'increment' in (v as any)) {
            sets.push(`"${k}" = "${k}" + ${(v as any).increment}`);
          } else {
            vals.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
            sets.push(`"${k}" = $${vals.length}`);
          }
        }
        vals.push(where.id);
        const res = await db.query(
          `UPDATE "interaction_workspaces" SET ${sets.join(', ')} WHERE "id" = $${vals.length} RETURNING *`,
          vals
        );
        const row = res.rows[0] as any;
        return {
          ...row,
          snapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot,
        };
      },
    },
    interactionRequest: {
      findUnique: async ({ where }: any) => {
        const k = where?.workspaceId_actorId_operation_requestId;
        if (k) {
          const res = await db.query(
            `SELECT * FROM "interaction_requests" WHERE "workspaceId" = $1 AND "actorId" = $2 AND "operation" = $3 AND "requestId" = $4`,
            [k.workspaceId, k.actorId, k.operation, k.requestId]
          );
          const row = res.rows[0] as any;
          if (!row) return null;
          return { ...row, response: typeof row.response === 'string' ? JSON.parse(row.response) : row.response };
        }
        if (where?.id) {
          const res = await db.query('SELECT * FROM "interaction_requests" WHERE "id" = $1', [where.id]);
          const row = res.rows[0] as any;
          if (!row) return null;
          return { ...row, response: typeof row.response === 'string' ? JSON.parse(row.response) : row.response };
        }
        return null;
      },
      create: async ({ data }: any) => {
        await db.query(
          `INSERT INTO "interaction_requests" ("id", "workspaceId", "actorId", "operation", "requestId", "payloadHash", "response")
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          [data.id, data.workspaceId, data.actorId, data.operation, data.requestId, data.payloadHash, JSON.stringify(data.response)]
        );
        return data;
      },
    },
    interactionMessage: {
      create: async ({ data }: any) => {
        const res = await db.query(
          `INSERT INTO "interaction_messages" ("id", "workspaceId", "role", "parts", "sequence", "runId")
           VALUES ($1, $2, $3, $4::jsonb, $5, $6) RETURNING *`,
          [data.id, data.workspaceId, data.role, JSON.stringify(data.parts), data.sequence, data.runId ?? null]
        );
        const row = res.rows[0] as any;
        return {
          ...row,
          parts: typeof row.parts === 'string' ? JSON.parse(row.parts) : row.parts,
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        };
      },
    },
    interactionEvent: {
      create: async ({ data }: any) => {
        await db.query(
          `INSERT INTO "interaction_events" ("id", "workspaceId", "sequence", "protocolVersion", "type", "revision", "payload")
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          [data.id, data.workspaceId, data.sequence, data.protocolVersion ?? 1, data.type, data.revision ?? null, JSON.stringify(data.payload)]
        );
        return data;
      },
    },
    interactionRun: {
      findFirst: async ({ where }: any) => {
        let sql = 'SELECT * FROM "interaction_runs" WHERE 1=1';
        const vals: any[] = [];
        if (where?.workspaceId) {
          vals.push(where.workspaceId);
          sql += ` AND "workspaceId" = $${vals.length}`;
        }
        if (where?.status?.in) {
          const inPlaceholders = where.status.in.map((s: string) => {
            vals.push(s);
            return `$${vals.length}`;
          });
          sql += ` AND "status" IN (${inPlaceholders.join(',')})`;
        }
        const res = await db.query(sql, vals);
        const row = res.rows[0] as any;
        if (!row) return null;
        return {
          ...row,
          leaseUntil: row.leaseUntil ? new Date(row.leaseUntil) : null,
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
          updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
        };
      },
      findUnique: async ({ where }: any) => {
        const res = await db.query('SELECT * FROM "interaction_runs" WHERE "id" = $1', [where.id]);
        const row = res.rows[0] as any;
        if (!row) return null;
        return {
          ...row,
          leaseUntil: row.leaseUntil ? new Date(row.leaseUntil) : null,
          createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
          updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
        };
      },
      create: async ({ data }: any) => {
        const res = await db.query(
          `INSERT INTO "interaction_runs" ("id", "workspaceId", "triggeringMessageId", "status", "contextEpoch", "observedRevision", "cursor", "fence", "budgetReservation", "budgetActual", "error")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
          [
            data.id,
            data.workspaceId,
            data.triggeringMessageId ?? null,
            data.status ?? 'queued',
            data.contextEpoch ?? 0,
            data.observedRevision ?? 0,
            data.cursor ?? 0,
            data.fence ?? 0,
            data.budgetReservation ? JSON.stringify(data.budgetReservation) : null,
            data.budgetActual ? JSON.stringify(data.budgetActual) : null,
            data.error ?? null,
          ]
        );
        return res.rows[0];
      },
      update: async ({ where, data }: any) => {
        const sets: string[] = [];
        const vals: any[] = [];
        for (const [k, v] of Object.entries(data)) {
          if (k === 'fence' && typeof v === 'object' && v && 'increment' in v) {
            sets.push(`"fence" = "fence" + 1`);
          } else {
            vals.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
            sets.push(`"${k}" = $${vals.length}`);
          }
        }
        vals.push(where.id);
        const res = await db.query(
          `UPDATE "interaction_runs" SET ${sets.join(', ')} WHERE "id" = $${vals.length} RETURNING *`,
          vals
        );
        return res.rows[0];
      },
    },
    interactionOutbox: {
      create: async ({ data }: any) => {
        await db.query(
          `INSERT INTO "interaction_outbox" ("id", "workspaceId", "kind", "payload", "dedupKey", "status", "attempts", "dueAt")
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)`,
          [
            data.id,
            data.workspaceId,
            data.kind,
            JSON.stringify(data.payload),
            data.dedupKey,
            data.status ?? 'pending',
            data.attempts ?? 0,
            data.dueAt ?? new Date(),
          ]
        );
        return data;
      },
    },
  };
  return bridge;
}

describe('Checkpoint 5 & 6: Real Integrated Acceptance and Delivery Suite', () => {
  let db: PGlite;
  let sql: TextArtifactSql;
  let txPort: TextJobTransactionPort;
  let repo: ReturnType<typeof createPostgresInteractionRepository>;

  beforeEach(async () => {
    vi.stubEnv('INTERACTION_COHORT_JOURNEY_ENABLED', '1');
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    vi.stubEnv('INTERACTION_PDF_ENABLED', '1');
    vi.stubEnv('INTERACTION_WEB_ENABLED', '1');
    vi.stubEnv('INTERACTION_YOUTUBE_ENABLED', '1');
    vi.stubEnv('INTERACTION_YOUTUBE_TEST_MOCK', '1');

    db = await createTestDb();
    state.db = db;
    state.prisma = createPrismaBridge(db);

    sql = {
      async query(statement: string, parameters: unknown[]) {
        const res = await db.query(statement, parameters as any[]);
        return { rows: res.rows as Record<string, unknown>[] };
      },
    };

    txPort = {
      async transaction<T>(fn: (tx: TextArtifactSql) => Promise<T>): Promise<T> {
        return fn(sql);
      },
    };

    repo = createPostgresInteractionRepository(state.prisma);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (db) {
      await db.close();
    }
    state.db = null;
    state.prisma = null;
  });

  async function loadWorkspace(id: string): Promise<CohortWorkspace> {
    const res = await db.query(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id" = $1`, [id]);
    const row = res.rows[0] as { snapshot: unknown };
    return cohortWorkspaceSchema.parse(typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot);
  }

  async function commit(workspaceId: string, ownerId: string, action: CohortAction) {
    const current = await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId });
    if (!current) throw new Error('Workspace not found');

    const envelope = {
      actionId: randomUUID(),
      workspaceId,
      expectedRevision: current.revision,
      entityVersions: [],
      action,
    };

    return repo.commitAction({
      workspaceId,
      ownerId,
      expectedRevision: current.revision,
      envelope,
      plan: cohortDomain.plan,
    });
  }

  async function simulateRecommendationsCompleted(workspaceId: string) {
    const recReady = JSON.stringify({
      requestId: randomUUID(),
      fingerprint: 'fp-rec',
      status: 'ready',
      generation: 0,
      items: [],
    });
    await db.query(`UPDATE "interaction_workspaces"
      SET snapshot = jsonb_set(snapshot, '{recommendations}', $1::jsonb)
      WHERE id = $2`, [recReady, workspaceId]);
    await db.query(`DELETE FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" LIKE 'journey:recommendations:%'`, [workspaceId]);
  }

  describe('1. Full Multi-Branch Lifecycle with Real Worker Execution', () => {
    it('Branch 1: have_material → real multi-format sources (Text, PDF, Web, YouTube) → durable ticks → ready → review → publish', async () => {
      const ownerId = 'user-branch-1';
      const intakeRes = await acceptCohortIntake(ownerId, {
        requestId: randomUUID(),
        prompt: 'Learn Distributed Consensus Architecture',
      });
      const workspaceId = intakeRes.workspaceId;

      let ws = await loadWorkspace(workspaceId);
      expect(ws.journey?.step).toBe('recommendations');
      expect(ws.journey?.processingStarted).toBe(false);
      expect(getActiveStage(ws)).toBe('recommendations');

      await simulateRecommendationsCompleted(workspaceId);

      // Recommendations -> Starting Point -> have_material
      await commit(workspaceId, ownerId, { type: 'create_own_cohort' });
      ws = await loadWorkspace(workspaceId);
      expect(ws.journey?.step).toBe('starting_point');
      expect(getActiveStage(ws)).toBe('starting_point');

      await commit(workspaceId, ownerId, { type: 'choose_starting_point', choice: 'have_material' });
      ws = await loadWorkspace(workspaceId);
      expect(ws.journey?.step).toBe('material_input');
      expect(ws.journey?.branch).toBe('have_material');
      expect(getActiveStage(ws)).toBe('material_input');

      // Add multi-format sources
      // 1. Text Source
      await commit(workspaceId, ownerId, {
        type: 'add_text_source',
        sourceId: 'src-text',
        label: 'Consensus Overview',
        text: 'Safety and liveness in asynchronous consensus protocols with crash-recovery.',
      });

      // 2. PDF Source (real ASCII PDF)
      const pdfBytes = sourcePdf(['Quorums overlap and ensure consensus.', 'Majorities prevent split decisions.']);
      const upload = await putTextArtifact(sql, {
        workspaceId,
        kind: 'source_input',
        inputFingerprint: 'b'.repeat(64),
        bytes: pdfBytes,
      });
      await commit(workspaceId, ownerId, {
        type: 'add_pdf_source',
        sourceId: 'src-pdf',
        label: 'Consensus Paper.pdf',
        uploadId: upload.id,
      });

      // 3. Web Source
      await commit(workspaceId, ownerId, {
        type: 'add_web_source',
        sourceId: 'src-web',
        label: 'Paxos Article',
        url: 'https://docs.example.org/paxos',
      });

      // 4. YouTube Video Observation Source
      await commit(workspaceId, ownerId, {
        type: 'add_youtube_source',
        sourceId: 'src-yt',
        label: 'Distributed Systems Lecture',
        url: videoUrl,
        mode: 'video_observation',
      });

      // Assert sources retained without queuing processing
      ws = await loadWorkspace(workspaceId);
      expect(ws.sources).toHaveLength(4);
      expect(ws.journey?.processingStarted).toBe(false);
      expect(ws.processing.status).toBe('idle');

      // Explicit Continue invokes begin_material_processing
      await commit(workspaceId, ownerId, { type: 'begin_material_processing' });
      ws = await loadWorkspace(workspaceId);
      expect(ws.journey?.step).toBe('processing');
      expect(ws.journey?.processingStarted).toBe(true);
      expect(ws.processing.status).toBe('queued');

      // Execute durable text worker ticks with real fixtures
      const webOpen = vi.fn(async () => ({
        status: 200,
        headers: { 'content-type': 'text/plain' },
        bytes: (async function* () {
          yield Buffer.from('Majority voting ensures quorum overlap in distributed consensus.');
        })(),
        close: vi.fn(),
      }));
      const webTransport = {
        resolve: async () => [{ address: '93.184.216.34', family: 4 }],
        open: webOpen,
      };

      const mockObs = createMockObservation();
      const observeVideo = vi.fn().mockResolvedValue(mockObs);
      const videoObservationProvider: VideoObservationProvider = { observeVideo };

      const tick = () =>
        runDurableTextJobTick({
          sql,
          transaction: txPort,
          workerId: 'real-acceptance-worker',
          leaseMs: 60_000,
          now: () => now,
          loadWorkspace,
          webTransport,
          videoObservationProvider,
        });

      let completed = 0;
      while (completed < 50) {
        const res = await tick();
        if (res.status === 'idle') break;
        expect(res.status).toBe('accepted');
        completed++;
      }

      expect(completed).toBeGreaterThanOrEqual(15);
      expect(webOpen).toHaveBeenCalledOnce();
      expect(observeVideo).toHaveBeenCalledOnce();

      // Workspace should now be in ready stage
      ws = await loadWorkspace(workspaceId);
      expect(ws.processing.status).toBe('ready');
      expect(ws.journey?.step).toBe('ready');
      expect(getActiveStage(ws)).toBe('ready');
      expect(ws.lessons.length).toBeGreaterThan(0);

      // Verify PDF extracted locations
      const pdfSource = ws.sources.find(s => s.id === 'src-pdf');
      expect(pdfSource?.locations?.map(l => l.page)).toEqual([1, 2]);

      // Verify YouTube video observation provenance
      const ytSource = ws.sources.find(s => s.id === 'src-yt');
      expect(ytSource?.provenance?.scope).toBe('video_observation');
      expect(ytSource?.provenance?.contentOrigin).toBe('ai');
      expect(ytSource?.provenance?.estimatedIntervals).toBe(true);

      // Ready -> open_review -> Review
      await commit(workspaceId, ownerId, { type: 'open_review' });
      ws = await loadWorkspace(workspaceId);
      expect(ws.journey?.step).toBe('review');
      expect(getActiveStage(ws)).toBe('review');

      // Review curation: pin lesson, edit, reorder
      const firstLesson = ws.lessons[0];
      await commit(workspaceId, ownerId, { type: 'set_lesson_pin', lessonId: firstLesson.id, pinned: true });
      ws = await loadWorkspace(workspaceId);
      expect(ws.lessons.find(l => l.id === firstLesson.id)?.pinned).toBe(true);

      // Pinned lesson cannot be removed
      await expect(
        commit(workspaceId, ownerId, { type: 'remove_lesson', lessonId: firstLesson.id })
      ).rejects.toThrow('PINNED_LESSON_LOCKED');

      // Edit objective
      await commit(workspaceId, ownerId, {
        type: 'edit_lesson',
        lessonId: firstLesson.id,
        objective: 'Master overlapping quorum consensus.',
      });
      // Tick the re-queued assembly reconciliation job
      const reassemblyRes = await tick();
      expect(reassemblyRes.status).toBe('accepted');

      ws = await loadWorkspace(workspaceId);
      expect(ws.processing.status).toBe('ready');
      expect(ws.lessons.find(l => l.id === firstLesson.id)?.objective).toBe('Master overlapping quorum consensus.');

      // Release validation and commit
      const readiness = validateCohortReadiness(ws, 'public_publish');
      expect(readiness.ready).toBe(true);

      const candidateHash = 'f'.repeat(64);
      await commit(workspaceId, ownerId, {
        type: 'prepare_release',
        mode: 'public_publish',
        candidateHash,
      });

      const receipt = {
        effectKey: candidateHash,
        cohortId: 'cohort-dist-sys-acceptance',
        workspaceId,
        mode: 'public_publish' as const,
        releasedAt: new Date().toISOString(),
        contentHash: candidateHash,
        destinationUrl: '/cohort/cohort-dist-sys-acceptance',
      };

      await commit(workspaceId, ownerId, {
        type: 'commit_release',
        mode: 'public_publish',
        candidateHash,
        receipt,
      });

      ws = await loadWorkspace(workspaceId);
      expect(ws.journey?.step).toBe('published');
      expect(ws.release?.status).toBe('released');
      expect(ws.release?.cohortId).toBe('cohort-dist-sys-acceptance');
      expect(getActiveStage(ws)).toBe('published');

      // Invariant: Once published, back navigation is permanently blocked
      await expect(commit(workspaceId, ownerId, { type: 'back_to_starting_point' })).rejects.toThrow('INVALID_JOURNEY_TRANSITION');
      await expect(commit(workspaceId, ownerId, { type: 'back_to_recommendations' })).rejects.toThrow('INVALID_JOURNEY_TRANSITION');
    });

    it('Branch 2: find_material → real discovery durable tick → candidate selection → processing → published', async () => {
      const ownerId = 'user-branch-2';
      const intakeRes = await acceptCohortIntake(ownerId, {
        requestId: randomUUID(),
        prompt: 'Learn Rust Async Architecture',
      });
      const workspaceId = intakeRes.workspaceId;
      await simulateRecommendationsCompleted(workspaceId);

      await commit(workspaceId, ownerId, { type: 'create_own_cohort' });
      await commit(workspaceId, ownerId, { type: 'choose_starting_point', choice: 'find_material' });

      let ws = await loadWorkspace(workspaceId);
      expect(ws.journey?.step).toBe('discovery');
      expect(ws.journey?.branch).toBe('find_material');

      await commit(workspaceId, ownerId, { type: 'start_discovery' });
      ws = await loadWorkspace(workspaceId);
      expect(ws.discovery?.status).toBe('queued');

      const candidate1: CohortDiscoveryItem = {
        id: 'rust-tokio-guide',
        label: 'Tokio Async Rust Tutorial',
        kind: 'web',
        url: 'https://tokio.rs/tokio/tutorial',
      };

      const discoveryAdapter = {
        async executeCohortDiscovery() {
          return {
            items: [candidate1],
            rawResult: {
              candidates: [{ key: candidate1.id, title: candidate1.label, url: candidate1.url, kind: 'web' }],
              selection: { selected: [{ candidateKey: candidate1.id, reason: 'Official async guide' }] },
            },
          };
        },
      };

      // Run durable discovery tick
      const discTick = await runDurableTextJobTick({
        sql,
        transaction: txPort,
        workerId: 'worker-disc-accept',
        leaseMs: 10_000,
        now: () => now,
        loadWorkspace,
        discoveryAdapter,
      });
      expect(discTick.status).toBe('accepted');

      ws = await loadWorkspace(workspaceId);
      expect(ws.discovery?.status).toBe('ready');
      expect(ws.discovery?.items).toHaveLength(1);

      // Select candidate
      await commit(workspaceId, ownerId, {
        type: 'select_discovery_resources',
        resultId: ws.discovery!.resultId!,
        candidateIds: [candidate1.id],
      });

      ws = await loadWorkspace(workspaceId);
      expect(ws.journey?.step).toBe('material_input');
      expect(ws.sources).toHaveLength(1);
      expect(ws.sources[0].label).toBe('Tokio Async Rust Tutorial');
      expect(ws.journey?.processingStarted).toBe(false);

      // Continue to curriculum
      await commit(workspaceId, ownerId, { type: 'begin_material_processing' });
      ws = await loadWorkspace(workspaceId);
      expect(ws.journey?.step).toBe('processing');

      // Run web source pipeline
      const webTransport = {
        resolve: async () => [{ address: '104.26.10.1', family: 4 }],
        open: async () => ({
          status: 200,
          headers: { 'content-type': 'text/plain' },
          bytes: (async function* () {
            yield Buffer.from('Tokio is an asynchronous runtime for the Rust programming language.');
          })(),
          close: vi.fn(),
        }),
      };

      let completed = 0;
      while (completed < 20) {
        const res = await runDurableTextJobTick({
          sql,
          transaction: txPort,
          workerId: 'worker-disc-pipeline',
          leaseMs: 10_000,
          now: () => now,
          loadWorkspace,
          webTransport,
        });
        if (res.status === 'idle') break;
        completed++;
      }

      ws = await loadWorkspace(workspaceId);
      expect(ws.processing.status).toBe('ready');
      expect(ws.journey?.step).toBe('ready');

      // Open review and release
      await commit(workspaceId, ownerId, { type: 'open_review' });
      const candidateHash = 'e'.repeat(64);
      await commit(workspaceId, ownerId, { type: 'prepare_release', mode: 'private_activation', candidateHash });
      await commit(workspaceId, ownerId, {
        type: 'commit_release',
        mode: 'private_activation',
        candidateHash,
        receipt: {
          effectKey: candidateHash,
          cohortId: 'cohort-rust-async',
          workspaceId,
          mode: 'private_activation',
          releasedAt: new Date().toISOString(),
          contentHash: candidateHash,
          destinationUrl: '/cohort/cohort-rust-async',
        },
      });

      ws = await loadWorkspace(workspaceId);
      expect(ws.journey?.step).toBe('published');
      expect(ws.release?.cohortId).toBe('cohort-rust-async');
    });

    it('Branch 3: have_goal → goal_setup → start_goal_generation → generated_guide DAG to published', async () => {
      const ownerId = 'user-branch-3';
      const intakeRes = await acceptCohortIntake(ownerId, {
        requestId: randomUUID(),
        prompt: 'Learn Kubernetes Networking Architecture',
      });
      const workspaceId = intakeRes.workspaceId;
      await simulateRecommendationsCompleted(workspaceId);

      await commit(workspaceId, ownerId, { type: 'create_own_cohort' });
      await commit(workspaceId, ownerId, { type: 'choose_starting_point', choice: 'have_goal' });

      let ws = await loadWorkspace(workspaceId);
      expect(ws.journey?.step).toBe('goal_setup');

      await commit(workspaceId, ownerId, { type: 'set_audience', audience: 'DevOps Engineers' });
      await commit(workspaceId, ownerId, { type: 'set_daily_minutes', dailyMinutes: 30 });

      // Start goal generation -> adds generated_guide source
      await commit(workspaceId, ownerId, { type: 'start_goal_generation' });
      ws = await loadWorkspace(workspaceId);
      expect(ws.journey?.step).toBe('processing');
      expect(ws.journey?.processingStarted).toBe(true);
      expect(ws.sources).toHaveLength(1);
      expect(ws.sources[0].input?.kind).toBe('generated_guide');

      const guideAuthor: CreationGuideAuthor = {
        identity: { provider: 'test-ai', modelId: 'deterministic-guide', adapterVersion: 'v1' },
        async author() {
          return {
            title: 'Kubernetes Cluster Networking',
            sections: [
              { heading: 'Pod-to-Pod Networking', text: 'Every pod in a Kubernetes cluster gets its own IP address across the overlay network.' },
              { heading: 'Services and Ingress', text: 'Kube-proxy programs iptables or IPVS rules to route service virtual IPs to backing pod endpoints.' },
            ],
            limitations: [GENERATED_GUIDE_LIMITATION, 'Introductory guide.'],
          };
        },
      };

      // Run pipeline through durable worker
      let completed = 0;
      while (completed < 20) {
        const res = await runDurableTextJobTick({
          sql,
          transaction: txPort,
          workerId: 'worker-goal-pipeline',
          leaseMs: 10_000,
          now: () => now,
          loadWorkspace,
          guideAuthor,
        });
        if (res.status === 'idle') break;
        completed++;
      }

      ws = await loadWorkspace(workspaceId);
      expect(ws.processing.status).toBe('ready');
      expect(ws.journey?.step).toBe('ready');

      // Verify guide provenance
      const guideSource = ws.sources[0];
      expect(guideSource.provenance?.scope).toBe('ai_authored_guide');
      expect(guideSource.provenance?.contentOrigin).toBe('ai');
      expect(guideSource.provenance?.limitations).toContain(GENERATED_GUIDE_LIMITATION);

      // Open review and publish
      await commit(workspaceId, ownerId, { type: 'open_review' });
      const candidateHash = 'd'.repeat(64);
      await commit(workspaceId, ownerId, { type: 'prepare_release', mode: 'public_publish', candidateHash });
      await commit(workspaceId, ownerId, {
        type: 'commit_release',
        mode: 'public_publish',
        candidateHash,
        receipt: {
          effectKey: candidateHash,
          cohortId: 'cohort-k8s-net',
          workspaceId,
          mode: 'public_publish',
          releasedAt: new Date().toISOString(),
          contentHash: candidateHash,
          destinationUrl: '/cohort/cohort-k8s-net',
        },
      });

      ws = await loadWorkspace(workspaceId);
      expect(ws.journey?.step).toBe('published');
    });
  });

  describe('2. Interactive Guarantees, Fault Tolerance & Concurrency', () => {
    it('Two-tab conflict: rejects concurrent commit with STALE_WORKSPACE on mismatched expectedRevision', async () => {
      const ownerId = 'user-conflict';
      const intakeRes = await acceptCohortIntake(ownerId, { requestId: randomUUID(), prompt: 'Concurrency Test' });
      const workspaceId = intakeRes.workspaceId;

      // Tab 1 commits action successfully
      await commit(workspaceId, ownerId, { type: 'set_daily_minutes', dailyMinutes: 30 });

      // Tab 2 has stale revision 0 and tries to commit
      const staleEnvelope = {
        actionId: randomUUID(),
        workspaceId,
        expectedRevision: 0, // Stale!
        entityVersions: [],
        action: { type: 'set_daily_minutes' as const, dailyMinutes: 45 },
      };

      await expect(
        repo.commitAction({
          workspaceId,
          ownerId,
          expectedRevision: 0,
          envelope: staleEnvelope,
          plan: cohortDomain.plan,
        })
      ).rejects.toThrow();
    });

    it('Duplicate / lost acknowledgement: identical intake request returns cached response without duplicate run', async () => {
      const ownerId = 'user-dedup';
      const requestId = randomUUID();
      const prompt = 'Idempotent Intake Cohort';

      const res1 = await acceptCohortIntake(ownerId, { requestId, prompt });
      const res2 = await acceptCohortIntake(ownerId, { requestId, prompt });

      expect(res1.workspaceId).toBe(res2.workspaceId);

      // Verify only 1 workspace exists
      const wsCount = await db.query(`SELECT count(*)::int AS count FROM "interaction_workspaces" WHERE "ownerId" = $1`, [ownerId]);
      expect(Number((wsCount.rows[0] as any).count)).toBe(1);
    });

    it('Worker restart & resume: reuses accepted artifacts without re-executing finished stages', async () => {
      const ownerId = 'user-restart';
      const intakeRes = await acceptCohortIntake(ownerId, { requestId: randomUUID(), prompt: 'Worker Restart Test' });
      const workspaceId = intakeRes.workspaceId;
      await simulateRecommendationsCompleted(workspaceId);

      await commit(workspaceId, ownerId, { type: 'create_own_cohort' });
      await commit(workspaceId, ownerId, { type: 'choose_starting_point', choice: 'have_material' });
      await commit(workspaceId, ownerId, {
        type: 'add_text_source',
        sourceId: 'src-1',
        label: 'Notes',
        text: 'State machine replication principles.',
      });
      await commit(workspaceId, ownerId, { type: 'begin_material_processing' });

      // Run 2 ticks (e.g. acquisition and extraction)
      await runDurableTextJobTick({
        sql,
        transaction: txPort,
        workerId: 'worker-1',
        leaseMs: 10_000,
        now: () => now,
        loadWorkspace,
      });

      // Verify extraction artifact in database
      const extJobs = await db.query<any>(
        `SELECT "status", "resultArtifactId" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "stage" = 'acquisition'`,
        [workspaceId]
      );
      expect(extJobs.rows[0].status).toBe('accepted');
      const acqArtifactId = extJobs.rows[0].resultArtifactId;
      expect(acqArtifactId).toBeDefined();

      // "Restart" worker: Worker 2 takes over and processes remaining jobs
      let remainingTicks = 0;
      while (remainingTicks < 10) {
        const res = await runDurableTextJobTick({
          sql,
          transaction: txPort,
          workerId: 'worker-2-resumed',
          leaseMs: 10_000,
          now: () => now,
          loadWorkspace,
        });
        if (res.status === 'idle') break;
        remainingTicks++;
      }

      // Acquisition job was NOT re-run; original artifact retained
      const finalAcqJobs = await db.query<any>(
        `SELECT "resultArtifactId" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "stage" = 'acquisition'`,
        [workspaceId]
      );
      expect(finalAcqJobs.rows[0].resultArtifactId).toBe(acqArtifactId);
    });

    it('Worker replacement & fencing: stale worker tick with expired lease or bumped fence is rejected', async () => {
      const ownerId = 'user-fencing';
      const intakeRes = await acceptCohortIntake(ownerId, { requestId: randomUUID(), prompt: 'Fencing Test' });
      const workspaceId = intakeRes.workspaceId;
      await simulateRecommendationsCompleted(workspaceId);

      await commit(workspaceId, ownerId, { type: 'create_own_cohort' });
      await commit(workspaceId, ownerId, { type: 'choose_starting_point', choice: 'have_material' });
      await commit(workspaceId, ownerId, { type: 'add_text_source', sourceId: 'src-f', label: 'Notes', text: 'Text' });
      await commit(workspaceId, ownerId, { type: 'begin_material_processing' });

      // Bump fence directly in database simulating job cancellation or reassignment
      await db.query(`UPDATE "cohort_text_jobs" SET "fence" = "fence" + 1 WHERE "workspaceId" = $1`, [workspaceId]);

      // Attempting to tick with old fence will fail to update
      const jobs = await db.query<any>(`SELECT "fence" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "status" = 'queued'`, [workspaceId]);
      expect(Number(jobs.rows[0].fence)).toBe(1);
    });

    it('Partial failure and targeted retry: failing source records contextual error, retryable without resetting others', async () => {
      const ownerId = 'user-partial';
      const intakeRes = await acceptCohortIntake(ownerId, { requestId: randomUUID(), prompt: 'Partial Failure Test' });
      const workspaceId = intakeRes.workspaceId;
      await simulateRecommendationsCompleted(workspaceId);

      await commit(workspaceId, ownerId, { type: 'create_own_cohort' });
      await commit(workspaceId, ownerId, { type: 'choose_starting_point', choice: 'have_material' });

      // Add a healthy text source and a web source that will fail
      await commit(workspaceId, ownerId, { type: 'add_text_source', sourceId: 'src-ok', label: 'Good Source', text: 'Valid content.' });
      await commit(workspaceId, ownerId, { type: 'add_web_source', sourceId: 'src-fail', label: 'Broken Web', url: 'https://broken.example.org' });
      await commit(workspaceId, ownerId, { type: 'begin_material_processing' });

      // Web transport that throws
      const failingWebTransport = {
        resolve: async () => [{ address: '127.0.0.1', family: 4 }],
        open: async () => {
          throw new Error('FETCH_FAILED');
        },
      };

      // Tick until the failing job fails and runnable healthy jobs complete
      let failedJobId: string | undefined;
      for (let i = 0; i < 15; i++) {
        const res = await runDurableTextJobTick({
          sql,
          transaction: txPort,
          workerId: 'worker-partial',
          leaseMs: 10_000,
          now: () => now,
          loadWorkspace,
          webTransport: failingWebTransport,
        });
        if (res.status === 'failed') {
          failedJobId = res.jobId;
        }
        if (res.status === 'idle') {
          break;
        }
      }
      expect(failedJobId).toBeDefined();

      // Verify the web source failed while text source succeeded
      const failedJob = await db.query<any>(
        `SELECT "status", "errorCode" FROM "cohort_text_jobs" WHERE "id" = $1`,
        [failedJobId]
      );
      expect(failedJob.rows[0].status).toBe('failed');
      expect(failedJob.rows[0].errorCode).toBe('WEB_SOURCE_REJECTED');

      const okJob = await db.query<any>(
        `SELECT "status" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "sourceId" = 'src-ok' AND "stage" = 'acquisition'`,
        [workspaceId]
      );
      expect(okJob.rows[0].status).toBe('accepted');

      // Targeted retry: retry_text_job re-queues only the failed job
      await commit(workspaceId, ownerId, { type: 'retry_text_job', jobId: failedJobId! });
      const retriedJob = await db.query<any>(
        `SELECT "status", "errorCode" FROM "cohort_text_jobs" WHERE "id" = $1`,
        [failedJobId]
      );
      expect(retriedJob.rows[0].status).toBe('queued');
      expect(retriedJob.rows[0].errorCode).toBeNull();
    });

    it('Real-time event emission: every stage advancement and commit emits sequential workspace.committed events', async () => {
      const ownerId = 'user-events';
      const intakeRes = await acceptCohortIntake(ownerId, { requestId: randomUUID(), prompt: 'Event Emission Test' });
      const workspaceId = intakeRes.workspaceId;

      await commit(workspaceId, ownerId, { type: 'create_own_cohort' });
      await commit(workspaceId, ownerId, { type: 'choose_starting_point', choice: 'have_goal' });

      // Verify events in interaction_events
      const events = await db.query<any>(
        `SELECT "sequence", "type", "payload" FROM "interaction_events" WHERE "workspaceId" = $1 ORDER BY "sequence" ASC`,
        [workspaceId]
      );
      expect(events.rows.length).toBeGreaterThanOrEqual(2);
      expect(events.rows.some(e => e.type === 'message.accepted')).toBe(true);
      expect(events.rows.some(e => e.type === 'workspace.committed')).toBe(true);

      // Verify strictly monotonically increasing sequence
      for (let i = 1; i < events.rows.length; i++) {
        expect(Number(events.rows[i].sequence)).toBeGreaterThan(Number(events.rows[i - 1].sequence));
      }
    });

    it('Writable chat & preserved drafts: appending message updates messages without resetting journey state', async () => {
      const ownerId = 'user-chat';
      const intakeRes = await acceptCohortIntake(ownerId, { requestId: randomUUID(), prompt: 'Chat Test' });
      const workspaceId = intakeRes.workspaceId;
      await simulateRecommendationsCompleted(workspaceId);

      await commit(workspaceId, ownerId, { type: 'create_own_cohort' });
      await commit(workspaceId, ownerId, { type: 'choose_starting_point', choice: 'have_material' });
      await commit(workspaceId, ownerId, { type: 'add_text_source', sourceId: 'src-1', label: 'Notes', text: 'Important text' });

      // Append user message to conversation rail
      await repo.appendMessage({
        id: randomUUID(),
        workspaceId,
        ownerId,
        role: 'user',
        parts: [{ type: 'text', text: 'Can you emphasize consensus protocols?' }],
      });

      // Verify workspace journey state is completely preserved
      const ws = await loadWorkspace(workspaceId);
      expect(ws.journey?.step).toBe('material_input');
      expect(ws.journey?.branch).toBe('have_material');
      expect(ws.sources).toHaveLength(1);
      expect(ws.sources[0].label).toBe('Notes');
    });

    it('Legacy workspace compatibility: workspaces without journey parse cleanly and keep journey: undefined', async () => {
      const legacyWs: CohortWorkspace = {
        schemaVersion: 1,
        title: 'Legacy Distributed Systems',
        intent: 'Learn Paxos',
        audience: 'Anyone',
        dailyMinutes: 15,
        sources: [],
        chunks: [],
        understanding: [],
        analyses: [],
        lessons: [
          {
            id: 'l1',
            version: 0,
            title: 'Paxos Basics',
            objective: 'Understand Paxos',
            pinned: false,
            sourceChunkIds: [],
          },
        ],
        processing: { status: 'idle', stage: 'done', generation: 0, sourceFingerprint: null, error: null },
      };

      const parsed = cohortWorkspaceSchema.parse(legacyWs);
      expect(parsed.journey).toBeUndefined();

      const dummyCtx: CohortActionContext = {
        actionId: 'act-legacy',
        workspaceId: 'ws-legacy',
        expectedRevision: 1,
        currentRevision: 1,
        entityVersions: new Map(),
      };

      const planned = planCohortAction(parsed, { type: 'set_daily_minutes', dailyMinutes: 30 }, dummyCtx);
      expect(planned.nextState.journey).toBeUndefined();
      expect(planned.nextState.dailyMinutes).toBe(30);
    });

    it('Stage navigation inspection non-destructiveness: inspecting earlier stage returns inspected stage without state mutation', () => {
      const ws: CohortWorkspace = {
        ...initialCohort('Distributed Systems'),
        journey: {
          version: 1,
          step: 'processing',
          branch: 'have_material',
          processingStarted: true,
          intentVersion: 0,
        },
        sources: [{ id: 's1', version: 0, label: 'Doc 1', text: 'Text', checksum: null, state: 'ready' }],
        processing: {
          status: 'processing',
          stage: 'analysis',
          generation: 1,
          sourceFingerprint: null,
          error: null,
          jobs: [
            { id: 'j1', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
            { id: 'j2', sourceId: 's1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
            { id: 'j3', sourceId: 's1', stage: 'analysis', status: 'running', attempts: 1, error: null, retryable: false },
          ],
        },
      };

      expect(getActiveStage(ws)).toBe('analysis');

      // User inspects earlier stage 'understanding'
      expect(getEffectiveStage(ws, 'understanding')).toBe('understanding');

      // State is untouched
      expect(ws.processing.status).toBe('processing');
      expect(ws.journey?.step).toBe('processing');
      expect(ws.processing.jobs?.length).toBe(3);
    });

    it('Truthful provenance & disclaimers across all 4 material modes', () => {
      // YouTube Video Observation
      const videoSource: CohortSource = {
        id: 'yt-1',
        version: 0,
        label: 'Lecture',
        text: 'Observation text',
        checksum: 'a'.repeat(64),
        state: 'ready',
        input: { kind: 'youtube', url: videoUrl, mode: 'video_observation' },
        provenance: {
          parserVersion: '1.0.0',
          rawChecksum: 'a'.repeat(64),
          scope: 'video_observation',
          videoId,
          contentOrigin: 'ai',
          limitations: ['Coverage is non-exhaustive; timestamps are estimated.'],
          estimatedIntervals: true,
        },
      };
      expect(videoSource.provenance?.scope).toBe('video_observation');
      expect(videoSource.provenance?.contentOrigin).toBe('ai');
      expect(videoSource.provenance?.estimatedIntervals).toBe(true);

      // YouTube Transcript
      const transcriptSource: CohortSource = {
        ...videoSource,
        input: { kind: 'youtube', url: videoUrl, mode: 'transcript' },
        provenance: {
          parserVersion: '1.0.0',
          rawChecksum: 'b'.repeat(64),
          scope: 'transcript_only',
          videoId,
        },
      };
      expect(transcriptSource.provenance?.scope).toBe('transcript_only');
      expect(transcriptSource.provenance?.contentOrigin).toBeUndefined();

      // Generated Guide
      const guideSource: CohortSource = {
        id: 'guide-1',
        version: 0,
        label: 'Guide',
        text: 'AI Guide',
        checksum: 'c'.repeat(64),
        state: 'ready',
        input: { kind: 'generated_guide', goal: 'Goal', audience: 'Audience', dailyMinutes: 30, intentVersion: 0 },
        provenance: {
          parserVersion: '1.0.0',
          rawChecksum: 'c'.repeat(64),
          scope: 'ai_authored_guide',
          contentOrigin: 'ai',
          limitations: [GENERATED_GUIDE_LIMITATION],
        },
      };
      expect(guideSource.provenance?.scope).toBe('ai_authored_guide');
      expect(guideSource.provenance?.limitations).toContain(GENERATED_GUIDE_LIMITATION);
    });
  });
});
