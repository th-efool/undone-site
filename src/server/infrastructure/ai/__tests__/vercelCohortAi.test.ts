import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { MockLanguageModelV4 } from 'ai/test';
import { VercelCohortAi } from '../vercelCohortAi';
import { createCohortModel } from '../modelRegistry';
import { candidate, intent, intentProposal, modelOutput } from '@/src/shared/cohort-creation/__tests__/fixtures';

describe('Vercel SDK creation adapter', () => {
  it('releases each durable model slot after success and schema repair', async () => {
    const release = vi.fn(async () => {});
    const beforeCall = vi.fn(async () => release);
    const model = new MockLanguageModelV4({ doGenerate: [modelOutput({ topic: 'bad' }), modelOutput(intentProposal)] });
    await new VercelCohortAi(model, { maxRetries: 0, beforeCall }).interpret(intent.rawQuery, new AbortController().signal);
    expect(beforeCall).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledTimes(2);
  });
  it('preserves durable reservation failures without starting or remapping provider work', async () => {
    const model = new MockLanguageModelV4({ doGenerate: modelOutput(intentProposal) });
    const failure = new Error('lease lost');
    const ai = new VercelCohortAi(model, { maxRetries: 0, beforeCall: async () => { throw failure; } });
    await expect(ai.interpret(intent.rawQuery, new AbortController().signal)).rejects.toBe(failure);
    expect(model.doGenerateCalls).toHaveLength(0);
  });
  it('uses real SDK structured validation and does not infer unknown user fields', async () => {
    const model = new MockLanguageModelV4({ doGenerate: modelOutput(intentProposal) });
    expect(await new VercelCohortAi(model).interpret(intent.rawQuery, new AbortController().signal)).toEqual(intentProposal);
    expect(model.doGenerateCalls[0].responseFormat?.type).toBe('json');
  });
  it('repairs malformed schema output once and rejects repeated invalid output', async () => {
    const repair = new MockLanguageModelV4({ doGenerate: [modelOutput({ topic: 'bad' }), modelOutput(intentProposal)] });
    await expect(new VercelCohortAi(repair).interpret(intent.rawQuery, new AbortController().signal)).resolves.toEqual(intentProposal);
    expect(repair.doGenerateCalls).toHaveLength(2);
    const invalid = new MockLanguageModelV4({ doGenerate: modelOutput({ topic: 'bad' }) });
    await expect(new VercelCohortAi(invalid).interpret(intent.rawQuery, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT' } });
    expect(invalid.doGenerateCalls).toHaveLength(2);
  });
  it('rejects invented and duplicate candidate IDs after valid JSON generation', async () => {
    for (const matches of [[{ candidateKey: 'invented', reason: 'x' }], [{ candidateKey: candidate.cohortId, reason: 'x' }, { candidateKey: candidate.cohortId, reason: 'x' }]]) {
      const ai = new VercelCohortAi(new MockLanguageModelV4({ doGenerate: modelOutput({ matches }) }));
      await expect(ai.rank(intent, [candidate], new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT' } });
    }
  });
  it('aborts without starting provider work and sanitizes provider exceptions', async () => {
    const model = new MockLanguageModelV4({ doGenerate: async () => { throw new Error('private-provider-payload'); } });
    const ai = new VercelCohortAi(model);
    const controller = new AbortController(); controller.abort();
    await expect(ai.interpret(intent.rawQuery, controller.signal)).rejects.toMatchObject({ detail: { code: 'CANCELLED' } });
    expect(model.doGenerateCalls).toHaveLength(0);
    await expect(ai.interpret(intent.rawQuery, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'AI_UNAVAILABLE', message: 'Recommendations are temporarily unavailable. Try again.' } });
  });
  it('bounds ranking input while preserving authoritative hydration outside the adapter', async () => {
    const model = new MockLanguageModelV4({ doGenerate: modelOutput({ matches: [] }) });
    const candidates = Array.from({ length: 50 }, (_, i) => ({ ...candidate, cohortId: `cohort${i}`, description: 'x'.repeat(10000) }));
    await new VercelCohortAi(model).rank(intent, candidates, new AbortController().signal);
    expect(JSON.stringify(model.doGenerateCalls[0].prompt).length).toBeLessThan(16000);
  });
  it('requires a key and allows the configured model to change without task/UI changes', () => {
    expect(() => createCohortModel({})).toThrow('not configured');
    expect(createCohortModel({ apiKey: 'test', modelId: 'replacement-model' })).toMatchObject({ modelId: 'replacement-model' });
  });
});
