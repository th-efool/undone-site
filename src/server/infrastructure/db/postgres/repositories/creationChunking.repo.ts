import type { Prisma } from '@/generated/prisma/client';
import { chunkingCheckpointSchema, type ChunkingCheckpoint } from '@/src/shared/cohort-creation/processing';
import { chunkingArtifactFingerprint } from '@/src/server/domain/cohort-creation/chunking.service';
import type { StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';

export function preserveChunking(previous: ChunkingCheckpoint | null, value: ChunkingCheckpoint) {
  const checkpoint = chunkingCheckpointSchema.parse(value);
  if (!previous) return checkpoint;
  const accepted = chunkingCheckpointSchema.parse(previous);
  if (accepted.requestId !== checkpoint.requestId || accepted.inputRevision !== checkpoint.inputRevision || accepted.inputFingerprint !== checkpoint.inputFingerprint ||
    accepted.understandingFingerprint !== checkpoint.understandingFingerprint || JSON.stringify(accepted.partitionIds) !== JSON.stringify(checkpoint.partitionIds) ||
    checkpoint.completed.length < accepted.completed.length || accepted.completed.some((item, index) => JSON.stringify(item) !== JSON.stringify(checkpoint.completed[index]))) {
    throw new Error('Cannot regress or replace accepted chunking work');
  }
  return checkpoint;
}

/** Call only after frozen-input validation and lease fencing, within the checkpoint transaction. */
export async function pinChunking(tx: Prisma.TransactionClient, scope: StorageScope, value: ChunkingCheckpoint) {
  const checkpoint = chunkingCheckpointSchema.parse(value);
  for (const completed of checkpoint.completed) {
    const ref = completed.artifact;
    const result = await tx.creationStorageObject.updateMany({ where: { id: ref.id, ownerId: scope.ownerId, draftId: scope.draftId,
      status: 'ready', kind: 'artifact', byteLength: ref.byteLength, checksum: ref.checksum, artifactType: 'creation-chunking', schemaVersion: 1,
      inputFingerprint: chunkingArtifactFingerprint(checkpoint.inputFingerprint, completed.partitionId) }, data: { referencedAt: new Date() } });
    if (result.count !== 1) throw new Error('Chunking storage reference unavailable');
  }
}
