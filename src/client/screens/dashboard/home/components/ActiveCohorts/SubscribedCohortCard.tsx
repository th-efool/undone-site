'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { MoreVertical } from 'lucide-react';
import type { ActiveCohort } from '../../models';
import styles from './SubscribedCohortCard.module.css';

export interface SubscribedCohortCardProps {
  cohort: ActiveCohort;
  onSelect?: (cohort: ActiveCohort) => void;
  onMenuClick?: (e: React.MouseEvent, cohort: ActiveCohort) => void;
  className?: string;
}

const DEFAULT_AVATARS = [
  '/mock/avatars/b.webp',
  '/mock/avatars/c.webp',
  '/mock/avatars/d.webp',
];

const FALLBACK_COVERS: Record<string, string> = {
  default: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&auto=format&fit=crop&q=80',
};

export function SubscribedCohortCard({
  cohort,
  onSelect,
  onMenuClick,
  className,
}: SubscribedCohortCardProps) {
  const [imgSrc, setImgSrc] = useState(cohort.thumbnail || FALLBACK_COVERS.default);

  // Compute a stable member count badge if not explicitly provided
  const memberCount = cohort.memberCount || (64 + ((cohort.title.length * 37) % 240));
  const progress = Math.max(0, Math.min(100, cohort.progressPercent || 0));

  return (
    <article
      className={`${styles.card} ${className || ''}`.trim()}
      onClick={() => onSelect?.(cohort)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(cohort);
        }
      }}
      aria-label={`${cohort.title}, ${progress}% completed, ${memberCount} members`}
    >
      {/* Full-bleed cover thumbnail */}
      <div className={styles.imageWrapper}>
        <Image
          src={imgSrc}
          alt={cohort.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className={styles.image}
          onError={() => setImgSrc(FALLBACK_COVERS.default)}
        />
        <div className={styles.overlayGradient} />
      </div>

      {/* Top right kebab menu button */}
      <button
        type="button"
        className={styles.kebabBtn}
        onClick={(e) => {
          e.stopPropagation();
          if (onMenuClick) {
            onMenuClick(e, cohort);
          } else {
            onSelect?.(cohort);
          }
        }}
        aria-label={`Options for ${cohort.title}`}
      >
        <MoreVertical size={16} strokeWidth={2.4} />
      </button>

      {/* Bottom overlay content */}
      <div className={styles.bottomContent}>
        <h3 className={styles.title} title={cohort.title}>
          {cohort.title}
        </h3>

        <div className={styles.metaRow}>
          {/* Avatar stack + count */}
          <div className={styles.memberStack}>
            <div className={styles.avatars}>
              {DEFAULT_AVATARS.map((src, i) => (
                <div key={i} className={styles.avatarCircle} style={{ zIndex: 3 - i }}>
                  <Image
                    src={src}
                    alt="Member"
                    width={18}
                    height={18}
                    className={styles.avatarImg}
                  />
                </div>
              ))}
            </div>
            <span className={styles.memberCountText}>+{memberCount}</span>
          </div>

          {/* Progress bar + percent */}
          <div className={styles.progressGroup}>
            <div className={styles.progressBarTrack}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className={styles.progressText}>{progress}%</span>
          </div>
        </div>
      </div>
    </article>
  );
}
