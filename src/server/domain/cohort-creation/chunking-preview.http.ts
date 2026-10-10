import { z } from 'zod';
import { chunkingPreviewSchema } from '@/src/shared/cohort-creation/chunking';
import type { ChunkingContentService } from './chunking-content.service';
import type { DraftService } from './draft.service';
import { DraftNotFound } from './draft.service';

export function chunkingPreviewHandler(service: Pick<DraftService, 'load'>, getOwner: () => Promise<string | null>, read: ChunkingContentService['preview']) {
  return async (request: Request, draftId: string) => {
    const headers = { 'Cache-Control': 'no-store' };
    try {
      const ownerId = await getOwner();
      if (!ownerId) return Response.json({ message: 'Sign in to read your chunks.' }, { status: 401, headers });
      if (!z.uuid().safeParse(draftId).success) return Response.json({ message: 'Draft not found.' }, { status: 404, headers });
      const state = await service.load(ownerId, draftId);
      if (!state.processing?.chunking?.checkpoint) return Response.json({ message: 'Chunk inventory is not ready.' }, { status: 409, headers });
      const chunks = await read({ ownerId, draftId }, state, request.signal);
      const current = await service.load(ownerId, draftId);
      if (current.revision !== state.revision) return Response.json({ message: 'Draft changed. Reload chunks.' }, { status: 409, headers });
      return Response.json(chunkingPreviewSchema.parse({ revision: state.revision, chunks }), { headers });
    } catch (error) {
      if (error instanceof DraftNotFound) return Response.json({ message: 'Draft not found.' }, { status: 404, headers });
      return Response.json({ message: 'Saved chunks could not be loaded. Retry.' }, { status: 503, headers });
    }
  };
}
