import 'server-only';
import { createInteractionHandlers } from 'interaction-builder/runtime';
import { dispatchInteraction } from 'interaction-builder/adapters/http';
import { postgresInteractionRepo } from './infrastructure/db/postgres/repositories/interaction.repo';
import { getCreationOwner } from './infrastructure/auth/getCreationOwner';
import { cohortDomain } from './domain/cohort-builder/domain';

export async function executeAssistantTurn(ownerId: string, workspaceId: string) {
  // HTTP persists intent; the supervised worker owns execution and heartbeat.
  const run = await postgresInteractionRepo.scheduleRun({ workspaceId, ownerId });
  return { status: 202, body: { success: true, runId: run.id, status: run.status } };
}

const engineHandlers = createInteractionHandlers({
  repo: postgresInteractionRepo,
  domains: new Map([[cohortDomain.id, cohortDomain]]),
  runAssistant: async (ownerId, workspaceId) => {
    return await executeAssistantTurn(ownerId, workspaceId);
  },
});
const handlers = { ...engineHandlers, sendMessage: async (...args: Parameters<typeof engineHandlers.sendMessage>) => {
  const result = await engineHandlers.sendMessage(...args);
  if ((result.body as { message?: string })?.message === 'MESSAGE_QUEUE_FULL') return {
    status: 429, body: { code: 'MESSAGE_QUEUE_FULL', retryable: true, message: 'Five messages are waiting. Retry after one is handled.' },
  };
  return result;
}, createWorkspace: async (ownerId: string, input: unknown) => {
  if ((input as { domainId?: string } | null)?.domainId === 'cohort') {
    return { status: 405, body: { code: 'USE_COHORT_INTAKE' } };
  }
  return engineHandlers.createWorkspace(ownerId, input);
} };

export function handleInteractionRequest(request: Request, segments: string[]) {
  if (request.method === 'POST' && request.headers.get('origin') !== new URL(request.url).origin) {
    return Response.json({ code: 'INVALID_ORIGIN' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  return dispatchInteraction(request, segments, getCreationOwner, handlers);
}
