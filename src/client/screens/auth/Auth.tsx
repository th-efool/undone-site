'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import styles from './Auth.module.css';
import AuthShowcase from './authShowcase/authShowcase';
import { AuthForm } from './authForm/authForm';

export function Auth() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/home');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (status === 'authenticated') {
    return null;
  }

  return (
    <section className={styles.auth}>
      <div className={styles.showcase}>
        <AuthShowcase />
      </div>
      <aside className={styles.panel}>
        <AuthForm />
      </aside>
    </section>
  );
}
