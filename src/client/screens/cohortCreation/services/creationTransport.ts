import { apiUrl } from '@/src/shared/api/apiUrl';
import { creationSignInUrl } from '@/src/shared/auth/returnTo';

export const CREATION_REQUEST_TIMEOUT_MS = 30_000;
export class CreationTransportError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterSeconds?: number) { super(message); }
}

/** Bounds the complete HTTP exchange, including reading JSON. Never retries mutations. */
export async function creationJson(path: string, init: RequestInit = {}) {
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new DOMException('Request timed out.', 'TimeoutError')), CREATION_REQUEST_TIMEOUT_MS);
  const signal = init.signal ? AbortSignal.any([init.signal, deadline.signal]) : deadline.signal;
  try {
    const response = await fetch(apiUrl(path), { ...init, credentials: 'include', cache: 'no-store', signal });
    if (response.status === 401) {
      if (typeof window !== 'undefined') window.location.assign(creationSignInUrl(window.location.pathname + window.location.search));
      throw new CreationTransportError('Sign in to resume your draft.', 401);
    }
    let body: unknown;
    try { body = await response.json(); }
    catch {
      signal.throwIfAborted();
      if (response.ok) throw new CreationTransportError('The server returned an unreadable response. Reload your saved draft.', 502);
      body = null;
    }
    const retry = response.headers.get('Retry-After');
    const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : retry ? Math.ceil((Date.parse(retry) - Date.now()) / 1000) : NaN;
    return { response, body, retryAfterSeconds: Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined };
  } catch (error) {
    if (init.signal?.aborted) throw init.signal.reason;
    if (deadline.signal.aborted) throw new CreationTransportError('The request took too long. Your work may already be saved; reload the draft before retrying.', 408);
    if (error instanceof CreationTransportError) throw error;
    throw new CreationTransportError('Connection interrupted. Reload your saved draft before retrying.', 0);
  } finally { clearTimeout(timer); }
}

export function creationErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' && body.message.length <= 2000) return body.message;
  return fallback;
}
