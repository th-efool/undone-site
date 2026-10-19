import { DMMessageStatus } from '../../../../models';
import styles from './MessageStatus.module.css';
interface Props {
  status?: DMMessageStatus;
}
export function MessageStatus({ status }: Props) {
  if (!status) return null;
  if (status === 'sending') {
    return <span className={styles.statusSending} title="Sending..." aria-label="Sending">⏳</span>;
  }
  if (status === 'failed') {
    return <span className={styles.statusFailed} title="Failed to send" aria-label="Failed to send">⚠️</span>;
  }
  return <span className={styles.status}>{status === 'sent' ? '✓' : '✓✓'}</span>;
}
