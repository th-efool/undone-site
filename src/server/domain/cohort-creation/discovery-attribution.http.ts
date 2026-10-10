import { z } from 'zod';
import type { DraftService } from './draft.service';
import { DraftNotFound } from './draft.service';
import type { DiscoveryCheckpoint } from '@/src/shared/cohort-creation/discovery';
import type { StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';

export function discoveryAttributionHandler(drafts: Pick<DraftService, 'load'>, owner: () => Promise<string | null>,
  read: (scope: StorageScope, checkpoint: DiscoveryCheckpoint, signal: AbortSignal) => Promise<string | null>) {
  return async (request: Request, draftId: string) => {
    try {
      const ownerId = await owner(); if (!ownerId) return Response.json({ message: 'Sign in to access drafts.' }, { status: 401 });
      if (!z.uuid().safeParse(draftId).success) return Response.json({ message: 'Draft not found.' }, { status: 404 });
      const state = await drafts.load(ownerId, draftId); const checkpoint = state.discovery?.checkpoint;
      if (!checkpoint) return Response.json({ message: 'Search evidence not found.' }, { status: 404 });
      const requested = new URL(request.url).searchParams.get('search');
      if (requested && requested !== checkpoint.searchArtifact.id) return Response.json({ message: 'Search evidence changed. Reload the draft.' }, { status: 404 });
      const html = await read({ ownerId, draftId }, checkpoint, request.signal);
      return new Response(html ?? '<p>No search attribution was returned.</p>', { headers: {
        'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        // Opaque origin; no scripts/forms/top navigation or access to application cookies/DOM.
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'self'; sandbox allow-popups",
      } });
    } catch (error) {
      return Response.json({ message: error instanceof DraftNotFound ? 'Draft not found.' : 'Search attribution is unavailable.' },
        { status: error instanceof DraftNotFound ? 404 : 503, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}
