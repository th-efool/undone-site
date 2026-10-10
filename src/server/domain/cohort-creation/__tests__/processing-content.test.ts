import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { z } from 'zod';
import { result, draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import type { ArtifactOptions, StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { ProcessingContentService } from '../processing-content.service';
import { extractRetainedText } from '../materials/text';

function fixture() {
  const scope = { ownerId: 'owner', draftId }; const materialId = randomUUID(); const bytes = Buffer.from('Actual retained learning content.\n');
  const upload = { id: randomUUID(), kind: 'upload' as const, checksum: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
  let body: unknown = extractRetainedText(bytes, upload, materialId, materialId);
  const extraction = body as ReturnType<typeof extractRetainedText>;
  const ref = { id: randomUUID(), kind: 'artifact' as const, checksum: 'a'.repeat(64), byteLength: 500 };
  const header = { ref, artifactType: 'text-extraction', schemaVersion: 1, inputFingerprint: 'accepted-acquisition-fingerprint' };
  const state = creationSnapshotSchema.parse({ ...initialSnapshot(draftId), revision: 5, inputRevision: 2, query: result.intent.rawQuery,
    result, stage: 'starting_point', startingPoint: 'have_material', status: 'succeeded',
    materials: [{ id: materialId, kind: 'markdown', input: { kind: 'upload', assetId: upload.id }, selectedUnitIds: [materialId], status: 'ready' }],
    extractions: [{ materialId, version: extraction.version, checksum: upload.checksum, artifactRef: ref.id, extractionKind: 'text', complete: true, segmentCount: extraction.segments.length }],
    materialRefs: [{ materialId, ids: [ref.id] }] });
  const owned = (owner: StorageScope, id: string) => {
    if (owner.ownerId !== scope.ownerId || owner.draftId !== scope.draftId || id !== ref.id) throw new CreationStorageError('NOT_FOUND', 'Missing artifact');
  };
  const describeArtifact = vi.fn(async (owner: StorageScope, id: string) => { owned(owner, id); return header; });
  const read = async <T extends z.ZodType>(owner: StorageScope, id: string, options: ArtifactOptions<T>): Promise<z.output<T>> => {
    owned(owner, id); expect(options.inputFingerprint).toBe(header.inputFingerprint); options.signal?.throwIfAborted(); return options.schema.parse(body);
  };
  const getJSON = vi.fn(read);
  return { scope, state, describeArtifact, getJSON, header, setBody(value: unknown) { body = value; },
    service: new ProcessingContentService({ describeArtifact, getJSON: getJSON as typeof read }) };
}

describe('owned processing content reads', () => {
  it('loads accepted real content after JSON reload, without acquiring material or calling AI', async () => {
    const f = fixture(); const output = await f.service.load(f.scope, JSON.parse(JSON.stringify(f.state)), new AbortController().signal);
    expect(output.partitions.flatMap(part => part.segments).map(segment => segment.text).join('')).toBe('Actual retained learning content.\n');
    expect(f.describeArtifact).toHaveBeenCalledWith(f.scope, f.state.extractions[0].artifactRef);
    expect(f.getJSON).toHaveBeenCalledOnce(); expect(f.state.revision).toBe(5);
  });
  it('denies foreign ownership, wrong draft scope, unavailable sources and detached accepted references', async () => {
    const f = fixture(); const signal = new AbortController().signal;
    await expect(f.service.load({ ...f.scope, ownerId: 'foreign' }, f.state, signal)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(f.service.load({ ...f.scope, draftId: randomUUID() }, f.state, signal)).rejects.toThrow('owned accepted draft');
    await expect(f.service.load(f.scope, { ...f.state, materialRefs: [] }, signal)).rejects.toThrow('owned accepted draft');
    await expect(f.service.load(f.scope, { ...f.state, materials: [], extractions: [], materialRefs: [] }, signal)).rejects.toThrow('owned accepted draft');
    expect(f.getJSON).not.toHaveBeenCalled();
  });
  it('rejects wrong artifact types, schema versions and bodies that disagree with accepted extraction identity', async () => {
    const f = fixture(); const signal = new AbortController().signal;
    f.header.artifactType = 'discovery-search';
    await expect(f.service.load(f.scope, f.state, signal)).rejects.toThrow('owned accepted draft');
    f.header.artifactType = 'text-extraction'; f.header.schemaVersion = 2;
    await expect(f.service.load(f.scope, f.state, signal)).rejects.toThrow('owned accepted draft');
    expect(f.getJSON).not.toHaveBeenCalled(); f.header.schemaVersion = 1;
    await expect(f.service.load(f.scope, { ...f.state, extractions: [{ ...f.state.extractions[0], version: 'b'.repeat(64) }] }, signal)).rejects.toThrow('accepted source');
    f.setBody({ title: 'metadata is not extracted content' });
    await expect(f.service.load(f.scope, f.state, signal)).rejects.toThrow();
  });
  it('honors cancellation before storage access', async () => {
    const f = fixture(); const controller = new AbortController(); controller.abort();
    await expect(f.service.load(f.scope, f.state, controller.signal)).rejects.toThrow();
    expect(f.describeArtifact).not.toHaveBeenCalled(); expect(f.getJSON).not.toHaveBeenCalled();
  });
});
