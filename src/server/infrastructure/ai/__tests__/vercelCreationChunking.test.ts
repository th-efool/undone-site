import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { MockLanguageModelV4 } from 'ai/test';
import { intent, modelOutput } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { partitionProcessingInput } from '@/src/server/domain/cohort-creation/processing-input';
import { JobBudgetExceeded } from '@/src/server/domain/cohort-creation/durable-job';
import { VercelCreationChunking } from '../vercelCreationChunking';

function fixture() {
  const materialId = randomUUID(); const unitId = randomUUID();
  const partition = partitionProcessingInput([{ materialId, unitId, extractionVersion: 'a'.repeat(64), artifactId: randomUUID(),
    contentOrigin: 'external', coverage: { scope: 'full_text', exhaustive: true, limitations: [] },
    segments: ['Light transport.\n', 'Surface reflectance.\n'].map((text, index) => ({ id: `segment-${index}`, text,
      location: { materialId, unitId, segmentId: `segment-${index}`, anchor: { kind: 'text' as const, start: index * 50, end: index * 50 + text.length } } })) }])[0];
  const understanding = { summary: 'Lighting.', concepts: [{ label: 'Lighting', summary: 'Light interacts with surfaces.', segmentIds: ['segment-0', 'segment-1'] }], limitations: [] };
  const proposal = { chunks: [{ title: 'Light and surfaces', summary: 'A lighting introduction.', startSegmentId: 'segment-0', endSegmentId: 'segment-1', conceptIndices: [0] }] };
  return { partition, understanding, proposal };
}
describe('bounded Vercel chunking', () => {
  it('uses structured output and source context without tools, navigation or persistence identifiers', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: modelOutput(f.proposal) });
    const release = vi.fn(async () => {}); const beforeCall = vi.fn(async () => release); const adapter = new VercelCreationChunking(model, { beforeCall });
    expect(await adapter.chunk(intent, f.partition, f.understanding, new AbortController().signal)).toEqual(f.proposal);
    expect(adapter.identity.adapterVersion).toBe('vercel-creation-chunking-v1'); expect(beforeCall).toHaveBeenCalledWith(f.partition.id); expect(release).toHaveBeenCalledOnce();
    const call = model.doGenerateCalls[0]; expect(call.responseFormat?.type).toBe('json'); expect(call.maxOutputTokens).toBe(6000); expect(call.tools ?? []).toEqual([]);
    const prompt = JSON.stringify(call.prompt); expect(prompt).toContain('Surface reflectance.'); expect(prompt).toContain('Light interacts with surfaces.');
    expect(prompt).not.toContain(f.partition.artifactId); expect(prompt).not.toContain(f.partition.materialId); expect(prompt).not.toContain(f.partition.unitId);
  });
  it('repairs invalid coverage once with a separately reserved call', async () => {
    const f = fixture(); const bad = { chunks: [{ ...f.proposal.chunks[0], endSegmentId: 'segment-0' }] };
    const model = new MockLanguageModelV4({ doGenerate: [modelOutput(bad), modelOutput(f.proposal)] }); const beforeCall = vi.fn(async () => {});
    expect(await new VercelCreationChunking(model, { beforeCall }).chunk(intent, f.partition, f.understanding, new AbortController().signal)).toEqual(f.proposal);
    expect(beforeCall).toHaveBeenCalledTimes(2); expect(model.doGenerateCalls).toHaveLength(2);
  });
  it('rejects repeated malformed output and foreign concepts after at most one repair', async () => {
    const f = fixture();
    for (const output of [{ command: 'publish' }, { chunks: [{ ...f.proposal.chunks[0], conceptIndices: [19] }] }]) {
      const model = new MockLanguageModelV4({ doGenerate: modelOutput(output) }); const release = vi.fn(async () => {});
      await expect(new VercelCreationChunking(model, { beforeCall: async () => release }).chunk(intent, f.partition, f.understanding, new AbortController().signal))
        .rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT' } });
      expect(model.doGenerateCalls).toHaveLength(2); expect(release).toHaveBeenCalledTimes(2);
    }
  });
  it('refuses truncated output without repair and redacts provider errors', async () => {
    const f = fixture(); const truncated = new MockLanguageModelV4({ doGenerate: { ...modelOutput(f.proposal), finishReason: { unified: 'length', raw: 'MAX_TOKENS' } } });
    await expect(new VercelCreationChunking(truncated, { beforeCall: async () => {} }).chunk(intent, f.partition, f.understanding, new AbortController().signal))
      .rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT', retryable: false } }); expect(truncated.doGenerateCalls).toHaveLength(1);
    const failed = new MockLanguageModelV4({ doGenerate: async () => { throw new Error('private-provider-secret'); } });
    await expect(new VercelCreationChunking(failed, { beforeCall: async () => {} }).chunk(intent, f.partition, f.understanding, new AbortController().signal))
      .rejects.toMatchObject({ detail: { code: 'AI_UNAVAILABLE', message: 'Chunking is unavailable. Retained material and understanding remain saved.' } });
    expect(failed.doGenerateCalls).toHaveLength(1);
  });
  it('preserves budget failures and early cancellation without model calls', async () => {
    const f = fixture(); const failure = new JobBudgetExceeded(); const model = new MockLanguageModelV4({ doGenerate: modelOutput(f.proposal) });
    const beforeCall = vi.fn(async () => { throw failure; }); const adapter = new VercelCreationChunking(model, { beforeCall });
    await expect(adapter.chunk(intent, f.partition, f.understanding, new AbortController().signal)).rejects.toBe(failure);
    const controller = new AbortController(); controller.abort(); await expect(adapter.chunk(intent, f.partition, f.understanding, controller.signal)).rejects.toThrow();
    expect(model.doGenerateCalls).toHaveLength(0); expect(beforeCall).toHaveBeenCalledOnce();
  });
  it('checks cancellation after a reservation and still releases its slot', async () => {
    const f = fixture(); const controller = new AbortController(); const release = vi.fn(async () => {});
    const model = new MockLanguageModelV4({ doGenerate: modelOutput(f.proposal) });
    const beforeCall = async () => { controller.abort(); return release; };
    await expect(new VercelCreationChunking(model, { beforeCall }).chunk(intent, f.partition, f.understanding, controller.signal)).rejects.toThrow();
    expect(model.doGenerateCalls).toHaveLength(0); expect(release).toHaveBeenCalledOnce();
  });
  it('rejects tampered source/understanding and excessive context before reserving', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: modelOutput(f.proposal) }); const beforeCall = vi.fn(async () => {});
    const adapter = new VercelCreationChunking(model, { beforeCall });
    await expect(adapter.chunk(intent, { ...f.partition, id: 'f'.repeat(64) }, f.understanding, new AbortController().signal)).rejects.toThrow();
    await expect(adapter.chunk(intent, f.partition, { ...f.understanding, concepts: [{ ...f.understanding.concepts[0], segmentIds: ['foreign'] }] }, new AbortController().signal)).rejects.toThrow();
    const large = { ...f.understanding, concepts: Array.from({ length: 20 }, (_, index) => ({ label: `Concept ${index}`, summary: 'x'.repeat(2000), segmentIds: ['segment-0'] })),
      limitations: Array.from({ length: 8 }, () => 'x'.repeat(1000)) };
    await expect(adapter.chunk(intent, f.partition, large, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'INVALID_REQUEST', retryable: false } });
    expect(model.doGenerateCalls).toHaveLength(0); expect(beforeCall).not.toHaveBeenCalled();
  });
});
