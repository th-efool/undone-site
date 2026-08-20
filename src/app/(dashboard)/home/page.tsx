import { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

const Home = dynamic(() => import('@/src/client/screens/dashboard/home').then((mod) => mod.Home));

import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Dashboard | SideQuestHQ',
  description: 'View your progress, active quests, and stats on your SideQuestHQ dashboard.',
  openGraph: {
    title: 'Dashboard | SideQuestHQ',
    description: 'View your progress, active quests, and stats on your SideQuestHQ dashboard.',
    url: 'https://sidequesthq.com/home',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dashboard | SideQuestHQ',
    description: 'View your progress, active quests, and stats on your SideQuestHQ dashboard.',
  }
};

export default async function home() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect('/auth');
  }

  const enrolledCohorts = await prisma.cohortMember.findMany({
    where: { userId },
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
  });

  if (enrolledCohorts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-slate-300">
        You haven't joined any cohorts yet.
      </div>
    );
  }

  const activeCohorts: any[] = [];
  const recentlyCompleted: any[] = [];

  enrolledCohorts.forEach((ec, index) => {
    let totalLessons = 0;
    let completedLessons = 0;

    ec.cohort.seasons.forEach((season) => {
      totalLessons += season.lessons.length;
      season.lessons.forEach((lesson) => {
        if (lesson.progress?.[0]?.status === 'COMPLETED') {
          completedLessons += 1;
        }
      });
    });

    const progressPercent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

    const cohortData = {
      id: `${ec.userId}_${ec.cohortId}`,
      cohortId: ec.cohortId,
      title: ec.cohort.title,
      provider: ec.cohort.creator?.name || 'Unknown',
      thumbnail: ec.cohort.coverImage || '',
      progressPercent,
    };

    if (progressPercent >= 100 && totalLessons > 0) {
      recentlyCompleted.push({
        ...cohortData,
        completedLabel: 'Completed',
      });
    } else {
      activeCohorts.push({
        ...cohortData,
        rank: activeCohorts.length + 1,
        minutesToday: 0,
        dailyGoalMinutes: 30,
        schedule: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as any[], label: 'Weekdays' },
      });
    }
  });

  return <Home activeCohorts={activeCohorts} recentlyCompleted={recentlyCompleted} continueLater={[]} />;
}
