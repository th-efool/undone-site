import 'server-only';
import { Prisma } from '@/generated/prisma/client';

export class UserBudgetExceededError extends Error {
  readonly code = 'BUDGET_EXHAUSTED';
  readonly retryable = true;
  readonly status = 429;
  constructor(message = 'Hourly assistant turn budget reached. Please try again later.') {
    super(message);
    this.name = 'UserBudgetExceededError';
  }
}

export class UserConcurrencyExceededError extends Error {
  readonly code = 'CONCURRENT_RUNS_EXCEEDED';
  readonly retryable = true;
  readonly status = 429;
  constructor(message = 'Concurrent run limit reached. Please wait for other active runs to finish.') {
    super(message);
    this.name = 'UserConcurrencyExceededError';
  }
}

export function maxUserConcurrentRuns(): number {
  const envVal = process.env.INTERACTION_MAX_USER_CONCURRENT_RUNS ?? process.env.MAX_USER_CONCURRENT_RUNS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return 2;
}

export function hourlyUserModelTurns(): number {
  const envVal = process.env.INTERACTION_HOURLY_USER_MODEL_TURNS ?? process.env.HOURLY_USER_MODEL_TURNS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return 50;
}

export interface ModelTurnReservation {
  resource: 'model_turn';
  key: string;
  units: number;
  estimatedTokens: number;
  reservedAt: string;
}

export interface ModelTurnSettlement {
  resource: 'model_turn';
  status: 'settled' | 'unknown_outcome_retained';
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  stepsCount?: number;
  units?: number;
  estimatedTokens?: number;
  error?: string | null;
  settledAt?: string;
  retainedAt?: string;
}

/**
 * Checks that the user has not exceeded their concurrent active runs ceiling across all workspaces.
 * Runs with status 'queued' or 'running' are counted.
 */
export async function checkUserConcurrency(
  tx: Prisma.TransactionClient,
  params: { userId: string; workspaceId?: string; limit?: number }
): Promise<number> {
  const limit = params.limit ?? maxUserConcurrentRuns();
  const rows = params.workspaceId
    ? await tx.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM "interaction_runs" r
        JOIN "interaction_workspaces" w ON w."id" = r."workspaceId"
        WHERE w."ownerId" = ${params.userId}
          AND r."status" IN ('queued', 'running')
          AND r."workspaceId" <> ${params.workspaceId}
      `
    : await tx.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM "interaction_runs" r
        JOIN "interaction_workspaces" w ON w."id" = r."workspaceId"
        WHERE w."ownerId" = ${params.userId}
          AND r."status" IN ('queued', 'running')
      `;
  const count = rows[0]?.count ?? 0;
  if (count >= limit) {
    throw new UserConcurrencyExceededError();
  }
  return count;
}

/**
 * Atomically reserves a model turn in the creation_budgets table for the user.
 * Returns reservation metadata to be attached to the InteractionRun record.
 */
export async function reserveModelTurnBudget(
  tx: Prisma.TransactionClient,
  params: { userId: string; workspaceId: string; runId?: string; now?: Date; limit?: number }
): Promise<ModelTurnReservation> {
  const now = params.now ?? new Date();
  const nowMs = now.getTime();
  const hour = Math.floor(nowMs / 3_600_000);
  const key = `user:${params.userId}:model_turn:${hour}`;
  const expiresAt = new Date((hour + 2) * 3_600_000);
  const limit = params.limit ?? hourlyUserModelTurns();

  const rows = await tx.$queryRaw<Array<{ used: number }>>`
    INSERT INTO "creation_budgets" ("key", "used", "expiresAt")
    VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET "used" = "creation_budgets"."used" + 1
    WHERE "creation_budgets"."used" < ${limit}
    RETURNING "used"
  `;

  if (!rows || rows.length === 0) {
    throw new UserBudgetExceededError();
  }

  return {
    resource: 'model_turn',
    key,
    units: 1,
    estimatedTokens: 2000,
    reservedAt: now.toISOString(),
  };
}

/**
 * Reconciles actual model usage against the reservation.
 * On failure or unknown outcome (worker crash, network abort, timeout),
 * conservatively retains the reservation without refunding spend.
 */
export function settleModelTurnBudget(params: {
  reservation: unknown;
  actualUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    stepsCount?: number;
  };
  error?: string | null;
  now?: Date;
}): ModelTurnSettlement {
  const now = params.now ?? new Date();
  const res = params.reservation as Partial<ModelTurnReservation> | null;

  if (params.actualUsage && !params.error) {
    return {
      resource: 'model_turn',
      status: 'settled',
      promptTokens: params.actualUsage.promptTokens ?? 0,
      completionTokens: params.actualUsage.completionTokens ?? 0,
      totalTokens: params.actualUsage.totalTokens ?? 0,
      stepsCount: params.actualUsage.stepsCount ?? 1,
      settledAt: now.toISOString(),
    };
  }

  // Conservative accounting for unknown provider outcome or error:
  // The reservation remains retained as spent rather than releasing/refunding unknown spend.
  return {
    resource: 'model_turn',
    status: 'unknown_outcome_retained',
    units: res?.units ?? 1,
    estimatedTokens: res?.estimatedTokens ?? 2000,
    error: params.error ?? 'UNKNOWN_OUTCOME',
    retainedAt: now.toISOString(),
  };
}

import type { TextArtifactSql } from './text-artifacts';
import { areModelCallsPaused } from './admin-controls';

export interface ReserveModelTurnBudgetSqlParams {
  userId: string;
  workspaceId: string;
  invocationKey?: string;
  now?: Date;
  limit?: number;
  skipPauseCheck?: boolean;
}

/**
 * Resolves the trusted workspace owner before model execution.
 * Fails closed if the workspace is missing, owner is empty, or database is unavailable.
 */
export async function resolveWorkspaceOwner(
  sql: TextArtifactSql,
  workspaceId: string
): Promise<string> {
  if (!workspaceId || typeof workspaceId !== 'string' || !workspaceId.trim()) {
    throw new Error('WORKSPACE_REQUIRED');
  }
  let res;
  try {
    res = await sql.query(
      `SELECT "ownerId" FROM "interaction_workspaces" WHERE "id" = $1`,
      [workspaceId]
    );
  } catch (err: any) {
    throw new Error(`ACCOUNTING_STORAGE_UNAVAILABLE: Failed to resolve workspace owner: ${err?.message || err}`);
  }
  const ownerId = res.rows[0]?.ownerId;
  if (!ownerId || typeof ownerId !== 'string' || !ownerId.trim()) {
    throw new Error('OWNER_REQUIRED');
  }
  return String(ownerId);
}

/**
 * Atomically reserves a model turn in creation_budgets using direct TextArtifactSql.
 * Assigns a persisted logical invocation identity tied to invocationKey.
 * Dedupes duplicate reservations restart-safely, enforces pause policy, and retains conservative spend.
 */
export async function reserveModelTurnBudgetSql(
  sql: TextArtifactSql,
  params: ReserveModelTurnBudgetSqlParams
): Promise<{
  reservation: ModelTurnReservation;
  isExistingReservation: boolean;
  release: (settlement?: {
    actualUsage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      stepsCount?: number;
    };
    error?: unknown;
  }) => Promise<void>;
}> {
  if (!params.userId || typeof params.userId !== 'string' || !params.userId.trim()) {
    throw new Error('OWNER_REQUIRED');
  }
  if (!params.workspaceId || typeof params.workspaceId !== 'string' || !params.workspaceId.trim()) {
    throw new Error('WORKSPACE_REQUIRED');
  }

  // 1. Model call pause check
  if (!params.skipPauseCheck) {
    let paused = false;
    try {
      paused = await areModelCallsPaused({
        query: (stmt, p) => sql.query(stmt, p ?? []),
      });
    } catch (err: any) {
      throw new Error(`ACCOUNTING_STORAGE_UNAVAILABLE: Failed to check model pause policy: ${err?.message || err}`);
    }
    if (paused) {
      throw new Error('MODEL_CALLS_PAUSED');
    }
  }

  const now = params.now ?? new Date();
  const nowMs = now.getTime();
  const hour = Math.floor(nowMs / 3_600_000);
  const userBudgetHourKey = `user:${params.userId}:model_turn:${hour}`;
  const expiresAt = new Date((hour + 2) * 3_600_000);
  const limit = params.limit ?? hourlyUserModelTurns();

  const invocationKey = params.invocationKey;

  // 2. Restart-safe deduplication on invocationKey
  if (invocationKey) {
    const invKey = `inv:${invocationKey}`;
    try {
      const existingInv = await sql.query(
        `SELECT "key", "used" FROM "creation_budgets" WHERE "key" = $1`,
        [invKey]
      );
      if (existingInv.rows && existingInv.rows.length > 0 && Number(existingInv.rows[0].used) >= 1) {
        // Already reserved for this exact invocation. Reuse without double-incrementing.
        const reservation: ModelTurnReservation = {
          resource: 'model_turn',
          key: userBudgetHourKey,
          units: 1,
          estimatedTokens: 2000,
          reservedAt: now.toISOString(),
        };
        return {
          reservation,
          isExistingReservation: true,
          release: async (settlement) => {
            if (settlement?.actualUsage && !settlement.error) {
              await sql.query(
                `UPDATE "creation_budgets" SET "used" = 2 WHERE "key" = $1`,
                [invKey]
              ).catch(() => undefined);
            }
          },
        };
      }
    } catch (err: any) {
      throw new Error(`ACCOUNTING_STORAGE_UNAVAILABLE: Failed to check invocation accounting: ${err?.message || err}`);
    }
  }

  // 3. Atomically reserve turn in user hourly budget
  let rows;
  try {
    rows = await sql.query(
      `INSERT INTO "creation_budgets" ("key", "used", "expiresAt")
       VALUES ($1, 1, $2)
       ON CONFLICT ("key") DO UPDATE SET "used" = "creation_budgets"."used" + 1
       WHERE "creation_budgets"."used" < $3
       RETURNING "used"`,
      [userBudgetHourKey, expiresAt, limit]
    );
  } catch (err: any) {
    throw new Error(`ACCOUNTING_STORAGE_UNAVAILABLE: Failed to reserve model budget: ${err?.message || err}`);
  }

  if (!rows.rows || rows.rows.length === 0) {
    throw new UserBudgetExceededError();
  }

  // 4. Record invocation identity record
  if (invocationKey) {
    const invKey = `inv:${invocationKey}`;
    try {
      await sql.query(
        `INSERT INTO "creation_budgets" ("key", "used", "expiresAt")
         VALUES ($1, 1, $2)
         ON CONFLICT ("key") DO NOTHING`,
        [invKey, expiresAt]
      );
    } catch (err: any) {
      throw new Error(`ACCOUNTING_STORAGE_UNAVAILABLE: Failed to record invocation: ${err?.message || err}`);
    }
  }

  const reservation: ModelTurnReservation = {
    resource: 'model_turn',
    key: userBudgetHourKey,
    units: 1,
    estimatedTokens: 2000,
    reservedAt: now.toISOString(),
  };

  let settled = false;
  return {
    reservation,
    isExistingReservation: false,
    release: async (settlement) => {
      if (settled) return;
      settled = true;
      if (invocationKey && settlement?.actualUsage && !settlement.error) {
        const invKey = `inv:${invocationKey}`;
        await sql.query(
          `UPDATE "creation_budgets" SET "used" = 2 WHERE "key" = $1`,
          [invKey]
        ).catch(() => undefined);
      }
      // Conservative spend is retained on error or crash (used stays 1)
    },
  };
}

/**
 * Creates a durable provider call hook attached to an exact provider call boundary.
 * Handles nested calls by tracking call ordinals, resolves owner, and fails closed.
 */
export function createDurableProviderCallHook(params: {
  sql: TextArtifactSql;
  workspaceId: string;
  jobKey: string;
  operation: string;
  generation?: number;
  attempt?: number;
  ownerId?: string;
  skipPauseCheck?: boolean;
}): () => Promise<void | (() => Promise<void>)> {
  let ordinal = 0;
  return async () => {
    ordinal += 1;
    const ownerId = params.ownerId ?? (await resolveWorkspaceOwner(params.sql, params.workspaceId));
    const invocationKey = `job:${params.jobKey}:op:${params.operation}:gen:${params.generation ?? 0}:att:${params.attempt ?? 0}:ord:${ordinal}`;
    const { release } = await reserveModelTurnBudgetSql(params.sql, {
      userId: ownerId,
      workspaceId: params.workspaceId,
      invocationKey,
      skipPauseCheck: params.skipPauseCheck,
    });
    return async () => {
      await release();
    };
  };
}

