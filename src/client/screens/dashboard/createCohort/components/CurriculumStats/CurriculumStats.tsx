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
    <div className={styles.statsInline}>
      <span className={styles.statItem}><Layers size={13} /> {curriculum.totalSeasons} Seasons</span>
      <span className={styles.statDot}>•</span>
      <span className={styles.statItem}><BookOpen size={13} /> {curriculum.totalLessons} Lessons</span>
      <span className={styles.statDot}>•</span>
      <span className={styles.statItem}><ListChecks size={13} /> {curriculum.totalChunks} Chunks</span>
      <span className={styles.statDot}>•</span>
      <span className={styles.statItem}><Clock size={13} /> {curriculum.totalHours}</span>
      
      {warningCount > 0 && (
        <>
          <span className={styles.statDot}>•</span>
          <button 
            type="button"
            className={styles.warningBtn}
            onClick={() => actions.setFilterWarningOnly(!curriculumState.filterWarningOnly)}
          >
            <AlertTriangle size={13} /> {warningCount} {warningCount === 1 ? 'Warning' : 'Warnings'}
          </button>
        </>
      )}
    </div>
  );
}
