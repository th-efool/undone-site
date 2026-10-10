import { z } from 'zod';
import { connectorCommandSchema } from '@/src/shared/cohort-creation/connectors';
import { DraftNotFound } from './draft.service';
import type { CreationConnectorService } from './connectors.service';
export const CONNECTION_RETURN_COOKIE = 'creation_connection_return';

async function readCommand(request: Request) {
  if (!request.body) throw new SyntaxError('Missing command');
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    for (;;) {
      signal.throwIfAborted();
      const part = await reader.read();
      signal.throwIfAborted();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 512) throw new SyntaxError('Command too large');
      parts.push(part.value);
    }
    return connectorCommandSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(parts))));
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
export function creationConnectorHandler(service: CreationConnectorService, getOwner: () => Promise<string | null>, origin: () => string) {
  return async (request: Request, draftId: string): Promise<Response> => {
    try {
      const owner = await getOwner();
      if (!owner) return Response.json({ message: 'Sign in to manage connections.' }, { status: 401 });
      if (!z.uuid().safeParse(draftId).success) return Response.json({ message: 'Draft not found.' }, { status: 404 });
      if (!['GET', 'POST', 'DELETE'].includes(request.method)) return new Response(null, { status: 405 });
      if (request.method === 'GET') return Response.json(await service.status(owner, draftId), { headers: { 'Cache-Control': 'no-store' } });
      if (request.headers.get('Origin') !== origin() || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
        return Response.json({ message: 'Connection request origin is not allowed.' }, { status: 403 });
      }
      if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return new Response(null, { status: 415 });
      const { plugin } = await readCommand(request);
      const result = request.method === 'POST' ? await service.connect(owner, draftId, plugin) : await service.disconnect(owner, draftId, plugin);
      return Response.json(result, { headers: { 'Cache-Control': 'no-store', ...(request.method === 'POST' ? {
        'Set-Cookie': `${CONNECTION_RETURN_COOKIE}=${draftId}; Path=/quest/connections/return; HttpOnly; SameSite=Lax; Max-Age=1800${origin().startsWith('https:') ? '; Secure' : ''}`,
      } : {}) } });
    } catch (error) {
      if (error instanceof DraftNotFound) return Response.json({ message: 'Draft not found.' }, { status: 404 });
      if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ message: 'Invalid connection request.' }, { status: 400 });
      return Response.json({ message: 'Connections are unavailable. Try again.' }, { status: 503 });
    }
  };
}
