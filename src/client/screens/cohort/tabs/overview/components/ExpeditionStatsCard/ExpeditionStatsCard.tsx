import Image from 'next/image';

import type { StatItem } from '../../../../models';
import { OverviewIcon } from '../OverviewIcon/OverviewIcon';

import styles from './ExpeditionStatsCard.module.css';

interface ExpeditionStatsCardProps {
  items: StatItem[];
  activeExplorers: string[];
  activeExplorerOverflow: string;
}

export function ExpeditionStatsCard({
  items,
  activeExplorers,
  activeExplorerOverflow,
}: ExpeditionStatsCardProps) {
  return (
    <aside className={styles.card}>
      <h2 className={styles.title}>Expedition Stats</h2>

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

      <div className={styles.activeBlock}>
        <h3 className={styles.subtitle}>Active This Week</h3>
        <div className={styles.avatars}>
          {activeExplorers.map((avatarUrl, index) => (
            <Image
              key={`${avatarUrl}-${index}`}
              src={avatarUrl}
              alt=""
              width={38}
              height={38}
              className={styles.avatar}
            />
          ))}
          <span className={styles.overflow}>{activeExplorerOverflow}</span>
        </div>
      </div>
    </aside>
  );
}
