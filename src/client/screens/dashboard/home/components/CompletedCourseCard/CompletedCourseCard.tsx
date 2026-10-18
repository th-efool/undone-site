import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import { PartyPopper } from 'lucide-react';

import type { CompletedCourse } from '../../models';

import styles from './CompletedCourseCard.module.css';

const FALLBACK_THUMBNAIL =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';

export interface CompletedCourseCardProps {
  item: CompletedCourse;
}

export function CompletedCourseCard({ item }: CompletedCourseCardProps) {
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
        <p className={styles.meta}>{item.completedLabel}</p>
      </div>

      <div
        className={styles.progressArea}
        role="progressbar"
        aria-valuenow={item.progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${item.title} completion progress: ${item.progressPercent}%`}
      >
        <strong>{item.progressPercent}%</strong>
        <div className={styles.progress} aria-hidden="true">
          <div
            className={styles.progressFill}
            style={{ width: `${item.progressPercent}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        className={styles.review}
        aria-label={`Review ${item.title}`}
      >
        Review
      </button>

      <button
        type="button"
        className={styles.celebrate}
        aria-label={`Celebrate completion of ${item.title}`}
      >
        <PartyPopper
          size={24}
          strokeWidth={2.3}
        />
      </button>
    </article>
  );
}
