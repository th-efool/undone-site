'use client';

import { useRouter } from 'next/navigation';
import type { StatItem } from '../../../../models';
import { OverviewIcon } from '../OverviewIcon/OverviewIcon';

import styles from './ExpeditionProgressCard.module.css';

interface ExpeditionProgressCardProps {
  items: StatItem[];
  cohortId?: string;
}

export function ExpeditionProgressCard({ items, cohortId }: ExpeditionProgressCardProps) {
  const router = useRouter();

  return (
    <aside className={styles.card}>
      <h2 className={styles.title}>Your Expedition</h2>

      <div className={styles.rows}>
        {items.map((item) => (
          <div
            key={item.id}
            className={styles.row}
          >
            <div className={styles.labelGroup}>
              <OverviewIcon
                icon={item.icon}
                className={styles.icon}
              />
              <span>{item.label}</span>
            </div>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <button
        className={styles.button}
        type="button"
        onClick={() => router.push(cohortId ? `/cohort/${cohortId}/questline` : '/home')}
      >
        View My Activity
      </button>
    </aside>
  );
}
