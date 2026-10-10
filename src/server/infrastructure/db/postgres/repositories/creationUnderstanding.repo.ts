import type { Prisma } from '@/generated/prisma/client';
import { understandingCheckpointSchema, type UnderstandingCheckpoint } from '@/src/shared/cohort-creation/processing';
import { understandingArtifactFingerprint } from '@/src/server/domain/cohort-creation/understanding.service';
export { validateUnderstandingCheckpoint } from '@/src/server/domain/cohort-creation/understanding.service';
import type { StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';

export function preserveUnderstanding(previous: UnderstandingCheckpoint | null, value: UnderstandingCheckpoint) {
  const checkpoint = understandingCheckpointSchema.parse(value);
  if (!previous) return checkpoint;
  const accepted = understandingCheckpointSchema.parse(previous);
  if (accepted.requestId !== checkpoint.requestId || accepted.inputRevision !== checkpoint.inputRevision || accepted.inputFingerprint !== checkpoint.inputFingerprint ||
    JSON.stringify(accepted.partitionIds) !== JSON.stringify(checkpoint.partitionIds) || checkpoint.completed.length < accepted.completed.length ||
    accepted.completed.some((item, index) => JSON.stringify(item) !== JSON.stringify(checkpoint.completed[index]))) {
    throw new Error('Cannot regress or replace accepted understanding work');
  }
  return checkpoint;
}

/** Pin only after request validation and fencing, in the same transaction as checkpoint acceptance. */
export async function pinUnderstanding(tx: Prisma.TransactionClient, scope: StorageScope, value: UnderstandingCheckpoint) {
  const checkpoint = understandingCheckpointSchema.parse(value);
  for (const completed of checkpoint.completed) {
    const ref = completed.artifact;
    const result = await tx.creationStorageObject.updateMany({ where: { id: ref.id, ownerId: scope.ownerId, draftId: scope.draftId,
      status: 'ready', kind: 'artifact', byteLength: ref.byteLength, checksum: ref.checksum, artifactType: 'creation-understanding', schemaVersion: 1,
      inputFingerprint: understandingArtifactFingerprint(checkpoint.inputFingerprint, completed.partitionId) }, data: { referencedAt: new Date() } });
    if (result.count !== 1) throw new Error('Understanding storage reference unavailable');
  }
}
