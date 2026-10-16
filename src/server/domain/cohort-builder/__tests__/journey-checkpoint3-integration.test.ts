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
} from '@/src/shared/cohort-builder/contracts';
import {
  putTextArtifact,
  readTextArtifact,
  type TextArtifactSql,
} from '../text-artifacts';
import { claimTextJob } from '../text-jobs';
import { acceptCurrentTextJob } from '../text-job-acceptance';
import { failCurrentTextJob } from '../text-job-failure';
import { runDurableTextJobTick } from '../durable-text-worker';
import { createTextSourceProcessor } from '../text-source-processor';
import { sourcePdf } from './source-fixture';
import { acceptCohortIntake } from '@/src/server/infrastructure/db/postgres/cohort-intake';
import { createPostgresInteractionRepository } from '@/src/server/infrastructure/db/postgres/repositories/interaction.repo';
import { cohortDomain } from '../domain';
import type { VideoObservationProvider } from '../journey-video-adapter';
import type { RetainedVideoObservation } from '@/src/shared/cohort-builder/youtube-video-observation';
import type { TextJobTransactionPort } from '../text-job-scheduler';

const s3Migration = readFileSync(new URL('../../../../../prisma/interaction-s3-storage.sql', import.meta.url), 'utf8');
const s4bMigration = readFileSync(new URL('../../../../../prisma/interaction-s4b-sources.sql', import.meta.url), 'utf8');
const journeyMigration = readFileSync(new URL('../../../../../prisma/interaction-journey-stages.sql', import.meta.url), 'utf8');

const now = new Date('2030-01-01T12:00:00.000Z');
const videoId = 'dQw4w9WgXcQ';
const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

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
      "leaseUntil" TIMESTAMPTZ,
      "deadline" TIMESTAMPTZ,
      "budgetReservation" JSONB,
      "budgetActual" JSONB,
      "error" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
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
      "deliveredAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "cohort_creation_drafts" (
      "id" TEXT PRIMARY KEY,
      "ownerId" TEXT NOT NULL,
      "state" JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "creation_jobs" (
      "id" TEXT PRIMARY KEY,
      "draftId" TEXT NOT NULL,
      "status" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "creation_budgets" (
      "key" TEXT PRIMARY KEY,
      "used" INTEGER NOT NULL DEFAULT 0,
      "expiresAt" TIMESTAMP(3) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "cohort_admin_controls" (
      "control_key" VARCHAR(64) PRIMARY KEY,
      "value" JSONB NOT NULL,
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_by" VARCHAR(128) NOT NULL,
      "reason" TEXT
    );
  `);

  await db.exec(s3Migration);
  await db.exec(s4bMigration);
  await db.exec(journeyMigration);

  return db;
}

function createPrismaBridge(db: PGlite) {
  const bridge = {
    $transaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
      return fn(bridge);
    },
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

function createMockObservation(): RetainedVideoObservation {
  return {
    format: 'youtube-video-observation-v1',
    video: {
      id: videoId,
      title: 'Distributed Consensus and State Machine Replication',
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

describe('Checkpoint 3: Material Collection, Processing Gate & Durable DAG Integration Suite', { timeout: 45_000 }, () => {
  let db: PGlite;
  let prismaBridge: any;
  let sql: TextArtifactSql;
  let port: TextJobTransactionPort;
  let repo: ReturnType<typeof createPostgresInteractionRepository>;

  beforeEach(async () => {
    vi.stubEnv('INTERACTION_COHORT_JOURNEY_ENABLED', '1');
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    vi.stubEnv('INTERACTION_PDF_ENABLED', '1');
    vi.stubEnv('INTERACTION_WEB_ENABLED', '1');
    vi.stubEnv('INTERACTION_YOUTUBE_ENABLED', '1');
    vi.stubEnv('INTERACTION_YOUTUBE_TEST_MOCK', '1');

    db = await createTestDb();
    prismaBridge = createPrismaBridge(db);
    state.db = db;
    state.prisma = prismaBridge;

    sql = {
      query: async (statement, parameters) => db.query<Record<string, unknown>>(statement, parameters),
    };

    port = {
      transaction: async <T>(work: (tx: TextArtifactSql) => Promise<T>): Promise<T> =>
        db.transaction(tx => work({ query: (s, p) => tx.query<Record<string, unknown>>(s, p) })),
    };

    repo = createPostgresInteractionRepository(prismaBridge);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (db) {
      await db.close();
    }
  });

  async function commit(
    workspaceId: string,
    ownerId: string,
    action: CohortAction,
    entityVersions: Array<{ kind: string; id: string; version: number }> = []
  ) {
    const wsRow = (await db.query<any>('SELECT snapshot, revision FROM interaction_workspaces WHERE id=$1', [workspaceId])).rows[0];
    const revision = Number(wsRow.revision);
    return repo.commitAction({
      workspaceId,
      ownerId,
      expectedRevision: revision,
      requestId: randomUUID(),
      envelope: {
        actionId: randomUUID(),
        workspaceId,
        expectedRevision: revision,
        entityVersions,
        action,
      },
      plan: cohortDomain.plan,
    });
  }

  async function setupMaterialWorkspace(ownerId: string, prompt = 'Learn Distributed Consensus') {
    const intakeReceipt = await acceptCohortIntake(
      ownerId,
      { requestId: randomUUID(), prompt },
      prismaBridge
    );
    const workspaceId = intakeReceipt.workspaceId;

    // Simulate recommendations having completed before user creates own cohort:
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
    await db.query(`DELETE FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" LIKE 'journey:%'`, [workspaceId]);

    // 1. recommendations -> starting_point
    await commit(workspaceId, ownerId, { type: 'create_own_cohort' });

    // 2. starting_point -> material_input (branch: have_material)
    await commit(workspaceId, ownerId, { type: 'choose_starting_point', choice: 'have_material' });

    return workspaceId;
  }

  it('1. Material collection before processing: retains sources with processing idle, queues 0 text jobs', async () => {
    const ownerId = 'owner-alice';
    const workspaceId = await setupMaterialWorkspace(ownerId);

    // Initial check: material_input, have_material, processingStarted = false, processing.status = idle
    let wsRow = (await db.query<any>('SELECT snapshot FROM interaction_workspaces WHERE id=$1', [workspaceId])).rows[0];
    let ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);
    expect(ws.journey?.step).toBe('material_input');
    expect(ws.journey?.branch).toBe('have_material');
    expect(ws.journey?.processingStarted).toBe(false);
    expect(ws.processing.status).toBe('idle');
    expect(ws.sources).toHaveLength(0);

    // 1. Add Text Source
    await commit(workspaceId, ownerId, {
      type: 'add_text_source',
      sourceId: 'src-text',
      label: 'Consensus Overview',
      text: 'Safety and liveness in asynchronous consensus protocols.',
    });

    // 2. Add PDF Source (upload binary artifact first)
    const pdfBytes = sourcePdf(['Quorums overlap and ensure consensus.', 'Majorities prevent split decisions.']);
    const upload = await putTextArtifact(sql, {
      workspaceId,
      kind: 'source_input',
      inputFingerprint: 'a'.repeat(64),
      bytes: pdfBytes,
    });
    await commit(workspaceId, ownerId, {
      type: 'add_pdf_source',
      sourceId: 'src-pdf',
      label: 'Consensus Paper.pdf',
      uploadId: upload.id,
    });

    // 3. Add Web Source
    await commit(workspaceId, ownerId, {
      type: 'add_web_source',
      sourceId: 'src-web',
      label: 'Paxos Article',
      url: 'https://docs.example.org/paxos',
    });

    // 4. Add YouTube Source (with video_observation mode)
    await commit(workspaceId, ownerId, {
      type: 'add_youtube_source',
      sourceId: 'src-yt',
      label: 'Distributed Systems Lecture',
      url: videoUrl,
      mode: 'video_observation',
    });

    // Verify workspace snapshot: 4 sources retained, processing status remains idle
    wsRow = (await db.query<any>('SELECT snapshot FROM interaction_workspaces WHERE id=$1', [workspaceId])).rows[0];
    ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);
    expect(ws.sources).toHaveLength(4);
    expect(ws.journey?.processingStarted).toBe(false);
    expect(ws.processing.status).toBe('idle');
    expect(ws.sources.every(s => s.state === 'queued')).toBe(true);

    // Verify cohort_text_jobs: ZERO text DAG jobs (text:*) have been scheduled!
    const textDagJobs = (await db.query<any>(
      `SELECT "id", "jobKey", "stage" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" LIKE 'text:%'`,
      [workspaceId]
    )).rows;
    expect(textDagJobs).toHaveLength(0);
  });

  it('2. Explicit Continue (begin_material_processing) transitions processingStarted=true and queues full DAG', async () => {
    const ownerId = 'owner-bob';
    const workspaceId = await setupMaterialWorkspace(ownerId);

    // Add text source
    await commit(workspaceId, ownerId, {
      type: 'add_text_source',
      sourceId: 'src-text',
      label: 'Notes',
      text: 'Raft consensus notes and state machine replication.',
    });

    // Before continue: processingStarted = false, 0 text jobs
    let wsRow = (await db.query<any>('SELECT snapshot FROM interaction_workspaces WHERE id=$1', [workspaceId])).rows[0];
    let ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);
    expect(ws.journey?.processingStarted).toBe(false);

    // Explicit Continue
    await commit(workspaceId, ownerId, { type: 'begin_material_processing' });

    // After continue: processingStarted = true, step = processing, processing.status = queued
    wsRow = (await db.query<any>('SELECT snapshot FROM interaction_workspaces WHERE id=$1', [workspaceId])).rows[0];
    ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);
    expect(ws.journey?.step).toBe('processing');
    expect(ws.journey?.processingStarted).toBe(true);
    expect(ws.processing.status).toBe('queued');

    // Verify text DAG jobs are now scheduled in cohort_text_jobs
    const textDagJobs = (await db.query<any>(
      `SELECT "id", "jobKey", "stage", "status" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "jobKey" LIKE 'text:%'`,
      [workspaceId]
    )).rows;
    expect(textDagJobs.length).toBeGreaterThanOrEqual(4); // text source has acquisition, understanding, chunking, analysis + assembly
    expect(textDagJobs.every(j => j.status === 'queued')).toBe(true);
  });

  it('3. Real composed execution with runDurableTextJobTick for PDF, web, text, and video observation through all stages', async () => {
    const ownerId = 'owner-charlie';
    const workspaceId = await setupMaterialWorkspace(ownerId);

    // 1. Add Text Source
    await commit(workspaceId, ownerId, {
      type: 'add_text_source',
      sourceId: 'src-text',
      label: 'Consensus Overview',
      text: 'Safety and liveness in asynchronous networks. Fault tolerance via replicated logs.',
    });

    // 2. Add PDF Source
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

    // 3. Add Web Source
    await commit(workspaceId, ownerId, {
      type: 'add_web_source',
      sourceId: 'src-web',
      label: 'Paxos Web Docs',
      url: 'https://docs.example.org/paxos',
    });

    // 4. Add YouTube Video Observation Source
    await commit(workspaceId, ownerId, {
      type: 'add_youtube_source',
      sourceId: 'src-yt',
      label: 'Consensus Lecture',
      url: videoUrl,
      mode: 'video_observation',
    });

    // Trigger explicit Continue to queue all jobs
    await commit(workspaceId, ownerId, { type: 'begin_material_processing' });

    // Mock WebTransport for web source
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

    // Mock VideoObservationProvider for YouTube video observation
    const mockObs = createMockObservation();
    const observeVideo = vi.fn().mockResolvedValue(mockObs);
    const videoObservationProvider: VideoObservationProvider = { observeVideo };

    const loadWorkspace = async (wsId: string) => {
      const row = (await db.query<any>('SELECT snapshot FROM interaction_workspaces WHERE id=$1', [wsId])).rows[0];
      return typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
    };

    const tick = () =>
      runDurableTextJobTick({
        sql,
        transaction: port,
        workerId: 'composed-worker',
        leaseMs: 60_000,
        now: () => now,
        loadWorkspace,
        webTransport,
        videoObservationProvider,
      });

    // Tick through all jobs until idle
    let completed = 0;
    while (completed < 50) {
      const res = await tick();
      if (res.status === 'idle') break;
      expect(res.status).toBe('accepted');
      completed++;
    }

    // Verify all 4 sources went through DAG to assembly
    expect(completed).toBeGreaterThanOrEqual(15);
    expect(webOpen).toHaveBeenCalledOnce();
    expect(observeVideo).toHaveBeenCalledOnce();

    // Verify final workspace snapshot
    const finalWs = cohortWorkspaceSchema.parse(await loadWorkspace(workspaceId));
    expect(finalWs.processing.status).toBe('ready');
    expect(finalWs.processing.stage).toBe('done');
    expect(finalWs.lessons.length).toBeGreaterThan(0);

    // Verify PDF locations
    const pdfSource = finalWs.sources.find(s => s.id === 'src-pdf');
    expect(pdfSource).toBeDefined();
    expect(pdfSource?.locations?.map(l => l.page)).toEqual([1, 2]);

    // Verify Web source provenance
    const webSource = finalWs.sources.find(s => s.id === 'src-web');
    expect(webSource).toBeDefined();
    expect(webSource?.provenance?.finalUrl).toBe('https://docs.example.org/paxos');

    // Verify YouTube video observation provenance and extracted locations
    const ytSource = finalWs.sources.find(s => s.id === 'src-yt');
    expect(ytSource).toBeDefined();
    expect(ytSource?.provenance?.scope).toBe('video_observation');
    expect(ytSource?.locations?.length).toBe(2);
    expect(ytSource?.locations![0]).toMatchObject({
      startMs: 0,
      endMs: 60000,
    });

    // Verify lesson grounding to source chunks
    for (const lesson of finalWs.lessons) {
      expect(lesson.sourceChunkIds.length).toBeGreaterThan(0);
      for (const chunkId of lesson.sourceChunkIds) {
        const chunk = finalWs.chunks.find(c => c.id === chunkId);
        expect(chunk).toBeDefined();
      }
    }
  });

  it('4. Acquisition mode toggle (set_youtube_mode) increments source.version and supersedes obsolete text jobs', async () => {
    const ownerId = 'owner-diana';
    const workspaceId = await setupMaterialWorkspace(ownerId);

    // Add YouTube source in video_observation mode
    await commit(workspaceId, ownerId, {
      type: 'add_youtube_source',
      sourceId: 'src-yt',
      label: 'Consensus Talk',
      url: videoUrl,
      mode: 'video_observation',
    });

    // Start processing to queue text jobs for version 0
    await commit(workspaceId, ownerId, { type: 'begin_material_processing' });

    let wsRow = (await db.query<any>('SELECT snapshot FROM interaction_workspaces WHERE id=$1', [workspaceId])).rows[0];
    let ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);
    const initialSource = ws.sources.find(s => s.id === 'src-yt')!;
    expect(initialSource.version).toBe(0);
    expect(initialSource.input?.kind === 'youtube' && initialSource.input.mode).toBe('video_observation');

    // Query initial queued jobs for version 0
    const v0Jobs = (await db.query<any>(
      `SELECT "id", "jobKey", "sourceVersion", "status" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "sourceId" = 'src-yt'`,
      [workspaceId]
    )).rows;
    expect(v0Jobs.length).toBeGreaterThan(0);
    expect(v0Jobs.every(j => Number(j.sourceVersion) === 0)).toBe(true);

    // Switch mode to transcript: dispatches set_youtube_mode
    await commit(workspaceId, ownerId, {
      type: 'set_youtube_mode',
      sourceId: 'src-yt',
      mode: 'transcript',
      track: { id: 'en', language: 'en', kind: 'manual', translated: false },
    });

    // Check workspace snapshot: source.version incremented to 1, mode updated to transcript
    wsRow = (await db.query<any>('SELECT snapshot FROM interaction_workspaces WHERE id=$1', [workspaceId])).rows[0];
    ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);
    const updatedSource = ws.sources.find(s => s.id === 'src-yt')!;
    expect(updatedSource.version).toBe(1);
    expect(updatedSource.input?.kind === 'youtube' && updatedSource.input.mode).toBe('transcript');
    expect(updatedSource.retainedInputId).toBeUndefined();
    expect(updatedSource.extractionId).toBeUndefined();

    // Check cohort_text_jobs: old version 0 jobs are SUPERSEDED with fence bump!
    const supersededJobs = (await db.query<any>(
      `SELECT "id", "jobKey", "sourceVersion", "status", "fence" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "sourceId" = 'src-yt' AND "status" = 'superseded'`,
      [workspaceId]
    )).rows;
    expect(supersededJobs.length).toBeGreaterThan(0);
    expect(supersededJobs.every(j => Number(j.sourceVersion) === 0)).toBe(true);

    // New version 1 jobs are QUEUED
    const v1Jobs = (await db.query<any>(
      `SELECT "id", "jobKey", "sourceVersion", "status" FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "sourceId" = 'src-yt' AND "status" = 'queued'`,
      [workspaceId]
    )).rows;
    expect(v1Jobs.length).toBeGreaterThan(0);
    expect(v1Jobs.every(j => Number(j.sourceVersion) === 1)).toBe(true);
  });

  it('5. Re-running worker reuses accepted acquisition artifacts via retainedInputId without network calls', async () => {
    const ownerId = 'owner-evan';
    const workspaceId = await setupMaterialWorkspace(ownerId);

    // Add YouTube source with video_observation
    await commit(workspaceId, ownerId, {
      type: 'add_youtube_source',
      sourceId: 'src-yt',
      label: 'Consensus Talk',
      url: videoUrl,
      mode: 'video_observation',
    });

    await commit(workspaceId, ownerId, { type: 'begin_material_processing' });

    const mockObs = createMockObservation();
    const observeVideo = vi.fn().mockResolvedValue(mockObs);
    const videoObservationProvider: VideoObservationProvider = { observeVideo };

    const loadWorkspace = async (wsId: string) => {
      const row = (await db.query<any>('SELECT snapshot FROM interaction_workspaces WHERE id=$1', [wsId])).rows[0];
      return typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
    };

    // Run first tick: acquisition
    const t1 = await runDurableTextJobTick({
      sql,
      transaction: port,
      workerId: 'worker-reuse',
      leaseMs: 60_000,
      now: () => now,
      loadWorkspace,
      videoObservationProvider,
    });
    expect(t1.status).toBe('accepted');
    expect(observeVideo).toHaveBeenCalledTimes(1);

    // Check workspace: retainedInputId is now set on source
    let ws = cohortWorkspaceSchema.parse(await loadWorkspace(workspaceId));
    const retainedInputId = ws.sources[0].retainedInputId;
    expect(retainedInputId).toBeDefined();

    // Now verify that createTextSourceProcessor directly loads bytes from SQL via retainedInputId
    observeVideo.mockClear();
    const processor = createTextSourceProcessor({
      sql,
      loadWorkspace,
      videoObservationProvider,
    });

    const claimedAcquisition = (await db.query<any>(
      `SELECT * FROM "cohort_text_jobs" WHERE "workspaceId" = $1 AND "sourceId" = 'src-yt' AND "stage" = 'acquisition'`,
      [workspaceId]
    )).rows[0];

    const bytes = await processor({
      ...claimedAcquisition,
      sourceVersion: Number(claimedAcquisition.sourceVersion),
      attempts: Number(claimedAcquisition.attempts),
      fence: Number(claimedAcquisition.fence),
      dueAt: new Date(claimedAcquisition.dueAt),
      createdAt: new Date(claimedAcquisition.createdAt),
    });

    // Bytes match retained video observation
    const parsedStored = JSON.parse(Buffer.from(bytes).toString('utf8'));
    expect(parsedStored.format).toBe('youtube-video-observation-v1');
    expect(parsedStored.video.id).toBe(videoId);

    // Provider was NOT called because retainedInputId was present!
    expect(observeVideo).not.toHaveBeenCalled();
  });

  it('6. Stale acceptance rejection: mismatched fingerprint or version returns false', async () => {
    const ownerId = 'owner-fiona';
    const workspaceId = await setupMaterialWorkspace(ownerId);

    await commit(workspaceId, ownerId, {
      type: 'add_text_source',
      sourceId: 'src-text',
      label: 'Notes',
      text: 'Paxos prepare and accept messages.',
    });

    await commit(workspaceId, ownerId, { type: 'begin_material_processing' });

    // Claim the acquisition job
    const claimed = await claimTextJob(sql, 'test-worker', now, 60_000);
    expect(claimed).not.toBeNull();

    const artifact = await putTextArtifact(sql, {
      workspaceId,
      kind: 'source_raw',
      sourceId: 'src-text',
      sourceVersion: 0,
      inputFingerprint: claimed!.dependencyFingerprint,
      bytes: Buffer.from('Paxos prepare and accept messages.'),
    });

    // 1. Stale acceptance with mismatched sourceVersion returns false
    const staleVersionJob = {
      ...claimed!,
      sourceVersion: 999,
    };
    const acceptedWrongVersion = await acceptCurrentTextJob(port, staleVersionJob, artifact, now);
    expect(acceptedWrongVersion).toBe(false);

    // 2. Stale acceptance with mismatched dependencyFingerprint returns false
    const staleFpJob = {
      ...claimed!,
      dependencyFingerprint: 'completely-different-fingerprint',
    };
    const acceptedWrongFp = await acceptCurrentTextJob(port, staleFpJob, artifact, now);
    expect(acceptedWrongFp).toBe(false);

    // 3. Genuine matching job returns true
    const acceptedGenuine = await acceptCurrentTextJob(port, claimed!, artifact, now);
    expect(acceptedGenuine).toBe(true);
  });

  it('7. Contextual error recording on failed jobs: source.state=failed and processing status updated', async () => {
    const ownerId = 'owner-grace';
    const workspaceId = await setupMaterialWorkspace(ownerId);

    // Add web source
    await commit(workspaceId, ownerId, {
      type: 'add_web_source',
      sourceId: 'src-web-failing',
      label: 'Broken Site',
      url: 'https://docs.example.org/broken',
    });

    await commit(workspaceId, ownerId, { type: 'begin_material_processing' });

    // Claim acquisition job
    const claimed = await claimTextJob(sql, 'test-worker', now, 60_000);
    expect(claimed).not.toBeNull();
    expect(claimed?.sourceId).toBe('src-web-failing');

    // Fail the job with FETCH_FAILED
    const failed = await failCurrentTextJob(port, claimed!, 'FETCH_FAILED', now);
    expect(failed).toBe(true);

    // 1. Verify job row in cohort_text_jobs
    const jobRow = (await db.query<any>('SELECT status, "errorCode", attempts FROM cohort_text_jobs WHERE id = $1', [claimed!.id])).rows[0];
    expect(jobRow.status).toBe('failed');
    expect(jobRow.errorCode).toBe('FETCH_FAILED');

    // 2. Verify workspace snapshot projection
    const wsRow = (await db.query<any>('SELECT snapshot FROM interaction_workspaces WHERE id = $1', [workspaceId])).rows[0];
    const ws = cohortWorkspaceSchema.parse(typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot);

    const source = ws.sources.find(s => s.id === 'src-web-failing');
    expect(source).toBeDefined();
    expect(source?.state).toBe('failed');

    expect(ws.processing.status).toBe('failed');
    expect(ws.processing.error).toBe('FETCH_FAILED');

    const viewJob = ws.processing.jobs?.find(j => j.id === claimed!.id);
    expect(viewJob).toBeDefined();
    expect(viewJob?.status).toBe('failed');
    expect(viewJob?.error).toBe('FETCH_FAILED');
    expect(viewJob?.retryable).toBe(true);
  });
});
