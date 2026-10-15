/**
 * Safe, read-only operational diagnostics for Interaction Worker & Durable Text Pipeline.
 * Zero secret disclosure: excludes conversation prompts, source texts, tokens, and credentials.
 * Provides operator visibility into queue backlogs, oldest work, lease recovery, and failed jobs.
 */
import { Pool } from 'pg';
import { textDriver } from './text-driver';
import { assertTextJobSchema } from './text-schema-readiness';

export interface DiagnosticsSql {
  query: (statement: string, parameters?: unknown[]) => Promise<{ rows: any[] }>;
}

export interface QueueBacklogSummary {
  jobs: {
    queued: number;
    running: number;
    failed: number;
    accepted: number;
    total: number;
  };
  runs: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    total: number;
  };
}

export interface OldestWorkItem {
  id: string;
  workspaceId: string;
  stage?: string;
  status: string;
  attempts?: number;
  leaseOwner?: string | null;
  ageSeconds: number;
}

export interface FailedJobSummary {
  id: string;
  workspaceId: string;
  stage: string;
  errorCode: string | null;
  attempts: number;
  updatedAt: string;
}

export interface LeaseRecoverySummary {
  expiredRunningJobs: number;
  exhaustedRetryJobs: number;
  multiFenceJobs: number;
}

export interface WorkerDiagnosticsReport {
  timestamp: string;
  driver: 'snapshot' | 'durable';
  schemaStatus: 'ready' | 'incomplete' | 'unsupported_handler';
  backlog: QueueBacklogSummary;
  oldestQueuedJob: OldestWorkItem | null;
  oldestRunningJob: OldestWorkItem | null;
  leaseRecovery: LeaseRecoverySummary;
  recentFailedJobs: FailedJobSummary[];
}

export async function collectWorkerDiagnostics(sql: DiagnosticsSql, now: Date = new Date()): Promise<WorkerDiagnosticsReport> {
  const driver = textDriver();
  let schemaStatus: 'ready' | 'incomplete' | 'unsupported_handler' = 'ready';

  try {
    await assertTextJobSchema(sql);
  } catch (err: any) {
    schemaStatus = err.message === 'S3_HANDLER_VERSION_UNSUPPORTED'
      ? 'unsupported_handler'
      : 'incomplete';
  }

  // 1. Queue Backlog Summary
  const jobStatsRes = await sql.query(`
    SELECT
      COUNT(*) FILTER (WHERE "status" = 'queued')::int AS queued,
      COUNT(*) FILTER (WHERE "status" = 'running')::int AS running,
      COUNT(*) FILTER (WHERE "status" = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE "status" = 'accepted')::int AS accepted,
      COUNT(*)::int AS total
    FROM "cohort_text_jobs"
  `);
  const jobRow = jobStatsRes.rows[0] ?? { queued: 0, running: 0, failed: 0, accepted: 0, total: 0 };

  const runStatsRes = await sql.query(`
    SELECT
      COUNT(*) FILTER (WHERE "status" = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE "status" = 'running')::int AS running,
      COUNT(*) FILTER (WHERE "status" = 'completed')::int AS completed,
      COUNT(*) FILTER (WHERE "status" = 'failed')::int AS failed,
      COUNT(*)::int AS total
    FROM "interaction_runs"
  `);
  const runRow = runStatsRes.rows[0] ?? { pending: 0, running: 0, completed: 0, failed: 0, total: 0 };

  // 2. Oldest Queued & Running Work
  const oldestQueuedRes = await sql.query(`
    SELECT "id", "workspaceId", "stage", "status", "attempts",
      EXTRACT(EPOCH FROM ($1::timestamp - "dueAt"))::int AS "ageSeconds"
    FROM "cohort_text_jobs"
    WHERE "status" = 'queued'
    ORDER BY "dueAt" ASC, "createdAt" ASC
    LIMIT 1
  `, [now.toISOString()]);
  const oldestQueued = oldestQueuedRes.rows[0]
    ? {
        id: String(oldestQueuedRes.rows[0].id),
        workspaceId: String(oldestQueuedRes.rows[0].workspaceId),
        stage: String(oldestQueuedRes.rows[0].stage),
        status: String(oldestQueuedRes.rows[0].status),
        attempts: Number(oldestQueuedRes.rows[0].attempts),
        ageSeconds: Math.max(0, Number(oldestQueuedRes.rows[0].ageSeconds)),
      }
    : null;

  const oldestRunningRes = await sql.query(`
    SELECT "id", "workspaceId", "stage", "status", "leaseOwner",
      EXTRACT(EPOCH FROM ($1::timestamp - "updatedAt"))::int AS "ageSeconds"
    FROM "cohort_text_jobs"
    WHERE "status" = 'running'
    ORDER BY "updatedAt" ASC
    LIMIT 1
  `, [now.toISOString()]);
  const oldestRunning = oldestRunningRes.rows[0]
    ? {
        id: String(oldestRunningRes.rows[0].id),
        workspaceId: String(oldestRunningRes.rows[0].workspaceId),
        stage: String(oldestRunningRes.rows[0].stage),
        status: String(oldestRunningRes.rows[0].status),
        leaseOwner: oldestRunningRes.rows[0].leaseOwner ? String(oldestRunningRes.rows[0].leaseOwner) : null,
        ageSeconds: Math.max(0, Number(oldestRunningRes.rows[0].ageSeconds)),
      }
    : null;

  // 3. Lease Recovery Metrics
  const leaseMetricsRes = await sql.query(`
    SELECT
      COUNT(*) FILTER (WHERE "status" = 'running' AND "leaseUntil" < $1::timestamp)::int AS "expiredRunning",
      COUNT(*) FILTER (WHERE "status" = 'failed' AND "errorCode" = 'RETRY_EXHAUSTED')::int AS "exhaustedRetries",
      COUNT(*) FILTER (WHERE "fence" > 1)::int AS "multiFence"
    FROM "cohort_text_jobs"
  `, [now.toISOString()]);
  const leaseRow = leaseMetricsRes.rows[0] ?? { expiredRunning: 0, exhaustedRetries: 0, multiFence: 0 };

  // 4. Recent Failed Jobs (Bounded, sanitized)
  const failedJobsRes = await sql.query(`
    SELECT "id", "workspaceId", "stage", "errorCode", "attempts", "updatedAt"
    FROM "cohort_text_jobs"
    WHERE "status" = 'failed'
    ORDER BY "updatedAt" DESC
    LIMIT 10
  `);
  const recentFailedJobs: FailedJobSummary[] = failedJobsRes.rows.map(row => ({
    id: String(row.id),
    workspaceId: String(row.workspaceId),
    stage: String(row.stage),
    errorCode: row.errorCode ? String(row.errorCode) : null,
    attempts: Number(row.attempts),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }));

  return {
    timestamp: now.toISOString(),
    driver,
    schemaStatus,
    backlog: {
      jobs: {
        queued: Number(jobRow.queued),
        running: Number(jobRow.running),
        failed: Number(jobRow.failed),
        accepted: Number(jobRow.accepted),
        total: Number(jobRow.total),
      },
      runs: {
        pending: Number(runRow.pending),
        running: Number(runRow.running),
        completed: Number(runRow.completed),
        failed: Number(runRow.failed),
        total: Number(runRow.total),
      },
    },
    oldestQueuedJob: oldestQueued,
    oldestRunningJob: oldestRunning,
    leaseRecovery: {
      expiredRunningJobs: Number(leaseRow.expiredRunning),
      exhaustedRetryJobs: Number(leaseRow.exhaustedRetries),
      multiFenceJobs: Number(leaseRow.multiFence),
    },
    recentFailedJobs,
  };
}

export function formatDiagnosticsReport(report: WorkerDiagnosticsReport): string {
  const lines: string[] = [
    `=== Interaction Worker Operational Diagnostics ===`,
    `Timestamp: ${report.timestamp}`,
    `Driver: ${report.driver.toUpperCase()} | Schema Status: ${report.schemaStatus.toUpperCase()}`,
    ``,
    `--- Queue Backlog ---`,
    `Durable Jobs : ${report.backlog.jobs.queued} queued | ${report.backlog.jobs.running} running | ${report.backlog.jobs.failed} failed | ${report.backlog.jobs.accepted} accepted (Total: ${report.backlog.jobs.total})`,
    `Assistant Runs: ${report.backlog.runs.pending} pending | ${report.backlog.runs.running} running | ${report.backlog.runs.failed} failed | ${report.backlog.runs.completed} completed (Total: ${report.backlog.runs.total})`,
    ``,
    `--- In-Flight Age ---`,
    report.oldestQueuedJob
      ? `Oldest Queued Job : ${report.oldestQueuedJob.id} (${report.oldestQueuedJob.stage}, ${report.oldestQueuedJob.ageSeconds}s old, ${report.oldestQueuedJob.attempts} attempts)`
      : `Oldest Queued Job : None (queue empty)`,
    report.oldestRunningJob
      ? `Oldest Running Job: ${report.oldestRunningJob.id} (${report.oldestRunningJob.stage}, ${report.oldestRunningJob.ageSeconds}s old, worker: ${report.oldestRunningJob.leaseOwner})`
      : `Oldest Running Job: None (no active claims)`,
    ``,
    `--- Lease & Recovery Metrics ---`,
    `Expired Running Jobs (Eligible for Reclaim) : ${report.leaseRecovery.expiredRunningJobs}`,
    `Jobs with Exhausted Retries               : ${report.leaseRecovery.exhaustedRetryJobs}`,
    `Jobs Re-Fenced After Prior Lease Expiration : ${report.leaseRecovery.multiFenceJobs}`,
  ];

  if (report.recentFailedJobs.length > 0) {
    lines.push(``, `--- Recent Failed Jobs (Last ${report.recentFailedJobs.length}) ---`);
    for (const f of report.recentFailedJobs) {
      lines.push(`- Job ${f.id} [${f.stage}] workspace=${f.workspaceId} attempts=${f.attempts} error=${f.errorCode ?? 'UNKNOWN'} at=${f.updatedAt}`);
    }
  } else {
    lines.push(``, `Recent Failed Jobs: None`);
  }

  return lines.join('\n');
}
