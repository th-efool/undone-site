import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { z } from 'zod';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import type { UnderstandingCheckpoint } from '@/src/shared/cohort-creation/processing';
import { CreationStorageError, type ArtifactOptions, type CreationObjectRef, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import { extractRetainedText } from '../materials/text';
import { normalizeProcessingInput, partitionProcessingInput } from '../processing-input';
import { UnderstandingService } from '../understanding.service';
import type { CreationUnderstanding } from '../understanding';

function fixture() {
  const scope = { ownerId: 'owner', draftId }; const materialId = randomUUID(); const requestId = randomUUID(); const bytes = Buffer.from('a'.repeat(5000));
  const upload = { id: randomUUID(), kind: 'upload' as const, checksum: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
  const body = extractRetainedText(bytes, upload, materialId, materialId);
  const state = creationSnapshotSchema.parse({ ...initialSnapshot(draftId), inputRevision: 2, revision: 5, query: result.intent.rawQuery,
    result, stage: 'starting_point', startingPoint: 'have_material', status: 'succeeded',
    materials: [{ id: materialId, kind: 'markdown', input: { kind: 'upload', assetId: upload.id }, selectedUnitIds: [materialId], status: 'ready' }],
    extractions: [{ materialId, version: body.version, checksum: upload.checksum, artifactRef: randomUUID(), extractionKind: 'text', segmentCount: body.segments.length, complete: true }] });
  const units = normalizeProcessingInput(state.materials[0], state.extractions[0], body); const partitions = partitionProcessingInput(units, 4096);
  const load = vi.fn(async () => ({ units, partitions }));
  const ai: CreationUnderstanding = { identity: { provider: 'fixture', modelId: 'fixture', adapterVersion: 'fixture' },
    understand: vi.fn(async (_intent, partition) => ({ summary: 'Retained section.', concepts: [{ label: 'Concept', summary: 'Explanation.', segmentIds: [partition.segments[0].id] }], limitations: [] })) };
  const rows = new Map<string, { scope: StorageScope; ref: CreationObjectRef; value: unknown; type: string; fingerprint: string }>();
  const owned = (owner: StorageScope, id: string) => { const row = rows.get(id);
    if (!row || row.scope.ownerId !== owner.ownerId || row.scope.draftId !== owner.draftId) throw new CreationStorageError('NOT_FOUND', 'Missing receipt'); return row; };
  const artifacts = {
    async putJSON<T extends z.ZodType>(owner: StorageScope, value: z.input<T>, options: ArtifactOptions<T>) {
      const parsed = options.schema.parse(value); const serialized = Buffer.from(JSON.stringify(parsed));
      const ref: CreationObjectRef = { id: randomUUID(), kind: 'artifact', checksum: createHash('sha256').update(serialized).digest('hex'), byteLength: serialized.length };
      rows.set(ref.id, { scope: owner, ref, value: parsed, type: options.artifactType, fingerprint: options.inputFingerprint }); return ref;
    },
    async getJSON<T extends z.ZodType>(owner: StorageScope, id: string, options: ArtifactOptions<T>): Promise<z.output<T>> {
      const row = owned(owner, id); if (row.type !== options.artifactType || row.fingerprint !== options.inputFingerprint) throw new CreationStorageError('INTEGRITY', 'Wrong receipt header');
      return options.schema.parse(row.value);
    },
    async ref(owner: StorageScope, id: string) { return owned(owner, id).ref; },
  };
  return { scope, requestId, state, ai, rows, load, partitions, service: new UnderstandingService({ load }, ai, artifacts) };
}

describe('retained per-partition understanding', () => {
  it('reuses every accepted partition after complete reload without more model calls', async () => {
    const f = fixture(); const save = vi.fn(async () => {});
    const final = await f.service.run(f.scope, f.state, f.requestId, new AbortController().signal, save);
    expect(final.total).toBe(2); expect(final.completed).toHaveLength(2); expect(save).toHaveBeenCalledTimes(3);
    expect(f.ai.understand).toHaveBeenCalledTimes(2); vi.mocked(f.ai.understand).mockClear();
    expect(await f.service.run(f.scope, { ...f.state, revision: 100 }, f.requestId, new AbortController().signal, save, JSON.parse(JSON.stringify(final)))).toEqual(final);
    expect(f.ai.understand).not.toHaveBeenCalled(); expect(f.rows.size).toBe(2);
    expect(JSON.stringify(final)).not.toContain('Retained section');
  });
  it('stops on failed checkpoint acknowledgement and resumes only unaccepted work', async () => {
    const f = fixture(); let accepted: UnderstandingCheckpoint | undefined;
    await expect(f.service.run(f.scope, f.state, f.requestId, new AbortController().signal, async checkpoint => {
      accepted = checkpoint; if (checkpoint.completed.length === 1) throw new Error('lease lost after write');
    })).rejects.toThrow('lease lost');
    expect(f.ai.understand).toHaveBeenCalledOnce(); expect(accepted?.completed).toHaveLength(1);
    vi.mocked(f.ai.understand).mockClear();
    const final = await f.service.run(f.scope, f.state, f.requestId, new AbortController().signal, async () => {}, accepted);
    expect(final.completed).toHaveLength(2); expect(f.ai.understand).toHaveBeenCalledOnce();
  });
  it('rejects foreign ownership, stale revisions, changed selection, wrong request IDs and reordered progress', async () => {
    const f = fixture(); const final = await f.service.run(f.scope, f.state, f.requestId, new AbortController().signal, async () => {});
    vi.mocked(f.ai.understand).mockClear(); const run = (state = f.state, checkpoint = final, owner = f.scope, requestId = f.requestId) => f.service.run(owner, state, requestId, new AbortController().signal, async () => {}, checkpoint);
    await expect(run(f.state, final, { ...f.scope, ownerId: 'foreign' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(run({ ...f.state, inputRevision: 3 })).rejects.toThrow('source revision');
    await expect(run(f.state, final, f.scope, randomUUID())).rejects.toThrow('source revision');
    await expect(run({ ...f.state, materials: [{ ...f.state.materials[0], selectedUnitIds: ['different-unit'] }] })).rejects.toThrow('source revision');
    await expect(run(f.state, { ...final, completed: [...final.completed].reverse() })).rejects.toThrow('ledger');
    expect(f.ai.understand).not.toHaveBeenCalled();
  });
  it('validates owned receipt checksums, partition evidence and stored source references on resume', async () => {
    const f = fixture(); const final = await f.service.run(f.scope, f.state, f.requestId, new AbortController().signal, async () => {});
    const original = structuredClone(final); final.completed[0].artifact.checksum = 'b'.repeat(64);
    await expect(f.service.run(f.scope, f.state, f.requestId, new AbortController().signal, async () => {}, final)).rejects.toThrow('partition ledger');
    const row = f.rows.get(original.completed[0].artifact.id)!;
    row.value = { ...row.value as object, source: { materialId: 'foreign' } };
    await expect(f.service.run(f.scope, f.state, f.requestId, new AbortController().signal, async () => {}, original)).rejects.toThrow();
  });
  it('never stores invalid model evidence and honors cancellation before content reads', async () => {
    const f = fixture(); vi.mocked(f.ai.understand).mockResolvedValue({ summary: 'Bad', concepts: [{ label: 'Bad', summary: 'Bad', segmentIds: ['invented'] }], limitations: [] });
    await expect(f.service.run(f.scope, f.state, f.requestId, new AbortController().signal, async () => {})).rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT' } });
    expect(f.rows.size).toBe(0); f.load.mockClear(); const controller = new AbortController(); controller.abort();
    await expect(f.service.run(f.scope, f.state, f.requestId, controller.signal, async () => {})).rejects.toThrow(); expect(f.load).not.toHaveBeenCalled();
  });
});
