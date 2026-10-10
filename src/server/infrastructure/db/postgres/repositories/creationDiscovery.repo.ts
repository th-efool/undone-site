import type { Prisma } from '@/generated/prisma/client';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import type { DiscoveryCheckpoint } from '@/src/shared/cohort-creation/discovery';
import type { ClaimedDiscoveryJob } from '@/src/server/domain/cohort-creation/durable-job';
import { validateDiscoveryCheckpoint } from '@/src/server/domain/cohort-creation/job-completion';

export function preserveDiscovery(current: CreationSnapshot, checkpoint: DiscoveryCheckpoint, partial = false) {
  if (current.discovery?.requestId !== checkpoint.requestId || current.discovery.inputRevision !== checkpoint.inputRevision) throw new Error('Discovery request unavailable');
  const previous = current.discovery.checkpoint;
  if (previous && (JSON.stringify(previous.searchArtifact) !== JSON.stringify(checkpoint.searchArtifact) || checkpoint.processed < previous.processed ||
    previous.total !== checkpoint.total || previous.selectionArtifact && JSON.stringify(previous) !== JSON.stringify(checkpoint) ||
    checkpoint.processed === previous.processed && previous.observationArtifact && JSON.stringify(previous.observationArtifact) !== JSON.stringify(checkpoint.observationArtifact)) ||
    partial && current.discovery.result !== null) throw new Error('Cannot regress or replace accepted discovery work');
}
export async function pinDiscovery(tx: Prisma.TransactionClient, job: ClaimedDiscoveryJob, value: DiscoveryCheckpoint) {
  const checkpoint = validateDiscoveryCheckpoint(job, value);
  const references = [{ ref: checkpoint.searchArtifact, type: 'discovery-search' },
    ...(checkpoint.observationArtifact ? [{ ref: checkpoint.observationArtifact, type: 'discovery-observations' }] : []),
    ...(checkpoint.selectionArtifact ? [{ ref: checkpoint.selectionArtifact, type: 'discovery-selection' }] : [])];
  for (const { ref, type } of references) {
    const pinned = await tx.creationStorageObject.updateMany({ where: { id: ref.id, ownerId: job.ownerId, draftId: job.draftId,
      status: 'ready', kind: 'artifact', byteLength: ref.byteLength, checksum: ref.checksum, artifactType: type,
      schemaVersion: 1, inputFingerprint: checkpoint.inputFingerprint }, data: { referencedAt: new Date() } });
    if (pinned.count !== 1) throw new Error('Checkpoint storage reference unavailable');
  }
}
