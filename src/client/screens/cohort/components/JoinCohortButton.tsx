'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './JoinCohortButton.module.css';
import { creationSignInUrl } from '@/src/shared/auth/returnTo';
import { apiUrl } from '@/src/shared/api/apiUrl';

interface JoinCohortButtonProps {
  cohortId: string;
  isLoggedIn: boolean;
}

export function JoinCohortButton({ cohortId, isLoggedIn }: JoinCohortButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = React.useRef(false);

  const handleJoin = async () => {
    if (!isLoggedIn) {
      router.push(creationSignInUrl(`/cohort/${encodeURIComponent(cohortId)}`));
      return;
    }

    if (pending.current) return;
    pending.current = true; setIsLoading(true); setError(null);
    try {
      const response = await fetch(apiUrl(`/api/cohort/${encodeURIComponent(cohortId)}/join`), {
        method: 'POST', credentials: 'include', signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) {
        router.refresh();
      } else if (response.status === 401) {
        router.push(creationSignInUrl(`/cohort/${encodeURIComponent(cohortId)}`));
      } else {
        setError(response.status === 404 || response.status === 403 ? 'This cohort is no longer available to join.' : 'Joining failed. Try again.');
      }
    } catch {
      setError('Joining could not be confirmed. Reload the cohort to check your membership before retrying.');
    } finally {
      setIsLoading(false);
      pending.current = false;
    }
  };

  return (
    <><button
      onClick={handleJoin}
      disabled={isLoading}
      className={styles.button}
    >
      {isLoading ? 'Joining...' : 'Join Cohort'}
    </button>{error && <p role="alert">{error}</p>}</>
  );
}
