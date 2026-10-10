import 'server-only';
import { z } from 'zod';
import { MATERIAL_LIMITS } from '@/src/shared/cohort-creation/materials';
import { youtubeMetadataSchema, youtubeVideoIdSchema, type YoutubeVideoMetadata } from '@/src/shared/cohort-creation/youtube';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { youtubeSourceUrl } from './youtube-url';

const videoResponse = z.object({ items: z.array(z.object({ id: youtubeVideoIdSchema, etag: z.string(),
  snippet: z.object({ title: z.string(), description: z.string(), channelId: z.string(), channelTitle: z.string(),
    publishedAt: z.string(), liveBroadcastContent: z.enum(['none', 'live', 'upcoming']) }),
  contentDetails: z.object({ duration: z.string() }), status: z.object({ privacyStatus: z.string(), uploadStatus: z.string() }),
})).max(50) });
const playlistResponse = z.object({ items: z.array(z.object({ contentDetails: z.object({ videoId: youtubeVideoIdSchema }),
  snippet: z.object({ position: z.number().int().nonnegative() }) })).max(50),
  nextPageToken: z.string().min(1).max(1024).optional(), pageInfo: z.object({ totalResults: z.number().int().nonnegative() }) });
function invalid(message: string): never { throw new CreationStorageError('INVALID_INPUT', message); }
function duration(input: string) {
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(input);
  const value = match ? Number(match[1] ?? 0) * 86400 + Number(match[2] ?? 0) * 3600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0) : NaN;
  if (!Number.isSafeInteger(value) || value <= 0) invalid('Video duration is unavailable. Select a completed public video.');
  return value;
}

/** Metadata is not learning content. Only a separate retained observation/caption may make a source ready. */
export class YoutubeMetadataReader {
  constructor(private readonly apiKey = process.env.YOUTUBE_API_KEY, private readonly request: typeof fetch = fetch) {}
  private async json(path: 'videos' | 'playlistItems', params: Record<string, string>, signal: AbortSignal) {
    if (!this.apiKey?.trim()) throw new CreationStorageError('INVALID_INPUT', 'YouTube metadata is not configured. Supply text material or retry after setup.');
    const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await this.request(url, { headers: { 'X-Goog-Api-Key': this.apiKey, Accept: 'application/json' },
        signal, redirect: 'error', credentials: 'omit', cache: 'no-store' });
    } catch {
      signal.throwIfAborted(); throw new CreationStorageError('UNAVAILABLE', 'YouTube metadata could not be reached. Retry the selected source.');
    }
    try {
      if (!response.ok) throw new CreationStorageError(response.status === 429 || response.status >= 500 ? 'UNAVAILABLE' : 'INVALID_INPUT',
        response.status === 403 ? 'YouTube access or quota is unavailable. Retry after checking the connection or supply text.' : 'YouTube metadata is unavailable for this source.');
      if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/json') || !response.body) invalid('YouTube returned an unsupported metadata response.');
      const length = response.headers.get('content-length');
      if (length && (!/^\d+$/.test(length) || Number(length) > 2 * 1024 * 1024)) throw new CreationStorageError('LIMIT_EXCEEDED', 'YouTube metadata exceeds its 2 MiB response scope.');
      const chunks: Uint8Array[] = []; let size = 0; const reader = response.body.getReader();
      const cancel = () => { void reader.cancel().catch(() => undefined); }; signal.addEventListener('abort', cancel, { once: true });
      try {
        while (true) {
          signal.throwIfAborted(); const chunk = await reader.read(); if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 2 * 1024 * 1024) throw new CreationStorageError('LIMIT_EXCEEDED', 'YouTube metadata exceeds its 2 MiB response scope.');
          chunks.push(chunk.value);
        }
        signal.throwIfAborted();
        try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) as unknown; }
        catch { return invalid('YouTube returned malformed metadata.'); }
      } finally { signal.removeEventListener('abort', cancel); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    } finally { if (response.body && !response.body.locked) await response.body.cancel().catch(() => undefined); }
  }
  async read(url: string, inputSignal?: AbortSignal) {
    const source = youtubeSourceUrl(url);
    const signal = AbortSignal.any([...(inputSignal ? [inputSignal] : []), AbortSignal.timeout(30_000)]);
    signal.throwIfAborted(); let ids: string[];
    if (source.kind === 'youtube_video') ids = [source.videoId];
    else {
      ids = []; let token: string | undefined; const tokens = new Set<string>();
      do {
        const parsed = playlistResponse.safeParse(await this.json('playlistItems', { part: 'contentDetails,snippet', playlistId: source.playlistId, maxResults: '50', ...(token ? { pageToken: token } : {}) }, signal));
        if (!parsed.success) invalid('YouTube returned incomplete playlist metadata.');
        const page = parsed.data;
        if (page.pageInfo.totalResults > MATERIAL_LIMITS.selectedUnits || ids.length + page.items.length > MATERIAL_LIMITS.selectedUnits) throw new CreationStorageError('LIMIT_EXCEEDED', 'Playlist exceeds 100 videos. Select individual videos or a smaller playlist; nothing was truncated.');
        if (page.items.some((item, index) => item.snippet.position !== ids.length + index)) invalid('Playlist changed during enumeration. Retry the source.');
        ids.push(...page.items.map(item => item.contentDetails.videoId));
        if (new Set(ids).size !== ids.length) invalid('Playlist contains repeated videos. Select individual videos or a playlist without duplicates.');
        token = page.nextPageToken;
        if (token && (tokens.has(token) || !page.items.length || ids.length >= MATERIAL_LIMITS.selectedUnits)) invalid('Playlist pagination is incomplete. Select a smaller playlist.');
        if (token) tokens.add(token);
        if (!token && ids.length !== page.pageInfo.totalResults) invalid('Playlist changed or has unavailable entries. Retry or select available individual videos.');
      } while (token);
    }
    if (!ids.length) invalid('The playlist has no available videos.');
    const units: YoutubeVideoMetadata[] = [];
    for (let start = 0; start < ids.length; start += 50) {
      const selected = ids.slice(start, start + 50);
      const parsed = videoResponse.safeParse(await this.json('videos', { part: 'snippet,contentDetails,status', id: selected.join(',') }, signal));
      if (!parsed.success) invalid('YouTube returned incomplete video metadata.');
      const byId = new Map(parsed.data.items.map(item => [item.id, item]));
      if (byId.size !== parsed.data.items.length || parsed.data.items.some(item => !selected.includes(item.id))) invalid('YouTube returned inconsistent video identity.');
      for (const id of selected) {
        const item = byId.get(id);
        if (!item || item.status.privacyStatus !== 'public' || item.status.uploadStatus !== 'processed' || item.snippet.liveBroadcastContent !== 'none') invalid('A selected video is unavailable, private, unlisted or live. Supply public completed videos or text material.');
        const unit = { videoId: id, url: `https://www.youtube.com/watch?v=${id}`, ...item.snippet,
          durationSeconds: duration(item.contentDetails.duration), etag: item.etag, privacy: 'public' as const };
        const { liveBroadcastContent, ...metadata } = unit; void liveBroadcastContent; units.push(metadata);
      }
    }
    signal.throwIfAborted();
    const result = youtubeMetadataSchema.safeParse({ schemaVersion: 1, sourceUrl: source.url, fetchedAt: new Date().toISOString(),
      kind: source.kind, playlistId: source.kind === 'youtube_playlist' ? source.playlistId : null, units, coverage: 'complete_metadata' });
    if (!result.success) invalid('YouTube metadata exceeds supported fields or is inconsistent. Nothing was truncated.');
    return result.data;
  }
}
