import type { FeedChunkInput, ChunkProgress, CohortLearnerState } from './feedEngine.types';

export interface ScoreWeights {
  continuity: number;     // 0.35
  cohortPriority: number; // 0.20
  recency: number;        // 0.15
  variety: number;        // 0.15
  scheduleMatch: number;  // 0.10
  freshness: number;      // 0.05
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  continuity: 0.35,
  cohortPriority: 0.20,
  recency: 0.15,
  variety: 0.15,
  scheduleMatch: 0.10,
  freshness: 0.05,
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function calculateChunkScore(
  chunk: FeedChunkInput,
  progress: ChunkProgress | undefined,
  cohortState: CohortLearnerState | undefined,
  previousCohortId: string | null,
  now: Date,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): { score: number; reason: string } {
  let score = 0;
  let primaryReason = `Study ${chunk.cohortTitle}`;

  // 1. Continuity Score (0 to 1)
  // Higher score for the first incomplete chunk in a lesson/season
  let continuityScore = 0.5;
  if (progress?.status === 'in-progress') {
    continuityScore = 1.0;
    primaryReason = `Resume ${chunk.chunkTitle}`;
  } else if (!progress || progress.status === 'not-started') {
    continuityScore = 0.7;
    primaryReason = `Next up in ${chunk.lessonTitle}`;
  }

  // 2. Cohort Priority Score (0 to 1)
  let priorityScore = 0.5;
  if (cohortState) {
    // priority 1 -> 1.0, priority 2 -> 0.8, etc.
    priorityScore = Math.max(0.2, 1.0 - (cohortState.priority - 1) * 0.2);
  }

  // 3. Recency Score (0 to 1)
  let recencyScore = 0.5;
  if (cohortState?.lastActiveAt) {
    const lastActive = new Date(cohortState.lastActiveAt);
    const diffHours = (now.getTime() - lastActive.getTime()) / (1000 * 3600);
    if (diffHours < 24) recencyScore = 1.0;
    else if (diffHours < 72) recencyScore = 0.7;
    else recencyScore = 0.4;
  }

  // 4. Variety Score (0 to 1)
  // Penalize consecutive chunks from the exact same cohort
  let varietyScore = 1.0;
  if (previousCohortId === chunk.cohortId) {
    varietyScore = 0.4;
  }

  // 5. Schedule Match Score (0 to 1)
  let scheduleScore = 0.5;
  if (cohortState?.scheduleDays?.length) {
    const todayName = WEEKDAYS[now.getDay()];
    if (cohortState.scheduleDays.includes(todayName)) {
      scheduleScore = 1.0;
    }
  }

  // 6. Freshness Score (0 to 1)
  let freshnessScore = 0.8;
  if (!progress || progress.status === 'not-started') {
    freshnessScore = 1.0;
  } else if (progress.status === 'skipped') {
    freshnessScore = 0.2;
  }

  // Composite Weighted Score
  score =
    continuityScore * weights.continuity +
    priorityScore * weights.cohortPriority +
    recencyScore * weights.recency +
    varietyScore * weights.variety +
    scheduleScore * weights.scheduleMatch +
    freshnessScore * weights.freshness;

  return { score: Math.round(score * 100) / 100, reason: primaryReason };
}

/**
 * Checks if a chunk should be auto-marked as completed when scrolling away prematurely.
 * Threshold: Within the last 15-20 seconds OR >= 85% watched.
 */
export function isEligibleForAutoCompletion(
  watchedSeconds: number,
  totalSeconds: number,
  thresholdSeconds: number = 18,
): boolean {
  if (totalSeconds <= 0) return false;
  const remainingSeconds = totalSeconds - watchedSeconds;
  const percentWatched = watchedSeconds / totalSeconds;

  return remainingSeconds <= thresholdSeconds || percentWatched >= 0.85;
}
