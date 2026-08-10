import type { CohortHallOfFame } from '../../../../models';

import styles from '../../HallOfFame.module.css';

export function HighlightRow({ item }: { item: CohortHallOfFame['userHighlights'][number] }) {
  return (
    <div className={styles.highlightRow}>
      <span>{item.icon}</span>
      <strong>{item.rank}</strong>
      <p>{item.label}</p>
      <b>{item.metric}</b>
    </div>
  );
}
