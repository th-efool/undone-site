import { createHash } from 'node:crypto';
import type { ChangeReceipt, DomainActionPlan, EntityRef } from '@/src/shared/interaction/contracts';

export interface InteractionWorkspaceRecord<State = unknown> {
  id: string;
  ownerId: string;
  domainId: string;
  domainVersion: number;
  snapshot: State;
  revision: number;
  contextEpoch: number;
  sequence: number;
  lifecycle: 'active' | 'paused' | 'released' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface InteractionEventRecord {
  id: string;
  workspaceId: string;
  sequence: number;
  protocolVersion: number;
  type: string;
  revision: number | null;
  payload: unknown;
  createdAt: Date;
}

export interface InteractionOutboxRecord {
  id: string;
  workspaceId: string;
  kind: string;
  payload: unknown;
  dedupKey: string;
  status: 'pending' | 'delivering' | 'delivered' | 'failed';
  attempts: number;
  dueAt: Date;
  leaseOwner: string | null;
  leaseToken: string | null;
  leaseUntil: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InteractionRequestRecord {
  id: string;
  workspaceId: string;
  actorId: string;
  operation: string;
  requestId: string;
  payloadHash: string;
  response: unknown;
  createdAt: Date;
}

export interface ActionCommitInput<State> {
  workspaceId: string;
  ownerId: string;
  expectedRevision: number;
  envelope: unknown;
  plan: (
    state: State,
    action: unknown,
    context: {
      actionId: string;
      workspaceId: string;
      expectedRevision: number;
      currentRevision: number;
      entityVersions: ReadonlyMap<string, number>;
    }
  ) => DomainActionPlan<State>;
  requestId?: string;
  outboxItems?: Array<{
    kind: string;
    payload: unknown;
    dedupKey: string;
  }>;
}

export interface ActionCommitSuccess<State> {
  state: State;
  revision: number;
  sequence: number;
  receipt: ChangeReceipt;
}

export interface ClaimOutboxOptions {
  leaseOwner: string;
  leaseToken: string;
  leaseDurationMs: number;
  limit?: number;
  now?: Date;
}

export interface InteractionRepository {
  createWorkspace<State>(params: {
    id: string;
    ownerId: string;
    domainId: string;
    domainVersion: number;
    initialSnapshot: State;
  }): Promise<InteractionWorkspaceRecord<State>>;

  loadWorkspace<State>(params: {
    workspaceId: string;
    ownerId: string;
  }): Promise<InteractionWorkspaceRecord<State> | null>;

  commitAction<State>(input: ActionCommitInput<State>): Promise<ActionCommitSuccess<State>>;

  queryEvents(params: {
    workspaceId: string;
    ownerId: string;
    afterSequence?: number;
    limit?: number;
  }): Promise<InteractionEventRecord[]>;

  claimOutbox(options: ClaimOutboxOptions): Promise<InteractionOutboxRecord[]>;

  ackOutbox(params: {
    ids: string[];
    leaseToken: string;
    now?: Date;
  }): Promise<number>;

  failOutbox(params: {
    id: string;
    leaseToken: string;
    retryInMs?: number;
    now?: Date;
  }): Promise<boolean>;
}

function canonicalize(val: unknown): unknown {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(canonicalize);
  const sortedObj: Record<string, unknown> = {};
  for (const key of Object.keys(val as Record<string, unknown>).sort()) {
    sortedObj[key] = canonicalize((val as Record<string, unknown>)[key]);
  }
  return sortedObj;
}

export function computePayloadHash(payload: unknown): string {
  const json = JSON.stringify(canonicalize(payload));
  return createHash('sha256').update(json).digest('hex');
}
