import 'server-only';
import { createInteractionHandlers } from 'interaction-builder/runtime';
import { dispatchInteraction } from 'interaction-builder/adapters/http';
import { postgresInteractionRepo } from './infrastructure/db/postgres/repositories/interaction.repo';
import { getCreationOwner } from './infrastructure/auth/getCreationOwner';
import { cohortDomain } from './domain/cohort-builder/domain';
import { dispatchInteractionExecution } from './interaction-dispatch.runtime';

export async function executeAssistantTurn(ownerId: string, workspaceId: string) {
  // HTTP persists intent; the supervised worker owns execution and heartbeat.
  try {
    const run = await postgresInteractionRepo.scheduleRun({ workspaceId, ownerId });
    return { status: 202, body: { success: true, runId: run.id, status: run.status } };
  } catch (err: any) {
    if (err?.code === 'CONCURRENT_RUNS_EXCEEDED' || err?.name === 'UserConcurrencyExceededError') {
      return { status: 429, body: { code: 'CONCURRENT_RUNS_EXCEEDED', retryable: true, message: err.message } };
    }
    if (err?.code === 'BUDGET_EXHAUSTED' || err?.name === 'UserBudgetExceededError') {
      return { status: 429, body: { code: 'BUDGET_EXHAUSTED', retryable: true, message: err.message } };
    }
    throw err;
  }
}

const engineHandlers = createInteractionHandlers({
  repo: postgresInteractionRepo,
  domains: new Map([[cohortDomain.id, cohortDomain]]),
  runAssistant: async (ownerId, workspaceId) => {
    return await executeAssistantTurn(ownerId, workspaceId);
  },
});
const handlers = { ...engineHandlers, sendMessage: async (...args: Parameters<typeof engineHandlers.sendMessage>) => {
  try {
    const result = await engineHandlers.sendMessage(...args);
    if ((result.body as { message?: string })?.message === 'MESSAGE_QUEUE_FULL') return {
      status: 429, body: { code: 'MESSAGE_QUEUE_FULL', retryable: true, message: 'Five messages are waiting. Retry after one is handled.' },
    };
    return result;
  } catch (err: any) {
    if (err?.code === 'CONCURRENT_RUNS_EXCEEDED' || err?.name === 'UserConcurrencyExceededError') {
      return { status: 429, body: { code: 'CONCURRENT_RUNS_EXCEEDED', retryable: true, message: err.message } };
    }
    if (err?.code === 'BUDGET_EXHAUSTED' || err?.name === 'UserBudgetExceededError') {
      return { status: 429, body: { code: 'BUDGET_EXHAUSTED', retryable: true, message: err.message } };
    }
    throw err;
  }
}, createWorkspace: async (ownerId: string, input: unknown) => {
  if ((input as { domainId?: string } | null)?.domainId === 'cohort') {
    return { status: 405, body: { code: 'USE_COHORT_INTAKE' } };
  }
  return engineHandlers.createWorkspace(ownerId, input);
} };

export async function handleInteractionRequest(request: Request, segments: string[]) {
  if (request.method === 'POST' && request.headers.get('origin') !== new URL(request.url).origin) {
    return Response.json({ code: 'INVALID_ORIGIN' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  const response = await dispatchInteraction(request, segments, getCreationOwner, handlers);
  if (request.method === 'POST' && response.ok) {
    try { await dispatchInteractionExecution(); }
    catch { return Response.json({ code: 'EXECUTION_UNAVAILABLE', retryable: true }, { status: 503 }); }
  }
  return response;
}
