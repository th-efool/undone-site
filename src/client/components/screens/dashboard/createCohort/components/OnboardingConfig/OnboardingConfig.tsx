'use client';

import { UserCheck } from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './OnboardingConfig.module.css';

export function OnboardingConfig() {
  const { launchState, actions } = useWizardContext();
  const onboarding = launchState.onboarding;

  return (
    <div className={styles.card}>
      <div className={styles.titleGroup}>
        <UserCheck size={16} color="#6366f1" />
        First-Time Learner Experience (Onboarding)
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label className={styles.label}>Welcome Message</label>
          <textarea
            value={onboarding.welcomeMessage}
            onChange={(e) => actions.updateOnboarding({ welcomeMessage: e.target.value })}
            className={`${styles.input} ${styles.textarea}`}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Journey Introduction</label>
          <textarea
            value={onboarding.journeyIntroduction}
            onChange={(e) => actions.updateOnboarding({ journeyIntroduction: e.target.value })}
            className={`${styles.input} ${styles.textarea}`}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Recommended Daily Goal</label>
          <input
            type="text"
            value={onboarding.recommendedDailyGoal}
            onChange={(e) => actions.updateOnboarding({ recommendedDailyGoal: e.target.value })}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Suggested Weekly Commitment</label>
          <input
            type="text"
            value={onboarding.suggestedWeeklyCommitment}
            onChange={(e) => actions.updateOnboarding({ suggestedWeeklyCommitment: e.target.value })}
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Completion Motivation</label>
          <input
            type="text"
            value={onboarding.completionMotivation}
            onChange={(e) => actions.updateOnboarding({ completionMotivation: e.target.value })}
            className={styles.input}
          />
        </div>
      </div>
    </div>
  );
}
