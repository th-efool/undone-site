/**
 * Administrative controls and audited mutations for Canonical Cohort Builder.
 * Admin-only operations for intake toggles, model call pauses, specific job/run cancellation,
 * source capability toggles, and public release suspension.
 *
 * CRITICAL BOUNDARY:
 * These controls are strictly operator/admin operations and are NEVER exported
 * or exposed to model tools or the LLM context.
 */

export interface AdminSql {
  query: (statement: string, parameters?: unknown[]) => Promise<{ rows: any[] }>;
}

export type SourceCapabilityKey = 'pdf' | 'web' | 'youtube' | 'github';

export interface AdminAuditEntry {
  id: number;
  controlKey: string;
  oldValue: unknown;
  newValue: unknown;
  actorId: string;
  reason: string;
  createdAt: string;
}

export async function initAdminControlTables(sql: AdminSql): Promise<void> {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS "cohort_admin_controls" (
      "control_key" VARCHAR(64) PRIMARY KEY,
      "value" JSONB NOT NULL,
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_by" VARCHAR(128) NOT NULL,
      "reason" TEXT
    );

    CREATE TABLE IF NOT EXISTS "cohort_admin_control_audit" (
      "id" BIGSERIAL PRIMARY KEY,
      "control_key" VARCHAR(64) NOT NULL,
      "old_value" JSONB,
      "new_value" JSONB NOT NULL,
      "actor_id" VARCHAR(128) NOT NULL,
      "reason" TEXT NOT NULL,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS "idx_admin_audit_key_time"
      ON "cohort_admin_control_audit" ("control_key", "created_at" DESC);
  `);
}

export async function getAdminControl<T>(
  sql: AdminSql,
  key: string,
  defaultValue: T
): Promise<T> {
  const res = await sql.query(`
    SELECT "value" FROM "cohort_admin_controls"
    WHERE "control_key" = $1
  `, [key]);

  if (res.rows.length === 0 || res.rows[0].value === undefined) {
    return defaultValue;
  }
  return res.rows[0].value as T;
}

export async function setAdminControl<T>(
  sql: AdminSql,
  params: {
    key: string;
    value: T;
    actorId: string;
    reason: string;
    now?: Date;
  }
): Promise<void> {
  const now = params.now ?? new Date();

  // 1. Fetch current value for audit trail
  const currentRes = await sql.query(`
    SELECT "value" FROM "cohort_admin_controls"
    WHERE "control_key" = $1
  `, [params.key]);
  const oldValue = currentRes.rows[0]?.value ?? null;

  // 2. Upsert control value
  await sql.query(`
    INSERT INTO "cohort_admin_controls" ("control_key", "value", "updated_at", "updated_by", "reason")
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT ("control_key") DO UPDATE SET
      "value" = EXCLUDED."value",
      "updated_at" = EXCLUDED."updated_at",
      "updated_by" = EXCLUDED."updated_by",
      "reason" = EXCLUDED."reason"
  `, [
    params.key,
    JSON.stringify(params.value),
    now.toISOString(),
    params.actorId,
    params.reason,
  ]);

  // 3. Append immutable audit row
  await sql.query(`
    INSERT INTO "cohort_admin_control_audit" (
      "control_key", "old_value", "new_value", "actor_id", "reason", "created_at"
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    params.key,
    oldValue ? JSON.stringify(oldValue) : null,
    JSON.stringify(params.value),
    params.actorId,
    params.reason,
    now.toISOString(),
  ]);
}

// Typed convenience control functions
export async function isIntakeEnabled(sql: AdminSql): Promise<boolean> {
  return getAdminControl<boolean>(sql, 'intake_enabled', true);
}

export async function setIntakeEnabled(
  sql: AdminSql,
  params: { enabled: boolean; actorId: string; reason: string }
): Promise<void> {
  await setAdminControl(sql, {
    key: 'intake_enabled',
    value: params.enabled,
    actorId: params.actorId,
    reason: params.reason,
  });
}

export async function areModelCallsPaused(sql: AdminSql): Promise<boolean> {
  return getAdminControl<boolean>(sql, 'model_calls_paused', false);
}

export async function setModelCallsPaused(
  sql: AdminSql,
  params: { paused: boolean; actorId: string; reason: string }
): Promise<void> {
  await setAdminControl(sql, {
    key: 'model_calls_paused',
    value: params.paused,
    actorId: params.actorId,
    reason: params.reason,
  });
}

export async function isPublicReleaseSuspended(sql: AdminSql): Promise<boolean> {
  return getAdminControl<boolean>(sql, 'public_release_suspended', false);
}

export async function setPublicReleaseSuspended(
  sql: AdminSql,
  params: { suspended: boolean; actorId: string; reason: string }
): Promise<void> {
  await setAdminControl(sql, {
    key: 'public_release_suspended',
    value: params.suspended,
    actorId: params.actorId,
    reason: params.reason,
  });
}

export async function isSourceCapabilityEnabled(
  sql: AdminSql,
  capability: SourceCapabilityKey
): Promise<boolean> {
  return getAdminControl<boolean>(sql, `source_capability:${capability}`, true);
}

export async function setSourceCapabilityEnabled(
  sql: AdminSql,
  params: { capability: SourceCapabilityKey; enabled: boolean; actorId: string; reason: string }
): Promise<void> {
  await setAdminControl(sql, {
    key: `source_capability:${params.capability}`,
    value: params.enabled,
    actorId: params.actorId,
    reason: params.reason,
  });
}

/**
 * Administrative cancellation of a specific job or run.
 * Fences the in-flight item and prevents post-cancellation accepted mutations.
 */
export async function cancelWorkItem(
  sql: AdminSql,
  params: {
    type: 'job' | 'run';
    id: string;
    actorId: string;
    reason: string;
    now?: Date;
  }
): Promise<{ canceled: boolean; previousStatus: string }> {
  const now = params.now ?? new Date();

  if (params.type === 'job') {
    const res = await sql.query(`
      UPDATE "cohort_text_jobs"
      SET "status" = 'failed',
          "errorCode" = 'ADMIN_CANCELED',
          "updatedAt" = $1,
          "error" = $2
      WHERE "id" = $3 AND "status" IN ('queued', 'running')
      RETURNING "id"
    `, [now.toISOString(), `Admin canceled: ${params.reason}`, params.id]);

    const canceled = res.rows.length > 0;

    await sql.query(`
      INSERT INTO "cohort_admin_control_audit" (
        "control_key", "old_value", "new_value", "actor_id", "reason", "created_at"
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      `cancel_job:${params.id}`,
      JSON.stringify({ status: canceled ? 'active' : 'unknown' }),
      JSON.stringify({ status: 'failed', errorCode: 'ADMIN_CANCELED' }),
      params.actorId,
      params.reason,
      now.toISOString(),
    ]);

    return { canceled, previousStatus: canceled ? 'active' : 'terminal_or_missing' };
  } else {
    const res = await sql.query(`
      UPDATE "interaction_runs"
      SET "status" = 'failed',
          "error" = 'ADMIN_CANCELED',
          "settledAt" = $1,
          "budgetActual" = jsonb_set(
            COALESCE("budgetActual", '{}'::jsonb),
            '{status}',
            '"unknown_outcome_retained"'
          )
      WHERE "id" = $2 AND "status" IN ('pending', 'running')
      RETURNING "id"
    `, [now.toISOString(), params.id]);

    const canceled = res.rows.length > 0;

    await sql.query(`
      INSERT INTO "cohort_admin_control_audit" (
        "control_key", "old_value", "new_value", "actor_id", "reason", "created_at"
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      `cancel_run:${params.id}`,
      JSON.stringify({ status: canceled ? 'active' : 'unknown' }),
      JSON.stringify({ status: 'failed', error: 'ADMIN_CANCELED' }),
      params.actorId,
      params.reason,
      now.toISOString(),
    ]);

    return { canceled, previousStatus: canceled ? 'active' : 'terminal_or_missing' };
  }
}

export async function getAdminAuditLog(
  sql: AdminSql,
  limit: number = 50
): Promise<AdminAuditEntry[]> {
  const res = await sql.query(`
    SELECT "id", "control_key", "old_value", "new_value", "actor_id", "reason", "created_at"
    FROM "cohort_admin_control_audit"
    ORDER BY "created_at" DESC, "id" DESC
    LIMIT $1
  `, [limit]);

  return res.rows.map(row => ({
    id: Number(row.id),
    controlKey: String(row.control_key),
    oldValue: row.old_value,
    newValue: row.new_value,
    actorId: String(row.actor_id),
    reason: String(row.reason),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}
