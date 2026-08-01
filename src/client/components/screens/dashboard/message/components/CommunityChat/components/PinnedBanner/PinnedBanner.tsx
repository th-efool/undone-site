import { X } from 'lucide-react';
import { PinnedAnnouncement } from '../../../../models';
import styles from './PinnedBanner.module.css';

interface Props {
  pinned: PinnedAnnouncement;
  /** Batch D6: Dismiss the banner */
  onDismiss?(): void;
}
export function PinnedBanner({ pinned, onDismiss }: Props) {
  if (!pinned) return null;
  return (
    <section className={styles.banner}>
      <div>
        <span>Pinned by {pinned.author}</span>
        <p>{pinned.title}</p>
      </div>
      <button type="button" onClick={() => pinned.actionLabel === 'Dismiss' && onDismiss?.()}>
        {pinned.actionLabel}
      </button>
      {onDismiss && (
        <button
          type="button"
          className={styles.closeBtn}
          aria-label="Dismiss pinned announcement"
          onClick={onDismiss}
        >
          <X size={16} />
        </button>
      )}
    </section>
  );
}
