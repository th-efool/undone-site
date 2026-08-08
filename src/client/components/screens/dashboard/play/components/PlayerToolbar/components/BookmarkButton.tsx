import { Bookmark } from 'lucide-react';
import clsx from 'clsx';
import { Tooltip } from '@/src/client/components/ui/Tooltip';

import styles from '../PlayerToolbar.module.css';

export interface BookmarkButtonProps {
  active?: boolean;
  onClick?: () => void;
}

export function BookmarkButton({ active = false, onClick }: BookmarkButtonProps) {
  return (
    <Tooltip content="Bookmark lesson" placement="left">
      <button
        className={clsx(styles.button, active && styles.active)}
        onClick={onClick}
        aria-label="Bookmark lesson"
      >
        <Bookmark size={22} />
      </button>
    </Tooltip>
  );
}

