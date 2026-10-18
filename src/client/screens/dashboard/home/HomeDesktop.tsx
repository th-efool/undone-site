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
  const [isPausedOpen, setIsPausedOpen] = useState(() => homeStorageAdapter.getStoredPausedOpen());
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [pace, setPace] = useState(20);

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
    <div className={styles.home}>
      <div className={styles.pageGrid}>
        <main className={styles.leftCol}>
          <HomeHero userName={userName} />

          <LearningPromptBar />

          <ChannelHub />

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
            onPause={(cohortId, days, reason) => {
              home.actions.pauseActiveCohort(cohortId, days, reason);
              setIsPausedOpen(true);
              homeStorageAdapter.savePausedOpen(true);
            }}
            onUpdateOrderStyle={home.actions.saveOrderStyle}
            onUpdateFrequency={home.actions.saveFrequency}
          />

          <HomeSummaryBar
            pausedItems={home.continueLater}
            completedItems={home.recentlyCompleted}
            isPausedOpen={showPausedList}
            isCompletedOpen={showCompletedList}
            onTogglePaused={() => setIsPausedOpen((prev) => {
              const next = !prev;
              homeStorageAdapter.savePausedOpen(next);
              return next;
            })}
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
            onAddTask={() => {
              const input = document.querySelector('textarea, input[placeholder*="learn"]') as HTMLElement;
              if (input) {
                input.focus();
                input.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
          />
          <HomeStreakWidget />
        </aside>
      </div>
    </div>
  );
}

