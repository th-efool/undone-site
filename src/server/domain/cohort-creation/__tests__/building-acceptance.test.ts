import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { Prisma } from '@/generated/prisma/client';
import { buildingCheckpointSchema, type BuildingCheckpoint } from '@/src/shared/cohort-creation/build';
import { buildingArtifactFingerprint } from '../building.service';
import { pinBuilding, preserveBuilding } from '@/src/server/infrastructure/db/postgres/repositories/creationBuilding.repo';

function fixture() {
  const initial: BuildingCheckpoint = { phase: 'building', requestId: randomUUID(), inputRevision: 2, inputFingerprint: 'a'.repeat(64),
    analysisFingerprint: 'b'.repeat(64), total: 2, partitionIds: ['c'.repeat(64), 'd'.repeat(64)], completed: [] };
  const partial: BuildingCheckpoint = { ...initial, completed: [{ partitionId: initial.partitionIds[0], lessonCount: 2,
    artifact: { id: randomUUID(), kind: 'artifact', checksum: 'e'.repeat(64), byteLength: 123 } }] };
  const full: BuildingCheckpoint = { ...partial, completed: [...partial.completed, { partitionId: initial.partitionIds[1], lessonCount: 1,
    artifact: { id: randomUUID(), kind: 'artifact', checksum: 'f'.repeat(64), byteLength: 456 } }] };
  return { initial, partial, full };
}
describe('building acceptance primitives', () => {
  it('preserves accepted inventory, understanding dependency, receipt counts and prefix', () => {
    const f = fixture(); expect(preserveBuilding(null, f.initial)).toEqual(f.initial);
    expect(preserveBuilding(f.initial, f.partial)).toEqual(f.partial); expect(preserveBuilding(f.partial, f.full)).toEqual(f.full);
    expect(preserveBuilding(f.full, structuredClone(f.full))).toEqual(f.full);
    expect(() => preserveBuilding(f.partial, f.initial)).toThrow('Cannot regress');
    for (const patch of [{ requestId: randomUUID() }, { inputRevision: 3 }, { inputFingerprint: 'f'.repeat(64) }, { analysisFingerprint: 'f'.repeat(64) },
      { completed: [{ ...f.full.completed[0], lessonCount: 3 }, f.full.completed[1]] },
      { completed: [{ ...f.full.completed[0], artifact: { ...f.full.completed[0].artifact, id: randomUUID() } }, f.full.completed[1]] }]) {
      expect(() => preserveBuilding(f.partial, { ...f.full, ...patch })).toThrow('Cannot regress');
    }
    expect(buildingCheckpointSchema.safeParse({ ...f.full, completed: [...f.full.completed].reverse() }).success).toBe(false);
    expect(buildingCheckpointSchema.safeParse({ ...f.initial, total: 3 }).success).toBe(false);
  });
  it('bounds counts, forbids duplicate artifacts and rejects aggregate scope without truncation', () => {
    const f = fixture();
    for (const lessonCount of [0, 101, 1.5]) expect(buildingCheckpointSchema.safeParse({ ...f.partial,
      completed: [{ ...f.partial.completed[0], lessonCount }] }).success).toBe(false);
    expect(buildingCheckpointSchema.safeParse({ ...f.full, completed: [f.full.completed[0], { ...f.full.completed[1], artifact: f.full.completed[0].artifact }] }).success).toBe(false);
    const partitionIds = Array.from({ length: 26 }, (_, index) => index.toString(16).padStart(64, '0'));
    expect(buildingCheckpointSchema.safeParse({ ...f.initial, total: 26, partitionIds,
      completed: partitionIds.map(partitionId => ({ partitionId, lessonCount: 100, artifact: { ...f.partial.completed[0].artifact, id: randomUUID() } })) }).success).toBe(false);
  });
  it('pins only matching owned, ready, typed and fingerprinted receipts', async () => {
    const f = fixture(); const updateMany = vi.fn(async () => ({ count: 1 })); const tx = { creationStorageObject: { updateMany } } as unknown as Prisma.TransactionClient;
    const scope = { ownerId: 'owner', draftId: randomUUID() }; await pinBuilding(tx, scope, f.full); expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany.mock.calls[0]).toEqual([expect.objectContaining({ where: { id: f.partial.completed[0].artifact.id, ...scope,
      status: 'ready', kind: 'artifact', byteLength: 123, checksum: 'e'.repeat(64), artifactType: 'creation-building', schemaVersion: 1,
      inputFingerprint: buildingArtifactFingerprint(f.initial.inputFingerprint, f.initial.partitionIds[0]) } })]);
    updateMany.mockResolvedValue({ count: 0 }); await expect(pinBuilding(tx, { ...scope, ownerId: 'foreign' }, f.partial)).rejects.toThrow('storage reference unavailable');
  });
});
