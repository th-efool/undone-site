import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from './infrastructure/db/postgres/client';
import { postgresInteractionRepo } from './infrastructure/db/postgres/repositories/interaction.repo';
import { runAssistantTurn, type InteractionRepository } from 'interaction-builder/runtime';
import { createCohortAiTools } from './domain/cohort-builder/tools';
import { cohortDomain } from './domain/cohort-builder/domain';
import { advanceTextWorkspace } from './domain/cohort-builder/text-worker';
import { cohortAssistantPrompt } from './domain/cohort-builder/context';
import { selectedLessonForLatestTurn } from './domain/cohort-builder/selection';
import { cohortWorkspaceSchema, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

export interface InteractionWorkerOptions {
  repo?: InteractionRepository;
  workerId?: string;
  pollIntervalMs?: number;
  leaseDurationMs?: number;
  heartbeatIntervalMs?: number;
  textWorkspaceCandidates?: () => Promise<Array<{ id: string; ownerId: string }>>;
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
    ORDER BY "updatedAt" ASC LIMIT 20`);

  while (!signal.aborted) {
    try {
      const candidates = await textWorkspaceCandidates();
      for (const candidate of candidates) {
        if (signal.aborted) break;
        await advanceTextWorkspace(repo, candidate.ownerId, candidate.id);
      }
      const leaseToken = randomUUID();
      const run = await repo.claimRun({
        leaseOwner: workerId,
        leaseToken,
        leaseDurationMs,
      });

      if (!run) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        continue;
      }

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

        const { createCohortModel } = await import('./infrastructure/ai/modelRegistry');
        const { createAiSdkModelAdapter } = await import('interaction-builder/adapters/ai');
        const model = createAiSdkModelAdapter(createCohortModel());
        const current = await repo.loadWorkspace<CohortWorkspace>({ workspaceId: run.workspaceId, ownerId: wsRow.ownerId });
        if (!current) throw new Error('WORKSPACE_NOT_FOUND');
        const selectedLesson = await selectedLessonForLatestTurn(repo, wsRow.ownerId, run.workspaceId, run.triggeringMessageId);
        const res = await runAssistantTurn({
          workspaceId: run.workspaceId,
          ownerId: wsRow.ownerId,
          repo,
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

        await repo.completeRun({
          runId: run.id,
          leaseToken,
          assistantMessageId: res.assistantMessageId,
        });
      } catch (err: any) {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }

        await repo.failRun({
          runId: run.id,
          leaseToken,
          error: err.message ?? String(err),
        });
      }
    } catch (loopErr) {
      if (signal.aborted) break;
      console.error('[interaction-worker] Worker loop error:', loopErr);
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
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
