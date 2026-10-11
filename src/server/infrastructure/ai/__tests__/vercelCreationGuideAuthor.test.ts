import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { MockLanguageModelV4 } from 'ai/test';
import { intent, modelOutput } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { JobBudgetExceeded } from '@/src/server/domain/cohort-creation/durable-job';
import { VercelCreationGuideAuthor } from '../vercelCreationGuideAuthor';
const proposal = { title: 'Light transport', sections: [{ heading: 'Experiment', text: 'Move a light and compare surface shading.' }], limitations: ['A short introduction, not verified external evidence.'] };
describe('structured Vercel guide author', () => {
  it('uses structured output without tools or application identifiers and releases the model reservation', async () => {
    const model = new MockLanguageModelV4({ doGenerate: modelOutput(proposal) });
    const release = vi.fn(async () => {}); const beforeCall = vi.fn(async () => release);
    const author = new VercelCreationGuideAuthor(model, { beforeCall });
    expect(await author.author(intent, new AbortController().signal)).toEqual(proposal);
    expect(author.identity.adapterVersion).toBe('vercel-guide-author-v1');
    const call = model.doGenerateCalls[0]; expect(call.responseFormat?.type).toBe('json'); expect(call.tools).toBeUndefined();
    const prompt = JSON.stringify(call.prompt); expect(prompt).not.toContain(intent.id); expect(prompt).toContain(intent.topic.value);
    expect(beforeCall).toHaveBeenCalledOnce(); expect(release).toHaveBeenCalledOnce();
  });
  it('repairs malformed output once with another reservation, refusing repeated errors', async () => {
    const model = new MockLanguageModelV4({ doGenerate: [modelOutput({ navigation: 'publish' }), modelOutput(proposal)] });
    const beforeCall = vi.fn(async () => {});
    expect(await new VercelCreationGuideAuthor(model, { beforeCall }).author(intent, new AbortController().signal)).toEqual(proposal);
    expect(beforeCall).toHaveBeenCalledTimes(2);
    const broken = new MockLanguageModelV4({ doGenerate: modelOutput({ ...proposal, sections: [{ heading: 'Reference', text: 'https://fake.example' }] }) });
    await expect(new VercelCreationGuideAuthor(broken, { beforeCall }).author(intent, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT' } });
    expect(broken.doGenerateCalls).toHaveLength(2);
  });
  it('does not repair truncation or leak provider errors', async () => {
    const model = new MockLanguageModelV4({ doGenerate: { ...modelOutput(proposal), finishReason: { unified: 'length', raw: 'MAX_TOKENS' } } });
    await expect(new VercelCreationGuideAuthor(model, { beforeCall: async () => {} }).author(intent, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT', retryable: false } });
    expect(model.doGenerateCalls).toHaveLength(1);
    const failed = new MockLanguageModelV4({ doGenerate: async () => { throw new Error('provider-private-body'); } });
    await expect(new VercelCreationGuideAuthor(failed, { beforeCall: async () => {} }).author(intent, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'AI_UNAVAILABLE', message: 'Guide generation is unavailable. The learning goal remains saved.' } });
  });
  it('preserves budget failures and cancellation without invoking the model', async () => {
    const model = new MockLanguageModelV4({ doGenerate: modelOutput(proposal) }); const failure = new JobBudgetExceeded();
    const beforeCall = vi.fn(async () => { throw failure; }); const author = new VercelCreationGuideAuthor(model, { beforeCall });
    await expect(author.author(intent, new AbortController().signal)).rejects.toBe(failure);
    const controller = new AbortController(); controller.abort();
    await expect(author.author(intent, controller.signal)).rejects.toThrow();
    expect(model.doGenerateCalls).toHaveLength(0); expect(beforeCall).toHaveBeenCalledOnce();
  });
});
