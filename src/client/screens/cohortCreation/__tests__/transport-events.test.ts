import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import type { CreationEventEnvelope } from '@/src/shared/cohort-creation/durable';
import { DraftEventStreamError, observeDraftEvents, readDraftEventStream } from '../services/draftEvents';

const encoder = new TextEncoder();
function event(sequence: number, kind: CreationEventEnvelope['kind'] = 'job_started'): CreationEventEnvelope {
  return {
    schemaVersion: 1, draftId, jobId: null, inputRevision: 0, sequence, kind,
    snapshot: { ...initialSnapshot(draftId), revision: sequence, query: 'Learn 日本語 🎨' },
    job: null, createdAt: '2026-10-08T00:00:00.000Z',
  };
}
function stream(parts: Uint8Array[], cancel = vi.fn()): Response {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) { parts.forEach(part => controller.enqueue(part)); controller.close(); }, cancel,
  }), { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' } });
}
function options(after = 0) {
  return { draftId, after, signal: new AbortController().signal, onEvent: vi.fn() };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('draft NDJSON transport', () => {
  it('handles every-byte UTF-8 splits, CRLF, multiple lines and a final line without newline', async () => {
    const input = options();
    const bytes = encoder.encode(`${JSON.stringify(event(0, 'snapshot'))}\r\n\r\n${JSON.stringify({ kind: 'heartbeat', cursor: 0 })}\n${JSON.stringify(event(1))}`);
    const response = stream(Array.from(bytes, byte => new Uint8Array([byte])));
    expect(await readDraftEventStream(response, input)).toBe(1);
    expect(input.onEvent.mock.calls.map(([value]) => value.sequence)).toEqual([0, 1]);
    expect(input.onEvent.mock.calls[1][0].snapshot.query).toBe('Learn 日本語 🎨');
  });

  it('allows explicit snapshot reset gaps and ignores duplicate or older normal events', async () => {
    const input = options(3);
    const frames = [event(3), event(2), event(20, 'snapshot'), event(20), event(21)];
    expect(await readDraftEventStream(stream([encoder.encode(frames.map(value => JSON.stringify(value)).join('\n'))]), input)).toBe(21);
    expect(input.onEvent.mock.calls.map(([value]) => value.sequence)).toEqual([20, 21]);
  });

  it('does not treat ordinary gaps as snapshots or advance its cursor from heartbeats', async () => {
    const input = options(3);
    const frames = [{ kind: 'heartbeat', cursor: 8 }, event(9)];
    await expect(readDraftEventStream(stream([encoder.encode(frames.map(value => JSON.stringify(value)).join('\n'))]), input)).rejects.toMatchObject({ kind: 'gap' });
    expect(input.onEvent).not.toHaveBeenCalled();
  });

  it('accepts the server snapshot reset for an invalid future replay cursor', async () => {
    const input = options(500);
    const frames = [event(20, 'snapshot'), event(21)];
    expect(await readDraftEventStream(stream([encoder.encode(frames.map(value => JSON.stringify(value)).join('\n'))]), input)).toBe(21);
    expect(input.onEvent.mock.calls.map(([value]) => value.sequence)).toEqual([20, 21]);
  });

  it.each([
    { ...event(1), draftId: '00000000-0000-4000-8000-000000000099' },
    { ...event(1), snapshot: initialSnapshot('00000000-0000-4000-8000-000000000099') },
    { ...event(1), inputRevision: 2 },
    { ...event(1), sequence: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects unrelated or inconsistent envelope before delivering it', async invalid => {
    const input = options();
    await expect(readDraftEventStream(stream([encoder.encode(JSON.stringify(invalid))]), input)).rejects.toBeInstanceOf(DraftEventStreamError);
    expect(input.onEvent).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON, invalid UTF-8 and a frame exceeding one MiB', async () => {
    for (const bytes of [encoder.encode('{broken}\n'), new Uint8Array([0xff]), encoder.encode(' '.repeat(1024 * 1024 + 1))]) {
      await expect(readDraftEventStream(stream([bytes]), options())).rejects.toMatchObject({ kind: 'protocol' });
    }
  });

  it('rejects HTTP and non-NDJSON responses', async () => {
    await expect(readDraftEventStream(new Response('', { status: 401 }), options())).rejects.toMatchObject({ kind: 'http', status: 401 });
    await expect(readDraftEventStream(Response.json({}), options())).rejects.toMatchObject({ kind: 'protocol' });
  });

  it('aborting a blocked read cancels only its reader and releases the lock', async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const promise = readDraftEventStream(new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } }), { ...options(), signal: controller.signal });
    const rejected = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });
});

describe('draft event observation recovery', () => {
  it('reconnects healthy finite streams without falling back or inventing a sequence gap', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetcher = vi.fn().mockResolvedValueOnce(stream([encoder.encode(JSON.stringify(event(3, 'snapshot')))])).mockResolvedValueOnce(stream([encoder.encode(JSON.stringify(event(4)))]));
    vi.stubGlobal('fetch', fetcher);
    const reload = vi.fn();
    const observed = observeDraftEvents({ draftId, signal: controller.signal, reload, onEvent: value => { if (value.sequence === 4) controller.abort(); } });
    await vi.advanceTimersByTimeAsync(1100);
    await observed;
    expect(fetcher.mock.calls[1][0]).toContain('after=3');
    expect(reload).not.toHaveBeenCalled();
  });

  it('times out a stalled observation and reloads without canceling durable work', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/x-ndjson' } })));
    const reload = vi.fn(async () => { controller.abort(); });
    const observed = observeDraftEvents({ draftId, signal: controller.signal, reload, onEvent: vi.fn() });
    await vi.advanceTimersByTimeAsync(35_100);
    await observed;
    expect(cancel).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reconnects from the last delivered event after a transport interruption', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let reads = 0;
    const interrupted = new Response(new ReadableStream<Uint8Array>({
      pull(streamController) {
        if (reads++ === 0) streamController.enqueue(encoder.encode(`${JSON.stringify(event(5, 'snapshot'))}\n`));
        else streamController.error(new Error('connection lost'));
      },
    }), { headers: { 'Content-Type': 'application/x-ndjson' } });
    const fetcher = vi.fn().mockResolvedValueOnce(interrupted).mockResolvedValueOnce(stream([encoder.encode(JSON.stringify(event(6)))]));
    vi.stubGlobal('fetch', fetcher);
    const reload = vi.fn().mockRejectedValue(new Error('offline'));
    const onEvent = vi.fn((value: CreationEventEnvelope) => { if (value.sequence === 6) controller.abort(); });
    const observed = observeDraftEvents({ draftId, signal: controller.signal, onEvent, reload });
    await vi.advanceTimersByTimeAsync(2100);
    await observed;
    expect(reload).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[1][0]).toContain('after=5');
    expect(onEvent.mock.calls.map(([value]) => value.sequence)).toEqual([5, 6]);
    expect(fetcher.mock.calls.every(([, init]) => !init.method || init.method === 'GET')).toBe(true);
  });

  it('reloads canonical state on a gap and requests a reset if no coherent cursor is supplied', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetcher = vi.fn().mockResolvedValueOnce(stream([encoder.encode(JSON.stringify(event(8)))])).mockResolvedValueOnce(stream([encoder.encode(JSON.stringify(event(20, 'snapshot')))]));
    vi.stubGlobal('fetch', fetcher);
    const reload = vi.fn().mockResolvedValue(undefined);
    const observed = observeDraftEvents({ draftId, after: 3, signal: controller.signal, reload, onEvent: () => controller.abort() });
    await vi.advanceTimersByTimeAsync(2100);
    await observed;
    expect(reload).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[1][0]).toContain('after=0');
  });

  it('polls canonical state when streaming fails and stops without reload on unmount abort', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetcher = vi.fn().mockRejectedValue(new Error('stream unavailable'));
    vi.stubGlobal('fetch', fetcher);
    const reload = vi.fn().mockResolvedValue(12);
    const observed = observeDraftEvents({ draftId, signal: controller.signal, reload, onEvent: vi.fn() });
    await vi.advanceTimersByTimeAsync(2100);
    expect(fetcher.mock.calls[1][0]).toContain('after=12');
    expect(reload).toHaveBeenCalledTimes(2);
    controller.abort();
    await observed;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
