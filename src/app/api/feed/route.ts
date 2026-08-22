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
      lessonChunks.forEach((c, idx) => {
        let durationStr = c.duration || '3m';
        let durSecs = 180;
        if (durationStr.includes('m')) {
           const match = durationStr.match(/(\d+)\s*m/);
           if (match && match[1]) durSecs = parseInt(match[1], 10) * 60;
        } else if (durationStr.includes('s')) {
           const match = durationStr.match(/(\d+)\s*s/);
           if (match && match[1]) durSecs = parseInt(match[1], 10);
        }
        
        const lessonVideoId = lesson.videoId || 'oHg5SJYRHA0';

        feedEngineChunks.push({
          chunkId: String(c.id),
          chunkTitle: c.title || `Chunk ${c.order || idx + 1}`,
          chunkOrder: c.order || idx + 1,
          chunkDuration: durationStr,
          startSeconds: c.startSeconds || 0, 
          endSeconds: c.endSeconds || durSecs, 
          lessonId: String(lesson.id),
          cohortId: String(lesson.season.cohortId),
          lessonTitle: String(lesson.title),
          cohortTitle: String(lesson.season.cohort.title),
          lessonThumbnail: lesson.thumbnailUrl || '',
          lessonVideoId: lessonVideoId,
          lessonOrder: lesson.order,
          lessonType: 'video', 
          seasonId: String(lesson.seasonId),
          seasonTitle: String(lesson.season.title),
          seasonOrder: lesson.season.order,
          cohortCoverImage: lesson.season.cohort.coverImage || '',
          cohortProvider: 'Unknown',
          isStrictlyLinear: true,
          isKeyConcept: false,
          chunkVector: undefined
        });
      });
    });
    
    feedEngineChunks = feedEngineChunks.sort(() => 0.5 - Math.random());

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