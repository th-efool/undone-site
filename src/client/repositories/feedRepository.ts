import { cohortRepository } from './cohortRepository';
import { cohortStore } from './cohortStore';
import { generateFeed } from '@/src/shared/feed/feedEngine';
import { isEligibleForAutoCompletion } from '@/src/shared/feed/feedScoring';
import type {
  FeedChunkInput,
  ChunkProgress,
  CohortLearnerState,
  FeedEngineOutput,
} from '@/src/shared/feed/feedEngine.types';
import { LessonStatus, LessonType, SeasonStatus } from '@/src/client/screens/cohort/models';

const FEED_PROGRESS_KEY = 'sidequest_feed_progress';
const COHORT_STATES_KEY = 'sidequest_cohort_states';

function loadFeedProgress(): Record<string, ChunkProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FEED_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveFeedProgress(progressMap: Record<string, ChunkProgress>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FEED_PROGRESS_KEY, JSON.stringify(progressMap));
  } catch (err) {
    console.error('Failed to save feed progress', err);
  }
}

function loadCohortStates(): CohortLearnerState[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COHORT_STATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function parseDurationToSeconds(val: string): number {
  if (!val) return 180;
  const isoMatch = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i.exec(val.toUpperCase());
  if (isoMatch) {
    return (Number(isoMatch[1] ?? 0) * 3600) + (Number(isoMatch[2] ?? 0) * 60) + Number(isoMatch[3] ?? 0);
  }
  const hmsMatch = val.match(/(\d+):(\d{1,2})(?::(\d{1,2}))?/);
  if (hmsMatch) {
    if (hmsMatch[3]) return Number(hmsMatch[1]) * 3600 + Number(hmsMatch[2]) * 60 + Number(hmsMatch[3]);
    return Number(hmsMatch[1]) * 60 + Number(hmsMatch[2]);
  }
  const minMatch = val.match(/(\d+)\s*m/i);
  if (minMatch) return Number(minMatch[1]) * 60;
  return 180;
}

export const feedRepository = {
  /**
   * Flattens active cohorts into candidate FeedChunkInputs
   */
  getAllChunks(): FeedChunkInput[] {
    const cohorts = cohortRepository.list();
    const chunks: FeedChunkInput[] = [];

    const userPublishedIds = new Set(cohortStore.getUserCohorts().map((c) => c.id));

    // For now just use userPublished cohorts since mock data is deleted
    const activeCohorts = cohorts.filter((c) => userPublishedIds.has(c.id));

    activeCohorts.forEach((cohort) => {
      const seasons = cohort.questline?.seasons || [];
      seasons.forEach((season, seasonIdx) => {
        const lessons = season.lessons || [];
        lessons.forEach((lesson, lessonIdx) => {
          const videoId = lesson.videoId || '';
          const videoUrl = lesson.videoUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined);
          const lessonChunks = lesson.chunks || [];

          if (lessonChunks.length > 0) {
            lessonChunks.forEach((chunk, chunkIdx) => {
              const durSecs = parseDurationToSeconds(chunk.duration);
              const startSecs = chunk.startSeconds ?? chunkIdx * durSecs;
              const endSecs = chunk.endSeconds ?? (chunkIdx + 1) * durSecs;

              chunks.push({
                chunkId: chunk.id || `chunk-${cohort.id}-${seasonIdx}-${lessonIdx}-${chunkIdx + 1}`,
                chunkTitle: chunk.title || `Part ${chunkIdx + 1}`,
                chunkOrder: chunk.order || chunkIdx + 1,
                chunkDuration: chunk.duration || '5m',
                startSeconds: startSecs,
                endSeconds: endSecs,
                timestampUrl: chunk.timestampUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}&t=${startSecs}s` : undefined),

                lessonId: lesson.id || `lesson-${cohort.id}-${seasonIdx}-${lessonIdx}`,
                lessonTitle: lesson.title,
                lessonThumbnail: lesson.thumbnail || cohort.coverImage,
                lessonVideoId: videoId,
                lessonVideoUrl: videoUrl,
                lessonOrder: lessonIdx + 1,
                lessonType: lesson.type || 'video',

                seasonId: season.id || `season-${cohort.id}-${seasonIdx}`,
                seasonTitle: season.title || `Season ${seasonIdx + 1}`,
                seasonOrder: seasonIdx + 1,

                cohortId: cohort.id,
                cohortTitle: cohort.title,
                cohortCoverImage: cohort.coverImage,
                cohortProvider: cohort.creator?.name || 'SideQuestHQ',
              });
            });
          } else {
            // Synthesize single chunk from lesson
            const durSecs = parseDurationToSeconds(lesson.duration);
            chunks.push({
              chunkId: `chunk-${lesson.id}-1`,
              chunkTitle: lesson.title,
              chunkOrder: 1,
              chunkDuration: lesson.duration || '12 min',
              startSeconds: 0,
              endSeconds: durSecs,
              timestampUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}&t=0s` : undefined,

              lessonId: lesson.id,
              lessonTitle: lesson.title,
              lessonThumbnail: lesson.thumbnail || cohort.coverImage,
              lessonVideoId: videoId,
              lessonVideoUrl: videoUrl,
              lessonOrder: lessonIdx + 1,
              lessonType: lesson.type || 'video',

              seasonId: season.id,
              seasonTitle: season.title || `Season ${seasonIdx + 1}`,
              seasonOrder: seasonIdx + 1,

              cohortId: cohort.id,
              cohortTitle: cohort.title,
              cohortCoverImage: cohort.coverImage,
              cohortProvider: cohort.creator?.name || 'SideQuestHQ',
            });
          }
        });
      });
    });

    return chunks;
  },

  getFeed(options?: {
    requestedCohortId?: string;
    requestedLessonId?: string;
    requestedChunkId?: string;
    feedSize?: number;
  }): FeedEngineOutput {
    const allChunks = this.getAllChunks();
    const chunkProgress = loadFeedProgress();
    const cohortStates = loadCohortStates();

    return generateFeed({
      allChunks,
      chunkProgress,
      cohortStates,
      currentTime: new Date(),
      dailyGoalMinutes: 60,
      completedTodayMinutes: 41,
      feedSize: options?.feedSize || 25,
      requestedCohortId: options?.requestedCohortId,
      requestedLessonId: options?.requestedLessonId,
      requestedChunkId: options?.requestedChunkId,
    });
  },

  /**
   * Updates progress for a chunk and syncs with cohortStore to update questline & home
   */
  updateProgress(
    chunkId: string,
    lessonId: string,
    cohortId: string,
    watchedSeconds: number,
    totalSeconds: number,
    options?: {
      forceCompleted?: boolean;
      isPrematureScroll?: boolean;
      bookmarked?: boolean;
      notes?: string;
    },
  ) {
    const progressMap = loadFeedProgress();
    const existing = progressMap[chunkId];

    let status = existing?.status || 'not-started';

    if (options?.forceCompleted) {
      status = 'completed';
    } else if (options?.isPrematureScroll) {
      if (isEligibleForAutoCompletion(watchedSeconds, totalSeconds, 18)) {
        status = 'completed';
      } else if (watchedSeconds > 5 && status !== 'completed') {
        status = 'in-progress';
      }
    } else if (watchedSeconds >= totalSeconds - 5 && totalSeconds > 0) {
      status = 'completed';
    } else if (watchedSeconds > 5 && status !== 'completed') {
      status = 'in-progress';
    }

    const updatedProgress: ChunkProgress = {
      chunkId,
      lessonId,
      cohortId,
      status,
      watchedSeconds,
      totalSeconds,
      lastWatchedAt: new Date().toISOString(),
      bookmarked: options?.bookmarked ?? existing?.bookmarked ?? false,
      notes: options?.notes ?? existing?.notes ?? '',
    };

    progressMap[chunkId] = updatedProgress;
    saveFeedProgress(progressMap);

    // Sync with cohortStore to update Questline and Home progress!
    this.syncProgressToCohortStore(cohortId, lessonId, chunkId, status);

    return updatedProgress;
  },

  toggleBookmark(chunkId: string, lessonId: string, cohortId: string): boolean {
    const progressMap = loadFeedProgress();
    const existing = progressMap[chunkId] || {
      chunkId,
      lessonId,
      cohortId,
      status: 'not-started',
      watchedSeconds: 0,
      totalSeconds: 180,
    };
    existing.bookmarked = !existing.bookmarked;
    progressMap[chunkId] = existing;
    saveFeedProgress(progressMap);
    return existing.bookmarked;
  },

  /**
   * Reflects chunk completion in cohortStore so /cohort/[id]/questline and /home show updated progress
   */
  syncProgressToCohortStore(
    cohortId: string,
    lessonId: string,
    chunkId: string,
    status: 'completed' | 'in-progress' | 'not-started' | 'skipped',
  ) {
    const cohort = cohortStore.getById(cohortId);
    if (!cohort) return;

    let modified = false;

    cohort.questline.seasons.forEach((season) => {
      season.lessons.forEach((lesson) => {
        if (lesson.id === lessonId) {
          // Update chunk if present
          if (lesson.chunks?.length) {
            const targetChunk = lesson.chunks.find((c) => c.id === chunkId);
            if (targetChunk) {
              modified = true;
            }
          }

          // Count total completed chunks for this lesson in progressMap
          const progressMap = loadFeedProgress();
          const completedChunkCount = (lesson.chunks || []).filter(
            (c) => progressMap[c.id]?.status === 'completed',
          ).length;

          lesson.completedChunks = completedChunkCount;

          if (status === 'completed' || completedChunkCount >= (lesson.totalChunks || 1)) {
            lesson.status = LessonStatus.Completed;
            modified = true;
          } else if (lesson.status !== LessonStatus.Completed) {
            lesson.status = LessonStatus.InStream;
            modified = true;
          }
        }
      });

      // Recalculate season progress
      const completedLessons = season.lessons.filter((l) => l.status === LessonStatus.Completed).length;
      season.progress = Math.round((completedLessons / Math.max(1, season.lessons.length)) * 100);
      if (completedLessons === season.lessons.length && season.lessons.length > 0) {
        season.status = SeasonStatus.Completed;
      } else if (completedLessons > 0) {
        season.status = SeasonStatus.InProgress;
      }
    });

    // Recalculate cohort journey progress
    const allLessons = cohort.questline.seasons.flatMap((s) => s.lessons);
    const totalCompleted = allLessons.filter((l) => l.status === LessonStatus.Completed).length;
    cohort.progress.completedQuests = totalCompleted;
    cohort.progress.journeyProgress = Math.round(
      (totalCompleted / Math.max(1, allLessons.length)) * 100,
    );

    if (modified && typeof window !== 'undefined') {
      const userCohorts = cohortStore.getUserCohorts();
      const isUserCohort = userCohorts.some((c) => c.id === cohortId);
      if (isUserCohort) {
        try {
          localStorage.setItem('sidequest_published_cohorts', JSON.stringify(userCohorts));
        } catch {}
      }
    }
  },
};
