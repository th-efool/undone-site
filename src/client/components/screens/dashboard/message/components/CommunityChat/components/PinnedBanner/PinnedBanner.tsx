import { Pin } from 'lucide-react';
import { PinnedAnnouncement } from '../../../../models';
import styles from './PinnedBanner.module.css';

interface Props {
  pinned: PinnedAnnouncement;
}
export function PinnedBanner({ pinned }: Props) {
  return (
    <section className={styles.banner}>
      <Pin size={18} />
      <div>
        <span>Pinned by {pinned.author}</span>
        <p>{pinned.title}</p>
      </div>
      <button type="button">{pinned.actionLabel}</button>
    </section>
  );
}
