import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { z } from 'zod';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import type { ChunkingCheckpoint } from '@/src/shared/cohort-creation/processing';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { CreationStorageError, type ArtifactOptions, type CreationObjectRef, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import { extractRetainedText } from '../materials/text';
import { normalizeProcessingInput, partitionProcessingInput } from '../processing-input';
import { UnderstandingService } from '../understanding.service';
import { UnderstandingContentService } from '../understanding-content.service';
import type { CreationUnderstanding } from '../understanding';
import type { CreationChunking } from '../chunking';
import { ChunkingService, chunkingInputFingerprint, validateChunkingCheckpoint } from '../chunking.service';

async function fixture(text = 'a'.repeat(5000), partitionBytes = 4096) {
  const scope = { ownerId: 'owner', draftId }; const materialId = randomUUID(); const requestId = randomUUID();
  const bytes = Buffer.from(text);
  const upload = { id: randomUUID(), kind: 'upload' as const, checksum: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
  const body = extractRetainedText(bytes, upload, materialId, materialId); const artifactRef = randomUUID();
  const before = creationSnapshotSchema.parse({ ...initialSnapshot(draftId), inputRevision: 2, revision: 5, query: result.intent.rawQuery,
    result, stage: 'starting_point', startingPoint: 'have_material', status: 'succeeded',
    materials: [{ id: materialId, kind: 'markdown', input: { kind: 'upload', assetId: upload.id }, selectedUnitIds: [materialId], status: 'ready' }],
    extractions: [{ materialId, version: body.version, checksum: upload.checksum, artifactRef, extractionKind: 'text', segmentCount: body.segments.length, complete: true }],
    materialRefs: [{ materialId, ids: [artifactRef] }] });
  const units = normalizeProcessingInput(before.materials[0], before.extractions[0], body); const partitions = partitionProcessingInput(units, partitionBytes);
  const load = vi.fn(async () => ({ units, partitions }));
  const rows = new Map<string, { scope: StorageScope; ref: CreationObjectRef; value: unknown; type: string; fingerprint: string }>();
  const owned = (owner: StorageScope, id: string) => { const row = rows.get(id);
    if (!row || row.scope.ownerId !== owner.ownerId || row.scope.draftId !== owner.draftId) throw new CreationStorageError('NOT_FOUND', 'Missing receipt'); return row; };
  const artifacts = {
    async putJSON<T extends z.ZodType>(owner: StorageScope, value: z.input<T>, options: ArtifactOptions<T>) {
      const parsed = options.schema.parse(value); const bytes = Buffer.from(JSON.stringify(parsed));
      const ref: CreationObjectRef = { id: randomUUID(), kind: 'artifact', checksum: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
      rows.set(ref.id, { scope: owner, ref, value: parsed, type: options.artifactType, fingerprint: options.inputFingerprint }); return ref;
    },
    async getJSON<T extends z.ZodType>(owner: StorageScope, id: string, options: ArtifactOptions<T>): Promise<z.output<T>> {
      const row = owned(owner, id);
      if (row.type !== options.artifactType || row.fingerprint !== options.inputFingerprint) throw new CreationStorageError('INTEGRITY', 'Wrong receipt header');
      return options.schema.parse(row.value);
    },
    async ref(owner: StorageScope, id: string) { return owned(owner, id).ref; },
  };
  const oldAi: CreationUnderstanding = { identity: { provider: 'previous', modelId: 'previous', adapterVersion: 'previous' },
    understand: vi.fn(async (_intent, partition) => ({ summary: 'Retained section.',
      concepts: [{ label: 'Concept', summary: 'Explanation.', segmentIds: [partition.segments[0].id] }], limitations: [] })) };
  const checkpoint = await new UnderstandingService({ load }, oldAi, artifacts).run(scope, before, randomUUID(), new AbortController().signal, async () => {});
  const state = applyEvent(applyCommand(before, { type: 'understand_material', requestId: checkpoint.requestId }),
    { type: 'understanding_received', requestId: checkpoint.requestId, result: checkpoint });
  const content = new UnderstandingContentService({ load }, artifacts);
  const ai: CreationChunking = { identity: { provider: 'new', modelId: 'new', adapterVersion: 'new' },
    chunk: vi.fn(async (_intent, partition) => ({ chunks: [{ title: 'Source section', summary: 'Retained content.',
      startSegmentId: partition.segments[0].id, endSegmentId: partition.segments.at(-1)!.id, conceptIndices: [0] }] })) };
  const service = new ChunkingService(content, ai, artifacts);
  return { scope, state, requestId, checkpoint, partitions, load, rows, ai, content, service,
    run: (saved?: ChunkingCheckpoint, save: (checkpoint: ChunkingCheckpoint) => Promise<void> = async () => {}) =>
      service.run(scope, state, requestId, new AbortController().signal, save, saved) };
}

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
