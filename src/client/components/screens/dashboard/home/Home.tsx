'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HomeSkeleton } from '@/src/client/components/global/Skeleton';
import { EmptyState } from '@/src/client/components/global/EmptyState';

import { ActiveCohorts } from './components/ActiveCohorts/ActiveCohorts';
import { ContinueLater } from './components/ContinueLater/ContinueLater';
import { HomeHero } from './components/HomeHero/HomeHero';
import { HomeSummaryBar } from './components/HomeSummaryBar/HomeSummaryBar';
import { RecentlyCompleted } from './components/RecentlyCompleted/RecentlyCompleted';
import { useHome } from './hooks/useHome';

import styles from './Home.module.css';

export function Home() {
  const home = useHome();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isPausedOpen, setIsPausedOpen] = useState(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const matches = useCallback(
    (values: string[]) =>
      !debouncedQuery || values.some((value) => value.toLowerCase().includes(debouncedQuery)),
    [debouncedQuery],
  );
  const activeCohorts = useMemo(
    () => home.activeCohorts.filter((item) => matches([item.title, item.provider])),
    [home.activeCohorts, matches],
  );
  const continueLater = useMemo(
    () =>
      home.continueLater.filter((item) =>
        matches([item.title, item.provider, item.pausedReason ?? '']),
      ),
    [home.continueLater, matches],
  );
  const recentlyCompleted = useMemo(
    () => home.recentlyCompleted.filter((item) => matches([item.title])),
    [home.recentlyCompleted, matches],
  );
  const hasResults = activeCohorts.length + continueLater.length + recentlyCompleted.length > 0;

  if (home.loading) {
    return <HomeSkeleton />;
  }

  const showPausedList = isPausedOpen || Boolean(debouncedQuery);
  const showCompletedList = isCompletedOpen || Boolean(debouncedQuery);

  return (
    <main className={styles.home}>
      <HomeHero
        content={home.hero}
        summaries={home.summaries}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={home.searchPlaceholder}
      />

      {debouncedQuery && !hasResults && (
        <EmptyState
          query={query}
          title={`No results for "${query}"`}
          description="Try searching with different keywords or browse all your cohorts."
          ctaLabel="Browse all cohorts"
          ctaHref="/explore"
        />
      )}

      <ActiveCohorts
        heading={home.sections.activeCohorts}
        items={activeCohorts}
        pauseOptions={home.pauseOptions}
        onReorder={home.actions.moveCohort}
        onUpdateDailyGoal={home.actions.saveDailyGoal}
        onUpdateSchedule={home.actions.saveSchedule}
        onPause={home.actions.pauseActiveCohort}
        onUpdateOrderStyle={home.actions.saveOrderStyle}
        onUpdateFrequency={home.actions.saveFrequency}
      />

      <HomeSummaryBar
        pausedItems={home.continueLater}
        completedItems={home.recentlyCompleted}
        isPausedOpen={showPausedList}
        isCompletedOpen={showCompletedList}
        onTogglePaused={() => setIsPausedOpen((prev) => !prev)}
        onToggleCompleted={() => setIsCompletedOpen((prev) => !prev)}
      />

      {showPausedList && (
        <ContinueLater
          heading={home.sections.continueLater}
          items={continueLater}
          onResume={home.actions.resumePausedCohort}
        />
      )}

      {showCompletedList && (
        <RecentlyCompleted
          heading={home.sections.recentlyCompleted}
          items={recentlyCompleted}
        />
      )}
    </main>
  );
}

