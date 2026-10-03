'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { InfiniteScroller, type InfiniteScrollerHandle } from '@/src/client/components/global/InfiniteScroller';
import { Tooltip } from '@/src/client/components/ui/Tooltip';
import { LiveSession } from '@/src/client/screens/dashboard/message/models';
import { StudyRoomCard } from './StudyRoomCard';

import styles from './StudyRooms.module.css';

interface StudyRoomsProps {
  items: LiveSession[];
}

export function StudyRooms({ items }: StudyRoomsProps) {
  const scrollerRef = useRef<InfiniteScrollerHandle>(null);

  return (
    <section className={styles.section} aria-labelledby="study-rooms-heading">
      <div className={styles.header}>
        <h2 id="study-rooms-heading" className={styles.title}>
          Study, chat, and get work done<br />with learners from around the world.
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

      <div className={styles.scrollerWrapper}>
        <InfiniteScroller
          ref={scrollerRef}
          scrollAmount={740}
          loop={true}
          panable={true}
          showArrows={false}
          autoScroll={true}
          autoScrollSpeed={0.4}
        >
          {items.map((item) => (
            <StudyRoomCard
              key={item.id}
              session={item}
            />
          ))}
        </InfiniteScroller>
      </div>
    </section>
  );
}
