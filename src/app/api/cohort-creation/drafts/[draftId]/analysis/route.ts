import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { draftService } from '@/src/server/domain/cohort-creation/draft.runtime';
import { loadAnalysisPreview } from '@/src/server/domain/cohort-creation/processing.runtime';
import { analysisPreviewHandler } from '@/src/server/domain/cohort-creation/analysis-preview.http';
export const runtime = 'nodejs';
const handle = analysisPreviewHandler(draftService, getCreationOwner, loadAnalysisPreview);
export async function GET(request: Request, context: { params: Promise<{ draftId: string }> }) {
  return handle(request, (await context.params).draftId);
}
