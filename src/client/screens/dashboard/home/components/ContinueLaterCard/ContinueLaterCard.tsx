import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import type { PausedCohort } from '../../models';

import styles from './ContinueLaterCard.module.css';

const FALLBACK_THUMBNAIL =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';

export interface ContinueLaterCardProps {
  item: PausedCohort;
  onResume(cohortId: string): void;
}

export function ContinueLaterCard({ item, onResume }: ContinueLaterCardProps) {
  const [thumbSrc, setThumbSrc] = useState(item.thumbnail || FALLBACK_THUMBNAIL);

  useEffect(() => {
    setThumbSrc(item.thumbnail || FALLBACK_THUMBNAIL);
  }, [item.thumbnail]);

  return (
    <article className={styles.card}>
      <Link href={getCohortHref(item.cohortId ?? item.id)}>
        <Image
          className={styles.thumbnail}
          src={thumbSrc}
          alt=""
          width={400}
          height={300}
          onError={() => setThumbSrc(FALLBACK_THUMBNAIL)}
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
        aria-label={`Resume ${item.title}`}
      >
        Resume
      </button>
    </article>
  );
}
