import { Metadata } from 'next';
import dynamic from 'next/dynamic';

const Home = dynamic(() => import('@/src/client/components/screens/dashboard/home').then((mod) => mod.Home));

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

export default function home() {
  return (
    <main>
      <Home />
    </main>
  );
}
