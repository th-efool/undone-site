import { DMMessageStatus } from '../../../../models';
import styles from './MessageStatus.module.css';

interface Props {
  status?: DMMessageStatus;
  onRetry?(): void;
}

export function MessageStatus({ status, onRetry }: Props) {
  if (!status) return null;
  if (status === 'sending') {
    return <span className={styles.statusSending} title="Sending..." aria-label="Sending">⏳</span>;
  }
  if (status === 'failed') {
    return (
      <button
        type="button"
        className={styles.statusFailed}
        onClick={onRetry}
        title="Failed to send. Click to retry."
        aria-label="Failed to send. Click to retry."
        style={{
          background: 'none',
          border: 'none',
          cursor: onRetry ? 'pointer' : 'default',
          padding: 0,
          font: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        ⚠️ Failed {onRetry ? '(retry)' : ''}
      </button>
    );
  }
  return <span className={styles.status}>{status === 'sent' ? '✓' : '✓✓'}</span>;
}
