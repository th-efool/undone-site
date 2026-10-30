import { Suspense } from 'react';
import { Metadata } from 'next';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { Home } from '@/src/client/screens/dashboard/home';
import { HomeLoading } from '@/src/client/screens/dashboard/home/HomeLoading';
import { redirect } from 'next/navigation';
import { loadHomeForUser } from '@/src/server/domain/home/home.service';

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
  },
};

async function HomeCohortsLoader({ userId, userName }: { userId: string; userName?: string }) {
  const { activeCohorts, recentlyCompleted, continueLater } = await loadHomeForUser(userId);
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
  const user = await getUser();
  const userId = user?.id;

  if (!userId) {
    redirect('/auth');
  }

  const userName = user?.name || undefined;

  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeCohortsLoader userId={userId} userName={userName} />
    </Suspense>
  );
}
