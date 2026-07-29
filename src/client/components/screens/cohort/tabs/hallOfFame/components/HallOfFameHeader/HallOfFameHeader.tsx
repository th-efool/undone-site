import { Trophy } from 'lucide-react';

import type { CohortHallOfFame } from '../../../../models';

import styles from '../../HallOfFame.module.css';

export function HallOfFameHeader({ hall }: { hall: CohortHallOfFame }) {
  return (
    <header className={styles.header}>
      <h2>
        <Trophy size={22} />
        {hall.title}
      </h2>
      <p>{hall.subtitle}</p>
    </header>
  );
}
