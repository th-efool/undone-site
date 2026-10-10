import { analysisPreviewSchema } from '@/src/shared/cohort-creation/analysis-preview';
export async function loadAnalysisPreview(draftId: string, signal: AbortSignal) {
  const response = await fetch(`/api/cohort-creation/drafts/${encodeURIComponent(draftId)}/analysis`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(response.status === 401 ? 'Sign in again to read your saved analysis.' : 'Saved analysis could not be loaded. Retry.');
  return analysisPreviewSchema.parse(await response.json());
}
