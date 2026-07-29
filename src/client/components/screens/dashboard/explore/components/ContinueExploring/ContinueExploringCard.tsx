import Link from 'next/link';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import styles from './ContinueExploringCard.module.css';

import type { ContinueExploringItem } from '../../models';

export interface ContinueExploringCardProps {
  item: ContinueExploringItem;
}

export function ContinueExploringCard({ item }: ContinueExploringCardProps) {
  return (
    <Link
      href={getCohortHref(item.cohortId ?? item.id)}
      className={styles.card}
    >
      <div
        className={styles.icon}
        style={{
          color: item.statusColor,
        }}
      >
        {item.icon}
      </div>

      <div className={styles.content}>
        <h3 className={styles.title}>{item.title}</h3>

        <div className={styles.bottomRow}>
          <span className={styles.subtitle}>{item.subtitle}</span>

          {item.progressPercent !== undefined && (
            <div className={styles.progress}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${item.progressPercent}%`,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
