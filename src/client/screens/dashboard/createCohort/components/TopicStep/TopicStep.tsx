'use client';

import { Check } from 'lucide-react';
import type { CreateCohortDetailsModel } from '../../models/createCohort';
import { useWizardContext } from '../../providers/WizardProvider';

import { Container } from '@/src/client/components/global/layout/Container';
import { Stack } from '@/src/client/components/global/layout/Stack';
import { Cluster } from '@/src/client/components/global/layout/Cluster';

import styles from './TopicStep.module.css';

const DURATION_PRESETS = [
  '1 Week',
  '2 Weeks',
  '3-4 Weeks',
  '1-2 Months',
  '3-6 Months',
];

const DURATION_UNITS = ['Hours', 'Days', 'Weeks', 'Months'];

interface TopicStepProps {
  details: CreateCohortDetailsModel;
}

export function TopicStep({ details }: TopicStepProps) {
  const { state, actions } = useWizardContext();
  const draft = state.draft;

  // Sanitize primary topic: prevent script/HTML tags and slice to max 100 chars
  const handlePrimaryTopicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const sanitized = raw.replace(/<[^>]*>?/gm, '').slice(0, 100);
    actions.updateDraftField('primaryTopic', sanitized);
  };

  // Duration selector logic
  const isPreset = DURATION_PRESETS.includes(draft.estimatedCompletionTime);
  const selectedPreset = isPreset ? draft.estimatedCompletionTime : 'Custom...';

  const numMatch = draft.estimatedCompletionTime.match(/(\d+)/);
  const customNum = numMatch ? Math.max(1, parseInt(numMatch[1], 10)) : 1;

  let customUnit = 'Weeks';
  if (/hour/i.test(draft.estimatedCompletionTime)) customUnit = 'Hours';
  else if (/day/i.test(draft.estimatedCompletionTime)) customUnit = 'Days';
  else if (/month/i.test(draft.estimatedCompletionTime)) customUnit = 'Months';
  else if (/week/i.test(draft.estimatedCompletionTime)) customUnit = 'Weeks';

  const handlePresetSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'Custom...') {
      actions.updateDraftField('estimatedCompletionTime', `${customNum} ${customUnit}`);
    } else {
      actions.updateDraftField('estimatedCompletionTime', val);
    }
  };

  const handleCustomNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanDigits = e.target.value.replace(/\D/g, '');
    const num = cleanDigits ? Math.min(999, Math.max(1, parseInt(cleanDigits, 10))) : 1;
    actions.updateDraftField('estimatedCompletionTime', `${num} ${customUnit}`);
  };

  const handleCustomUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const unit = e.target.value;
    actions.updateDraftField('estimatedCompletionTime', `${customNum} ${unit}`);
  };

  return (
    <Container size="md" className={styles.container}>
      <Stack gap="5">
        <h2 className={styles.sharpHeading}>What subject will this cohort master?</h2>

        <Stack gap="5">
          {/* Field 1: Primary Topic */}
          <Stack gap="2" className={styles.fieldGroup}>
            <div className={styles.labelHeader}>
              <label htmlFor="topic-input" className={styles.label}>
                Primary Topic
              </label>
              <span className={styles.charCount}>
                {draft.primaryTopic.length}/100
              </span>
            </div>
            <input
              id="topic-input"
              value={draft.primaryTopic}
              placeholder="e.g. Python Development, System Design, Mindset & Focus..."
              className={styles.textInput}
              maxLength={100}
              onChange={handlePrimaryTopicChange}
            />
          </Stack>

          {/* Field 2: Category Chips */}
          <Stack gap="2" className={styles.fieldGroup}>
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
                    aria-pressed={selected}
                  >
                    {selected && <Check size="1em" />}
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
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
              <label htmlFor="time-preset-select" className={styles.label}>
                Estimated Duration
              </label>
              <div className={styles.durationWrapper}>
                <select
                  id="time-preset-select"
                  value={selectedPreset}
                  className={styles.selectInput}
                  onChange={handlePresetSelect}
                >
                  {DURATION_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                  <option value="Custom...">Custom...</option>
                </select>

                {selectedPreset === 'Custom...' && (
                  <div className={styles.customDurationGroup}>
                    <input
                      type="number"
                      min={1}
                      value={customNum}
                      className={styles.numberInput}
                      onChange={handleCustomNumberChange}
                      placeholder="e.g. 4"
                    />
                    <select
                      value={customUnit}
                      className={styles.unitSelect}
                      onChange={handleCustomUnitChange}
                    >
                      {DURATION_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </Stack>
          </Cluster>
        </Stack>
      </Stack>
    </Container>
  );
}

