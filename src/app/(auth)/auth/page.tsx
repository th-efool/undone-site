import { Metadata } from 'next';
import dynamic from 'next/dynamic';

const Auth = dynamic(() => import('@/src/client/screens/auth/').then((mod) => mod.Auth));

export const metadata: Metadata = {
  title: 'Sign In | SideQuestHQ',
  description: 'Sign in or create an account to start tracking and completing your side quests.',
  openGraph: {
    title: 'Sign In | SideQuestHQ',
    description: 'Sign in or create an account to start tracking and completing your side quests.',
    url: 'https://sidequesthq.com/auth',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sign In | SideQuestHQ',
    description: 'Sign in or create an account to start tracking and completing your side quests.',
  }
};

export default function AuthPage() {
  return (
    <main>
      <Auth />
    </main>
  );
}
