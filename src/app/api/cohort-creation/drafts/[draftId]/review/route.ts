import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { draftService } from '@/src/server/domain/cohort-creation/draft.runtime';
import { loadBuiltCurriculum } from '@/src/server/domain/cohort-creation/processing.runtime';
import { reviewHandler } from '@/src/server/domain/cohort-creation/review.http';
import { creationConversationRepo } from '@/src/server/infrastructure/db/postgres/repositories/creationConversation.repo';
export const runtime = 'nodejs';
const handle = reviewHandler(draftService, getCreationOwner, { load: loadBuiltCurriculum }, creationConversationRepo);
export async function GET(request: Request, context: { params: Promise<{ draftId: string }> }) {
  return handle(request, (await context.params).draftId);
}
