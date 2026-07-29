import { Ellipsis } from 'lucide-react';
import clsx from 'clsx';

import styles from '../PlayerToolbar.module.css';

export interface ToolbarMenuProps {
  active?: boolean;
  onClick?: () => void;
}

export function ToolbarMenu({ active = false, onClick }: ToolbarMenuProps) {
  return (
    <button
      className={clsx(styles.button, active && styles.active)}
      onClick={onClick}
      aria-label="More"
    >
      <Ellipsis size={22} />
    </button>
  );
}
