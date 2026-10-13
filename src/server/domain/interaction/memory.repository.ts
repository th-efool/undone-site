import {
  type ActionCommitInput,
  type ActionCommitSuccess,
  type ClaimOutboxOptions,
  type InteractionEventRecord,
  type InteractionOutboxRecord,
  type InteractionRepository,
  type InteractionRequestRecord,
  type InteractionWorkspaceRecord,
  computePayloadHash,
} from './repository';
import { planActionCommit } from './action.service';

export class MemoryInteractionRepository implements InteractionRepository {
  private workspaces = new Map<string, InteractionWorkspaceRecord<any>>();
  private events = new Map<string, InteractionEventRecord[]>();
  private outbox = new Map<string, InteractionOutboxRecord>();
  private requests = new Map<string, InteractionRequestRecord>();

  async createWorkspace<State>(params: {
    id: string;
    ownerId: string;
    domainId: string;
    domainVersion: number;
    initialSnapshot: State;
  }): Promise<InteractionWorkspaceRecord<State>> {
    const existing = this.workspaces.get(params.id);
    if (existing) {
      if (existing.ownerId !== params.ownerId) {
        throw new Error('WORKSPACE_OWNER_MISMATCH');
      }
      return structuredClone(existing) as InteractionWorkspaceRecord<State>;
    }

    const now = new Date();
    const record: InteractionWorkspaceRecord<State> = {
      id: params.id,
      ownerId: params.ownerId,
      domainId: params.domainId,
      domainVersion: params.domainVersion,
      snapshot: structuredClone(params.initialSnapshot),
      revision: 0,
      contextEpoch: 0,
      sequence: 0,
      lifecycle: 'active',
      createdAt: now,
      updatedAt: now,
    };

    this.workspaces.set(params.id, record);
    this.events.set(params.id, []);
    return structuredClone(record);
  }

  async loadWorkspace<State>(params: {
    workspaceId: string;
    ownerId: string;
  }): Promise<InteractionWorkspaceRecord<State> | null> {
    const workspace = this.workspaces.get(params.workspaceId);
    if (!workspace || workspace.ownerId !== params.ownerId) {
      return null;
    }
    return structuredClone(workspace) as InteractionWorkspaceRecord<State>;
  }

  async commitAction<State>(input: ActionCommitInput<State>): Promise<ActionCommitSuccess<State>> {
    const workspace = this.workspaces.get(input.workspaceId);
    if (!workspace || workspace.ownerId !== input.ownerId) {
      throw new Error('WORKSPACE_NOT_FOUND');
    }
    if (workspace.lifecycle !== 'active') {
      throw new Error('WORKSPACE_NOT_ACTIVE');
    }

    // Idempotency check if requestId is provided
    let requestKey: string | null = null;
    let payloadHash: string | null = null;
    if (input.requestId) {
      requestKey = `${input.workspaceId}:${input.ownerId}:commitAction:${input.requestId}`;
      payloadHash = computePayloadHash(input.envelope);
      const existingRequest = this.requests.get(requestKey);
      if (existingRequest) {
        if (existingRequest.payloadHash !== payloadHash) {
          throw new Error('IDEMPOTENCY_MISMATCH');
        }
        return structuredClone(existingRequest.response) as ActionCommitSuccess<State>;
      }
    }

    if (workspace.revision !== input.expectedRevision) {
      throw new Error('STALE_WORKSPACE');
    }

    const commitResult = planActionCommit({
      state: workspace.snapshot,
      currentRevision: workspace.revision,
      envelope: input.envelope,
      plan: input.plan,
    });

    const nextSequence = workspace.sequence + 1;
    workspace.snapshot = commitResult.state;
    workspace.revision = commitResult.revision;
    workspace.sequence = nextSequence;
    workspace.updatedAt = new Date();

    const eventRecord: InteractionEventRecord = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      sequence: nextSequence,
      protocolVersion: 1,
      type: 'workspace.committed',
      revision: commitResult.revision,
      payload: {
        receipt: commitResult.receipt,
        baseRevision: input.expectedRevision,
        revision: commitResult.revision,
        changeSet: commitResult.receipt.changed,
      },
      createdAt: new Date(),
    };

    let workspaceEvents = this.events.get(input.workspaceId);
    if (!workspaceEvents) {
      workspaceEvents = [];
      this.events.set(input.workspaceId, workspaceEvents);
    }
    workspaceEvents.push(eventRecord);

    if (input.outboxItems) {
      const now = new Date();
      for (const item of input.outboxItems) {
        if (this.outbox.has(item.dedupKey)) continue;
        const outboxRecord: InteractionOutboxRecord = {
          id: crypto.randomUUID(),
          workspaceId: input.workspaceId,
          kind: item.kind,
          payload: structuredClone(item.payload),
          dedupKey: item.dedupKey,
          status: 'pending',
          attempts: 0,
          dueAt: now,
          leaseOwner: null,
          leaseToken: null,
          leaseUntil: null,
          deliveredAt: null,
          createdAt: now,
          updatedAt: now,
        };
        this.outbox.set(item.dedupKey, outboxRecord);
      }
    }

    const successResponse: ActionCommitSuccess<State> = {
      state: structuredClone(commitResult.state),
      revision: commitResult.revision,
      sequence: nextSequence,
      receipt: commitResult.receipt,
    };

    if (requestKey && payloadHash) {
      this.requests.set(requestKey, {
        id: crypto.randomUUID(),
        workspaceId: input.workspaceId,
        actorId: input.ownerId,
        operation: 'commitAction',
        requestId: input.requestId!,
        payloadHash,
        response: structuredClone(successResponse),
        createdAt: new Date(),
      });
    }

    return successResponse;
  }

  async queryEvents(params: {
    workspaceId: string;
    ownerId: string;
    afterSequence?: number;
    limit?: number;
  }): Promise<InteractionEventRecord[]> {
    const workspace = this.workspaces.get(params.workspaceId);
    if (!workspace || workspace.ownerId !== params.ownerId) {
      throw new Error('WORKSPACE_NOT_FOUND');
    }

    const after = params.afterSequence ?? 0;
    const limit = params.limit ?? 100;
    const all = this.events.get(params.workspaceId) ?? [];

    return all
      .filter(ev => ev.sequence > after)
      .slice(0, limit)
      .map(ev => structuredClone(ev));
  }

  async claimOutbox(options: ClaimOutboxOptions): Promise<InteractionOutboxRecord[]> {
    const now = options.now ?? new Date();
    const limit = options.limit ?? 10;
    const claimed: InteractionOutboxRecord[] = [];

    for (const record of this.outbox.values()) {
      if (claimed.length >= limit) break;
      const isDue = record.dueAt <= now;
      const isPending = record.status === 'pending';
      const isExpiredLease =
        record.status === 'delivering' &&
        record.leaseUntil !== null &&
        record.leaseUntil < now;

      if (isDue && (isPending || isExpiredLease)) {
        record.status = 'delivering';
        record.leaseOwner = options.leaseOwner;
        record.leaseToken = options.leaseToken;
        record.leaseUntil = new Date(now.getTime() + options.leaseDurationMs);
        record.attempts += 1;
        record.updatedAt = now;
        claimed.push(structuredClone(record));
      }
    }

    return claimed;
  }

  async ackOutbox(params: {
    ids: string[];
    leaseToken: string;
    now?: Date;
  }): Promise<number> {
    const now = params.now ?? new Date();
    const idSet = new Set(params.ids);
    let ackedCount = 0;

    for (const record of this.outbox.values()) {
      if (
        idSet.has(record.id) &&
        record.status === 'delivering' &&
        record.leaseToken === params.leaseToken
      ) {
        record.status = 'delivered';
        record.deliveredAt = now;
        record.leaseOwner = null;
        record.leaseToken = null;
        record.leaseUntil = null;
        record.updatedAt = now;
        ackedCount += 1;
      }
    }

    return ackedCount;
  }

  async failOutbox(params: {
    id: string;
    leaseToken: string;
    retryInMs?: number;
    now?: Date;
  }): Promise<boolean> {
    const now = params.now ?? new Date();
    for (const record of this.outbox.values()) {
      if (
        record.id === params.id &&
        record.status === 'delivering' &&
        record.leaseToken === params.leaseToken
      ) {
        record.status = 'pending';
        record.dueAt = new Date(now.getTime() + (params.retryInMs ?? 5_000));
        record.leaseOwner = null;
        record.leaseToken = null;
        record.leaseUntil = null;
        record.updatedAt = now;
        return true;
      }
    }
    return false;
  }
}
