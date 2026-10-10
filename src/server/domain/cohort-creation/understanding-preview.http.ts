import { z } from 'zod';
import { understandingPreviewSchema } from '@/src/shared/cohort-creation/processing';
import type { UnderstandingContentService } from './understanding-content.service';
import type { DraftService } from './draft.service';
import { DraftNotFound } from './draft.service';

export function understandingPreviewHandler(service: Pick<DraftService, 'load'>, getOwner: () => Promise<string | null>,
  read: UnderstandingContentService['preview']) {
  return async (request: Request, draftId: string) => {
    const headers = { 'Cache-Control': 'no-store' };
    try {
      const ownerId = await getOwner();
      if (!ownerId) return Response.json({ message: 'Sign in to read your material.' }, { status: 401, headers });
      if (!z.uuid().safeParse(draftId).success) return Response.json({ message: 'Draft not found.' }, { status: 404, headers });
      const state = await service.load(ownerId, draftId);
      if (!state.processing?.checkpoint) return Response.json({ message: 'Understanding inventory is not ready.' }, { status: 409, headers });
      const partitions = await read({ ownerId, draftId }, state, request.signal);
      const current = await service.load(ownerId, draftId);
      if (current.revision !== state.revision) return Response.json({ message: 'Draft changed. Reload concepts.' }, { status: 409, headers });
      return Response.json(understandingPreviewSchema.parse({ revision: state.revision, partitions }), { headers });
    } catch (error) {
      if (error instanceof DraftNotFound) return Response.json({ message: 'Draft not found.' }, { status: 404, headers });
      return Response.json({ message: 'Saved concepts could not be loaded. Retry.' }, { status: 503, headers });
    }
  };
}
