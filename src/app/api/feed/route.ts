import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { generateFeed } from '@/src/shared/feed/feedEngine';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { deliveryFeedChunks, type DeliveryRejection } from '@/src/server/domain/cohort-creation/delivery-feed';
import type { ChannelId } from '@/src/shared/curriculum/pedagogicalVector.types';
import { ChunkProgressService } from '@/src/server/domain/progress/chunkProgress.service';
import type { ChunkProgress, CohortLearnerState } from '@/src/shared/feed/feedEngine.types';

function parseChannelPrefs(rawPrefs: string | null, channel: ChannelId): {
  rawStringPrefs: Record<string, string>;
  channelSliderValues: Record<string, number>;
} {
  const rawStringPrefs: Record<string, string> = {};
  const channelSliderValues: Record<string, number> = {};
  if (!rawPrefs) return { rawStringPrefs, channelSliderValues };
  try {
    const parsed = JSON.parse(rawPrefs);
    if (!parsed || typeof parsed !== 'object') return { rawStringPrefs, channelSliderValues };
    const prefix = `${channel}_`;
    for (const [k, v] of Object.entries(parsed)) {
      const strVal = String(v ?? '');
      rawStringPrefs[k] = strVal;
      if (k.startsWith(prefix)) {
        const shortKey = k.slice(prefix.length);
        rawStringPrefs[shortKey] = strVal;
        const num = Number(strVal);
        if (!Number.isNaN(num)) channelSliderValues[shortKey] = num;
      } else {
        const num = Number(strVal);
        if (!Number.isNaN(num)) channelSliderValues[k] = num;
      }
    }
  } catch {
    // Ignore malformed client prefs JSON
  }
  return { rawStringPrefs, channelSliderValues };
}

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
    const searchQuery = params.get('q')?.trim().slice(0, 200) || undefined;
    const { rawStringPrefs, channelSliderValues } = parseChannelPrefs(params.get('prefs'), channel);

    // One fail-closed query: empty memberships and storage failures cannot expose private cohorts.
    const lessons = await prisma.lesson.findMany({ where: { isPublished: true, chunks: { not: Prisma.AnyNull },
      ...(lessonId ? { id: lessonId } : {}), season: { ...(cohortId ? { cohortId } : {}),
        cohort: { is: { AND: [{ isPublished: true }, accessibleCohortWhere(userId)] } } } },
      include: { season: { include: { cohort: true, _count: { select: { lessons: true } } } } }, orderBy: [{ season: { order: 'asc' } }, { order: 'asc' }, { id: 'asc' }], take: 100 });
    const rejected: DeliveryRejection[] = [];
    const chunks = deliveryFeedChunks(lessons, failure => rejected.push(failure));
    if (rejected.length) console.warn('[feed] Unavailable retained deliveries', rejected);
    if (rejected.length && !chunks.length) {
      return NextResponse.json({ error: 'Saved learning content is unavailable. Try again later.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
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

    let cohortStates: CohortLearnerState[] = [];
    const cohortVectorMap: Record<string, { fullVector: number[]; isStrictlyLinear: boolean }> = {};
    const chunkVectorMap: Record<string, number[]> = {};

    if (chunks.length > 0 && process.env.MONGODB_URI && process.env.NODE_ENV !== 'test') {
      try {
        const { connectToMongoDB } = await import('@/src/server/infrastructure/db/mongodb/client');
        await connectToMongoDB();
        const [
          { CohortTranscript },
          { Chunk },
          { UserCohortConfig },
          { UserChannelConfig },
        ] = await Promise.all([
          import('@/src/server/database/mongo/models/CohortTranscript'),
          import('@/src/server/database/mongo/models/Chunk'),
          import('@/src/server/database/mongo/models/UserCohortConfig'),
          import('@/src/server/database/mongo/models/UserChannelConfig'),
        ]);

        const uniqueCohortIds = [...new Set(chunks.map(c => c.cohortId))];
        const allChunkIds = chunks.map(c => c.chunkId);

        const [transcripts, mongoChunks, userCohortConfigs, userChannelDoc] = await Promise.all([
          CohortTranscript.find({ cohortId: { $in: uniqueCohortIds } }).lean().exec(),
          Chunk.find({ chunkId: { $in: allChunkIds } }, { chunkId: 1, vector: 1 }).lean().exec(),
          userId ? UserCohortConfig.find({ userId, isPaused: { $ne: true } }).lean().exec() : Promise.resolve([]),
          userId && !params.get('prefs') ? UserChannelConfig.findOne({ userId }).lean().exec() : Promise.resolve(null),
        ]);

        for (const t of transcripts) {
          if (Array.isArray(t.fullVector) && t.fullVector.length === 12) {
            cohortVectorMap[t.cohortId] = {
              fullVector: t.fullVector,
              isStrictlyLinear: Boolean(t.isStrictlyLinear),
            };
          }
        }

        for (const mc of mongoChunks) {
          if (Array.isArray(mc.vector) && mc.vector.length === 12) {
            chunkVectorMap[mc.chunkId] = mc.vector;
          }
        }

        if (Array.isArray(userCohortConfigs) && userCohortConfigs.length > 0) {
          cohortStates = userCohortConfigs.map((cfg: any, idx: number) => ({
            cohortId: cfg.cohortId,
            subscribedAt: cfg.createdAt ? new Date(cfg.createdAt).toISOString() : new Date().toISOString(),
            lastActiveAt: cfg.updatedAt ? new Date(cfg.updatedAt).toISOString() : new Date().toISOString(),
            dailyGoalMinutes: cfg.dailyGoalMinutes || 20,
            scheduleDays: Array.isArray(cfg.scheduleDays) ? cfg.scheduleDays : ['Mon', 'Wed', 'Fri'],
            priority: (cfg.rank ?? idx) + 1,
          }));
        }

        if (userChannelDoc?.prefs) {
          const rawMap = userChannelDoc.prefs instanceof Map
            ? Object.fromEntries(userChannelDoc.prefs)
            : (userChannelDoc.prefs as Record<string, string>);
          const fallbackParsed = parseChannelPrefs(JSON.stringify(rawMap), channel);
          Object.assign(rawStringPrefs, fallbackParsed.rawStringPrefs);
          Object.assign(channelSliderValues, fallbackParsed.channelSliderValues);
        }
      } catch (mongoErr) {
        console.warn('[feed] Non-fatal MongoDB enrichment fallback:', mongoErr);
      }
    }

    const candidates = chunkId ? chunks : chunks.filter(chunk => chunkProgress[chunk.chunkId]?.status !== 'completed');
    const output = generateFeed({ allChunks: candidates, chunkProgress, cohortStates, currentTime: new Date(Date.now() - timezoneOffset * 60_000),
      dailyGoalMinutes: 30, completedTodayMinutes: 0, feedSize: (page + 1) * limit, activeChannel: channel,
      ...(Object.keys(channelSliderValues).length ? { channelSliderValues } : {}),
      ...(Object.keys(rawStringPrefs).length ? { rawStringPrefs } : {}),
      ...(searchQuery ? { searchQuery } : {}),
      ...(Object.keys(cohortVectorMap).length ? { cohortVectorMap } : {}),
      ...(Object.keys(chunkVectorMap).length ? { chunkVectorMap } : {}),
      requestedCohortId: cohortId ?? undefined, requestedLessonId: lessonId ?? undefined, requestedChunkId: chunkId ?? undefined });
    return NextResponse.json({ items: output.items.slice(page * limit, (page + 1) * limit),
      ...(rejected.length ? { delivery: { unavailableLessons: rejected.length } } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[feed error]', err);
    return NextResponse.json({ error: 'Feed is unavailable. Try again.' }, { status: 503 });
  }
}
