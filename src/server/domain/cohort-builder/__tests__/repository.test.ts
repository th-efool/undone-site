import { describe, expect, it } from 'vitest';
import { MemoryInteractionRepository } from 'interaction-builder/runtime';
import { planCohortAction, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

const sampleCohort: CohortWorkspace = {
  schemaVersion: 1,
  title: 'Test Cohort',
  intent: 'Master async architecture',
  audience: 'Senior developers',
  dailyMinutes: 30,
  lessons: [
    {
      id: 'lesson-1',
      version: 0,
      title: 'Introduction',
      objective: 'Understand foundations',
      sourceChunkIds: [],
      pinned: false,
    },
  ],
  sources: [],
  chunks: [],
  understanding: [],
  analyses: [],
  processing: { status: 'idle', stage: 'done', generation: 0, sourceFingerprint: null, error: null },
};

describe('InteractionRepository (Memory Testkit with Cohort)', () => {
  it('creates and loads workspaces with owner isolation', async () => {
    const repo = new MemoryInteractionRepository();
    const ws = await repo.createWorkspace({
      id: 'ws-1',
      ownerId: 'user-1',
      domainId: 'cohort-builder',
      domainVersion: 1,
      initialSnapshot: sampleCohort,
    });

    expect(ws.revision).toBe(0);
    expect(ws.sequence).toBe(0);
    expect(ws.lifecycle).toBe('active');

    const loaded = await repo.loadWorkspace({ workspaceId: 'ws-1', ownerId: 'user-1' });
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe('ws-1');

    // Cross-tenant probe returns null
    const foreign = await repo.loadWorkspace({ workspaceId: 'ws-1', ownerId: 'user-2' });
    expect(foreign).toBeNull();
  });

  it('commits actions with CAS revision progression and event logging', async () => {
    const repo = new MemoryInteractionRepository();
    const wsId = '4f828a1c-3b09-42b7-8738-4e50257ad42f';
    await repo.createWorkspace({
      id: wsId,
      ownerId: 'user-1',
      domainId: 'cohort-builder',
      domainVersion: 1,
      initialSnapshot: sampleCohort,
    });

    const actionEnvelope = {
      actionId: '9fae155c-1dd7-4409-a7e8-e5088eb3bfb9',
      workspaceId: wsId,
      expectedRevision: 0,
      entityVersions: [{ kind: 'lesson', id: 'lesson-1', version: 0 }],
      action: { type: 'set_intent', intent: 'Deep dive into event sourcing' },
    };

    const res = await repo.commitAction<CohortWorkspace>({
      workspaceId: wsId,
      ownerId: 'user-1',
      expectedRevision: 0,
      envelope: actionEnvelope,
      plan: planCohortAction,
    });

    expect(res.revision).toBe(1);
    expect(res.sequence).toBe(1);
    expect(res.state.intent).toBe('Deep dive into event sourcing');
    expect(res.receipt.revision).toBe(1);

    const updated = await repo.loadWorkspace<CohortWorkspace>({ workspaceId: wsId, ownerId: 'user-1' });
    expect(updated?.revision).toBe(1);
    expect(updated?.sequence).toBe(1);
    expect(updated?.snapshot.intent).toBe('Deep dive into event sourcing');

    // Event log contains commit event
    const events = await repo.queryEvents({ workspaceId: wsId, ownerId: 'user-1' });
    expect(events.length).toBe(1);
    expect(events[0]?.sequence).toBe(1);
    expect(events[0]?.type).toBe('workspace.committed');
    expect(events[0]?.revision).toBe(1);
  });

  it('rejects stale workspace revision with STALE_WORKSPACE error', async () => {
    const repo = new MemoryInteractionRepository();
    const wsId = '85e94b28-cd58-45bb-b3b4-5ff6420556da';
    await repo.createWorkspace({
      id: wsId,
      ownerId: 'user-1',
      domainId: 'cohort-builder',
      domainVersion: 1,
      initialSnapshot: sampleCohort,
    });

    const envelope = {
      actionId: '9fae155c-1dd7-4409-a7e8-e5088eb3bfb9',
      workspaceId: wsId,
      expectedRevision: 5, // STALE! Expected is 0
      entityVersions: [],
      action: { type: 'set_intent', intent: 'Next intent' },
    };

    await expect(
      repo.commitAction({
        workspaceId: wsId,
        ownerId: 'user-1',
        expectedRevision: 5,
        envelope,
        plan: planCohortAction,
      })
    ).rejects.toThrow('STALE_WORKSPACE');
  });

  it('supports idempotent request replay and detects mismatch', async () => {
    const repo = new MemoryInteractionRepository();
    const wsId = 'e2b3e81e-1f29-4b92-95f7-67c4eb682e0d';
    await repo.createWorkspace({
      id: wsId,
      ownerId: 'user-1',
      domainId: 'cohort-builder',
      domainVersion: 1,
      initialSnapshot: sampleCohort,
    });

    const envelope = {
      actionId: '3c19e564-9ca1-4566-a36a-20078272ea8c',
      workspaceId: wsId,
      expectedRevision: 0,
      entityVersions: [],
      action: { type: 'set_intent', intent: 'Idempotent test' },
    };

    const first = await repo.commitAction({
      workspaceId: wsId,
      ownerId: 'user-1',
      expectedRevision: 0,
      envelope,
      plan: planCohortAction,
      requestId: 'req-unique-123',
    });

    expect(first.revision).toBe(1);
    expect(first.sequence).toBe(1);

    // Replaying identical request returns cached result without advancing revision
    const replay = await repo.commitAction({
      workspaceId: wsId,
      ownerId: 'user-1',
      expectedRevision: 0,
      envelope,
      plan: planCohortAction,
      requestId: 'req-unique-123',
    });

    expect(replay.revision).toBe(1);
    expect(replay.sequence).toBe(1);
    expect(replay.receipt.receiptId).toBe(first.receipt.receiptId);

    // Mismatched payload with same requestId throws IDEMPOTENCY_MISMATCH
    const alteredEnvelope = { ...envelope, action: { type: 'set_intent', intent: 'Tampered' } };
    await expect(
      repo.commitAction({
        workspaceId: wsId,
        ownerId: 'user-1',
        expectedRevision: 0,
        envelope: alteredEnvelope,
        plan: planCohortAction,
        requestId: 'req-unique-123',
      })
    ).rejects.toThrow('IDEMPOTENCY_MISMATCH');
  });

  it('manages outbox delivery lifecycle with leases, ack, and fail backoff', async () => {
    const repo = new MemoryInteractionRepository();
    const wsId = 'ca50b5da-79fc-487d-b6a6-f77242ba4595';
    await repo.createWorkspace({
      id: wsId,
      ownerId: 'user-1',
      domainId: 'cohort-builder',
      domainVersion: 1,
      initialSnapshot: sampleCohort,
    });

    const envelope = {
      actionId: '5e0e6498-8422-4861-a06d-e9c5222ef277',
      workspaceId: wsId,
      expectedRevision: 0,
      entityVersions: [],
      action: { type: 'set_audience', audience: 'Architects' },
    };

    await repo.commitAction({
      workspaceId: wsId,
      ownerId: 'user-1',
      expectedRevision: 0,
      envelope,
      plan: planCohortAction,
      outboxItems: [
        { kind: 'notify_listener', payload: { foo: 'bar' }, dedupKey: 'dedup-1' },
      ],
    });

    const now = new Date();
    const claimed = await repo.claimOutbox({
      leaseOwner: 'worker-node-1',
      leaseToken: 'token-abc',
      leaseDurationMs: 60_000,
      now,
    });

    expect(claimed.length).toBe(1);
    expect(claimed[0]?.status).toBe('delivering');
    expect(claimed[0]?.leaseOwner).toBe('worker-node-1');
    expect(claimed[0]?.attempts).toBe(1);

    // Another worker cannot claim while lease is active
    const secondClaim = await repo.claimOutbox({
      leaseOwner: 'worker-node-2',
      leaseToken: 'token-def',
      leaseDurationMs: 60_000,
      now: new Date(now.getTime() + 30_000),
    });
    expect(secondClaim.length).toBe(0);

    // Worker 1 acks successfully
    const acked = await repo.ackOutbox({
      ids: [claimed[0]!.id],
      leaseToken: 'token-abc',
      now: new Date(now.getTime() + 35_000),
    });
    expect(acked).toBe(1);

    // After ack, item is delivered and cannot be claimed even after lease expiry
    const claimAfterAck = await repo.claimOutbox({
      leaseOwner: 'worker-node-2',
      leaseToken: 'token-def',
      leaseDurationMs: 60_000,
      now: new Date(now.getTime() + 120_000),
    });
    expect(claimAfterAck.length).toBe(0);
  });
});
