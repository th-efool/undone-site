import { z } from 'zod';
import { actionEnvelopeSchema, type DomainActionPlan } from '@/src/shared/interaction/contracts';
import type { InteractionRepository } from './repository';

/** Host-registered domain. Engine knows nothing about cohorts/agendas. */
export interface DomainDefinition<State = any> {
  id: string;
  version: number;
  /** Validate + build initial state from client bootstrap. */
  initialState(bootstrap: unknown): State;
  plan(state: State, action: unknown, ctx: { actionId: string; workspaceId: string; expectedRevision: number; currentRevision: number; entityVersions: ReadonlyMap<string, number> }): DomainActionPlan<State>;
}

export interface InteractionHandlerDeps {
  repo: InteractionRepository;
  domains: ReadonlyMap<string, DomainDefinition>;
}

export interface HandlerResult { status: number; body: unknown }

const createSchema = z.strictObject({ workspaceId: z.uuid(), domainId: z.string().min(1).max(80), bootstrap: z.unknown() });

const ERROR_STATUS: Record<string, number> = {
  STALE_WORKSPACE: 409, STALE_ENTITY: 409, IDEMPOTENCY_MISMATCH: 409,
  WORKSPACE_NOT_FOUND: 404, WORKSPACE_OWNER_MISMATCH: 404, WORKSPACE_NOT_ACTIVE: 409,
};

/** Maps thrown errors to the public envelope; never leaks raw messages. */
export function toErrorResult(err: unknown, correlationId = crypto.randomUUID()): HandlerResult {
  const code = err instanceof Error ? err.message : 'INTERNAL';
  if (err instanceof z.ZodError) return { status: 400, body: { code: 'INVALID_ACTION', message: 'Invalid request', retryable: false, correlationId } };
  const status = ERROR_STATUS[code];
  if (status) return { status, body: { code: status === 404 ? 'NOT_FOUND' : code === 'STALE_WORKSPACE' || code === 'STALE_ENTITY' ? 'CONFLICT' : code, message: code, retryable: false, correlationId } };
  if (/^[A-Z_]+$/.test(code)) return { status: 422, body: { code: 'INVALID_ACTION', message: code, retryable: false, correlationId } };
  return { status: 500, body: { code: 'INTERNAL', message: 'Internal error', retryable: true, correlationId } };
}

export function createInteractionHandlers(deps: InteractionHandlerDeps) {
  return {
    async createWorkspace(ownerId: string, input: unknown): Promise<HandlerResult> {
      try {
        const body = createSchema.parse(input);
        const domain = deps.domains.get(body.domainId);
        if (!domain) return { status: 400, body: { code: 'INVALID_ACTION', message: 'Unknown domain', retryable: false } };
        const ws = await deps.repo.createWorkspace({ id: body.workspaceId, ownerId, domainId: domain.id, domainVersion: domain.version, initialSnapshot: domain.initialState(body.bootstrap) });
        return { status: 201, body: { workspaceId: ws.id, revision: ws.revision, cursor: ws.sequence, snapshot: ws.snapshot } };
      } catch (e) { return toErrorResult(e); }
    },
    async getWorkspace(ownerId: string, workspaceId: string): Promise<HandlerResult> {
      try {
        const ws = await deps.repo.loadWorkspace({ workspaceId, ownerId });
        if (!ws) return toErrorResult(new Error('WORKSPACE_NOT_FOUND'));
        return { status: 200, body: { workspaceId: ws.id, domainId: ws.domainId, revision: ws.revision, cursor: ws.sequence, snapshot: ws.snapshot, lifecycle: ws.lifecycle } };
      } catch (e) { return toErrorResult(e); }
    },
    /** Single action path shared by UI and (later) model tool dispatch. */
    async commitAction(ownerId: string, requestId: string | undefined, input: unknown): Promise<HandlerResult> {
      try {
        const envelope = actionEnvelopeSchema.parse(input);
        const ws = await deps.repo.loadWorkspace({ workspaceId: envelope.workspaceId, ownerId });
        if (!ws) return toErrorResult(new Error('WORKSPACE_NOT_FOUND'));
        const domain = deps.domains.get(ws.domainId);
        if (!domain) return toErrorResult(new Error('UNKNOWN_DOMAIN'));
        const res = await deps.repo.commitAction({ workspaceId: ws.id, ownerId, expectedRevision: envelope.expectedRevision, envelope, plan: domain.plan, requestId });
        return { status: 200, body: { revision: res.revision, cursor: res.sequence, receipt: res.receipt, snapshot: res.state } };
      } catch (e) { return toErrorResult(e); }
    },
    async getEvents(ownerId: string, workspaceId: string, after = 0): Promise<HandlerResult> {
      try {
        const events = await deps.repo.queryEvents({ workspaceId, ownerId, afterSequence: after });
        return { status: 200, body: { events } };
      } catch (e) { return toErrorResult(e); }
    },
  };
}
