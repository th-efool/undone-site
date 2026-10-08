import { handleDraftRequest } from '@/src/server/domain/cohort-creation/draft.runtime';
export const runtime = 'nodejs';
export const maxDuration = 35;
type Context = { params: Promise<{ draftId: string }> };
export async function GET(request: Request, context: Context) { return handleDraftRequest(request, (await context.params).draftId); }
export async function PATCH(request: Request, context: Context) { return handleDraftRequest(request, (await context.params).draftId); }
