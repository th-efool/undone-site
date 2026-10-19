import 'server-only';
import type { LanguageModel } from 'ai';
import { z } from 'zod';
import { youtubeVideoMetadataSchema, type YoutubeVideoMetadata } from '@/src/shared/cohort-creation/youtube';
import {
  type MaterialObservation,
  validateVideoObservation,
} from '@/src/server/domain/cohort-creation/material-observation';
import { YoutubeMetadataReader } from '@/src/server/domain/cohort-creation/materials/youtube-metadata';
import { VercelMaterialObservation } from '@/src/server/infrastructure/ai/vercelMaterialObservation';
import { createCohortModel, DEFAULT_COHORT_MODEL } from '@/src/server/infrastructure/ai/modelRegistry';
import { CreationFailure } from '@/src/server/domain/cohort-creation/errors';
import {
  retainedVideoObservationSchema,
  singleYoutubeVideo,
  type RetainedVideoObservation,
  type VideoObservationModel,
  YOUTUBE_VIDEO_LIMITS,
} from '@/src/shared/cohort-builder/youtube-video-observation';
import type { CohortSource, sourceInputSchema } from '@/src/shared/cohort-builder/contracts';
import { readTextArtifact, type TextArtifactSql } from './text-artifacts';

export type CohortSourceInput = z.infer<typeof sourceInputSchema>;

export interface VideoObservationProvider {
  observeVideo(metadata: YoutubeVideoMetadata, signal: AbortSignal): Promise<RetainedVideoObservation>;
}

export interface VideoObservationProviderOptions {
  observer?: MaterialObservation;
  reader?: Pick<YoutubeMetadataReader, 'read'>;
  model?: LanguageModel;
  beforeCall?: (unitId: string) => Promise<void | ((settlement?: {
    actualUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; stepsCount?: number };
    error?: unknown;
  }) => Promise<void>)>;
}

export class LiveVideoObservationProvider implements VideoObservationProvider {
  private _observer?: MaterialObservation;
  private readonly hasCustomObserver: boolean;
  private readonly reader: Pick<YoutubeMetadataReader, 'read'>;
  private readonly model?: LanguageModel;
  private readonly beforeCall?: VideoObservationProviderOptions['beforeCall'];

  constructor(options?: VideoObservationProviderOptions) {
    this._observer = options?.observer;
    this.hasCustomObserver = Boolean(options?.observer);
    this.reader = options?.reader ?? new YoutubeMetadataReader();
    this.model = options?.model;
    this.beforeCall = options?.beforeCall;
  }

  get observer(): MaterialObservation {
    if (!this._observer) {
      const model = this.model ?? createCohortModel();
      this._observer = new VercelMaterialObservation(model, {
        beforeCall: this.beforeCall ?? (async () => {}),
      });
    }
    return this._observer;
  }

  async observeVideo(metadata: YoutubeVideoMetadata, signal: AbortSignal): Promise<RetainedVideoObservation> {
    signal.throwIfAborted();
    const videoUrl = metadata.url;
    const parsedUrl = singleYoutubeVideo(videoUrl);

    // Fail closed: must fetch and verify trusted metadata from reader; no synthetic fallback
    const fetched = await this.reader.read(videoUrl, signal);
    signal.throwIfAborted();

    const unit = fetched.units.find(u => u.videoId === parsedUrl.videoId);
    if (!unit) {
      throw new Error('VIDEO_NOT_FOUND');
    }
    const validVideo = youtubeVideoMetadataSchema.parse(unit);

    if (validVideo.durationSeconds > YOUTUBE_VIDEO_LIMITS.durationSeconds) {
      throw new Error('VIDEO_DURATION_LIMIT_EXCEEDED');
    }

    signal.throwIfAborted();
    // Only invoke outer beforeCall when a custom observer was injected;
    // when using the default VercelMaterialObservation, it invokes beforeCall per model attempt directly.
    const release = this.hasCustomObserver ? await this.beforeCall?.(validVideo.videoId) : undefined;
    let settlementError: unknown;
    try {
      const observer = this.observer;
      const proposal = await observer.observeVideo(validVideo, signal);
      signal.throwIfAborted();
      const validatedProposal = validateVideoObservation(proposal, validVideo);

      const modelIdentity = observer.identity ?? {
        provider: 'google',
        modelId: DEFAULT_COHORT_MODEL,
        adapterVersion: 'vercel-video-observation-v3',
      };

      return retainedVideoObservationSchema.parse({
        format: 'youtube-video-observation-v1',
        video: {
          id: validVideo.videoId,
          title: validVideo.title.slice(0, 500),
          durationSeconds: validVideo.durationSeconds,
          url: validVideo.url,
        },
        model: modelIdentity,
        contentOrigin: 'ai',
        observedAt: new Date().toISOString(),
        limitations: validatedProposal.limitations,
        observations: validatedProposal.observations.map(obs => ({
          startSeconds: obs.startSeconds,
          endSeconds: obs.endSeconds,
          text: obs.text,
        })),
      });
    } catch (err) {
      settlementError = err;
      throw err;
    } finally {
      if (release) {
        await release(
          settlementError
            ? { error: settlementError }
            : { actualUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, stepsCount: 1 } }
        ).catch(() => undefined);
      }
    }
  }
}

export interface DefaultVideoObservationProviderHelper {
  (): VideoObservationProvider;
  observeVideo(metadata: YoutubeVideoMetadata, signal: AbortSignal): Promise<RetainedVideoObservation>;
}

export const defaultVideoObservationProvider: DefaultVideoObservationProviderHelper = Object.assign(
  function defaultVideoObservationProvider(): VideoObservationProvider {
    return new LiveVideoObservationProvider();
  },
  {
    observeVideo(metadata: YoutubeVideoMetadata, signal: AbortSignal): Promise<RetainedVideoObservation> {
      return new LiveVideoObservationProvider().observeVideo(metadata, signal);
    },
  }
);

export async function acquireVideoObservation(
  input: CohortSourceInput & { kind: 'youtube' },
  provider?: VideoObservationProvider,
  callerSignal?: AbortSignal
): Promise<{ bytes: Uint8Array; observation: RetainedVideoObservation }> {
  if (callerSignal?.aborted) throw new Error('VIDEO_OBSERVATION_CANCELED');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), YOUTUBE_VIDEO_LIMITS.timeoutMs);
  const signal = AbortSignal.any([controller.signal, ...(callerSignal ? [callerSignal] : [])]);
  let abortListener!: () => void;
  const abortedPromise = new Promise<never>((_, reject) => {
    abortListener = () =>
      reject(new Error(callerSignal?.aborted ? 'VIDEO_OBSERVATION_CANCELED' : 'VIDEO_OBSERVATION_DEADLINE'));
    signal.addEventListener('abort', abortListener, { once: true });
  });

  try {
    const singleVideo = singleYoutubeVideo(input.url);
    const videoMetadata: YoutubeVideoMetadata = {
      videoId: singleVideo.videoId,
      url: singleVideo.url,
      title: singleVideo.videoId,
      description: '',
      channelId: 'channel',
      channelTitle: 'channel',
      durationSeconds: YOUTUBE_VIDEO_LIMITS.durationSeconds,
      etag: 'etag',
      privacy: 'public' as const,
      publishedAt: new Date().toISOString(),
    };

    const effectiveProvider = provider ?? new LiveVideoObservationProvider();
    const work = effectiveProvider.observeVideo(videoMetadata, signal);
    const rawObservation = await Promise.race([work, abortedPromise]);

    if (signal.aborted) {
      throw new Error(callerSignal?.aborted ? 'VIDEO_OBSERVATION_CANCELED' : 'VIDEO_OBSERVATION_DEADLINE');
    }

    const observation = retainedVideoObservationSchema.parse(rawObservation);
    if (observation.video.id !== singleVideo.videoId) {
      throw new Error('FOREIGN_VIDEO_OBSERVATION');
    }

    const bytes = Buffer.from(JSON.stringify(observation), 'utf8');
    if (bytes.byteLength > YOUTUBE_VIDEO_LIMITS.bytes) {
      throw new Error('VIDEO_OBSERVATION_SIZE_LIMIT');
    }

    return { bytes, observation };
  } catch (error) {
    if (callerSignal?.aborted) {
      throw new Error('VIDEO_OBSERVATION_CANCELED');
    }
    if (signal.aborted) {
      throw new Error('VIDEO_OBSERVATION_DEADLINE');
    }
    if (error instanceof CreationFailure) {
      throw new Error(error.detail.code);
    }
    if (error instanceof Error && ((error as any).code === 'BUDGET_EXHAUSTED' || error.message === 'BUDGET_EXHAUSTED')) {
      throw error;
    }
    const code = error instanceof Error ? error.message : '';
    const safe = [
      'VIDEO_OBSERVATION_CANCELED',
      'VIDEO_OBSERVATION_DEADLINE',
      'VIDEO_OBSERVATION_SIZE_LIMIT',
      'VIDEO_OBSERVATION_OUTPUT_LIMIT',
      'VIDEO_OBSERVATION_MALFORMED',
      'VIDEO_OBSERVATION_UNAVAILABLE',
      'VIDEO_DURATION_LIMIT_EXCEEDED',
      'FOREIGN_VIDEO_OBSERVATION',
      'INVALID_YOUTUBE_VIDEO_URL',
      'VIDEO_NOT_FOUND',
      'EMPTY_VIDEO_OBSERVATION',
      'AI_INVALID_OUTPUT',
      'AI_UNAVAILABLE',
      'DATA_UNAVAILABLE',
      'RATE_LIMITED',
      'BUDGET_EXHAUSTED',
    ];
    if (safe.includes(code)) {
      throw error;
    }
    if (error instanceof Error && /^[A-Z_]+$/.test(error.message)) {
      throw error;
    }
    throw new Error('VIDEO_OBSERVATION_FAILED');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abortListener);
  }
}

export function extractVideoObservation(
  bytes: Uint8Array,
  input: CohortSourceInput & { kind: 'youtube' }
): {
  text: string;
  locations: NonNullable<CohortSource['locations']>;
  videoId: string;
  videoTitle: string;
  videoDurationMs: number;
  model: VideoObservationModel;
  limitations: string[];
} {
  if (!bytes.length || bytes.length > YOUTUBE_VIDEO_LIMITS.bytes) {
    throw new Error('VIDEO_OBSERVATION_SIZE_LIMIT');
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('VIDEO_OBSERVATION_MALFORMED');
  }
  const parsed = retainedVideoObservationSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new Error('VIDEO_OBSERVATION_MALFORMED');
  }
  const observation = parsed.data;

  const expected = singleYoutubeVideo(input.url);
  if (observation.video.id !== expected.videoId) {
    throw new Error('FOREIGN_VIDEO_OBSERVATION');
  }

  if (!observation.observations.length) {
    throw new Error('EMPTY_VIDEO_OBSERVATION');
  }

  let text = '';
  const locations: NonNullable<CohortSource['locations']> = [];
  for (let index = 0; index < observation.observations.length; index++) {
    const obs = observation.observations[index];
    if (text) text += '\n\n';
    const start = text.length;
    text += obs.text;
    const end = text.length;
    locations.push({
      start,
      end,
      startMs: Math.round(obs.startSeconds * 1000),
      endMs: Math.round(obs.endSeconds * 1000),
      segmentId: `obs-${index}`,
    });
  }

  if (Buffer.byteLength(text, 'utf8') > YOUTUBE_VIDEO_LIMITS.maxExtractedBytes) {
    throw new Error('VIDEO_OBSERVATION_OUTPUT_LIMIT');
  }

  return {
    text,
    locations,
    videoId: observation.video.id,
    videoTitle: observation.video.title,
    videoDurationMs: observation.video.durationSeconds * 1000,
    model: observation.model,
    limitations: observation.limitations,
  };
}

export async function readOwnedVideoObservation(
  sql: TextArtifactSql,
  identity: { workspaceId: string; artifactId: string; sourceId: string; sourceVersion: number; inputFingerprint: string },
  input: CohortSourceInput & { kind: 'youtube' }
) {
  const retained = await readTextArtifact(sql, identity.workspaceId, identity.artifactId);
  if (
    retained.ref.kind !== 'source_raw' ||
    retained.ref.sourceId !== identity.sourceId ||
    retained.ref.sourceVersion !== identity.sourceVersion ||
    retained.ref.inputFingerprint !== identity.inputFingerprint
  ) {
    throw new Error('FOREIGN_VIDEO_OBSERVATION_ARTIFACT');
  }
  return extractVideoObservation(retained.bytes, input);
}
