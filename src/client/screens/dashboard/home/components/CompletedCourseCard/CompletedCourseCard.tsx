'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle2, Award } from 'lucide-react';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import type { CompletedCourse } from '../../models';
import styles from './CompletedCourseCard.module.css';

const FALLBACK_THUMBNAIL =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';

export interface CompletedCourseCardProps {
  item: CompletedCourse;
}

export const CompletedCourseCard = React.memo(function CompletedCourseCard({
  item,
}: CompletedCourseCardProps) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = imgError || !item.thumbnail ? FALLBACK_THUMBNAIL : item.thumbnail;
  const cohortLink = getCohortHref(item.cohortId ?? item.id);

  return (
    <article
      className={styles.card}
      role="region"
      aria-label={`${item.title}, Completed`}
    >
      {/* Full-bleed cover image */}
      <div className={styles.imageWrapper}>
        <Image
          src={imgSrc}
          alt={item.title}
          fill
          sizes="(max-width: 640px) 100vw, 240px"
          className={styles.image}
          onError={() => setImgError(true)}
        />
        <div className={styles.overlayGradient} />
      </div>

      {/* Top right "Completed" status badge */}
      <div className={styles.topBadgeWrapper}>
        <span className={styles.completedBadge}>
          <CheckCircle2 size={12} strokeWidth={2.4} />
          <span>{item.completedLabel || 'Completed'}</span>
        </span>
      </div>

      {/* Bottom overlay content */}
      <div className={styles.bottomContent}>
        <h3 className={styles.title} title={item.title}>
          <Link href={cohortLink} className={styles.titleLink}>
            {item.title}
          </Link>
        </h3>

        <div className={styles.metaRow}>
          {/* 100% Progress bar & text */}
          <div className={styles.progressGroup}>
            <div
              className={styles.progressBarTrack}
              role="progressbar"
              aria-valuenow={100}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress: 100%"
            >
              <div className={styles.progressBarFill} />
            </div>
            <span className={styles.progressText}>100%</span>
          </div>

          {/* Certificate / trophy badge */}
          <div className={styles.awardBadge} title="Completed sidequest">
            <Award size={13} strokeWidth={2.2} />
          </div>
        </div>
      </div>
    </article>
  );
});
