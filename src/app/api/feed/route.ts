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
    const channelId = (searchParams.get('channel') || 'default') as ChannelId;
    const pageIndex = parseInt(searchParams.get('pageIndex') || '0', 10);
    const prefsRaw = searchParams.get('prefs');
    const tzOffsetStr = searchParams.get('timezoneOffset');
    const limit = 6; // 6 chunks per page

    let currentTime = new Date();
    if (tzOffsetStr) {
      const offsetMinutes = parseInt(tzOffsetStr, 10);
      if (!isNaN(offsetMinutes)) {
        currentTime = new Date(Date.now() - offsetMinutes * 60 * 1000);
      }
    }

    await connectToMongoDB();

    let rawStringPrefs: Record<string, string> | undefined = undefined;
    if (prefsRaw) {
      try {
        rawStringPrefs = JSON.parse(decodeURIComponent(prefsRaw));
      } catch (e) {
        console.warn('Failed to parse channel prefs:', e);
      }
    }

    // 1. Fetch all user progress, sorted newest first
    const allUserProgress = await UserChunkProgress.find({ userId: DEMO_USER_ID }).sort({ updatedAt: -1 });
    const completedChunkIds = allUserProgress
      .filter(p => p.status === 'COMPLETED')
      .map(p => p.chunkId);

    const chunkProgressRecord: Record<string, { chunkId: string; lessonId: string; cohortId: string; status: 'completed' | 'in-progress' | 'not-started'; watchedSeconds: number; totalSeconds: number; }> = {};
    allUserProgress.forEach(p => {
      chunkProgressRecord[p.chunkId] = {
        chunkId: p.chunkId,
        lessonId: p.lessonId,
        cohortId: p.cohortId,
        status: p.status === 'COMPLETED' ? 'completed' : p.status === 'IN_PROGRESS' ? 'in-progress' : 'not-started',
        watchedSeconds: p.watchedSeconds || 0,
        totalSeconds: p.totalSeconds || 180
      };
    });

    // 2. Compute Target Vector
    const targetVectorMap = computeTargetVector({
      activeChannel: channelId,
      currentTime,
      userCompletedChunkIds: new Set(completedChunkIds),
      rawStringPrefs,
    });

    const targetVectorArray = [
      targetVectorMap.cognitive_load,
      targetVectorMap.practicality_actionability,
      targetVectorMap.visual_dependence,
      targetVectorMap.scaffolding_guidance,
      targetVectorMap.linearity_dependency,
      targetVectorMap.novelty_divergence,
      targetVectorMap.abstraction_depth,
      targetVectorMap.pacing_density,
      targetVectorMap.rigor_formality,
      targetVectorMap.interactivity_agency,
      targetVectorMap.breadth_scope,
      targetVectorMap.emotional_energy,
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

    const chunks = await Chunk.aggregate(pipeline);

    // If no Atlas Vector Search is set up (e.g., local dev without Atlas), 
    // we would need a fallback here. But for now, we assume Atlas.
    
    // Map candidates for feedEngine
    const feedEngineChunks = chunks.map(chunk => ({
      chunkId: chunk.chunkId,
      chunkTitle: chunk.title,
      chunkOrder: chunk.chunkIndex + 1,
      chunkDuration: chunk.duration ? `${Math.round(chunk.duration / 60)} min` : '3 min',
      startSeconds: chunk.startSeconds,
      endSeconds: chunk.endSeconds,
      lessonId: chunk.lessonId,
      cohortId: chunk.cohortId,
      lessonTitle: `Lesson ${chunk.lessonId}`,
      cohortTitle: `Cohort ${chunk.cohortId}`,
      lessonThumbnail: '',
      lessonOrder: 1,
      lessonType: 'video',
      seasonId: 's1',
      seasonTitle: 'Season 1',
      seasonOrder: 1,
      cohortCoverImage: '',
      cohortProvider: 'Unknown',
      isStrictlyLinear: chunk.isStrictlyLinear,
      isKeyConcept: chunk.isKeyConcept,
      chunkVector: chunk.vector
    }));

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
    const paginatedItems = feedOutput.items.slice(pageIndex * limit, (pageIndex + 1) * limit);

    return NextResponse.json({ items: paginatedItems });

  } catch (error) {
    console.error('Feed API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
