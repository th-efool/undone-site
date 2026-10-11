'use client';

import { useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import styles from './Auth.module.css';
import AuthShowcase from './authShowcase/authShowcase';
import { AuthForm } from './authForm/authForm';
import { safeReturnTo } from '@/src/shared/auth/returnTo';

export function Auth({ returnTo = '/home', allowAuthenticatedRedirect = true, signInError = null }: { returnTo?: string; allowAuthenticatedRedirect?: boolean; signInError?: string | null }) {
  const destination = safeReturnTo(returnTo);
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && allowAuthenticatedRedirect) {
      router.replace(destination);
      router.refresh();
    }
  }, [status, router, destination, allowAuthenticatedRedirect]);

  if (status === 'loading') {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (status === 'authenticated' && allowAuthenticatedRedirect) {
    return null;
  }

  return (
    <section className={styles.auth}>
      <div className={styles.showcase}>
        <AuthShowcase />
      </div>
      <aside className={styles.panel}>
        {signInError && <p role="alert">{signInError}</p>}
        {status === 'authenticated' && !allowAuthenticatedRedirect && <p>Your session has no saved account. Sign out, then sign in again to save your draft.
          <button type="button" onClick={() => signOut({ redirectTo: `/auth?returnTo=${encodeURIComponent(destination)}` })}>Sign out and retry</button>
        </p>}
        <AuthForm returnTo={destination} />
      </aside>
    </section>
  );
}
