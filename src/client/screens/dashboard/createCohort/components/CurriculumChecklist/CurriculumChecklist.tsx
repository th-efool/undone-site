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

  return (
    <div className={styles.checklistCard}>
      <div className={styles.header} onClick={() => setExpanded(!expanded)}>
        <div className={styles.titleGroup}>
          <Rocket size={16} color="#6366f1" />
          Publishing Readiness Checklist
          <span className={checklist.isReady ? styles.statusBadgeReady : styles.statusBadgePending}>
            {checklist.isReady ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            {checklist.statusLabel} ({checklist.passedCount}/{checklist.totalCount})
          </span>
        </div>

        {expanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
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
