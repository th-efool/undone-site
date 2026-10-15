'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type {
  CohortAction,
  CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import { InkUnderline } from '@/src/client/screens/cohortCreation/components/InkUnderline';
import startingStyles from '@/src/client/screens/cohortCreation/components/StartingPoint.module.css';
import styles from './GoalStageView.module.css';

export interface GoalStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
}

export function GoalStageView({
  workspace,
  dispatchAction,
}: GoalStageViewProps) {
  const [intent, setIntent] = useState(workspace.intent || '');
  const [audience, setAudience] = useState(workspace.audience || '');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setIntent(workspace.intent || '');
  }, [workspace.intent]);

  useEffect(() => {
    setAudience(workspace.audience || '');
  }, [workspace.audience]);

  const handleIntentBlur = async () => {
    const trimmed = intent.trim();
    if (trimmed && trimmed !== workspace.intent.trim()) {
      await dispatchAction({ type: 'set_intent', intent: trimmed });
    }
  };

  const handleAudienceBlur = async () => {
    const trimmed = audience.trim();
    if (trimmed !== (workspace.audience || '').trim()) {
      await dispatchAction({ type: 'set_audience', audience: trimmed });
    }
  };

  const handlePacingChange = async (minutes: number) => {
    if (workspace.dailyMinutes === minutes) return;
    await dispatchAction({ type: 'set_daily_minutes', dailyMinutes: minutes });
  };

  const handleGenerate = async () => {
    const trimmedIntent = intent.trim();
    if (!confirmed || !trimmedIntent || workspace.dailyMinutes < 1) return;

    if (trimmedIntent !== workspace.intent.trim()) {
      await dispatchAction({ type: 'set_intent', intent: trimmedIntent });
    }
    const trimmedAudience = audience.trim();
    if (trimmedAudience !== (workspace.audience || '').trim()) {
      await dispatchAction({ type: 'set_audience', audience: trimmedAudience });
    }

    await dispatchAction({ type: 'start_goal_generation' });
  };

  const pacingOptions = [15, 30, 45, 60];
  const isCtaDisabled = !confirmed || !intent.trim() || workspace.dailyMinutes < 1;

  return (
    <section aria-label="Create AI-authored guide" className={styles.workspace}>
      {/* Top starting point tabs */}
      <nav aria-label="Starting point" className={startingStyles.compact}>
        <button
          type="button"
          onClick={() => void dispatchAction({ type: 'back_to_starting_point' })}
          aria-label="Back to starting point"
        >
          <ArrowLeft size={16} />
        </button>
        {[
          { value: 'have_material' as const, label: 'I already have material' },
          { value: 'find_material' as const, label: 'Find material for me' },
          { value: 'have_goal' as const, label: 'I just have a goal' },
        ].map(choice => (
          <button
            key={choice.value}
            type="button"
            aria-pressed={(workspace.journey?.branch ?? 'have_goal') === choice.value}
            onClick={async () => {
              if (workspace.journey?.branch === choice.value) return;
              await dispatchAction({ type: 'back_to_starting_point' });
              await dispatchAction({ type: 'choose_starting_point', choice: choice.value });
            }}
          >
            {choice.label}
          </button>
        ))}
      </nav>

      {/* Editorial Header */}
      <header className={styles.heading}>
        <p className={styles.eyebrow}>CREATE AI-AUTHORED GUIDE</p>
        <h1>
          Shape your{' '}
          <span className={styles.underlineSpan}>
            goal and pacing.<InkUnderline className={styles.underline} />
          </span>
        </h1>
        <p className={styles.subtitle}>
          We&apos;ll author a bounded introductory learning guide tailored to your intent and pace.
        </p>
      </header>

      {/* Form Card */}
      <div className={styles.card}>
        {/* Learning Goal */}
        <div className={styles.formGroup}>
          <label htmlFor="learning-goal-intent" className={styles.label}>
            Learning Goal
          </label>
          <textarea
            id="learning-goal-intent"
            aria-label="Learning goal"
            className={styles.textarea}
            value={intent}
            onChange={e => setIntent(e.target.value)}
            onBlur={handleIntentBlur}
            placeholder="e.g. Master Distributed Consensus in Go"
          />
          <p className={styles.inputHelp}>
            What you want to learn or achieve in this cohort.
          </p>
        </div>

        {/* Target Audience */}
        <div className={styles.formGroup}>
          <label htmlFor="target-audience-input" className={styles.label}>
            Target Audience
          </label>
          <input
            id="target-audience-input"
            aria-label="Target audience"
            type="text"
            className={styles.input}
            value={audience}
            onChange={e => setAudience(e.target.value)}
            onBlur={handleAudienceBlur}
            placeholder="e.g. Intermediate software engineers"
          />
          <p className={styles.inputHelp}>
            Who this material is intended for (background, prerequisite knowledge).
          </p>
        </div>

        {/* Daily Learning Time (Pacing) */}
        <div className={styles.formGroup}>
          <label className={styles.label}>Daily Learning Time</label>
          <div className={styles.pills} role="group" aria-label="Daily learning time options">
            {pacingOptions.map(min => (
              <button
                key={min}
                type="button"
                className={styles.pill}
                aria-pressed={workspace.dailyMinutes === min}
                onClick={() => handlePacingChange(min)}
              >
                {min} min
              </button>
            ))}
          </div>
          <p className={styles.inputHelp}>
            How much focused time you can dedicate each day.
          </p>
        </div>

        {/* AI Disclosure Banner */}
        <div className={styles.disclosureBox} role="note">
          <p className={styles.disclosureText}>
            AI-authored learning guide, not verified external source material. Check factual claims independently.
          </p>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              aria-label="Use AI-authored material for my saved goal"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className={styles.checkbox}
            />
            <span>Use AI-authored material for my saved goal</span>
          </label>
        </div>

        {/* Primary CTA */}
        <div>
          <button
            type="button"
            disabled={isCtaDisabled}
            onClick={handleGenerate}
            className={styles.primaryBtn}
          >
            <Sparkles size={16} aria-hidden="true" /> Generate learning guide
          </button>
        </div>
      </div>
    </section>
  );
}
