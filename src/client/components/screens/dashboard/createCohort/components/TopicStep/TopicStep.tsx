'use client';

import { Check, BookOpen, Clock, Layers } from 'lucide-react';
import type { CreateCohortDetailsModel } from '../../models/createCohort';
import { useWizardContext } from '../../providers/WizardProvider';

import { Container } from '@/src/client/components/global/layout/Container';
import { Stack } from '@/src/client/components/global/layout/Stack';
import { Cluster } from '@/src/client/components/global/layout/Cluster';


import styles from './TopicStep.module.css';

interface TopicStepProps {
  details: CreateCohortDetailsModel;
}

export function TopicStep({ details }: TopicStepProps) {
  const { state, actions } = useWizardContext();
  const draft = state.draft;

  return (
    <Container size="md" className={styles.container}>
      <Stack gap="5">
        <h2 className={styles.sharpHeading}>What subject will this cohort master?</h2>

        <Stack gap="5">
          {/* Field 1: Primary Topic */}
          <Stack gap="2" className={styles.fieldGroup}>
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
          </Stack>

          {/* Field 2: Category Chips */}
          <Stack gap="2" className={styles.fieldGroup}>
            <label className={styles.label}>Category</label>
            <Cluster gap="0" className={styles.categoryGrid}>
              {details.categoryOptions.map((cat) => {
                const selected = draft.categories.includes(cat.label);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`${styles.catChip} ${selected ? styles.catSelected : ''}`}
                    onClick={() => actions.toggleCategory(cat.label)}
                  >
                    {selected && <Check size="1em" />}
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </Cluster>
          </Stack>

          {/* Field 3 & 4: Difficulty & Estimated Time */}
          <Cluster gap="4" className={styles.twoCol}>
            <Stack gap="2" className={styles.fieldGroup}>
              <label className={styles.label}>Difficulty Level</label>
              <Cluster gap="0" className={styles.difficultyGrid}>
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
              </Cluster>
            </Stack>

            <Stack gap="2" className={styles.fieldGroup}>
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
            </Stack>
          </Cluster>
        </Stack>
      </Stack>
    </Container>
  );
}
