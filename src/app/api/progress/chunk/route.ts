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

    const body = await req.json();
    const {
      chunkId,
      lessonId,
      cohortId,
      watchedSeconds,
      totalSeconds,
      forceStatus,
    } = body;

    if (!chunkId || !lessonId || !cohortId) {
      return NextResponse.json({ error: 'Missing required chunk identifiers' }, { status: 400 });
    }

    const progress = await ChunkProgressService.recordProgress({
      userId,
      chunkId,
      lessonId,
      cohortId,
      watchedSeconds: Number(watchedSeconds) || 0,
      totalSeconds: Number(totalSeconds) || 180,
      forceStatus,
    });

    return NextResponse.json({ success: true, progress });
  } catch (error: any) {
    console.error('[API Chunk Progress Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
