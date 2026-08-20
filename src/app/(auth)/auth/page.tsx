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

import { signIn } from '@/src/server/infrastructure/auth/auth.config';

export default function AuthPage() {
  const handleGuestSignIn = async () => {
    'use server';
    await signIn('credentials', { 
      email: 'guest@sidequesthq.com', 
      callbackUrl: '/home',
      redirectTo: '/home'
    });
  };

  return (
    <main>
      <Auth />
      <div className="flex justify-center mt-4 pb-8">
        <form action={handleGuestSignIn}>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition font-medium">
            Sign in as Guest
          </button>
        </form>
      </div>
    </main>
  );
}
