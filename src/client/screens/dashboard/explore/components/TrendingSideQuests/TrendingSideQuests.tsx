'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { InfiniteScroller, type InfiniteScrollerHandle } from '@/src/client/components/global/InfiniteScroller';
import { Tooltip } from '@/src/client/components/ui/Tooltip';

import type { TrendingCourse } from '../../models';

import { TrendingCourseCard } from '../PeopleFinishing/TrendingCourseCard';

import styles from './TrendingSideQuests.module.css';

export interface TrendingSideQuestsProps {
  items: TrendingCourse[];
}

export function TrendingSideQuests({ items }: TrendingSideQuestsProps) {
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
          TALK OF THE TOWN
        </h2>

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

      <InfiniteScroller
        ref={scrollerRef}
        loop={true}
        panable={true}
        showArrows={false}
        scrollAmount={360}
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

