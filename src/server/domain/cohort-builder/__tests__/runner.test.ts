import { describe, expect, it } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { MemoryInteractionRepository, runAssistantTurn, type DomainDefinition } from 'interaction-builder/runtime';
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
});
