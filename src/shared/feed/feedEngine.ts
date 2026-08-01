import type {
  FeedEngineInput,
  FeedEngineOutput,
  FeedItem,
  ChunkProgress,
  FeedChunkInput,
} from './feedEngine.types';
import { calculateChunkScore } from './feedScoring';

export function generateFeed(input: FeedEngineInput): FeedEngineOutput {
  const {
    allChunks,
    chunkProgress,
    cohortStates,
    currentTime,
    dailyGoalMinutes,
    completedTodayMinutes,
    feedSize = 20,
    requestedCohortId,
    requestedLessonId,
    requestedChunkId,
  } = input;

  const cohortStateMap = new Map(cohortStates.map((s) => [s.cohortId, s]));

  // 1. Filter eligible chunks
  // Keep chunks that are not completed (or if requested specifically)
  let eligibleChunks = allChunks.filter((chunk) => {
    const prog = chunkProgress[chunk.chunkId];
    if (prog?.status === 'completed') return false;
    return true;
  });

  // If all chunks completed, fall back to all chunks so feed is never empty
  if (eligibleChunks.length === 0 && allChunks.length > 0) {
    eligibleChunks = [...allChunks];
  }

  // 2. Score eligible chunks
  let previousCohortId: string | null = null;
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
    let { score, reason } = calculateChunkScore(
      chunk,
      progress,
      cohortState,
      previousCohortId,
      currentTime,
    );

    // Boost if requested cohort / lesson / chunk in URL query params
    if (requestedChunkId && chunk.chunkId === requestedChunkId) {
      score += 1000;
      reason = `Direct link: ${chunk.chunkTitle}`;
    } else if (requestedLessonId && chunk.lessonId === requestedLessonId) {
      score += 500;
      reason = `Selected lesson: ${chunk.lessonTitle}`;
    } else if (requestedCohortId && chunk.cohortId === requestedCohortId) {
      score += 100;
      reason = `Current cohort: ${chunk.cohortTitle}`;
    }

    scoredItems.push({
      id: `feed-item-${chunk.chunkId}`,
      chunk,
      progress,
      score,
      reason,
      position: i + 1,
    });
  }

  // 3. Sort by score descending
  scoredItems.sort((a, b) => b.score - a.score);

  // 4. Interleave to prevent more than 2 consecutive chunks from the same cohort
  const interleaved: FeedItem[] = [];
  const pool = [...scoredItems];
  let lastCohortId: string | null = null;
  let sameCohortCount = 0;

  while (pool.length > 0) {
    let nextIndex = 0;

    if (lastCohortId && sameCohortCount >= 2) {
      // Find the first chunk from a different cohort
      const diffIndex = pool.findIndex((item) => item.chunk.cohortId !== lastCohortId);
      if (diffIndex !== -1) {
        nextIndex = diffIndex;
      }
    }

    const [selected] = pool.splice(nextIndex, 1);
    if (selected.chunk.cohortId === lastCohortId) {
      sameCohortCount++;
    } else {
      lastCohortId = selected.chunk.cohortId;
      sameCohortCount = 1;
    }

    selected.position = interleaved.length + 1;
    interleaved.push(selected);

    if (interleaved.length >= feedSize) break;
  }

  // 5. Calculate summary metrics
  const uniqueCohorts = new Set(interleaved.map((item) => item.chunk.cohortId));
  const estimatedMinutes = interleaved.reduce((sum, item) => {
    return sum + parseDurationToSeconds(item.chunk.chunkDuration) / 60;
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
  if (secsMatch) total += Number(secsMatch[2]);
  if (total === 0) {
    const num = Number(duration.match(/\d+/)?.[0]);
    if (!isNaN(num)) total = num * 60;
  }
  return total || 180;
}
