import { Suspense } from 'react';
import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { Metadata } from 'next';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { Home } from '@/src/client/screens/dashboard/home';
import { getResumeLabel } from '@/src/client/screens/dashboard/home/utils';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'View your progress, active quests, and stats on your Undone dashboard.',
  openGraph: {
    title: 'Undone > Dashboard',
    description: 'View your progress, active quests, and stats on your Undone dashboard.',
    url: 'https://undone.in/home',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Undone > Dashboard',
    description: 'View your progress, active quests, and stats on your Undone dashboard.',
  }
};

type CachedHomeServerPayload = {
  activeCohorts: any[];
  recentlyCompleted: any[];
  continueLater: any[];
  expiresAt: number;
};

const HOME_SERVER_CACHE_TTL_MS = 30_000;

const globalForHomeCache = globalThis as unknown as {
  __undoneHomeServerCache?: Map<string, CachedHomeServerPayload>;
};

function getHomeServerCache(): Map<string, CachedHomeServerPayload> {
  if (!globalForHomeCache.__undoneHomeServerCache) {
    globalForHomeCache.__undoneHomeServerCache = new Map();
  }
  return globalForHomeCache.__undoneHomeServerCache;
}

async function loadHomeCohortsForUser(userId: string) {
  if (process.env.NODE_ENV !== 'test') {
    const cached = getHomeServerCache().get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }
  }

  let enrolledMembers: any[] = [];
  let createdCohorts: any[] = [];
  let userCohortConfigs: any[] = [];

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
            progress: {
              where: { userId },
              select: { status: true },
            },
          },
        },
      },
    },
  } as const;

  const [pgResult, mongoResult] = await Promise.all([
    Promise.all([
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
    ]).catch((error) => {
      console.warn('[home] Failed to load cohorts from Postgres:', error);
      return [[], []] as [any[], any[]];
    }),
    (async () => {
      if (!process.env.MONGODB_URI || process.env.NODE_ENV === 'test') return [];
      try {
        const [{ connectToMongoDB }, { UserCohortConfig }] = await Promise.all([
          import('@/src/server/infrastructure/db/mongodb/client'),
          import('@/src/server/database/mongo/models/UserCohortConfig'),
        ]);
        await connectToMongoDB();
        return await UserCohortConfig.find({ userId }).lean().exec();
      } catch (mongoError) {
        console.warn('[home] Failed to load cohort configs from MongoDB:', mongoError);
        return [];
      }
    })(),
  ]);

  const [membersRes, cohortsRes] = pgResult;
  enrolledMembers = membersRes;
  const enrolledCohortIds = new Set(enrolledMembers.map((em) => em.cohortId));
  createdCohorts = cohortsRes.filter((c) => !enrolledCohortIds.has(c.id));
  userCohortConfigs = mongoResult;

  const configMap = new Map<string, any>();
  for (const cfg of userCohortConfigs) {
    if (cfg.cohortId) {
      configMap.set(cfg.cohortId, cfg);
      if (cfg.cohortId.includes('_')) {
        const parts = cfg.cohortId.split('_');
        const rawId = parts[parts.length - 1];
        if (!configMap.has(rawId)) configMap.set(rawId, cfg);
      }
    }
  }

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

  const activeCohorts: any[] = [];
  const recentlyCompleted: any[] = [];
  const continueLater: any[] = [];
  const now = new Date();

  allUserCohorts.forEach((ec) => {
    let totalLessons = 0;
    let completedLessons = 0;

    ec.cohort.seasons.forEach((season: any) => {
      totalLessons += season.lessons.length;
      season.lessons.forEach((lesson: any) => {
        if (lesson.progress?.[0]?.status === 'COMPLETED') {
          completedLessons += 1;
        }
      });
    });

    const progressPercent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
    const cohortId = ec.cohortId;
    const cfg = configMap.get(cohortId);
    if (cfg?.isHidden) return;

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
      return;
    }

    const isPaused = Boolean(cfg?.isPaused);
    const pausedUntil = cfg?.pausedUntil ? new Date(cfg.pausedUntil) : null;
    const isStillPaused = isPaused && (!pausedUntil || pausedUntil > now);

    const dailyGoalMinutes = typeof cfg?.dailyGoalMinutes === 'number' && cfg.dailyGoalMinutes > 0
      ? cfg.dailyGoalMinutes
      : 20;
    const scheduleDays = Array.isArray(cfg?.scheduleDays) && cfg.scheduleDays.length > 0
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
        schedule: { days: scheduleDays, label: scheduleLabel },
        frequency,
        orderStyle,
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
        schedule: { days: scheduleDays, label: scheduleLabel },
        frequency,
        orderStyle,
      });
    }
  });

  // Sort active cohorts by rank ASC, normalizing ranks to 1, 2, 3...
  activeCohorts.sort((a, b) => a.rank - b.rank);

  const payload: CachedHomeServerPayload = {
    activeCohorts,
    recentlyCompleted,
    continueLater,
    expiresAt: Date.now() + HOME_SERVER_CACHE_TTL_MS,
  };

  if (process.env.NODE_ENV !== 'test') {
    getHomeServerCache().set(userId, payload);
  }

  return payload;
}

async function HomeCohortsLoader({ userId, userName }: { userId: string; userName?: string }) {
  const { activeCohorts, recentlyCompleted, continueLater } = await loadHomeCohortsForUser(userId);
  return (
    <Home
      activeCohorts={activeCohorts}
      recentlyCompleted={recentlyCompleted}
      continueLater={continueLater}
      userName={userName}
    />
  );
}

export default async function home() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect('/auth');
  }

  const userName = session?.user?.name || undefined;

  if (process.env.NODE_ENV === 'test') {
    const { activeCohorts, recentlyCompleted, continueLater } = await loadHomeCohortsForUser(userId);
    return (
      <Home
        activeCohorts={activeCohorts}
        recentlyCompleted={recentlyCompleted}
        continueLater={continueLater}
        userName={userName}
      />
    );
  }

  return (
    <Suspense fallback={<Home userName={userName} />}>
      <HomeCohortsLoader userId={userId} userName={userName} />
    </Suspense>
  );
}
