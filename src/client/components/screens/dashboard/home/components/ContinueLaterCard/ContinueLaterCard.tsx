import Link from 'next/link';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import type { PausedCohort } from '../../models';

import styles from './ContinueLaterCard.module.css';

export interface ContinueLaterCardProps {
  item: PausedCohort;
  onResume(cohortId: string): void;
}

export function ContinueLaterCard({ item, onResume }: ContinueLaterCardProps) {
  return (
    <article className={styles.card}>
      <Link href={getCohortHref(item.cohortId ?? item.id)}>
        <img
          className={styles.thumbnail}
          src={item.thumbnail}
          alt=""
        />
      </Link>

      <div className={styles.content}>
        <h3 className={styles.title}>
          <Link href={getCohortHref(item.cohortId ?? item.id)}>{item.title}</Link>
        </h3>
        <p className={styles.meta}>Paused&nbsp; • &nbsp;{item.resumeLabel}</p>
      </div>

      <button
        type="button"
        className={styles.button}
        onClick={() => onResume(item.id)}
      >
        Resume
      </button>
    </article>
  );
}
