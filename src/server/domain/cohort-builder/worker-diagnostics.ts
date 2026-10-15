/**
 * Safe, read-only operational diagnostics for Interaction Worker & Durable Text Pipeline.
 * Zero secret disclosure: excludes conversation prompts, source texts, tokens, and credentials.
 * Provides operator visibility into queue backlogs, oldest work, lease recovery, failed jobs,
 * worker supervision heartbeats, outbox latency, budget accounting, and releases.
 */
import { textDriver } from './text-driver';
import { assertTextJobSchema } from './text-schema-readiness';
import { collectWorkerSupervision, type WorkerSupervisionReport } from './worker-supervision';

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

export interface OutboxLagSummary {
  totalEvents: number;
  oldestEventAgeSeconds: number | null;
}

export interface BudgetAccountingSummary {
  totalReservations: number;
  settledCount: number;
  retainedCount: number;
}

export interface ReleaseStatsSummary {
  privateCount: number;
  publicCount: number;
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
  supervision?: WorkerSupervisionReport;
  outboxLag?: OutboxLagSummary;
  budgetAccounting?: BudgetAccountingSummary;
  releases?: ReleaseStatsSummary;
}

export function redactId(id: string, prefixLen: number = 8): string {
  if (id.length <= prefixLen) return id;
  return `${id.slice(0, prefixLen)}...`;
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

  // 5. Worker Supervision (Heartbeats)
  let supervision: WorkerSupervisionReport | undefined;
  try {
    supervision = await collectWorkerSupervision(sql, { now });
  } catch {
    // Table may not exist yet in test fixtures
  }

  // 6. Outbox / Event Lag
  let outboxLag: OutboxLagSummary | undefined;
  try {
    const eventStatsRes = await sql.query(`
      SELECT
        COUNT(*)::int AS total,
        EXTRACT(EPOCH FROM ($1::timestamp - MIN("createdAt")))::int AS "oldestAgeSeconds"
      FROM "interaction_events"
    `, [now.toISOString()]);
    const rawAge = eventStatsRes.rows[0]?.oldestAgeSeconds;
    outboxLag = {
      totalEvents: Number(eventStatsRes.rows[0]?.total ?? 0),
      oldestEventAgeSeconds: rawAge !== null && rawAge !== undefined && !isNaN(Number(rawAge))
        ? Math.max(0, Number(rawAge))
        : null,
    };
  } catch {
    // Optional table
  }

  // 7. Budget Accounting
  let budgetAccounting: BudgetAccountingSummary | undefined;
  try {
    const budgetRes = await sql.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE "used" = "limit")::int AS exhausted
      FROM "creation_budgets"
    `);
    const runsRes = await sql.query(`
      SELECT
        COUNT(*) FILTER (WHERE "budgetActual"->>'status' = 'settled')::int AS settled,
        COUNT(*) FILTER (WHERE "budgetActual"->>'status' = 'unknown_outcome_retained')::int AS retained
      FROM "interaction_runs"
    `);
    budgetAccounting = {
      totalReservations: Number(budgetRes.rows[0]?.total ?? 0),
      settledCount: Number(runsRes.rows[0]?.settled ?? 0),
      retainedCount: Number(runsRes.rows[0]?.retained ?? 0),
    };
  } catch {
    // Optional table
  }

  // 8. Release Statistics
  let releases: ReleaseStatsSummary | undefined;
  try {
    const releaseRes = await sql.query(`
      SELECT
        COUNT(*) FILTER (WHERE "visibility" = 'private')::int AS private,
        COUNT(*) FILTER (WHERE "visibility" = 'public')::int AS public
      FROM "cohort_releases"
    `);
    releases = {
      privateCount: Number(releaseRes.rows[0]?.private ?? 0),
      publicCount: Number(releaseRes.rows[0]?.public ?? 0),
    };
  } catch {
    // Optional table
  }

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
    supervision,
    outboxLag,
    budgetAccounting,
    releases,
  };
}

export function formatDiagnosticsReport(report: WorkerDiagnosticsReport): string {
  const lines: string[] = [
    `=== Interaction Worker Operational Diagnostics ===`,
    `Timestamp: ${report.timestamp}`,
    `Driver: ${report.driver.toUpperCase()} | Schema Status: ${report.schemaStatus.toUpperCase()}`,
    ``,
  ];

  if (report.supervision) {
    lines.push(
      `--- Worker Supervision & Liveness ---`,
      `Active Workers : ${report.supervision.activeWorkerCount} (${report.supervision.isAvailable ? 'AVAILABLE' : 'ABSENT'})`,
      `Stale Workers  : ${report.supervision.staleWorkerCount}`,
      report.supervision.oldestHeartbeatAgeSeconds !== null
        ? `Oldest Active Heartbeat: ${report.supervision.oldestHeartbeatAgeSeconds}s ago`
        : `Oldest Active Heartbeat: None`,
      ``
    );
  }

  lines.push(
    `--- Queue Backlog ---`,
    `Durable Jobs : ${report.backlog.jobs.queued} queued | ${report.backlog.jobs.running} running | ${report.backlog.jobs.failed} failed | ${report.backlog.jobs.accepted} accepted (Total: ${report.backlog.jobs.total})`,
    `Assistant Runs: ${report.backlog.runs.pending} pending | ${report.backlog.runs.running} running | ${report.backlog.runs.failed} failed | ${report.backlog.runs.completed} completed (Total: ${report.backlog.runs.total})`,
    ``,
    `--- In-Flight Age ---`,
    report.oldestQueuedJob
      ? `Oldest Queued Job : ${redactId(report.oldestQueuedJob.id)} (${report.oldestQueuedJob.stage}, ${report.oldestQueuedJob.ageSeconds}s old, ${report.oldestQueuedJob.attempts} attempts)`
      : `Oldest Queued Job : None (queue empty)`,
    report.oldestRunningJob
      ? `Oldest Running Job: ${redactId(report.oldestRunningJob.id)} (${report.oldestRunningJob.stage}, ${report.oldestRunningJob.ageSeconds}s old, worker: ${report.oldestRunningJob.leaseOwner ? redactId(report.oldestRunningJob.leaseOwner, 24) : 'none'})`
      : `Oldest Running Job: None (no active claims)`,
    ``,
    `--- Lease & Recovery Metrics ---`,
    `Expired Running Jobs (Eligible for Reclaim) : ${report.leaseRecovery.expiredRunningJobs}`,
    `Jobs with Exhausted Retries               : ${report.leaseRecovery.exhaustedRetryJobs}`,
    `Jobs Re-Fenced After Prior Lease Expiration : ${report.leaseRecovery.multiFenceJobs}`,
    ``
  );

  if (report.outboxLag && report.outboxLag.totalEvents > 0) {
    lines.push(
      `--- Outbox / Event Lag ---`,
      `Total Events: ${report.outboxLag.totalEvents} | Oldest Event Age: ${report.outboxLag.oldestEventAgeSeconds !== null ? `${report.outboxLag.oldestEventAgeSeconds}s` : 'none'}`,
      ``
    );
  }

  if (report.budgetAccounting && report.budgetAccounting.totalReservations > 0) {
    lines.push(
      `--- Budget Accounting ---`,
      `Reservations: ${report.budgetAccounting.totalReservations} | Settled: ${report.budgetAccounting.settledCount} | Retained (Unknown Outcome): ${report.budgetAccounting.retainedCount}`,
      ``
    );
  }

  if (report.releases && (report.releases.privateCount > 0 || report.releases.publicCount > 0)) {
    lines.push(
      `--- Release Statistics ---`,
      `Private Cohorts: ${report.releases.privateCount} | Public Cohorts: ${report.releases.publicCount}`,
      ``
    );
  }

  if (report.recentFailedJobs.length > 0) {
    lines.push(`--- Recent Failed Jobs (Last ${report.recentFailedJobs.length}) ---`);
    for (const f of report.recentFailedJobs) {
      lines.push(`- Job ${redactId(f.id)} [${f.stage}] workspace=${redactId(f.workspaceId)} attempts=${f.attempts} error=${f.errorCode ?? 'UNKNOWN'} at=${f.updatedAt}`);
    }
  } else {
    lines.push(`Recent Failed Jobs: None`);
  }

  return lines.join('\n');
}
