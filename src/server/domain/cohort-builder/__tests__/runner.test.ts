import { describe, expect, it } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { MemoryInteractionRepository, runAssistantTurn, deterministicUuid, type DomainDefinition } from 'interaction-builder/runtime';
import { createAiSdkModelAdapter } from 'interaction-builder/adapters/ai';
import { createCohortAiTools } from '@/src/server/domain/cohort-builder/tools';
import {
  cohortWorkspaceSchema,
  planCohortAction,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';

const cohortDomain: DomainDefinition<CohortWorkspace> = {
  id: 'cohort',
  version: 1,
  initialState: b => cohortWorkspaceSchema.parse(b),
  plan: planCohortAction,
};

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

const WS = '7b91950e-561b-4fbc-bdf5-d4e51147a4f9';

describe('Cohort Assistant Runner (Chat ↔ Right Workspace Sync)', () => {
  it('executes model tool calls against commitAction and appends assistant response', async () => {
    const repo = new MemoryInteractionRepository();
    await repo.createWorkspace({
      id: WS,
      ownerId: 'user-1',
      domainId: 'cohort',
      domainVersion: 1,
      initialSnapshot,
    });

    // 1. User sends message in chat
    await repo.appendMessage({
      workspaceId: WS,
      ownerId: 'user-1',
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: 'Please upgrade this to Distributed Systems with 45 minutes daily.' }],
    });

    const defaultUsage = {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 10, text: 10, reasoning: 0 },
    };

    let step = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        step += 1;
        if (step === 1) {
          return {
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'set_intent',
                input: JSON.stringify({ intent: 'Master Distributed Systems' }),
              },
            ],
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            usage: defaultUsage,
            warnings: [],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: 'I have updated the cohort intent to "Master Distributed Systems".',
            },
          ],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: defaultUsage,
          warnings: [],
        };
      },
    });

    const result = await runAssistantTurn({
      workspaceId: WS,
      ownerId: 'user-1',
      repo,
      domain: cohortDomain,
      model: createAiSdkModelAdapter(model),
      createTools: createCohortAiTools,
    });

    expect(result.success).toBe(true);
    expect(result.text).toContain('Master Distributed Systems');

    // 3. Right workspace updated via commitAction!
    const ws = await repo.loadWorkspace<CohortWorkspace>({ workspaceId: WS, ownerId: 'user-1' });
    expect(ws?.revision).toBe(1);
    expect(ws?.snapshot.intent).toBe('Master Distributed Systems');

    // 4. Transcript contains user message and assistant message
    const messages = await repo.listMessages({ workspaceId: WS, ownerId: 'user-1' });
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('user');
    expect(messages[1]?.role).toBe('assistant');
    expect((messages[1]?.parts[0] as { text: string }).text).toContain('Master Distributed Systems');

    // 5. Events contain commit and message events
    const events = await repo.queryEvents({ workspaceId: WS, ownerId: 'user-1' });
    const types = events.map(e => e.type);
    expect(types).toContain('message.accepted');
    expect(types).toContain('workspace.committed');
  });

  it('subsequent assistant turn sees updated right-side state from manual direct edits', async () => {
    const repo = new MemoryInteractionRepository();
    await repo.createWorkspace({
      id: WS,
      ownerId: 'user-1',
      domainId: 'cohort',
      domainVersion: 1,
      initialSnapshot,
    });

    // Direct UI action on right side: user manually edits audience
    await repo.commitAction({
      workspaceId: WS,
      ownerId: 'user-1',
      expectedRevision: 0,
      envelope: {
        actionId: crypto.randomUUID(),
        workspaceId: WS,
        expectedRevision: 0,
        entityVersions: [],
        action: { type: 'set_audience', audience: 'Staff Engineers' },
      },
      plan: cohortDomain.plan,
    });

    // User types in chat
    await repo.appendMessage({
      workspaceId: WS,
      ownerId: 'user-1',
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: 'What is the current target audience?' }],
    });

    const defaultUsage = {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 10, text: 10, reasoning: 0 },
    };

    let observedSystemPrompt = '';
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        observedSystemPrompt = options.prompt
          .filter(p => p.role === 'system')
          .map(p => (typeof p.content === 'string' ? p.content : ''))
          .join('\n');
        return {
          content: [{ type: 'text', text: 'The audience is Staff Engineers.' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: defaultUsage,
          warnings: [],
        };
      },
    });

    await runAssistantTurn({
      workspaceId: WS,
      ownerId: 'user-1',
      repo,
      domain: cohortDomain,
      model: createAiSdkModelAdapter(model),
      createTools: createCohortAiTools,
    });

    // Assistant saw the manually edited right-side state!
    expect(observedSystemPrompt).toContain('Staff Engineers');
    expect(observedSystemPrompt).toContain('Revision: 1');
  });

  it('1. Executes two sequential cohort actions in one turn and advances revisions cleanly', async () => {
    const repo = new MemoryInteractionRepository();
    const wsId = crypto.randomUUID();
    await repo.createWorkspace({
      id: wsId,
      ownerId: 'user-1',
      domainId: 'cohort',
      domainVersion: 1,
      initialSnapshot,
    });

    await repo.appendMessage({
      workspaceId: wsId,
      ownerId: 'user-1',
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: 'Set intent to Full Stack and add an SQL lesson' }],
    });

    const defaultUsage = {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 10, text: 10, reasoning: 0 },
    };

    let step = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        step += 1;
        if (step === 1) {
          return {
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'set_intent',
                input: JSON.stringify({ intent: 'Full Stack Mastery' }),
              },
            ],
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            usage: defaultUsage,
            warnings: [],
          };
        }
        if (step === 2) {
          return {
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-2',
                toolName: 'add_lesson',
                input: JSON.stringify({ title: 'SQL Fundamentals', objective: 'Joins and Indexes' }),
              },
            ],
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            usage: defaultUsage,
            warnings: [],
          };
        }
        return {
          content: [{ type: 'text', text: 'Intent updated and SQL lesson added.' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: defaultUsage,
          warnings: [],
        };
      },
    });

    const res = await runAssistantTurn({
      workspaceId: wsId,
      ownerId: 'user-1',
      repo,
      domain: cohortDomain,
      model: createAiSdkModelAdapter(model),
      createTools: createCohortAiTools,
    });

    expect(res.success).toBe(true);
    expect(res.stepsCount).toBe(3);

    const wsFinal = await repo.loadWorkspace<CohortWorkspace>({ workspaceId: wsId, ownerId: 'user-1' });
    expect(wsFinal?.revision).toBe(2);
    expect(wsFinal?.snapshot.intent).toBe('Full Stack Mastery');
    expect(wsFinal?.snapshot.lessons).toHaveLength(2);
    expect(wsFinal?.snapshot.lessons[1].title).toBe('SQL Fundamentals');
  });

  it('2. Intervening external UI edit causes STALE_WORKSPACE rejection on subsequent action', async () => {
    const repo = new MemoryInteractionRepository();
    const wsId = crypto.randomUUID();
    await repo.createWorkspace({
      id: wsId,
      ownerId: 'user-1',
      domainId: 'cohort',
      domainVersion: 1,
      initialSnapshot,
    });

    await repo.appendMessage({
      workspaceId: wsId,
      ownerId: 'user-1',
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: 'Set intent to AI Engineering and daily minutes to 60' }],
    });

    const defaultUsage = {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 10, text: 10, reasoning: 0 },
    };

    let step = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        step += 1;
        if (step === 1) {
          return {
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'set_intent',
                input: JSON.stringify({ intent: 'AI Engineering' }),
              },
            ],
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            usage: defaultUsage,
            warnings: [],
          };
        }
        if (step === 2) {
          return {
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-2',
                toolName: 'set_daily_minutes',
                input: JSON.stringify({ dailyMinutes: 60 }),
              },
            ],
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            usage: defaultUsage,
            warnings: [],
          };
        }
        return {
          content: [{ type: 'text', text: 'All done.' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: defaultUsage,
          warnings: [],
        };
      },
    });

    // Custom tool creator that injects an external UI edit immediately after step 1 commits
    let stepCount = 0;
    const toolsWithInterveningUiEdit = (deps: any) => {
      const tools = createCohortAiTools(deps);
      const origIntent = tools.set_intent;
      return {
        ...tools,
        set_intent: {
          ...origIntent,
          execute: async (args: any) => {
            const out = await origIntent.execute!(args, {} as any);
            // Simulate external UI edit in browser bumping revision from 1 to 2
            await repo.commitAction({
              workspaceId: wsId,
              ownerId: 'user-1',
              expectedRevision: 1,
              envelope: {
                actionId: crypto.randomUUID(),
                workspaceId: wsId,
                expectedRevision: 1,
                entityVersions: [],
                action: { type: 'set_audience', audience: 'Intervening Browser User' },
              },
              plan: cohortDomain.plan,
            });
            return out;
          },
        },
      };
    };

    // Assistant turn will fail at step 2 because workspace is now at revision 2,
    // but the run only knows revision 1!
    await expect(
      runAssistantTurn({
        workspaceId: wsId,
        ownerId: 'user-1',
        repo,
        domain: cohortDomain,
        model: createAiSdkModelAdapter(model),
        createTools: toolsWithInterveningUiEdit,
      })
    ).rejects.toThrow('STALE_WORKSPACE');

    const wsFinal = await repo.loadWorkspace<CohortWorkspace>({ workspaceId: wsId, ownerId: 'user-1' });
    // Revision 2 preserved: intent from step 1 committed, audience from intervening edit preserved
    expect(wsFinal?.revision).toBe(2);
    expect(wsFinal?.snapshot.intent).toBe('AI Engineering');
    expect(wsFinal?.snapshot.audience).toBe('Intervening Browser User');
    // dailyMinutes was NOT updated to 60 because step 2 was rejected
    expect(wsFinal?.snapshot.dailyMinutes).toBe(20);
  });

  it('3. Failure after action commit before journal completion: recovers without re-mutation or IDEMPOTENCY_MISMATCH and commits next action', async () => {
    const repo = new MemoryInteractionRepository();
    const wsId = crypto.randomUUID();
    await repo.createWorkspace({
      id: wsId,
      ownerId: 'user-1',
      domainId: 'cohort',
      domainVersion: 1,
      initialSnapshot,
    });

    await repo.appendMessage({
      workspaceId: wsId,
      ownerId: 'user-1',
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: 'Add Cloud Architecture lesson and set daily minutes to 45' }],
    });

    const run = await repo.scheduleRun({ workspaceId: wsId, ownerId: 'user-1' });
    const leaseToken1 = 'lease-token-worker-1';
    await repo.claimRun({
      workspaceId: wsId,
      leaseOwner: 'worker-1',
      leaseToken: leaseToken1,
      leaseDurationMs: 60_000,
    });

    const defaultUsage = {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 10, text: 10, reasoning: 0 },
    };

    // Inject failure: repo.recordStep throws when attempting to record step 1 as 'completed'
    let crashTriggered = false;
    const origRecordStep = repo.recordStep.bind(repo);
    repo.recordStep = async (params) => {
      if (params.ordinal === 1 && params.state === 'completed' && !crashTriggered) {
        crashTriggered = true;
        throw new Error('CRASH_BEFORE_JOURNAL_COMPLETION');
      }
      return origRecordStep(params);
    };

    const makeModel = () => {
      let step = 0;
      return new MockLanguageModelV4({
        doGenerate: async () => {
          step += 1;
          if (step === 1) {
            return {
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'add_lesson',
                  input: JSON.stringify({ title: 'Cloud Architecture', objective: 'AWS basics' }),
                },
              ],
              finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
              usage: defaultUsage,
              warnings: [],
            };
          }
          if (step === 2) {
            return {
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 'call-2',
                  toolName: 'set_daily_minutes',
                  input: JSON.stringify({ dailyMinutes: 45 }),
                },
              ],
              finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
              usage: defaultUsage,
              warnings: [],
            };
          }
          return {
            content: [{ type: 'text', text: 'Cloud Architecture added and daily minutes set to 45.' }],
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: defaultUsage,
            warnings: [],
          };
        },
      });
    };

    // Worker 1 runs and crashes during recordStep of step 1
    await expect(
      runAssistantTurn({
        workspaceId: wsId,
        ownerId: 'user-1',
        repo,
        domain: cohortDomain,
        model: createAiSdkModelAdapter(makeModel()),
        createTools: createCohortAiTools,
        runId: run.id,
        leaseToken: leaseToken1,
      })
    ).rejects.toThrow('CRASH_BEFORE_JOURNAL_COMPLETION');

    // Mutation DID commit to database before the journal crash!
    const wsAtCrash = await repo.loadWorkspace<CohortWorkspace>({ workspaceId: wsId, ownerId: 'user-1' });
    expect(wsAtCrash?.revision).toBe(1);
    expect(wsAtCrash?.snapshot.lessons).toHaveLength(2);
    expect(wsAtCrash?.snapshot.lessons[1].title).toBe('Cloud Architecture');

    // Step 1 in journal is NOT completed (was only 'started')
    const stepsAtCrash = await repo.listSteps({ runId: run.id });
    expect(stepsAtCrash.some(s => s.ordinal === 1 && s.state === 'completed')).toBe(false);

    // Replacement worker takes over with a new lease token
    const leaseToken2 = 'lease-token-worker-2';
    // Expire old lease and re-claim
    const runClaimed = await repo.claimRun({
      workspaceId: wsId,
      leaseOwner: 'worker-2',
      leaseToken: leaseToken2,
      leaseDurationMs: 60_000,
      now: new Date(Date.now() + 65_000),
    });
    expect(runClaimed).not.toBeNull();

    // Run recovery turn with new worker
    const recoveryRes = await runAssistantTurn({
      workspaceId: wsId,
      ownerId: 'user-1',
      repo,
      domain: cohortDomain,
      model: createAiSdkModelAdapter(makeModel()),
      createTools: createCohortAiTools,
      runId: run.id,
      leaseToken: leaseToken2,
    });

    expect(recoveryRes.success).toBe(true);
    expect(recoveryRes.text).toContain('Cloud Architecture added and daily minutes set to 45');

    const wsFinal = await repo.loadWorkspace<CohortWorkspace>({ workspaceId: wsId, ownerId: 'user-1' });
    // Final revision should be 2:
    // Step 1 deduplicated against interaction_requests without re-mutating or adding duplicate lesson
    // Step 2 committed at revision 1 -> bumped to 2
    expect(wsFinal?.revision).toBe(2);
    expect(wsFinal?.snapshot.lessons).toHaveLength(2); // Still exactly 2 lessons!
    expect(wsFinal?.snapshot.dailyMinutes).toBe(45);

    // Journal now records both steps as completed
    const finalSteps = await repo.listSteps({ runId: run.id });
    expect(finalSteps.some(s => s.ordinal === 1 && s.state === 'completed')).toBe(true);
    expect(finalSteps.some(s => s.ordinal === 2 && s.state === 'completed')).toBe(true);
  });

  it('4. Recovered completed steps advance revision tracking so subsequent action commits', async () => {
    const repo = new MemoryInteractionRepository();
    const wsId = crypto.randomUUID();
    await repo.createWorkspace({
      id: wsId,
      ownerId: 'user-1',
      domainId: 'cohort',
      domainVersion: 1,
      initialSnapshot,
    });

    await repo.appendMessage({
      workspaceId: wsId,
      ownerId: 'user-1',
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: 'Set intent and daily minutes' }],
    });

    const run = await repo.scheduleRun({ workspaceId: wsId, ownerId: 'user-1' });
    const leaseToken = 'token-1';
    await repo.claimRun({
      workspaceId: wsId,
      leaseOwner: 'worker-1',
      leaseToken,
      leaseDurationMs: 60_000,
    });

    // Pre-record step 1 as completed in journal
    await repo.recordStep({
      runId: run.id,
      leaseToken,
      ordinal: 1,
      kind: 'tool_call',
      toolName: 'set_intent',
      inputPayload: { intent: 'Security Architecture' },
      state: 'completed',
      result: { success: true, revision: 1, summary: 'Intent updated', changed: [] },
    });

    // Apply mutation to state so workspace revision is 1
    await repo.commitAction({
      workspaceId: wsId,
      ownerId: 'user-1',
      expectedRevision: 0,
      envelope: {
        actionId: deterministicUuid('action:step:' + run.id + ':1'),
        workspaceId: wsId,
        expectedRevision: 0,
        entityVersions: [],
        action: { type: 'set_intent', intent: 'Security Architecture' },
      },
      plan: cohortDomain.plan,
    });

    const defaultUsage = {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 10, text: 10, reasoning: 0 },
    };

    let step = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        step += 1;
        if (step === 1) {
          // Model calls tool 1 again (will be replayed from journal)
          return {
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'set_intent',
                input: JSON.stringify({ intent: 'Security Architecture' }),
              },
            ],
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            usage: defaultUsage,
            warnings: [],
          };
        }
        if (step === 2) {
          // Model calls tool 2 (new distinct action)
          return {
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-2',
                toolName: 'set_daily_minutes',
                input: JSON.stringify({ dailyMinutes: 50 }),
              },
            ],
            finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
            usage: defaultUsage,
            warnings: [],
          };
        }
        return {
          content: [{ type: 'text', text: 'Intent and minutes updated.' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: defaultUsage,
          warnings: [],
        };
      },
    });

    const res = await runAssistantTurn({
      workspaceId: wsId,
      ownerId: 'user-1',
      repo,
      domain: cohortDomain,
      model: createAiSdkModelAdapter(model),
      createTools: createCohortAiTools,
      runId: run.id,
      leaseToken,
    });

    expect(res.success).toBe(true);
    const wsFinal = await repo.loadWorkspace<CohortWorkspace>({ workspaceId: wsId, ownerId: 'user-1' });
    expect(wsFinal?.revision).toBe(2);
    expect(wsFinal?.snapshot.intent).toBe('Security Architecture');
    expect(wsFinal?.snapshot.dailyMinutes).toBe(50);
  });

  it('5. Reusing the same step requestId with different input rejects with IDEMPOTENCY_MISMATCH', async () => {
    const repo = new MemoryInteractionRepository();
    const wsId = crypto.randomUUID();
    await repo.createWorkspace({
      id: wsId,
      ownerId: 'user-1',
      domainId: 'cohort',
      domainVersion: 1,
      initialSnapshot,
    });

    const fixedRequestId = 'step:test-run:1';

    // First commit with original input
    await repo.commitAction({
      workspaceId: wsId,
      ownerId: 'user-1',
      expectedRevision: 0,
      envelope: {
        actionId: deterministicUuid('action:' + fixedRequestId),
        workspaceId: wsId,
        expectedRevision: 0,
        entityVersions: [],
        action: { type: 'set_intent', intent: 'Original Intent' },
      },
      plan: cohortDomain.plan,
      requestId: fixedRequestId,
    });

    // Attempting same requestId with DIFFERENT input throws IDEMPOTENCY_MISMATCH
    await expect(
      repo.commitAction({
        workspaceId: wsId,
        ownerId: 'user-1',
        expectedRevision: 0,
        envelope: {
          actionId: deterministicUuid('action:' + fixedRequestId),
          workspaceId: wsId,
          expectedRevision: 0,
          entityVersions: [],
          action: { type: 'set_intent', intent: 'Mismatched Different Intent' },
        },
        plan: cohortDomain.plan,
        requestId: fixedRequestId,
      })
    ).rejects.toThrow('IDEMPOTENCY_MISMATCH');
  });
});
