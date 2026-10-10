import type { Prisma } from '@/generated/prisma/client';
import { buildingCheckpointSchema, type BuildingCheckpoint } from '@/src/shared/cohort-creation/build';
import { buildingArtifactFingerprint } from '@/src/server/domain/cohort-creation/building.service';
import type { StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';

export function preserveBuilding(previous: BuildingCheckpoint | null, value: BuildingCheckpoint) {
  const checkpoint = buildingCheckpointSchema.parse(value);
  if (!previous) return checkpoint;
  const accepted = buildingCheckpointSchema.parse(previous);
  if (accepted.requestId !== checkpoint.requestId || accepted.inputRevision !== checkpoint.inputRevision || accepted.inputFingerprint !== checkpoint.inputFingerprint ||
    accepted.analysisFingerprint !== checkpoint.analysisFingerprint || JSON.stringify(accepted.partitionIds) !== JSON.stringify(checkpoint.partitionIds) ||
    checkpoint.completed.length < accepted.completed.length || accepted.completed.some((item, index) => JSON.stringify(item) !== JSON.stringify(checkpoint.completed[index]))) {
    throw new Error('Cannot regress or replace accepted building work');
  }
  return checkpoint;
}

/** Call only after frozen-input validation and lease fencing, within the checkpoint transaction. */
export async function pinBuilding(tx: Prisma.TransactionClient, scope: StorageScope, value: BuildingCheckpoint) {
  const checkpoint = buildingCheckpointSchema.parse(value);
  for (const completed of checkpoint.completed) {
    const ref = completed.artifact;
    const result = await tx.creationStorageObject.updateMany({ where: { id: ref.id, ownerId: scope.ownerId, draftId: scope.draftId,
      status: 'ready', kind: 'artifact', byteLength: ref.byteLength, checksum: ref.checksum, artifactType: 'creation-building', schemaVersion: 1,
      inputFingerprint: buildingArtifactFingerprint(checkpoint.inputFingerprint, completed.partitionId) }, data: { referencedAt: new Date() } });
    if (result.count !== 1) throw new Error('Building storage reference unavailable');
  }
}
