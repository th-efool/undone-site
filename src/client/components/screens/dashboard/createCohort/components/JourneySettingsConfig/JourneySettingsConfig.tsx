'use client';

import { Globe } from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';
import { visibilityOptions, difficultyOptions } from '../../mock/createCohort.mock';

import styles from './JourneySettingsConfig.module.css';

export function JourneySettingsConfig() {
  const { launchState, actions } = useWizardContext();
  const settings = launchState.journeySettings;

  return (
    <div className={styles.card}>
      <div className={styles.titleGroup}>
        <Globe size={16} color="#6366f1" />
        Visibility & Discovery Settings
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label className={styles.label}>Visibility</label>
          <select
            value={settings.visibility}
            onChange={(e) =>
              actions.updateJourneySettings({
                visibility: e.target.value as typeof settings.visibility,
              })
            }
            className={styles.select}
          >
            {visibilityOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Primary Language</label>
          <input
            type="text"
            value={settings.language}
            onChange={(e) => actions.updateJourneySettings({ language: e.target.value })}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Target Audience</label>
          <input
            type="text"
            value={settings.targetAudience}
            onChange={(e) => actions.updateJourneySettings({ targetAudience: e.target.value })}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Estimated Weekly Commitment</label>
          <input
            type="text"
            value={settings.estimatedWeeklyCommitment}
            onChange={(e) => actions.updateJourneySettings({ estimatedWeeklyCommitment: e.target.value })}
            className={styles.input}
          />
        </div>
      </div>
    </div>
  );
}
