import { PenTool } from 'lucide-react';
import clsx from 'clsx';

import styles from '../PlayerToolbar.module.css';

export interface ScribeButtonProps {
  active?: boolean;
  onClick?: () => void;
}

export function ScribeButton({ active = false, onClick }: ScribeButtonProps) {
  return (
    <button
      className={clsx(styles.button, active && styles.active)}
      onClick={onClick}
      aria-label="Scribe"
    >
      <PenTool size={22} />
    </button>
  );
}
