import { ChevronRight } from 'lucide-react';

import { HorizontalScroller } from '@/src/client/components/global/HorizontalScroller';

import type { TrendingCourse } from '../../models';

import { TrendingCourseCard } from './TrendingCourseCard';

import styles from './PeopleFinishing.module.css';

export interface PeopleFinishingProps {
  items: TrendingCourse[];
}

export function PeopleFinishing({ items }: PeopleFinishingProps) {
  return (
    <section
      className={styles.section}
      aria-labelledby="people-finishing-heading"
    >
      <div className={styles.header}>
        <h2
          id="people-finishing-heading"
          className={styles.title}
        >
          People Are Finishing These
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
          <TrendingCourseCard
            key={item.id}
            item={item}
          />
        ))}
      </HorizontalScroller>
    </section>
  );
}
