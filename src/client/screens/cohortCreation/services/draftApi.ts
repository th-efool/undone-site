import { apiUrl } from '@/src/shared/api/apiUrl';
import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import type { CreationCommand } from '@/src/shared/cohort-creation/flow';
import { creationSignInUrl } from '@/src/shared/auth/returnTo';

export class DraftApiError extends Error {
  constructor(message: string, readonly status: number, readonly current?: CreationSnapshot) { super(message); }
}
async function request(path: string, init?: RequestInit): Promise<CreationSnapshot> {
  const response = await fetch(apiUrl(path), { ...init, credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' } });
  if (response.status === 401) {
    window.location.assign(creationSignInUrl(window.location.pathname + window.location.search));
    throw new DraftApiError('Sign in to resume your draft.', 401);
  }
  const body = await response.json();
  if (!response.ok) {
    const current = creationSnapshotSchema.safeParse(body.current);
    throw new DraftApiError(response.status === 409 ? 'Draft changed in another request. Your edit was not saved; review the current draft before retrying.' : 'Draft could not be saved or loaded. Try again.', response.status, current.success ? current.data : undefined);
  }
  return creationSnapshotSchema.parse(body);
}
export const draftApi = {
  create: (draftId: string) => request('/api/cohort-creation/drafts', { method: 'POST', body: JSON.stringify({ draftId }) }),
  load: (draftId: string) => request(`/api/cohort-creation/drafts/${draftId}`),
  command: (draftId: string, baseRevision: number, command: CreationCommand, signal?: AbortSignal) => request(`/api/cohort-creation/drafts/${draftId}`, { method: 'PATCH', body: JSON.stringify({ baseRevision, command }), signal }),
};
