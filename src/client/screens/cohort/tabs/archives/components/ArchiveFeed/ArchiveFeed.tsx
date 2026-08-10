import type { ArchiveItem } from '../../../../models';
import { ArchiveCard } from '../ArchiveCard/ArchiveCard';

import styles from '../../Archives.module.css';

export function ArchiveFeed({ items }: { items: ArchiveItem[] }) {
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
