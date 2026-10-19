import { Metadata } from 'next';
import { Auth } from '@/src/client/screens/auth';
import { authReturnTo } from '@/src/shared/auth/returnTo';
import { headers } from 'next/headers';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { signInErrorMessage } from '@/src/shared/auth/signInError';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in or create an account to start tracking and completing your learning journey.',
  openGraph: {
    title: 'Undone > Sign In',
    description: 'Sign in or create an account to start tracking and completing your learning journey.',
    url: '/auth',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Undone > Sign In',
    description: 'Sign in or create an account to start tracking and completing your learning journey.',
  }
};

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; callbackUrl?: string; error?: string }> }) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https';
  const returnTo = authReturnTo(params.returnTo, params.callbackUrl, `${protocol}://${host}`);
  const user = await getUser();
  const allowAuthenticatedRedirect = !user || !returnTo.startsWith('/quest/') || Boolean(await getCreationOwner());
  return (
    <main>
      <Auth returnTo={returnTo} allowAuthenticatedRedirect={allowAuthenticatedRedirect} signInError={signInErrorMessage(params.error)} />
    </main>
  );
}
