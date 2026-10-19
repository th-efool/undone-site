'use client';

import React from 'react';
import Link from 'next/link';
import type { ActiveCohort, HomeSectionContent, LearningSchedule } from '../../models';
import { SubscribedCohortCard } from './SubscribedCohortCard';
import styles from './ActiveCohorts.module.css';

export interface CohortLearningSettings {
  dailyGoalMinutes: number;
  schedule: LearningSchedule;
  orderStyle: NonNullable<ActiveCohort['orderStyle']>;
}

export interface ActiveCohortsProps {
  heading: HomeSectionContent;
  items: ActiveCohort[];
  onPause(cohortId: string, pausedUntil: Date): void | Promise<void>;
  onResume(cohortId: string): void | Promise<void>;
  onSave(cohortId: string, settings: CohortLearningSettings): Promise<void>;
  onDelete(cohortId: string): Promise<void>;
}

export const ActiveCohorts = React.memo(function ActiveCohorts({
  heading, items, onPause, onResume, onSave, onDelete,
}: ActiveCohortsProps) {
  return (
    <section className={styles.section} aria-label={heading.title || 'Subscribed Cohorts'}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.title}>{heading.title || 'Subscribed Cohorts'}</h2>
      </div>
      <div className={styles.grid}>
        {items.map((cohort) => (
          <SubscribedCohortCard
            key={cohort.cohortId || cohort.id}
            cohort={cohort}
            onPause={(until) => onPause(cohort.cohortId || cohort.id, until)}
            onResume={() => onResume(cohort.cohortId || cohort.id)}
            onSave={(settings) => onSave(cohort.cohortId || cohort.id, settings)}
            onDelete={() => onDelete(cohort.cohortId || cohort.id)}
          />
        ))}
      </div>
      {items.length === 0 && <Link href="/explore">Discover cohorts</Link>}
    </section>
  );
});
