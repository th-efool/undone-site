'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import styles from './Auth.module.css';
import AuthShowcase from './authShowcase/authShowcase';
import { AuthForm } from './authForm/authForm';
import { safeReturnTo } from '@/src/shared/auth/returnTo';

export function Auth({ returnTo = '/home', allowAuthenticatedRedirect = true }: { returnTo?: string; allowAuthenticatedRedirect?: boolean }) {
  const destination = safeReturnTo(returnTo);
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && allowAuthenticatedRedirect) {
      router.replace(destination);
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
        {status === 'authenticated' && !allowAuthenticatedRedirect && <p>Sign in with a database-backed account to save your draft.</p>}
        <AuthForm returnTo={destination} />
      </aside>
    </section>
  );
}
