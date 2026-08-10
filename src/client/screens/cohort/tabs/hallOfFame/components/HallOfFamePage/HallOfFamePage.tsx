import { ArrowRight } from 'lucide-react';

import type { CohortHallOfFame } from '../../../../models';
import { CategoryFilters } from '../CategoryFilters/CategoryFilters';
import { HallOfFameHeader } from '../HallOfFameHeader/HallOfFameHeader';
import { HallOfLegends } from '../HallOfLegends/HallOfLegends';
import { HallSidebar } from '../HallSidebar/HallSidebar';
import { LeaderboardGrid } from '../LeaderboardGrid/LeaderboardGrid';
import { TimeRangeDropdown } from '../TimeRangeDropdown/TimeRangeDropdown';

import styles from '../../HallOfFame.module.css';

export function HallOfFamePage({ hall }: { hall: CohortHallOfFame }) {
  return (
    <div className={styles.page}>
      <div className={styles.mainColumn}>
        <section className={styles.mainCard}>
          <div className={styles.topBar}>
            <HallOfFameHeader hall={hall} />
            <TimeRangeDropdown hall={hall} />
          </div>

          <CategoryFilters hall={hall} />
          <LeaderboardGrid items={hall.categories} />

          <button className={styles.fullButton}>
            See Full Leaderboards
            <ArrowRight size={17} />
          </button>
        </section>

        <HallOfLegends hall={hall} />
      </div>

      <HallSidebar hall={hall} />
    </div>
  );
}
