import { z } from 'zod';
import { youtubeVideoUrlSchema, singleYoutubeVideo } from './youtube-transcript';

export { singleYoutubeVideo, youtubeVideoUrlSchema };

export const VIDEO_OBSERVATION_PARSER_VERSION = 'video-observation-v1';

export const videoObservationModelSchema = z.strictObject({
  provider: z.string().min(1).max(256),
  modelId: z.string().min(1).max(256),
  adapterVersion: z.string().min(1).max(128),
});
export type VideoObservationModel = z.infer<typeof videoObservationModelSchema>;

export const videoObservationIntervalSchema = z.strictObject({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  text: z.string().trim().min(1).max(10_000),
});
export type VideoObservationInterval = z.infer<typeof videoObservationIntervalSchema>;

export const retainedVideoObservationSchema = z.strictObject({
  format: z.literal('youtube-video-observation-v1'),
  video: z.strictObject({
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(500),
    durationSeconds: z.number().int().positive().max(43_200),
    url: youtubeVideoUrlSchema,
  }),
  model: videoObservationModelSchema,
  contentOrigin: z.literal('ai'),
  observedAt: z.string().datetime(),
  limitations: z.array(z.string().trim().min(1).max(1000)).max(20),
  observations: z.array(videoObservationIntervalSchema).max(200),
});
export type RetainedVideoObservation = z.infer<typeof retainedVideoObservationSchema>;

export const YOUTUBE_VIDEO_LIMITS = {
  bytes: 1024 * 1024,
  durationSeconds: 43_200, // 12 hours maximum
  maxObservations: 200,
  maxExtractedBytes: 200_000,
  timeoutMs: 150_000,
} as const;
