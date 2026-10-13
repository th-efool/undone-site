import { describe, expect, it } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { MemoryInteractionRepository, createInteractionHandlers, runAssistantTurn } from 'interaction-builder/runtime';
import { createAiSdkModelAdapter } from 'interaction-builder/adapters/ai';
import { createCohortAiTools } from '@/src/server/domain/cohort-builder/tools';
import { cohortDomain } from '@/src/server/domain/cohort-builder/domain';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

const initialSnapshot: CohortWorkspace = {
  schemaVersion: 1,
  title: 'Backend Engineering',
  intent: 'Learn basic backend',
  audience: 'Beginners',
  dailyMinutes: 20,
  lessons: [
    {
      id: 'lesson-1',
      version: 0,
      title: 'HTTP Basics',
      objective: 'Understand requests and responses',
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

const defaultUsage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 10, text: 10, reasoning: 0 },
};

describe('S2 Durability: Scheduling, Leases, Fencing, Replay, and Proposals', () => {
  const WS = '7b91950e-561b-4fbc-bdf5-d4e51147a4f9';
  const OWNER = 'test-owner-1';

  async function createFixture() {
    const repo = new MemoryInteractionRepository();
    const handlers = createInteractionHandlers({
      repo,
      domains: new Map([[cohortDomain.id, cohortDomain]]),
    });
    await handlers.createWorkspace(OWNER, {
      workspaceId: WS,
      domainId: 'cohort',
      bootstrap: initialSnapshot,
    });
    return { repo, handlers };
  }

  it('1. One submitted message produces one scheduled run with atomic outbox intent', async () => {
    const { repo, handlers } = await createFixture();

    const res = await handlers.sendMessage(OWNER, WS, 'req-msg-1', {
      id: crypto.randomUUID(),
      parts: [{ type: 'text', text: 'Add a Docker lesson' }],
    });

    expect(res.status).toBe(202);
    const body = res.body as any;
    expect(body.runId).toBeDefined();
    expect(body.cursor).toBe(1);

    // Active run is queued
    const activeRun = await repo.getActiveRun({ workspaceId: WS, ownerId: OWNER });
    expect(activeRun).not.toBeNull();
    expect(activeRun?.id).toBe(body.runId);
    expect(activeRun?.status).toBe('queued');
    expect(activeRun?.cursor).toBe(1);

    // Outbox item was created
    const outbox = await repo.claimOutbox({
      leaseOwner: 'test-worker',
      leaseToken: 'token-outbox',
      leaseDurationMs: 10_000,
    });
    expect(outbox.some(o => o.kind === 'assistant_run' && (o.payload as any).runId === body.runId)).toBe(true);

    // Repeated submission with same idempotency key returns exact same run and message without duplicate
    const retryRes = await handlers.sendMessage(OWNER, WS, 'req-msg-1', {
      id: body.message.id,
      parts: [{ type: 'text', text: 'Add a Docker lesson' }],
    });
    expect(retryRes.status).toBe(202);
    expect((retryRes.body as any).runId).toBe(body.runId);
    expect((retryRes.body as any).cursor).toBe(1);
  });

  it('2. Simultaneous /run requests do not duplicate runs or execution lanes', async () => {
    const { repo, handlers } = await createFixture();

    // Trigger two run requests simultaneously
    const [res1, res2] = await Promise.all([
      handlers.runAssistant(OWNER, WS),
      handlers.runAssistant(OWNER, WS),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const run1 = (res1.body as any).run;
    const run2 = (res2.body as any).run;
    expect(run1.id).toBe(run2.id);

    // Only one active run in repository
    const active = await repo.getActiveRun({ workspaceId: WS, ownerId: OWNER });
    expect(active?.id).toBe(run1.id);
  });

  it('3. Multiple workers cannot own the same run (lease fencing)', async () => {
    const { repo, handlers } = await createFixture();
    await handlers.sendMessage(OWNER, WS, undefined, {
      id: crypto.randomUUID(),
      parts: [{ type: 'text', text: 'Hello' }],
    });

    const runClaim1 = await repo.claimRun({
      leaseOwner: 'worker-node-1',
      leaseToken: 'token-worker-1',
      leaseDurationMs: 30_000,
      workspaceId: WS,
    });
    expect(runClaim1).not.toBeNull();
    expect(runClaim1?.leaseOwner).toBe('worker-node-1');
    expect(runClaim1?.fence).toBe(1);

    // Second worker attempts to claim the same run while first lease is valid
    const runClaim2 = await repo.claimRun({
      leaseOwner: 'worker-node-2',
      leaseToken: 'token-worker-2',
      leaseDurationMs: 30_000,
      workspaceId: WS,
    });
    expect(runClaim2).toBeNull();
  });

  it('4. Expired and cancelled workers cannot commit (fencing verification)', async () => {
    const { repo, handlers } = await createFixture();
    await handlers.sendMessage(OWNER, WS, undefined, {
      id: crypto.randomUUID(),
      parts: [{ type: 'text', text: 'Refine syllabus' }],
    });

    const claimed = await repo.claimRun({
      leaseOwner: 'worker-1',
      leaseToken: 'token-1',
      leaseDurationMs: 10_000,
      workspaceId: WS,
    });
    expect(claimed).not.toBeNull();

    // User cancels the run
    const cancelRes = await handlers.cancelRun(OWNER, WS, claimed!.id, { reason: 'User cancelled' });
    expect(cancelRes.status).toBe(200);

    // Worker attempts to commit tool action using its lease fence
    await expect(
      repo.commitAction({
        workspaceId: WS,
        ownerId: OWNER,
        expectedRevision: 0,
        envelope: {
          actionId: crypto.randomUUID(),
          workspaceId: WS,
          expectedRevision: 0,
          entityVersions: [],
          action: { type: 'set_intent', intent: 'New Intent' },
        },
        plan: cohortDomain.plan,
        runFence: { runId: claimed!.id, leaseToken: 'token-1' },
      })
    ).rejects.toThrow('RUN_CANCELED');
  });

  it('5. Worker restart after a tool commit replays cached step result without repeating mutation', async () => {
    const { repo, handlers } = await createFixture();
    await handlers.sendMessage(OWNER, WS, undefined, {
      id: crypto.randomUUID(),
      parts: [{ type: 'text', text: 'Please add a Security lesson' }],
    });

    const run = await repo.claimRun({
      leaseOwner: 'worker-1',
      leaseToken: 'token-1',
      leaseDurationMs: 30_000,
      workspaceId: WS,
    });

    // Simulate Step 1 was committed before worker crashed
    const step1Result = {
      success: true,
      revision: 1,
      summary: 'Added lesson: Security',
      changed: [{ kind: 'lesson', id: 'lesson-security', version: 0 }],
    };

    // Pre-record step 1 as completed in the journal
    await repo.recordStep({
      runId: run!.id,
      leaseToken: 'token-1',
      ordinal: 1,
      kind: 'tool_call',
      toolName: 'add_lesson',
      inputPayload: { title: 'Security', objective: 'Auth basics' },
      state: 'completed',
      result: step1Result,
    });

    // Also apply the mutation to state so state revision is 1
    await repo.commitAction({
      workspaceId: WS,
      ownerId: OWNER,
      expectedRevision: 0,
      envelope: {
        actionId: crypto.randomUUID(),
        workspaceId: WS,
        expectedRevision: 0,
        entityVersions: [],
        action: { type: 'add_lesson', lessonId: 'lesson-security', title: 'Security', objective: 'Auth basics' },
      },
      plan: cohortDomain.plan,
      runFence: { runId: run!.id, leaseToken: 'token-1' },
    });

    const wsAfterCrash = await repo.loadWorkspace<CohortWorkspace>({ workspaceId: WS, ownerId: OWNER });
    expect(wsAfterCrash?.snapshot.lessons).toHaveLength(2);
    expect(wsAfterCrash?.revision).toBe(1);

    // Now second worker takes over and resumes runAssistantTurn
    let step = 0;
    let toolExecutionCount = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        step += 1;
        if (step === 1) {
          return {
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'add_lesson',
                input: JSON.stringify({ title: 'Security', objective: 'Auth basics' }),
              },
            ],
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            usage: defaultUsage,
            warnings: [],
          };
        }
        return {
          content: [{ type: 'text', text: 'I have added the Security lesson.' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: defaultUsage,
          warnings: [],
        };
      },
    });

    const res = await runAssistantTurn({
      workspaceId: WS,
      ownerId: OWNER,
      repo,
      domain: cohortDomain,
      model: createAiSdkModelAdapter(model),
      createTools: (deps) => {
        const tools = createCohortAiTools(deps);
        // Intercept tool to verify whether underlying commitAction executed again
        const origAdd = tools.add_lesson;
        return {
          ...tools,
          add_lesson: {
            ...origAdd,
            execute: async (args: any) => {
              toolExecutionCount += 1;
              return origAdd.execute!(args, {} as any);
            },
          },
        };
      },
      runId: run!.id,
      leaseToken: 'token-1',
    });

    expect(res.success).toBe(true);

    // Verify: The lesson was NOT duplicated!
    const wsFinal = await repo.loadWorkspace<CohortWorkspace>({ workspaceId: WS, ownerId: OWNER });
    expect(wsFinal?.snapshot.lessons).toHaveLength(2); // Still 2, not 3!
    expect(wsFinal?.revision).toBe(1); // Revision was not advanced again!
  });

  it('6. UI edits made while model is deliberating trigger STALE_WORKSPACE rejection', async () => {
    const { repo, handlers } = await createFixture();
    await handlers.sendMessage(OWNER, WS, undefined, {
      id: crypto.randomUUID(),
      parts: [{ type: 'text', text: 'Adjust daily minutes to 30' }],
    });

    const run = await repo.claimRun({
      leaseOwner: 'worker-1',
      leaseToken: 'token-1',
      leaseDurationMs: 30_000,
      workspaceId: WS,
    });

    // While model is thinking, user manually edits the workspace via direct UI action
    await handlers.commitAction(OWNER, undefined, {
      actionId: crypto.randomUUID(),
      workspaceId: WS,
      expectedRevision: 0,
      entityVersions: [],
      action: { type: 'set_daily_minutes', dailyMinutes: 50 },
    });

    const wsNow = await repo.loadWorkspace<CohortWorkspace>({ workspaceId: WS, ownerId: OWNER });
    expect(wsNow?.revision).toBe(1);
    expect(wsNow?.snapshot.dailyMinutes).toBe(50);

    // Model tries to commit with its observed revision 0
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'set_daily_minutes',
            input: JSON.stringify({ dailyMinutes: 30 }),
          },
        ],
        finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
        usage: defaultUsage,
        warnings: [],
      }),
    });

    // The runner executes; the tool call is rejected with STALE_WORKSPACE
    await expect(
      runAssistantTurn({
        workspaceId: WS,
        ownerId: OWNER,
        repo,
        domain: cohortDomain,
        model: createAiSdkModelAdapter(model),
        createTools: createCohortAiTools,
        runId: run!.id,
        leaseToken: 'token-1',
        maxSteps: 1,
      })
    ).rejects.toThrow('STALE_WORKSPACE');

    // Journal recorded the failed tool step due to STALE_WORKSPACE
    const steps = await repo.listSteps({ runId: run!.id });
    const failedToolStep = steps.find(s => s.kind === 'tool_call' && s.state === 'failed');
    expect(failedToolStep).toBeDefined();
    expect(failedToolStep?.error).toBe('STALE_WORKSPACE');

    // User edit is preserved and revision was not overwritten
    const wsPreserved = await repo.loadWorkspace<CohortWorkspace>({ workspaceId: WS, ownerId: OWNER });
    expect(wsPreserved?.snapshot.dailyMinutes).toBe(50);
    expect(wsPreserved?.revision).toBe(1);
  });

  it('7. Provider failures produce explicit recoverable failed run state', async () => {
    const { repo, handlers } = await createFixture();
    await handlers.sendMessage(OWNER, WS, undefined, {
      id: crypto.randomUUID(),
      parts: [{ type: 'text', text: 'Help me plan' }],
    });

    const run = await repo.claimRun({
      leaseOwner: 'worker-1',
      leaseToken: 'token-1',
      leaseDurationMs: 30_000,
      workspaceId: WS,
    });

    const failingModel = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error('PROVIDER_RATE_LIMIT');
      },
    });

    // Assistant run fails with error
    await expect(
      runAssistantTurn({
        workspaceId: WS,
        ownerId: OWNER,
        repo,
        domain: cohortDomain,
        model: createAiSdkModelAdapter(failingModel),
        createTools: createCohortAiTools,
        runId: run!.id,
        leaseToken: 'token-1',
      })
    ).rejects.toThrow('PROVIDER_RATE_LIMIT');

    // Worker records failure
    await repo.failRun({
      runId: run!.id,
      leaseToken: 'token-1',
      error: 'PROVIDER_RATE_LIMIT',
    });

    const failedRun = await repo.getRun({ runId: run!.id, workspaceId: WS });
    expect(failedRun?.status).toBe('failed');
    expect(failedRun?.error).toBe('PROVIDER_RATE_LIMIT');

    // Journal contains the failed model step
    const steps = await repo.listSteps({ runId: run!.id });
    expect(steps.some(s => s.kind === 'model_call' && s.state === 'failed')).toBe(true);
  });

  it('8. Proposals enforce lifecycle, decisions, and pins on compensating undo', async () => {
    const { repo, handlers } = await createFixture();

    // 1. Create a proposal
    const prop = await repo.createProposal({
      workspaceId: WS,
      ownerId: OWNER,
      summary: 'Propose audience change to Advanced Devs',
      actionPayload: { type: 'set_audience', audience: 'Advanced Devs' },
    });
    expect(prop.state).toBe('pending');

    // 2. Decide proposal via handlers
    const decisionRes = await handlers.decideProposal(OWNER, WS, prop.id, { decision: 'accepted' });
    expect(decisionRes.status).toBe(200);
    expect((decisionRes.body as any).proposal.state).toBe('accepted');

    // 3. Deciding again fails with STALE_PROPOSAL
    const staleRes = await handlers.decideProposal(OWNER, WS, prop.id, { decision: 'rejected' });
    expect(staleRes.status).toBe(409);

    // 4. Test undo with pin protection:
    // Add a lesson, user pins it, attempt to undo (remove_lesson) fails with PINNED_LESSON_LOCKED
    await handlers.commitAction(OWNER, undefined, {
      actionId: crypto.randomUUID(),
      workspaceId: WS,
      expectedRevision: 0,
      entityVersions: [],
      action: { type: 'add_lesson', lessonId: 'lesson-pinned', title: 'System Architecture', objective: 'High level' },
    });

    // Pin the lesson
    await handlers.commitAction(OWNER, undefined, {
      actionId: crypto.randomUUID(),
      workspaceId: WS,
      expectedRevision: 1,
      entityVersions: [],
      action: { type: 'set_lesson_pin', lessonId: 'lesson-pinned', pinned: true },
    });

    // Attempt compensating removal of the added lesson fails because it is pinned
    await expect(
      handlers.commitAction(OWNER, undefined, {
        actionId: crypto.randomUUID(),
        workspaceId: WS,
        expectedRevision: 2,
        entityVersions: [],
        action: { type: 'remove_lesson', lessonId: 'lesson-pinned' },
      })
    ).resolves.toMatchObject({
      status: 422,
      body: { code: 'INVALID_ACTION', message: 'PINNED_LESSON_LOCKED' },
    });
  });
});
