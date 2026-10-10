import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { generateFeed } from '@/src/shared/feed/feedEngine';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { deliveryFeedChunks } from '@/src/server/domain/cohort-creation/delivery-feed';
import type { ChannelId } from '@/src/shared/curriculum/pedagogicalVector.types';
import { ChunkProgressService } from '@/src/server/domain/progress/chunkProgress.service';
import type { ChunkProgress } from '@/src/shared/feed/feedEngine.types';

export async function GET(request: NextRequest) {
  try {
    const session = await auth(); const userId = session?.user?.id ?? null;
    const params = request.nextUrl.searchParams; const rawChannel = params.get('channel');
    const channels: ChannelId[] = ['default', 'spark', 'explore', 'build', 'listen', 'deep_dive', 'quick'];
    const channel = channels.includes(rawChannel as ChannelId) ? rawChannel as ChannelId : 'default';
    const page = Number(params.get('pageIndex') ?? 0); const limit = Number(params.get('limit') ?? 5);
    if (!Number.isInteger(page) || page < 0 || page > 100 || !Number.isInteger(limit) || limit < 1 || limit > 20) {
      return NextResponse.json({ error: 'Invalid feed page.' }, { status: 400 });
    }
    const timezoneOffset = Number(params.get('timezoneOffset') ?? 0);
    if (!Number.isFinite(timezoneOffset) || Math.abs(timezoneOffset) > 840) {
      return NextResponse.json({ error: 'Invalid timezone offset.' }, { status: 400 });
    }
    const cohortId = params.get('cohort'); const lessonId = params.get('lesson'); const chunkId = params.get('chunk');
    if ([cohortId, lessonId, chunkId].some(id => id !== null && (!id.length || id.length > 128))) {
      return NextResponse.json({ error: 'Invalid lesson selection.' }, { status: 400 });
    }
    // One fail-closed query: empty memberships and storage failures cannot expose private cohorts.
    const lessons = await prisma.lesson.findMany({ where: { isPublished: true, chunks: { not: Prisma.AnyNull },
      ...(lessonId ? { id: lessonId } : {}), season: { ...(cohortId ? { cohortId } : {}),
        cohort: { is: { AND: [{ isPublished: true }, accessibleCohortWhere(userId)] } } } },
      include: { season: { include: { cohort: true } } }, orderBy: [{ season: { order: 'asc' } }, { order: 'asc' }, { id: 'asc' }], take: 100 });
    const chunks = deliveryFeedChunks(lessons);
    if (chunkId && !chunks.some(chunk => chunk.chunkId === chunkId)) {
      return NextResponse.json({ error: 'Chunk not found.' }, { status: 404 });
    }
    const progress = userId && chunks.length ? await ChunkProgressService.getUserProgressMap(userId, chunks.map(chunk => chunk.chunkId)) : new Map();
    const chunkProgress: Record<string, ChunkProgress> = {};
    for (const chunk of chunks) {
      const saved = progress.get(chunk.chunkId);
      if (saved && saved.cohortId === chunk.cohortId && saved.lessonId === chunk.lessonId) chunkProgress[chunk.chunkId] = { chunkId: chunk.chunkId,
        lessonId: chunk.lessonId, cohortId: chunk.cohortId, status: saved.status === 'COMPLETED' ? 'completed' : saved.status === 'SKIPPED' ? 'skipped' : 'in-progress',
        watchedSeconds: saved.watchedSeconds, totalSeconds: saved.totalSeconds };
    }
    const candidates = chunkId ? chunks : chunks.filter(chunk => chunkProgress[chunk.chunkId]?.status !== 'completed');
    const output = generateFeed({ allChunks: candidates, chunkProgress, cohortStates: [], currentTime: new Date(Date.now() - timezoneOffset * 60_000),
      dailyGoalMinutes: 30, completedTodayMinutes: 0, feedSize: (page + 1) * limit, activeChannel: channel,
      requestedCohortId: cohortId ?? undefined, requestedLessonId: lessonId ?? undefined, requestedChunkId: chunkId ?? undefined });
    return NextResponse.json({ items: output.items.slice(page * limit, (page + 1) * limit) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Feed is unavailable. Try again.' }, { status: 503 });
  }
}
