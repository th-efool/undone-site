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
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = React.useRef(false);

  const handleJoin = async () => {
    if (!isLoggedIn) {
      router.push(creationSignInUrl(`/cohort/${encodeURIComponent(cohortId)}`));
      return;
    }

    if (pending.current) return;
    pending.current = true;
    setIsLoading(true);
    setIsJoined(true);
    setError(null);

    try {
      const response = await fetch(apiUrl(`/api/cohort/${encodeURIComponent(cohortId)}/join`), {
        method: 'POST',
        credentials: 'include',
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) {
        router.refresh();
      } else {
        setIsJoined(false);
        if (response.status === 401) {
          router.push(creationSignInUrl(`/cohort/${encodeURIComponent(cohortId)}`));
        } else {
          setError(
            response.status === 404 || response.status === 403
              ? 'This cohort is no longer available to join.'
              : 'Joining failed. Try again.',
          );
        }
      }
    } catch {
      setIsJoined(false);
      setError('Joining could not be confirmed. Reload the cohort to check your membership before retrying.');
    } finally {
      setIsLoading(false);
      pending.current = false;
    }
  };

  const buttonText = isJoined ? 'Joined ✓' : isLoading ? 'Joining...' : 'Join Cohort';

  return (
    <>
      <button
        onClick={handleJoin}
        disabled={isJoined || isLoading}
        className={`${styles.button} ${isJoined ? styles.buttonJoined : ''}`}
      >
        {buttonText}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
