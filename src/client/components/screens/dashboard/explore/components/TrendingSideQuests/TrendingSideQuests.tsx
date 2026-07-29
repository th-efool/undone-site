import { ChevronRight } from 'lucide-react';

import { HorizontalScroller } from '@/src/client/components/global/HorizontalScroller';

import type { SideQuest } from '../../models';

import { SideQuestCard } from './SideQuestCard';

import styles from './TrendingSideQuests.module.css';

export interface TrendingSideQuestsProps {
  items: SideQuest[];
}

export function TrendingSideQuests({ items }: TrendingSideQuestsProps) {
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

        <button
          type="button"
          className={styles.seeAll}
        >
          See all
        </button>

        <button
          type="button"
          className={styles.arrow}
        >
          <ChevronRight
            size={18}
            strokeWidth={2.5}
          />
        </button>
      </div>

      <HorizontalScroller>
        {items.map((item) => (
          <SideQuestCard
            key={item.id}
            item={item}
          />
        ))}
      </HorizontalScroller>
    </section>
  );
}
