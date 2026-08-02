import { CheckCircle2, XCircle, Info } from 'lucide-react';
import clsx from 'clsx';

import styles from './Toast.module.css';

export interface ToastProps {
  item: {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    duration?: number;
  };
  onClose: () => void;
}

const icons = {
  success: <CheckCircle2 size={18} />,
  error: <XCircle size={18} />,
  info: <Info size={18} />,
};

export function Toast({ item, onClose }: ToastProps) {
  return (
    <div
      className={clsx(styles.toast, styles[`type-${item.type}`])}
      role="status"
      aria-live="polite"
    >
      <span className={styles.icon}>{icons[item.type]}</span>
      <span className={styles.message}>{item.message}</span>
      <button
        className={styles.closeButton}
        onClick={onClose}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}
