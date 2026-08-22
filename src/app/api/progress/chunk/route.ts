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
  } catch (error: any) {
    console.error('[API Chunk Progress Error]:', error);
    const errorMessage = error instanceof Error ? error.message : (typeof error?.message === 'string' ? error.message : 'Internal Server Error');
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
