import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { draftService } from '@/src/server/domain/cohort-creation/draft.runtime';
import { loadChunkingPreview } from '@/src/server/domain/cohort-creation/processing.runtime';
import { chunkingPreviewHandler } from '@/src/server/domain/cohort-creation/chunking-preview.http';
export const runtime = 'nodejs';
const handle = chunkingPreviewHandler(draftService, getCreationOwner, loadChunkingPreview);
export async function GET(request: Request, context: { params: Promise<{ draftId: string }> }) {
  return handle(request, (await context.params).draftId);
}
