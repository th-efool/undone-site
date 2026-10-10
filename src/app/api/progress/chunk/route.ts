import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { ChunkProgressService } from '@/src/server/domain/progress/chunkProgress.service';

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) ?? {};
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

    const lesson = await prisma.lesson.findFirst({ where: { id: cleanLessonId,
      season: { cohortId: cleanCohortId, cohort: accessibleCohortWhere(userId) } }, select: { chunks: true } });
    const chunkExists = lesson && Array.isArray(lesson.chunks) && lesson.chunks.some(chunk =>
      chunk !== null && typeof chunk === 'object' && !Array.isArray(chunk) && chunk.id === cleanChunkId);
    if (!chunkExists) return NextResponse.json({ error: 'Chunk not found' }, { status: 404 });
    const progress = await ChunkProgressService.recordProgress({
      userId,
      chunkId: cleanChunkId,
      lessonId: cleanLessonId,
      cohortId: cleanCohortId,
      watchedSeconds: typeof watchedSeconds === 'number' && !isNaN(watchedSeconds) ? Math.max(0, watchedSeconds) : Number(watchedSeconds) || 0,
      totalSeconds: typeof totalSeconds === 'number' && !isNaN(totalSeconds) && totalSeconds > 0 ? totalSeconds : Number(totalSeconds) || 180,
      forceStatus,
    });

    return NextResponse.json({ success: true, progress });
  } catch (error) {
    console.error('[API Chunk Progress Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
