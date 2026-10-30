import type { FeedChunkInput, ChunkProgress, CohortLearnerState } from './feedEngine.types';

export interface ScoreWeights {
  continuity: number;     // 0.40
  cohortPriority: number; // 0.25
  recency: number;        // 0.15
  scheduleMatch: number;  // 0.15
  freshness: number;      // 0.05
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  continuity: 0.40,
  cohortPriority: 0.25,
  recency: 0.15,
  scheduleMatch: 0.15,
  freshness: 0.05,
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const FREQUENCY_MULTIPLIERS: Record<string, number> = {
  'Very Often': 1.45,
  'Often': 1.15,
  'Sometimes': 1.0,
  'Rarely': 0.65,
  'Very Rarely': 0.30,
};

export function calculateChunkScore(
  chunk: FeedChunkInput,
  progress: ChunkProgress | undefined,
  cohortState: CohortLearnerState | undefined,
  now: Date,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  localDayOfWeek?: number,
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

  // 4. Schedule Match Score (0 to 1)
  let scheduleScore = 0.5;
  if (cohortState?.scheduleDays?.length) {
    const dayIndex = typeof localDayOfWeek === 'number' ? localDayOfWeek : now.getDay();
    const todayName = WEEKDAYS[dayIndex];
    if (cohortState.scheduleDays.includes(todayName)) {
      scheduleScore = 1.0;
    } else {
      scheduleScore = 0.2;
    }
  }

  // 5. Freshness Score (0 to 1)
  let freshnessScore = 0.8;
  if (!progress || progress.status === 'not-started') {
    freshnessScore = 1.0;
  } else if (progress.status === 'skipped') {
    freshnessScore = 0.2;
  }

  // Composite Weighted Score (normalized weights sum to 1.00)
  score =
    continuityScore * weights.continuity +
    priorityScore * weights.cohortPriority +
    recencyScore * weights.recency +
    scheduleScore * weights.scheduleMatch +
    freshnessScore * weights.freshness;

  // Apply user-configured frequency multiplier ("SHOWS UP" slider)
  const freqMult = cohortState?.frequency ? FREQUENCY_MULTIPLIERS[cohortState.frequency] ?? 1.0 : 1.0;
  score = score * freqMult;

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
