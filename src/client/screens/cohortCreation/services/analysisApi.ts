import { analysisPreviewSchema } from '@/src/shared/cohort-creation/analysis-preview';
import { creationJson, CreationTransportError, creationErrorMessage } from './creationTransport';
export async function loadAnalysisPreview(draftId: string, signal: AbortSignal) {
  const { response, body, retryAfterSeconds } = await creationJson(`/api/cohort-creation/drafts/${encodeURIComponent(draftId)}/analysis`, { signal });
  if (!response.ok) throw new CreationTransportError(creationErrorMessage(body, 'Saved analysis could not be loaded. Retry.'), response.status, retryAfterSeconds);
  return analysisPreviewSchema.parse(body);
}
