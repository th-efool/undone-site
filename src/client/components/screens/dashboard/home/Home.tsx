'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SearchBar } from '@/src/client/components/global/SearchBar';

import { ActiveCohorts } from './components/ActiveCohorts/ActiveCohorts';
import { ContinueLater } from './components/ContinueLater/ContinueLater';
import { HomeHero } from './components/HomeHero/HomeHero';
import { RecentlyCompleted } from './components/RecentlyCompleted/RecentlyCompleted';
import { SummaryCards } from './components/SummaryCards/SummaryCards';
import { useHome } from './hooks/useHome';

import styles from './Home.module.css';

export function Home() {
  const home = useHome();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

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

  return (
    <main className={styles.home}>
      <SearchBar
        className={styles.searchBar}
        value={query}
        onChange={setQuery}
        placeholder={home.searchPlaceholder}
      />

      <HomeHero content={home.hero} />

      <SummaryCards items={home.summaries} />

      {debouncedQuery && !hasResults && (
        <div className={styles.emptyState}>No home results found for “{query}”.</div>
      )}

      <ActiveCohorts
        heading={home.sections.activeCohorts}
        items={activeCohorts}
        pauseOptions={home.pauseOptions}
        onReorder={home.actions.moveCohort}
        onUpdateDailyGoal={home.actions.saveDailyGoal}
        onUpdateSchedule={home.actions.saveSchedule}
        onPause={home.actions.pauseActiveCohort}
      />

      <ContinueLater
        heading={home.sections.continueLater}
        items={continueLater}
        onResume={home.actions.resumePausedCohort}
      />

      <RecentlyCompleted
        heading={home.sections.recentlyCompleted}
        items={recentlyCompleted}
      />
    </main>
  );
}
