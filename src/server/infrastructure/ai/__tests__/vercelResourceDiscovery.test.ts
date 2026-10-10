import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { MockLanguageModelV4 } from 'ai/test';
import { VercelResourceDiscovery } from '../vercelResourceDiscovery';
import { discoveryCandidateSchema, validateGroundedSearch } from '@/src/server/domain/cohort-creation/discovery.contracts';
import { intent, modelOutput } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { JobBudgetExceeded } from '@/src/server/domain/cohort-creation/durable-job';

const candidate = discoveryCandidateSchema.parse({ key: 'a'.repeat(64), citationIds: ['citation-1'],
  url: 'https://docs.unrealengine.com/learning', title: 'Rendering documentation', kind: 'web', observedAt: new Date().toISOString() });
const citation = { type: 'source' as const, sourceType: 'url' as const, id: 'citation-1', url: candidate.url, title: candidate.title };
const searchOutput = () => ({ ...modelOutput('ignored'), content: [
  { type: 'text' as const, text: 'Invented link: https://invented.example/resource' }, citation,
], providerMetadata: { google: { groundingMetadata: { searchEntryPoint: { renderedContent: '<div>Provider search attribution</div>' } } } } });
describe('bounded Vercel grounded resource discovery', () => {
  it('uses only provider citations, one native search step and no SDK retries', async () => {
    const model = new MockLanguageModelV4({ provider: 'google.generative-ai', doGenerate: searchOutput() });
    const release = vi.fn(async () => {}); const beforeCall = vi.fn(async () => release);
    const result = await new VercelResourceDiscovery(model, { beforeCall }).search(intent, new AbortController().signal);
    expect(result.citations).toEqual([{ id: citation.id, url: citation.url, title: citation.title }]);
    expect(result.attribution).toEqual({ provider: 'google_search', renderedContent: '<div>Provider search attribution</div>' });
    expect(JSON.stringify(result)).not.toContain('invented.example'); expect(model.doGenerateCalls).toHaveLength(1);
    expect(model.doGenerateCalls[0].tools).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'provider', name: 'google_search' })]));
    expect(beforeCall).toHaveBeenCalledOnce(); expect(release).toHaveBeenCalledOnce();
  });
  it('returns zero results honestly when generated prose contains URLs but provider citations are absent', async () => {
    const model = new MockLanguageModelV4({ provider: 'google.generative-ai', doGenerate: modelOutput({ url: 'https://invented.example/source' }) });
    const service = new VercelResourceDiscovery(model, { beforeCall: async () => {} });
    expect((await service.search(intent, new AbortController().signal)).citations).toEqual([]);
    expect(await service.select(intent, [], new AbortController().signal)).toEqual({ selected: [] }); expect(model.doGenerateCalls).toHaveLength(1);
  });
  it('fails malformed, duplicate or excess citations and token truncation without repair or invented fallback', async () => {
    for (const output of [{ ...searchOutput(), content: [citation, citation] },
      { ...searchOutput(), content: [{ ...citation, url: 'http://unsafe.example/path' }] },
      { ...searchOutput(), content: Array.from({ length: 31 }, (_, index) => ({ ...citation, id: `source-${index}` })) },
      { ...searchOutput(), finishReason: { unified: 'length' as const, raw: 'MAX_TOKENS' } }]) {
      const model = new MockLanguageModelV4({ provider: 'google.generative-ai', doGenerate: output });
      await expect(new VercelResourceDiscovery(model, { beforeCall: async () => {} }).search(intent, new AbortController().signal))
        .rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT', retryable: false } });
      expect(model.doGenerateCalls).toHaveLength(1);
    }
  });
  it('selects validated candidate keys and permits one reserved structured/semantic repair', async () => {
    for (const invalid of [{ wrong: true }, { selected: [{ candidateKey: 'b'.repeat(64), reason: 'Invented' }] },
      { selected: [{ candidateKey: candidate.key, reason: 'First' }, { candidateKey: candidate.key, reason: 'Duplicate' }] }]) {
      const model = new MockLanguageModelV4({ doGenerate: [modelOutput(invalid), modelOutput({ selected: [{ candidateKey: candidate.key, reason: 'Matches rendering goal' }] })] });
      const beforeCall = vi.fn(async () => {});
      const result = await new VercelResourceDiscovery(model, { beforeCall }).select(intent, [candidate], new AbortController().signal);
      expect(result.selected[0].candidateKey).toBe(candidate.key); expect(beforeCall).toHaveBeenCalledTimes(2);
      expect(model.doGenerateCalls[0].tools ?? []).toEqual([]);
    }
  });
  it('never retries truncated selection or accepts unavailable keys after a bounded repair', async () => {
    for (const output of [{ ...modelOutput({ selected: [] }), finishReason: { unified: 'length' as const, raw: 'MAX_TOKENS' } },
      modelOutput({ selected: [{ candidateKey: 'b'.repeat(64), reason: 'Unavailable' }] })]) {
      const model = new MockLanguageModelV4({ doGenerate: output });
      await expect(new VercelResourceDiscovery(model, { beforeCall: async () => {} }).select(intent, [candidate], new AbortController().signal))
        .rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT' } });
      expect(model.doGenerateCalls).toHaveLength(output.finishReason.unified === 'length' ? 1 : 2);
    }
  });
  it('requires compatible grounding capability and preserves reservation denial before paid work', async () => {
    const unsupported = new MockLanguageModelV4(); const beforeCall = vi.fn(async () => {});
    await expect(new VercelResourceDiscovery(unsupported, { beforeCall }).search(intent, new AbortController().signal)).rejects.toThrow('Google search-capable');
    expect(beforeCall).not.toHaveBeenCalled();
    const model = new MockLanguageModelV4({ provider: 'google.generative-ai', doGenerate: searchOutput() });
    await expect(new VercelResourceDiscovery(model, { beforeCall: async () => { throw new JobBudgetExceeded(); } }).search(intent, new AbortController().signal)).rejects.toBeInstanceOf(JobBudgetExceeded);
    expect(model.doGenerateCalls).toHaveLength(0);
  });
  it('cancels before reservation and sanitizes provider payloads while releasing occupied slots', async () => {
    const model = new MockLanguageModelV4({ provider: 'google.generative-ai', doGenerate: async () => { throw new Error('private provider token'); } });
    const release = vi.fn(async () => {}); const beforeCall = vi.fn(async () => release); const service = new VercelResourceDiscovery(model, { beforeCall });
    const controller = new AbortController(); controller.abort();
    await expect(service.search(intent, controller.signal)).rejects.toThrow(); expect(beforeCall).not.toHaveBeenCalled();
    await expect(service.search(intent, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'AI_UNAVAILABLE', message: 'Source discovery is unavailable. Try again later.' } });
    expect(model.doGenerateCalls).toHaveLength(1); expect(release).toHaveBeenCalledOnce();
  });
  it('rejects credential URLs and candidate context overflow before reservation', async () => {
    const metadata = { attribution: null, searchedAt: new Date().toISOString(), model: { provider: 'google.generative-ai', id: 'fixture' } };
    for (const url of ['https://user:pass@example.com/', 'https://example.com:444/private', 'https://example.com/\nprivate']) {
      expect(() => validateGroundedSearch({ ...metadata, citations: [{ id: 'one', url, title: '' }] })).toThrow();
    }
    const beforeCall = vi.fn(); const model = new MockLanguageModelV4();
    const candidates = Array.from({ length: 20 }, (_, index) => ({ ...candidate, key: index.toString(16).padStart(64, '0'), url: `https://example.com/${'a'.repeat(1950)}${index}` }));
    await expect(new VercelResourceDiscovery(model, { beforeCall }).select(intent, candidates, new AbortController().signal)).rejects.toThrow('context exceeds');
    expect(beforeCall).not.toHaveBeenCalled();
  });
});
