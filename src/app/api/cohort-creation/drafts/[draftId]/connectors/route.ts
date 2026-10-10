import { handleCreationConnections } from '@/src/server/domain/cohort-creation/connectors.runtime';
export const runtime = 'nodejs';
type Context = { params: Promise<{ draftId: string }> };
async function handle(request: Request, context: Context) {
  return handleCreationConnections(request, (await context.params).draftId);
}
export { handle as GET, handle as POST, handle as DELETE };
