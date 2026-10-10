import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { applyCommand, applyEvent } from '@/src/shared/cohort-creation/flow';
import { PEDAGOGICAL_DIMENSIONS } from '@/src/shared/curriculum/pedagogicalVector.types';
import type { AnalysisCheckpoint } from '@/src/shared/cohort-creation/analysis';
import { chunkingFixture } from './processing.fixture';
import { ChunkingContentService } from '../chunking-content.service';
import { AnalysisContentService } from '../analysis-content.service';
import { AnalysisService, validateAnalysisCheckpoint } from '../analysis.service';
import type { CreationAnalysis } from '../analysis';
import type { GroundedChunk } from '@/src/shared/cohort-creation/chunking';

async function fixture() {
  const f = await chunkingFixture(); const checkpoint = await f.run();
  const state = applyEvent(applyCommand(f.state, { type: 'chunk_material', requestId: f.requestId }),
    { type: 'chunking_received', requestId: f.requestId, result: checkpoint });
  const content = new ChunkingContentService(f.content, f.artifacts); const requestId = randomUUID();
  const ai: CreationAnalysis = { identity: { provider: 'fixture', modelId: 'fixture', adapterVersion: 'analysis-v1' },
    analyze: vi.fn<CreationAnalysis['analyze']>(async (_intent, _partition, chunks: GroundedChunk[]) => ({ analyses: chunks.map((_chunk, chunkIndex) => ({ chunkIndex,
      vector: Object.fromEntries(PEDAGOGICAL_DIMENSIONS.map(key => [key, 0.5])) as Record<typeof PEDAGOGICAL_DIMENSIONS[number], number>,
      isStrictlyLinear: true, confidence: 0.8, reasoning: 'Grounded retained explanation.' })) })) };
  const service = new AnalysisService(content, ai, f.artifacts);
  const run = (saved?: AnalysisCheckpoint, save: (value: AnalysisCheckpoint) => Promise<void> = async () => {}) =>
    service.run(f.scope, state, requestId, new AbortController().signal, save, saved);
  return { ...f, state, content, ai, service, requestId, run };
}

describe('retained analysis and owned downstream reads', () => {
  it('retains complete body-free progress, reuses accepted work without model credentials, and reads original text', async () => {
    const f = await fixture(); const save = vi.fn(async () => {}); const result = await f.run(undefined, save);
    expect(result.completed).toHaveLength(2); expect(save).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(result)).not.toContain('reasoning'); vi.mocked(f.ai.analyze).mockClear();
    Object.defineProperty(f.ai, 'identity', { get: () => { throw new Error('No credentials'); } });
    expect(await f.run(result)).toEqual(result); expect(f.ai.analyze).not.toHaveBeenCalled();
    const accepted = applyEvent(applyCommand(f.state, { type: 'analyze_material', requestId: f.requestId }),
      { type: 'analysis_received', requestId: f.requestId, result });
    const loaded = await new AnalysisContentService(f.content, f.artifacts).load(f.scope, accepted, new AbortController().signal);
    expect(loaded.analyses.flat()).toHaveLength(2);
    expect(loaded.analyses[0][0].chunkId).toBe(loaded.chunks[0][0].id);
    expect(loaded.partitions).toEqual(f.partitions);
    expect(loaded.analyses[0][0].modelId).toBe('fixture');
  });
  it('previews only accepted partial analysis, rejects tampering/foreign ownership, and honors aborts without AI', async () => {
    const f = await fixture(); const result = await f.run(); vi.mocked(f.ai.analyze).mockClear();
    const state = applyCommand(f.state, { type: 'analyze_material', requestId: f.requestId });
    state.processing!.analysis!.checkpoint = { ...result, completed: result.completed.slice(0, 1) };
    const reader = new AnalysisContentService(f.content, f.artifacts); const signal = new AbortController().signal;
    const preview = await reader.preview(f.scope, state, signal);
    expect(preview.chunks).toHaveLength(2); expect(preview.analyses).toHaveLength(1);
    expect(preview.analyses[0].chunkId).toBe(preview.chunks[0].id);
    await expect(reader.preview({ ...f.scope, ownerId: 'other' }, state, signal)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const stale = structuredClone(state); stale.inputRevision += 1;
    await expect(reader.preview(f.scope, stale, signal)).rejects.toThrow();
    const tampered = structuredClone(state); tampered.processing!.analysis!.checkpoint!.completed[0].artifact.checksum = 'f'.repeat(64);
    await expect(reader.preview(f.scope, tampered, signal)).rejects.toThrow();
    const canceled = new AbortController(); canceled.abort();
    await expect(reader.preview(f.scope, state, canceled.signal)).rejects.toThrow();
    expect(f.ai.analyze).not.toHaveBeenCalled();
  });
  it('stops on failed acceptance and resumes only unfinished partitions', async () => {
    const f = await fixture(); let saved: AnalysisCheckpoint | undefined;
    await expect(f.run(undefined, async value => { saved = value; if (value.completed.length === 1) throw new Error('lease lost'); })).rejects.toThrow('lease lost');
    expect(f.ai.analyze).toHaveBeenCalledOnce(); vi.mocked(f.ai.analyze).mockClear();
    expect((await f.run(saved)).completed).toHaveLength(2); expect(f.ai.analyze).toHaveBeenCalledOnce();
    const other = await fixture(); await expect(other.run(undefined, async () => { throw new Error('inventory denied'); })).rejects.toThrow('inventory denied');
    expect(other.ai.analyze).not.toHaveBeenCalled();
  });
  it('rejects ownership, request/revision changes and replaced accepted chunk references', async () => {
    const f = await fixture(); const result = await f.run(); vi.mocked(f.ai.analyze).mockClear();
    await expect(f.service.run({ ...f.scope, ownerId: 'other' }, f.state, f.requestId, new AbortController().signal, async () => {}, result)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(() => validateAnalysisCheckpoint(f.state, randomUUID(), result)).toThrow();
    expect(() => validateAnalysisCheckpoint(f.state, f.requestId, { ...result, inputRevision: 99 })).toThrow();
    const changed = structuredClone(f.state); changed.processing!.chunking!.checkpoint!.completed[0].artifact.id = randomUUID();
    await expect(f.service.run(f.scope, changed, f.requestId, new AbortController().signal, async () => {}, result)).rejects.toThrow();
    expect(f.ai.analyze).not.toHaveBeenCalled();
  });
  it('rejects malformed stored dependencies, headers, checksums and incomplete chunk coverage', async () => {
    const f = await fixture(); const result = await f.run(); const row = f.rows.get(result.completed[0].artifact.id)!;
    const original = structuredClone(row.value) as Record<string, unknown>;
    for (const patch of [{ requestId: randomUUID() }, { chunking: { inputFingerprint: 'a'.repeat(64), artifact: result.completed[1].artifact } },
      { source: { ...(original.source as object), artifactId: randomUUID() } }, { proposal: { analyses: [] } }]) {
      row.value = { ...original, ...patch }; await expect(f.run(result)).rejects.toThrow();
    }
    row.value = original; const bad = structuredClone(result); bad.completed[0].artifact.checksum = 'f'.repeat(64);
    await expect(f.run(bad)).rejects.toThrow(); row.type = 'wrong'; await expect(f.run(result)).rejects.toThrow();
  });
  it('never retains incomplete proposals and honors cancellation before reads or after generation', async () => {
    const f = await fixture(); const count = f.rows.size; vi.mocked(f.ai.analyze).mockResolvedValue({ analyses: [] });
    await expect(f.run()).rejects.toThrow(); expect(f.rows.size).toBe(count);
    const controller = new AbortController(); controller.abort(); f.load.mockClear();
    await expect(f.service.run(f.scope, f.state, f.requestId, controller.signal, async () => {})).rejects.toThrow(); expect(f.load).not.toHaveBeenCalled();
    const other = await fixture(); const canceled = new AbortController(); const generate = other.ai.analyze;
    other.ai.analyze = async (...args) => { const proposal = await generate(...args); canceled.abort(); return proposal; };
    await expect(other.service.run(other.scope, other.state, other.requestId, canceled.signal, async () => {})).rejects.toThrow();
    expect(other.rows.size).toBe(count);
  });
});
