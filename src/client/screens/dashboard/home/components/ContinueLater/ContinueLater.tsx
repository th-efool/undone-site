'use client';

import React, { useState } from 'react';
import { Pause, ChevronUp, ChevronDown } from 'lucide-react';
import { InfiniteScroller } from '@/src/client/components/global/InfiniteScroller';
import type { HomeSectionContent, PausedCohort } from '../../models';
import { ContinueLaterCard } from '../ContinueLaterCard/ContinueLaterCard';
import styles from './ContinueLater.module.css';

export interface ContinueLaterProps {
  heading: HomeSectionContent;
  items: PausedCohort[];
  onResume(cohortId: string): void;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function ContinueLater({
  heading,
  items,
  onResume,
  isOpen: controlledIsOpen,
  onToggle,
}: ContinueLaterProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const toggle = onToggle || (() => setInternalIsOpen((prev) => !prev));

  if (!items.length) return null;

  return (
    <section className={styles.section} aria-labelledby="continue-later-heading">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.iconBadge} aria-hidden="true">
            <Pause size={15} strokeWidth={2.4} fill="currentColor" />
          </div>
          <div className={styles.titleGroup}>
            <div className={styles.titleRow}>
              <h2 id="continue-later-heading" className={styles.title}>
                {heading?.title || 'Paused Cohorts'}
              </h2>
              <span className={styles.countBadge}>{items.length}</span>
            </div>
            <p className={styles.subtitle}>
              {heading?.subtitle || 'Cohorts on hold — pick up right where you left off.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          className={styles.toggleBtn}
          onClick={toggle}
          aria-label={isOpen ? 'Collapse paused cohorts' : 'Expand paused cohorts'}
          aria-expanded={isOpen}
        >
          {isOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
      </div>

      {isOpen && (
        <div className={styles.scrollerWrapper}>
          <InfiniteScroller
            scrollAmount={480}
            loop={false}
            panable={true}
            showArrows={false}
            autoScroll={false}
            align="start"
          >
            {items.map((item) => (
              <ContinueLaterCard
                key={item.id}
                item={item}
                onResume={onResume}
              />
            ))}
          </InfiniteScroller>
        </div>
      )}
    </section>
  );
}
