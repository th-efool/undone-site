import { chunkingPreviewSchema } from '@/src/shared/cohort-creation/chunking';
export async function loadChunkingPreview(draftId: string, signal: AbortSignal) {
  const response = await fetch(`/api/cohort-creation/drafts/${encodeURIComponent(draftId)}/chunks`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(response.status === 401 ? 'Sign in again to read your saved chunks.' : 'Saved chunks could not be loaded. Retry.');
  return chunkingPreviewSchema.parse(await response.json());
}
