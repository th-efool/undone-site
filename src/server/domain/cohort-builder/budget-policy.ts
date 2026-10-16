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

/**
 * Atomically reserves a model turn in creation_budgets using direct TextArtifactSql.
 * Returns reservation and a release function to be called on completion.
 */
export async function reserveModelTurnBudgetSql(
  sql: TextArtifactSql,
  params: { userId: string; workspaceId: string; now?: Date; limit?: number }
): Promise<{ reservation: ModelTurnReservation; release: () => Promise<void> }> {
  const now = params.now ?? new Date();
  const nowMs = now.getTime();
  const hour = Math.floor(nowMs / 3_600_000);
  const key = `user:${params.userId}:model_turn:${hour}`;
  const expiresAt = new Date((hour + 2) * 3_600_000);
  const limit = params.limit ?? hourlyUserModelTurns();

  const rows = await sql.query(
    `INSERT INTO "creation_budgets" ("key", "used", "expiresAt")
     VALUES ($1, 1, $2)
     ON CONFLICT ("key") DO UPDATE SET "used" = "creation_budgets"."used" + 1
     WHERE "creation_budgets"."used" < $3
     RETURNING "used"`,
    [key, expiresAt, limit]
  );

  if (!rows.rows || rows.rows.length === 0) {
    throw new UserBudgetExceededError();
  }

  const reservation: ModelTurnReservation = {
    resource: 'model_turn',
    key,
    units: 1,
    estimatedTokens: 2000,
    reservedAt: now.toISOString(),
  };

  let released = false;
  return {
    reservation,
    release: async () => {
      if (released) return;
      released = true;
    },
  };
}
