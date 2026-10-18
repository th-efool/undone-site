'use client';

import { ArrowRight, Clock, Pause } from 'lucide-react';
import type { CompletedCourse, PausedCohort } from '../../models';
import styles from './HomeSummaryBar.module.css';

export interface HomeSummaryBarProps {
  pausedItems: PausedCohort[];
  completedItems: CompletedCourse[];
  onTogglePaused?: () => void;
  onToggleCompleted?: () => void;
  isPausedOpen?: boolean;
  isCompletedOpen?: boolean;
}

export function HomeSummaryBar({
  pausedItems = [],
  completedItems = [],
  onTogglePaused,
  onToggleCompleted,
  isPausedOpen = false,
  isCompletedOpen = false,
}: HomeSummaryBarProps) {
  const pausedCount = pausedItems.length;
  const completedCount = completedItems.length;

  return (
    <div className={styles.container}>
      {/* Paused Pill Row */}
      <div className={styles.pillRow}>
        <button
          type="button"
          className={styles.pillBadge}
          onClick={onTogglePaused}
          aria-expanded={isPausedOpen}
        >
          <div className={styles.iconBox}>
            <Pause size={14} className={styles.iconPurple} fill="currentColor" />
          </div>
          <span className={styles.label}>Paused</span>
          <span className={styles.count}>{pausedCount}</span>
        </button>

        <button
          type="button"
          className={`${styles.arrowBtn} ${isPausedOpen ? styles.arrowActive : ''}`}
          onClick={onTogglePaused}
          aria-label="Toggle paused cohorts"
        >
          <ArrowRight size={15} />
        </button>
      </div>

      {/* Recently Finished Pill Row */}
      <div className={styles.pillRow}>
        <button
          type="button"
          className={styles.pillBadge}
          onClick={onToggleCompleted}
          aria-expanded={isCompletedOpen}
        >
          <div className={styles.iconBox}>
            <Clock size={14} className={styles.iconPurple} />
          </div>
          <span className={styles.label}>Recently finished</span>
          <span className={styles.count}>{completedCount}</span>
        </button>

        <button
          type="button"
          className={`${styles.arrowBtn} ${isCompletedOpen ? styles.arrowActive : ''}`}
          onClick={onToggleCompleted}
          aria-label="Toggle recently finished cohorts"
        >
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
