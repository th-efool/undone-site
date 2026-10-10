import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { Prisma } from '@/generated/prisma/client';
import { analysisCheckpointSchema, type AnalysisCheckpoint } from '@/src/shared/cohort-creation/analysis';
import { analysisArtifactFingerprint } from '../analysis.service';
import { pinAnalysis, preserveAnalysis } from '@/src/server/infrastructure/db/postgres/repositories/creationAnalysis.repo';

function fixture() {
  const initial: AnalysisCheckpoint = { phase: 'analysis', requestId: randomUUID(), inputRevision: 2, inputFingerprint: 'a'.repeat(64),
    chunkingFingerprint: 'b'.repeat(64), total: 2, partitionIds: ['c'.repeat(64), 'd'.repeat(64)], completed: [] };
  const partial: AnalysisCheckpoint = { ...initial, completed: [{ partitionId: initial.partitionIds[0], chunkCount: 2,
    artifact: { id: randomUUID(), kind: 'artifact', checksum: 'e'.repeat(64), byteLength: 123 } }] };
  const full: AnalysisCheckpoint = { ...partial, completed: [...partial.completed, { partitionId: initial.partitionIds[1], chunkCount: 1,
    artifact: { id: randomUUID(), kind: 'artifact', checksum: 'f'.repeat(64), byteLength: 456 } }] };
  return { initial, partial, full };
}
describe('analysis acceptance primitives', () => {
  it('preserves accepted inventory, understanding dependency, receipt counts and prefix', () => {
    const f = fixture(); expect(preserveAnalysis(null, f.initial)).toEqual(f.initial);
    expect(preserveAnalysis(f.initial, f.partial)).toEqual(f.partial); expect(preserveAnalysis(f.partial, f.full)).toEqual(f.full);
    expect(preserveAnalysis(f.full, structuredClone(f.full))).toEqual(f.full);
    expect(() => preserveAnalysis(f.partial, f.initial)).toThrow('Cannot regress');
    for (const patch of [{ requestId: randomUUID() }, { inputRevision: 3 }, { inputFingerprint: 'f'.repeat(64) }, { chunkingFingerprint: 'f'.repeat(64) },
      { completed: [{ ...f.full.completed[0], chunkCount: 3 }, f.full.completed[1]] },
      { completed: [{ ...f.full.completed[0], artifact: { ...f.full.completed[0].artifact, id: randomUUID() } }, f.full.completed[1]] }]) {
      expect(() => preserveAnalysis(f.partial, { ...f.full, ...patch })).toThrow('Cannot regress');
    }
    expect(analysisCheckpointSchema.safeParse({ ...f.full, completed: [...f.full.completed].reverse() }).success).toBe(false);
    expect(analysisCheckpointSchema.safeParse({ ...f.initial, total: 3 }).success).toBe(false);
  });
  it('bounds counts, forbids duplicate artifacts and rejects aggregate scope without truncation', () => {
    const f = fixture();
    for (const chunkCount of [0, 201, 1.5]) expect(analysisCheckpointSchema.safeParse({ ...f.partial,
      completed: [{ ...f.partial.completed[0], chunkCount }] }).success).toBe(false);
    expect(analysisCheckpointSchema.safeParse({ ...f.full, completed: [f.full.completed[0], { ...f.full.completed[1], artifact: f.full.completed[0].artifact }] }).success).toBe(false);
    const partitionIds = Array.from({ length: 13 }, (_, index) => index.toString(16).padStart(64, '0'));
    expect(analysisCheckpointSchema.safeParse({ ...f.initial, total: 13, partitionIds,
      completed: partitionIds.map(partitionId => ({ partitionId, chunkCount: 200, artifact: { ...f.partial.completed[0].artifact, id: randomUUID() } })) }).success).toBe(false);
  });
  it('pins only matching owned, ready, typed and fingerprinted receipts', async () => {
    const f = fixture(); const updateMany = vi.fn(async () => ({ count: 1 })); const tx = { creationStorageObject: { updateMany } } as unknown as Prisma.TransactionClient;
    const scope = { ownerId: 'owner', draftId: randomUUID() }; await pinAnalysis(tx, scope, f.full); expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany.mock.calls[0]).toEqual([expect.objectContaining({ where: { id: f.partial.completed[0].artifact.id, ...scope,
      status: 'ready', kind: 'artifact', byteLength: 123, checksum: 'e'.repeat(64), artifactType: 'creation-analysis', schemaVersion: 1,
      inputFingerprint: analysisArtifactFingerprint(f.initial.inputFingerprint, f.initial.partitionIds[0]) } })]);
    updateMany.mockResolvedValue({ count: 0 }); await expect(pinAnalysis(tx, { ...scope, ownerId: 'foreign' }, f.partial)).rejects.toThrow('storage reference unavailable');
  });
});
