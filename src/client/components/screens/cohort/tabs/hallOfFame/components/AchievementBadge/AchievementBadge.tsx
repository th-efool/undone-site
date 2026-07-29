import type { HallAccent } from '../../../../models';

import styles from '../../HallOfFame.module.css';

export function AchievementBadge({ label, accent }: { label: string; accent: HallAccent }) {
  return <span className={`${styles.achievement} ${styles[accent]}`}>✧ {label}</span>;
}
