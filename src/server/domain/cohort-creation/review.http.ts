import { z } from 'zod';
import type { DraftService } from './draft.service';
import { DraftNotFound } from './draft.service';
import type { BuildingContentService } from './building-content.service';
import { projectReview } from './review.service';
import type { CreationConversationRepository } from '@/src/server/infrastructure/db/postgres/repositories/creationConversation.repo';

export function reviewHandler(service: Pick<DraftService, 'load'>, getOwner: () => Promise<string | null>,
  content: { load: (...args: Parameters<BuildingContentService['load']>) => Promise<Pick<Awaited<ReturnType<BuildingContentService['load']>>, 'curriculum'>> },
  conversation: Pick<CreationConversationRepository, 'list'>) {
  return async (request: Request, draftId: string) => {
    try {
      const ownerId = await getOwner();
      if (!ownerId) return Response.json({ message: 'Sign in to review your draft.' }, { status: 401 });
      if (!z.uuid().safeParse(draftId).success) return Response.json({ message: 'Draft not found.' }, { status: 404 });
      const snapshot = await service.load(ownerId, draftId);
      if (!snapshot.review || snapshot.stage !== 'review') return Response.json({ message: 'Open the ready curriculum for review first.' }, { status: 409 });
      const before = new URL(request.url).searchParams.get('before') ?? undefined;
      if (before && !z.uuid().safeParse(before).success) return Response.json({ message: 'Invalid conversation cursor.' }, { status: 400 });
      const loaded = await content.load({ ownerId, draftId }, snapshot, request.signal);
      const entries = await conversation.list(ownerId, draftId, { before, limit: 30 });
      const current = await service.load(ownerId, draftId);
      if (current.revision !== snapshot.revision) return Response.json({ message: 'Draft changed while loading review. Reload the review.' }, { status: 409 });
      return Response.json({ revision: snapshot.revision, curriculum: projectReview(loaded.curriculum, snapshot.review), review: snapshot.review,
        conversation: { entries, nextBefore: entries.length === 30 ? entries.at(-1)!.id : null } }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof DraftNotFound) return Response.json({ message: 'Draft not found.' }, { status: 404 });
      return Response.json({ message: 'Retained curriculum could not be loaded. Your saved draft remains available.' }, { status: 503 });
    }
  };
}
