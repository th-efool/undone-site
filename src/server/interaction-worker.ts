import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from './infrastructure/db/postgres/client';
import { postgresInteractionRepo } from './infrastructure/db/postgres/repositories/interaction.repo';
import { bindAssistantLease } from './infrastructure/db/postgres/assistant-queue';
import { runAssistantTurn, type InteractionRepository } from 'interaction-builder/runtime';
import { createCohortAiTools } from './domain/cohort-builder/tools';
import { cohortDomain } from './domain/cohort-builder/domain';
import { advanceTextWorkspace } from './domain/cohort-builder/text-worker';
import { textDriver } from './domain/cohort-builder/text-driver';
import { createTextJobRuntime } from './infrastructure/db/postgres/text-job-runtime';
import { cohortAssistantPrompt } from './domain/cohort-builder/context';
import { selectedLessonForLatestTurn } from './domain/cohort-builder/selection';
import { cohortWorkspaceSchema, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { settleModelTurnBudget } from './domain/cohort-builder/budget-policy';
import {
  recordWorkerHeartbeat,
  deregisterWorker,
  initWorkerSupervisionTables,
  type SupervisionSql,
} from './domain/cohort-builder/worker-supervision';
import { devLogger } from '@/src/shared/lib/dev-logger';

export interface InteractionWorkerOptions {
  repo?: InteractionRepository;
  workerId?: string;
  pollIntervalMs?: number;
  leaseDurationMs?: number;
  heartbeatIntervalMs?: number;
  supervisionSql?: SupervisionSql | null;
  durable?: { tick: () => Promise<void>; close: () => Promise<void> } | null;
  textWorkspaceCandidates?: () => Promise<Array<{ id: string; ownerId: string }>>;
  /** Bounded execution for durable hosting steps; SQL leases remain authoritative. */
  maxIterations?: number;
}

export async function runInteractionWorkerLoop(
  options: InteractionWorkerOptions,
  signal: AbortSignal
): Promise<void> {
  const repo = options.repo ?? postgresInteractionRepo;
  const workerId = options.workerId ?? `interaction-worker-${randomUUID()}`;
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  const leaseDurationMs = options.leaseDurationMs ?? 60_000;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15_000;
  const textWorkspaceCandidates = options.textWorkspaceCandidates ?? (() => prisma.$queryRaw<Array<{ id: string; ownerId: string }>>`
    SELECT "id", "ownerId" FROM "interaction_workspaces"
    WHERE "domainId" = 'cohort' AND "lifecycle" = 'active'
      AND "snapshot"->'processing'->>'status' = 'queued'
      AND COALESCE("snapshot"->'processing'->>'driver', 'snapshot') <> 'durable'
    ORDER BY "updatedAt" ASC LIMIT 20`);

  const supervisionSql = options.supervisionSql === null
    ? null
    : (options.supervisionSql ?? (process.env.DATABASE_URL ? {
        query: async (stmt: string, params: unknown[] = []) => {
          try {
            const rows = await prisma.$queryRawUnsafe<any[]>(stmt, ...params);
            return { rows: Array.isArray(rows) ? rows : [] };
          } catch {
            await prisma.$executeRawUnsafe(stmt, ...params).catch(() => {});
            return { rows: [] };
          }
        },
      } : undefined));

  if (supervisionSql) {
    try {
      await initWorkerSupervisionTables(supervisionSql);
      await recordWorkerHeartbeat(supervisionSql, {
        workerId,
        driver: textDriver(),
        status: 'active',
      });
    } catch (err) {
      console.warn('[interaction-worker] Initial supervision heartbeat skipped:', err);
    }
  }

  let lastWorkerHeartbeat = Date.now();
  const durable = options.durable !== undefined
    ? options.durable
    : (textDriver() === 'durable' && process.env.DATABASE_URL
        ? await createTextJobRuntime(process.env.DATABASE_URL, workerId, leaseDurationMs) : null);
  try {
  let iterations = 0;
  while (!signal.aborted && (options.maxIterations === undefined || iterations++ < options.maxIterations)) {
    try {
      if (supervisionSql && (Date.now() - lastWorkerHeartbeat >= heartbeatIntervalMs)) {
        try {
          await recordWorkerHeartbeat(supervisionSql, {
            workerId,
            driver: textDriver(),
            status: 'active',
          });
          lastWorkerHeartbeat = Date.now();
        } catch {}
      }
      // Prioritize interactive assistant runs so background bulk text jobs cannot starve interactive turns
      const leaseToken = randomUUID();
      const run = await repo.claimRun({
        leaseOwner: workerId,
        leaseToken,
        leaseDurationMs,
      });

      if (!run) {
        // No pending interactive runs; execute background text processing DAG tick
        if (durable) await durable.tick();
        const candidates = durable ? [] : await textWorkspaceCandidates();
        if (candidates.length > 0) {
          devLogger.debug('InteractionWorker', `Processing ${candidates.length} text workspace candidate(s)`);
        }
        for (const candidate of candidates) {
          if (signal.aborted) break;
          await advanceTextWorkspace(repo, candidate.ownerId, candidate.id);
        }
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        continue;
      }

      devLogger.info('InteractionWorker', `Claimed assistant run ${run.id} for workspace ${run.workspaceId}`);

      // Start heartbeat timer
      let heartbeatTimer: NodeJS.Timeout | null = setInterval(async () => {
        try {
          await repo.heartbeatRun({ runId: run.id, leaseToken, leaseDurationMs });
        } catch (err) {
          console.error(`[interaction-worker] Heartbeat failed for run ${run.id}:`, err);
        }
      }, heartbeatIntervalMs);

      try {
        // Load workspace to find ownerId
        // In PostgreSQL repo loadWorkspace requires ownerId; we find the ownerId from the workspace table directly
        const wsRow = await prisma.interactionWorkspace.findUnique({
          where: { id: run.workspaceId },
          select: { ownerId: true },
        });

        if (!wsRow) {
          throw new Error('WORKSPACE_NOT_FOUND');
        }

        const current = await repo.loadWorkspace<CohortWorkspace>({ workspaceId: run.workspaceId, ownerId: wsRow.ownerId });
        if (!current) throw new Error('WORKSPACE_NOT_FOUND');
        const selectedLesson = await selectedLessonForLatestTurn(repo, wsRow.ownerId, run.workspaceId, run.triggeringMessageId);
        const { createInteractionModelAdapter } = await import('./infrastructure/ai/interactionModel');
        const model = await createInteractionModelAdapter(selectedLesson);
        const res = await runAssistantTurn({
          workspaceId: run.workspaceId,
          ownerId: wsRow.ownerId,
          repo: bindAssistantLease(repo, run.id, leaseToken),
          domain: cohortDomain,
          model,
          createTools: deps => createCohortAiTools({ ...deps, selectedLesson }),
          runId: run.id,
          leaseToken,
          systemPrompt: cohortAssistantPrompt(cohortWorkspaceSchema.parse(current.snapshot), current.revision),
        });

        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }

        const budgetActual = settleModelTurnBudget({
          reservation: run.budgetReservation,
          actualUsage: res.usage ? {
            ...res.usage,
            stepsCount: res.stepsCount,
          } : undefined,
        });

        await repo.completeRun({
          runId: run.id,
          leaseToken,
          assistantMessageId: res.assistantMessageId,
          budgetActual,
        });
        devLogger.info('InteractionWorker', `Assistant run ${run.id} completed. Steps: ${res.stepsCount ?? 0}`);
      } catch (err: any) {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }

        const budgetActual = settleModelTurnBudget({
          reservation: run.budgetReservation,
          error: err.message ?? String(err),
        });

        devLogger.error('InteractionWorker', `Assistant run ${run.id} failed:`, err);
        devLogger.recordIssue({
          severity: 'ERROR',
          component: 'InteractionWorker',
          title: `Assistant run ${run.id} failed`,
          details: err?.message,
          error: String(err),
          context: { runId: run.id, workspaceId: run.workspaceId },
        });

        await repo.failRun({
          runId: run.id,
          leaseToken,
          error: err.message ?? String(err),
          budgetActual,
        });
      }
    } catch (loopErr) {
      if (signal.aborted) break;
      devLogger.error('InteractionWorker', 'Worker loop error:', loopErr);
      devLogger.recordIssue({
        severity: 'WARN',
        component: 'InteractionWorker',
        title: 'Worker loop iteration error',
        error: String(loopErr),
      });
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
  }
  } finally {
    if (supervisionSql) {
      try {
        await deregisterWorker(supervisionSql, { workerId, status: 'stopped' });
      } catch {}
    }
    await durable?.close();
  }
}

async function main() {
  if (process.argv.includes('--check')) {
    console.log('Interaction worker imports and Node server condition are valid. No database or model call made.');
    await prisma.$disconnect();
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for the interaction worker.');
  }

  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);

  try {
    await runInteractionWorkerLoop({}, shutdown.signal);
  } finally {
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith('interaction-worker.ts') || process.argv[1]?.endsWith('interaction-worker.js')) {
  void main().catch(error => {
    console.error('[interaction-worker]', error instanceof Error ? error.message : 'Startup failed');
    process.exitCode = 1;
  });
}
