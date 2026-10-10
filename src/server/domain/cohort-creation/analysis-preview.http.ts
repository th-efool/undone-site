import { z } from 'zod';
import { analysisPreviewSchema } from '@/src/shared/cohort-creation/analysis-preview';
import type { AnalysisContentService } from './analysis-content.service';
import type { DraftService } from './draft.service';
import { DraftNotFound } from './draft.service';

export function analysisPreviewHandler(service: Pick<DraftService, 'load'>, getOwner: () => Promise<string | null>, read: AnalysisContentService['preview']) {
  return async (request: Request, draftId: string) => {
    const headers = { 'Cache-Control': 'no-store' };
    try {
      const ownerId = await getOwner();
      if (!ownerId) return Response.json({ message: 'Sign in to read your analysis.' }, { status: 401, headers });
      if (!z.uuid().safeParse(draftId).success) return Response.json({ message: 'Draft not found.' }, { status: 404, headers });
      const state = await service.load(ownerId, draftId);
      if (!state.processing?.analysis?.checkpoint) return Response.json({ message: 'Analysis inventory is not ready.' }, { status: 409, headers });
      const preview = await read({ ownerId, draftId }, state, request.signal);
      const current = await service.load(ownerId, draftId);
      if (current.revision !== state.revision) return Response.json({ message: 'Draft changed. Reload analysis.' }, { status: 409, headers });
      return Response.json(analysisPreviewSchema.parse({ revision: state.revision, ...preview }), { headers });
    } catch (error) {
      if (error instanceof DraftNotFound) return Response.json({ message: 'Draft not found.' }, { status: 404, headers });
      return Response.json({ message: 'Saved analysis could not be loaded. Retry.' }, { status: 503, headers });
    }
  };
}
