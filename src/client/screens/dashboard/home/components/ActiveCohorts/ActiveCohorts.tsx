'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Users, ChevronUp, ChevronDown, ArrowRight } from 'lucide-react';
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

export function ActiveCohorts({
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

  const selectedCohort = items.find((item) => item.id === selectedId) || null;

  const handleCardSelect = (cohort: ActiveCohort) => {
    setSelectedId(cohort.id);
    setIsInspectorOpen(true);
  };

  const handleCloseInspector = () => {
    setIsInspectorOpen(false);
    setSelectedId(null);
  };

  const totalMembers = items.reduce(
    (acc, curr) => acc + (curr.memberCount || 64 + ((curr.title.length * 37) % 240)),
    0,
  );
  const formattedMembers = (totalMembers || 2341).toLocaleString();

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
              Learning alongside {formattedMembers} curious minds.
            </p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <Link href="/explore" className={styles.viewAllLink}>
            <span>View all</span>
            <ArrowRight size={14} strokeWidth={2.2} />
          </Link>

          <button
            type="button"
            className={styles.toggleBtn}
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
            {items.map((cohort) => (
              <SubscribedCohortCard
                key={cohort.id}
                cohort={cohort}
                onSelect={handleCardSelect}
                onMenuClick={(_, c) => handleCardSelect(c)}
              />
            ))}
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
}
