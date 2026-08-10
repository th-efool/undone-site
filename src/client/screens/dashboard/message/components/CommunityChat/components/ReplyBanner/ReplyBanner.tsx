import { ArrowLeftFromLine, X } from 'lucide-react';
import styles from './ReplyBanner.module.css';

export interface ReplyContext {
  messageId: string;
  senderName: string;
  previewText: string;
}

interface Props {
  context: ReplyContext | null;
  onDismiss(): void;
}

export function ReplyBanner({ context, onDismiss }: Props) {
  if (!context) return null;

  return (
    <div className={styles.replyBanner}>
      <ArrowLeftFromLine size={16} className={styles.arrow} />
      <div className={styles.content}>
        <span className={styles.label}>Replying to @{context.senderName}</span>
        <span className={styles.preview}>{context.previewText}</span>
      </div>
      <button
        type="button"
        aria-label="Dismiss reply"
        className={styles.dismiss}
        onClick={onDismiss}
      >
        <X size={16} />
      </button>
    </div>
  );
}
