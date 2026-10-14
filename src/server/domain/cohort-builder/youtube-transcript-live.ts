import { BlockList, isIP } from 'node:net';
import {
  retainedYoutubeTranscriptSchema,
  YOUTUBE_TRANSCRIPT_LIMITS,
  YOUTUBE_TRANSCRIPT_VERSION,
  type YoutubeTranscriptInput,
} from '@/src/shared/cohort-builder/youtube-transcript';
import type { YoutubeTranscriptProvider } from './youtube-transcript';

const denied = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
] as const) denied.addSubnet(address, prefix, 'ipv4');

const global6 = new BlockList(); global6.addSubnet('2000::', 3, 'ipv6');
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]] as const) {
  denied.addSubnet(address, prefix, 'ipv6');
}

export function isPublicIpAddress(address: string) {
  const family = isIP(address);
  return family === 4 ? !denied.check(address, 'ipv4') : family === 6 && global6.check(address, 'ipv6') && !denied.check(address, 'ipv6');
}

export function validateTranscriptEndpoint(input: string, isTestEnv: boolean = process.env.NODE_ENV === 'test'): URL {
  if (!input || typeof input !== 'string' || input.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(input)) {
    throw new Error('TRANSCRIPT_PROVIDER_INVALID');
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('TRANSCRIPT_PROVIDER_INVALID');
  }
  if (url.protocol !== 'https:') {
    if (!(isTestEnv && url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))) {
      throw new Error('TRANSCRIPT_PROVIDER_INVALID');
    }
  }
  if (url.username || url.password) {
    throw new Error('TRANSCRIPT_PROVIDER_INVALID');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    if (!isPublicIpAddress(host)) {
      if (!(isTestEnv && (host === '127.0.0.1' || host === '::1'))) {
        throw new Error('TRANSCRIPT_PROVIDER_INVALID');
      }
    }
  } else {
    if (isTestEnv && (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.test'))) {
      // Allowed in test environment
    } else if (!host.includes('.') || /\.$/.test(host) || /(?:^|\.)(localhost|local|internal|test|invalid|example)$/.test(host)) {
      throw new Error('TRANSCRIPT_PROVIDER_INVALID');
    }
  }
  if (url.port && !isTestEnv && url.port !== '443' && url.port !== '8443') {
    throw new Error('TRANSCRIPT_PROVIDER_INVALID');
  }
  url.hash = '';
  return url;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('TRANSCRIPT_CANCELED'));
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('TRANSCRIPT_CANCELED'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function normalizeTranscriptPayload(
  raw: unknown,
  meta: {
    providerId: string;
    providerVersion: string;
    videoId: string;
    track: YoutubeTranscriptInput['track'];
  }
) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('TRANSCRIPT_MALFORMED');
  }
  const obj = raw as Record<string, any>;

  // Check if raw is already an envelope with segments
  let rawSegments: any[] = [];
  let durationMs: number | undefined = undefined;

  if (Array.isArray(obj.segments)) {
    rawSegments = obj.segments;
    durationMs = typeof obj.video?.durationMs === 'number' ? obj.video.durationMs : typeof obj.durationMs === 'number' ? obj.durationMs : undefined;
  } else if (Array.isArray(obj.cues)) {
    rawSegments = obj.cues;
    durationMs = typeof obj.durationMs === 'number' ? obj.durationMs : undefined;
  } else if (Array.isArray(raw)) {
    rawSegments = raw;
  } else {
    throw new Error('TRANSCRIPT_MALFORMED');
  }

  if (!rawSegments.length) {
    throw new Error('TRANSCRIPT_UNAVAILABLE');
  }
  if (rawSegments.length > YOUTUBE_TRANSCRIPT_LIMITS.segments) {
    throw new Error('TRANSCRIPT_SIZE_LIMIT');
  }

  const normalizedSegments = rawSegments.map((segment, index) => {
    let startMs: number;
    let endMs: number;
    if (typeof segment.startMs === 'number' && typeof segment.endMs === 'number') {
      startMs = Math.round(segment.startMs);
      endMs = Math.round(segment.endMs);
    } else if (typeof segment.start === 'number') {
      const dur = typeof segment.duration === 'number' ? segment.duration : (typeof segment.dur === 'number' ? segment.dur : 3);
      startMs = Math.round(segment.start < 1000 ? segment.start * 1000 : segment.start);
      endMs = Math.round(startMs + (dur < 100 ? dur * 1000 : dur));
    } else {
      throw new Error('TRANSCRIPT_MALFORMED');
    }
    const text = typeof segment.text === 'string' ? segment.text.trim() : '';
    if (!text || startMs < 0 || endMs <= startMs) {
      throw new Error('TRANSCRIPT_MALFORMED');
    }
    return { startMs, endMs, text };
  });

  const maxEndMs = Math.max(...normalizedSegments.map(s => s.endMs));
  const finalDurationMs = Math.min(
    Math.max(durationMs ?? maxEndMs, maxEndMs),
    YOUTUBE_TRANSCRIPT_LIMITS.durationMs
  );

  return {
    format: YOUTUBE_TRANSCRIPT_VERSION,
    provider: {
      id: meta.providerId,
      version: meta.providerVersion,
    },
    acquiredAt: typeof obj.acquiredAt === 'string' ? obj.acquiredAt : new Date().toISOString(),
    video: {
      id: meta.videoId,
      url: `https://www.youtube.com/watch?v=${meta.videoId}`,
      durationMs: finalDurationMs,
      visibility: 'public' as const,
      state: 'complete' as const,
    },
    track: {
      id: meta.track.id,
      language: meta.track.language,
      kind: meta.track.kind,
      translated: false as const,
    },
    segments: normalizedSegments,
  };
}

export interface LiveYoutubeTranscriptProviderOptions {
  endpoint?: string;
  token?: string;
  id?: string;
  version?: string;
  maxRetries?: number;
  initialBackoffMs?: number;
  fetchFn?: typeof fetch;
  method?: 'POST' | 'GET';
}

/** Official transcript provider implementing the non-billing YoutubeTranscriptProvider port. */
export class LiveYoutubeTranscriptProvider implements YoutubeTranscriptProvider {
  readonly id: string;
  readonly version: string;
  readonly billing = 'none' as const;

  private readonly endpoint: string;
  private readonly token?: string;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly method: 'POST' | 'GET';

  constructor(options?: LiveYoutubeTranscriptProviderOptions) {
    this.id = options?.id ?? process.env.INTERACTION_YOUTUBE_TRANSCRIPT_PROVIDER_ID ?? 'youtube-transcript-live';
    this.version = options?.version ?? process.env.INTERACTION_YOUTUBE_TRANSCRIPT_PROVIDER_VERSION ?? '1';
    this.endpoint = options?.endpoint ?? process.env.INTERACTION_YOUTUBE_TRANSCRIPT_ENDPOINT ?? '';
    this.token = options?.token ?? process.env.INTERACTION_YOUTUBE_TRANSCRIPT_TOKEN ?? process.env.INTERACTION_YOUTUBE_TRANSCRIPT_KEY;
    this.maxRetries = options?.maxRetries ?? 2;
    this.initialBackoffMs = options?.initialBackoffMs ?? 200;
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
    this.method = options?.method ?? 'POST';
  }

  async open(
    input: { videoId: string; track: YoutubeTranscriptInput['track'] },
    callerSignal: AbortSignal
  ): Promise<{
    mediaType: 'application/json';
    bytes: AsyncIterable<Uint8Array>;
    close(): void;
  }> {
    if (!this.endpoint) {
      throw new Error('TRANSCRIPT_PROVIDER_REQUIRED');
    }
    const targetUrl = validateTranscriptEndpoint(this.endpoint);
    if (callerSignal.aborted) {
      throw new Error('TRANSCRIPT_CANCELED');
    }

    const abortController = new AbortController();
    const timeoutSignal = AbortSignal.timeout(YOUTUBE_TRANSCRIPT_LIMITS.timeoutMs);
    const signal = AbortSignal.any([callerSignal, timeoutSignal, abortController.signal]);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'SideQuestHQ-Transcript/1.0',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let urlToFetch = targetUrl.toString();
    let body: string | undefined;

    if (this.method === 'POST') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ videoId: input.videoId, track: input.track });
    } else {
      const getUrl = new URL(urlToFetch);
      getUrl.searchParams.set('videoId', input.videoId);
      getUrl.searchParams.set('language', input.track.language);
      getUrl.searchParams.set('kind', input.track.kind);
      getUrl.searchParams.set('trackId', input.track.id);
      urlToFetch = getUrl.toString();
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (signal.aborted) {
        throw new Error(callerSignal.aborted ? 'TRANSCRIPT_CANCELED' : 'TRANSCRIPT_DEADLINE');
      }

      try {
        const response = await this.fetchFn(urlToFetch, {
          method: this.method,
          headers,
          body,
          signal,
        });

        // 429 Too Many Requests or 503 Service Unavailable -> rate limit / backoff
        if (response.status === 429 || response.status === 503) {
          if (attempt < this.maxRetries && !signal.aborted) {
            const retryAfter = response.headers.get('retry-after');
            let delayMs = this.initialBackoffMs * Math.pow(2, attempt);
            if (retryAfter) {
              const secs = Number(retryAfter);
              if (!Number.isNaN(secs) && secs > 0) delayMs = Math.min(secs * 1000, 5000);
            }
            await sleep(delayMs, signal);
            continue;
          }
          throw new Error(response.status === 429 ? 'TRANSCRIPT_RATE_LIMIT' : 'TRANSCRIPT_PROVIDER_FAILURE');
        }

        if (response.status === 404) {
          const bodyText = await response.text().catch(() => '');
          if (bodyText.includes('TRACK_NOT_FOUND') || bodyText.includes('track') || bodyText.includes('language')) {
            throw new Error('TRANSCRIPT_TRACK_UNAVAILABLE');
          }
          throw new Error('TRANSCRIPT_UNAVAILABLE');
        }

        if (response.status === 401 || response.status === 403) {
          throw new Error('TRANSCRIPT_ACCESS_DENIED');
        }

        if (response.status === 400 || response.status === 422) {
          throw new Error('TRANSCRIPT_MALFORMED');
        }

        if (response.status === 413) {
          throw new Error('TRANSCRIPT_SIZE_LIMIT');
        }

        if (response.status === 504) {
          throw new Error('TRANSCRIPT_DEADLINE');
        }

        if (!response.ok) {
          throw new Error('TRANSCRIPT_PROVIDER_FAILURE');
        }

        const jsonText = await response.text();
        if (Buffer.byteLength(jsonText, 'utf8') > YOUTUBE_TRANSCRIPT_LIMITS.bytes) {
          throw new Error('TRANSCRIPT_SIZE_LIMIT');
        }

        let data: unknown;
        try {
          data = JSON.parse(jsonText);
        } catch {
          throw new Error('TRANSCRIPT_MALFORMED');
        }

        if (data && typeof data === 'object' && ('error' in data || 'code' in data)) {
          const errCode = String((data as any).code || (data as any).error);
          if (errCode.includes('rate_limit') || errCode.includes('RATE_LIMITED') || errCode.includes('quota')) {
            throw new Error('TRANSCRIPT_RATE_LIMIT');
          }
          if (errCode.includes('track') || errCode.includes('TRACK_NOT_FOUND')) {
            throw new Error('TRANSCRIPT_TRACK_UNAVAILABLE');
          }
          if (errCode.includes('no_captions') || errCode.includes('NO_CAPTIONS') || errCode.includes('UNAVAILABLE')) {
            throw new Error('TRANSCRIPT_UNAVAILABLE');
          }
          if (errCode.includes('access_denied') || errCode.includes('ACCESS_DENIED') || errCode.includes('private')) {
            throw new Error('TRANSCRIPT_ACCESS_DENIED');
          }
        }

        const normalized = normalizeTranscriptPayload(data, {
          providerId: this.id,
          providerVersion: this.version,
          videoId: input.videoId,
          track: input.track,
        });

        const validated = retainedYoutubeTranscriptSchema.parse(normalized);
        const payloadBuffer = Buffer.from(JSON.stringify(validated), 'utf8');

        if (payloadBuffer.byteLength > YOUTUBE_TRANSCRIPT_LIMITS.bytes) {
          throw new Error('TRANSCRIPT_SIZE_LIMIT');
        }

        return {
          mediaType: 'application/json' as const,
          bytes: (async function* () {
            yield payloadBuffer;
          })(),
          close: () => {
            abortController.abort();
          },
        };
      } catch (error) {
        if (signal.aborted) {
          throw new Error(callerSignal.aborted ? 'TRANSCRIPT_CANCELED' : 'TRANSCRIPT_DEADLINE');
        }
        if (
          error instanceof Error &&
          [
            'TRANSCRIPT_RATE_LIMIT',
            'TRANSCRIPT_UNAVAILABLE',
            'TRANSCRIPT_TRACK_UNAVAILABLE',
            'TRANSCRIPT_ACCESS_DENIED',
            'TRANSCRIPT_MALFORMED',
            'TRANSCRIPT_SIZE_LIMIT',
            'TRANSCRIPT_DEADLINE',
            'TRANSCRIPT_CANCELED',
          ].includes(error.message)
        ) {
          throw error;
        }
        if (attempt === this.maxRetries) {
          throw new Error('TRANSCRIPT_PROVIDER_FAILURE');
        }
        await sleep(this.initialBackoffMs * Math.pow(2, attempt), signal);
      }
    }

    throw new Error('TRANSCRIPT_PROVIDER_FAILURE');
  }
}
