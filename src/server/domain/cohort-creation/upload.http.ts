import { z } from 'zod';
import type { DraftService } from './draft.service';
import { DraftNotFound } from './draft.service';
import type { MaterialBlobStore } from '@/src/server/infrastructure/storage/creation.store';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { MATERIAL_LIMITS, retainedObjectRefSchema } from '@/src/shared/cohort-creation/materials';

export function textUploadHandler(drafts: Pick<DraftService, 'load'>, blobs: Pick<MaterialBlobStore, 'putStream'>,
  getOwner: () => Promise<string | null>) {
  return async (request: Request, draftId: string): Promise<Response> => {
    try {
      const ownerId = await getOwner();
      if (!ownerId) return Response.json({ message: 'Sign in to upload material.' }, { status: 401 });
      if (!z.uuid().safeParse(draftId).success) return Response.json({ message: 'Draft not found.' }, { status: 404 });
      const snapshot = await drafts.load(ownerId, draftId);
      const revision = request.headers.get('X-Creation-Revision');
      if (!revision || !/^\d+$/.test(revision) || !Number.isSafeInteger(Number(revision))) return Response.json({ message: 'A draft revision is required.' }, { status: 400 });
      if (Number(revision) !== snapshot.revision) return Response.json({ message: 'Draft changed. Review it before uploading.', current: snapshot }, { status: 409 });
      if (snapshot.stage !== 'starting_point' || snapshot.startingPoint !== 'have_material' || snapshot.status === 'running') {
        return Response.json({ message: 'Choose material input before uploading.' }, { status: 409 });
      }
      if (snapshot.materials.length >= MATERIAL_LIMITS.sources) return Response.json({ message: 'Twenty source limit reached.' }, { status: 413 });
      const mediaType = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
      if (!mediaType || !['text/plain', 'text/markdown', 'text/x-markdown'].includes(mediaType)) {
        return Response.json({ message: 'Upload UTF-8 text or Markdown.' }, { status: 415 });
      }
      const length = request.headers.get('Content-Length');
      if (length && (!/^\d+$/.test(length) || Number(length) < 1)) return Response.json({ message: 'Invalid content length.' }, { status: 400 });
      if (length && Number(length) > MATERIAL_LIMITS.extractedTextBytes) return Response.json({ message: 'Text exceeds 1 MiB. Select a smaller source; nothing was truncated.' }, { status: 413 });
      if (!request.body) return Response.json({ message: 'Upload content is required.' }, { status: 400 });
      const encodedName = request.headers.get('X-Creation-Filename');
      const filename = encodedName ? decodeURIComponent(encodedName) : undefined;
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
      const reader = request.body.getReader();
      async function* content() {
        const cancel = () => { void reader.cancel().catch(() => undefined); };
        signal.addEventListener('abort', cancel, { once: true });
        try {
          while (true) {
            signal.throwIfAborted();
            const chunk = await reader.read();
            if (chunk.done) break;
            yield chunk.value;
          }
          signal.throwIfAborted();
        } finally {
          signal.removeEventListener('abort', cancel);
        }
      }
      try {
        const ref = await blobs.putStream({ ownerId, draftId }, content(), { mediaType, filename,
          maxBytes: length ? Number(length) : MATERIAL_LIMITS.extractedTextBytes, signal });
        signal.throwIfAborted();
        return Response.json(retainedObjectRefSchema.parse(ref), { status: 201, headers: { 'Cache-Control': 'no-store' } });
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof DraftNotFound || error instanceof CreationStorageError && error.code === 'NOT_FOUND') return Response.json({ message: 'Draft not found.' }, { status: 404 });
      if (error instanceof CreationStorageError) return Response.json({ message: error.message }, { status: error.code === 'LIMIT_EXCEEDED' ? 413 : error.code === 'INVALID_INPUT' ? 400 : 503 });
      if (error instanceof URIError) return Response.json({ message: 'Invalid upload filename.' }, { status: 400 });
      if (request.signal.aborted || error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return Response.json({ message: 'Upload interrupted. Retry the file; no source was selected.' }, { status: 408 });
      return Response.json({ message: 'Material storage is unavailable. Retry the upload.' }, { status: 503 });
    }
  };
}
