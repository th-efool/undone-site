import type { createInteractionHandlers, HandlerResult } from './handlers';
import { streamEvents } from './sse';

type Handlers = ReturnType<typeof createInteractionHandlers>;
const MAX_BODY = 256 * 1024;
const HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };

function json(r: HandlerResult): Response { return new Response(JSON.stringify(r.body), { status: r.status, headers: HEADERS }); }
const err = (status: number, code: string) => json({ status, body: { code, message: code, retryable: false } });

/**
 * Explicit route table (no dynamic imports from URL). `segments` = path after /api/interaction/v1.
 *   POST workspaces | GET workspaces/:id | POST workspaces/:id/actions | GET workspaces/:id/events?after=N
 */
export async function dispatchInteraction(request: Request, segments: string[], getOwner: () => Promise<string | null>, h: Handlers): Promise<Response> {
  const owner = await getOwner();
  if (!owner) return err(401, 'UNAUTHORIZED');
  const [root, id, sub] = segments;
  if (root !== 'workspaces') return err(404, 'NOT_FOUND');
  const method = request.method.toUpperCase();

  const readBody = async (): Promise<unknown | Response> => {
    const text = await request.text();
    if (text.length > MAX_BODY) return err(413, 'INVALID_ACTION');
    try { return JSON.parse(text); } catch { return err(400, 'INVALID_ACTION'); }
  };

  if (!id && method === 'POST') {
    const body = await readBody(); if (body instanceof Response) return body;
    return json(await h.createWorkspace(owner, body));
  }
  if (id && !sub && method === 'GET') return json(await h.getWorkspace(owner, id));
  if (id && sub === 'actions' && method === 'POST') {
    const body = await readBody(); if (body instanceof Response) return body;
    // Path workspace id is authoritative; reject mismatching body.
    if ((body as { workspaceId?: string })?.workspaceId !== id) return err(400, 'INVALID_ACTION');
    return json(await h.commitAction(owner, request.headers.get('idempotency-key') ?? undefined, body));
  }
  if (id && sub === 'events' && method === 'GET') {
    const sp = new URL(request.url).searchParams;
    const raw = Number(request.headers.get('last-event-id') ?? sp.get('after') ?? 0);
    const after = Number.isInteger(raw) && raw >= 0 ? raw : 0;
    if (request.headers.get('accept')?.includes('text/event-stream')) return streamEvents(h, owner, id, after, { signal: request.signal });
    return json(await h.getEvents(owner, id, after));
  }
  return err(405, 'NOT_FOUND');
}
