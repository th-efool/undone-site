/**
 * Feed Engine Types
 * Defines data shapes for the microlearning feed algorithm and repository.
 */

export interface FeedChunkInput {
  chunkId: string;
  chunkTitle: string;
  chunkOrder: number;
  chunkDuration: string;        // e.g. "5m", "3m 20s", "12 min"
  startSeconds: number;
  endSeconds: number;
  timestampUrl?: string;        // YouTube deep-link with &t=Xs

  lessonId: string;
  lessonTitle: string;
  lessonThumbnail: string;
  lessonVideoId?: string;
  lessonVideoUrl?: string;
  lessonOrder: number;
  lessonType: string;           // 'video' | 'reading' | 'assignment'

  seasonId: string;
  seasonTitle: string;
  seasonOrder: number;

  cohortId: string;
  cohortTitle: string;
  cohortCoverImage: string;
  cohortProvider: string;       // creator name
}

export type ChunkStatus = 'not-started' | 'in-progress' | 'completed' | 'skipped';

export interface ChunkProgress {
  chunkId: string;
  lessonId: string;
  cohortId: string;
  status: ChunkStatus;
  watchedSeconds: number;
  totalSeconds: number;
  lastWatchedAt?: string;        // ISO string
  bookmarked?: boolean;
  notes?: string;
}

export interface CohortLearnerState {
  cohortId: string;
  subscribedAt: string;
  lastActiveAt: string;
  dailyGoalMinutes: number;
  scheduleDays: string[];        // ['Mon', 'Wed', 'Fri']
  priority: number;              // 1 = highest
}

export interface FeedEngineInput {
  allChunks: FeedChunkInput[];
  chunkProgress: Record<string, ChunkProgress>;
  cohortStates: CohortLearnerState[];
  currentTime: Date;
  dailyGoalMinutes: number;
  completedTodayMinutes: number;
  feedSize: number;              // default 20
  requestedCohortId?: string;
  requestedLessonId?: string;
  requestedChunkId?: string;
}

export interface FeedItem {
  id: string;                    // unique feed-item ID
  chunk: FeedChunkInput;
  progress: ChunkProgress;
  score: number;                 // algorithm score (higher = shown first)
  reason: string;                // e.g., "Continue DSA", "New Lesson", "Up Next"
  position: number;              // 1-indexed position in feed
}

export interface FeedEngineOutput {
  items: FeedItem[];
  totalAvailable: number;
  dailyGoalProgress: {
    current: number;
    target: number;
    percent: number;
  };
  stats: {
    cohortsCovered: number;
    chunksRemaining: number;
    estimatedMinutes: number;
  };
}
