import { Metadata } from 'next';
import dynamic from 'next/dynamic';

const Auth = dynamic(() => import('@/src/client/screens/auth/').then((mod) => mod.Auth));

export const metadata: Metadata = {
  title: 'Sign In | Undone',
  description: 'Sign in or create an account to start tracking and completing your learning journey.',
  openGraph: {
    title: 'Sign In | Undone',
    description: 'Sign in or create an account to start tracking and completing your learning journey.',
    url: 'https://undone.com/auth',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sign In | Undone',
    description: 'Sign in or create an account to start tracking and completing your learning journey.',
  }
};

export default function AuthPage() {
  return (
    <main>
      <Auth />
    </main>
  );
}
