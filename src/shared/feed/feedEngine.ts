import type {
  FeedEngineInput,
  FeedEngineOutput,
  FeedItem,
  ChunkProgress,
  FeedChunkInput,
} from './feedEngine.types';
import { calculateChunkScore } from './feedScoring';
import {
  computeTargetVector,
  rawCosineSimilarity,
  vectorToArray,
  type ChannelId,
} from '@/src/shared/curriculum';

export function generateFeed(input: FeedEngineInput): FeedEngineOutput {
  const {
    allChunks,
    chunkProgress,
    cohortStates,
    currentTime,
    dailyGoalMinutes,
    completedTodayMinutes,
    feedSize = 20,
    activeChannel = 'quick',
    channelSliderValues = {},
    targetQueryVector,
    cohortVectorMap = {},
    chunkVectorMap = {},
    requestedCohortId,
    requestedLessonId,
    requestedChunkId,
  } = input;

  const cohortStateMap = new Map(cohortStates.map((s) => [s.cohortId, s]));

  // Compute or extract 12D target query vector Q
  const queryVec =
    targetQueryVector ||
    vectorToArray(
      computeTargetVector({
        currentTime,
        activeChannel: (activeChannel as ChannelId) || 'quick',
        channelSliderValues,
        userCompletedChunkIds: new Set(
          Object.values(chunkProgress)
            .filter((p) => p.status === 'completed')
            .map((p) => p.chunkId)
        ),
      })
    );

  // 1. Group all chunks by lesson to enforce Sequential Linearity Gating
  const chunksByLesson = new Map<string, FeedChunkInput[]>();
  for (const chunk of allChunks) {
    const list = chunksByLesson.get(chunk.lessonId) || [];
    list.push(chunk);
    chunksByLesson.set(chunk.lessonId, list);
  }

  // 2. Resolve Candidate Chunks per Lesson using the Frontier Selection Rule
  const candidateChunks: FeedChunkInput[] = [];

  chunksByLesson.forEach((lessonChunks) => {
    // Sort ascending by chunk order
    lessonChunks.sort((a, b) => a.chunkOrder - b.chunkOrder);

    const firstChunk = lessonChunks[0];
    const cohortMeta = cohortVectorMap[firstChunk.cohortId];
    const isStrictlyLinear =
      firstChunk.isStrictlyLinear !== undefined
        ? firstChunk.isStrictlyLinear
        : cohortMeta?.isStrictlyLinear ?? true;

    if (isStrictlyLinear) {
      // Linear Lesson: ONLY evaluate the earliest uncompleted chunk
      // k* = min { i | status(chunk_i) != 'completed' }
      const frontierChunk = lessonChunks.find((c) => {
        const prog = chunkProgress[c.chunkId];
        return !prog || prog.status !== 'completed';
      });

      if (frontierChunk) {
        candidateChunks.push(frontierChunk);
      }
    } else {
      // Modular Lesson: All uncompleted chunks are eligible candidates
      for (const chunk of lessonChunks) {
        const prog = chunkProgress[chunk.chunkId];
        if (!prog || prog.status !== 'completed') {
          candidateChunks.push(chunk);
        }
      }
    }
  });

  // Fallback: If all candidates were completed, keep full list to prevent empty feed
  const eligibleChunks = candidateChunks.length > 0 ? candidateChunks : allChunks;

  // 3. Score Eligible Chunks with 70/30 Hybrid Vector Formula + Behavioral Bonuses
  const previousCohortId: string | null = null;
  const scoredItems: FeedItem[] = [];

  for (let i = 0; i < eligibleChunks.length; i++) {
    const chunk = eligibleChunks[i];
    const progress: ChunkProgress = chunkProgress[chunk.chunkId] || {
      chunkId: chunk.chunkId,
      lessonId: chunk.lessonId,
      cohortId: chunk.cohortId,
      status: 'not-started',
      watchedSeconds: 0,
      totalSeconds: parseDurationToSeconds(chunk.chunkDuration),
    };

    const cohortState = cohortStateMap.get(chunk.cohortId);

    // Standard heuristic baseline score
    const heuristic = calculateChunkScore(
      chunk,
      progress,
      cohortState,
      previousCohortId,
      currentTime
    );

    // 70/30 Hybrid Vector Matching
    const hasMacroVec = chunk.fullLessonVector || cohortVectorMap[chunk.cohortId]?.fullVector;
    const macroVec = hasMacroVec || new Array(12).fill(0);

    const hasMicroVec = chunk.chunkVector || chunkVectorMap[chunk.chunkId];
    const microVec = hasMicroVec || new Array(12).fill(0);

    const macroSim = hasMacroVec ? rawCosineSimilarity(queryVec, macroVec) : 0;
    const microSim = hasMicroVec ? rawCosineSimilarity(queryVec, microVec) : 0;
    const hybridVectorScore = 0.70 * macroSim + 0.30 * microSim;

    // Progression Bonuses
    let bonus = 0;

    if (progress.status === 'in-progress') {
      const completionRatio = Math.min(1, progress.watchedSeconds / Math.max(1, progress.totalSeconds));
      bonus += 0.25 + 0.15 * completionRatio;
    } else if (chunk.isKeyConcept) {
      bonus += 0.10;
    }

    // Direct Request / Query Param Overrides
    if (requestedChunkId && chunk.chunkId === requestedChunkId) {
      bonus += 1000;
    } else if (requestedLessonId && chunk.lessonId === requestedLessonId) {
      bonus += 500;
    } else if (requestedCohortId && chunk.cohortId === requestedCohortId) {
      bonus += 100;
    }

    const compositeScore = hybridVectorScore * 10 + heuristic.score + bonus;

    scoredItems.push({
      chunkId: chunk.chunkId,
      chunkTitle: chunk.chunkTitle,
      chunkOrder: chunk.chunkOrder,
      chunkDuration: chunk.chunkDuration,
      startSeconds: chunk.startSeconds,
      endSeconds: chunk.endSeconds,
      lessonId: chunk.lessonId,
      cohortId: chunk.cohortId,
      lessonTitle: chunk.lessonTitle,
      cohortTitle: chunk.cohortTitle,
      matchScore: Math.round(compositeScore * 100) / 100,
    });
  }

  // 4. Sort by score descending
  scoredItems.sort((a, b) => b.matchScore - a.matchScore);

  // 5. Anti-Fatigue Interleaving: prevent > 2 consecutive chunks from the same cohort
  const interleaved: FeedItem[] = [];
  const pool = [...scoredItems];
  let lastCohortId: string | null = null;
  let sameCohortCount = 0;

  while (pool.length > 0) {
    let nextIndex = 0;

    if (lastCohortId && sameCohortCount >= 2) {
      const diffIndex = pool.findIndex((item) => item.cohortId !== lastCohortId);
      if (diffIndex !== -1) {
        nextIndex = diffIndex;
      }
    }

    const [selected] = pool.splice(nextIndex, 1);
    if (selected.cohortId === lastCohortId) {
      sameCohortCount++;
    } else {
      lastCohortId = selected.cohortId;
      sameCohortCount = 1;
    }

    interleaved.push(selected);

    if (interleaved.length >= feedSize) break;
  }

  // 6. Calculate summary metrics
  const uniqueCohorts = new Set(interleaved.map((item) => item.cohortId));
  const estimatedMinutes = interleaved.reduce((sum, item) => {
    return sum + parseDurationToSeconds(item.chunkDuration) / 60;
  }, 0);

  const goalPercent = Math.min(100, Math.round((completedTodayMinutes / dailyGoalMinutes) * 100));

  return {
    items: interleaved,
    totalAvailable: allChunks.length,
    dailyGoalProgress: {
      current: completedTodayMinutes,
      target: dailyGoalMinutes,
      percent: goalPercent,
    },
    stats: {
      cohortsCovered: uniqueCohorts.size,
      chunksRemaining: eligibleChunks.length,
      estimatedMinutes: Math.round(estimatedMinutes),
    },
  };
}

function parseDurationToSeconds(duration: string): number {
  if (!duration) return 180;
  const minsMatch = duration.match(/(\d+)\s*m/i);
  const secsMatch = duration.match(/(\d+)\s*s/i);
  let total = 0;
  if (minsMatch) total += Number(minsMatch[1]) * 60;
  if (secsMatch) total += Number(secsMatch[1]);
  if (total === 0) {
    const num = Number(duration.match(/\d+/)?.[0]);
    if (!isNaN(num)) total = num * 60;
  }
  return total || 180;
}
