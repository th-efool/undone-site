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
  return 500;
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

export interface ProviderCallSettlementInput {
  actualUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    stepsCount?: number;
  };
  error?: unknown;
}

export type ReleaseProviderCall = (settlement?: ProviderCallSettlementInput) => Promise<void>;

export interface ReserveModelTurnBudgetSqlParams {
  userId: string;
  workspaceId: string;
  invocationKey?: string;
  jobKey?: string;
  dependencyFingerprint?: string;
  operation?: string;
  attempt?: number;
  ordinal?: number;
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
 * Atomically reserves a model turn in creation_budgets and cohort_model_invocations using a single SQL statement.
 * Assigns a persisted logical invocation identity tied to invocationKey.
 * Dedupes duplicate reservations across concurrent connections without double-counting,
 * enforces pause policy, and retains conservative spend when outcome is uncertain.
 */
export async function reserveModelTurnBudgetSql(
  sql: TextArtifactSql,
  params: ReserveModelTurnBudgetSqlParams
): Promise<{
  reservation: ModelTurnReservation;
  isExistingReservation: boolean;
  release: ReleaseProviderCall;
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

  let isExistingReservation = false;

  if (invocationKey) {
    const invBudgetKey = `inv:${invocationKey}`;
    try {
      await sql.query(
        `INSERT INTO "creation_budgets" ("key", "used", "expiresAt")
         VALUES ($1, 0, $2)
         ON CONFLICT ("key") DO NOTHING`,
        [userBudgetHourKey, expiresAt]
      );

      const atomicRes = await sql.query(
        `WITH budget_lock AS (
           SELECT "used"
           FROM "creation_budgets"
           WHERE "key" = $10
           FOR UPDATE
         ),
         claimed_inv AS (
           INSERT INTO "cohort_model_invocations" (
             "invocationKey", "workspaceId", "ownerId", "jobKey", "dependencyFingerprint",
             "operation", "attempt", "ordinal", "status", "createdAt"
           )
           SELECT $1, $2, $3, $4, $5, $6, $7, $8, 'reserved', $9
           FROM budget_lock
           WHERE budget_lock."used" < $12
           ON CONFLICT ("invocationKey") DO NOTHING
           RETURNING "invocationKey"
         ),
         budget_step AS (
           UPDATE "creation_budgets"
           SET "used" = "creation_budgets"."used" + 1
           FROM claimed_inv
           WHERE "creation_budgets"."key" = $10
           RETURNING "creation_budgets"."used" AS "used"
         ),
         compat_inv AS (
           INSERT INTO "creation_budgets" ("key", "used", "expiresAt")
           SELECT $13, 1, $11
           FROM claimed_inv
           ON CONFLICT ("key") DO NOTHING
           RETURNING "key"
         )
         SELECT
           (SELECT "used" FROM budget_lock) AS "lockedUsed",
           EXISTS (SELECT 1 FROM claimed_inv) AS "wasInserted",
           (SELECT "used" FROM budget_step) AS "budgetUsed"`,
        [
          invocationKey,
          params.workspaceId,
          params.userId,
          params.jobKey ?? null,
          params.dependencyFingerprint ?? null,
          params.operation ?? null,
          params.attempt ?? 0,
          params.ordinal ?? 1,
          now,
          userBudgetHourKey,
          expiresAt,
          limit,
          invBudgetKey,
        ]
      );

      const row = atomicRes.rows?.[0];
      const wasInserted = Boolean(row?.wasInserted);
      const lockedUsed = row?.lockedUsed !== null && row?.lockedUsed !== undefined ? Number(row.lockedUsed) : 0;

      if (wasInserted) {
        isExistingReservation = false;
      } else {
        const checkExisting = await sql.query(
          `SELECT "invocationKey" FROM "cohort_model_invocations" WHERE "invocationKey" = $1`,
          [invocationKey]
        );
        if (checkExisting.rows && checkExisting.rows.length > 0) {
          isExistingReservation = true;
        } else if (lockedUsed >= limit) {
          throw new UserBudgetExceededError();
        } else {
          throw new UserBudgetExceededError();
        }
      }
    } catch (err: any) {
      if (err instanceof UserBudgetExceededError || err?.code === 'BUDGET_EXHAUSTED') {
        throw err;
      }
      throw new Error(`ACCOUNTING_STORAGE_UNAVAILABLE: Failed to reserve model invocation budget: ${err?.message || err}`);
    }
  } else {
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
    isExistingReservation,
    release: async (settlement) => {
      if (settled) return;
      settled = true;
      if (!invocationKey) return;

      const invBudgetKey = `inv:${invocationKey}`;
      const settledAt = new Date();
      if (settlement?.actualUsage && !settlement.error) {
        const promptTokens = Number.isFinite(settlement.actualUsage.promptTokens)
          ? Math.max(0, Math.trunc(Number(settlement.actualUsage.promptTokens)))
          : 0;
        const completionTokens = Number.isFinite(settlement.actualUsage.completionTokens)
          ? Math.max(0, Math.trunc(Number(settlement.actualUsage.completionTokens)))
          : 0;
        const totalTokens = Number.isFinite(settlement.actualUsage.totalTokens)
          ? Math.max(0, Math.trunc(Number(settlement.actualUsage.totalTokens)))
          : promptTokens + completionTokens;
        const stepsCount = Number.isFinite(settlement.actualUsage.stepsCount)
          ? Math.max(1, Math.trunc(Number(settlement.actualUsage.stepsCount)))
          : 1;

        await sql.query(
          `WITH update_inv AS (
             UPDATE "cohort_model_invocations"
             SET "status" = 'settled',
                 "promptTokens" = $2,
                 "completionTokens" = $3,
                 "totalTokens" = $4,
                 "stepsCount" = $5,
                 "error" = NULL,
                 "settledAt" = $6
             WHERE "invocationKey" = $1
           )
           UPDATE "creation_budgets"
           SET "used" = 2
           WHERE "key" = $7`,
          [invocationKey, promptTokens, completionTokens, totalTokens, stepsCount, settledAt, invBudgetKey]
        ).catch(() => undefined);
      } else {
        const errMessage = settlement?.error
          ? (settlement.error instanceof Error ? settlement.error.message : String(settlement.error)).slice(0, 500)
          : 'UNKNOWN_OUTCOME';
        await sql.query(
          `UPDATE "cohort_model_invocations"
           SET "status" = CASE WHEN "status" = 'settled' THEN 'settled' ELSE 'unknown_outcome_retained' END,
               "error" = CASE WHEN "status" = 'settled' THEN "error" ELSE $2 END,
               "settledAt" = COALESCE("settledAt", $3)
           WHERE "invocationKey" = $1`,
          [invocationKey, errMessage, settledAt]
        ).catch(() => undefined);
      }
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
  dependencyFingerprint?: string;
  operation: string;
  generation?: number;
  attempt?: number;
  ownerId?: string;
  skipPauseCheck?: boolean;
}): () => Promise<ReleaseProviderCall> {
  let ordinal = 0;
  return async () => {
    ordinal += 1;
    const currentOrdinal = ordinal;
    const ownerId = params.ownerId ?? (await resolveWorkspaceOwner(params.sql, params.workspaceId));
    const fpSegment = params.dependencyFingerprint ? `:fp:${params.dependencyFingerprint}` : '';
    const invocationKey = `job:${params.jobKey}${fpSegment}:op:${params.operation}:gen:${params.generation ?? 0}:att:${params.attempt ?? 0}:ord:${currentOrdinal}`;
    const { release } = await reserveModelTurnBudgetSql(params.sql, {
      userId: ownerId,
      workspaceId: params.workspaceId,
      invocationKey,
      jobKey: params.jobKey,
      dependencyFingerprint: params.dependencyFingerprint,
      operation: params.operation,
      attempt: params.attempt ?? 0,
      ordinal: currentOrdinal,
      skipPauseCheck: params.skipPauseCheck,
    });
    return async (settlement?: ProviderCallSettlementInput) => {
      await release(settlement);
    };
  };
}


