'use client';

import { AboutSection } from './components/AboutSection/AboutSection';
import { ExpeditionProgressCard } from './components/ExpeditionProgressCard/ExpeditionProgressCard';
import { ExpeditionStatsCard } from './components/ExpeditionStatsCard/ExpeditionStatsCard';
import { JourneySummary } from './components/JourneySummary/JourneySummary';
import { LearningChecklist } from './components/LearningChecklist/LearningChecklist';
import { QuestGuideCard } from './components/QuestGuideCard/QuestGuideCard';
import { JoinCohortButton } from '../../components/JoinCohortButton';

import styles from './Overview.module.css';
import type { Cohort } from '../../models';

interface OverviewProps {
  cohortId: string;
  cohort: Cohort;
  isEnrolled?: boolean;
  isLoggedIn?: boolean;
}

export function Overview({ cohortId, cohort, isEnrolled = true, isLoggedIn = true }: OverviewProps) {
  const { overview } = cohort;

  return (
    <div className={styles.overview}>
      <div className={styles.mainCard}>
        <AboutSection overview={overview} />
        <LearningChecklist items={overview.learningObjectives} />
        <JourneySummary items={overview.journeySummary} />
      </div>

      <ExpeditionStatsCard
        items={overview.expeditionStats}
        activeExplorers={overview.activeExplorers}
        activeExplorerOverflow={overview.activeExplorerOverflow}
      />

      <div className={styles.rightColumn}>
        <QuestGuideCard creator={cohort.creator} />
        {isEnrolled ? (
          <ExpeditionProgressCard items={overview.expeditionProgress} />
        ) : (
          <div className={styles.joinContainer}>
            <h3 className={styles.joinTitle}>Ready to start?</h3>
            <p className={styles.joinDescription}>Join this cohort to access the questline, community, and track your progress.</p>
            <div className={styles.joinButtonWrapper}>
              <JoinCohortButton cohortId={cohortId} isLoggedIn={isLoggedIn} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
