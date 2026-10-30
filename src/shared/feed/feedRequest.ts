import { z } from 'zod';
import type { FeedItem } from './feedEngine.types';

export const feedChannelSchema = z.enum([
  'default',
  'spark',
  'explore',
  'build',
  'listen',
  'deep_dive',
  'quick',
]);

export const MAX_FEED_BODY_BYTES = 1024 * 1024; // 1 MiB
export const MAX_FEED_EXCLUSIONS = 5000;

export const feedRequestSchema = z.object({
  channel: feedChannelSchema.default('default'),
  limit: z.number().int().min(1).max(20).default(5),
  excludeChunkIds: z
    .array(z.string().min(1).max(128))
    .max(MAX_FEED_EXCLUSIONS, 'Exclusion IDs list exceeds maximum of 5000 items')
    .default([]),
  cohort: z.string().min(1).max(128).optional(),
  lesson: z.string().min(1).max(128).optional(),
  chunk: z.string().min(1).max(128).optional(),
  q: z.string().max(200).optional(),
  prefs: z.record(z.string(), z.string()).optional(),
  timezoneOffset: z.number().min(-840).max(840).default(0),
});

export type FeedRequest = z.infer<typeof feedRequestSchema>;

export type FeedResponse = {
  items: FeedItem[];
  hasMore: boolean;
  delivery?: { unavailableLessons: number };
};
