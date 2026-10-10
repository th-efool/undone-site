import { z } from 'zod';
import { creationCommandSchema } from '@/src/shared/cohort-creation/flow';
import { DraftConflict, DraftNotFound, type DraftService } from './draft.service';
import { JobBudgetExceeded } from './durable-job';
import { CreationFailure } from './errors';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';

const idSchema = z.uuid();
const createSchema = z.strictObject({ draftId: idSchema });
const updateSchema = z.strictObject({ baseRevision: z.number().int().nonnegative(), command: creationCommandSchema });
const commandGuardMessages = new Set([
  'Intent is not ready', 'Starting point is not available', 'Operation is still running',
  'Save a video selection before observing it',
  'The draft already has 100 selected units. Remove a source before adding GitHub files.',
  'The draft already has 100 selected units. Remove a source before adding a Notion page.',
]);
export function draftHandlers(service: DraftService, getOwner: () => Promise<string | null>) {
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
      // This request enqueues work. Its disconnect signal never cancels the job.
      return Response.json(await service.command(owner, id, body.baseRevision, body.command), { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof DraftNotFound) return Response.json({ message: 'Draft not found.' }, { status: 404 });
      if (error instanceof CreationStorageError && error.code === 'INVALID_INPUT') return Response.json({ message: error.message }, { status: 400 });
      if (error instanceof JobBudgetExceeded) return Response.json({ message: error.message }, { status: 429, headers: { 'Retry-After': '60' } });
      if (error instanceof CreationFailure) return Response.json({ message: error.detail.message }, { status: error.detail.code === 'INVALID_REQUEST' ? 400 : 503 });
      if (error instanceof DraftConflict) return Response.json({ message: error.message, current: error.current }, { status: 409 });
      if (error instanceof Error && commandGuardMessages.has(error.message)) return Response.json({ message: error.message }, { status: 400 });
      if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ message: 'Invalid draft command.' }, { status: 400 });
      return Response.json({ message: 'Draft storage is unavailable. Try again.' }, { status: 503 });
    }
  }
  return handle;
}
