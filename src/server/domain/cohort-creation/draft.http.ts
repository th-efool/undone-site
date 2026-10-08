import { z } from 'zod';
import { creationCommandSchema } from '@/src/shared/cohort-creation/flow';
import { DraftConflict, DraftNotFound, type DraftService } from './draft.service';
import { RecommendationBudget } from './recommendation.http';

const idSchema = z.uuid();
const createSchema = z.strictObject({ draftId: idSchema });
const updateSchema = z.strictObject({ baseRevision: z.number().int().nonnegative(), command: creationCommandSchema });
export function draftHandlers(service: DraftService, getOwner: () => Promise<string | null>, budget = new RecommendationBudget()) {
  async function handle(request: Request, id?: string): Promise<Response> {
    try {
      const owner = await getOwner();
      if (!owner) return Response.json({ message: 'Sign in to access drafts.' }, { status: 401 });
      if (id !== undefined && !idSchema.safeParse(id).success) return Response.json({ message: 'Draft not found.' }, { status: 404 });
      if (request.method === 'GET') return Response.json(await service.load(owner, id!), { headers: { 'Cache-Control': 'no-store' } });
      const raw = await request.text();
      if (raw.length > 8192) return Response.json({ message: 'Request too large.' }, { status: 400 });
      if (!id) {
        const body = createSchema.parse(JSON.parse(raw));
        return Response.json(await service.create(owner, body.draftId), { status: 201 });
      }
      const body = updateSchema.parse(JSON.parse(raw));
      const release = body.command.type === 'request_recommendations' ? budget.acquire() : () => {};
      if (!release) return Response.json({ message: 'Recommendations are busy. Try again shortly.' }, { status: 429 });
      try {
        return Response.json(await service.command(owner, id, body.baseRevision, body.command, AbortSignal.any([request.signal, AbortSignal.timeout(30_000)])), { headers: { 'Cache-Control': 'no-store' } });
      } finally { release(); }
    } catch (error) {
      if (error instanceof DraftNotFound) return Response.json({ message: 'Draft not found.' }, { status: 404 });
      if (error instanceof DraftConflict) return Response.json({ message: error.message, current: error.current }, { status: 409 });
      if (error instanceof z.ZodError || error instanceof SyntaxError || (error instanceof Error && ['Intent is not ready', 'Starting point is not available', 'Operation is still running'].includes(error.message))) return Response.json({ message: 'Invalid draft command.' }, { status: 400 });
      return Response.json({ message: 'Draft storage is unavailable. Try again.' }, { status: 503 });
    }
  }
  return handle;
}
