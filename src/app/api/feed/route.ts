import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { generateFeed } from '@/src/shared/feed/feedEngine';
import { ChannelId } from '@/src/shared/curriculum/pedagogicalVector.types';
import { auth } from '@/src/server/infrastructure/auth/auth.config';

const DEMO_USER_ID = 'demo_user_123';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id || DEMO_USER_ID;

    const searchParams = req.nextUrl.searchParams;
    const rawChannel = searchParams.get('channel');
    const validChannels: ChannelId[] = ['default', 'spark', 'explore', 'build', 'listen', 'deep_dive', 'quick'];
    const channelId = validChannels.includes(rawChannel as ChannelId) ? (rawChannel as ChannelId) : 'default';

    const pageIndex = parseInt(searchParams.get('pageIndex') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    
    const tzOffsetStr = searchParams.get('timezoneOffset');
    let currentTime = new Date();
    if (tzOffsetStr) {
      const offsetMins = parseInt(tzOffsetStr, 10);
      if (!isNaN(offsetMins)) {
        currentTime = new Date(Date.now() - offsetMins * 60 * 1000);
      }
    }
    
    // FAST PATH: Bypass Gemini and MongoDB completely to ensure lightning fast UI.
    
    let pgQuery: any = { chunks: { not: null as any } };
    let userCohorts: string[] = [];
    try {
      const memberships = await prisma.cohortMember.findMany({
        where: { userId: userId },
        select: { cohortId: true }
      });
      userCohorts = memberships.map((m: any) => m.cohortId);
    } catch(e) {}
    
    if (userCohorts.length > 0) {
       pgQuery = { chunks: { not: null as any }, season: { cohortId: { in: userCohorts } } };
    }

    let lessons = await prisma.lesson.findMany({
      where: pgQuery,
      include: { season: { include: { cohort: true } } },
      take: 20
    });

    if (lessons.length === 0) {
       lessons = await prisma.lesson.findMany({
         where: { chunks: { not: null as any } },
         include: { season: { include: { cohort: true } } },
         take: 20
       });
    }

    let feedEngineChunks: any[] = [];
    lessons.forEach((lesson: any) => {
      const lessonChunks = (lesson.chunks as any[]) || [];
      if (lessonChunks.length === 0) return;

      // Skip non-video lessons (no videoId) for video channels
      const lessonVideoId = lesson.videoId || null;
      if (!lessonVideoId) return; // no point queuing a chunk with no YT video

      const totalChunksInLesson = lessonChunks.length;

      // Sort ascending by order so accumulation is correct
      const sortedChunks = [...lessonChunks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      // Bug #1 fix: accumulate startSeconds per-lesson.
      // If a chunk has explicit startSeconds in DB, use it. Otherwise derive from running offset.
      let runningOffset = 0;

      sortedChunks.forEach((c, idx) => {
        let durationStr = c.duration || '3m';
        let durSecs = 180;
        if (durationStr.includes('m')) {
           const match = durationStr.match(/(\d+)\s*m/);
           if (match && match[1]) durSecs = parseInt(match[1], 10) * 60;
        } else if (durationStr.includes('s')) {
           const match = durationStr.match(/(\d+)\s*s/);
           if (match && match[1]) durSecs = parseInt(match[1], 10);
        }

        // Use stored values if non-null; otherwise accumulate from running offset
        const startSecs = c.startSeconds != null ? c.startSeconds : runningOffset;
        const endSecs   = c.endSeconds   != null ? c.endSeconds   : startSecs + durSecs;

        // Advance the running offset for the next chunk
        runningOffset = endSecs;

        feedEngineChunks.push({
          chunkId: String(c.id),
          chunkTitle: c.title || `Part ${c.order || idx + 1}`,
          chunkOrder: c.order || idx + 1,
          chunkDuration: durationStr,
          startSeconds: startSecs,
          endSeconds: endSecs,
          lessonId: String(lesson.id),
          cohortId: String(lesson.season.cohortId),
          lessonTitle: String(lesson.title),
          cohortTitle: String(lesson.season.cohort.title),
          lessonThumbnail: lesson.thumbnailUrl || '',
          lessonVideoId: lessonVideoId,
          totalChunksInLesson,
          // Bug #2 fix: real season/lesson order from DB
          lessonOrder: lesson.order ?? 1,
          seasonOrder: lesson.season.order ?? 1,
          totalLessonsInSeason: undefined, // not easily available per-lesson without extra query
          lessonType: 'video',
          seasonId: String(lesson.seasonId),
          seasonTitle: String(lesson.season.title),
          cohortCoverImage: lesson.season.cohort.coverImage || '',
          cohortProvider: 'Unknown',
          isStrictlyLinear: false,
          isKeyConcept: false,
          chunkVector: undefined
        });
      });
    });
    
    // Bug #3 fix: Round-robin interleave across lessons so the feed engine
    // receives a diverse candidate pool — one chunk per lesson in rotation.
    // Group chunks by lessonId, preserving per-lesson chunk order (sorted above).
    const chunksByLesson = new Map<string, any[]>();
    for (const chunk of feedEngineChunks) {
      const list = chunksByLesson.get(chunk.lessonId) ?? [];
      list.push(chunk);
      chunksByLesson.set(chunk.lessonId, list);
    }
    // Rotate through different lessons (and different cohorts) for variety.
    // Optionally shuffle the lesson order using channel seed so different channels
    // still get different lesson orderings.
    const channelSeeds: Record<string, number> = {
      default: 0, spark: 7, explore: 13, build: 19, listen: 31, deep_dive: 41, quick: 53
    };
    const seed = channelSeeds[channelId] ?? 0;
    const lessonBuckets = [...chunksByLesson.values()]
      .map((bucket, i) => ({ bucket, sort: Math.sin(i * 9301 + seed * 49297 + 233720935) }))
      .sort((a, b) => a.sort - b.sort)
      .map(x => x.bucket);

    feedEngineChunks = [];
    let maxLen = Math.max(...lessonBuckets.map(b => b.length), 0);
    for (let round = 0; round < maxLen; round++) {
      for (const bucket of lessonBuckets) {
        if (round < bucket.length) {
          feedEngineChunks.push(bucket[round]);
        }
      }
    }

    const feedOutput = generateFeed({
      allChunks: feedEngineChunks,
      chunkProgress: {}, 
      cohortStates: [],
      currentTime,
      dailyGoalMinutes: 30,
      completedTodayMinutes: 0,
      feedSize: 20, 
      activeChannel: channelId,
    });

    const items = Array.isArray(feedOutput?.items) ? feedOutput.items : [];
    const paginatedItems = items.slice(pageIndex * limit, (pageIndex + 1) * limit);

    return NextResponse.json({ items: paginatedItems });

  } catch (error) {
    console.error('Feed API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}