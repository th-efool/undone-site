import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import {
  ChunkProgressService,
  type ChunkStatus,
  type UpdateChunkProgressInput,
} from '@/src/server/domain/progress/chunkProgress.service';

interface CleanedBatchItem {
  chunkId: string;
  lessonId: string;
  cohortId: string;
  watchedSeconds: number;
  totalSeconds: number;
  forceStatus?: ChunkStatus;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) ?? {};

    // 100% backwards compatibility for single chunk update
    if (body.chunkId !== undefined && body.chunkId !== null) {
      const {
        chunkId,
        lessonId,
        cohortId,
        watchedSeconds,
        totalSeconds,
        forceStatus,
      } = body;

      const cleanChunkId = typeof chunkId === 'string' ? chunkId.trim() : '';
      const cleanLessonId = typeof lessonId === 'string' ? lessonId.trim() : '';
      const cleanCohortId = typeof cohortId === 'string' ? cohortId.trim() : '';

      if (!cleanChunkId || !cleanLessonId || !cleanCohortId) {
        return NextResponse.json({ error: 'Missing required chunk identifiers' }, { status: 400 });
      }

      const lesson = await prisma.lesson.findFirst({
        where: {
          id: cleanLessonId,
          season: { cohortId: cleanCohortId, cohort: accessibleCohortWhere(userId) },
        },
        select: { chunks: true },
      });

      const chunkExists =
        lesson &&
        Array.isArray(lesson.chunks) &&
        lesson.chunks.some(
          (chunk) =>
            chunk !== null &&
            typeof chunk === 'object' &&
            !Array.isArray(chunk) &&
            chunk.id === cleanChunkId
        );

      if (!chunkExists) return NextResponse.json({ error: 'Chunk not found' }, { status: 404 });

      const progress = await ChunkProgressService.recordProgress({
        userId,
        chunkId: cleanChunkId,
        lessonId: cleanLessonId,
        cohortId: cleanCohortId,
        watchedSeconds:
          typeof watchedSeconds === 'number' && !isNaN(watchedSeconds)
            ? Math.max(0, watchedSeconds)
            : Number(watchedSeconds) || 0,
        totalSeconds:
          typeof totalSeconds === 'number' && !isNaN(totalSeconds) && totalSeconds > 0
            ? totalSeconds
            : Number(totalSeconds) || 180,
        forceStatus,
      });

      return NextResponse.json({ success: true, progress });
    }

    // Batch chunk update support
    const rawBatch = Array.isArray(body.batch)
      ? body.batch
      : Array.isArray(body.updates)
      ? body.updates
      : null;

    if (rawBatch !== null) {
      const hasInvalidItem = rawBatch.some((item: any) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return true;
        const cId = typeof item.chunkId === 'string' ? item.chunkId.trim() : '';
        const lId = typeof item.lessonId === 'string' ? item.lessonId.trim() : '';
        const coId = typeof item.cohortId === 'string' ? item.cohortId.trim() : '';
        return !cId || !lId || !coId;
      });

      if (hasInvalidItem) {
        return NextResponse.json(
          { error: 'Missing required chunk identifiers in batch' },
          { status: 400 }
        );
      }

      const cleanedItems: CleanedBatchItem[] = rawBatch.map((item: any) => ({
        chunkId: (item.chunkId as string).trim(),
        lessonId: (item.lessonId as string).trim(),
        cohortId: (item.cohortId as string).trim(),
        watchedSeconds:
          typeof item.watchedSeconds === 'number' && !isNaN(item.watchedSeconds)
            ? Math.max(0, item.watchedSeconds)
            : Number(item.watchedSeconds) || 0,
        totalSeconds:
          typeof item.totalSeconds === 'number' && !isNaN(item.totalSeconds) && item.totalSeconds > 0
            ? item.totalSeconds
            : Number(item.totalSeconds) || 180,
        forceStatus: item.forceStatus,
      }));

      const lessonIds: string[] = Array.from(new Set<string>(cleanedItems.map((i: CleanedBatchItem) => i.lessonId)));
      const cohortIds: string[] = Array.from(new Set<string>(cleanedItems.map((i: CleanedBatchItem) => i.cohortId)));

      const lessons = await prisma.lesson.findMany({
        where: {
          id: { in: lessonIds },
          season: {
            cohortId: { in: cohortIds },
            cohort: accessibleCohortWhere(userId),
          },
        },
        select: {
          id: true,
          chunks: true,
          season: {
            select: { cohortId: true },
          },
        },
      });

      const validLessonChunkSet = new Set<string>();
      for (const lesson of lessons) {
        const cohortId = lesson.season?.cohortId;
        if (!cohortId || !Array.isArray(lesson.chunks)) continue;
        for (const chunk of lesson.chunks) {
          if (
            chunk !== null &&
            typeof chunk === 'object' &&
            !Array.isArray(chunk) &&
            typeof (chunk as any).id === 'string'
          ) {
            validLessonChunkSet.add(`${cohortId}:${lesson.id}:${(chunk as any).id}`);
          }
        }
      }

      const validInputs: UpdateChunkProgressInput[] = cleanedItems
        .filter((item: CleanedBatchItem) => validLessonChunkSet.has(`${item.cohortId}:${item.lessonId}:${item.chunkId}`))
        .map((item: CleanedBatchItem) => ({
          userId,
          chunkId: item.chunkId,
          lessonId: item.lessonId,
          cohortId: item.cohortId,
          watchedSeconds: item.watchedSeconds,
          totalSeconds: item.totalSeconds,
          forceStatus: item.forceStatus,
        }));

      const result = await ChunkProgressService.recordProgressBatch(validInputs);

      return NextResponse.json({
        success: true,
        count: result.count,
        completed: result.completedIds,
      });
    }

    return NextResponse.json({ error: 'Missing required chunk identifiers' }, { status: 400 });
  } catch (error) {
    console.error('[API Chunk Progress Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
