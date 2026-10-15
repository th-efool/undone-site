import { vi, afterEach, describe, expect, it } from 'vitest';
vi.mock('server-only', () => ({}));
import { createHash } from 'node:crypto';
import {
  LiveVideoObservationProvider,
  acquireVideoObservation,
  defaultVideoObservationProvider,
  extractVideoObservation,
  readOwnedVideoObservation,
  type VideoObservationProvider,
} from '../journey-video-adapter';
import {
  retainedVideoObservationSchema,
  VIDEO_OBSERVATION_PARSER_VERSION,
  YOUTUBE_VIDEO_LIMITS,
  type RetainedVideoObservation,
} from '@/src/shared/cohort-builder/youtube-video-observation';
import {
  acquireYoutubeTranscript,
  extractYoutubeTranscript,
  type YoutubeTranscriptProvider,
} from '../youtube-transcript';
import { YOUTUBE_TRANSCRIPT_VERSION } from '@/src/shared/cohort-builder/youtube-transcript';
import type { YoutubeVideoMetadata } from '@/src/shared/cohort-creation/youtube';
import type { MaterialObservation } from '@/src/server/domain/cohort-creation/material-observation';

const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const videoId = 'dQw4w9WgXcQ';

function createValidMetadata(overrides?: Partial<YoutubeVideoMetadata>): YoutubeVideoMetadata {
  return {
    videoId,
    url: videoUrl,
    title: 'Distributed Consensus and State Machine Replication',
    description: 'An authoritative lecture on consensus, Paxos, and Raft.',
    channelId: 'UC1234567890',
    channelTitle: 'CS Lectures',
    durationSeconds: 300,
    etag: 'etag123',
    privacy: 'public' as const,
    publishedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createValidObservation(overrides?: Partial<RetainedVideoObservation>): RetainedVideoObservation {
  return {
    format: 'youtube-video-observation-v1',
    video: {
      id: videoId,
      title: 'Distributed Consensus and State Machine Replication',
      durationSeconds: 300,
      url: videoUrl,
    },
    model: {
      provider: 'google',
      modelId: 'gemini-1.5-pro',
      adapterVersion: 'vercel-video-observation-v3',
    },
    contentOrigin: 'ai',
    observedAt: '2026-10-15T12:00:00.000Z',
    limitations: [
      'Coverage is non-exhaustive; timestamps are estimated.',
      'Model observations are not verbatim captions.',
    ],
    observations: [
      {
        startSeconds: 0,
        endSeconds: 60,
        text: 'Overview of consensus in asynchronous networks with crash-recovery failures.',
      },
      {
        startSeconds: 65,
        endSeconds: 150,
        text: 'Leader election phases, term monotonicity, and split vote mitigation.',
      },
      {
        startSeconds: 160,
        endSeconds: 290,
        text: 'Log replication, commit index safety rules, and state machine transitions.',
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('journey-video-adapter: VideoObservationProvider and native video observations', () => {
  describe('LiveVideoObservationProvider', () => {
    it('acquires native video observation via mock reader and observer, conforming to schema', async () => {
      const metadata = createValidMetadata();
      const mockReader = {
        read: vi.fn().mockResolvedValue({
          schemaVersion: 1,
          sourceUrl: videoUrl,
          fetchedAt: '2026-10-15T12:00:00.000Z',
          kind: 'youtube_video',
          playlistId: null,
          units: [metadata],
          coverage: 'complete_metadata',
        }),
      };

      const mockObserver: MaterialObservation = {
        identity: {
          provider: 'google',
          modelId: 'gemini-1.5-pro',
          adapterVersion: 'vercel-video-observation-v3',
        },
        observeVideo: vi.fn().mockResolvedValue({
          canObserve: true,
          observations: [
            { startSeconds: 0, endSeconds: 60, text: 'Consensus overview.' },
            { startSeconds: 70, endSeconds: 180, text: 'Leader election details.' },
          ],
          limitations: ['Estimated intervals.'],
        }),
      };

      const provider = new LiveVideoObservationProvider({
        reader: mockReader,
        observer: mockObserver,
      });

      const controller = new AbortController();
      const observation = await provider.observeVideo(metadata, controller.signal);

      // Verify conforms to retainedVideoObservationSchema
      const validated = retainedVideoObservationSchema.parse(observation);
      expect(validated.format).toBe('youtube-video-observation-v1');
      expect(validated.video.id).toBe(videoId);
      expect(validated.video.durationSeconds).toBe(300);
      expect(validated.contentOrigin).toBe('ai');
      expect(validated.model).toEqual({
        provider: 'google',
        modelId: 'gemini-1.5-pro',
        adapterVersion: 'vercel-video-observation-v3',
      });
      expect(validated.limitations).toContain('Estimated intervals.');
      expect(validated.observations).toHaveLength(2);
      expect(validated.observations[0]).toEqual({
        startSeconds: 0,
        endSeconds: 60,
        text: 'Consensus overview.',
      });
      expect(validated.observations[1]).toEqual({
        startSeconds: 70,
        endSeconds: 180,
        text: 'Leader election details.',
      });

      expect(mockReader.read).toHaveBeenCalledWith(videoUrl, controller.signal);
      expect(mockObserver.observeVideo).toHaveBeenCalledWith(metadata, controller.signal);
    });

    it('rejects videos exceeding authoritative duration limit', async () => {
      const longMetadata = createValidMetadata({ durationSeconds: YOUTUBE_VIDEO_LIMITS.durationSeconds + 1 });
      const mockReader = {
        read: vi.fn().mockResolvedValue({
          schemaVersion: 1,
          sourceUrl: videoUrl,
          fetchedAt: '2026-10-15T12:00:00.000Z',
          kind: 'youtube_video',
          playlistId: null,
          units: [longMetadata],
          coverage: 'complete_metadata',
        }),
      };
      const provider = new LiveVideoObservationProvider({
        reader: mockReader,
        observer: {
          identity: { provider: 'test', modelId: 'test', adapterVersion: '1' },
          observeVideo: vi.fn(),
        },
      });

      await expect(
        provider.observeVideo(longMetadata, new AbortController().signal)
      ).rejects.toThrow('VIDEO_DURATION_LIMIT_EXCEEDED');
    });

    it('rejects observations with out-of-duration intervals or overlaps via validateVideoObservation', async () => {
      const metadata = createValidMetadata({ durationSeconds: 100 });
      const mockReader = {
        read: vi.fn().mockResolvedValue({
          schemaVersion: 1,
          sourceUrl: videoUrl,
          fetchedAt: '2026-10-15T12:00:00.000Z',
          kind: 'youtube_video',
          playlistId: null,
          units: [metadata],
          coverage: 'complete_metadata',
        }),
      };

      // 1. Out of duration interval (endSeconds > 100)
      const outOfBoundsObserver: MaterialObservation = {
        identity: { provider: 'google', modelId: 'gemini', adapterVersion: 'v1' },
        observeVideo: vi.fn().mockResolvedValue({
          canObserve: true,
          observations: [{ startSeconds: 10, endSeconds: 150, text: 'Exceeds duration.' }],
          limitations: [],
        }),
      };
      const provider1 = new LiveVideoObservationProvider({ reader: mockReader, observer: outOfBoundsObserver });
      await expect(
        provider1.observeVideo(metadata, new AbortController().signal)
      ).rejects.toThrow();

      // 2. Overlapping intervals (second starts before first ends)
      const overlappingObserver: MaterialObservation = {
        identity: { provider: 'google', modelId: 'gemini', adapterVersion: 'v1' },
        observeVideo: vi.fn().mockResolvedValue({
          canObserve: true,
          observations: [
            { startSeconds: 10, endSeconds: 50, text: 'First range.' },
            { startSeconds: 40, endSeconds: 80, text: 'Overlapping range.' },
          ],
          limitations: [],
        }),
      };
      const provider2 = new LiveVideoObservationProvider({ reader: mockReader, observer: overlappingObserver });
      await expect(
        provider2.observeVideo(metadata, new AbortController().signal)
      ).rejects.toThrow();

      // 3. Reversed interval (endSeconds <= startSeconds)
      const reversedObserver: MaterialObservation = {
        identity: { provider: 'google', modelId: 'gemini', adapterVersion: 'v1' },
        observeVideo: vi.fn().mockResolvedValue({
          canObserve: true,
          observations: [{ startSeconds: 50, endSeconds: 30, text: 'Backwards interval.' }],
          limitations: [],
        }),
      };
      const provider3 = new LiveVideoObservationProvider({ reader: mockReader, observer: reversedObserver });
      await expect(
        provider3.observeVideo(metadata, new AbortController().signal)
      ).rejects.toThrow();
    });
  });

  describe('acquireVideoObservation', () => {
    it('acquires and serializes retained video observation with provider', async () => {
      const observation = createValidObservation();
      const mockProvider: VideoObservationProvider = {
        observeVideo: vi.fn().mockResolvedValue(observation),
      };

      const input = {
        kind: 'youtube' as const,
        url: videoUrl,
        mode: 'video_observation' as const,
      };

      const result = await acquireVideoObservation(input, mockProvider);
      expect(result.observation).toEqual(observation);
      expect(result.bytes).toBeInstanceOf(Uint8Array);

      const parsedJson = JSON.parse(Buffer.from(result.bytes).toString('utf8'));
      expect(parsedJson.video.id).toBe(videoId);
      expect(parsedJson.contentOrigin).toBe('ai');
      expect(parsedJson.model.modelId).toBe('gemini-1.5-pro');
      expect(parsedJson.observations).toHaveLength(3);
    });

    it('rejects invalid YouTube video URL before invoking provider', async () => {
      const mockProvider: VideoObservationProvider = {
        observeVideo: vi.fn(),
      };

      const invalidInput = {
        kind: 'youtube' as const,
        url: 'https://youtube.com/playlist?list=PL1234567890',
        mode: 'video_observation' as const,
      };

      await expect(acquireVideoObservation(invalidInput, mockProvider)).rejects.toThrow('INVALID_YOUTUBE_VIDEO_URL');
      expect(mockProvider.observeVideo).not.toHaveBeenCalled();
    });

    it('rejects foreign video observation returned by provider', async () => {
      const foreignObservation = createValidObservation({
        video: {
          id: '12345678901',
          title: 'Foreign Video',
          durationSeconds: 120,
          url: 'https://www.youtube.com/watch?v=12345678901',
        },
      });
      const mockProvider: VideoObservationProvider = {
        observeVideo: vi.fn().mockResolvedValue(foreignObservation),
      };

      const input = {
        kind: 'youtube' as const,
        url: videoUrl,
        mode: 'video_observation' as const,
      };

      await expect(acquireVideoObservation(input, mockProvider)).rejects.toThrow('FOREIGN_VIDEO_OBSERVATION');
    });

    it('respects timeout deadline and cancellation signals', async () => {
      vi.useFakeTimers();
      let resolveWork!: (val: RetainedVideoObservation) => void;
      const hangingProvider: VideoObservationProvider = {
        observeVideo: vi.fn().mockImplementation(() => new Promise(res => { resolveWork = res; })),
      };

      const input = {
        kind: 'youtube' as const,
        url: videoUrl,
        mode: 'video_observation' as const,
      };

      const acquirePromise = acquireVideoObservation(input, hangingProvider);
      const rejection = expect(acquirePromise).rejects.toThrow('VIDEO_OBSERVATION_DEADLINE');
      await vi.advanceTimersByTimeAsync(YOUTUBE_VIDEO_LIMITS.timeoutMs);
      await rejection;
    });

    it('cancels immediately when caller signal is aborted', async () => {
      const controller = new AbortController();
      const mockProvider: VideoObservationProvider = {
        observeVideo: vi.fn().mockImplementation(() => new Promise(() => {})),
      };

      const input = {
        kind: 'youtube' as const,
        url: videoUrl,
        mode: 'video_observation' as const,
      };

      const acquirePromise = acquireVideoObservation(input, mockProvider, controller.signal);
      const rejection = expect(acquirePromise).rejects.toThrow('VIDEO_OBSERVATION_CANCELED');
      controller.abort();
      await rejection;
    });
  });

  describe('extractVideoObservation', () => {
    it('converts retained bytes into SourceExtraction with text, millisecond locations, and model metadata', () => {
      const observation = createValidObservation();
      const bytes = Buffer.from(JSON.stringify(observation), 'utf8');

      const input = {
        kind: 'youtube' as const,
        url: videoUrl,
        mode: 'video_observation' as const,
      };

      const extracted = extractVideoObservation(bytes, input);

      expect(extracted.videoId).toBe(videoId);
      expect(extracted.model).toEqual(observation.model);
      expect(extracted.limitations).toEqual(observation.limitations);

      // Verify text concatenation
      const expectedText = observation.observations.map(obs => obs.text).join('\n\n');
      expect(extracted.text).toBe(expectedText);

      // Verify locations mapping with exact startMs/endMs
      expect(extracted.locations).toHaveLength(3);
      for (let i = 0; i < observation.observations.length; i++) {
        const obs = observation.observations[i];
        const loc = extracted.locations[i];
        expect(loc.startMs).toBe(Math.round(obs.startSeconds * 1000));
        expect(loc.endMs).toBe(Math.round(obs.endSeconds * 1000));
        expect(loc.segmentId).toBe(`obs-${i}`);
        expect(extracted.text.slice(loc.start, loc.end)).toBe(obs.text);
      }
    });

    it('rejects foreign video observation bytes not matching input URL', () => {
      const observation = createValidObservation({
        video: {
          id: 'other123456',
          title: 'Other video',
          durationSeconds: 100,
          url: 'https://www.youtube.com/watch?v=other123456',
        },
      });
      const bytes = Buffer.from(JSON.stringify(observation), 'utf8');

      const input = {
        kind: 'youtube' as const,
        url: videoUrl,
        mode: 'video_observation' as const,
      };

      expect(() => extractVideoObservation(bytes, input)).toThrow('FOREIGN_VIDEO_OBSERVATION');
    });

    it('rejects empty observations array', () => {
      const observation = createValidObservation({ observations: [] });
      const bytes = Buffer.from(JSON.stringify(observation), 'utf8');

      const input = {
        kind: 'youtube' as const,
        url: videoUrl,
        mode: 'video_observation' as const,
      };

      expect(() => extractVideoObservation(bytes, input)).toThrow('EMPTY_VIDEO_OBSERVATION');
    });

    it('rejects malformed or non-JSON bytes', () => {
      const input = {
        kind: 'youtube' as const,
        url: videoUrl,
        mode: 'video_observation' as const,
      };

      expect(() => extractVideoObservation(Buffer.from('not json'), input)).toThrow('VIDEO_OBSERVATION_MALFORMED');
      expect(() => extractVideoObservation(Buffer.from(''), input)).toThrow('VIDEO_OBSERVATION_SIZE_LIMIT');
    });

    it('rejects oversized extracted text exceeding byte limits', () => {
      const oversizedObs = createValidObservation({
        observations: Array.from({ length: 25 }, (_, i) => ({
          startSeconds: i * 10,
          endSeconds: i * 10 + 9,
          text: 'x'.repeat(9_000),
        })),
      });
      const bytes = Buffer.from(JSON.stringify(oversizedObs), 'utf8');

      const input = {
        kind: 'youtube' as const,
        url: videoUrl,
        mode: 'video_observation' as const,
      };

      expect(() => extractVideoObservation(bytes, input)).toThrow('VIDEO_OBSERVATION_OUTPUT_LIMIT');
    });
  });

  describe('readOwnedVideoObservation: storage verification', () => {
    it('verifies ownership and integrity of retained video observation artifact', async () => {
      const observation = createValidObservation();
      const bytes = Buffer.from(JSON.stringify(observation), 'utf8');
      const checksum = createHash('sha256').update(bytes).digest('hex');
      const identity = {
        workspaceId: 'ws-test',
        artifactId: 'art-video-1',
        sourceId: 'source-1',
        sourceVersion: 1,
        inputFingerprint: 'fp-123',
      };

      const row = {
        id: identity.artifactId,
        workspaceId: identity.workspaceId,
        sourceId: identity.sourceId,
        sourceVersion: identity.sourceVersion,
        kind: 'source_raw',
        inputFingerprint: identity.inputFingerprint,
        checksum,
        byteLength: bytes.byteLength,
        body: bytes,
      };

      const sql = {
        query: async (_statement: string, parameters: unknown[]) => ({
          rows: parameters[0] === identity.workspaceId ? [row] : [],
        }),
      };

      const input = {
        kind: 'youtube' as const,
        url: videoUrl,
        mode: 'video_observation' as const,
      };

      const extracted = await readOwnedVideoObservation(sql, identity, input);
      expect(extracted.videoId).toBe(videoId);
      expect(extracted.text).toContain('consensus');

      // Foreign workspace fails:
      await expect(
        readOwnedVideoObservation(sql, { ...identity, workspaceId: 'foreign-ws' }, input)
      ).rejects.toThrow('ARTIFACT_NOT_FOUND');

      // Stale sourceVersion fails:
      await expect(
        readOwnedVideoObservation(sql, { ...identity, sourceVersion: 2 }, input)
      ).rejects.toThrow('FOREIGN_VIDEO_OBSERVATION_ARTIFACT');
    });
  });

  describe('Transcript vs Video Observation mode separation', () => {
    it('guarantees distinct provenance and schema semantics between transcript and video_observation', async () => {
      // 1. Video observation mode:
      const videoObs = createValidObservation();
      const videoBytes = Buffer.from(JSON.stringify(videoObs), 'utf8');
      const videoInput = { kind: 'youtube' as const, url: videoUrl, mode: 'video_observation' as const };
      const videoExtracted = extractVideoObservation(videoBytes, videoInput);

      // Verifies video observation attributes:
      expect(videoExtracted.model).toBeDefined();
      expect(videoExtracted.model.provider).toBe('google');
      expect(videoExtracted.limitations).toContain('Coverage is non-exhaustive; timestamps are estimated.');
      // Locations have estimated timestamps:
      expect(videoExtracted.locations[0].startMs).toBe(0);
      expect(videoExtracted.locations[0].endMs).toBe(60000);

      // 2. Transcript mode:
      const transcriptTrack = { id: 'en-captions', language: 'en', kind: 'manual' as const, translated: false as const };
      const transcriptValue = {
        format: YOUTUBE_TRANSCRIPT_VERSION,
        provider: { id: 'youtube-caption-provider', version: '1' },
        acquiredAt: '2026-10-15T12:00:00.000Z',
        video: { id: videoId, url: videoUrl, durationMs: 300_000, visibility: 'public' as const, state: 'complete' as const },
        track: transcriptTrack,
        segments: [
          { startMs: 0, endMs: 5000, text: 'Hello world verbatim caption.' },
          { startMs: 5200, endMs: 9800, text: 'Second verbatim caption sentence.' },
        ],
      };
      const transcriptBytes = Buffer.from(JSON.stringify(transcriptValue), 'utf8');
      const transcriptInput = { kind: 'youtube' as const, url: videoUrl, track: transcriptTrack };
      const transcriptExtracted = extractYoutubeTranscript(transcriptBytes, transcriptInput);

      // Verifies transcript attributes:
      expect(transcriptExtracted.track).toEqual(transcriptTrack);
      expect(transcriptExtracted.text).toBe('Hello world verbatim caption.\n\nSecond verbatim caption sentence.');
      expect(transcriptExtracted.locations[0].startMs).toBe(0);
      expect(transcriptExtracted.locations[0].endMs).toBe(5000);

      // Model observation is NEVER treated as verbatim caption:
      expect(videoExtracted).not.toHaveProperty('track');
      expect(transcriptExtracted).not.toHaveProperty('model');
      expect(transcriptExtracted).not.toHaveProperty('limitations');
      expect(videoObs.contentOrigin).toBe('ai');
    });
  });

  describe('defaultVideoObservationProvider helper', () => {
    it('creates a LiveVideoObservationProvider when invoked as a function', () => {
      const provider = defaultVideoObservationProvider();
      expect(provider).toBeInstanceOf(LiveVideoObservationProvider);
      expect(typeof provider.observeVideo).toBe('function');
    });

    it('exposes observeVideo directly on the helper function object', () => {
      expect(typeof defaultVideoObservationProvider.observeVideo).toBe('function');
    });
  });
});
