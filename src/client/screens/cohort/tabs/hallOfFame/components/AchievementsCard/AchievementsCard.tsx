import { ArrowRight } from 'lucide-react';

import type { CohortHallOfFame } from '../../../../models';
import { AchievementRow } from '../AchievementRow/AchievementRow';
import { SideCard } from '../SideCard/SideCard';

import styles from '../../HallOfFame.module.css';

export function AchievementsCard({ hall }: { hall: CohortHallOfFame }) {
  return (
    <SideCard
      title="Recent Achievements"
      desc="Your latest badges and milestones."
    >
      <div className={styles.achievements}>
        {hall.recentAchievements.map((item) => (
          <AchievementRow
            key={item.id}
            item={item}
          />
        ))}
      </div>
      <button className={styles.allButton}>
        View All Achievements <ArrowRight size={16} />
      </button>
    </SideCard>
  );
}
