import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { ChunkingCheckpoint } from '@/src/shared/cohort-creation/processing';
import { applyCommand, applyEvent } from '@/src/shared/cohort-creation/flow';
import { chunkingInputFingerprint, validateChunkingCheckpoint } from '../chunking.service';
import { ChunkingContentService } from '../chunking-content.service';
import { chunkingFixture as fixture } from './processing.fixture';

describe('owned accepted understanding reads', () => {
  it('loads actual source partitions and owned evidence without calling a current model', async () => {
    const f = await fixture(); const loaded = await f.content.load(f.scope, f.state, new AbortController().signal);
    expect(loaded.partitions).toEqual(f.partitions); expect(loaded.understanding).toHaveLength(2);
    expect(loaded.understanding[0].receipt.model.modelId).toBe('previous'); expect(f.ai.chunk).not.toHaveBeenCalled();
  });
  it('refuses foreign ownership, incomplete understanding and stale source revisions before chunk generation', async () => {
    const f = await fixture();
    await expect(f.content.load({ ...f.scope, ownerId: 'foreign' }, f.state, new AbortController().signal)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(f.content.load({ ...f.scope, draftId: randomUUID() }, f.state, new AbortController().signal)).rejects.toThrow('owned');
    await expect(f.content.load({ ...f.scope }, { ...f.state, processing: { ...f.state.processing!, complete: false } }, new AbortController().signal)).rejects.toThrow('owned');
    await expect(f.content.load(f.scope, { ...f.state, extractions: [{ ...f.state.extractions[0], version: 'f'.repeat(64) }] }, new AbortController().signal)).rejects.toThrow('unavailable');
    expect(f.ai.chunk).not.toHaveBeenCalled();
  });
  it('refuses reordered source inventory and tampered understanding checksums or receipt evidence', async () => {
    const f = await fixture(); f.load.mockResolvedValueOnce({ units: [], partitions: [...f.partitions].reverse() });
    await expect(f.run()).rejects.toThrow('inventory');
    const bad = structuredClone(f.state); bad.processing!.checkpoint!.completed[0].artifact.checksum = 'f'.repeat(64);
    await expect(f.service.run(f.scope, bad, f.requestId, new AbortController().signal, async () => {})).rejects.toThrow('partition ledger');
    const row = f.rows.get(f.checkpoint.completed[0].artifact.id)!;
    const original = structuredClone(row.value) as Record<string, unknown>;
    for (const patch of [{ requestId: randomUUID() }, { model: { provider: '', modelId: 'bad', adapterVersion: 'bad' } },
      { proposal: { summary: 'Bad', concepts: [{ label: 'Bad', summary: 'Bad', segmentIds: ['foreign'] }], limitations: [] } }]) {
      row.value = { ...original, ...patch }; await expect(f.run()).rejects.toThrow();
    }
    expect(f.ai.chunk).not.toHaveBeenCalled();
  });
});

describe('retained per-partition chunking', () => {
  it('persists body-free progress and reuses complete accepted receipts without model credentials', async () => {
    const f = await fixture(); const save = vi.fn(async () => {}); const final = await f.run(undefined, save);
    expect(final.total).toBe(2); expect(final.completed.map(item => item.chunkCount)).toEqual([1, 1]); expect(save).toHaveBeenCalledTimes(3);
    expect(f.ai.chunk).toHaveBeenCalledTimes(2); expect(JSON.stringify(final)).not.toContain('Retained content.');
    vi.mocked(f.ai.chunk).mockClear(); Object.defineProperty(f.ai, 'identity', { get: () => { throw new Error('No model credentials'); } });
    expect(await f.service.run(f.scope, { ...f.state, revision: 100 }, f.requestId, new AbortController().signal, async () => {}, structuredClone(final))).toEqual(final);
    expect(f.ai.chunk).not.toHaveBeenCalled(); expect(f.rows.size).toBe(4);
  });
  it('stops when checkpoint acknowledgement fails and resumes only remaining partitions', async () => {
    const f = await fixture(); let saved: ChunkingCheckpoint | undefined;
    await expect(f.run(undefined, async value => { saved = value; if (value.completed.length === 1) throw new Error('lease lost'); })).rejects.toThrow('lease lost');
    expect(f.ai.chunk).toHaveBeenCalledOnce(); expect(saved?.completed).toHaveLength(1); vi.mocked(f.ai.chunk).mockClear();
    expect((await f.run(structuredClone(saved))).completed).toHaveLength(2); expect(f.ai.chunk).toHaveBeenCalledOnce();
    const untouched = await fixture();
    await expect(untouched.run(undefined, async () => { throw new Error('inventory not accepted'); })).rejects.toThrow('inventory not accepted');
    expect(untouched.ai.chunk).not.toHaveBeenCalled();
  });
  it('binds recovery to source revision, request and accepted understanding references, not transport revision', async () => {
    const f = await fixture(); const final = await f.run(); vi.mocked(f.ai.chunk).mockClear();
    await expect(f.service.run(f.scope, f.state, randomUUID(), new AbortController().signal, async () => {}, final)).rejects.toThrow('partition ledger');
    const altered = structuredClone(f.state); altered.processing!.checkpoint!.completed[0].artifact.id = randomUUID();
    expect(chunkingInputFingerprint(altered, f.requestId)).not.toBe(final.inputFingerprint);
    await expect(f.service.run(f.scope, altered, f.requestId, new AbortController().signal, async () => {}, final)).rejects.toThrow('partition ledger');
    expect(() => validateChunkingCheckpoint(f.state, f.requestId, { ...final, inputRevision: 99 })).toThrow();
    expect(() => validateChunkingCheckpoint(f.state, f.requestId, { ...final, completed: [...final.completed].reverse() })).toThrow('ledger');
    expect(f.ai.chunk).not.toHaveBeenCalled();
  });
  it('validates stored chunk dependency, model identity, source anchors, headers and counts on resume', async () => {
    const f = await fixture(); const final = await f.run(); vi.mocked(f.ai.chunk).mockClear();
    const row = f.rows.get(final.completed[0].artifact.id)!; const original = structuredClone(row.value) as Record<string, unknown>;
    for (const patch of [{ understanding: { inputFingerprint: 'a'.repeat(64), artifact: f.checkpoint.completed[1].artifact } },
      { source: { ...(original.source as object), artifactId: randomUUID() } }, { model: { provider: '', modelId: 'bad', adapterVersion: 'bad' } },
      { proposal: { chunks: [{ title: 'Bad', summary: 'Bad', startSegmentId: 'foreign', endSegmentId: 'foreign', conceptIndices: [] }] } }]) {
      row.value = { ...original, ...patch }; await expect(f.run(final)).rejects.toThrow();
    }
    row.value = original; const badCount = structuredClone(final); badCount.completed[0].chunkCount = 2;
    await expect(f.run(badCount)).rejects.toThrow('partition ledger');
    const badChecksum = structuredClone(final); badChecksum.completed[0].artifact.checksum = 'f'.repeat(64);
    await expect(f.run(badChecksum)).rejects.toThrow('partition ledger');
    row.type = 'foreign-type'; await expect(f.run(final)).rejects.toThrow('header'); expect(f.ai.chunk).not.toHaveBeenCalled();
  });
  it('never retains invalid proposals and honors cancellation before reads and after generation', async () => {
    const f = await fixture(); vi.mocked(f.ai.chunk).mockResolvedValue({ chunks: [{ title: 'Bad', summary: 'Bad', startSegmentId: 'invented', endSegmentId: 'invented', conceptIndices: [] }] });
    await expect(f.run()).rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT' } }); expect(f.rows.size).toBe(2);
    f.load.mockClear(); const controller = new AbortController(); controller.abort();
    await expect(f.service.run(f.scope, f.state, f.requestId, controller.signal, async () => {})).rejects.toThrow(); expect(f.load).not.toHaveBeenCalled();
    const canceled = new AbortController(); vi.mocked(f.ai.chunk).mockImplementation(async (_intent, partition) => {
      canceled.abort(); return { chunks: [{ title: 'Good', summary: 'Good', startSegmentId: partition.segments[0].id, endSegmentId: partition.segments.at(-1)!.id, conceptIndices: [] }] };
    });
    await expect(f.service.run(f.scope, f.state, f.requestId, canceled.signal, async () => {})).rejects.toThrow(); expect(f.rows.size).toBe(2);
  });
  it('rejects impossible minimum scope before model calls and stops before retaining an excessive chunk count', async () => {
    const impossible = await fixture('# Heading\n'.repeat(201), 10);
    await expect(impossible.run()).rejects.toMatchObject({ detail: { code: 'INVALID_REQUEST', retryable: false } });
    expect(impossible.ai.chunk).not.toHaveBeenCalled(); expect(impossible.rows.size).toBe(201);
    const f = await fixture('# Heading\n'.repeat(201), 1000); expect(f.partitions).toHaveLength(3);
    vi.mocked(f.ai.chunk).mockImplementation(async (_intent, partition) => ({ chunks: partition.segments.map(segment => ({
      title: 'Heading', summary: 'Retained heading.', startSegmentId: segment.id, endSegmentId: segment.id, conceptIndices: [] })) }));
    let accepted: ChunkingCheckpoint | undefined;
    await expect(f.run(undefined, async value => { accepted = value; })).rejects.toMatchObject({ detail: { code: 'INVALID_REQUEST', retryable: false } });
    expect(accepted?.completed.map(item => item.chunkCount)).toEqual([100, 100]); expect(f.rows.size).toBe(5);
  });
});

async function chunkReaderFixture() {
  const f = await fixture(); const checkpoint = await f.run();
  const state = applyEvent(applyCommand(f.state, { type: 'chunk_material', requestId: f.requestId }),
    { type: 'chunking_received', requestId: f.requestId, result: checkpoint });
  vi.mocked(f.ai.chunk).mockClear();
  return { ...f, state, checkpoint, reader: new ChunkingContentService(f.content, f.artifacts) };
}

describe('owned accepted chunk reads', () => {
  it('rederives accepted chunks from actual source bodies without model calls or writes', async () => {
    const f = await chunkReaderFixture(); const retainedCount = f.rows.size;
    Object.defineProperty(f.ai, 'identity', { get: () => { throw new Error('No model credentials'); } });
    const loaded = await f.reader.load(f.scope, f.state, new AbortController().signal);
    expect(loaded.partitions).toEqual(f.partitions); expect(loaded.chunks.map(group => group.length)).toEqual([1, 1]);
    expect(loaded.receipts.map(item => item.artifact)).toEqual(f.checkpoint.completed.map(item => item.artifact));
    expect(loaded.chunks.flat().flatMap(chunk => chunk.sourceRefs)).toEqual(f.partitions.flatMap(partition => partition.segments.map(segment => segment.location)));
    expect(loaded.partitions[0].segments[0].text).not.toBe(loaded.chunks[0][0].summary.value);
    expect(f.ai.chunk).not.toHaveBeenCalled(); expect(f.rows.size).toBe(retainedCount);
    expect((await f.reader.load(f.scope, { ...f.state, revision: 999 }, new AbortController().signal)).checkpoint).toEqual(f.checkpoint);
  });
  it('rejects foreign owners, draft mismatch, incomplete acceptance and changed source revisions', async () => {
    const f = await chunkReaderFixture(); const signal = new AbortController().signal;
    await expect(f.reader.load({ ...f.scope, ownerId: 'foreign' }, f.state, signal)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(f.reader.load({ ...f.scope, draftId: randomUUID() }, f.state, signal)).rejects.toThrow('owned');
    const incomplete = structuredClone(f.state); incomplete.processing!.chunking!.complete = false;
    await expect(f.reader.load(f.scope, incomplete, signal)).rejects.toThrow('owned');
    const stale = structuredClone(f.state); stale.extractions[0].version = 'f'.repeat(64);
    await expect(f.reader.load(f.scope, stale, signal)).rejects.toThrow();
    expect(f.ai.chunk).not.toHaveBeenCalled();
  });
  it('checks owned reference integrity, typed headers, dependency identities and semantic evidence', async () => {
    const f = await chunkReaderFixture(); const signal = new AbortController().signal;
    const row = f.rows.get(f.checkpoint.completed[0].artifact.id)!; const original = structuredClone(row.value) as Record<string, unknown>;
    for (const patch of [{ requestId: randomUUID() }, { inputFingerprint: 'f'.repeat(64) },
      { understanding: { inputFingerprint: 'a'.repeat(64), artifact: f.checkpoint.completed[1].artifact } },
      { source: { ...(original.source as object), artifactId: randomUUID() } },
      { model: { provider: '', modelId: 'bad', adapterVersion: 'bad' } },
      { proposal: { chunks: [{ title: 'Bad', summary: 'Bad', startSegmentId: 'foreign', endSegmentId: 'foreign', conceptIndices: [] }] } }]) {
      row.value = { ...original, ...patch }; await expect(f.reader.load(f.scope, f.state, signal)).rejects.toThrow();
    }
    row.value = original;
    for (const patch of [{ checksum: 'f'.repeat(64) }, { byteLength: row.ref.byteLength + 1 }, { kind: 'upload' as const }]) {
      const originalRef = row.ref; row.ref = { ...originalRef, ...patch };
      await expect(f.reader.load(f.scope, f.state, signal)).rejects.toThrow('partition ledger'); row.ref = originalRef;
    }
    row.type = 'wrong-type'; await expect(f.reader.load(f.scope, f.state, signal)).rejects.toThrow('header');
    row.type = 'creation-chunking'; row.fingerprint = 'f'.repeat(64);
    await expect(f.reader.load(f.scope, f.state, signal)).rejects.toThrow('header');
    f.rows.delete(row.ref.id); await expect(f.reader.load(f.scope, f.state, signal)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(f.ai.chunk).not.toHaveBeenCalled();
  });
  it('rejects changed chunk counts, reordered inventory and cancellation before source reads', async () => {
    const f = await chunkReaderFixture(); const signal = new AbortController().signal;
    const altered = structuredClone(f.state); altered.processing!.chunking!.checkpoint!.completed[0].chunkCount += 1;
    await expect(f.reader.load(f.scope, altered, signal)).rejects.toThrow('partition ledger');
    f.load.mockResolvedValueOnce({ units: [], partitions: [...f.partitions].reverse() });
    await expect(f.reader.load(f.scope, f.state, signal)).rejects.toThrow('inventory');
    f.load.mockClear(); const controller = new AbortController(); controller.abort();
    await expect(f.reader.load(f.scope, f.state, controller.signal)).rejects.toThrow(); expect(f.load).not.toHaveBeenCalled();
    expect(f.ai.chunk).not.toHaveBeenCalled();
  });
});
