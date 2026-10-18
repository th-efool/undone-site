'use client';

import React, { useState } from 'react';
import { CheckCircle2, ChevronUp, ChevronDown } from 'lucide-react';
import { HorizontalScroller } from '@/src/client/components/global/HorizontalScroller';
import type { CompletedCourse, HomeSectionContent } from '../../models';
import { CompletedCourseCard } from '../CompletedCourseCard/CompletedCourseCard';
import styles from './RecentlyCompleted.module.css';

export interface RecentlyCompletedProps {
  heading: HomeSectionContent;
  items: CompletedCourse[];
  isOpen?: boolean;
  onToggle?: () => void;
}

export function RecentlyCompleted({
  heading,
  items,
  isOpen: controlledIsOpen,
  onToggle,
}: RecentlyCompletedProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const toggle = onToggle || (() => setInternalIsOpen((prev) => !prev));

  if (!items.length) return null;

  return (
    <section className={styles.section} aria-labelledby="recently-completed-heading">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.iconBadge} aria-hidden="true">
            <CheckCircle2 size={16} strokeWidth={2.4} />
          </div>
          <div className={styles.titleGroup}>
            <div className={styles.titleRow}>
              <h2 id="recently-completed-heading" className={styles.title}>
                {heading?.title || 'Recently Finished'}
              </h2>
              <span className={styles.countBadge}>{items.length}</span>
            </div>
            <p className={styles.subtitle}>
              {heading?.subtitle || 'Completed quests and achievements in your learning journey.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          className={styles.toggleBtn}
          onClick={toggle}
          aria-label={isOpen ? 'Collapse completed cohorts' : 'Expand completed cohorts'}
          aria-expanded={isOpen}
        >
          {isOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
      </div>

      {isOpen && (
        <div className={styles.scrollerWrapper}>
          <HorizontalScroller scrollAmount={520}>
            {items.map((item) => (
              <CompletedCourseCard
                key={item.id}
                item={item}
              />
            ))}
          </HorizontalScroller>
        </div>
      )}
    </section>
  );
}
