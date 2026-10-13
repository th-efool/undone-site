import 'server-only';
import { createInteractionHandlers, type DomainDefinition, runAssistantTurn } from 'interaction-builder/runtime';
import { dispatchInteraction } from 'interaction-builder/adapters/http';
import { postgresInteractionRepo } from './infrastructure/db/postgres/repositories/interaction.repo';
import { getCreationOwner } from './infrastructure/auth/getCreationOwner';
import { createAiSdkModelAdapter } from 'interaction-builder/adapters/ai';
import { createCohortAiTools } from './domain/cohort-builder/tools';
import { cohortDomain } from './domain/cohort-builder/domain';
import { createCohortModel } from './infrastructure/ai/modelRegistry';
import { cohortAssistantPrompt } from './domain/cohort-builder/context';
import { cohortWorkspaceSchema, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

export async function executeAssistantTurn(ownerId: string, workspaceId: string) {
  // Ensure a run exists and claim it with a lease
  const run = await postgresInteractionRepo.scheduleRun({ workspaceId, ownerId });
  const leaseToken = crypto.randomUUID();
  const claimed = await postgresInteractionRepo.claimRun({
    workspaceId,
    leaseOwner: 'web-request',
    leaseToken,
    leaseDurationMs: 60_000,
  });

  const activeRun = claimed ?? run;
  const activeToken = claimed ? leaseToken : (activeRun.leaseToken ?? leaseToken);

  const model = createAiSdkModelAdapter(createCohortModel());
  const current = await postgresInteractionRepo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId });
  if (!current) throw new Error('WORKSPACE_NOT_FOUND');
  try {
    const res = await runAssistantTurn({
      workspaceId,
      ownerId,
      repo: postgresInteractionRepo,
      domain: cohortDomain,
      model,
      createTools: createCohortAiTools,
      runId: activeRun.id,
      leaseToken: activeToken,
      systemPrompt: cohortAssistantPrompt(cohortWorkspaceSchema.parse(current.snapshot), current.revision),
    });
    await postgresInteractionRepo.completeRun({
      runId: activeRun.id,
      leaseToken: activeToken,
      assistantMessageId: res.assistantMessageId,
    });
    return { status: 200, body: res };
  } catch (err: any) {
    await postgresInteractionRepo.failRun({
      runId: activeRun.id,
      leaseToken: activeToken,
      error: err.message ?? String(err),
    });
    throw err;
  }
}

const handlers = createInteractionHandlers({
  repo: postgresInteractionRepo,
  domains: new Map([[cohortDomain.id, cohortDomain]]),
  runAssistant: async (ownerId, workspaceId) => {
    return await executeAssistantTurn(ownerId, workspaceId);
  },
});

export function handleInteractionRequest(request: Request, segments: string[]) {
  return dispatchInteraction(request, segments, getCreationOwner, handlers);
}
