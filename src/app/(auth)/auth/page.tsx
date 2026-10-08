import { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { safeReturnTo } from '@/src/shared/auth/returnTo';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';

const Auth = dynamic(() => import('@/src/client/screens/auth/').then((mod) => mod.Auth));

export const metadata: Metadata = {
  title: 'Sign In | Undone',
  description: 'Sign in or create an account to start tracking and completing your learning journey.',
  openGraph: {
    title: 'Sign In | Undone',
    description: 'Sign in or create an account to start tracking and completing your learning journey.',
    url: '/auth',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sign In | Undone',
    description: 'Sign in or create an account to start tracking and completing your learning journey.',
  }
};

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  const allowAuthenticatedRedirect = !returnTo.startsWith('/quest/') || Boolean(await getCreationOwner());
  return (
    <main>
      <Auth returnTo={returnTo} allowAuthenticatedRedirect={allowAuthenticatedRedirect} />
    </main>
  );
}
