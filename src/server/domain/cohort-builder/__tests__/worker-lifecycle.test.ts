import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  collectWorkerDiagnostics,
  formatDiagnosticsReport,
  type DiagnosticsSql,
} from '../worker-diagnostics';
import { runInteractionWorkerLoop } from '@/src/server/interaction-worker';
import { runTextJobTick } from '../text-job-tick';
import type { ClaimedTextJob } from '../text-jobs';

describe('S6A Worker Lifecycle, Resilience & Safe Diagnostics', () => {
  it('collects and formats queue backlog and lease recovery metrics without leaking secrets', async () => {
    const fakeSql: DiagnosticsSql = {
      query: vi.fn(async (statement: string) => {
        if (statement.includes('information_schema.tables')) {
          return { rows: [{ count: 3 }] };
        }
        if (statement.includes('COUNT(*) FILTER (WHERE "status" = \'queued\')')) {
          return { rows: [{ queued: 5, running: 2, failed: 1, accepted: 20, total: 28 }] };
        }
        if (statement.includes('FROM "interaction_runs"') && statement.includes('COUNT(*) FILTER')) {
          return { rows: [{ pending: 1, running: 1, completed: 15, failed: 0, total: 17 }] };
        }
        if (statement.includes('ORDER BY "dueAt" ASC')) {
          return {
            rows: [
              {
                id: 'job-101',
                workspaceId: 'ws-alpha',
                stage: 'chunking',
                status: 'queued',
                attempts: 1,
                ageSeconds: 42,
              },
            ],
          };
        }
        if (statement.includes('ORDER BY "updatedAt" ASC')) {
          return {
            rows: [
              {
                id: 'job-102',
                workspaceId: 'ws-beta',
                stage: 'analysis',
                status: 'running',
                leaseOwner: 'worker-node-1',
                ageSeconds: 15,
              },
            ],
          };
        }
        if (statement.includes('WHERE "status" = \'failed\'') && statement.includes('ORDER BY "updatedAt" DESC')) {
          return {
            rows: [
              {
                id: 'job-100',
                workspaceId: 'ws-gamma',
                stage: 'understanding',
                errorCode: 'PROCESSOR_DEADLINE',
                attempts: 3,
                updatedAt: new Date().toISOString(),
              },
            ],
          };
        }
        return { rows: [{ count: 0, expiredRunning: 1, exhaustedRetries: 1, multiFence: 2 }] };
      }),
    };

    const prevDriver = process.env.INTERACTION_TEXT_DRIVER;
    process.env.INTERACTION_TEXT_DRIVER = 'durable';
    try {
      const report = await collectWorkerDiagnostics(fakeSql, new Date());
      expect(report.driver).toBe('durable');
      expect(report.backlog.jobs.queued).toBe(5);
      expect(report.backlog.jobs.running).toBe(2);
      expect(report.backlog.runs.pending).toBe(1);
      expect(report.oldestQueuedJob?.id).toBe('job-101');
      expect(report.oldestRunningJob?.leaseOwner).toBe('worker-node-1');
      expect(report.recentFailedJobs[0].errorCode).toBe('PROCESSOR_DEADLINE');

      const formatted = formatDiagnosticsReport(report);
      expect(formatted).toContain('Durable Jobs : 5 queued | 2 running | 1 failed | 20 accepted');
      expect(formatted).toContain('Oldest Queued Job : job-101 (chunking, 42s old, 1 attempts)');
      expect(formatted).toContain('Oldest Running Job: job-102 (analysis, 15s old, worker: worker-node-1)');
      expect(formatted).toContain('PROCESSOR_DEADLINE');

      // Zero secret leakage check
      expect(formatted).not.toContain('password');
      expect(formatted).not.toContain('token');
      expect(formatted).not.toContain('Bearer');
    } finally {
      process.env.INTERACTION_TEXT_DRIVER = prevDriver;
    }
  });

  it('stops worker loop cleanly upon AbortSignal without claiming new runs', async () => {
    process.env.INTERACTION_TEXT_DRIVER = 'snapshot';
    const fakeRepo = {
      claimRun: vi.fn(async () => null),
      heartbeatRun: vi.fn(async () => {}),
      completeRun: vi.fn(async () => {}),
      failRun: vi.fn(async () => {}),
      loadWorkspace: vi.fn(async () => null),
    };

    const controller = new AbortController();
    // Abort immediately
    controller.abort();

    await runInteractionWorkerLoop(
      {
        repo: fakeRepo as any,
        pollIntervalMs: 10,
        textWorkspaceCandidates: async () => [],
      },
      controller.signal
    );

    // Should not have claimed any run
    expect(fakeRepo.claimRun).not.toHaveBeenCalled();
  });

  it('rejects stale acceptance if lease expires or is lost before processor completes', async () => {
    const fakeJob: ClaimedTextJob = {
      id: 'job-stale-test',
      workspaceId: 'ws-stale',
      stage: 'chunking',
      sourceId: 'src-1',
      sourceVersion: 1,
      dependencyFingerprint: 'dep-fingerprint',
      fence: 1,
      leaseToken: 'token-1',
      leaseUntil: new Date(Date.now() + 500),
    };

    const fakeSql = {
      query: vi.fn(async (statement: string) => {
        // Return claimed job on claim query
        if (statement.includes('UPDATE "cohort_text_jobs" j') && statement.includes('SET "status" = \'running\'')) {
          return { rows: [fakeJob] };
        }
        // Heartbeat query fails (lost lease)
        if (statement.includes('WHERE "id" = $3') && statement.includes('leaseToken')) {
          return { rows: [] }; // 0 rows updated -> lost lease!
        }
        return { rows: [] };
      }),
    };

    const accept = vi.fn(async () => true);

    const result = await runTextJobTick({
      sql: fakeSql as any,
      workerId: 'worker-lost-lease',
      leaseMs: 1000,
      now: () => new Date(),
      renewLease: true,
      process: async () => {
        // Wait slightly for heartbeat to fire and fail
        await new Promise(r => setTimeout(r, 400));
        return new Uint8Array([1, 2, 3]);
      },
      accept,
    });

    expect(result.status).toBe('stale');
    expect(result.jobId).toBe(fakeJob.id);
    expect(accept).not.toHaveBeenCalled();
  });

  it('marks poisoned job as failed when processor exceeds deadline', async () => {
    const fakeJob: ClaimedTextJob = {
      id: 'job-poison-test',
      workspaceId: 'ws-poison',
      stage: 'chunking',
      sourceId: 'src-1',
      sourceVersion: 1,
      dependencyFingerprint: 'dep-fingerprint',
      fence: 1,
      leaseToken: 'token-poison',
      leaseUntil: new Date(Date.now() + 10_000),
    };

    const fakeSql = {
      query: vi.fn(async (statement: string) => {
        if (statement.includes('UPDATE "cohort_text_jobs" j') && statement.includes('SET "status" = \'running\'')) {
          return { rows: [fakeJob] };
        }
        return { rows: [] };
      }),
    };

    const fail = vi.fn(async () => true);

    const result = await runTextJobTick({
      sql: fakeSql as any,
      workerId: 'worker-poison',
      leaseMs: 10_000,
      now: () => new Date(),
      processTimeoutMs: 50, // Short timeout for test
      process: async () => {
        // Hang longer than timeout
        await new Promise(r => setTimeout(r, 200));
        return new Uint8Array([1]);
      },
      accept: async () => true,
      fail,
    });

    expect(result.status).toBe('failed');
    expect(result.jobId).toBe(fakeJob.id);
    expect(fail).toHaveBeenCalledWith(
      expect.objectContaining({ id: fakeJob.id, stage: 'chunking' }),
      'PROCESSOR_DEADLINE',
      expect.any(Date)
    );
  });
});
