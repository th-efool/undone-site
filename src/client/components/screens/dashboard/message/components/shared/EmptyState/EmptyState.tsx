import { MessageCircle } from 'lucide-react';
import styles from './EmptyState.module.css';

interface Props {
  title: string;
  message: string;
}

export function EmptyState({ title, message }: Props) {
  return (
    <div
      className={styles.empty}
      role="status"
    >
      <span aria-hidden="true">
        <MessageCircle size={22} />
      </span>
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}
