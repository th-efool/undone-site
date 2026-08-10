'use client';

import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { ArticlePreview } from '../../models';

import { ArticleCard, ArticleCardSkeleton } from './ArticleCard';
import { InfiniteScroller, type InfiniteScrollerHandle } from '@/src/client/components/global/InfiniteScroller';
import { Tooltip } from '@/src/client/components/ui/Tooltip';

import styles from './RecentlyPublished.module.css';

export interface RecentlyPublishedProps {
  items: ArticlePreview[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function RecentlyPublished({
  items,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}: RecentlyPublishedProps) {
  const scrollerRef = useRef<InfiniteScrollerHandle>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onLoadMore || !hasMore || !sentinelRef.current || !scrollerRef.current) return;

    const sentinel = sentinelRef.current;
    const viewport = scrollerRef.current.getViewport();

    if (!viewport) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      {
        root: viewport,
        rootMargin: '0px 300px 0px 0px',
        threshold: 0.1,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [onLoadMore, hasMore, isLoadingMore]);

  return (
    <section
      className={styles.section}
      aria-labelledby="fresh-discoveries-heading"
    >
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2
            id="fresh-discoveries-heading"
            className={styles.title}
          >
            A FRESH BATCH TO EXPLORE
          </h2>
        </div>

        <div className={styles.headerControls}>
          <Tooltip content="Scroll left" placement="top">
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => scrollerRef.current?.scrollLeft()}
              aria-label="Scroll left"
            >
              <ChevronLeft size={16} strokeWidth={2.2} />
            </button>
          </Tooltip>

          <Tooltip content="Scroll right" placement="top">
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => scrollerRef.current?.scrollRight()}
              aria-label="Scroll right"
            >
              <ChevronRight size={16} strokeWidth={2.2} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className={styles.scrollerWrapper}>
        <InfiniteScroller
          ref={scrollerRef}
          loop={false}
          panable={true}
          showArrows={false}
          scrollAmount={340}
        >
          {items.map((item) => (
            <ArticleCard
              key={item.id}
              item={item}
            />
          ))}

          {isLoadingMore && <ArticleCardSkeleton count={3} />}

          {/* Invisible sentinel for automated infinite horizontal discovery */}
          <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
        </InfiniteScroller>
      </div>
    </section>
  );
}
