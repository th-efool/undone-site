import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { draftService } from '@/src/server/domain/cohort-creation/draft.runtime';
import { discoveryAttributionHandler } from '@/src/server/domain/cohort-creation/discovery-attribution.http';
import { readDiscoveryAttribution } from '@/src/server/domain/cohort-creation/discovery.service';
export const runtime = 'nodejs';
const handle = discoveryAttributionHandler(draftService, getCreationOwner, async (...args) => {
  const { creationArtifactRepository } = await import('@/src/server/infrastructure/storage/creation.runtime');
  return readDiscoveryAttribution(creationArtifactRepository, ...args);
});
export async function GET(request: Request, context: { params: Promise<{ draftId: string }> }) {
  return handle(request, (await context.params).draftId);
}
