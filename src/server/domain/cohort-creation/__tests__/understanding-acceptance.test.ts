import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { Prisma } from '@/generated/prisma/client';
import { understandingCheckpointSchema, type UnderstandingCheckpoint } from '@/src/shared/cohort-creation/processing';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { understandingArtifactFingerprint, understandingInputFingerprint } from '../understanding.service';
import { pinUnderstanding, preserveUnderstanding, validateUnderstandingCheckpoint } from '@/src/server/infrastructure/db/postgres/repositories/creationUnderstanding.repo';

function fixture() {
  const snapshot = initialSnapshot(draftId); const requestId = randomUUID();
  const initial: UnderstandingCheckpoint = { phase: 'understanding', requestId, inputRevision: snapshot.inputRevision,
    inputFingerprint: understandingInputFingerprint(snapshot, requestId), total: 2, partitionIds: ['a'.repeat(64), 'b'.repeat(64)], completed: [] };
  const partial: UnderstandingCheckpoint = { ...initial, completed: [{ partitionId: initial.partitionIds[0],
    artifact: { id: randomUUID(), kind: 'artifact', checksum: 'c'.repeat(64), byteLength: 123 } }] };
  const full: UnderstandingCheckpoint = { ...partial, completed: [...partial.completed, { partitionId: initial.partitionIds[1],
    artifact: { id: randomUUID(), kind: 'artifact', checksum: 'd'.repeat(64), byteLength: 456 } }] };
  return { snapshot, requestId, initial, partial, full };
}
describe('understanding acceptance primitives', () => {
  it('binds checkpoints to request and exact frozen input, while allowing unrelated snapshot revisions', () => {
    const f = fixture(); expect(validateUnderstandingCheckpoint(f.snapshot, f.requestId, f.partial)).toEqual(f.partial);
    expect(validateUnderstandingCheckpoint({ ...f.snapshot, revision: 100 }, f.requestId, f.partial)).toEqual(f.partial);
    expect(() => validateUnderstandingCheckpoint(f.snapshot, randomUUID(), f.partial)).toThrow();
    expect(() => validateUnderstandingCheckpoint({ ...f.snapshot, inputRevision: 1 }, f.requestId, f.partial)).toThrow();
    expect(() => validateUnderstandingCheckpoint(f.snapshot, f.requestId, { ...f.partial, inputFingerprint: 'f'.repeat(64) })).toThrow();
  });
  it('preserves inventory and accepted prefix without permitting regression or replacement', () => {
    const f = fixture(); expect(preserveUnderstanding(null, f.initial)).toEqual(f.initial);
    expect(preserveUnderstanding(f.initial, f.partial)).toEqual(f.partial); expect(preserveUnderstanding(f.partial, f.full)).toEqual(f.full);
    expect(preserveUnderstanding(f.full, f.full)).toEqual(f.full);
    expect(() => preserveUnderstanding(f.partial, f.initial)).toThrow('Cannot regress');
    const replaced = structuredClone(f.full); replaced.completed[0].artifact.id = randomUUID();
    expect(() => preserveUnderstanding(f.partial, replaced)).toThrow('Cannot regress');
    expect(() => preserveUnderstanding(f.initial, { ...f.initial, partitionIds: ['b'.repeat(64), 'a'.repeat(64)] })).toThrow('Cannot regress');
    expect(understandingCheckpointSchema.safeParse({ ...f.full, completed: [...f.full.completed].reverse() }).success).toBe(false);
    expect(understandingCheckpointSchema.safeParse({ ...f.initial, total: 3 }).success).toBe(false);
  });
  it('pins only ready owned typed receipts with matching partition fingerprints and references', async () => {
    const f = fixture(); const updateMany = vi.fn(async () => ({ count: 1 })); const tx = { creationStorageObject: { updateMany } } as unknown as Prisma.TransactionClient;
    await pinUnderstanding(tx, { ownerId: 'owner', draftId }, f.full); expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany.mock.calls[0]).toEqual([expect.objectContaining({ where: { id: f.full.completed[0].artifact.id, ownerId: 'owner', draftId,
      status: 'ready', kind: 'artifact', byteLength: 123, checksum: 'c'.repeat(64), artifactType: 'creation-understanding', schemaVersion: 1,
      inputFingerprint: understandingArtifactFingerprint(f.initial.inputFingerprint, f.initial.partitionIds[0]) } })]);
    updateMany.mockResolvedValue({ count: 0 }); await expect(pinUnderstanding(tx, { ownerId: 'foreign', draftId }, f.partial)).rejects.toThrow('storage reference unavailable');
  });
});
