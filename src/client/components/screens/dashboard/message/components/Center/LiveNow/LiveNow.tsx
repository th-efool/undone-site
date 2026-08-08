'use client';

import { InfiniteScroller } from '@/src/client/components/global/InfiniteScroller';
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
        <InfiniteScroller
          className={styles.scroller}
          scrollAmount={460}
          loop={true}
          panable={true}
          showArrows={false}
        >
          {items.map((item) => (
            <LiveCard
              key={item.id}
              session={item}
            />
          ))}
        </InfiniteScroller>
      </div>
    </section>
  );
}
