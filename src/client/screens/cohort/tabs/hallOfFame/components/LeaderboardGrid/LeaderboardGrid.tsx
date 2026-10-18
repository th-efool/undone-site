import type { HallCategory } from '../../../../models';
import { LeaderboardCard } from '../LeaderboardCard/LeaderboardCard';

import styles from '../../HallOfFame.module.css';

export function LeaderboardGrid({ items }: { items: HallCategory[] }) {
  if (!items || items.length === 0) {
    return (
      <div className={styles.emptyNotice} role="status">
        <p className={styles.emptyTitle}>Be the first champion</p>
        <p className={styles.emptySubtitle}>
          No explorers have completed this cohort yet. Start your quests and claim the first spot on the leaderboard!
        </p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <LeaderboardCard
          key={item.id}
          item={item}
        />
      ))}
    </div>
  );
}
