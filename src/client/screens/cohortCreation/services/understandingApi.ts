import { understandingPreviewSchema } from '@/src/shared/cohort-creation/processing';
export async function loadUnderstandingPreview(draftId: string, signal: AbortSignal) {
  const response = await fetch(`/api/cohort-creation/drafts/${encodeURIComponent(draftId)}/understanding`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(response.status === 401 ? 'Sign in again to read your saved concepts.' : 'Saved concepts could not be loaded. Retry.');
  return understandingPreviewSchema.parse(await response.json());
}
