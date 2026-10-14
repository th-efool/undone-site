import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LiveYoutubeTranscriptProvider,
  normalizeTranscriptPayload,
  validateTranscriptEndpoint,
} from '../youtube-transcript-live';
import { youtubeTranscriptReadiness } from '../youtube-transcript-policy';
import { acquireYoutubeTranscript } from '../youtube-transcript';
import { YOUTUBE_TRANSCRIPT_LIMITS } from '@/src/shared/cohort-builder/youtube-transcript';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const videoId = 'abcdefghijk';
const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
const track = { id: 'en', language: 'en', kind: 'manual' as const, translated: false as const };
const input = { url: videoUrl, track };

describe('validateTranscriptEndpoint & SSRF protection', () => {
  it('accepts valid public HTTPS endpoints', () => {
    const url = validateTranscriptEndpoint('https://captions.prod-service.com/v1/transcript', false);
    expect(url.href).toBe('https://captions.prod-service.com/v1/transcript');
  });

  it('rejects non-URL and malformed strings', () => {
    expect(() => validateTranscriptEndpoint('not-a-url', false)).toThrow('TRANSCRIPT_PROVIDER_INVALID');
    expect(() => validateTranscriptEndpoint('', false)).toThrow('TRANSCRIPT_PROVIDER_INVALID');
    expect(() => validateTranscriptEndpoint('https://test\u0000.com', false)).toThrow('TRANSCRIPT_PROVIDER_INVALID');
  });

  it('rejects plain HTTP in production', () => {
    expect(() => validateTranscriptEndpoint('http://captions.prod-service.com/v1/transcript', false)).toThrow(
      'TRANSCRIPT_PROVIDER_INVALID'
    );
  });

  it('rejects embedded credentials in URL', () => {
    expect(() => validateTranscriptEndpoint('https://user:pass@captions.prod-service.com/v1', false)).toThrow(
      'TRANSCRIPT_PROVIDER_INVALID'
    );
  });

  it('rejects private and loopback IP addresses in production', () => {
    for (const ip of ['127.0.0.1', '10.0.1.20', '192.168.1.1', '172.16.0.5', '169.254.169.254']) {
      expect(() => validateTranscriptEndpoint(`https://${ip}/transcript`, false)).toThrow('TRANSCRIPT_PROVIDER_INVALID');
    }
  });

  it('rejects non-routable and internal hostnames in production', () => {
    for (const host of ['localhost', 'service.local', 'api.internal', 'gateway.test', 'invalid.example']) {
      expect(() => validateTranscriptEndpoint(`https://${host}/transcript`, false)).toThrow(
        'TRANSCRIPT_PROVIDER_INVALID'
      );
    }
  });

  it('rejects non-standard ports in production', () => {
    expect(() => validateTranscriptEndpoint('https://captions.prod-service.com:8080/transcript', false)).toThrow(
      'TRANSCRIPT_PROVIDER_INVALID'
    );
  });

  it('allows local endpoints in test environment', () => {
    const url = validateTranscriptEndpoint('http://localhost:3108/transcript', true);
    expect(url.hostname).toBe('localhost');
    expect(url.port).toBe('3108');
  });
});

describe('youtubeTranscriptReadiness policy', () => {
  it('returns YOUTUBE_CAPABILITY_DISABLED when flag is off', () => {
    expect(youtubeTranscriptReadiness()).toEqual({
      enabled: false,
      code: 'YOUTUBE_CAPABILITY_DISABLED',
    });
  });

  it('returns TRANSCRIPT_PROVIDER_REQUIRED when flag is on but endpoint missing', () => {
    vi.stubEnv('INTERACTION_YOUTUBE_ENABLED', '1');
    expect(youtubeTranscriptReadiness()).toEqual({
      enabled: false,
      code: 'TRANSCRIPT_PROVIDER_REQUIRED',
    });
  });

  it('returns TRANSCRIPT_PROVIDER_INVALID when endpoint is invalid', () => {
    vi.stubEnv('INTERACTION_YOUTUBE_ENABLED', '1');
    vi.stubEnv('INTERACTION_YOUTUBE_TRANSCRIPT_ENDPOINT', 'http://invalid-plain-http.com');
    // in test mode, non-localhost http is invalid
    expect(youtubeTranscriptReadiness()).toEqual({
      enabled: false,
      code: 'TRANSCRIPT_PROVIDER_INVALID',
    });
  });

  it('returns enabled when flag is on and endpoint is valid', () => {
    vi.stubEnv('INTERACTION_YOUTUBE_ENABLED', '1');
    vi.stubEnv('INTERACTION_YOUTUBE_TRANSCRIPT_ENDPOINT', 'https://captions.public-gateway.com/v1');
    expect(youtubeTranscriptReadiness()).toEqual({
      enabled: true,
      code: null,
    });
  });
});

describe('normalizeTranscriptPayload', () => {
  it('wraps raw cues array into valid retained transcript schema', () => {
    const cues = [
      { startMs: 0, endMs: 4000, text: 'First segment' },
      { startMs: 5000, endMs: 9000, text: 'Second segment' },
    ];
    const normalized = normalizeTranscriptPayload(cues, {
      providerId: 'test-p',
      providerVersion: '1',
      videoId,
      track,
    });
    expect(normalized.format).toBe('youtube-transcript-v1');
    expect(normalized.provider).toEqual({ id: 'test-p', version: '1' });
    expect(normalized.video.id).toBe(videoId);
    expect(normalized.video.durationMs).toBe(9000);
    expect(normalized.segments).toHaveLength(2);
  });

  it('converts start/duration seconds format into startMs/endMs', () => {
    const cues = [
      { start: 0, duration: 2.5, text: 'Seconds cue 1' },
      { start: 3.0, duration: 4.0, text: 'Seconds cue 2' },
    ];
    const normalized = normalizeTranscriptPayload(cues, {
      providerId: 'test-p',
      providerVersion: '1',
      videoId,
      track,
    });
    expect(normalized.segments[0]).toEqual({ startMs: 0, endMs: 2500, text: 'Seconds cue 1' });
    expect(normalized.segments[1]).toEqual({ startMs: 3000, endMs: 7000, text: 'Seconds cue 2' });
  });

  it('rejects empty segments with TRANSCRIPT_UNAVAILABLE', () => {
    expect(() =>
      normalizeTranscriptPayload([], {
        providerId: 'test-p',
        providerVersion: '1',
        videoId,
        track,
      })
    ).toThrow('TRANSCRIPT_UNAVAILABLE');
  });

  it('rejects malformed cues with TRANSCRIPT_MALFORMED', () => {
    expect(() =>
      normalizeTranscriptPayload([{ text: 'missing times' }], {
        providerId: 'test-p',
        providerVersion: '1',
        videoId,
        track,
      })
    ).toThrow('TRANSCRIPT_MALFORMED');
  });
});

describe('LiveYoutubeTranscriptProvider acquisition & error translation', () => {
  it('successfully acquires transcript and streams retained bytes conforming to schema', async () => {
    const mockCues = [
      { startMs: 0, endMs: 4000, text: 'Consensus protocols require overlap.' },
      { startMs: 5000, endMs: 10000, text: 'Majorities commit transactions.' },
    ];

    const fetchFn = vi.fn<typeof fetch>(async (url, init) => {
      expect(init?.method).toBe('POST');
      expect((init?.headers as any)?.Authorization).toBe('Bearer test-secret-token');
      expect((init?.headers as any)?.['Content-Type']).toBe('application/json');
      const body = JSON.parse(init?.body as string);
      expect(body).toEqual({ videoId, track });

      return new Response(JSON.stringify(mockCues), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const provider = new LiveYoutubeTranscriptProvider({
      endpoint: 'https://captions.public-gateway.com/v1/transcript',
      token: 'test-secret-token',
      fetchFn,
    });

    const result = await acquireYoutubeTranscript(input, provider);
    expect(result.extraction.videoId).toBe(videoId);
    expect(result.extraction.text).toBe(
      'Consensus protocols require overlap.\n\nMajorities commit transactions.'
    );
    expect(result.extraction.locations).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('translates 429 rate limit with backoff retry to TRANSCRIPT_RATE_LIMIT', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      return new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '0' },
      });
    });

    const provider = new LiveYoutubeTranscriptProvider({
      endpoint: 'https://captions.public-gateway.com/v1/transcript',
      maxRetries: 1,
      initialBackoffMs: 10,
      fetchFn,
    });

    await expect(acquireYoutubeTranscript(input, provider)).rejects.toThrow('TRANSCRIPT_RATE_LIMIT');
    // Initial attempt + 1 retry = 2 calls
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('translates 404 to TRANSCRIPT_UNAVAILABLE and specific track 404 to TRANSCRIPT_TRACK_UNAVAILABLE', async () => {
    const notFoundFn = vi.fn<typeof fetch>(async () => {
      return new Response('Captions not found for video', { status: 404 });
    });
    const provider1 = new LiveYoutubeTranscriptProvider({
      endpoint: 'https://captions.public-gateway.com/v1/transcript',
      fetchFn: notFoundFn,
    });
    await expect(acquireYoutubeTranscript(input, provider1)).rejects.toThrow('TRANSCRIPT_UNAVAILABLE');

    const trackNotFoundFn = vi.fn<typeof fetch>(async () => {
      return new Response('TRACK_NOT_FOUND: requested language es missing', { status: 404 });
    });
    const provider2 = new LiveYoutubeTranscriptProvider({
      endpoint: 'https://captions.public-gateway.com/v1/transcript',
      fetchFn: trackNotFoundFn,
    });
    await expect(acquireYoutubeTranscript(input, provider2)).rejects.toThrow('TRANSCRIPT_TRACK_UNAVAILABLE');
  });

  it('translates 401/403 to TRANSCRIPT_ACCESS_DENIED', async () => {
    const authFn = vi.fn<typeof fetch>(async () => {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    });
    const provider = new LiveYoutubeTranscriptProvider({
      endpoint: 'https://captions.public-gateway.com/v1/transcript',
      fetchFn: authFn,
    });
    await expect(acquireYoutubeTranscript(input, provider)).rejects.toThrow('TRANSCRIPT_ACCESS_DENIED');
  });

  it('translates 400 to TRANSCRIPT_MALFORMED', async () => {
    const badReqFn = vi.fn<typeof fetch>(async () => {
      return new Response('Invalid video ID', { status: 400 });
    });
    const provider = new LiveYoutubeTranscriptProvider({
      endpoint: 'https://captions.public-gateway.com/v1/transcript',
      fetchFn: badReqFn,
    });
    await expect(acquireYoutubeTranscript(input, provider)).rejects.toThrow('TRANSCRIPT_MALFORMED');
  });

  it('translates 500 error to TRANSCRIPT_PROVIDER_FAILURE', async () => {
    const serverErrFn = vi.fn<typeof fetch>(async () => {
      return new Response('Internal error', { status: 500 });
    });
    const provider = new LiveYoutubeTranscriptProvider({
      endpoint: 'https://captions.public-gateway.com/v1/transcript',
      maxRetries: 0,
      fetchFn: serverErrFn,
    });
    await expect(acquireYoutubeTranscript(input, provider)).rejects.toThrow('TRANSCRIPT_PROVIDER_FAILURE');
  });

  it('enforces payload size limit for oversized responses', async () => {
    const largeSegments = Array.from({ length: 500 }, (_, i) => ({
      startMs: i * 1000,
      endMs: i * 1000 + 500,
      text: 'A'.repeat(3000), // > 1.5 MB total
    }));
    const fetchFn = vi.fn<typeof fetch>(async () => {
      return new Response(JSON.stringify(largeSegments), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const provider = new LiveYoutubeTranscriptProvider({
      endpoint: 'https://captions.public-gateway.com/v1/transcript',
      fetchFn,
    });
    await expect(acquireYoutubeTranscript(input, provider)).rejects.toThrow('TRANSCRIPT_SIZE_LIMIT');
  });

  it('aborts on caller cancellation', async () => {
    const controller = new AbortController();
    const fetchFn = vi.fn<typeof fetch>(async (_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    const provider = new LiveYoutubeTranscriptProvider({
      endpoint: 'https://captions.public-gateway.com/v1/transcript',
      fetchFn,
    });
    controller.abort();
    await expect(acquireYoutubeTranscript(input, provider, controller.signal)).rejects.toThrow(
      'TRANSCRIPT_CANCELED'
    );
  });
});
