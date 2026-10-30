import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { Prisma } from '@/generated/prisma/client';
import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import {
  deliveryFeedChunks,
  type DeliveryRejection,
} from '@/src/server/domain/cohort-creation/delivery-feed';
import type { FeedChunkInput } from '@/src/shared/feed/feedEngine.types';
import crypto from 'crypto';

export interface FeedCatalogQueryOptions {
  userId?: string | null;
  cohortId?: string | null;
  lessonId?: string | null;
}

export interface FeedCatalogResult {
  chunks: FeedChunkInput[];
  rejected: DeliveryRejection[];
  totalLessons: number;
  vectorCacheKey: string;
}

export async function loadAuthorizedFeedCatalog(
  options: FeedCatalogQueryOptions
): Promise<FeedCatalogResult> {
  const { userId, cohortId, lessonId } = options;

  const authorizedWhere: Prisma.LessonWhereInput = {
    isPublished: true,
    chunks: { not: Prisma.AnyNull },
    ...(lessonId ? { id: lessonId } : {}),
    season: {
      ...(cohortId ? { cohortId } : {}),
      cohort: {
        is: {
          AND: [
            { isPublished: true },
            userId ? accessibleCohortWhere(userId) : { isPublished: true, visibility: 'PUBLIC' },
          ],
        },
      },
    },
  };

  const lessonSelect = {
    id: true,
    title: true,
    thumbnailUrl: true,
    videoId: true,
    lessonType: true,
    order: true,
    seasonId: true,
    chunks: true,
    season: {
      select: {
        order: true,
        title: true,
        cohortId: true,
        cohort: {
          select: {
            title: true,
            coverImage: true,
            creator: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    },
  } as const;

  const allLessons: Parameters<typeof deliveryFeedChunks>[0] = [];
  let cursor: string | undefined;
  const seenCursors = new Set<string>();

  for (;;) {
    const batch = await prisma.lesson.findMany({
      where: authorizedWhere,
      select: lessonSelect,
      orderBy: { id: 'asc' },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (!batch.length) break;

    allLessons.push(...batch);

    if (batch.length < 100) break;

    const nextCursor = batch[batch.length - 1].id;
    if (seenCursors.has(nextCursor)) {
      throw new Error('Catalog cursor loop detected');
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  const rejected: DeliveryRejection[] = [];
  const chunks = deliveryFeedChunks(allLessons, (failure) => rejected.push(failure));

  const sortedChunkIds = chunks.map((c) => c.chunkId).sort();
  const sha = crypto.createHash('sha256').update(sortedChunkIds.join(',')).digest('hex');
  const vectorCacheKey = `v2:${sha}`;

  return {
    chunks,
    rejected,
    totalLessons: allLessons.length,
    vectorCacheKey,
  };
}
