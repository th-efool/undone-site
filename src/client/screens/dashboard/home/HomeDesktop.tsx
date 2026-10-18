'use client';

import { homeStorageAdapter } from '@/src/client/repositories/homeStorageAdapter';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { HomeSkeleton } from '@/src/client/components/global/Skeleton';
import { EmptyState } from '@/src/client/components/global/EmptyState';

import { ActiveCohorts } from './components/ActiveCohorts/ActiveCohorts';
import { ContinueLater } from './components/ContinueLater/ContinueLater';
import { ChannelHub } from './components/ChannelHub/ChannelHub';
import { HomeHero } from './components/HomeHero/HomeHero';
import { HomeSummaryBar } from './components/HomeSummaryBar/HomeSummaryBar';
import { RecentlyCompleted } from './components/RecentlyCompleted/RecentlyCompleted';
import { UpcomingEvents } from '@/src/client/components/global/UpcomingEvents';
import { HomeStreakWidget } from './components/HomeStreakWidget';
import { LearningPromptBar } from '@/src/client/components/global/LearningPromptBar';
import { SearchBar } from '@/src/client/components/global/SearchBar';
import { StudyRooms } from '@/src/client/components/global/StudyRooms';
import { messageMock } from '@/src/client/screens/dashboard/message/mock/message.mock';
import type { UseHomeResult } from './hooks/useHome';

import styles from './Home.module.css';

interface HomeDesktopProps {
  model: UseHomeResult;
  userName?: string;
}

export function HomeDesktop({ model: home, userName }: HomeDesktopProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isPausedOpen, setIsPausedOpen] = useState(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);

  useEffect(() => {
    setIsPausedOpen(homeStorageAdapter.getStoredPausedOpen());
    setIsCompletedOpen(homeStorageAdapter.getStoredCompletedOpen());

    let initialQ = '';
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const q = params.get('q');
        if (q && q.trim()) initialQ = q.trim();
      } catch {}
    }
    if (!initialQ) {
      initialQ = homeStorageAdapter.getStoredSearchQuery();
    }
    if (initialQ) {
      setQuery(initialQ);
      setDebouncedQuery(initialQ.trim().toLowerCase());
    }

    const onPopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const q = params.get('q') || '';
        setQuery(q);
      } catch {}
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const normalized = query.trim().toLowerCase();
    const timer = window.setTimeout(() => {
      setDebouncedQuery((prev) => (prev === normalized ? prev : normalized));
      homeStorageAdapter.saveSearchQuery(query);
      if (typeof window !== 'undefined') {
        try {
          const url = new URL(window.location.href);
          if (query.trim()) {
            url.searchParams.set('q', query.trim());
          } else {
            url.searchParams.delete('q');
          }
          window.history.replaceState(null, '', url.toString());
        } catch {}
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Clean memoized filtering: when debouncedQuery is empty, preserves exact source references
  // avoiding any array reallocation or downstream component re-renders
  const activeCohorts = useMemo(() => {
    if (!debouncedQuery) return home.activeCohorts;
    return home.activeCohorts.filter(
      (item) =>
        item.title.toLowerCase().includes(debouncedQuery) ||
        (item.provider && item.provider.toLowerCase().includes(debouncedQuery)),
    );
  }, [home.activeCohorts, debouncedQuery]);

  const continueLater = useMemo(() => {
    if (!debouncedQuery) return home.continueLater;
    return home.continueLater.filter(
      (item) =>
        item.title.toLowerCase().includes(debouncedQuery) ||
        (item.provider && item.provider.toLowerCase().includes(debouncedQuery)) ||
        (item.pausedReason && item.pausedReason.toLowerCase().includes(debouncedQuery)),
    );
  }, [home.continueLater, debouncedQuery]);

  const recentlyCompleted = useMemo(() => {
    if (!debouncedQuery) return home.recentlyCompleted;
    return home.recentlyCompleted.filter((item) =>
      item.title.toLowerCase().includes(debouncedQuery),
    );
  }, [home.recentlyCompleted, debouncedQuery]);

  const hasResults = activeCohorts.length + continueLater.length + recentlyCompleted.length > 0;

  const handlePause = useCallback(
    (cohortId: string, days: number, reason?: string) => {
      home.actions.pauseActiveCohort(cohortId, days, reason);
      setIsPausedOpen(true);
      homeStorageAdapter.savePausedOpen(true);
    },
    [home.actions],
  );

  const handleTogglePaused = useCallback(() => {
    setIsPausedOpen((prev) => {
      const next = !prev;
      homeStorageAdapter.savePausedOpen(next);
      return next;
    });
  }, []);

  const handleToggleCompleted = useCallback(() => {
    setIsCompletedOpen((prev) => {
      const next = !prev;
      homeStorageAdapter.saveCompletedOpen(next);
      return next;
    });
  }, []);

  const handleAddTask = useCallback(() => {
    const input = document.querySelector('textarea, input[placeholder*="learn"]') as HTMLElement;
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  if (home.loading) {
    return <HomeSkeleton />;
  }

  const showPausedList = isPausedOpen || Boolean(debouncedQuery);
  const showCompletedList = isCompletedOpen || Boolean(debouncedQuery);

  return (
    <div className={styles.home}>
      <div className={styles.pageGrid}>
        <main className={styles.leftCol}>
          <HomeHero userName={userName} />

          <LearningPromptBar />

          <ChannelHub />

          <SearchBar
            className={styles.searchBar}
            value={query}
            onChange={setQuery}
            onClear={() => setQuery('')}
            placeholder="Search subscribed cohorts, providers, topics..."
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
            onPause={handlePause}
            onUpdateOrderStyle={home.actions.saveOrderStyle}
            onUpdateFrequency={home.actions.saveFrequency}
          />

          <HomeSummaryBar
            pausedItems={home.continueLater}
            completedItems={home.recentlyCompleted}
            isPausedOpen={showPausedList}
            isCompletedOpen={showCompletedList}
            onTogglePaused={handleTogglePaused}
            onToggleCompleted={handleToggleCompleted}
          />

          {showPausedList && (
            <ContinueLater
              heading={home.sections.continueLater}
              items={continueLater}
              onResume={home.actions.resumePausedCohort}
              isOpen={showPausedList}
              onToggle={handleTogglePaused}
            />
          )}

          {showCompletedList && (
            <RecentlyCompleted
              heading={home.sections.recentlyCompleted}
              items={recentlyCompleted}
              isOpen={showCompletedList}
              onToggle={handleToggleCompleted}
            />
          )}

          <StudyRooms
            items={messageMock.liveSessions}
            variant="compact"
            title="Active studyrooms"
            subtitle="Join focused rooms and learn together in real time."
            viewAllHref="/explore"
          />
        </main>

        <aside className={styles.rightRail}>
          <UpcomingEvents
            variant="light"
            showAddTask
            onAddTask={handleAddTask}
          />
          <HomeStreakWidget />
        </aside>
      </div>
    </div>
  );
}

