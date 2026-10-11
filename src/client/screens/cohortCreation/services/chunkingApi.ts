import { chunkingPreviewSchema } from '@/src/shared/cohort-creation/chunking';
import { creationJson, CreationTransportError, creationErrorMessage } from './creationTransport';
export async function loadChunkingPreview(draftId: string, signal: AbortSignal) {
  const { response, body, retryAfterSeconds } = await creationJson(`/api/cohort-creation/drafts/${encodeURIComponent(draftId)}/chunks`, { signal });
  if (!response.ok) throw new CreationTransportError(creationErrorMessage(body, 'Saved chunks could not be loaded. Retry.'), response.status, retryAfterSeconds);
  return chunkingPreviewSchema.parse(body);
}
