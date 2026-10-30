import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { ChunkProgressService } from '@/src/server/domain/progress/chunkProgress.service';
import { normalizeCohortId } from './cohortOrder.service';
import { getResumeLabel } from '@/src/client/screens/dashboard/home/utils';
import type {
  ActiveCohort,
  CompletedCourse,
  PausedCohort,
  Weekday,
} from '@/src/client/screens/dashboard/home/models/home';

// Retained chunk progress is canonical and Home derives lesson completion from retained chunks.

export type CompletionRecord = {
  cohortId: string;
  lessonId: string;
  status: string;
};

export function retainedLessonCompleted(
  ids: string[],
  lessonId: string,
  cohortId: string,
  progress: ReadonlyMap<string, CompletionRecord>,
): boolean {
  return (
    ids.length > 0 &&
    ids.every((id) => {
      const saved = progress.get(id);
      return (
        saved?.lessonId === lessonId &&
        saved.cohortId === cohortId &&
        saved.status === 'COMPLETED'
      );
    })
  );
}

export function isLessonCompleted(
  lesson: {
    id: string;
    chunks?: unknown;
    progress?: Array<{ status: string }>;
  },
  cohortId: string,
  progressMap: ReadonlyMap<string, CompletionRecord>,
): boolean {
  const rawChunks = lesson.chunks;
  // No retained chunks: preserve an existing Postgres LessonProgress completion for legacy lesson
  if (
    rawChunks === null ||
    rawChunks === undefined ||
    (Array.isArray(rawChunks) && rawChunks.length === 0)
  ) {
    return lesson.progress?.[0]?.status === 'COMPLETED';
  }

  // Malformed retained chunk IDs: count the lesson as incomplete/unavailable, never vacuously complete
  if (!Array.isArray(rawChunks)) {
    return false;
  }

  const ids: string[] = [];
  for (const raw of rawChunks) {
    if (!raw || typeof raw !== 'object') {
      return false; // Malformed chunk item
    }
    const chunkObj = raw as Record<string, unknown>;
    const rawId = chunkObj.id ?? chunkObj.chunkId;
    if (typeof rawId !== 'string' && typeof rawId !== 'number') {
      return false; // Malformed ID
    }
    const idStr = String(rawId).trim();
    if (idStr.length === 0 || idStr.length > 128) {
      return false; // Empty or oversized ID
    }
    ids.push(idStr);
  }

  if (ids.length === 0) {
    return false;
  }

  const uniqueIds = Array.from(new Set(ids));
  return retainedLessonCompleted(uniqueIds, lesson.id, cohortId, progressMap);
}

export interface HomeServerPayload {
  activeCohorts: ActiveCohort[];
  recentlyCompleted: CompletedCourse[];
  continueLater: PausedCohort[];
}

export async function loadHomeForUser(userId: string): Promise<HomeServerPayload> {
  const cohortSummarySelect = {
    id: true,
    title: true,
    coverImage: true,
    creator: {
      select: {
        name: true,
      },
    },
    seasons: {
      select: {
        lessons: {
          select: {
            id: true,
            chunks: true,
            progress: {
              where: { userId },
              select: { status: true },
            },
          },
        },
      },
    },
  } as const;

  const [membersRes, cohortsRes] = await Promise.all([
    prisma.cohortMember.findMany({
      where: { userId, cohort: accessibleCohortWhere(userId) },
      select: {
        userId: true,
        cohortId: true,
        cohort: {
          select: cohortSummarySelect,
        },
      },
    }),
    prisma.cohort.findMany({
      where: {
        creatorId: userId,
      },
      select: cohortSummarySelect,
    }),
  ]);

  const enrolledMembers = membersRes;
  const enrolledCohortIds = new Set(enrolledMembers.map((em) => em.cohortId));
  const createdCohorts = cohortsRes.filter((c) => !enrolledCohortIds.has(c.id));

  const allUserCohorts = [
    ...enrolledMembers.map((em) => ({
      userId: em.userId,
      cohortId: em.cohortId,
      cohort: em.cohort,
    })),
    ...createdCohorts.map((c) => ({
      userId,
      cohortId: c.id,
      cohort: c,
    })),
  ];

  const allChunkIdsSet = new Set<string>();
  for (const item of allUserCohorts) {
    for (const season of item.cohort.seasons) {
      for (const lesson of season.lessons) {
        if (Array.isArray(lesson.chunks)) {
          for (const raw of lesson.chunks) {
            if (raw && typeof raw === 'object') {
              const chunkObj = raw as Record<string, unknown>;
    const rawId = chunkObj.id ?? chunkObj.chunkId;
              if (typeof rawId === 'string' || typeof rawId === 'number') {
                const s = String(rawId).trim();
                if (s.length > 0 && s.length <= 128) {
                  allChunkIdsSet.add(s);
                }
              }
            }
          }
        }
      }
    }
  }
  const allChunkIds = Array.from(allChunkIdsSet);

  const [userCohortConfigs, progressMap] = await Promise.all([
    (async () => {
      const { connectToMongoDB } = await import('@/src/server/infrastructure/db/mongodb/client');
      const { UserCohortConfig } = await import('@/src/server/database/mongo/models/UserCohortConfig');
      await connectToMongoDB();
      return await UserCohortConfig.find({ userId }).lean().exec();
    })(),
    allChunkIds.length > 0
      ? ChunkProgressService.getUserProgressMap(userId, allChunkIds)
      : Promise.resolve(new Map<string, CompletionRecord>()),
  ]);

  type MongoCohortConfig = {
    cohortId?: string;
    rank?: number;
    isHidden?: boolean;
    isPaused?: boolean;
    pausedUntil?: Date | string | null;
    pausedReason?: string | null;
    dailyGoalMinutes?: number;
    scheduleDays?: string[];
    scheduleLabel?: string;
    frequency?: string;
    orderStyle?: string;
    learningSettings?: Record<string, unknown>;
  };
  const configMap = new Map<string, MongoCohortConfig>();
  for (const cfg of userCohortConfigs) {
    if (cfg.cohortId) {
      configMap.set(cfg.cohortId, cfg);
      const cleanId = normalizeCohortId(cfg.cohortId, userId);
      if (!configMap.has(cleanId)) configMap.set(cleanId, cfg);
    }
  }

  const activeCohorts: ActiveCohort[] = [];
  const recentlyCompleted: CompletedCourse[] = [];
  const continueLater: PausedCohort[] = [];
  const now = new Date();

  for (const ec of allUserCohorts) {
    let totalLessons = 0;
    let completedLessons = 0;

    for (const season of ec.cohort.seasons) {
      totalLessons += season.lessons.length;
      for (const lesson of season.lessons) {
        if (isLessonCompleted(lesson, ec.cohortId, progressMap as ReadonlyMap<string, CompletionRecord>)) {
          completedLessons += 1;
        }
      }
    }

    const progressPercent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
    const cohortId = ec.cohortId;
    const cfg = configMap.get(cohortId);
    if (cfg?.isHidden) continue;

    const cohortData = {
      id: cohortId,
      cohortId: cohortId,
      title: ec.cohort.title,
      provider: ec.cohort.creator?.name || 'Unknown',
      thumbnail: ec.cohort.coverImage || '/images/landing/screen.webp',
      progressPercent,
    };

    if (progressPercent >= 100 && totalLessons > 0) {
      recentlyCompleted.push({
        ...cohortData,
        completedLabel: 'Completed',
      });
      continue;
    }

    const isPaused = Boolean(cfg?.isPaused);
    const pausedUntil = cfg?.pausedUntil ? new Date(cfg.pausedUntil) : null;
    const isStillPaused = isPaused && (!pausedUntil || pausedUntil > now);

    const dailyGoalMinutes =
      typeof cfg?.dailyGoalMinutes === 'number' && cfg.dailyGoalMinutes > 0
        ? cfg.dailyGoalMinutes
        : 20;
    const scheduleDays =
      Array.isArray(cfg?.scheduleDays) && cfg.scheduleDays.length > 0
        ? cfg.scheduleDays
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const scheduleLabel = cfg?.scheduleLabel || (scheduleDays.length === 7 ? 'Everyday' : 'Weekdays');
    const frequency = cfg?.frequency || 'Often';
    const orderStyle = cfg?.orderStyle || 'Sequential';
    const rank = typeof cfg?.rank === 'number' ? cfg.rank : 999;

    if (isStillPaused) {
      continueLater.push({
        ...cohortData,
        rank,
        minutesToday: 0,
        dailyGoalMinutes,
        schedule: { days: scheduleDays as Weekday[], label: scheduleLabel },
        frequency: frequency as PausedCohort['frequency'],
        orderStyle: orderStyle as PausedCohort['orderStyle'],
        pausedUntil: pausedUntil ? pausedUntil.toISOString() : undefined,
        pausedReason: cfg?.pausedReason || 'Paused by user',
        resumeLabel: pausedUntil ? getResumeLabel(pausedUntil) : 'Paused',
      });
    } else {
      activeCohorts.push({
        ...cohortData,
        rank,
        minutesToday: 0,
        dailyGoalMinutes,
        schedule: { days: scheduleDays as Weekday[], label: scheduleLabel },
        frequency: frequency as ActiveCohort['frequency'],
        orderStyle: orderStyle as ActiveCohort['orderStyle'],
      });
    }
  }

  // Sort active cohorts by rank ASC
  activeCohorts.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  // Sort continueLater by rank ASC
  continueLater.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  return {
    activeCohorts,
    recentlyCompleted,
    continueLater,
  };
}
