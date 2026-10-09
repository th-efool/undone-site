import { z } from 'zod';
import type { CreationEventRepository } from './durable-job';

export function creationEventsHandler(repo: CreationEventRepository, getOwner: () => Promise<string | null>,
  options = { durationMs: 25_000, intervalMs: 2000 }) {
  return async (request: Request, draftId: string): Promise<Response> => {
    const owner = await getOwner();
    if (!owner) return Response.json({ message: 'Sign in to observe drafts.' }, { status: 401 });
    if (!z.uuid().safeParse(draftId).success) return Response.json({ message: 'Draft not found.' }, { status: 404 });
    const value = new URL(request.url).searchParams.get('after') ?? '0';
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) return Response.json({ message: 'Invalid event cursor.' }, { status: 400 });
    let cursor = Number(value);
    let first;
    try { first = await repo.read(owner, draftId, cursor); }
    catch { return Response.json({ message: 'Event storage unavailable.' }, { status: 503 }); }
    if (!first) return Response.json({ message: 'Draft not found.' }, { status: 404 });
    const observation = new AbortController();
    const signal = AbortSignal.any([request.signal, observation.signal]);
    const firstPage = first;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (data: unknown) => { if (!signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(data) + '\n')); };
        const until = Date.now() + options.durationMs;
        try {
          let page = firstPage;
          while (!signal.aborted) {
            if (page.reset || cursor === 0) {
              const job = page.jobs[0] ?? null;
              send({ schemaVersion: 1, draftId, jobId: job?.id ?? null, inputRevision: page.snapshot.inputRevision,
                sequence: page.cursor, kind: 'snapshot', snapshot: page.snapshot, job, createdAt: new Date().toISOString() });
              cursor = page.cursor;
            } else {
              for (const event of page.events) { send(event); cursor = event.sequence; }
            }
            send({ kind: 'heartbeat', cursor });
            if (Date.now() >= until) break;
            // Drain a bounded replay page immediately, rather than losing its tail.
            if (cursor >= page.cursor) await new Promise<void>(resolve => {
              const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
              const timer = setTimeout(done, options.intervalMs);
              signal.addEventListener('abort', done, { once: true });
              if (signal.aborted) done();
            });
            if (signal.aborted) break;
            const next = await repo.read(owner, draftId, cursor);
            if (!next) break;
            page = next;
          }
          if (!observation.signal.aborted) controller.close();
        } catch {
          if (!signal.aborted) controller.error(new Error('Event stream interrupted. Reload the draft.'));
        }
      },
      cancel() { observation.abort(); },
    });
    return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } });
  };
}
