'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';
import { useCurriculumQuality } from '../../hooks/useCurriculumQuality';

import styles from './CurriculumChecklist.module.css';

export function CurriculumChecklist() {
  const { curriculumState, state } = useWizardContext();
  const { checklist } = useCurriculumQuality(curriculumState.curriculum, state.draft);
  if (!curriculumState.curriculum) return null;

  const percentage = checklist.totalCount > 0 ? (checklist.passedCount / checklist.totalCount) * 100 : 0;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={styles.checklistCard}>
      <div className={styles.progressColumn} title="Publishing Readiness Checklist">
        <div className={styles.progressWrapper}>
          <svg width="60" height="60" viewBox="0 0 60 60" className={styles.circularProgress}>
            <circle cx="30" cy="30" r="24" className={styles.progressBg} />
            <circle 
              cx="30" 
              cy="30" 
              r="24" 
              className={checklist.isReady ? styles.progressFillReady : styles.progressFillPending}
              style={{ strokeDasharray: circumference, strokeDashoffset }}
              transform="rotate(-90 30 30)"
            />
          </svg>
          <span className={styles.progressText}>
            {checklist.passedCount}/{checklist.totalCount}
          </span>
        </div>
      </div>

      <div className={styles.gridColumn}>
        <div className={styles.grid}>
          {checklist.items.map((item) => (
            <div key={item.id} className={`${styles.item} ${item.passed ? styles.itemPassed : styles.itemFailed}`}>
              {item.passed ? (
                <CheckCircle2 size={15} color="#34d399" style={{ flexShrink: 0 }} />
              ) : (
                <Circle size={15} color="#64748b" style={{ flexShrink: 0 }} />
              )}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
