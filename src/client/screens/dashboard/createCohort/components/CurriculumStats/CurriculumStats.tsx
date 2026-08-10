'use client';

import { Layers, BookOpen, Clock, AlertTriangle, ListChecks } from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './CurriculumStats.module.css';

export function CurriculumStats() {
  const { curriculumState, actions } = useWizardContext();
  const curriculum = curriculumState.curriculum;

  if (!curriculum) return null;

  const warningCount = curriculum.warnings.length;

  return (
    <div className={styles.statsBar}>
      <div className={styles.statCard}>
        <span className={styles.statLabel}>
          <Layers size={13} />
          Seasons
        </span>
        <span className={styles.statValue}>{curriculum.totalSeasons}</span>
      </div>

      <div className={styles.statCard}>
        <span className={styles.statLabel}>
          <BookOpen size={13} />
          Lessons
        </span>
        <span className={`${styles.statValue} ${styles.statValueHighlight}`}>
          {curriculum.totalLessons}
        </span>
      </div>

      <div className={styles.statCard}>
        <span className={styles.statLabel}>
          <ListChecks size={13} />
          Chunks
        </span>
        <span className={styles.statValue}>{curriculum.totalChunks}</span>
      </div>

      <div className={styles.statCard}>
        <span className={styles.statLabel}>
          <Clock size={13} />
          Duration
        </span>
        <span className={styles.statValue}>{curriculum.totalHours}</span>
      </div>

      <div
        className={`${styles.statCard} ${warningCount > 0 ? styles.clickable : ''}`}
        onClick={() => {
          if (warningCount > 0) {
            actions.setFilterWarningOnly(!curriculumState.filterWarningOnly);
          }
        }}
      >
        <span className={styles.statLabel}>
          <AlertTriangle size={13} />
          Warnings
        </span>
        <span className={`${styles.statValue} ${warningCount > 0 ? styles.statWarning : ''}`}>
          {warningCount}
        </span>
      </div>
    </div>
  );
}
