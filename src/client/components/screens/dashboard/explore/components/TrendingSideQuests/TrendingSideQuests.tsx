'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { InfiniteScroller, type InfiniteScrollerHandle } from '@/src/client/components/global/InfiniteScroller';

import type { SideQuest } from '../../models';

import { SideQuestCard } from './SideQuestCard';

import styles from './TrendingSideQuests.module.css';

export interface TrendingSideQuestsProps {
  items: SideQuest[];
}

export function TrendingSideQuests({ items }: TrendingSideQuestsProps) {
  const scrollerRef = useRef<InfiniteScrollerHandle>(null);

  return (
    <section
      className={styles.section}
      aria-labelledby="trending-sidequests-heading"
    >
      <div className={styles.header}>
        <h2
          id="trending-sidequests-heading"
          className={styles.title}
        >
          Trending Side Quests
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
        scrollAmount={360}
      >
        {items.map((item) => (
          <SideQuestCard
            key={item.id}
            item={item}
          />
        ))}
      </InfiniteScroller>
    </section>
  );
}
