'use client';

import { ArcCarousel } from './ArcCarousel';

import type { SideQuest } from '../../models';

import { SideQuestCard } from '../TrendingSideQuests/SideQuestCard';

import styles from './PeopleFinishing.module.css';

export interface PeopleFinishingProps {
  items: SideQuest[];
}

export function PeopleFinishing({ items }: PeopleFinishingProps) {
  return (
    <section className={styles.section}>
      <ArcCarousel
        loop={true}
        panable={true}
        showArrows={false}
        scrollAmount={450}
      >
        {items.map((item) => (
          <SideQuestCard
            key={item.id}
            item={item}
          />
        ))}
      </ArcCarousel>
    </section>
  );
}


