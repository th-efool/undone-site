import { apiUrl } from '@/src/shared/api/apiUrl';
import { creationStreamFrameSchema, type CreationEventEnvelope } from '@/src/shared/cohort-creation/durable';

const MAX_FRAME_BYTES = 1024 * 1024;
type StreamOptions = {
  draftId: string;
  after: number;
  signal: AbortSignal;
  onEvent: (event: CreationEventEnvelope) => void;
};

export class DraftEventStreamError extends Error {
  constructor(readonly kind: 'http' | 'protocol' | 'gap', message: string, readonly status?: number) {
    super(message);
    this.name = 'DraftEventStreamError';
  }
}

/** Read an observer connection. Neither EOF nor abort cancels durable work. */
export async function readDraftEventStream(response: Response, options: StreamOptions): Promise<number> {
  options.signal.throwIfAborted();
  if (!response.ok) throw new DraftEventStreamError('http', 'Draft observation is unavailable.', response.status);
  if (!response.body || !response.headers.get('content-type')?.toLowerCase().includes('application/x-ndjson')) {
    throw new DraftEventStreamError('protocol', 'Expected a draft event stream.');
  }
  let cursor = options.after;
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new DraftEventStreamError('protocol', 'Invalid replay cursor.');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const encoder = new TextEncoder();
  const reader = response.body.getReader();
  let buffer = '';
  const cancel = () => { void reader.cancel().catch(() => {}); };
  options.signal.addEventListener('abort', cancel, { once: true });
  const acceptLine = (line: string) => {
    options.signal.throwIfAborted();
    if (encoder.encode(line).byteLength > MAX_FRAME_BYTES) throw new DraftEventStreamError('protocol', 'Draft event exceeds the frame limit.');
    if (!line.trim()) return;
    let frame;
    try { frame = creationStreamFrameSchema.parse(JSON.parse(line)); }
    catch { throw new DraftEventStreamError('protocol', 'Invalid draft event.'); }
    if (frame.kind === 'heartbeat') return;
    if (frame.draftId !== options.draftId || frame.snapshot.draftId !== options.draftId ||
      frame.inputRevision !== frame.snapshot.inputRevision || (frame.job && frame.job.id !== frame.jobId)) {
      throw new DraftEventStreamError('protocol', 'Draft event identity mismatch.');
    }
    // Explicit snapshots bridge retained-history gaps and repair an invalid future cursor.
    // UI snapshot revisions have their own monotonic guard; ordinary events never rewind.
    if (frame.kind !== 'snapshot' && frame.sequence <= cursor) return;
    if (frame.kind !== 'snapshot' && frame.sequence !== cursor + 1) throw new DraftEventStreamError('gap', 'Draft event replay has a gap.');
    options.onEvent(frame);
    cursor = frame.sequence;
  };
  const drain = () => {
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      acceptLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
    }
    if (encoder.encode(buffer).byteLength > MAX_FRAME_BYTES) throw new DraftEventStreamError('protocol', 'Draft event exceeds the frame limit.');
  };
  try {
    while (true) {
      options.signal.throwIfAborted();
      const { value, done } = await reader.read();
      options.signal.throwIfAborted();
      try { buffer += done ? decoder.decode() : decoder.decode(value, { stream: true }); }
      catch { throw new DraftEventStreamError('protocol', 'Invalid event text encoding.'); }
      drain();
      if (done) break;
    }
    if (buffer) acceptLine(buffer);
    return cursor;
  } finally {
    options.signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

type ObserverOptions = Omit<StreamOptions, 'after'> & {
  after?: number;
  /** Reload canonical state on transport/gap failure; return its coherent cursor if available. */
  reload: () => Promise<number | void>;
  onConnectionChange?: (state: 'connecting' | 'connected' | 'reconnecting') => void;
};

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(); return; }
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}

/** Reconnect NDJSON and fall back to canonical reloads; performs no mutation requests. */
export async function observeDraftEvents(options: ObserverOptions): Promise<void> {
  let cursor = options.after ?? 0;
  let failures = 0;
  while (!options.signal.aborted) {
    options.onConnectionChange?.(failures ? 'reconnecting' : 'connecting');
    // The server closes healthy connections after 25s; a stuck proxy must also recover.
    const deadline = new AbortController();
    const deadlineTimer = setTimeout(() => deadline.abort(new DOMException('Observation timed out.', 'TimeoutError')), 35_000);
    const signal = AbortSignal.any([options.signal, deadline.signal]);
    try {
      const response = await fetch(apiUrl(`/api/cohort-creation/drafts/${encodeURIComponent(options.draftId)}/events?after=${cursor}`), {
        credentials: 'include', cache: 'no-store', signal,
        headers: { Accept: 'application/x-ndjson' },
      });
      await readDraftEventStream(response, {
        ...options, after: cursor, signal,
        onEvent: event => {
          // Advance while reading, so a disconnected response resumes after delivered events.
          options.onEvent(event);
          cursor = event.sequence;
          failures = 0;
          options.onConnectionChange?.('connected');
        },
      });
      failures = 0;
    } catch {
      if (options.signal.aborted) break;
      failures++;
      options.onConnectionChange?.('reconnecting');
      try {
        const recovered = await options.reload();
        if (options.signal.aborted) break;
        // Without a coherent reload cursor, request an explicit snapshot baseline next time.
        cursor = typeof recovered === 'number' && Number.isSafeInteger(recovered) && recovered >= 0 ? recovered : 0;
      } catch { /* Keep the last accepted cursor; the next connection/reload retries. */ }
    } finally {
      clearTimeout(deadlineTimer);
    }
    await pause(failures ? Math.min(15_000, 1000 * 2 ** Math.min(failures, 4)) : 1000, options.signal);
  }
}
