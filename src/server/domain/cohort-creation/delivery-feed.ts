import { z } from 'zod';
import type { FeedChunkInput } from '@/src/shared/feed/feedEngine.types';
import { PEDAGOGICAL_DIMENSIONS } from '@/src/shared/curriculum/pedagogicalVector.types';
import { computeDeterministicChunkVector } from '@/src/shared/curriculum/pedagogicalVector.engine';

const chunkSchema = z.preprocess(
  raw => {
    if (raw && typeof raw === 'object' && !('id' in raw) && 'chunkId' in raw) {
      return { ...raw, id: (raw as any).chunkId };
    }
    return raw;
  },
  z.object({ id: z.union([z.string().min(1), z.number()]).transform(String), title: z.string().max(2000).optional(),
    order: z.number().int().nonnegative().optional(), duration: z.string().max(100).optional(), durationSeconds: z.number().nonnegative().optional(),
    startSeconds: z.number().nonnegative().optional(), endSeconds: z.number().nonnegative().optional(), text: z.string().max(1024 * 1024).optional(),
    vector: z.union([z.array(z.number().min(0).max(1)).length(12), z.record(z.enum(PEDAGOGICAL_DIMENSIONS), z.number().min(0).max(1))]).optional(),
    isStrictlyLinear: z.boolean().optional(), isKeyConcept: z.boolean().optional(), contentOrigin: z.enum(['user', 'external', 'ai']).optional(),
    durationMethod: z.enum(['source', 'reading_estimate', 'model_estimate']).optional(),
    coverage: z.object({ limitations: z.array(z.string().max(2000)).max(100) }).optional() }).passthrough()
);
type Lesson = { id: string; title: string; videoId: string | null; lessonType: string; thumbnailUrl: string | null; order: number;
  seasonId: string; chunks: unknown; season: { order: number; title: string; cohortId: string; cohort: { title: string; coverImage: string | null }; _count?: { lessons: number }; lessons?: unknown[] } };
export type DeliveryRejection = { lessonId: string; cohortId: string;
  reason: 'INVALID_CHUNKS' | 'UNSUPPORTED_LESSON_TYPE' | 'DUPLICATE_CHUNKS' | 'INVALID_TIMING' | 'MISSING_TEXT' | 'MISSING_VIDEO' };
function seconds(duration: string | undefined) {
  if (!duration) return 180;
  const matches = [...duration.matchAll(/(\d+(?:\.\d+)?)\s*([hms])/giu)];
  return matches.length ? matches.reduce((sum, match) => sum + Number(match[1]) * (match[2].toLowerCase() === 'h' ? 3600 : match[2].toLowerCase() === 'm' ? 60 : 1), 0) : 180;
}
/** Caller must authorize published SQL lessons first. Invalid delivery data is never fabricated. */
export function deliveryFeedChunks(lessons: Lesson[], onRejected?: (failure: DeliveryRejection) => void): FeedChunkInput[] {
  const isZeroIndexed = lessons.some(l => l.order === 0);
  return lessons.flatMap(lesson => {
    const reject = (reason: DeliveryRejection['reason']): FeedChunkInput[] => {
      onRejected?.({ lessonId: lesson.id, cohortId: lesson.season.cohortId, reason }); return [];
    };
    if (!Array.isArray(lesson.chunks) || !lesson.chunks.length) return reject('INVALID_CHUNKS');
    const parsed = lesson.chunks.map(value => chunkSchema.safeParse(value));
    if (parsed.some(value => !value.success)) return reject('INVALID_CHUNKS');
    const chunks = parsed.flatMap(value => value.success ? [value.data] : []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!['VIDEO', 'ARTICLE', 'ASSIGNMENT'].includes(lesson.lessonType)) return reject('UNSUPPORTED_LESSON_TYPE');
    if (new Set(chunks.map(chunk => chunk.id)).size !== chunks.length) return reject('DUPLICATE_CHUNKS');
    if (chunks.some(chunk => chunk.startSeconds !== undefined && chunk.endSeconds !== undefined && chunk.endSeconds < chunk.startSeconds)) return reject('INVALID_TIMING');
    const reading = lesson.lessonType !== 'VIDEO';
    if (reading && chunks.some(chunk => !chunk.text?.trim())) return reject('MISSING_TEXT');
    if (!reading && !lesson.videoId) return reject('MISSING_VIDEO');
    let offset = 0;
    const projected = chunks.map((chunk, index) => {
      const duration = chunk.durationSeconds ?? seconds(chunk.duration); const start = chunk.startSeconds ?? offset; const end = chunk.endSeconds ?? start + duration; offset = end;
      const vector = chunk.vector;
      const actualDurationSec = Math.max(30, end - start || duration || 180);
      const fallbackScored = !vector || chunk.isStrictlyLinear === undefined
        ? computeDeterministicChunkVector(chunk.text || `${lesson.title} ${chunk.title || ''}`, {
            title: `${lesson.title} ${chunk.title || ''}`,
            durationSeconds: actualDurationSec,
            chunkIndex: chunk.order ?? index,
            totalChunks: chunks.length,
            lessonIndex: lesson.order,
          })
        : undefined;
      const resolvedVector = Array.isArray(vector)
        ? vector
        : vector
        ? PEDAGOGICAL_DIMENSIONS.map(key => vector[key])
        : fallbackScored?.vector;
      return { chunkId: chunk.id, chunkTitle: chunk.title ?? lesson.title, chunkOrder: chunk.order ?? index,
        chunkDuration: chunk.duration ?? `${actualDurationSec}s`, startSeconds: start, endSeconds: end,
        lessonId: lesson.id, lessonTitle: lesson.title, lessonVideoId: lesson.videoId ?? undefined, lessonThumbnail: lesson.thumbnailUrl ?? '',
        lessonOrder: typeof lesson.order === 'number' ? (isZeroIndexed ? lesson.order + 1 : (lesson.order || 1)) : 1, lessonType: reading ? lesson.lessonType === 'ASSIGNMENT' ? 'assignment' : 'reading' : 'video',
        seasonId: lesson.seasonId, seasonTitle: lesson.season.title, seasonOrder: lesson.season.order,
        cohortId: lesson.season.cohortId, cohortTitle: lesson.season.cohort.title, cohortCoverImage: lesson.season.cohort.coverImage ?? '', cohortProvider: '',
        totalChunksInLesson: chunks.length,
        totalLessonsInSeason: lesson.season._count?.lessons ?? lesson.season.lessons?.length ?? 1,
        totalVideos: lesson.season._count?.lessons ?? lesson.season.lessons?.length ?? 1,
        isStrictlyLinear: chunk.isStrictlyLinear ?? fallbackScored?.isStrictlyLinear,
        chunkVector: resolvedVector,
        ...(chunk.text ? { content: { text: chunk.text, contentOrigin: chunk.contentOrigin, limitations: chunk.coverage?.limitations ?? [], durationMethod: chunk.durationMethod } } : {}) };
    });
    return projected.some(chunk => !Number.isFinite(chunk.startSeconds) || !Number.isFinite(chunk.endSeconds) || chunk.endSeconds < chunk.startSeconds)
      ? reject('INVALID_TIMING') : projected;
  });
}
