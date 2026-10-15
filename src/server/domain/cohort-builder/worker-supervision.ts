/**
 * Worker supervision, heartbeat tracking, and liveness detection.
 * Separates reliable worker liveness from "a job currently holds a lease".
 * Detects stale/crashed workers, missing-worker conditions, and bounded queue growth.
 */
import { hostname as osHostname } from 'node:os';

export interface SupervisionSql {
  query: (statement: string, parameters?: unknown[]) => Promise<{ rows: any[] }>;
}

export type WorkerStatus = 'active' | 'draining' | 'stopped';

export interface WorkerHeartbeatRecord {
  workerId: string;
  driver: string;
  hostname: string;
  pid: number;
  startedAt: string;
  lastHeartbeatAt: string;
  status: WorkerStatus;
  activeClaimsCount: number;
  metadata?: Record<string, unknown>;
}

export interface WorkerSupervisionReport {
  activeWorkers: WorkerHeartbeatRecord[];
  staleWorkers: WorkerHeartbeatRecord[];
  activeWorkerCount: number;
  staleWorkerCount: number;
  isAvailable: boolean;
  oldestHeartbeatAgeSeconds: number | null;
}

export async function initWorkerSupervisionTables(sql: SupervisionSql): Promise<void> {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS "interaction_worker_heartbeats" (
      "worker_id" VARCHAR(128) PRIMARY KEY,
      "driver" VARCHAR(64) NOT NULL DEFAULT 'durable',
      "hostname" VARCHAR(256) NOT NULL,
      "pid" INT NOT NULL,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "last_heartbeat_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "status" VARCHAR(32) NOT NULL DEFAULT 'active',
      "active_claims_count" INT NOT NULL DEFAULT 0,
      "metadata" JSONB
    );

    CREATE INDEX IF NOT EXISTS "idx_worker_heartbeats_status_time"
      ON "interaction_worker_heartbeats" ("status", "last_heartbeat_at");
  `);
}

export async function recordWorkerHeartbeat(
  sql: SupervisionSql,
  params: {
    workerId: string;
    driver?: string;
    hostname?: string;
    pid?: number;
    status?: WorkerStatus;
    activeClaimsCount?: number;
    metadata?: Record<string, unknown>;
    now?: Date;
  }
): Promise<void> {
  const driver = params.driver ?? 'durable';
  const hostname = params.hostname ?? osHostname();
  const pid = params.pid ?? process.pid;
  const status = params.status ?? 'active';
  const activeClaimsCount = params.activeClaimsCount ?? 0;
  const metadata = params.metadata ? JSON.stringify(params.metadata) : null;
  const now = params.now ?? new Date();

  await sql.query(`
    INSERT INTO "interaction_worker_heartbeats" (
      "worker_id", "driver", "hostname", "pid", "started_at", "last_heartbeat_at", "status", "active_claims_count", "metadata"
    ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8)
    ON CONFLICT ("worker_id") DO UPDATE SET
      "driver" = EXCLUDED."driver",
      "hostname" = EXCLUDED."hostname",
      "pid" = EXCLUDED."pid",
      "last_heartbeat_at" = EXCLUDED."last_heartbeat_at",
      "status" = EXCLUDED."status",
      "active_claims_count" = EXCLUDED."active_claims_count",
      "metadata" = COALESCE(EXCLUDED."metadata", "interaction_worker_heartbeats"."metadata")
  `, [
    params.workerId,
    driver,
    hostname,
    pid,
    now.toISOString(),
    status,
    activeClaimsCount,
    metadata,
  ]);
}

export async function deregisterWorker(
  sql: SupervisionSql,
  params: {
    workerId: string;
    status?: 'draining' | 'stopped';
    now?: Date;
  }
): Promise<void> {
  const status = params.status ?? 'stopped';
  const now = params.now ?? new Date();

  await sql.query(`
    UPDATE "interaction_worker_heartbeats"
    SET "status" = $1, "last_heartbeat_at" = $2
    WHERE "worker_id" = $3
  `, [status, now.toISOString(), params.workerId]);
}

export async function collectWorkerSupervision(
  sql: SupervisionSql,
  options: {
    now?: Date;
    staleThresholdMs?: number;
  } = {}
): Promise<WorkerSupervisionReport> {
  const now = options.now ?? new Date();
  const staleThresholdMs = options.staleThresholdMs ?? 30_000;
  const cutoff = new Date(now.getTime() - staleThresholdMs);

  const res = await sql.query(`
    SELECT
      "worker_id", "driver", "hostname", "pid",
      "started_at", "last_heartbeat_at", "status", "active_claims_count", "metadata",
      EXTRACT(EPOCH FROM ($1::timestamp - "last_heartbeat_at"))::int AS "age_seconds"
    FROM "interaction_worker_heartbeats"
    WHERE "status" IN ('active', 'draining')
    ORDER BY "last_heartbeat_at" DESC
  `, [now.toISOString()]);

  const activeWorkers: WorkerHeartbeatRecord[] = [];
  const staleWorkers: WorkerHeartbeatRecord[] = [];
  let oldestHeartbeatAgeSeconds: number | null = null;

  for (const row of res.rows) {
    const ageSeconds = Math.max(0, Number(row.age_seconds));
    const lastHeartbeat = new Date(row.last_heartbeat_at);
    const item: WorkerHeartbeatRecord = {
      workerId: String(row.worker_id),
      driver: String(row.driver),
      hostname: String(row.hostname),
      pid: Number(row.pid),
      startedAt: new Date(row.started_at).toISOString(),
      lastHeartbeatAt: lastHeartbeat.toISOString(),
      status: row.status as WorkerStatus,
      activeClaimsCount: Number(row.active_claims_count),
      metadata: row.metadata ?? undefined,
    };

    if (lastHeartbeat >= cutoff && row.status === 'active') {
      activeWorkers.push(item);
      if (oldestHeartbeatAgeSeconds === null || ageSeconds > oldestHeartbeatAgeSeconds) {
        oldestHeartbeatAgeSeconds = ageSeconds;
      }
    } else {
      staleWorkers.push(item);
    }
  }

  return {
    activeWorkers,
    staleWorkers,
    activeWorkerCount: activeWorkers.length,
    staleWorkerCount: staleWorkers.length,
    isAvailable: activeWorkers.length > 0,
    oldestHeartbeatAgeSeconds,
  };
}

/**
 * Validates bounded queue growth when no workers are active.
 * Throws 503 WORKER_UNAVAILABLE when queue limit is exceeded.
 */
export async function assertAdmissionQueueCapacity(
  sql: SupervisionSql,
  options: {
    maxQueuedJobsWithoutWorker?: number;
    now?: Date;
  } = {}
): Promise<{ admitted: boolean; queuedCount: number; workerAvailable: boolean }> {
  const maxQueued = options.maxQueuedJobsWithoutWorker ?? 50;
  const supervision = await collectWorkerSupervision(sql, options);

  if (supervision.isAvailable) {
    return { admitted: true, queuedCount: 0, workerAvailable: true };
  }

  // No active workers. Check current queued jobs count.
  const res = await sql.query(`
    SELECT COUNT(*)::int AS count
    FROM "cohort_text_jobs"
    WHERE "status" = 'queued'
  `);
  const queuedCount = Number(res.rows[0]?.count ?? 0);

  if (queuedCount >= maxQueued) {
    const error = new Error(`WORKER_UNAVAILABLE: No active workers and queued backlog reached limit of ${maxQueued}`);
    (error as any).code = 'WORKER_UNAVAILABLE';
    (error as any).status = 503;
    (error as any).retryable = true;
    throw error;
  }

  return { admitted: true, queuedCount, workerAvailable: false };
}
