'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Pause } from 'lucide-react';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import type { PausedCohort } from '../../models';
import styles from './ContinueLaterCard.module.css';

const DEFAULT_AVATARS = [
  '/mock/avatars/b.webp',
  '/mock/avatars/c.webp',
  '/mock/avatars/d.webp',
];

const FALLBACK_THUMBNAIL =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';

export interface ContinueLaterCardProps {
  item: PausedCohort;
  onResume(cohortId: string): void;
}

export const ContinueLaterCard = React.memo(function ContinueLaterCard({
  item,
  onResume,
}: ContinueLaterCardProps) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = imgError || !item.thumbnail ? FALLBACK_THUMBNAIL : item.thumbnail;
  const progress = Math.max(0, Math.min(100, item.progressPercent || 0));
  const cohortLink = getCohortHref(item.cohortId ?? item.id);

  return (
    <article
      className={styles.card}
      role="region"
      aria-label={`${item.title}, Paused (${item.resumeLabel})`}
    >
      {/* Full-bleed cover image */}
      <div className={styles.imageWrapper}>
        <Image
          src={imgSrc}
          alt={item.title}
          fill
          sizes="(max-width: 640px) 100vw, 260px"
          className={styles.image}
          onError={() => setImgError(true)}
        />
        <div className={styles.overlayGradient} />
      </div>

      {/* Top right "Paused" status pill */}
      <div className={styles.topBadgeWrapper}>
        <span className={styles.pausedBadge}>
          <Pause size={11} fill="currentColor" />
          <span>{item.resumeLabel || 'Paused'}</span>
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
          {/* Avatar stack + member count */}
          <div className={styles.memberStack}>
            <div className={styles.avatars}>
              {DEFAULT_AVATARS.map((src, i) => (
                <div key={i} className={styles.avatarCircle} style={{ zIndex: 3 - i }}>
                  <Image
                    src={src}
                    alt=""
                    width={18}
                    height={18}
                    className={styles.avatarImg}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                    }}
                  />
                </div>
              ))}
            </div>
            <span className={styles.progressPercentText}>{progress}%</span>
          </div>

          {/* Action button: Resume pill */}
          <button
            type="button"
            className={styles.resumeBtn}
            onClick={() => onResume(item.id)}
            aria-label={`Resume ${item.title}`}
          >
            <Play size={12} fill="currentColor" />
            <span>Resume</span>
          </button>
        </div>
      </div>
    </article>
  );
});
