import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { getResumeLabel } from '@/src/client/screens/dashboard/home/utils';
import { redirect } from 'next/navigation';

const Home = dynamic(() => import('@/src/client/screens/dashboard/home').then((mod) => mod.Home));

export const metadata: Metadata = {
  title: 'Dashboard | Undone',
  description: 'View your progress, active quests, and stats on your Undone dashboard.',
  openGraph: {
    title: 'Dashboard | Undone',
    description: 'View your progress, active quests, and stats on your Undone dashboard.',
    url: 'https://undone.in/home',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dashboard | Undone',
    description: 'View your progress, active quests, and stats on your Undone dashboard.',
  }
};

export default async function home() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect('/auth');
  }

  let enrolledMembers: any[] = [];
  let createdCohorts: any[] = [];
  let userCohortConfigs: any[] = [];

  try {
    const [membersRes, cohortsRes] = await Promise.all([
      prisma.cohortMember.findMany({
        where: { userId, cohort: accessibleCohortWhere(userId) },
        include: { 
          cohort: { 
            include: { 
              creator: true,
              seasons: {
                include: {
                  lessons: {
                    include: {
                      progress: {
                        where: { userId }
                      }
                    }
                  }
                }
              }
            }
          } 
        },
      }),
      prisma.cohort.findMany({
        where: {
          creatorId: userId,
        },
        include: {
          creator: true,
          seasons: {
            include: {
              lessons: {
                include: {
                  progress: {
                    where: { userId }
                  }
                }
              }
            }
          }
        }
      }),
    ]);

    enrolledMembers = membersRes;
    const enrolledCohortIds = new Set(enrolledMembers.map((em) => em.cohortId));
    createdCohorts = cohortsRes.filter((c) => !enrolledCohortIds.has(c.id));
  } catch (error) {
    console.warn('[home] Failed to load cohorts from Postgres:', error);
  }

  try {
    const { connectToMongoDB } = await import('@/src/server/infrastructure/db/mongodb/client');
    await connectToMongoDB();
    const { UserCohortConfig } = await import('@/src/server/database/mongo/models/UserCohortConfig');
    userCohortConfigs = await UserCohortConfig.find({ userId }).lean().exec();
  } catch (mongoError) {
    console.warn('[home] Failed to load cohort configs from MongoDB:', mongoError);
  }

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

  if (allUserCohorts.length === 0) {
    return <Home activeCohorts={[]} recentlyCompleted={[]} continueLater={[]} userName={session?.user?.name || undefined} />;
  }

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
  activeCohorts.forEach((c, idx) => {
    c.rank = idx + 1;
  });

  return <Home activeCohorts={activeCohorts} recentlyCompleted={recentlyCompleted} continueLater={continueLater} userName={session?.user?.name || undefined} />;
}
