import 'server-only';
import { createAiSdkModelAdapter } from 'interaction-builder/adapters/ai';
import { createCohortModel } from './modelRegistry';
import { devLogger } from '@/src/shared/lib/dev-logger';

let fixtureTurn = 0;
/** Explicit local fixture only; production always uses the installed provider adapter. */
export async function createInteractionModelAdapter(selected?: { id: string } | null, execution?: { signal: AbortSignal; runId: string; workspaceId: string }) {
  if (process.env.INTERACTION_LOCAL_MODEL_FIXTURE !== '1') {
    const model = createCohortModel({ apiKey: process.env.GEMINI_API_KEY, modelId: process.env.COHORT_CHAT_MODEL || 'gemini-3.5-flash-lite' });
    const adapter = createAiSdkModelAdapter(model, {
      maxRetries: 0, timeoutMs: 20_000, maxOutputTokens: 1200, signal: execution?.signal,
    });
    return { async executeTurn(input: Parameters<typeof adapter.executeTurn>[0]) {
      const started = performance.now();
      const context = { runId: execution?.runId, workspaceId: execution?.workspaceId, model: typeof model === 'string' ? model : model.modelId };
      devLogger.info('InteractionModel', 'model_started', context);
      try {
        const result = await adapter.executeTurn(input);
        devLogger.info('InteractionModel', 'model_completed', { ...context, durationMs: performance.now() - started, steps: result.stepsCount });
        return result;
      } catch (error) {
        devLogger.error('InteractionModel', 'model_failed', { ...context, durationMs: performance.now() - started, error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    } };
  }
  const database = new URL(process.env.DATABASE_URL ?? '');
  if (process.env.NODE_ENV !== 'development' || !['127.0.0.1', 'localhost'].includes(database.hostname)
    || !database.pathname.startsWith('/s3test')) throw new Error('LOCAL_MODEL_FIXTURE_FORBIDDEN');
  const turns = JSON.parse(process.env.INTERACTION_LOCAL_MODEL_SCRIPT ?? '[]') as Array<{ tool: string; input: Record<string, unknown>; text: string; delayMs?: number }>;
  const turn = turns[fixtureTurn++];
  if (!turn) throw new Error('LOCAL_MODEL_FIXTURE_EXHAUSTED');
  if (turn.delayMs !== undefined) {
    if (!Number.isSafeInteger(turn.delayMs) || turn.delayMs < 0 || turn.delayMs > 10_000) throw new Error('LOCAL_MODEL_FIXTURE_DELAY_INVALID');
    await new Promise(resolve => setTimeout(resolve, turn.delayMs));
  }
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
