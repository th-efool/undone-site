import type { CohortHallOfFame } from '../../../../models';
import { AchievementsCard } from '../AchievementsCard/AchievementsCard';
import { HighlightsCard } from '../HighlightsCard/HighlightsCard';

import styles from '../../HallOfFame.module.css';

export function HallSidebar({ hall }: { hall: CohortHallOfFame }) {
  return (
    <aside className={styles.sidebar}>
      <HighlightsCard hall={hall} />
      <AchievementsCard hall={hall} />
    </aside>
  );
}
