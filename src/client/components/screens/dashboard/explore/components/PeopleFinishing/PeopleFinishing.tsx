'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { InfiniteScroller, type InfiniteScrollerHandle } from '@/src/client/components/global/InfiniteScroller';

import type { TrendingCourse } from '../../models';

import { TrendingCourseCard } from './TrendingCourseCard';

import styles from './PeopleFinishing.module.css';

export interface PeopleFinishingProps {
  items: TrendingCourse[];
}

export function PeopleFinishing({ items }: PeopleFinishingProps) {
  const scrollerRef = useRef<InfiniteScrollerHandle>(null);

  return (
    <section
      className={styles.section}
      aria-labelledby="popular-now-heading"
    >
      <div className={styles.header}>
        <h2
          id="popular-now-heading"
          className={styles.title}
        >
          Popular now
        </h2>

        <div className={styles.headerControls}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => scrollerRef.current?.scrollLeft()}
            aria-label="Scroll left"
          >
            <ChevronLeft size={16} strokeWidth={2.2} />
          </button>

          <button
            type="button"
            className={styles.navBtn}
            onClick={() => scrollerRef.current?.scrollRight()}
            aria-label="Scroll right"
          >
            <ChevronRight size={16} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <InfiniteScroller
        ref={scrollerRef}
        loop={true}
        panable={true}
        showArrows={false}
        scrollAmount={450}
      >
        {items.map((item) => (
          <TrendingCourseCard
            key={item.id}
            item={item}
          />
        ))}
      </InfiniteScroller>
    </section>
  );
}
