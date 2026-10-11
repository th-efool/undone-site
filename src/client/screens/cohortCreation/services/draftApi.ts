import { creationSnapshotSchema, type CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import type { CreationCommand } from '@/src/shared/cohort-creation/flow';
import { creationJson, creationErrorMessage, CreationTransportError } from './creationTransport';

export class DraftApiError extends Error {
  constructor(message: string, readonly status: number, readonly current?: CreationSnapshot, readonly retryAfterSeconds?: number) { super(message); }
}
async function request(path: string, init?: RequestInit): Promise<CreationSnapshot> {
  let result;
  try { result = await creationJson(path, { ...init, headers: { 'Content-Type': 'application/json' } }); }
  catch (error) {
    if (error instanceof CreationTransportError) throw new DraftApiError(error.message, error.status, undefined, error.retryAfterSeconds);
    throw error;
  }
  const { response, body, retryAfterSeconds } = result;
  if (!response.ok) {
    const current = creationSnapshotSchema.safeParse(body && typeof body === 'object' && 'current' in body ? body.current : undefined);
    const message = response.status === 409 ? 'Draft changed in another request. Your edit was not saved; review the current draft before retrying.' : creationErrorMessage(body, 'Draft could not be saved or loaded. Try again.');
    throw new DraftApiError(`${message}${retryAfterSeconds === undefined ? '' : ` Try again in ${retryAfterSeconds} seconds.`}`, response.status, current.success ? current.data : undefined, retryAfterSeconds);
  }
  return creationSnapshotSchema.parse(body);
}
export const draftApi = {
  create: (draftId: string) => request('/api/cohort-creation/drafts', { method: 'POST', body: JSON.stringify({ draftId }) }),
  load: (draftId: string, signal?: AbortSignal) => request(`/api/cohort-creation/drafts/${draftId}`, { signal }),
  command: (draftId: string, baseRevision: number, command: CreationCommand, signal?: AbortSignal) => request(`/api/cohort-creation/drafts/${draftId}`, { method: 'PATCH', body: JSON.stringify({ baseRevision, command }), signal }),
};
