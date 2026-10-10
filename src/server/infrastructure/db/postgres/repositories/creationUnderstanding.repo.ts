import type { Prisma } from '@/generated/prisma/client';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { understandingCheckpointSchema, type UnderstandingCheckpoint } from '@/src/shared/cohort-creation/processing';
import { understandingArtifactFingerprint, understandingInputFingerprint } from '@/src/server/domain/cohort-creation/understanding.service';
import type { StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';

/** The enclosing repository transaction must lock the draft and check its current request/lease first. */
export function validateUnderstandingCheckpoint(snapshot: CreationSnapshot, requestId: string, value: unknown) {
  const checkpoint = understandingCheckpointSchema.parse(value);
  if (checkpoint.requestId !== requestId || checkpoint.inputRevision !== snapshot.inputRevision ||
    checkpoint.inputFingerprint !== understandingInputFingerprint(snapshot, requestId)) throw new Error('Understanding request unavailable');
  return checkpoint;
}

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
