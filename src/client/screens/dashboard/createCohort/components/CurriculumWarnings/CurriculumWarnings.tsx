'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Info, AlertOctagon } from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './CurriculumWarnings.module.css';

export function CurriculumWarnings() {
  const { curriculumState, actions } = useWizardContext();
  const [expanded, setExpanded] = useState(false);

  const warnings = curriculumState.curriculum?.warnings ?? [];
  if (!warnings.length) return null;

  return (
    <div className={`${styles.container} ${expanded ? styles.expanded : styles.collapsed}`}>
      <button 
        className={styles.headerBtn} 
        onClick={() => setExpanded(!expanded)}
        title="Validation & Optimization Hints"
      >
        <div className={styles.iconWrapper}>
          <AlertTriangle size={20} className={styles.alertIcon} />
          <span className={styles.badge}>{warnings.length}</span>
        </div>
      </button>

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
