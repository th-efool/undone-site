import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initWorkerSupervisionTables,
  recordWorkerHeartbeat,
  deregisterWorker,
  collectWorkerSupervision,
  assertAdmissionQueueCapacity,
  type SupervisionSql,
} from '../worker-supervision';
import {
  collectWorkerDiagnostics,
  formatDiagnosticsReport,
  redactId,
} from '../worker-diagnostics';

describe('S6 Checkpoint 4: Worker Supervision & Operational Diagnostics', () => {
  // In-memory SQL stub simulating PostgreSQL
  let heartbeats: Map<string, any>;
  let textJobs: Map<string, any>;
  let runs: Map<string, any>;
  let events: Map<string, any>;
  let budgets: Map<string, any>;
  let releases: Map<string, any>;

  let mockSql: SupervisionSql;

  beforeEach(() => {
    heartbeats = new Map();
    textJobs = new Map();
    runs = new Map();
    events = new Map();
    budgets = new Map();
    releases = new Map();

    mockSql = {
      query: vi.fn(async (stmt: string, params: unknown[] = []) => {
        // Heartbeats table init
        if (stmt.includes('CREATE TABLE IF NOT EXISTS "interaction_worker_heartbeats"')) {
          return { rows: [] };
        }

        // Heartbeats upsert
        if (stmt.includes('INSERT INTO "interaction_worker_heartbeats"')) {
          const [workerId, driver, hostname, pid, startedAt, status, activeClaims, metadata] = [
            params[0], params[1], params[2], params[3], params[4], params[5], params[6], params[7]
          ];
          const existing = heartbeats.get(workerId as string) ?? {};
          heartbeats.set(workerId as string, {
            ...existing,
            worker_id: workerId,
            driver,
            hostname,
            pid,
            started_at: existing.started_at ?? startedAt,
            last_heartbeat_at: startedAt,
            status,
            active_claims_count: activeClaims,
            metadata: metadata ? JSON.parse(metadata as string) : existing.metadata,
          });
          return { rows: [] };
        }

        // Heartbeats deregister
        if (stmt.includes('UPDATE "interaction_worker_heartbeats"') && stmt.includes('SET "status" = $1')) {
          const [status, lastHeartbeat, workerId] = [params[0], params[1], params[2]];
          const record = heartbeats.get(workerId as string);
          if (record) {
            record.status = status;
            record.last_heartbeat_at = lastHeartbeat;
          }
          return { rows: [] };
        }

        // Heartbeats query
        if (stmt.includes('FROM "interaction_worker_heartbeats"')) {
          const nowStr = (params[0] as string) ?? new Date().toISOString();
          const nowMs = new Date(nowStr).getTime();
          const rows = Array.from(heartbeats.values())
            .filter(h => h.status === 'active' || h.status === 'draining')
            .map(h => ({
              ...h,
              age_seconds: Math.max(0, Math.floor((nowMs - new Date(h.last_heartbeat_at).getTime()) / 1000)),
            }));
          return { rows };
        }

        // Text Jobs counts and metrics
        if (stmt.includes('FROM "cohort_text_jobs"')) {
          const jobs = Array.from(textJobs.values());
          if (stmt.includes('COUNT(*) FILTER (WHERE "status" = \'queued\')')) {
            const queued = jobs.filter(j => j.status === 'queued').length;
            const running = jobs.filter(j => j.status === 'running').length;
            const failed = jobs.filter(j => j.status === 'failed').length;
            const accepted = jobs.filter(j => j.status === 'accepted').length;
            return { rows: [{ queued, running, failed, accepted, total: jobs.length }] };
          }
          if (stmt.includes('WHERE "status" = \'queued\'') && stmt.includes('LIMIT 1')) {
            const queued = jobs.filter(j => j.status === 'queued')[0];
            return {
              rows: queued
                ? [{
                    id: queued.id,
                    workspaceId: queued.workspaceId,
                    stage: queued.stage,
                    status: queued.status,
                    attempts: queued.attempts ?? 1,
                    ageSeconds: 12,
                  }]
                : [],
            };
          }
          if (stmt.includes('WHERE "status" = \'running\'') && stmt.includes('LIMIT 1')) {
            const running = jobs.filter(j => j.status === 'running')[0];
            return {
              rows: running
                ? [{
                    id: running.id,
                    workspaceId: running.workspaceId,
                    stage: running.stage,
                    status: running.status,
                    leaseOwner: running.leaseOwner,
                    ageSeconds: 5,
                  }]
                : [],
            };
          }
          if (stmt.includes('leaseUntil < $1::timestamp')) {
            return { rows: [{ expiredRunning: 0, exhaustedRetries: 0, multiFence: 1 }] };
          }
          if (stmt.includes('COUNT(*)::int AS count')) {
            return { rows: [{ count: jobs.filter(j => j.status === 'queued').length }] };
          }
          return { rows: [] };
        }

        // Runs query
        if (stmt.includes('FROM "interaction_runs"')) {
          const runList = Array.from(runs.values());
          return {
            rows: [{
              pending: runList.filter(r => r.status === 'pending').length,
              running: runList.filter(r => r.status === 'running').length,
              completed: runList.filter(r => r.status === 'completed').length,
              failed: runList.filter(r => r.status === 'failed').length,
              total: runList.length,
            }],
          };
        }

        // Events query
        if (stmt.includes('FROM "interaction_events"')) {
          return { rows: [{ total: events.size, oldestAgeSeconds: events.size > 0 ? 3 : null }] };
        }

        // Budgets query
        if (stmt.includes('FROM "creation_budgets"')) {
          return { rows: [{ total: budgets.size, exhausted: 0 }] };
        }

        // Releases query
        if (stmt.includes('FROM "cohort_releases"')) {
          const list = Array.from(releases.values());
          return {
            rows: [{
              private: list.filter(r => r.visibility === 'private').length,
              public: list.filter(r => r.visibility === 'public').length,
            }],
          };
        }

        return { rows: [] };
      }),
    };
  });

  it('records worker heartbeats and distinguishes active from stale workers', async () => {
    await initWorkerSupervisionTables(mockSql);

    const baseTime = new Date('2026-10-15T12:00:00Z');

    // 1. Worker A records heartbeat at T=0
    await recordWorkerHeartbeat(mockSql, {
      workerId: 'worker-node-1',
      driver: 'durable',
      hostname: 'prod-host-1',
      pid: 101,
      now: baseTime,
    });

    // 2. Check supervision at T+10s (Worker A is active)
    const report1 = await collectWorkerSupervision(mockSql, {
      now: new Date('2026-10-15T12:00:10Z'),
      staleThresholdMs: 30_000,
    });
    expect(report1.isAvailable).toBe(true);
    expect(report1.activeWorkerCount).toBe(1);
    expect(report1.staleWorkerCount).toBe(0);
    expect(report1.activeWorkers[0].workerId).toBe('worker-node-1');

    // 3. Worker B joins at T+15s
    await recordWorkerHeartbeat(mockSql, {
      workerId: 'worker-node-2',
      driver: 'durable',
      hostname: 'prod-host-2',
      pid: 102,
      now: new Date('2026-10-15T12:00:15Z'),
    });

    // 4. Advance time to T+45s without Worker A heartbeating (Worker A is now stale, Worker B is still active)
    await recordWorkerHeartbeat(mockSql, {
      workerId: 'worker-node-2',
      now: new Date('2026-10-15T12:00:40Z'),
    });

    const report2 = await collectWorkerSupervision(mockSql, {
      now: new Date('2026-10-15T12:00:45Z'),
      staleThresholdMs: 30_000,
    });
    expect(report2.isAvailable).toBe(true);
    expect(report2.activeWorkerCount).toBe(1); // Worker B
    expect(report2.staleWorkerCount).toBe(1); // Worker A is stale!
    expect(report2.staleWorkers[0].workerId).toBe('worker-node-1');
  });

  it('cleanly deregisters on worker shutdown and removes from active list', async () => {
    const baseTime = new Date('2026-10-15T12:00:00Z');

    await recordWorkerHeartbeat(mockSql, {
      workerId: 'worker-node-1',
      driver: 'durable',
      now: baseTime,
    });

    const before = await collectWorkerSupervision(mockSql, { now: baseTime });
    expect(before.activeWorkerCount).toBe(1);

    // Clean shutdown
    await deregisterWorker(mockSql, {
      workerId: 'worker-node-1',
      status: 'stopped',
      now: new Date('2026-10-15T12:00:05Z'),
    });

    const after = await collectWorkerSupervision(mockSql, { now: new Date('2026-10-15T12:00:06Z') });
    expect(after.activeWorkerCount).toBe(0);
    expect(after.isAvailable).toBe(false);
  });

  it('enforces bounded queue admission when workers are missing', async () => {
    // Zero active workers registered
    const baseTime = new Date('2026-10-15T12:00:00Z');

    // 1. With 10 queued jobs, under max limit (50): admitted with warning
    for (let i = 0; i < 10; i++) {
      textJobs.set(`job-${i}`, { id: `job-${i}`, status: 'queued' });
    }

    const res1 = await assertAdmissionQueueCapacity(mockSql, {
      maxQueuedJobsWithoutWorker: 50,
      now: baseTime,
    });
    expect(res1.admitted).toBe(true);
    expect(res1.workerAvailable).toBe(false);
    expect(res1.queuedCount).toBe(10);

    // 2. Add 45 more jobs to exceed 50 limit (total 55)
    for (let i = 10; i < 55; i++) {
      textJobs.set(`job-${i}`, { id: `job-${i}`, status: 'queued' });
    }

    // 3. Queue capacity exceeded: fails closed with 503 WORKER_UNAVAILABLE
    await expect(assertAdmissionQueueCapacity(mockSql, {
      maxQueuedJobsWithoutWorker: 50,
      now: baseTime,
    })).rejects.toThrow('WORKER_UNAVAILABLE');

    // 4. When an active worker registers, admission immediately succeeds regardless of queue size
    await recordWorkerHeartbeat(mockSql, {
      workerId: 'worker-node-restarted',
      driver: 'durable',
      now: baseTime,
    });

    const res2 = await assertAdmissionQueueCapacity(mockSql, {
      maxQueuedJobsWithoutWorker: 50,
      now: baseTime,
    });
    expect(res2.admitted).toBe(true);
    expect(res2.workerAvailable).toBe(true);
  });

  it('collects extended diagnostics and formats redacted, privacy-safe report', async () => {
    const now = new Date('2026-10-15T12:00:00Z');

    // Seed jobs, runs, events, budgets, releases
    textJobs.set('job-uuid-12345678-long', {
      id: 'job-uuid-12345678-long',
      workspaceId: 'workspace-uuid-87654321-long',
      stage: 'chunking',
      status: 'running',
      leaseOwner: 'worker-instance-9999',
    });
    runs.set('run-1', { id: 'run-1', status: 'running' });
    events.set('event-1', { id: 'event-1' });
    budgets.set('budget-1', { key: 'b1', used: 1, limit: 5 });
    releases.set('release-1', { visibility: 'private' });
    releases.set('release-2', { visibility: 'public' });

    await recordWorkerHeartbeat(mockSql, {
      workerId: 'worker-active-1',
      now,
    });

    const report = await collectWorkerDiagnostics(mockSql, now);

    expect(report.supervision).toBeDefined();
    expect(report.supervision?.activeWorkerCount).toBe(1);
    expect(report.backlog.jobs.running).toBe(1);
    expect(report.outboxLag?.totalEvents).toBe(1);
    expect(report.releases?.publicCount).toBe(1);

    // Format report
    const formatted = formatDiagnosticsReport(report);

    // Verify redacted IDs and privacy safety
    expect(formatted).toContain('=== Interaction Worker Operational Diagnostics ===');
    expect(formatted).toContain('Active Workers : 1 (AVAILABLE)');
    expect(formatted).toContain('Durable Jobs : 0 queued | 1 running');
    expect(formatted).toContain('Private Cohorts: 1 | Public Cohorts: 1');

    // Check ID redaction utility
    expect(redactId('workspace-long-identifier-12345', 8)).toBe('workspac...');
    expect(redactId('short', 8)).toBe('short');

    // Verify zero user secrets or raw conversation bodies
    expect(formatted).not.toContain('secret');
    expect(formatted).not.toContain('token');
    expect(formatted).not.toContain('prompt');
  });
});
