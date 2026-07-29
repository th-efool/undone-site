import clsx from 'clsx';

import styles from '../PlayerToolbar.module.css';

export interface PlaybackSpeedProps {
  value: number;
  active?: boolean;
  onClick?: () => void;
}

export function PlaybackSpeed({ value, active = false, onClick }: PlaybackSpeedProps) {
  return (
    <button
      className={clsx(styles.button, active && styles.active)}
      onClick={onClick}
      aria-label="Playback Speed"
    >
      <span className={styles.speed}>{value.toFixed(1)}×</span>
    </button>
  );
}
