import 'server-only';
import { createAiSdkModelAdapter } from 'interaction-builder/adapters/ai';
import { createCohortModel } from './modelRegistry';

let fixtureTurn = 0;
/** Explicit local fixture only; production always uses the installed provider adapter. */
export async function createInteractionModelAdapter(selected?: { id: string } | null) {
  if (process.env.INTERACTION_LOCAL_MODEL_FIXTURE !== '1') return createAiSdkModelAdapter(createCohortModel());
  const database = new URL(process.env.DATABASE_URL ?? '');
  if (process.env.NODE_ENV !== 'development' || !['127.0.0.1', 'localhost'].includes(database.hostname)
    || !database.pathname.startsWith('/s3test')) throw new Error('LOCAL_MODEL_FIXTURE_FORBIDDEN');
  const turns = JSON.parse(process.env.INTERACTION_LOCAL_MODEL_SCRIPT ?? '[]') as Array<{ tool: string; input: Record<string, unknown>; text: string }>;
  const turn = turns[fixtureTurn++];
  if (!turn) throw new Error('LOCAL_MODEL_FIXTURE_EXHAUSTED');
  const input = { ...turn.input };
  if (input.lessonId === '$selected') {
    if (!selected) throw new Error('LOCAL_MODEL_SELECTION_MISSING');
    input.lessonId = selected.id;
  }
  const { MockLanguageModelV4 } = await import('ai/test');
  let step = 0;
  return createAiSdkModelAdapter(new MockLanguageModelV4({ doGenerate: async () => ({
    content: ++step === 1 ? [{ type: 'tool-call', toolCallId: `fixture-${fixtureTurn}`, toolName: turn.tool, input: JSON.stringify(input) }]
      : [{ type: 'text', text: turn.text }],
    finishReason: { unified: step === 1 ? 'tool-calls' : 'stop', raw: step === 1 ? 'tool-calls' : 'stop' },
    usage: { inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 0, text: 0, reasoning: 0 } }, warnings: [],
  }) }));
}
