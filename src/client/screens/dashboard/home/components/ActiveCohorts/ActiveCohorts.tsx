'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Users, ChevronUp, ChevronDown, ArrowRight, Compass } from 'lucide-react';
import type { ActiveCohort, HomeSectionContent, PauseOption, Weekday } from '../../models';
import { SubscribedCohortCard } from './SubscribedCohortCard';
import { InspectorPanel } from './InspectorPanel';
import styles from './ActiveCohorts.module.css';

export interface ActiveCohortsProps {
  heading: HomeSectionContent;
  items: ActiveCohort[];
  pauseOptions: PauseOption[];
  onReorder(draggedId: string, targetId: string): void;
  onUpdateDailyGoal(cohortId: string, minutes: number): void;
  onUpdateSchedule(cohortId: string, days: Weekday[]): void;
  onPause(cohortId: string, days: number, pausedReason?: string): void;
  onUpdateOrderStyle?(cohortId: string, style: string): void;
  onUpdateFrequency?(cohortId: string, frequency: string): void;
}

export const ActiveCohorts = React.memo(function ActiveCohorts({
  heading,
  items,
  pauseOptions,
  onPause,
  onReorder,
  onUpdateDailyGoal,
  onUpdateSchedule,
  onUpdateOrderStyle,
  onUpdateFrequency,
}: ActiveCohortsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isSectionOpen, setIsSectionOpen] = useState(true);

  const selectedCohort = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  );

  const handleCardSelect = useCallback((cohort: ActiveCohort) => {
    setSelectedId(cohort.id);
    setIsInspectorOpen(true);
  }, []);

  const handleMenuClick = useCallback((_e: React.MouseEvent, cohort: ActiveCohort) => {
    setSelectedId(cohort.id);
    setIsInspectorOpen(true);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setIsInspectorOpen(false);
    setSelectedId(null);
  }, []);

  const formattedMembers = useMemo(() => {
    const totalMembers = items.reduce(
      (acc, curr) => acc + (curr.memberCount || 64 + ((curr.title.length * 37) % 240)),
      0,
    );
    return totalMembers > 0 ? totalMembers.toLocaleString('en-US') : '2,340+';
  }, [items]);

  return (
    <section className={styles.section} aria-label={heading.title || 'Subscribed Cohorts'}>
      {/* Editorial Section Header matching reference */}
      <div className={styles.sectionHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.iconBadge} aria-hidden="true">
            <Users size={16} strokeWidth={2.4} />
          </div>
          <div className={styles.titleGroup}>
            <h2 className={styles.title}>{heading.title || 'Subscribed Cohorts'}</h2>
            <p className={styles.subtitle}>
              {items.length > 0
                ? `Learning alongside ${formattedMembers} curious minds.`
                : `Join ${formattedMembers} curious minds learning together.`}
            </p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={() => setIsSectionOpen((prev) => !prev)}
            aria-label={isSectionOpen ? 'Collapse section' : 'Expand section'}
            aria-expanded={isSectionOpen}
          >
            {isSectionOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>
        </div>
      </div>

      {/* Grid Content */}
      {isSectionOpen && (
        <div className={styles.contentLayout}>
          <div className={`${styles.grid} ${isInspectorOpen ? styles.gridWithInspector : ''}`}>
            {items.length === 0 ? (
              <div className={styles.emptyContainer} role="region" aria-label="No subscribed cohorts">
                <div className={styles.emptyCard}>
                  <div className={styles.emptyIconBadge} aria-hidden="true">
                    <Compass size={24} strokeWidth={2} />
                  </div>
                  <h3 className={styles.emptyTitle}>No active cohorts yet</h3>
                  <p className={styles.emptySubtitle}>
                    Start your learning journey by exploring curated tracks, community spaces, and focused courses.
                  </p>
                  <Link href="/explore" className={styles.emptyCta}>
                    <span>Discover cohorts</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ) : (
              items.map((cohort) => (
                <SubscribedCohortCard
                  key={cohort.id}
                  cohort={cohort}
                  onSelect={handleCardSelect}
                  onMenuClick={handleMenuClick}
                />
              ))
            )}
          </div>

          {/* Slide-in / Drawer Inspector Panel */}
          {isInspectorOpen && selectedCohort && (
            <div className={styles.inspectorWrapper}>
              <InspectorPanel
                cohort={selectedCohort}
                onUpdateSchedule={onUpdateSchedule}
                onUpdateDailyGoal={onUpdateDailyGoal}
                onUpdateOrderStyle={onUpdateOrderStyle}
                onUpdateFrequency={onUpdateFrequency}
                onClose={handleCloseInspector}
                onPause={onPause}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
});
