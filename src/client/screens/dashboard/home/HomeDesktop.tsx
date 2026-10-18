'use client';

import { useCallback, useState } from 'react';
import { HomeSkeleton } from '@/src/client/components/global/Skeleton';
import { ActiveCohorts } from './components/ActiveCohorts/ActiveCohorts';
import { ChannelHub } from './components/ChannelHub/ChannelHub';
import { HomeHero } from './components/HomeHero/HomeHero';
import { RecentlyCompleted } from './components/RecentlyCompleted/RecentlyCompleted';
import { UpcomingEvents } from '@/src/client/components/global/UpcomingEvents';
import { HomeStreakWidget } from './components/HomeStreakWidget';
import { LearningPromptBar } from '@/src/client/components/global/LearningPromptBar';
import { StudyRooms } from '@/src/client/components/global/StudyRooms';
import { messageMock } from '@/src/client/screens/dashboard/message/mock/message.mock';
import type { UseHomeResult } from './hooks/useHome';
import styles from './Home.module.css';

interface HomeDesktopProps { model: UseHomeResult; userName?: string; }

export function HomeDesktop({ model: home, userName }: HomeDesktopProps) {
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const handlePause = useCallback(
    (cohortId: string, pausedUntil: Date, reason?: string) => home.actions.pauseActiveCohort(cohortId, pausedUntil, reason),
    [home.actions],
  );
  const handleAddTask = useCallback(() => {
    const input = document.querySelector('textarea, input[placeholder*="learn"]') as HTMLElement;
    input?.focus();
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  if (home.loading) return <HomeSkeleton />;
  const subscribedCohorts = [
    ...home.activeCohorts,
    ...home.continueLater.map((cohort, index) => ({ ...cohort, rank: cohort.rank ?? home.activeCohorts.length + index + 1 })),
  ].sort((a, b) => a.rank - b.rank);

  return (
    <div className={styles.home}>
      <div className={styles.pageGrid}>
        <main className={styles.leftCol}>
          <HomeHero userName={userName} />
          <LearningPromptBar />
          <ChannelHub />
          {home.syncError && <p role="alert">{home.syncError}</p>}
          <ActiveCohorts heading={home.sections.activeCohorts} items={subscribedCohorts} onPause={handlePause} onResume={home.actions.resumePausedCohort}
            onSave={home.actions.saveLearningSettings} onDelete={home.actions.removeSubscribedCohort} />
          {home.recentlyCompleted.length > 0 && (
            <RecentlyCompleted heading={home.sections.recentlyCompleted} items={home.recentlyCompleted} isOpen={isCompletedOpen} onToggle={() => setIsCompletedOpen((open) => !open)} />
          )}
          <StudyRooms items={messageMock.liveSessions} variant="compact" title="Active studyrooms" />
        </main>
        <aside className={styles.rightRail}>
          <UpcomingEvents variant="light" showAddTask onAddTask={handleAddTask} />
          <HomeStreakWidget />
        </aside>
      </div>
    </div>
  );
}
