'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Rocket, AlertCircle } from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';
import { useCurriculumQuality } from '../../hooks/useCurriculumQuality';

import styles from './CurriculumChecklist.module.css';

export function CurriculumChecklist() {
  const { curriculumState, state } = useWizardContext();
  const { checklist } = useCurriculumQuality(curriculumState.curriculum, state.draft);
  const [expanded, setExpanded] = useState(false);

  if (!curriculumState.curriculum) return null;

  const percentage = checklist.totalCount > 0 ? (checklist.passedCount / checklist.totalCount) * 100 : 0;
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={styles.checklistCard} data-expanded={expanded}>
      <div 
        className={styles.header} 
        onClick={() => setExpanded(!expanded)}
        title="Publishing Readiness Checklist"
      >
        <div className={styles.progressWrapper}>
          <svg width="36" height="36" viewBox="0 0 36 36" className={styles.circularProgress}>
            <circle cx="18" cy="18" r="14" className={styles.progressBg} />
            <circle 
              cx="18" 
              cy="18" 
              r="14" 
              className={checklist.isReady ? styles.progressFillReady : styles.progressFillPending}
              style={{ strokeDasharray: circumference, strokeDashoffset }}
              transform="rotate(-90 18 18)"
            />
          </svg>
          <span className={styles.progressText}>
            {checklist.passedCount}/{checklist.totalCount}
          </span>
        </div>

        <div className={styles.iconContainer}>
          {expanded ? <ChevronUp size={16} /> : <Rocket size={16} className={styles.rocketIcon} />}
        </div>
      </div>

      {expanded && (
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
      )}
    </div>
  );
}
