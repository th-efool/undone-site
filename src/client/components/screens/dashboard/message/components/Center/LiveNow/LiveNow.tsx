'use client';

import { HorizontalScroller } from '@/src/client/components/global/HorizontalScroller';
import { LiveSession } from '../../../models';
import { EmptyState } from '../../shared/EmptyState/EmptyState';
import { LiveCard } from '../LiveCard/LiveCard';
import styles from './LiveNow.module.css';

interface Props {
  items: LiveSession[];
}

export function LiveNow({ items }: Props) {
  if (!items.length) {
    return (
      <section className={styles.section}>
        <EmptyState
          title="No active sessions"
          message="No live learning right now. Check back later!"
        />
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.scrollerWrapper}>
        <HorizontalScroller
          className={styles.scroller}
          scrollAmount={460}
          loop={true}
          showArrows={false}
        >
          {items.map((item) => (
            <LiveCard
              key={item.id}
              session={item}
            />
          ))}
        </HorizontalScroller>
      </div>
    </section>
  );
}
