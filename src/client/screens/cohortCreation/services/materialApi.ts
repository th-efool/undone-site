import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { retainedObjectRefSchema } from '@/src/shared/cohort-creation/materials';
import { creationJson, creationErrorMessage, CreationTransportError } from './creationTransport';
import { DraftApiError } from './draftApi';

export const materialApi = {
  async upload(draftId: string, bytes: Blob, revision: number, filename: string, signal?: AbortSignal, materialId?: string) {
    let result;
    try { result = await creationJson(`/api/cohort-creation/drafts/${draftId}/uploads`, {
      method: 'POST', credentials: 'include', cache: 'no-store', signal, body: bytes,
      headers: { 'Content-Type': bytes.type, 'X-Creation-Revision': String(revision), 'X-Creation-Filename': encodeURIComponent(filename),
        ...(materialId ? { 'X-Creation-Material': materialId } : {}) },
    }); } catch (error) {
      if (error instanceof CreationTransportError) throw new DraftApiError(error.message, error.status, undefined, error.retryAfterSeconds);
      throw error;
    }
    const { response, body, retryAfterSeconds } = result;
    if (!response.ok) {
      const current = creationSnapshotSchema.safeParse(body && typeof body === 'object' && 'current' in body ? body.current : undefined);
      throw new DraftApiError(creationErrorMessage(body, 'Upload failed. Retry your material.'), response.status,
        current.success ? current.data : undefined, retryAfterSeconds);
    }
    return retainedObjectRefSchema.parse(body);
  },
};
