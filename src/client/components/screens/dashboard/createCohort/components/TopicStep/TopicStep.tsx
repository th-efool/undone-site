'use client';

import { Sparkles, Check, BookOpen, Clock, Layers } from 'lucide-react';
import type { CreateCohortDetailsModel } from '../../models/createCohort';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './TopicStep.module.css';

interface TopicStepProps {
  details: CreateCohortDetailsModel;
}

export function TopicStep({ details }: TopicStepProps) {
  const { state, actions } = useWizardContext();
  const draft = state.draft;

  return (
    <div className={styles.container}>
      <div className={styles.heroHeader}>
        <div className={styles.badgeLine}>
          <Sparkles size={14} color="#818cf8" />
          <span>Step 1: Intent & Category</span>
        </div>
        <h2 className={styles.heroTitle}>What subject will this cohort master?</h2>
        <p className={styles.heroSub}>
          Select your core topic and target audience. You will import your content sources next!
        </p>
      </div>

      <div className={styles.card}>
        {/* Field 1: Primary Topic */}
        <div className={styles.fieldGroup}>
          <label htmlFor="topic-input" className={styles.label}>
            Primary Topic
          </label>
          <input
            id="topic-input"
            value={draft.primaryTopic}
            placeholder="e.g. Python Development, System Design, Mindset & Focus..."
            className={styles.textInput}
            onChange={(e) => actions.updateDraftField('primaryTopic', e.target.value)}
          />
        </div>

        {/* Field 2: Category Chips */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Category</label>
          <div className={styles.categoryGrid}>
            {details.categoryOptions.map((cat) => {
              const selected = draft.categories.includes(cat.label);
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`${styles.catChip} ${selected ? styles.catSelected : ''}`}
                  onClick={() => actions.toggleCategory(cat.label)}
                >
                  {selected && <Check size={14} />}
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Field 3 & 4: Difficulty & Estimated Time */}
        <div className={styles.twoCol}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Difficulty Level</label>
            <div className={styles.difficultyGrid}>
              {['Beginner', 'Intermediate', 'Advanced'].map((diff) => {
                const selected = draft.difficulty === diff;
                return (
                  <button
                    key={diff}
                    type="button"
                    className={`${styles.diffCard} ${selected ? styles.diffSelected : ''}`}
                    onClick={() => actions.updateDraftField('difficulty', diff as any)}
                  >
                    <span className={styles.diffLabel}>{diff}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="time-input" className={styles.label}>
              Estimated Duration
            </label>
            <input
              id="time-input"
              value={draft.estimatedCompletionTime}
              placeholder="e.g. 2-4 weeks"
              className={styles.textInput}
              onChange={(e) => actions.updateDraftField('estimatedCompletionTime', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
