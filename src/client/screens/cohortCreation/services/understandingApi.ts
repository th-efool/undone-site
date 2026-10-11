import { understandingPreviewSchema } from '@/src/shared/cohort-creation/processing';
import { creationJson, CreationTransportError, creationErrorMessage } from './creationTransport';
export async function loadUnderstandingPreview(draftId: string, signal: AbortSignal) {
  const { response, body, retryAfterSeconds } = await creationJson(`/api/cohort-creation/drafts/${encodeURIComponent(draftId)}/understanding`, { signal });
  if (!response.ok) throw new CreationTransportError(creationErrorMessage(body, 'Saved concepts could not be loaded. Retry.'), response.status, retryAfterSeconds);
  return understandingPreviewSchema.parse(body);
}
