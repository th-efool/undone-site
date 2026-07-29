import { HorizontalScroller } from '@/src/client/components/global/HorizontalScroller';

import type { CompletedCourse, HomeSectionContent } from '../../models';
import { CompletedCourseCard } from '../CompletedCourseCard/CompletedCourseCard';
import { SectionHeader } from '../SectionHeader/SectionHeader';

import styles from './RecentlyCompleted.module.css';

export interface RecentlyCompletedProps {
  heading: HomeSectionContent;
  items: CompletedCourse[];
}

export function RecentlyCompleted({ heading, items }: RecentlyCompletedProps) {
  return (
    <section
      className={styles.section}
      aria-labelledby="recently-completed-heading"
    >
      <SectionHeader
        title={heading.title}
        subtitle={heading.subtitle}
      />

      <HorizontalScroller scrollAmount={820}>
        {items.map((item) => (
          <CompletedCourseCard
            key={item.id}
            item={item}
          />
        ))}
      </HorizontalScroller>
    </section>
  );
}
