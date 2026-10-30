import { z } from 'zod';
import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import {
  ChunkProgressService,
  ProgressStorageError,
  type ChunkStatus,
  type UpdateChunkProgressInput,
} from '@/src/server/domain/progress/chunkProgress.service';

const idSchema = z.union([z.string(), z.number()])
  .transform(val => String(val).trim())
  .refine(val => val.length >= 1 && val.length <= 128, {
    message: 'Identifier must be between 1 and 128 characters',
  });

const chunkStatusSchema = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']);

const watchedSecondsSchema = z.number().refine(n => Number.isFinite(n) && n >= 0, {
  message: 'watchedSeconds must be a finite non-negative number',
});

const totalSecondsSchema = z.number().refine(n => Number.isFinite(n) && n > 0, {
  message: 'totalSeconds must be a finite positive number',
});

const singleItemSchema = z.object({
  chunkId: idSchema.optional(),
  id: idSchema.optional(),
  lessonId: idSchema,
  cohortId: idSchema,
  watchedSeconds: watchedSecondsSchema,
  totalSeconds: totalSecondsSchema,
  forceStatus: chunkStatusSchema.optional(),
}).refine(data => !!(data.chunkId || data.id), {
  message: 'chunkId or id is required',
}).transform(data => ({
  chunkId: (data.chunkId ?? data.id)!,
  lessonId: data.lessonId,
  cohortId: data.cohortId,
  watchedSeconds: data.watchedSeconds,
  totalSeconds: data.totalSeconds,
  forceStatus: data.forceStatus as ChunkStatus | undefined,
}));

const batchPayloadSchema = z.object({
  batch: z.array(singleItemSchema).max(200).optional(),
  updates: z.array(singleItemSchema).max(200).optional(),
}).refine(data => data.batch !== undefined || data.updates !== undefined, {
  message: 'batch or updates array is required',
}).transform(data => (data.batch ?? data.updates)!);

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Missing required chunk identifiers' }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;

    // 1. Single chunk update branch
    if ((raw.chunkId !== undefined || raw.id !== undefined) && raw.batch === undefined && raw.updates === undefined) {
      const parsed = singleItemSchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Missing required chunk identifiers', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const item = parsed.data;

      const lesson = await prisma.lesson.findFirst({
        where: {
          id: item.lessonId,
          season: { cohortId: item.cohortId, cohort: accessibleCohortWhere(userId) },
        },
        select: { chunks: true },
      });

      const chunkExists =
        lesson &&
        Array.isArray(lesson.chunks) &&
        lesson.chunks.some((chunk: unknown) => {
          if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) return false;
          const c = chunk as Record<string, unknown>;
          const cid =
            c.id !== undefined && c.id !== null
              ? String(c.id).trim()
              : c.chunkId !== undefined && c.chunkId !== null
              ? String(c.chunkId).trim()
              : '';
          return cid === item.chunkId;
        });

      if (!chunkExists) {
        return NextResponse.json({ error: 'Chunk not found' }, { status: 404 });
      }

      const progress = await ChunkProgressService.recordProgress({
        userId,
        chunkId: item.chunkId,
        lessonId: item.lessonId,
        cohortId: item.cohortId,
        watchedSeconds: item.watchedSeconds,
        totalSeconds: item.totalSeconds,
        forceStatus: item.forceStatus,
      });

      return NextResponse.json({ success: true, progress });
    }

    // 2. Batch chunk update branch
    if (raw.batch !== undefined || raw.updates !== undefined) {
      const parsed = batchPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Missing required chunk identifiers in batch', details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const items = parsed.data;

      if (items.length === 0) {
        const result = await ChunkProgressService.recordProgressBatch([]);
        return NextResponse.json({
          success: true,
          count: result.count,
          completed: result.completedIds,
        });
      }

      const lessonIds = Array.from(new Set(items.map(i => i.lessonId)));
      const cohortIds = Array.from(new Set(items.map(i => i.cohortId)));

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
        for (const chunk of lesson.chunks as Array<Record<string, unknown>>) {
          if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) continue;
          const cid =
            chunk.id !== undefined && chunk.id !== null
              ? String(chunk.id).trim()
              : chunk.chunkId !== undefined && chunk.chunkId !== null
              ? String(chunk.chunkId).trim()
              : '';
          if (cid) {
            validLessonChunkSet.add(`${cohortId}:${lesson.id}:${cid}`);
          }
        }
      }

      // Reject entire batch if any chunk is missing or inaccessible
      const missingItem = items.find(
        item => !validLessonChunkSet.has(`${item.cohortId}:${item.lessonId}:${item.chunkId}`)
      );
      if (missingItem) {
        return NextResponse.json({ error: 'Chunk not found or inaccessible' }, { status: 404 });
      }

      const validInputs: UpdateChunkProgressInput[] = items.map(item => ({
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
    if (error instanceof ProgressStorageError) {
      return NextResponse.json(
        { error: 'Progress could not be saved. Please retry.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    console.error('[API Chunk Progress Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
