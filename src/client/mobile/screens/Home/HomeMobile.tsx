'use client';

import { useState, useCallback } from 'react';
import { ActiveCohorts } from '@/src/client/screens/dashboard/home/components/ActiveCohorts/ActiveCohorts';
import { ChannelHub } from '@/src/client/screens/dashboard/home/components/ChannelHub/ChannelHub';
import { RecentlyCompleted } from '@/src/client/screens/dashboard/home/components/RecentlyCompleted/RecentlyCompleted';
import { getSubscribedCohorts } from '@/src/client/screens/dashboard/home/utils';
import type { UseHomeResult } from '@/src/client/screens/dashboard/home/hooks/useHome';

import styles from './HomeMobile.module.css';

interface HomeMobileProps {
  model: UseHomeResult;
}

export function HomeMobile({ model: home }: HomeMobileProps) {
  const [query, setQuery] = useState('');
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);

  const handlePause = useCallback(
    (cohortId: string, pausedUntil?: Date, reason?: string) =>
      home.actions.pauseActiveCohort(cohortId, pausedUntil, reason),
    [home.actions],
  );

  const allSubscribed = getSubscribedCohorts(home.activeCohorts, home.continueLater);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredCohorts = normalizedQuery
    ? allSubscribed.filter(
        (cohort) =>
          cohort.title.toLowerCase().includes(normalizedQuery) ||
          cohort.provider.toLowerCase().includes(normalizedQuery),
      )
    : allSubscribed;

  return (
    <main className={styles.mobileHome}>
      <header className={styles.header}>
        <h1 className={styles.greeting}>{home.hero.title || 'Welcome Back'}</h1>
        <p className={styles.subtitle}>{home.hero.subtitle || 'Ready to resume your learning quest?'}</p>
        <div className={styles.searchContainer}>
          <input
            type="text"
            className={styles.searchInput}
            aria-label="Search cohorts"
            placeholder={home.searchPlaceholder || 'Search cohorts…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </header>

      <ChannelHub />

      {home.syncError && (
        <p role="alert" className={styles.errorAlert}>
          {home.syncError}
        </p>
      )}

      {normalizedQuery && filteredCohorts.length === 0 ? (
        <div className={styles.noMatches}>
          <p>No matching cohorts found.</p>
        </div>
      ) : (
        <ActiveCohorts
          heading={home.sections.activeCohorts}
          items={filteredCohorts}
          isLoading={home.loading && allSubscribed.length === 0}
          mutationPending={home.mutationPending}
          onPause={handlePause}
          onResume={home.actions.resumePausedCohort}
          onSave={home.actions.saveLearningSettings}
          onDelete={home.actions.removeSubscribedCohort}
        />
      )}

      {home.recentlyCompleted.length > 0 && (
        <RecentlyCompleted
          heading={home.sections.recentlyCompleted}
          items={home.recentlyCompleted}
          isOpen={isCompletedOpen}
          onToggle={() => setIsCompletedOpen((open) => !open)}
        />
      )}
    </main>
  );
}
