import { useCohort } from '../../hooks';
import { AboutSection } from './components/AboutSection/AboutSection';
import { ExpeditionProgressCard } from './components/ExpeditionProgressCard/ExpeditionProgressCard';
import { ExpeditionStatsCard } from './components/ExpeditionStatsCard/ExpeditionStatsCard';
import { JourneySummary } from './components/JourneySummary/JourneySummary';
import { LearningChecklist } from './components/LearningChecklist/LearningChecklist';
import { QuestGuideCard } from './components/QuestGuideCard/QuestGuideCard';

import styles from './Overview.module.css';

interface OverviewProps {
  cohortId: string;
}

export function Overview({ cohortId }: OverviewProps) {
  const cohort = useCohort(cohortId);
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
        <ExpeditionProgressCard items={overview.expeditionProgress} />
      </div>
    </div>
  );
}
