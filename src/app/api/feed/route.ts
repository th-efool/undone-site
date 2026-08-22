import { NextRequest, NextResponse } from 'next/server';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import { UserChunkProgress } from '@/src/server/database/mongo/models/UserChunkProgress';
import { Chunk } from '@/src/server/database/mongo/models/Chunk';
import { computeTargetVector } from '@/src/shared/curriculum/pedagogicalVector.engine';
import { ChannelId } from '@/src/shared/curriculum/pedagogicalVector.types';
import { generateFeed } from '@/src/shared/feed/feedEngine';

// Example dummy user for now until auth is fully wired
const DEMO_USER_ID = 'demo_user_123';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const rawChannel = searchParams.get('channel');
    const validChannels: ChannelId[] = ['default', 'spark', 'explore', 'build', 'listen', 'deep_dive', 'quick'];
    const channelId: ChannelId = (rawChannel && validChannels.includes(rawChannel.trim() as ChannelId))
      ? (rawChannel.trim() as ChannelId)
      : 'default';
    const rawPageIndex = searchParams.get('pageIndex');
    const parsedPageIndex = parseInt(rawPageIndex || '0', 10);
    const pageIndex = isNaN(parsedPageIndex) || parsedPageIndex < 0 ? 0 : parsedPageIndex;
    const prefsRaw = searchParams.get('prefs');
    const tzOffsetStr = searchParams.get('timezoneOffset');
    const limit = 6; // 6 chunks per page

    let currentTime = new Date();
    if (tzOffsetStr) {
      const offsetMinutes = parseInt(tzOffsetStr.trim(), 10);
      if (!isNaN(offsetMinutes)) {
        currentTime = new Date(Date.now() - offsetMinutes * 60 * 1000);
      }
    }

    await connectToMongoDB();

    let rawStringPrefs: Record<string, string> | undefined = undefined;
    if (prefsRaw && typeof prefsRaw === 'string') {
      try {
        const parsed = JSON.parse(decodeURIComponent(prefsRaw));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          rawStringPrefs = parsed as Record<string, string>;
        }
      } catch (e) {
        console.warn('Failed to parse channel prefs:', e);
      }
    }

    // 1. Fetch all user progress, sorted newest first
    const allUserProgress = (await UserChunkProgress.find({ userId: DEMO_USER_ID }).sort({ updatedAt: -1 })) || [];
    const userProgressList = Array.isArray(allUserProgress) ? allUserProgress : [];
    const completedChunkIds = userProgressList
      .filter(p => p && p.status === 'COMPLETED' && p.chunkId)
      .map(p => String(p.chunkId));

    const chunkProgressRecord: Record<string, { chunkId: string; lessonId: string; cohortId: string; status: 'completed' | 'in-progress' | 'not-started'; watchedSeconds: number; totalSeconds: number; }> = {};
    userProgressList.forEach(p => {
      if (p && p.chunkId) {
        const cId = String(p.chunkId);
        chunkProgressRecord[cId] = {
          chunkId: cId,
          lessonId: p.lessonId ? String(p.lessonId) : '',
          cohortId: p.cohortId ? String(p.cohortId) : '',
          status: p.status === 'COMPLETED' ? 'completed' : p.status === 'IN_PROGRESS' ? 'in-progress' : 'not-started',
          watchedSeconds: typeof p.watchedSeconds === 'number' && !isNaN(p.watchedSeconds) ? p.watchedSeconds : 0,
          totalSeconds: typeof p.totalSeconds === 'number' && !isNaN(p.totalSeconds) && p.totalSeconds > 0 ? p.totalSeconds : 180,
        };
      }
    });

    // 2. Compute Target Vector
    const targetVectorMap = computeTargetVector({
      activeChannel: channelId,
      currentTime,
      userCompletedChunkIds: new Set(completedChunkIds),
      rawStringPrefs,
    });

    const targetVectorArray = [
      targetVectorMap?.cognitive_load ?? 0.5,
      targetVectorMap?.practicality_actionability ?? 0.5,
      targetVectorMap?.visual_dependence ?? 0.5,
      targetVectorMap?.scaffolding_guidance ?? 0.5,
      targetVectorMap?.linearity_dependency ?? 0.5,
      targetVectorMap?.novelty_divergence ?? 0.5,
      targetVectorMap?.abstraction_depth ?? 0.5,
      targetVectorMap?.pacing_density ?? 0.5,
      targetVectorMap?.rigor_formality ?? 0.5,
      targetVectorMap?.interactivity_agency ?? 0.5,
      targetVectorMap?.breadth_scope ?? 0.5,
      targetVectorMap?.emotional_energy ?? 0.5,
    ];

    // 3. Execute Vector Search with Metadata Filtering
    // Using MongoDB Atlas $vectorSearch
    // NOTE: This assumes the Atlas Vector Search index "vector_index" is configured.
    const searchLimit = Math.max(50, (pageIndex + 1) * limit + 40);
    const searchNumCandidates = Math.max(150, searchLimit + 100);

    const pipeline = [
      {
        $vectorSearch: {
          index: "vector_index",
          path: "vector",
          queryVector: targetVectorArray,
          numCandidates: searchNumCandidates,
          limit: searchLimit,
          filter: {
            chunkId: { $nin: completedChunkIds.slice(0, 200) }
          }
        }
      },
      // Project the necessary fields
      {
        $project: {
          _id: 0,
          chunkId: 1,
          cohortId: 1,
          lessonId: 1,
          chunkIndex: 1,
          title: 1,
          text: 1,
          startSeconds: 1,
          endSeconds: 1,
          duration: 1,
          isStrictlyLinear: 1,
          isKeyConcept: 1,
          vector: 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    ];

    let chunks: any[] = [];
    try {
      chunks = (await Chunk.aggregate(pipeline)) || [];
    } catch (err) {
      console.warn("Vector search failed, falling back to basic query", err);
    }

    // Fallback: if no Atlas Vector Search is set up or returned 0, load random or sequential chunks
    if (!chunks || chunks.length === 0) {
      console.log("Vector search returned 0 chunks, falling back to basic query");
      
      let enrolledCohortIds: string[] = [];
      try {
        const { prisma } = await import('@/src/server/infrastructure/db/postgres/client');
        const memberships = await prisma.cohortMember.findMany({
          where: { userId: DEMO_USER_ID },
          select: { cohortId: true }
        });
        enrolledCohortIds = memberships.map(m => m.cohortId);
      } catch (err) {
        console.warn("Failed to fetch enrolled cohorts", err);
      }

      const matchQuery: any = { chunkId: { $nin: completedChunkIds.slice(0, 200) } };
      if (enrolledCohortIds.length > 0) {
        matchQuery.cohortId = { $in: enrolledCohortIds };
      }

      try {
        chunks = await Chunk.aggregate([
          { $match: matchQuery },
          { $sample: { size: searchLimit } }
        ]);
      } catch (err) {
        console.warn("$sample failed, using basic find", err);
        chunks = await Chunk.find(matchQuery).limit(searchLimit);
      }
      
      // If still empty (e.g. no chunks in enrolled cohorts), grab literally anything
      if (!chunks || chunks.length === 0) {
        chunks = await Chunk.find({ chunkId: { $nin: completedChunkIds.slice(0, 200) } }).limit(searchLimit);
      }
      
      if (!chunks || chunks.length === 0) {
        chunks = await Chunk.find().limit(searchLimit);
      }
    }
    
    // Map candidates for feedEngine
    let feedEngineChunks = (Array.isArray(chunks) ? chunks : []).map((chunk, idx) => {
      const durationNum = typeof chunk?.duration === 'number' && !isNaN(chunk.duration) && chunk.duration > 0 ? chunk.duration : 180;
      const durationStr = `${Math.round(durationNum / 60)} min`;
      const chunkId = chunk?.chunkId ? String(chunk.chunkId) : `chunk_${idx}`;
      const lessonId = chunk?.lessonId ? String(chunk.lessonId) : `lesson_${idx}`;
      const cohortId = chunk?.cohortId ? String(chunk.cohortId) : `cohort_${idx}`;
      const chunkOrder = typeof chunk?.chunkIndex === 'number' && !isNaN(chunk.chunkIndex) ? chunk.chunkIndex + 1 : idx + 1;

      return {
        chunkId,
        chunkTitle: chunk?.title || `Chunk ${chunkOrder}`,
        chunkOrder,
        chunkDuration: durationStr,
        startSeconds: typeof chunk?.startSeconds === 'number' && !isNaN(chunk.startSeconds) ? chunk.startSeconds : 0,
        endSeconds: typeof chunk?.endSeconds === 'number' && !isNaN(chunk.endSeconds) ? chunk.endSeconds : durationNum,
        lessonId,
        cohortId,
        lessonTitle: `Lesson ${lessonId}`,
        cohortTitle: `Cohort ${cohortId}`,
        lessonThumbnail: '',
        lessonOrder: 1,
        lessonType: 'video' as const,
        seasonId: 's1',
        seasonTitle: 'Season 1',
        seasonOrder: 1,
        cohortCoverImage: '',
        cohortProvider: 'Unknown',
        isStrictlyLinear: Boolean(chunk?.isStrictlyLinear),
        isKeyConcept: Boolean(chunk?.isKeyConcept),
        chunkVector: Array.isArray(chunk?.vector) ? chunk.vector : undefined,
      };
    });

    // ULTIMATE FALLBACK: If MongoDB is completely empty (vectorization hasn't run),
    // grab raw chunks directly from Postgres Lessons!
    if (feedEngineChunks.length === 0) {
      console.log("MongoDB Chunk collection empty. Falling back to Postgres Lessons...");
      try {
        const { prisma } = await import('@/src/server/infrastructure/db/postgres/client');
        let pgQuery: any = { chunks: { not: null } };
        
        // If we found their enrolled cohorts earlier, prioritize them
        let userCohorts: string[] = [];
        try {
          const memberships = await prisma.cohortMember.findMany({
            where: { userId: DEMO_USER_ID },
            select: { cohortId: true }
          });
          userCohorts = memberships.map((m: any) => m.cohortId);
        } catch(e) {}
        
        if (userCohorts.length > 0) {
           pgQuery = {
             chunks: { not: null },
             season: { cohortId: { in: userCohorts } }
           };
        }

        let lessons = await prisma.lesson.findMany({
          where: pgQuery,
          include: { season: { include: { cohort: true } } },
          take: 20
        });

        // If enrolled cohorts have no lessons, fallback to ANY lessons
        if (lessons.length === 0 && userCohorts.length > 0) {
           lessons = await prisma.lesson.findMany({
             where: { chunks: { not: null } },
             include: { season: { include: { cohort: true } } },
             take: 20
           });
        }

        lessons.forEach((lesson: any) => {
          const lessonChunks = (lesson.chunks as any[]) || [];
          lessonChunks.forEach((c, idx) => {
            if (completedChunkIds.includes(c.id)) return;
            feedEngineChunks.push({
              chunkId: String(c.id),
              chunkTitle: c.title || `Chunk ${c.order || idx + 1}`,
              chunkOrder: c.order || idx + 1,
              chunkDuration: c.duration || "180s",
              startSeconds: 0, 
              endSeconds: 180, 
              lessonId: String(lesson.id),
              cohortId: String(lesson.season.cohortId),
              lessonTitle: String(lesson.title),
              cohortTitle: String(lesson.season.cohort.title),
              lessonThumbnail: lesson.thumbnailUrl || '',
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
        
        // Take a random subset of chunks to mimic sample
        feedEngineChunks = feedEngineChunks.sort(() => 0.5 - Math.random()).slice(0, searchLimit);
      } catch(err) {
        console.error("ULTIMATE FALLBACK FAILED:", err);
      }
    }

    // 4. Generate feed
    const feedOutput = generateFeed({
      allChunks: feedEngineChunks,
      chunkProgress: chunkProgressRecord,
      cohortStates: [],
      currentTime,
      dailyGoalMinutes: 30, // Mocked
      completedTodayMinutes: 0, // Mocked
      feedSize: searchLimit, // Let it score all candidates
      activeChannel: channelId,
      targetQueryVector: targetVectorArray
    });

    // 5. Paginate based on original limit
    const items = Array.isArray(feedOutput?.items) ? feedOutput.items : [];
    const paginatedItems = items.slice(pageIndex * limit, (pageIndex + 1) * limit);

    return NextResponse.json({ items: paginatedItems });

  } catch (error) {
    console.error('Feed API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
