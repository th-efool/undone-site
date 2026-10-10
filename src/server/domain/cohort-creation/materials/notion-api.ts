import 'server-only';
import { notionIdSchema, NOTION_API_VERSION } from '@/src/shared/cohort-creation/notion';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import type { NotionPageProvider } from './notion';

/** Matches installed Corsair endpoint/version contracts, with bounded reads and no SDK content-cache side effects. */
export class NotionApi implements NotionPageProvider {
  private lastRequest = 0;
  constructor(private readonly token: string, private readonly request: typeof fetch = fetch) {
    if (!token || token.length > 4096 || /[\u0000-\u0020\u007f]/.test(token)) throw new CreationStorageError('UNAVAILABLE', 'Reconnect your Notion account.');
  }
  private async json(path: string, callerSignal: AbortSignal, cursor?: string | null) {
    const signal = AbortSignal.any([callerSignal, AbortSignal.timeout(30_000)]); signal.throwIfAborted();
    // Conservative standard-plan pacing; shared workspace/connection traffic can still return 429.
    const pause = Math.max(0, 350 - (Date.now() - this.lastRequest));
    if (pause) await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, pause);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
    signal.throwIfAborted(); this.lastRequest = Date.now();
    const url = new URL(`https://api.notion.com/v1/${path}`);
    if (cursor !== undefined) {
      url.searchParams.set('page_size', '100');
      if (cursor) {
        if (cursor.length > 1024 || /[\u0000-\u001f\u007f]/.test(cursor)) throw new CreationStorageError('INVALID_INPUT', 'Invalid Notion page cursor.');
        url.searchParams.set('start_cursor', cursor);
      }
    }
    let response: Response;
    try {
      response = await this.request(url, { headers: { Authorization: `Bearer ${this.token}`, 'Notion-Version': NOTION_API_VERSION,
        Accept: 'application/json' }, redirect: 'error', credentials: 'omit', cache: 'no-store', signal });
    } catch { signal.throwIfAborted(); throw new CreationStorageError('UNAVAILABLE', 'Notion could not be reached. Retry the selected page.'); }
    try {
      if (!response.ok) throw new CreationStorageError(response.status === 429 || response.status >= 500 ? 'UNAVAILABLE' : 'INVALID_INPUT',
        response.status === 429 ? 'Notion request limit reached. Retry later.' : 'Notion page is unavailable. Check your connection and shared page access.');
      if (!response.headers.get('content-type')?.toLowerCase().includes('json') || !response.body) throw new CreationStorageError('INVALID_INPUT', 'Notion returned an unsupported response.');
      const maxBytes = 4 * 1024 * 1024; const length = response.headers.get('content-length');
      if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new CreationStorageError('LIMIT_EXCEEDED', 'Notion response exceeds 4 MiB. Select a smaller page; nothing was truncated.');
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
      const abort = () => { void reader.cancel().catch(() => undefined); }; signal.addEventListener('abort', abort, { once: true });
      try {
        for (;;) {
          signal.throwIfAborted(); const part = await reader.read(); signal.throwIfAborted(); if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > maxBytes) throw new CreationStorageError('LIMIT_EXCEEDED', 'Notion response exceeds 4 MiB. Select a smaller page; nothing was truncated.');
          chunks.push(part.value);
        }
        if (length && bytes !== Number(length)) throw new CreationStorageError('INVALID_INPUT', 'Notion returned an incomplete response. Retry the page.');
        try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) as unknown; }
        catch { throw new CreationStorageError('INVALID_INPUT', 'Notion returned malformed JSON.'); }
      } finally { signal.removeEventListener('abort', abort); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    } finally { if (response.body && !response.body.locked) await response.body.cancel().catch(() => undefined); }
  }
  getPage(pageId: string, signal: AbortSignal) { return this.json(`pages/${notionIdSchema.parse(pageId)}`, signal); }
  getChildren(blockId: string, cursor: string | null, signal: AbortSignal) { return this.json(`blocks/${notionIdSchema.parse(blockId)}/children`, signal, cursor); }
}
