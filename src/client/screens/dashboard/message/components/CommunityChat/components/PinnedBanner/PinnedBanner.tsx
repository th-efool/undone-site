import { Pin, X } from 'lucide-react';
import { PinnedAnnouncement } from '../../../../models';
import styles from './PinnedBanner.module.css';

interface Props {
  pinned: PinnedAnnouncement;
  /** Dismiss the banner */
  onDismiss?(): void;
}

export function PinnedBanner({ pinned, onDismiss }: Props) {
  if (!pinned) return null;
  return (
    <div className={styles.banner} role="region" aria-label="Pinned message">
      <div className={styles.content}>
        <Pin size={14} className={styles.pinIcon} />
        <span className={styles.author}>Pinned by {pinned.author}:</span>
        <span className={styles.title}>{pinned.title}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          className={styles.closeBtn}
          aria-label="Dismiss pinned announcement"
          onClick={onDismiss}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
