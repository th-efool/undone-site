import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

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

import { acceptCohortIntake } from '../cohort-intake';
import { createPostgresInteractionRepository } from '../repositories/interaction.repo';
import { executeInteractionSlice } from '@/src/server/interaction.step';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

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

    CREATE TABLE IF NOT EXISTS "interaction_workflow_dispatches" (
      "id" TEXT PRIMARY KEY,
      "token" TEXT NOT NULL,
      "leaseUntil" TIMESTAMPTZ NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "creation_budgets" (
      "key" TEXT PRIMARY KEY,
      "used" INTEGER NOT NULL DEFAULT 0,
      "expiresAt" TIMESTAMP(3) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "cohort_text_artifacts" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "sourceId" TEXT,
      "sourceVersion" INTEGER,
      "kind" TEXT NOT NULL,
      "inputFingerprint" TEXT NOT NULL,
      "checksum" TEXT NOT NULL,
      "byteLength" INTEGER NOT NULL,
      "body" BYTEA NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "cohort_text_jobs" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "jobKey" TEXT NOT NULL,
      "sourceId" TEXT,
      "sourceVersion" INTEGER,
      "stage" TEXT NOT NULL,
      "handlerVersion" INTEGER NOT NULL DEFAULT 1,
      "dependencyFingerprint" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'queued',
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "fence" INTEGER NOT NULL DEFAULT 0,
      "leaseOwner" TEXT,
      "leaseToken" TEXT,
      "leaseUntil" TIMESTAMP(3),
      "resultArtifactId" TEXT,
      "errorCode" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "cohort_text_jobs_workspace_key_uq" UNIQUE ("workspaceId", "jobKey")
    );

    CREATE TABLE IF NOT EXISTS "cohort_text_job_edges" (
      "workspaceId" TEXT NOT NULL,
      "jobId" TEXT NOT NULL,
      "prerequisiteId" TEXT NOT NULL,
      CONSTRAINT "cohort_text_job_edges_pkey" PRIMARY KEY ("workspaceId", "jobId", "prerequisiteId")
    );

    ALTER TABLE "cohort_text_artifacts" DROP CONSTRAINT IF EXISTS "cohort_text_artifacts_kind_ck";
    ALTER TABLE "cohort_text_artifacts" ADD CONSTRAINT "cohort_text_artifacts_kind_ck"
      CHECK ("kind" IN ('source_input', 'source_raw', 'extraction', 'understanding', 'chunks', 'analysis', 'assembly', 'recommendations', 'discovery'));

    ALTER TABLE "cohort_text_jobs" DROP CONSTRAINT IF EXISTS "cohort_text_jobs_stage_ck";
    ALTER TABLE "cohort_text_jobs" ADD CONSTRAINT "cohort_text_jobs_stage_ck"
      CHECK ("stage" IN ('acquisition', 'extraction', 'understanding', 'chunking', 'analysis', 'assembly', 'recommendations', 'discovery'));
  `);
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

describe('Cohort Intake and Worker Journey Integration', () => {
  const ownerId = 'user-journey-tester';

  beforeEach(async () => {
    vi.stubEnv('INTERACTION_COHORT_JOURNEY_ENABLED', '1');
    vi.stubEnv('INTERACTION_TEXT_DRIVER', 'durable');
    state.db = await createTestDb();
    state.prisma = createPrismaBridge(state.db);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (state.db) {
      await state.db.close();
      state.db = null;
    }
    state.prisma = null;
  });

  it('1. initial intake creates workspace in journey.step = recommendations, processingStarted = false', async () => {
    const requestId = crypto.randomUUID();
    const result = await acceptCohortIntake(ownerId, { requestId, prompt: 'Learn Distributed Systems' }, state.prisma);
    expect(result.workspaceId).toBeDefined();

    const wsRow = (await state.db!.query<any>(`SELECT snapshot FROM interaction_workspaces WHERE id = $1`, [result.workspaceId])).rows[0];
    const snapshot: CohortWorkspace = typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot;

    expect(snapshot.journey).toBeDefined();
    expect(snapshot.journey?.version).toBe(1);
    expect(snapshot.journey?.step).toBe('recommendations');
    expect(snapshot.journey?.processingStarted).toBe(false);
    expect(snapshot.journey?.branch).toBeNull();
    expect(snapshot.journey?.intentVersion).toBe(0);
    expect(snapshot.intent).toBe('Learn Distributed Systems');
  });

  it('2. initial intake appends user message but DOES NOT schedule an assistant interaction_run', async () => {
    const requestId = crypto.randomUUID();
    const result = await acceptCohortIntake(ownerId, { requestId, prompt: 'Learn Distributed Systems' }, state.prisma);

    // Verify user message is retained
    const msgRows = (await state.db!.query<any>(`SELECT * FROM interaction_messages WHERE "workspaceId" = $1`, [result.workspaceId])).rows;
    expect(msgRows).toHaveLength(1);
    expect(msgRows[0].role).toBe('user');
    const parts = typeof msgRows[0].parts === 'string' ? JSON.parse(msgRows[0].parts) : msgRows[0].parts;
    expect(parts[0].text).toBe('Learn Distributed Systems');

    // CRITICAL: NO assistant interaction_run created
    const runRows = (await state.db!.query<any>(`SELECT * FROM interaction_runs WHERE "workspaceId" = $1`, [result.workspaceId])).rows;
    expect(runRows).toHaveLength(0);

    // Verify scheduling suppression was recorded
    const suppressionRows = (await state.db!.query<any>(
      `SELECT * FROM interaction_requests WHERE "workspaceId" = $1 AND operation = 'assistantSchedulingSuppressed'`,
      [result.workspaceId]
    )).rows;
    expect(suppressionRows).toHaveLength(1);
  });

  it('3. initial intake with source retains source but does NOT start source DAG', async () => {
    const requestId = crypto.randomUUID();
    const result = await acceptCohortIntake(
      ownerId,
      {
        requestId,
        prompt: 'Learn Distributed Systems',
        source: { label: 'Raft Paper', text: 'In Search of an Understandable Consensus Algorithm' },
      },
      state.prisma
    );

    const wsRow = (await state.db!.query<any>(`SELECT snapshot FROM interaction_workspaces WHERE id = $1`, [result.workspaceId])).rows[0];
    const snapshot: CohortWorkspace = typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot;

    // Source is retained in queued state
    expect(snapshot.sources).toHaveLength(1);
    expect(snapshot.sources[0].label).toBe('Raft Paper');
    expect(snapshot.sources[0].text).toBe('In Search of an Understandable Consensus Algorithm');
    expect(snapshot.sources[0].state).toBe('queued');

    // Journey is still not started
    expect(snapshot.journey?.processingStarted).toBe(false);

    // Processing status remains idle
    expect(snapshot.processing.status).toBe('idle');

    // CRITICAL: NO source DAG text jobs (jobKey LIKE 'text:%') are inserted
    const textJobRows = (await state.db!.query<any>(
      `SELECT * FROM cohort_text_jobs WHERE "workspaceId" = $1 AND "jobKey" LIKE 'text:%'`,
      [result.workspaceId]
    )).rows;
    expect(textJobRows).toHaveLength(0);
  });

  it('4. initial intake queues journey:recommendations job', async () => {
    const requestId = crypto.randomUUID();
    const result = await acceptCohortIntake(ownerId, { requestId, prompt: 'Learn Distributed Systems' }, state.prisma);

    const journeyJobRows = (await state.db!.query<any>(
      `SELECT * FROM cohort_text_jobs WHERE "workspaceId" = $1 AND "jobKey" LIKE 'journey:%'`,
      [result.workspaceId]
    )).rows;

    expect(journeyJobRows).toHaveLength(1);
    const job = journeyJobRows[0];
    expect(job.jobKey).toBe('journey:recommendations:0');
    expect(job.stage).toBe('recommendations');
    expect(job.status).toBe('queued');
    expect(job.attempts).toBe(0);
    expect(job.sourceId).toBeNull();
    expect(job.sourceVersion).toBeNull();
  });

  it('5. subsequent user message sent after intake DOES schedule an assistant run', async () => {
    const requestId = crypto.randomUUID();
    const result = await acceptCohortIntake(ownerId, { requestId, prompt: 'Initial prompt' }, state.prisma);

    // Verify 0 runs initially
    let runRows = (await state.db!.query<any>(`SELECT * FROM interaction_runs WHERE "workspaceId" = $1`, [result.workspaceId])).rows;
    expect(runRows).toHaveLength(0);

    // Creator sends a subsequent normal chat message (without scheduleAssistant: false)
    const repo = createPostgresInteractionRepository(state.prisma);
    const subsequentMessageId = crypto.randomUUID();
    const appendResult = await repo.appendMessage({
      id: subsequentMessageId,
      workspaceId: result.workspaceId,
      ownerId,
      role: 'user',
      parts: [{ type: 'text', text: 'Can you tailor this for senior engineers?' }],
      requestId: 'subsequent-user-msg-1',
    });

    // An assistant run is scheduled now!
    expect(appendResult.run).toBeDefined();
    expect(appendResult.run?.status).toBe('queued');

    runRows = (await state.db!.query<any>(`SELECT * FROM interaction_runs WHERE "workspaceId" = $1`, [result.workspaceId])).rows;
    expect(runRows).toHaveLength(1);
    expect(runRows[0].status).toBe('queued');
    expect(runRows[0].triggeringMessageId).toBe(subsequentMessageId);
  });

  it('6. worker pending work predicate recognizes queued journey job as runnable work', async () => {
    const requestId = crypto.randomUUID();
    const result = await acceptCohortIntake(ownerId, { requestId, prompt: 'Learn Distributed Systems' }, state.prisma);

    // Seed the dispatch token in interaction_workflow_dispatches
    const token = 'test-workflow-token-123';
    await state.db!.query(
      `INSERT INTO interaction_workflow_dispatches (id, token, "leaseUntil") VALUES ('cohort-queue', $1, CURRENT_TIMESTAMP + interval '5 minutes')`,
      [token]
    );

    // Initial state: NO interaction_runs exist, but 1 journey:recommendations job is queued
    const slicePending = await executeInteractionSlice(token);
    expect(slicePending).toBe(true);

    // Dispatch reservation is NOT deleted because runnable work exists
    const dispatchRows = (await state.db!.query<any>(
      `SELECT * FROM interaction_workflow_dispatches WHERE id = 'cohort-queue'`
    )).rows;
    expect(dispatchRows).toHaveLength(1);

    // When the journey job completes/is accepted, no pending work remains
    await state.db!.query(`UPDATE cohort_text_jobs SET status = 'accepted' WHERE "workspaceId" = $1`, [result.workspaceId]);

    // Next slice execution: no pending runs, no runnable jobs -> returns false and cleans dispatch
    const sliceFinished = await executeInteractionSlice(token);
    expect(sliceFinished).toBe(false);

    const clearedDispatches = (await state.db!.query<any>(
      `SELECT * FROM interaction_workflow_dispatches WHERE id = 'cohort-queue'`
    )).rows;
    expect(clearedDispatches).toHaveLength(0);
  });

  it('7. deduplication returns cached response and rejects payload mismatch', async () => {
    const requestId = crypto.randomUUID();
    const first = await acceptCohortIntake(ownerId, { requestId, prompt: 'Learn Distributed Systems' }, state.prisma);
    const replay = await acceptCohortIntake(ownerId, { requestId, prompt: 'Learn Distributed Systems' }, state.prisma);
    expect(replay.workspaceId).toBe(first.workspaceId);

    // Mismatched payload with same requestId throws IDEMPOTENCY_MISMATCH
    await expect(
      acceptCohortIntake(ownerId, { requestId, prompt: 'Different prompt content' }, state.prisma)
    ).rejects.toThrow('IDEMPOTENCY_MISMATCH');
  });

  it('8. preserves legacy behavior when journey is disabled', async () => {
    vi.stubEnv('INTERACTION_COHORT_JOURNEY_ENABLED', '0');

    const requestId = crypto.randomUUID();
    const result = await acceptCohortIntake(
      ownerId,
      {
        requestId,
        prompt: 'Legacy prompt',
        source: { label: 'Legacy Source', text: 'Legacy content to process' },
      },
      state.prisma
    );

    const wsRow = (await state.db!.query<any>(`SELECT snapshot FROM interaction_workspaces WHERE id = $1`, [result.workspaceId])).rows[0];
    const snapshot: CohortWorkspace = typeof wsRow.snapshot === 'string' ? JSON.parse(wsRow.snapshot) : wsRow.snapshot;

    // Journey is undefined in legacy mode
    expect(snapshot.journey).toBeUndefined();

    // Assistant run IS scheduled immediately on intake
    const runRows = (await state.db!.query<any>(`SELECT * FROM interaction_runs WHERE "workspaceId" = $1`, [result.workspaceId])).rows;
    expect(runRows).toHaveLength(1);
    expect(runRows[0].status).toBe('queued');

    // Source DAG IS enqueued immediately
    const textJobRows = (await state.db!.query<any>(
      `SELECT * FROM cohort_text_jobs WHERE "workspaceId" = $1 AND "jobKey" LIKE 'text:%'`,
      [result.workspaceId]
    )).rows;
    expect(textJobRows.length).toBeGreaterThan(0);

    // NO journey jobs are queued
    const journeyJobRows = (await state.db!.query<any>(
      `SELECT * FROM cohort_text_jobs WHERE "workspaceId" = $1 AND "jobKey" LIKE 'journey:%'`,
      [result.workspaceId]
    )).rows;
    expect(journeyJobRows).toHaveLength(0);
  });
});
