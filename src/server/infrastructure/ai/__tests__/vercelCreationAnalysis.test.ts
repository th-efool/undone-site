import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
vi.mock('server-only', () => ({}));
import { MockLanguageModelV4 } from 'ai/test';
import { intent, modelOutput } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { PEDAGOGICAL_DIMENSIONS } from '@/src/shared/curriculum/pedagogicalVector.types';
import { analysisCheckpointSchema, analysisProposalSchema } from '@/src/shared/cohort-creation/analysis';
import { partitionProcessingInput } from '@/src/server/domain/cohort-creation/processing-input';
import { groundChunkBoundaries } from '@/src/server/domain/cohort-creation/chunking';
import { groundAnalysis, validateChunkAnalysis, analysisSourceContext } from '@/src/server/domain/cohort-creation/analysis';
import { JobBudgetExceeded } from '@/src/server/domain/cohort-creation/durable-job';
import { VercelCreationAnalysis } from '../vercelCreationAnalysis';

function fixture() {
  const materialId = randomUUID(); const unitId = randomUUID();
  const partition = partitionProcessingInput([{ materialId, unitId, extractionVersion: 'a'.repeat(64), artifactId: randomUUID(),
    contentOrigin: 'external', coverage: { scope: 'full_text', exhaustive: true, limitations: [] },
    segments: ['Light transport.\n', 'Surface reflectance.\n'].map((text, index) => ({ id: `segment-${index}`, text,
      location: { materialId, unitId, segmentId: `segment-${index}`, anchor: { kind: 'text' as const, start: index * 50, end: index * 50 + text.length } } })) }])[0];
  const understanding = { summary: 'Lighting.', concepts: [{ label: 'Lighting', summary: 'Light interacts with surfaces.', segmentIds: ['segment-0', 'segment-1'] }], limitations: [] };
  const proposal = { chunks: [{ title: 'Light and surfaces', summary: 'A lighting introduction.', startSegmentId: 'segment-0', endSegmentId: 'segment-1', conceptIndices: [0] }] };
  const chunks = groundChunkBoundaries(proposal, partition, understanding, 1);
  const analysis = { analyses: [{ chunkIndex: 0, vector: Object.fromEntries(PEDAGOGICAL_DIMENSIONS.map(key => [key, 0.5])),
    isStrictlyLinear: false, confidence: 0.8, reasoning: 'The retained text introduces lighting and surfaces.' }] };
  return { partition, chunks, analysis };
}
describe('bounded retained chunk analysis', () => {
  it('uses actual retained source text, structured output and complete canonical vectors', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: modelOutput(f.analysis) });
    const release = vi.fn(async () => {}); const beforeCall = vi.fn(async () => release);
    const adapter = new VercelCreationAnalysis(model, { beforeCall });
    expect(await adapter.analyze(intent, f.partition, f.chunks, new AbortController().signal)).toEqual(f.analysis);
    expect(beforeCall).toHaveBeenCalledWith(f.partition.id); expect(release).toHaveBeenCalledOnce();
    const call = model.doGenerateCalls[0]; expect(call.responseFormat?.type).toBe('json'); expect(call.maxOutputTokens).toBe(6000);
    expect(call.tools ?? []).toEqual([]); const prompt = JSON.stringify(call.prompt);
    expect(prompt).toContain('Surface reflectance.'); expect(prompt).not.toContain(f.partition.artifactId);
    expect(prompt).not.toContain(f.chunks[0].id); expect(prompt).not.toContain(f.partition.materialId);
    expect(groundAnalysis(f.analysis, f.partition, f.chunks, 7, adapter.identity)[0]).toMatchObject({
      chunkId: f.chunks[0].id, inputRevision: 7, modelId: model.modelId, promptVersion: 'vercel-creation-analysis-v1' });
  });
  it('repairs semantic coverage once, reserving each model call independently', async () => {
    const f = fixture(); const bad = { analyses: [{ ...f.analysis.analyses[0], chunkIndex: 1 }] };
    const model = new MockLanguageModelV4({ doGenerate: [modelOutput(bad), modelOutput(f.analysis)] });
    const beforeCall = vi.fn(async () => {});
    expect(await new VercelCreationAnalysis(model, { beforeCall }).analyze(intent, f.partition, f.chunks, new AbortController().signal)).toEqual(f.analysis);
    expect(beforeCall).toHaveBeenCalledTimes(2); expect(model.doGenerateCalls).toHaveLength(2);
  });
  it('rejects incomplete vectors, out-of-range numbers, duplicate indices and application commands', () => {
    const f = fixture(); const item = f.analysis.analyses[0];
    for (const value of [{ analyses: [{ ...item, vector: {} }] }, { analyses: [{ ...item, confidence: 2 }] },
      { analyses: [item, item] }, { analyses: [{ ...item, command: 'publish' }] }, { analyses: [{ ...item, chunkIndex: 1 }] }]) {
      expect(() => validateChunkAnalysis(value, f.chunks)).toThrow();
    }
    expect(analysisProposalSchema.safeParse({ analyses: [{ ...item, vector: { ...item.vector, cognitive_load: NaN } }] }).success).toBe(false);
  });
  it('rejects retained-source tampering and missing or duplicated chunk coverage before reserving', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: modelOutput(f.analysis) }); const beforeCall = vi.fn(async () => {});
    const adapter = new VercelCreationAnalysis(model, { beforeCall });
    for (const chunks of [[], [f.chunks[0], f.chunks[0]], [{ ...f.chunks[0], artifactRef: randomUUID() }],
      [{ ...f.chunks[0], sourceRefs: f.chunks[0].sourceRefs.slice(0, 1) }]]) {
      await expect(adapter.analyze(intent, f.partition, chunks, new AbortController().signal)).rejects.toThrow();
    }
    expect(() => analysisSourceContext({ ...f.partition, id: 'f'.repeat(64) }, f.chunks)).toThrow();
    expect(beforeCall).not.toHaveBeenCalled(); expect(model.doGenerateCalls).toHaveLength(0);
  });
  it('rejects repeated malformed output after one repair and releases both slots', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: modelOutput({ navigation: 'publish' }) }); const release = vi.fn(async () => {});
    await expect(new VercelCreationAnalysis(model, { beforeCall: async () => release }).analyze(intent, f.partition, f.chunks, new AbortController().signal))
      .rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT' } });
    expect(model.doGenerateCalls).toHaveLength(2); expect(release).toHaveBeenCalledTimes(2);
  });
  it('rejects truncation without repair and redacts provider errors', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: { ...modelOutput(f.analysis), finishReason: { unified: 'length', raw: 'MAX_TOKENS' } } });
    await expect(new VercelCreationAnalysis(model, { beforeCall: async () => {} }).analyze(intent, f.partition, f.chunks, new AbortController().signal))
      .rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT', retryable: false } }); expect(model.doGenerateCalls).toHaveLength(1);
    const failed = new MockLanguageModelV4({ doGenerate: async () => { throw new Error('private-provider-secret'); } });
    await expect(new VercelCreationAnalysis(failed, { beforeCall: async () => {} }).analyze(intent, f.partition, f.chunks, new AbortController().signal))
      .rejects.toMatchObject({ detail: { code: 'AI_UNAVAILABLE', message: 'Analysis is unavailable. Retained material and chunks remain saved.' } });
  });
  it('preserves quota errors and releases a slot after cancellation', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: modelOutput(f.analysis) }); const failure = new JobBudgetExceeded();
    await expect(new VercelCreationAnalysis(model, { beforeCall: async () => { throw failure; } }).analyze(intent, f.partition, f.chunks, new AbortController().signal)).rejects.toBe(failure);
    const controller = new AbortController(); const release = vi.fn(async () => {});
    await expect(new VercelCreationAnalysis(model, { beforeCall: async () => { controller.abort(); return release; } }).analyze(intent, f.partition, f.chunks, controller.signal)).rejects.toThrow();
    expect(release).toHaveBeenCalledOnce(); expect(model.doGenerateCalls).toHaveLength(0);
  });
  it('rejects invalid checkpoint ordering, duplicate artifact refs and excessive total chunks', () => {
    const checkpoint = { phase: 'analysis', requestId: randomUUID(), inputRevision: 1, inputFingerprint: 'a'.repeat(64),
      chunkingFingerprint: 'b'.repeat(64), total: 1, partitionIds: ['c'.repeat(64)], completed: [] };
    expect(analysisCheckpointSchema.safeParse(checkpoint).success).toBe(true);
    expect(analysisCheckpointSchema.safeParse({ ...checkpoint, total: 2 }).success).toBe(false);
    expect(analysisCheckpointSchema.safeParse({ ...checkpoint, partitionIds: ['c'.repeat(64), 'c'.repeat(64)], total: 2 }).success).toBe(false);
  });
});
