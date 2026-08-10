import type { LearningPillar } from '../../../../models';
import { OverviewIcon } from '../OverviewIcon/OverviewIcon';

import styles from './LearningPillars.module.css';

interface LearningPillarsProps {
  items: LearningPillar[];
}

export function LearningPillars({ items }: LearningPillarsProps) {
  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <article
          key={item.id}
          className={styles.card}
        >
          <OverviewIcon
            icon={item.icon}
            className={styles.icon}
          />
          <div>
            <h3 className={styles.title}>{item.title}</h3>
            <p className={styles.description}>{item.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
