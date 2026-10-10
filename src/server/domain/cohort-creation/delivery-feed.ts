import { z } from 'zod';
import type { FeedChunkInput } from '@/src/shared/feed/feedEngine.types';
import { PEDAGOGICAL_DIMENSIONS } from '@/src/shared/curriculum/pedagogicalVector.types';

const chunkSchema = z.object({ id: z.union([z.string().min(1), z.number()]).transform(String), title: z.string().max(2000).optional(),
  order: z.number().int().nonnegative().optional(), duration: z.string().max(100).optional(), durationSeconds: z.number().nonnegative().optional(),
  startSeconds: z.number().nonnegative().optional(), endSeconds: z.number().nonnegative().optional(), text: z.string().max(1024 * 1024).optional(),
  vector: z.union([z.array(z.number().min(0).max(1)).length(12), z.record(z.enum(PEDAGOGICAL_DIMENSIONS), z.number().min(0).max(1))]).optional(),
  isStrictlyLinear: z.boolean().optional(), contentOrigin: z.enum(['user', 'external', 'ai']).optional(),
  durationMethod: z.enum(['source', 'reading_estimate', 'model_estimate']).optional(),
  coverage: z.object({ limitations: z.array(z.string().max(2000)).max(100) }).optional() });
type Lesson = { id: string; title: string; videoId: string | null; lessonType: string; thumbnailUrl: string | null; order: number;
  seasonId: string; chunks: unknown; season: { order: number; title: string; cohortId: string; cohort: { title: string; coverImage: string | null } } };
function seconds(duration: string | undefined) {
  if (!duration) return 180;
  const matches = [...duration.matchAll(/(\d+(?:\.\d+)?)\s*([hms])/giu)];
  return matches.length ? matches.reduce((sum, match) => sum + Number(match[1]) * (match[2].toLowerCase() === 'h' ? 3600 : match[2].toLowerCase() === 'm' ? 60 : 1), 0) : 180;
}
/** Caller must authorize published SQL lessons first. Invalid delivery data is never fabricated. */
export function deliveryFeedChunks(lessons: Lesson[]): FeedChunkInput[] {
  return lessons.flatMap(lesson => {
    if (!Array.isArray(lesson.chunks)) return [];
    const parsed = lesson.chunks.map(value => chunkSchema.safeParse(value));
    if (parsed.some(value => !value.success)) return [];
    const chunks = parsed.flatMap(value => value.success ? [value.data] : []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!['VIDEO', 'ARTICLE', 'ASSIGNMENT'].includes(lesson.lessonType) || new Set(chunks.map(chunk => chunk.id)).size !== chunks.length ||
      chunks.some(chunk => chunk.startSeconds !== undefined && chunk.endSeconds !== undefined && chunk.endSeconds < chunk.startSeconds)) return [];
    const reading = lesson.lessonType !== 'VIDEO';
    if (reading ? chunks.some(chunk => !chunk.text?.trim()) : !lesson.videoId) return [];
    let offset = 0;
    const projected = chunks.map((chunk, index) => {
      const duration = chunk.durationSeconds ?? seconds(chunk.duration); const start = chunk.startSeconds ?? offset; const end = chunk.endSeconds ?? start + duration; offset = end;
      const vector = chunk.vector;
      return { chunkId: chunk.id, chunkTitle: chunk.title ?? lesson.title, chunkOrder: chunk.order ?? index,
        chunkDuration: chunk.duration ?? `${duration}s`, startSeconds: start, endSeconds: end,
        lessonId: lesson.id, lessonTitle: lesson.title, lessonVideoId: lesson.videoId ?? undefined, lessonThumbnail: lesson.thumbnailUrl ?? '',
        lessonOrder: lesson.order, lessonType: reading ? lesson.lessonType === 'ASSIGNMENT' ? 'assignment' : 'reading' : 'video',
        seasonId: lesson.seasonId, seasonTitle: lesson.season.title, seasonOrder: lesson.season.order,
        cohortId: lesson.season.cohortId, cohortTitle: lesson.season.cohort.title, cohortCoverImage: lesson.season.cohort.coverImage ?? '', cohortProvider: '',
        totalChunksInLesson: chunks.length, isStrictlyLinear: chunk.isStrictlyLinear,
        chunkVector: Array.isArray(vector) ? vector : vector ? PEDAGOGICAL_DIMENSIONS.map(key => vector[key]) : undefined,
        ...(chunk.text ? { content: { text: chunk.text, contentOrigin: chunk.contentOrigin, limitations: chunk.coverage?.limitations ?? [], durationMethod: chunk.durationMethod } } : {}) };
    });
    return projected.some(chunk => chunk.endSeconds < chunk.startSeconds) ? [] : projected;
  });
}
