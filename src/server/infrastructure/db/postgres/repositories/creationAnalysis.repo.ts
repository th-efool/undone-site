import type { Prisma } from '@/generated/prisma/client';
import { analysisCheckpointSchema, type AnalysisCheckpoint } from '@/src/shared/cohort-creation/analysis';
import { analysisArtifactFingerprint } from '@/src/server/domain/cohort-creation/analysis.service';
import type { StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';

export function preserveAnalysis(previous: AnalysisCheckpoint | null, value: AnalysisCheckpoint) {
  const checkpoint = analysisCheckpointSchema.parse(value);
  if (!previous) return checkpoint;
  const accepted = analysisCheckpointSchema.parse(previous);
  if (accepted.requestId !== checkpoint.requestId || accepted.inputRevision !== checkpoint.inputRevision || accepted.inputFingerprint !== checkpoint.inputFingerprint ||
    accepted.chunkingFingerprint !== checkpoint.chunkingFingerprint || JSON.stringify(accepted.partitionIds) !== JSON.stringify(checkpoint.partitionIds) ||
    checkpoint.completed.length < accepted.completed.length || accepted.completed.some((item, index) => JSON.stringify(item) !== JSON.stringify(checkpoint.completed[index]))) {
    throw new Error('Cannot regress or replace accepted analysis work');
  }
  return checkpoint;
}

/** Call only after frozen-input validation and lease fencing, within the checkpoint transaction. */
export async function pinAnalysis(tx: Prisma.TransactionClient, scope: StorageScope, value: AnalysisCheckpoint) {
  const checkpoint = analysisCheckpointSchema.parse(value);
  for (const completed of checkpoint.completed) {
    const ref = completed.artifact;
    const result = await tx.creationStorageObject.updateMany({ where: { id: ref.id, ownerId: scope.ownerId, draftId: scope.draftId,
      status: 'ready', kind: 'artifact', byteLength: ref.byteLength, checksum: ref.checksum, artifactType: 'creation-analysis', schemaVersion: 1,
      inputFingerprint: analysisArtifactFingerprint(checkpoint.inputFingerprint, completed.partitionId) }, data: { referencedAt: new Date() } });
    if (result.count !== 1) throw new Error('Analysis storage reference unavailable');
  }
}
