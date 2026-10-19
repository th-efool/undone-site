'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Users, ChevronUp, ChevronDown, ArrowRight } from 'lucide-react';
import { InfiniteScroller, type InfiniteScrollerHandle } from '@/src/client/components/global/InfiniteScroller';
import { Tooltip } from '@/src/client/components/ui/Tooltip';
import { LiveSession } from '@/src/client/types/dashboard';
import { StudyRoomCard } from './StudyRoomCard';
import styles from './StudyRooms.module.css';

export interface StudyRoomsProps {
  items: LiveSession[];
  title?: string;
  subtitle?: string;
  viewAllHref?: string;
  variant?: 'standard' | 'compact';
}

export const StudyRooms = React.memo(function StudyRooms({
  items,
  title,
  subtitle,
  viewAllHref,
  variant = 'standard',
}: StudyRoomsProps) {
  const scrollerRef = useRef<InfiniteScrollerHandle>(null);
  const [isOpen, setIsOpen] = useState(true);
  const isCompact = variant === 'compact';

  if (isCompact) {
    return (
      <section className={styles.sectionCompact} aria-label={title || 'Active studyrooms'}>
        {/* Section Header matching Subscribed Cohorts */}
        <div className={styles.headerCompact}>
          <div className={styles.headerLeftCompact}>
            <div className={styles.iconBadgeCompact} aria-hidden="true">
              <Users size={16} strokeWidth={2.4} />
            </div>
            <div className={styles.titleGroupCompact}>
              <h2 className={styles.titleCompact}>{title || 'Active studyrooms'}</h2>
              <p className={styles.subtitleCompact}>
                {subtitle || 'Join focused rooms and learn together in real time.'}
              </p>
            </div>
          </div>

          <div className={styles.headerRightCompact}>
            <div className={styles.navButtonsCompact}>
              <button
                type="button"
                className={styles.navBtnCompact}
                onClick={() => scrollerRef.current?.scrollLeft()}
                aria-label="Scroll study rooms left"
              >
                <ChevronLeft size={15} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                className={styles.navBtnCompact}
                onClick={() => scrollerRef.current?.scrollRight()}
                aria-label="Scroll study rooms right"
              >
                <ChevronRight size={15} strokeWidth={2.2} />
              </button>
            </div>

            <button
              type="button"
              className={styles.toggleBtnCompact}
              onClick={() => setIsOpen((prev) => !prev)}
              aria-label={isOpen ? 'Collapse section' : 'Expand section'}
              aria-expanded={isOpen}
            >
              {isOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
          </div>
        </div>

        {isOpen && (
          <div className={styles.scrollerWrapperCompact}>
            <InfiniteScroller
              ref={scrollerRef}
              scrollAmount={380}
              loop={false}
              panable={true}
              showArrows={false}
              autoScroll={true}
              autoScrollSpeed={0.1}
              className={styles.infiniteScrollerCompact}
            >
              {items.map((item) => (
                <StudyRoomCard
                  key={item.id}
                  session={item}
                  variant="compact"
                />
              ))}
            </InfiniteScroller>
          </div>
        )}
      </section>
    );
  }

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
});
