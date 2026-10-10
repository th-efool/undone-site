import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
vi.mock('server-only', () => ({}));
import { MockLanguageModelV4 } from 'ai/test';
import { intent, modelOutput } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { PEDAGOGICAL_DIMENSIONS } from '@/src/shared/curriculum/pedagogicalVector.types';
import { buildingCheckpointSchema, buildProposalSchema } from '@/src/shared/cohort-creation/build';
import { partitionProcessingInput } from '@/src/server/domain/cohort-creation/processing-input';
import { groundChunkBoundaries } from '@/src/server/domain/cohort-creation/chunking';
import { groundAnalysis } from '@/src/server/domain/cohort-creation/analysis';
import { groundBuildProposal, validateBuildProposal } from '@/src/server/domain/cohort-creation/build';
import { VercelCreationBuild } from '../vercelCreationBuild';

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
  const analyses = groundAnalysis(analysis, partition, chunks, 1, { provider: 'test', modelId: 'test', adapterVersion: 'test-v1' });
  const build = { lessons: [{ title: 'Light and surfaces', objectives: ['Explain surface reflectance.'], chunkIndices: [0] }] };
  return { partition, chunks, analyses, build };
}
describe('bounded curriculum building', () => {
  it('builds from retained content and analysis, then derives delivery fields and stable IDs in application code', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: modelOutput(f.build) });
    const release = vi.fn(async () => {}); const beforeCall = vi.fn(async () => release);
    const adapter = new VercelCreationBuild(model, { beforeCall });
    expect(await adapter.build(intent, f.partition, f.chunks, f.analyses, new AbortController().signal)).toEqual(f.build);
    expect(beforeCall).toHaveBeenCalledWith(f.partition.id); expect(release).toHaveBeenCalledOnce();
    const call = model.doGenerateCalls[0]; expect(call.responseFormat?.type).toBe('json'); expect(call.maxOutputTokens).toBe(6000);
    expect(call.tools ?? []).toEqual([]); const prompt = JSON.stringify(call.prompt);
    expect(prompt).toContain('Surface reflectance.'); expect(prompt).toContain('cognitive_load'); expect(prompt).not.toContain(f.partition.artifactId);
    expect(prompt).not.toContain(f.chunks[0].id); expect(prompt).not.toContain(f.partition.materialId);
    const lesson = groundBuildProposal(f.build, f.partition, f.chunks, 7)[0];
    expect(lesson).toMatchObject({ type: 'ARTICLE', chunkIds: [f.chunks[0].id], materialIds: [f.partition.materialId],
      durationSeconds: f.chunks[0].durationSeconds, title: { origin: 'ai', acceptedRevision: 7 } });
    expect(groundBuildProposal({ lessons: [{ ...f.build.lessons[0], title: 'Revised title' }] }, f.partition, f.chunks, 7)[0].id).toBe(lesson.id);
  });
  it('repairs invalid coverage once with a separate call reservation', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: [modelOutput({ lessons: [{ ...f.build.lessons[0], chunkIndices: [1] }] }), modelOutput(f.build)] });
    const beforeCall = vi.fn(async () => {});
    expect(await new VercelCreationBuild(model, { beforeCall }).build(intent, f.partition, f.chunks, f.analyses, new AbortController().signal)).toEqual(f.build);
    expect(beforeCall).toHaveBeenCalledTimes(2); expect(model.doGenerateCalls).toHaveLength(2);
  });
  it('rejects duplicated or foreign indices, empty objectives, commands and excessive lesson count', () => {
    const f = fixture(); const lesson = f.build.lessons[0];
    for (const value of [{ lessons: [{ ...lesson, chunkIndices: [0, 0] }] }, { lessons: [{ ...lesson, chunkIndices: [1] }] },
      { lessons: [{ ...lesson, objectives: [] }] }, { lessons: [{ ...lesson, command: 'publish' }] },
      { lessons: Array.from({ length: 101 }, () => lesson) }]) expect(() => validateBuildProposal(value, f.chunks)).toThrow();
    expect(buildProposalSchema.safeParse({ lessons: [] }).success).toBe(false);
  });
  it('rejects mismatched analysis and source dependencies before model reservations', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: modelOutput(f.build) }); const beforeCall = vi.fn(async () => {});
    const adapter = new VercelCreationBuild(model, { beforeCall });
    await expect(adapter.build(intent, f.partition, f.chunks, [], new AbortController().signal)).rejects.toThrow();
    await expect(adapter.build(intent, f.partition, f.chunks, [{ ...f.analyses[0], chunkId: 'foreign' }], new AbortController().signal)).rejects.toThrow();
    await expect(adapter.build(intent, { ...f.partition, id: 'f'.repeat(64) }, f.chunks, f.analyses, new AbortController().signal)).rejects.toThrow();
    expect(beforeCall).not.toHaveBeenCalled(); expect(model.doGenerateCalls).toHaveLength(0);
  });
  it('rejects repeated malformed output, truncation and provider secrets', async () => {
    const f = fixture(); const malformed = new MockLanguageModelV4({ doGenerate: modelOutput({ navigation: 'publish' }) });
    await expect(new VercelCreationBuild(malformed, { beforeCall: async () => {} }).build(intent, f.partition, f.chunks, f.analyses, new AbortController().signal))
      .rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT' } }); expect(malformed.doGenerateCalls).toHaveLength(2);
    const truncated = new MockLanguageModelV4({ doGenerate: { ...modelOutput(f.build), finishReason: { unified: 'length', raw: 'MAX_TOKENS' } } });
    await expect(new VercelCreationBuild(truncated, { beforeCall: async () => {} }).build(intent, f.partition, f.chunks, f.analyses, new AbortController().signal))
      .rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT', retryable: false } }); expect(truncated.doGenerateCalls).toHaveLength(1);
    const failed = new MockLanguageModelV4({ doGenerate: async () => { throw new Error('provider-secret'); } });
    await expect(new VercelCreationBuild(failed, { beforeCall: async () => {} }).build(intent, f.partition, f.chunks, f.analyses, new AbortController().signal))
      .rejects.toMatchObject({ detail: { code: 'AI_UNAVAILABLE', message: 'Building is unavailable. Retained material, chunks and analyses remain saved.' } });
  });
  it('cancels after reservation and releases the slot without a model call', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: modelOutput(f.build) }); const controller = new AbortController();
    const release = vi.fn(async () => {});
    await expect(new VercelCreationBuild(model, { beforeCall: async () => { controller.abort(); return release; } }).build(intent, f.partition, f.chunks, f.analyses, controller.signal)).rejects.toThrow();
    expect(release).toHaveBeenCalledOnce(); expect(model.doGenerateCalls).toHaveLength(0);
  });
  it('validates immutable ordered checkpoint inventories', () => {
    const checkpoint = { phase: 'building', requestId: randomUUID(), inputRevision: 1, inputFingerprint: 'a'.repeat(64),
      analysisFingerprint: 'b'.repeat(64), total: 1, partitionIds: ['c'.repeat(64)], completed: [] };
    expect(buildingCheckpointSchema.safeParse(checkpoint).success).toBe(true);
    expect(buildingCheckpointSchema.safeParse({ ...checkpoint, total: 2 }).success).toBe(false);
    expect(buildingCheckpointSchema.safeParse({ ...checkpoint, partitionIds: ['c'.repeat(64), 'c'.repeat(64)], total: 2 }).success).toBe(false);
  });
});
