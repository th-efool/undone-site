import clsx from 'clsx';
import { Tooltip } from '@/src/client/components/ui/Tooltip';

import styles from '../PlayerToolbar.module.css';

export interface PlaybackSpeedProps {
  value: number;
  active?: boolean;
  onClick?: () => void;
}

export function PlaybackSpeed({ value, active = false, onClick }: PlaybackSpeedProps) {
  return (
    <Tooltip content="Playback speed" placement="left">
      <button
        className={clsx(styles.button, active && styles.active)}
        onClick={onClick}
        aria-label="Playback speed"
      >
        <span className={styles.speed}>{value.toFixed(1)}×</span>
      </button>
    </Tooltip>
  );
}

