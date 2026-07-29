import { ChevronRight } from 'lucide-react';

import { HorizontalScroller } from '@/src/client/components/global/HorizontalScroller';

import type { ArticlePreview } from '../../models';

import { ArticleCard } from './ArticleCard';

import styles from './RecentlyPublished.module.css';

export interface RecentlyPublishedProps {
  items: ArticlePreview[];
}

export function RecentlyPublished({ items }: RecentlyPublishedProps) {
  return (
    <section
      className={styles.section}
      aria-labelledby="recently-published-heading"
    >
      <div className={styles.header}>
        <h2
          id="recently-published-heading"
          className={styles.title}
        >
          Recently Published
        </h2>

        <button
          type="button"
          className={styles.arrow}
          aria-label="View all"
        >
          <ChevronRight
            size={18}
            strokeWidth={2.5}
          />
        </button>
      </div>

      <HorizontalScroller>
        {items.map((item) => (
          <ArticleCard
            key={item.id}
            item={item}
          />
        ))}
      </HorizontalScroller>
    </section>
  );
}
