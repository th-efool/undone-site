import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { z } from 'zod';
import { intent, result, draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { GENERATED_GUIDE_LIMITATION } from '@/src/shared/cohort-creation/generated-guide';
import { generatedGuideFingerprint, retainGeneratedGuide } from '../generated-guide';
import { ProcessingContentService } from '../processing-content.service';
import { normalizeProcessingInput, partitionProcessingInput } from '../processing-input';
import { CreationStorageError, type ArtifactOptions, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';

function fixture() {
  const materialId = randomUUID(); const scope = { ownerId: 'owner', draftId };
  const body = retainGeneratedGuide(materialId, 2, intent, { provider: 'test', modelId: 'mock', adapterVersion: 'v1' },
    { title: 'Lighting', sections: [{ heading: 'Practice', text: 'Change one light and record the surface response.' }], limitations: ['Limited introductory scope.'] });
  const bytes = Buffer.from(JSON.stringify(body)); const ref = { id: randomUUID(), kind: 'artifact' as const,
    checksum: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
  const header = { ref, artifactType: 'generated-guide', schemaVersion: 1, inputFingerprint: generatedGuideFingerprint(materialId, 2, intent) };
  const state = creationSnapshotSchema.parse({ ...initialSnapshot(draftId), revision: 7, inputRevision: 3, query: intent.rawQuery,
    result, stage: 'starting_point', startingPoint: 'have_goal', status: 'succeeded',
    materials: [{ id: materialId, kind: 'generated_guide', input: { kind: 'goal', intentId: intent.id }, selectedUnitIds: [materialId], status: 'ready' }],
    extractions: [{ materialId, version: body.version, checksum: ref.checksum, artifactRef: ref.id, extractionKind: 'generated_guide', complete: true, segmentCount: body.segments.length }],
    materialRefs: [{ materialId, ids: [ref.id] }] });
  const owned = (owner: StorageScope, id: string) => {
    if (owner.ownerId !== scope.ownerId || owner.draftId !== draftId || id !== ref.id) throw new CreationStorageError('NOT_FOUND', 'Missing owned guide');
  };
  const describeArtifact = vi.fn(async (owner: StorageScope, id: string) => { owned(owner, id); return header; });
  const getJSON = async <T extends z.ZodType>(owner: StorageScope, id: string, options: ArtifactOptions<T>): Promise<z.output<T>> => {
    owned(owner, id); return options.schema.parse(body);
  };
  return { scope, body, ref, header, state, describeArtifact, service: new ProcessingContentService({ describeArtifact, getJSON }) };
}
describe('owned AI-authored guide processing', () => {
  it('loads retained text on reload and preserves AI origin, exact coverage and limitations', async () => {
    const f = fixture(); const loaded = await f.service.load(f.scope, JSON.parse(JSON.stringify(f.state)), new AbortController().signal);
    expect(loaded.partitions.flatMap(part => part.segments).map(segment => segment.text).join('')).toBe(f.body.text);
    expect(loaded.units[0]).toMatchObject({ contentOrigin: 'ai', artifactId: f.ref.id, extractionVersion: f.body.version,
      coverage: { scope: 'ai_authored_guide', exhaustive: false, limitations: [GENERATED_GUIDE_LIMITATION, ...f.body.proposal.limitations] } });
    expect(partitionProcessingInput(loaded.units)).toEqual(loaded.partitions);
  });
  it('rejects foreign ownership and detached references before reading private content', async () => {
    const f = fixture(); const signal = new AbortController().signal;
    await expect(f.service.load({ ...f.scope, ownerId: 'other' }, f.state, signal)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(f.service.load(f.scope, { ...f.state, materialRefs: [] }, signal)).rejects.toThrow('owned accepted draft');
  });
  it('rejects changed intent, source revision, checksum, acquisition fingerprint and model identity', async () => {
    const f = fixture(); const signal = new AbortController().signal;
    await expect(f.service.load(f.scope, { ...f.state, result: { ...result, intent: { ...intent, topic: { ...intent.topic, value: 'Different goal' } } } }, signal)).rejects.toThrow('owned accepted draft');
    f.header.inputFingerprint = 'f'.repeat(64);
    await expect(f.service.load(f.scope, f.state, signal)).rejects.toThrow('owned accepted draft');
    f.header.inputFingerprint = generatedGuideFingerprint(f.body.materialId, 2, intent); f.header.ref.checksum = 'e'.repeat(64);
    await expect(f.service.load(f.scope, f.state, signal)).rejects.toThrow('owned accepted draft');
    expect(() => normalizeProcessingInput(f.state.materials[0], f.state.extractions[0], { ...f.body, identity: { ...f.body.identity, modelId: 'wrong' } })).toThrow('accepted source');
    expect(() => normalizeProcessingInput(f.state.materials[0], f.state.extractions[0], { ...f.body, inputRevision: 5 })).toThrow('accepted source');
    expect(() => normalizeProcessingInput(f.state.materials[0], { ...f.state.extractions[0], extractionKind: 'text' }, f.body)).toThrow('accepted source');
  });
});
