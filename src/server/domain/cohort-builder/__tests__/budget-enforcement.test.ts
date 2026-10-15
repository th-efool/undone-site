import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import {
  checkUserConcurrency,
  reserveModelTurnBudget,
  settleModelTurnBudget,
  UserBudgetExceededError,
  UserConcurrencyExceededError,
} from '../budget-policy';
import { createPostgresInteractionRepository } from '@/src/server/infrastructure/db/postgres/repositories/interaction.repo';
import { executeAssistantTurn } from '@/src/server/interaction.runtime';

async function setupBudgetTestDb() {
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
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_runs" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL REFERENCES "interaction_workspaces"("id") ON DELETE CASCADE,
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

    CREATE TABLE IF NOT EXISTS "interaction_outbox" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "payload" JSONB NOT NULL,
      "dedupKey" TEXT NOT NULL UNIQUE,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "attempts" INT NOT NULL DEFAULT 0,
      "dueAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "leaseOwner" TEXT,
      "leaseToken" TEXT,
      "leaseUntil" TIMESTAMP,
      "deliveredAt" TIMESTAMP,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_events" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "sequence" INT NOT NULL,
      "protocolVersion" INT DEFAULT 1,
      "type" TEXT NOT NULL,
      "revision" INT,
      "payload" JSONB NOT NULL,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_messages" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "parts" JSONB NOT NULL,
      "sequence" INT NOT NULL,
      "runId" TEXT,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS "interaction_requests" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "actorId" TEXT NOT NULL,
      "operation" TEXT NOT NULL,
      "requestId" TEXT NOT NULL,
      "payloadHash" TEXT NOT NULL,
      "response" JSONB NOT NULL,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "interaction_requests_uq" UNIQUE ("workspaceId", "actorId", "operation", "requestId")
    );

    CREATE TABLE IF NOT EXISTS "interaction_steps" (
      "id" TEXT PRIMARY KEY,
      "runId" TEXT NOT NULL REFERENCES "interaction_runs"("id") ON DELETE CASCADE,
      "ordinal" INT NOT NULL,
      "kind" TEXT NOT NULL,
      "toolName" TEXT,
      "inputHash" TEXT,
      "inputPayload" JSONB,
      "state" TEXT NOT NULL DEFAULT 'started',
      "result" JSONB,
      "error" TEXT,
      "effectKey" TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "interaction_steps_uq" UNIQUE ("runId", "ordinal")
    );

    CREATE TABLE IF NOT EXISTS "creation_budgets" (
      "key" TEXT PRIMARY KEY,
      "used" INT NOT NULL DEFAULT 0,
      "expiresAt" TIMESTAMP NOT NULL
    );
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
        return res.rows[0] ?? null;
      },
      findUnique: async ({ where }: any) => {
        const res = await db.query('SELECT * FROM "interaction_workspaces" WHERE "id" = $1', [where.id]);
        return res.rows[0] ?? null;
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
        return res.rows[0];
      },
      update: async ({ where, data }: any) => {
        const sets: string[] = [];
        const vals: any[] = [];
        for (const [k, v] of Object.entries(data)) {
          vals.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v);
          sets.push(`"${k}" = $${vals.length}`);
        }
        vals.push(where.id);
        const res = await db.query(
          `UPDATE "interaction_workspaces" SET ${sets.join(', ')} WHERE "id" = $${vals.length} RETURNING *`,
          vals
        );
        return res.rows[0];
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
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
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
    interactionEvent: {
      create: async ({ data }: any) => {
        await db.query(
          `INSERT INTO "interaction_events" ("id", "workspaceId", "sequence", "protocolVersion", "type", "revision", "payload")
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            data.id,
            data.workspaceId,
            data.sequence,
            data.protocolVersion ?? 1,
            data.type,
            data.revision ?? null,
            JSON.stringify(data.payload),
          ]
        );
        return data;
      },
    },
    interactionRequest: {
      findUnique: async () => null,
      create: async () => ({}),
    },
  };

  return bridge as any;
}

describe('S6 Checkpoint 2: Server-Enforced Budgets, Quotas and Admission Control', () => {
  it('enforces per-user concurrency ceiling across multiple workspaces', async () => {
    const db = await setupBudgetTestDb();
    const prisma = createPrismaBridge(db);

    const userA = 'user-alice';
    const userB = 'user-bob';

    // Seed 2 workspaces for Alice and 1 for Bob
    await db.query(
      `INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "snapshot")
       VALUES ('ws-alice-1', $1, 'cohort', '{}'), ('ws-alice-2', $1, 'cohort', '{}'), ('ws-bob-1', $2, 'cohort', '{}')`,
      [userA, userB]
    );

    // Alice starts run in ws-alice-1 (concurrency = 1)
    await db.query(
      `INSERT INTO "interaction_runs" ("id", "workspaceId", "status") VALUES ('run-a1', 'ws-alice-1', 'running')`
    );

    // Alice starts run in ws-alice-2 (concurrency = 2, ceiling reached with limit=2)
    await db.query(
      `INSERT INTO "interaction_runs" ("id", "workspaceId", "status") VALUES ('run-a2', 'ws-alice-2', 'queued')`
    );

    // Attempting a 3rd run for Alice across another workspace fails closed
    await expect(
      checkUserConcurrency(prisma, { userId: userA, limit: 2 })
    ).rejects.toThrow(UserConcurrencyExceededError);

    // Tenant Isolation: Bob is NOT affected by Alice's concurrency saturation
    const bobActive = await checkUserConcurrency(prisma, { userId: userB, limit: 2 });
    expect(bobActive).toBe(0);

    // When Alice's run-a1 finishes, her concurrency decreases and allows new admission
    await db.query(`UPDATE "interaction_runs" SET "status" = 'completed' WHERE "id" = 'run-a1'`);
    const aliceActiveAfterCompletion = await checkUserConcurrency(prisma, { userId: userA, limit: 2 });
    expect(aliceActiveAfterCompletion).toBe(1);
  });

  it('atomically reserves budget units without oversubscription under parallel race conditions', async () => {
    const db = await setupBudgetTestDb();
    const prisma = createPrismaBridge(db);
    const userId = 'user-parallel';
    const workspaceId = 'ws-parallel';

    await db.query(
      `INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "snapshot")
       VALUES ($1, $2, 'cohort', '{}')`,
      [workspaceId, userId]
    );

    // Configured hourly limit = 3
    const limit = 3;
    const now = new Date('2026-10-15T12:00:00Z');

    // 5 parallel reservation attempts race simultaneously
    const results = await Promise.allSettled(
      Array.from({ length: 5 }).map((_, i) =>
        reserveModelTurnBudget(prisma, {
          userId,
          workspaceId,
          runId: `run-${i}`,
          limit,
          now,
        })
      )
    );

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // Exactly 3 succeed, exactly 2 are rejected
    expect(fulfilled.length).toBe(3);
    expect(rejected.length).toBe(2);

    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(UserBudgetExceededError);
      expect((r as PromiseRejectedResult).reason.code).toBe('BUDGET_EXHAUSTED');
      expect((r as PromiseRejectedResult).reason.status).toBe(429);
      expect((r as PromiseRejectedResult).reason.retryable).toBe(true);
    }

    // Direct database verification of creation_budgets row
    const budgetRows = await db.query(`SELECT "used" FROM "creation_budgets" WHERE "key" LIKE $1`, [`user:${userId}:model_turn:%`]);
    expect((budgetRows.rows[0] as any).used).toBe(3);
  });

  it('settles actual token usage accurately when provider reporting is present', () => {
    const reservation = {
      resource: 'model_turn',
      key: 'user:123:model_turn:497',
      units: 1,
      estimatedTokens: 2000,
      reservedAt: '2026-10-15T12:00:00.000Z',
    };

    const actualUsage = {
      promptTokens: 350,
      completionTokens: 120,
      totalTokens: 470,
      stepsCount: 2,
    };

    const settlement = settleModelTurnBudget({
      reservation,
      actualUsage,
      now: new Date('2026-10-15T12:00:05.000Z'),
    });

    expect(settlement).toEqual({
      resource: 'model_turn',
      status: 'settled',
      promptTokens: 350,
      completionTokens: 120,
      totalTokens: 470,
      stepsCount: 2,
      settledAt: '2026-10-15T12:00:05.000Z',
    });
  });

  it('conservatively retains spend on worker failure or unknown provider outcome without false refund', () => {
    const reservation = {
      resource: 'model_turn',
      key: 'user:123:model_turn:497',
      units: 1,
      estimatedTokens: 2000,
      reservedAt: '2026-10-15T12:00:00.000Z',
    };

    // Worker died / network dropped / model timed out
    const settlement = settleModelTurnBudget({
      reservation,
      error: 'TIMEOUT_ABORTED',
      now: new Date('2026-10-15T12:00:45.000Z'),
    });

    expect(settlement).toEqual({
      resource: 'model_turn',
      status: 'unknown_outcome_retained',
      units: 1,
      estimatedTokens: 2000,
      error: 'TIMEOUT_ABORTED',
      retainedAt: '2026-10-15T12:00:45.000Z',
    });
  });

  it('scheduleRun, completeRun, failRun and cancelRun enforce end-to-end budget integrity', async () => {
    const db = await setupBudgetTestDb();
    const prisma = createPrismaBridge(db);
    const repo = createPostgresInteractionRepository(prisma);

    const ownerId = 'user-e2e';
    const workspaceId = 'ws-e2e';

    await db.query(
      `INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "snapshot", "revision", "sequence", "lifecycle")
       VALUES ($1, $2, 'cohort', '{}', 0, 0, 'active')`,
      [workspaceId, ownerId]
    );

    // 1. scheduleRun attaches atomic budgetReservation
    const run = await repo.scheduleRun({
      workspaceId,
      ownerId,
    });

    expect(run.status).toBe('queued');
    expect(run.budgetReservation).toBeDefined();
    expect((run.budgetReservation as any)?.resource).toBe('model_turn');
    expect((run.budgetReservation as any)?.estimatedTokens).toBe(2000);

    // 2. Claim run and complete with settled tokens
    const claimToken = 'lease-token-123';
    await db.query(
      `UPDATE "interaction_runs"
       SET "status" = 'running', "leaseOwner" = 'worker-1', "leaseToken" = $1, "leaseUntil" = $2
       WHERE "id" = $3`,
      [claimToken, new Date(Date.now() + 600_000), run.id]
    );

    const completed = await repo.completeRun({
      runId: run.id,
      leaseToken: claimToken,
      assistantMessageId: 'msg-asst-1',
      budgetActual: {
        resource: 'model_turn',
        status: 'settled',
        promptTokens: 410,
        completionTokens: 90,
        totalTokens: 500,
        stepsCount: 1,
        settledAt: new Date().toISOString(),
      },
    });

    expect(completed).toBe(true);

    const runAfterComplete = await db.query(
      `SELECT "status", "budgetActual" FROM "interaction_runs" WHERE "id" = $1`,
      [run.id]
    );
    const completeRow = runAfterComplete.rows[0] as any;
    expect(completeRow.status).toBe('completed');
    const actual = typeof completeRow.budgetActual === 'string'
      ? JSON.parse(completeRow.budgetActual)
      : completeRow.budgetActual;
    expect(actual.status).toBe('settled');
    expect(actual.totalTokens).toBe(500);

    // 3. Second run: test failure with conservative accounting
    const run2 = await repo.scheduleRun({
      workspaceId,
      ownerId,
    });

    const claimToken2 = 'lease-token-456';
    await db.query(
      `UPDATE "interaction_runs"
       SET "status" = 'running', "leaseOwner" = 'worker-1', "leaseToken" = $1, "leaseUntil" = $2
       WHERE "id" = $3`,
      [claimToken2, new Date(Date.now() + 60_000), run2.id]
    );

    const failed = await repo.failRun({
      runId: run2.id,
      leaseToken: claimToken2,
      error: 'MODEL_TIMEOUT',
    });

    expect(failed).toBe(true);

    const run2AfterFail = await db.query(
      `SELECT "status", "budgetActual" FROM "interaction_runs" WHERE "id" = $1`,
      [run2.id]
    );
    const failRow = run2AfterFail.rows[0] as any;
    expect(failRow.status).toBe('failed');
    const actual2 = typeof failRow.budgetActual === 'string'
      ? JSON.parse(failRow.budgetActual)
      : failRow.budgetActual;
    expect(actual2.status).toBe('unknown_outcome_retained');
    expect(actual2.error).toBe('MODEL_TIMEOUT');

    // 4. Third run: cancelRun retains conservative spend rather than zeroing
    const run3 = await repo.scheduleRun({
      workspaceId,
      ownerId,
    });

    const canceled = await repo.cancelRun({
      runId: run3.id,
      workspaceId,
      ownerId,
      reason: 'User stopped generation',
    });

    expect(canceled).toBe(true);

    const run3AfterCancel = await db.query(
      `SELECT "status", "budgetActual" FROM "interaction_runs" WHERE "id" = $1`,
      [run3.id]
    );
    const cancelRow = run3AfterCancel.rows[0] as any;
    expect(cancelRow.status).toBe('canceled');
    const actual3 = typeof cancelRow.budgetActual === 'string'
      ? JSON.parse(cancelRow.budgetActual)
      : cancelRow.budgetActual;
    expect(actual3.status).toBe('unknown_outcome_retained');
    expect(actual3.error).toBe('User stopped generation');
  });

  it('translates quota and concurrency rejections into truthful HTTP 429 responses in executeAssistantTurn', async () => {
    const { postgresInteractionRepo } = await import('@/src/server/infrastructure/db/postgres/repositories/interaction.repo');
    const spy = vi.spyOn(postgresInteractionRepo, 'scheduleRun');

    try {
      spy.mockRejectedValueOnce(
        new UserConcurrencyExceededError('Concurrent run limit reached. Please wait for other active runs to finish.')
      );

      const resp = await executeAssistantTurn('user-1', 'ws-1');
      expect(resp.status).toBe(429);
      expect((resp.body as any).code).toBe('CONCURRENT_RUNS_EXCEEDED');
      expect((resp.body as any).retryable).toBe(true);

      // Now test UserBudgetExceededError
      spy.mockRejectedValueOnce(
        new UserBudgetExceededError('Hourly assistant turn budget reached. Please try again later.')
      );

      const respBudget = await executeAssistantTurn('user-1', 'ws-1');
      expect(respBudget.status).toBe(429);
      expect((respBudget.body as any).code).toBe('BUDGET_EXHAUSTED');
      expect((respBudget.body as any).retryable).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('preserves completed tool step records and journals when a run is canceled mid-flight', async () => {
    const db = await setupBudgetTestDb();
    const prisma = createPrismaBridge(db);
    const repo = createPostgresInteractionRepository(prisma);

    const ownerId = 'user-steps';
    const workspaceId = 'ws-steps';

    await db.query(
      `INSERT INTO "interaction_workspaces" ("id", "ownerId", "domainId", "snapshot", "revision", "sequence", "lifecycle")
       VALUES ($1, $2, 'cohort', '{}', 0, 0, 'active')`,
      [workspaceId, ownerId]
    );

    const run = await repo.scheduleRun({ workspaceId, ownerId });

    // Insert a completed step into interaction_steps
    await db.query(
      `INSERT INTO "interaction_steps" ("id", "runId", "ordinal", "kind", "toolName", "state", "result")
       VALUES ('step-1', $1, 1, 'tool_call', 'update_overview', 'completed', '{"success":true}')`,
      [run.id]
    );

    // Cancel run
    const canceled = await repo.cancelRun({
      runId: run.id,
      workspaceId,
      ownerId,
      reason: 'User canceled during step 2',
    });
    expect(canceled).toBe(true);

    // Step 1 MUST still be in the database with state: 'completed' (not deleted or corrupted)
    const stepRows = await db.query(
      `SELECT "id", "state", "result" FROM "interaction_steps" WHERE "id" = 'step-1'`
    );
    expect(stepRows.rows.length).toBe(1);
    expect((stepRows.rows[0] as any).state).toBe('completed');
  });

  it('prioritizes interactive assistant runs over bulk text candidates in worker loop to prevent starvation', async () => {
    const events: string[] = [];

    const fakeRepo = {
      claimRun: vi.fn(async () => {
        events.push('claimRun');
        return null;
      }),
    };

    const candidatesFn = vi.fn(async () => {
      events.push('textWorkspaceCandidates');
      return [];
    });

    const ac = new AbortController();
    const { runInteractionWorkerLoop } = await import('@/src/server/interaction-worker');

    // Run 1 tick then abort
    const loopPromise = runInteractionWorkerLoop(
      {
        repo: fakeRepo as any,
        workerId: 'test-priority-worker',
        pollIntervalMs: 50,
        textWorkspaceCandidates: candidatesFn,
        supervisionSql: null,
        durable: null,
      },
      ac.signal
    );

    await new Promise(resolve => setTimeout(resolve, 80));
    ac.abort();
    await loopPromise;

    // claimRun MUST be called first before textWorkspaceCandidates
    expect(events[0]).toBe('claimRun');
    expect(events[1]).toBe('textWorkspaceCandidates');
  });
});
