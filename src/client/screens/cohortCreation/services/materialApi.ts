import { apiUrl } from '@/src/shared/api/apiUrl';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { retainedObjectRefSchema } from '@/src/shared/cohort-creation/materials';
import { creationSignInUrl } from '@/src/shared/auth/returnTo';
import { DraftApiError } from './draftApi';

export const materialApi = {
  async upload(draftId: string, bytes: Blob, revision: number, filename: string, signal?: AbortSignal) {
    const response = await fetch(apiUrl(`/api/cohort-creation/drafts/${draftId}/uploads`), {
      method: 'POST', credentials: 'include', cache: 'no-store', signal, body: bytes,
      headers: { 'Content-Type': bytes.type, 'X-Creation-Revision': String(revision), 'X-Creation-Filename': encodeURIComponent(filename) },
    });
    if (response.status === 401) {
      window.location.assign(creationSignInUrl(window.location.pathname + window.location.search));
      throw new DraftApiError('Sign in to resume your draft.', 401);
    }
    const body = await response.json();
    if (!response.ok) {
      const current = creationSnapshotSchema.safeParse(body.current);
      throw new DraftApiError(typeof body.message === 'string' ? body.message : 'Upload failed. Retry your material.', response.status,
        current.success ? current.data : undefined);
    }
    return retainedObjectRefSchema.parse(body);
  },
};
