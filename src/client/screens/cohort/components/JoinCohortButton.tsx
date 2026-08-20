'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './JoinCohortButton.module.css';

interface JoinCohortButtonProps {
  cohortId: string;
  isLoggedIn: boolean;
}

export function JoinCohortButton({ cohortId, isLoggedIn }: JoinCohortButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async () => {
    if (!isLoggedIn) {
      router.push('/auth');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/cohort/${cohortId}/join`, {
        method: 'POST',
      });
      if (response.ok) {
        router.refresh();
      } else {
        console.error('Failed to join cohort');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleJoin}
      disabled={isLoading}
      className={styles.button}
    >
      {isLoading ? 'Joining...' : 'Join Cohort'}
    </button>
  );
}
