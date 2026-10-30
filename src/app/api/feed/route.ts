import { NextRequest, NextResponse } from 'next/server';
import { generateFeed } from '@/src/shared/feed/feedEngine';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import type { ChannelId } from '@/src/shared/curriculum/pedagogicalVector.types';
import { ChunkProgressService } from '@/src/server/domain/progress/chunkProgress.service';
import type { ChunkProgress, CohortLearnerState } from '@/src/shared/feed/feedEngine.types';
import { compactPayload } from '@/src/shared/lib/compactPayload';
import {
  getFeedVectorsCache,
  MONGO_VECTORS_TTL_MS,
} from '@/src/server/infrastructure/cache/feedServerCache';
import { loadAuthorizedFeedCatalog } from '@/src/server/domain/feed/feedCatalog';
import { normalizeCohortId } from '@/src/server/domain/home/cohortOrder.service';
import {
  feedRequestSchema,
  MAX_FEED_BODY_BYTES,
  type FeedRequest,
} from '@/src/shared/feed/feedRequest';

function parseChannelPrefsObject(
  rawPrefs: Record<string, string> | undefined,
  channel: ChannelId
): {
  rawStringPrefs: Record<string, string>;
  channelSliderValues: Record<string, number>;
} {
  const rawStringPrefs: Record<string, string> = {};
  const channelSliderValues: Record<string, number> = {};
  if (!rawPrefs || typeof rawPrefs !== 'object') return { rawStringPrefs, channelSliderValues };
  const prefix = `${channel}_`;
  for (const [k, v] of Object.entries(rawPrefs)) {
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
  return { rawStringPrefs, channelSliderValues };
}

async function handleFeedExecution(
  requestParams: FeedRequest,
  isPost: boolean
): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const {
      channel,
      limit,
      excludeChunkIds,
      cohort: cohortId,
      lesson: lessonId,
      chunk: chunkId,
      q: searchQuery,
      prefs: rawPrefsObj,
      timezoneOffset,
    } = requestParams;

    const { rawStringPrefs, channelSliderValues } = parseChannelPrefsObject(rawPrefsObj, channel);

    const catalogResult = await loadAuthorizedFeedCatalog({
      userId,
      cohortId: cohortId ?? undefined,
      lessonId: lessonId ?? undefined,
    });
    const { chunks, rejected, vectorCacheKey } = catalogResult;

    if (rejected.length) console.warn('[feed] Unavailable retained deliveries', rejected);
    if (rejected.length && !chunks.length) {
      return NextResponse.json(
        { error: 'Saved learning content is unavailable. Try again later.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (chunkId && !chunks.some((chunk) => chunk.chunkId === chunkId)) {
      return NextResponse.json({ error: 'Chunk not found.' }, { status: 404 });
    }

    const allChunkIds = chunks.map((chunk) => chunk.chunkId);

    // 1. Required personalized reads: progress, userCohortConfigs, userChannelDoc (if needed)
    // Any failure of required authenticated reads returns 503 with Cache-Control: no-store
    let progress = new Map<string, {
      cohortId?: string;
      lessonId?: string;
      status: string;
      watchedSeconds?: number;
      totalSeconds?: number;
      completedAt?: Date | null;
    }>();
    let userCohortConfigs: Array<{
      cohortId?: string;
      rank?: number;
      isHidden?: boolean;
      isPaused?: boolean;
      pausedUntil?: Date | string | null;
      pausedReason?: string | null;
      dailyGoalMinutes?: number;
      scheduleDays?: string[];
      scheduleLabel?: string;
      priority?: number;
      frequency?: string;
      orderStyle?: string;
      createdAt?: Date | string;
      updatedAt?: Date | string;
      lastActiveAt?: string | null;
    }> = [];
    let userChannelDoc: { prefs?: Record<string, string> } | null = null;

    if (userId) {
      try {
        const { connectToMongoDB } = await import('@/src/server/infrastructure/db/mongodb/client');
        await connectToMongoDB();
        const [
          { UserCohortConfig },
          { UserChannelConfig },
        ] = await Promise.all([
          import('@/src/server/database/mongo/models/UserCohortConfig'),
          import('@/src/server/database/mongo/models/UserChannelConfig'),
        ]);

        const [userProgressMap, loadedConfigs, loadedChannelDoc] = await Promise.all([
          chunks.length > 0
            ? ChunkProgressService.getUserProgressMap(userId, allChunkIds)
            : Promise.resolve(new Map()),
          UserCohortConfig.find({ userId }).lean().exec(),
          !rawPrefsObj
            ? UserChannelConfig.findOne({ userId }).lean().exec()
            : Promise.resolve(null),
        ]);

        progress = userProgressMap;
        userCohortConfigs = loadedConfigs;
        userChannelDoc = loadedChannelDoc;
      } catch (err) {
        console.error('[feed error] Required personalized data read failed:', err);
        return NextResponse.json(
          { error: 'Feed is unavailable. Try again.' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }

    // 2. Optional vector enrichment
    let transcripts: Array<{ cohortId?: string; fullVector?: number[]; isStrictlyLinear?: boolean }> = [];
    let mongoChunks: Array<{ chunkId?: string; vector?: number[] }> = [];
    if (chunks.length > 0) {
      try {
        const { connectToMongoDB } = await import('@/src/server/infrastructure/db/mongodb/client');
        await connectToMongoDB();
        const [
          { CohortTranscript },
          { Chunk },
        ] = await Promise.all([
          import('@/src/server/database/mongo/models/CohortTranscript'),
          import('@/src/server/database/mongo/models/Chunk'),
        ]);

        const uniqueCohortIds = [...new Set(chunks.map((c) => c.cohortId))];
        const vectorsKey = vectorCacheKey;
        const cachedVectors = getFeedVectorsCache().get(vectorsKey);
        const hasFreshVectors = Boolean(cachedVectors && cachedVectors.expiresAt > Date.now());

        if (hasFreshVectors) {
          transcripts = cachedVectors!.transcripts;
          mongoChunks = cachedVectors!.mongoChunks;
        } else {
          [transcripts, mongoChunks] = await Promise.all([
            CohortTranscript.find(
              { cohortId: { $in: uniqueCohortIds } },
              { cohortId: 1, fullVector: 1, isStrictlyLinear: 1 }
            ).lean().exec(),
            Chunk.find({ chunkId: { $in: allChunkIds } }, { chunkId: 1, vector: 1 }).lean().exec(),
          ]);
          getFeedVectorsCache().set(vectorsKey, {
            transcripts,
            mongoChunks,
            expiresAt: Date.now() + MONGO_VECTORS_TTL_MS,
          });
        }
      } catch {
        console.warn('[feed] Optional vector enrichment unavailable, using delivery vectors.');
      }
    }

    const chunkProgress: Record<string, ChunkProgress> = {};
    for (const chunk of chunks) {
      const saved = progress.get(chunk.chunkId);
      if (saved && saved.cohortId === chunk.cohortId && saved.lessonId === chunk.lessonId) {
        chunkProgress[chunk.chunkId] = {
          chunkId: chunk.chunkId,
          lessonId: chunk.lessonId,
          cohortId: chunk.cohortId,
          status:
            saved.status === 'COMPLETED'
              ? 'completed'
              : saved.status === 'SKIPPED'
              ? 'skipped'
              : 'in-progress',
          watchedSeconds: saved.watchedSeconds ?? 0,
          totalSeconds: saved.totalSeconds ?? 0,
        };
      }
    }

    let cohortStates: CohortLearnerState[] = [];
    const cohortVectorMap: Record<string, { fullVector: number[]; isStrictlyLinear: boolean }> = {};
    const chunkVectorMap: Record<string, number[]> = {};

    for (const t of transcripts) {
      if (t.cohortId && Array.isArray(t.fullVector) && t.fullVector.length === 12) {
        cohortVectorMap[t.cohortId] = {
          fullVector: t.fullVector,
          isStrictlyLinear: Boolean(t.isStrictlyLinear),
        };
      }
    }

    for (const mc of mongoChunks) {
      if (mc.chunkId && Array.isArray(mc.vector) && mc.vector.length === 12) {
        chunkVectorMap[mc.chunkId] = mc.vector;
      }
    }

    const hiddenCohortIds = new Set<string>();
    const pausedCohortIds = new Set<string>();
    const now = new Date();

    if (Array.isArray(userCohortConfigs) && userCohortConfigs.length > 0) {
      cohortStates = userCohortConfigs.map((cfg, idx: number) => {
        const rawId = cfg.cohortId;
        const cleanId = normalizeCohortId(rawId, userId);
        const isPaused = Boolean(cfg.isPaused);
        const pausedUntil = cfg.pausedUntil ? new Date(cfg.pausedUntil) : null;
        const isStillPaused = isPaused && (!pausedUntil || pausedUntil > now);

        if (cfg.isHidden) {
          hiddenCohortIds.add(cleanId);
          if (rawId) hiddenCohortIds.add(rawId);
        }
        if (isStillPaused) {
          pausedCohortIds.add(cleanId);
          if (rawId) pausedCohortIds.add(rawId);
        }

        return {
          cohortId: cleanId,
          subscribedAt: cfg.createdAt ? new Date(cfg.createdAt).toISOString() : new Date().toISOString(),
          lastActiveAt: cfg.updatedAt ? new Date(cfg.updatedAt).toISOString() : new Date().toISOString(),
          dailyGoalMinutes: cfg.dailyGoalMinutes || 20,
          scheduleDays:
            Array.isArray(cfg.scheduleDays) && cfg.scheduleDays.length > 0
              ? cfg.scheduleDays
              : ['Mon', 'Wed', 'Fri'],
          priority: (typeof cfg.rank === 'number' && cfg.rank > 0) ? cfg.rank : (idx + 1),
          frequency: (cfg.frequency as CohortLearnerState['frequency']) || 'Often',
          orderStyle: (cfg.orderStyle as CohortLearnerState['orderStyle']) || 'Sequential',
          isPaused: isStillPaused,
          pausedUntil: pausedUntil ? pausedUntil.toISOString() : undefined,
          pausedReason: cfg.pausedReason ?? undefined,
        };
      });
    }

    if (userChannelDoc?.prefs && !rawPrefsObj) {
      const rawMap =
        userChannelDoc.prefs instanceof Map
          ? Object.fromEntries(userChannelDoc.prefs)
          : (userChannelDoc.prefs as Record<string, string>);
      const fallbackParsed = parseChannelPrefsObject(rawMap, channel);
      Object.assign(rawStringPrefs, fallbackParsed.rawStringPrefs);
      Object.assign(channelSliderValues, fallbackParsed.channelSliderValues);
    }

    const candidates = chunkId
      ? chunks
      : chunks.filter((chunk) => {
          if (chunkProgress[chunk.chunkId]?.status === 'completed') return false;
          if (cohortId) {
            return chunk.cohortId === cohortId;
          }
          if (hiddenCohortIds.has(chunk.cohortId) || pausedCohortIds.has(chunk.cohortId)) {
            return false;
          }
          return true;
        });

    const realNow = new Date();
    const shiftedDate = new Date(realNow.getTime() - timezoneOffset * 60_000);
    const localDayOfWeek = shiftedDate.getUTCDay();
    const localHour = shiftedDate.getUTCHours();

    const output = generateFeed({
      allChunks: candidates,
      chunkProgress,
      cohortStates,
      currentTime: realNow,
      localDayOfWeek,
      localHour,
      dailyGoalMinutes: 30,
      completedTodayMinutes: 0,
      targetLimit: limit,
      excludedChunkIds: new Set(excludeChunkIds),
      activeChannel: channel,
      ...(Object.keys(channelSliderValues).length ? { channelSliderValues } : {}),
      ...(Object.keys(rawStringPrefs).length ? { rawStringPrefs } : {}),
      ...(searchQuery ? { searchQuery } : {}),
      ...(Object.keys(cohortVectorMap).length ? { cohortVectorMap } : {}),
      ...(Object.keys(chunkVectorMap).length ? { chunkVectorMap } : {}),
      requestedCohortId: cohortId ?? undefined,
      requestedLessonId: lessonId ?? undefined,
      requestedChunkId: chunkId ?? undefined,
    });

    const cacheControl = isPost || userId ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=300';
    const items = compactPayload(output.items);
    return NextResponse.json(
      {
        items,
        hasMore: Boolean(output.hasMore),
        ...(rejected.length ? { delivery: { unavailableLessons: rejected.length } } : {}),
      },
      {
        headers: {
          'Cache-Control': cacheControl,
          ...(!userId && !isPost ? { Vary: 'Cookie, Authorization' } : {}),
        },
      }
    );
  } catch (err) {
    console.error('[feed error]', err);
    return NextResponse.json(
      { error: 'Feed is unavailable. Try again.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const pageParam = params.get('pageIndex');
  if (pageParam !== null) {
    const pageNum = Number(pageParam);
    if (pageNum > 0) {
      return NextResponse.json(
        {
          error: 'Mutable offset pagination is discontinued. Use POST /api/feed with excludeChunkIds.',
          code: 'FEED_CONTINUATION_REQUIRED',
        },
        { status: 400 }
      );
    }
    if (!Number.isInteger(pageNum) || pageNum < 0) {
      return NextResponse.json({ error: 'Invalid feed page.' }, { status: 400 });
    }
  }

  const limitParam = params.get('limit');
  const limit = limitParam !== null ? Number(limitParam) : 5;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    return NextResponse.json({ error: 'Invalid feed page.' }, { status: 400 });
  }

  const rawChannel = params.get('channel');
  const channels: ChannelId[] = ['default', 'spark', 'explore', 'build', 'listen', 'deep_dive', 'quick'];
  const channel = channels.includes(rawChannel as ChannelId) ? (rawChannel as ChannelId) : 'default';

  const timezoneOffset = Number(params.get('timezoneOffset') ?? 0);
  if (!Number.isFinite(timezoneOffset) || Math.abs(timezoneOffset) > 840) {
    return NextResponse.json({ error: 'Invalid timezone offset.' }, { status: 400 });
  }

  const cohortId = params.get('cohort') ?? undefined;
  const lessonId = params.get('lessonId') || params.get('lesson') || undefined;
  const chunkId = params.get('chunk') ?? undefined;
  if ([cohortId, lessonId, chunkId].some((id) => id !== undefined && (!id.length || id.length > 128))) {
    return NextResponse.json({ error: 'Invalid lesson selection.' }, { status: 400 });
  }

  const searchQuery = params.get('q')?.trim().slice(0, 200) || undefined;
  let parsedPrefs: Record<string, string> | undefined;
  const prefsParam = params.get('prefs');
  if (prefsParam) {
    try {
      const p = JSON.parse(prefsParam);
      if (p && typeof p === 'object') {
        parsedPrefs = p;
      }
    } catch {}
  }

  return handleFeedExecution(
    {
      channel,
      limit,
      excludeChunkIds: [],
      cohort: cohortId,
      lesson: lessonId,
      chunk: chunkId,
      q: searchQuery,
      prefs: parsedPrefs,
      timezoneOffset,
    },
    false
  );
}

export async function POST(request: NextRequest) {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_FEED_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body.' }, { status: 400 });
  }

  if (text.length > MAX_FEED_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parseResult = feedRequestSchema.safeParse(json);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid feed request parameters.', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  return handleFeedExecution(parseResult.data, true);
}
