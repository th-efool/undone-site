import 'server-only';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import type { PublicationCheckpoint } from '@/src/shared/cohort-creation/publication';
import type { StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import { PublicationService } from './publication.service';
import { loadBuiltCurriculum } from './processing.runtime';
export async function publicationService() {
  const { creationArtifactRepository } = await import('@/src/server/infrastructure/storage/creation.runtime');
  return new PublicationService({ load: loadBuiltCurriculum }, creationArtifactRepository);
}
export async function loadPublicationPrepared(scope: StorageScope, snapshot: CreationSnapshot, checkpoint: PublicationCheckpoint) {
  return (await publicationService()).loadPrepared(scope, snapshot, checkpoint, AbortSignal.timeout(60_000));
}
