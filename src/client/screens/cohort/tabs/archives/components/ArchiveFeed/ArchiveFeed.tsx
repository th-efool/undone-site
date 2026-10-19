import type { ArchiveItem } from '../../../../models';
import { ArchiveCard } from '../ArchiveCard/ArchiveCard';

import styles from '../../Archives.module.css';

export function ArchiveFeed({ items }: { items: ArchiveItem[] }) {
  if (!items || items.length === 0) {
    return (
      <div className={styles.emptyFeedState} role="status">
        <p className={styles.emptyTitle}>No community archives yet</p>
        <p className={styles.emptySubtitle}>
          Share your first mindmap, cheatsheet, or field note to help fellow cohort explorers.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.feed}>
      {items.map((item) => (
        <ArchiveCard
          key={item.id}
          item={item}
        />
      ))}
    </div>
  );
}
