'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Info, AlertOctagon } from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './CurriculumWarnings.module.css';

export function CurriculumWarnings() {
  const { curriculumState, actions } = useWizardContext();
  const [expanded, setExpanded] = useState(true);

  const warnings = curriculumState.curriculum?.warnings ?? [];
  if (!warnings.length) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setExpanded(!expanded)}>
        <div className={styles.title}>
          <AlertTriangle size={16} />
          Validation & Optimization Hints
          <span className={styles.badge}>{warnings.length}</span>
        </div>
        {expanded ? <ChevronUp size={16} color="#fbbf24" /> : <ChevronDown size={16} color="#fbbf24" />}
      </div>

      {expanded && (
        <div className={styles.warningList}>
          {warnings.map((warning) => (
            <div key={warning.id} className={styles.warningItem}>
              <div className={styles.itemContent}>
                {warning.severity === 'danger' ? (
                  <AlertOctagon size={14} className={`${styles.severityIcon} ${styles.severitydanger}`} />
                ) : warning.severity === 'warning' ? (
                  <AlertTriangle size={14} className={`${styles.severityIcon} ${styles.severitywarning}`} />
                ) : (
                  <Info size={14} className={`${styles.severityIcon} ${styles.severityinfo}`} />
                )}
                <span>
                  <strong>{warning.title}:</strong> {warning.message}
                </span>
              </div>

              {(warning.seasonId || warning.lessonId) && (
                <button
                  type="button"
                  className={styles.focusBtn}
                  onClick={() => {
                    if (warning.lessonId) {
                      actions.selectLesson(warning.lessonId);
                    } else if (warning.seasonId) {
                      actions.selectSeason(warning.seasonId);
                    }
                  }}
                >
                  Focus
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
