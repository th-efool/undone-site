import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { draftService } from '@/src/server/domain/cohort-creation/draft.runtime';
import { loadUnderstandingPreview } from '@/src/server/domain/cohort-creation/processing.runtime';
import { understandingPreviewHandler } from '@/src/server/domain/cohort-creation/understanding-preview.http';
export const runtime = 'nodejs';
const handle = understandingPreviewHandler(draftService, getCreationOwner, loadUnderstandingPreview);
export async function GET(request: Request, context: { params: Promise<{ draftId: string }> }) {
  return handle(request, (await context.params).draftId);
}
