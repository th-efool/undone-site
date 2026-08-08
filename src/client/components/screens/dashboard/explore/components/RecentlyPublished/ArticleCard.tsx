import Image from 'next/image';
import Link from 'next/link';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import { Bookmark, Users } from 'lucide-react';

import type { ArticlePreview } from '../../models';

import styles from './ArticleCard.module.css';

export interface ArticleCardProps {
  item: ArticlePreview;
}

export function ArticleCard({ item }: ArticleCardProps) {
  return (
    <article className={styles.card}>
      <Link
        href={getCohortHref(item.cohortId ?? item.id)}
        className={styles.cardLink}
      >
        <div className={styles.imageContainer}>
          <Image
            src={item.thumbnail}
            alt={item.title}
            className={styles.thumbnail}
            width={360}
            height={480}
          />
          <button
            type="button"
            className={styles.bookmark}
            aria-label={item.bookmarked ? 'Remove bookmark' : 'Bookmark discovery'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Bookmark
              size={15}
              strokeWidth={2.2}
              fill={item.bookmarked ? 'currentColor' : 'none'}
            />
          </button>
        </div>

        <div className={styles.body}>
          <h3 className={styles.title} title={item.title}>
            {item.title}
          </h3>

          <p className={styles.author}>By {item.author}</p>

          <div className={styles.meta}>
            <span className={styles.metaItem}>
              <Users size={12} className={styles.metaIcon} />
              {item.learnerCount}
            </span>

            <span className={styles.dot}>•</span>

            <span className={styles.metaItem}>{item.publishedLabel}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function ArticleCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={`skeleton-${i}`} className={styles.skeletonCard} aria-hidden="true">
          <div className={styles.skeletonImage} />
          <div className={styles.skeletonBody}>
            <div className={styles.skeletonTitle} />
            <div className={styles.skeletonAuthor} />
            <div className={styles.skeletonMeta} />
          </div>
        </div>
      ))}
    </>
  );
}
