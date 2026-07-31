'use client';

import { useState } from 'react';
import { Plus, X, Sparkles, Image as ImageIcon } from 'lucide-react';

import { Button } from '@/src/client/components/ui/Button/Button';
import type { CreateCohortDetailsModel } from '../../models/createCohort';
import { useWizardContext } from '../../providers/WizardProvider';
import { LearnerPreview } from '../LearnerPreview/LearnerPreview';

import styles from './IdentityStep.module.css';

interface IdentityStepProps {
  details: CreateCohortDetailsModel;
}

export function IdentityStep({ details }: IdentityStepProps) {
  const { state, actions } = useWizardContext();
  const draft = state.draft;

  const [tagInput, setTagInput] = useState('');
  const [reqInput, setReqInput] = useState('');
  const [outcomeInput, setOutcomeInput] = useState('');

  const isTitleMissing = !draft.title || draft.title.trim() === '';

  const addTag = () => {
    if (tagInput.trim()) {
      actions.addTag(tagInput.trim());
      setTagInput('');
    }
  };

  const addRequirement = () => {
    if (reqInput.trim()) {
      actions.addRequirement(reqInput.trim());
      setReqInput('');
    }
  };

  const addOutcome = () => {
    if (outcomeInput.trim()) {
      actions.addLearningOutcome(outcomeInput.trim());
      setOutcomeInput('');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.splitLayout}>
        {/* Left Column: Branding & Metadata Form */}
        <div className={styles.formCol}>
          <div className={styles.header}>
            <div className={styles.badgeLine}>
              <Sparkles size={14} color="#818cf8" />
              <span>Step 4: Branding & Identity</span>
            </div>
            <h2 className={styles.title}>Define your cohort branding</h2>
            <p className={styles.sub}>
              Give your cohort a compelling title, cover image, and description. See changes update live on the right!
            </p>
          </div>

          <div className={styles.card}>
            <div className={styles.field}>
              <label htmlFor="identity-title" className={styles.label}>
                Cohort Title <span className={styles.required}>* Required</span>
              </label>
              <input
                id="identity-title"
                value={draft.title}
                placeholder="e.g. Advanced Python Masterclass"
                className={`${styles.input} ${isTitleMissing ? styles.inputError : ''}`}
                onChange={(e) => actions.updateDraftField('title', e.target.value)}
              />
              {isTitleMissing && (
                <span className={styles.errorMessage}>Title is required before publishing</span>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="identity-subtitle" className={styles.label}>
                Subtitle / Tagline
              </label>
              <input
                id="identity-subtitle"
                value={draft.subtitle}
                placeholder="e.g. Master clean code, design patterns, and asynchronous programming"
                className={styles.input}
                onChange={(e) => actions.updateDraftField('subtitle', e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="identity-cover" className={styles.label}>
                Cover Image URL
              </label>
              <div className={styles.inlineRow}>
                <input
                  id="identity-cover"
                  value={draft.coverImage}
                  placeholder="https://images.unsplash.com/..."
                  className={styles.input}
                  onChange={(e) => actions.updateDraftField('coverImage', e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    actions.updateDraftField(
                      'coverImage',
                      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop',
                    )
                  }
                >
                  <ImageIcon size={14} />
                  Preset
                </Button>
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="identity-description" className={styles.label}>
                Cohort Overview & Description
              </label>
              <textarea
                id="identity-description"
                value={draft.description}
                placeholder="Explain what learners will achieve and what makes this cohort unique."
                className={styles.textarea}
                onChange={(e) => actions.updateDraftField('description', e.target.value)}
              />
            </div>

            {/* Requirements List */}
            <div className={styles.field}>
              <label className={styles.label}>Prerequisites & Requirements</label>
              <div className={styles.listContainer}>
                {draft.requirements.map((req, idx) => (
                  <div key={idx} className={styles.listItem}>
                    <span>{req}</span>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => actions.removeRequirement(idx)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <div className={styles.inlineComposer}>
                  <input
                    value={reqInput}
                    placeholder="Add a requirement (e.g. Basic Python syntax)"
                    className={styles.input}
                    onChange={(e) => setReqInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRequirement())}
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={addRequirement}>
                    <Plus size={14} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Learning Outcomes List */}
            <div className={styles.field}>
              <label className={styles.label}>Learning Outcomes</label>
              <div className={styles.listContainer}>
                {draft.learningOutcomes.map((outcome, idx) => (
                  <div key={idx} className={styles.listItem}>
                    <span>{outcome}</span>
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => actions.removeLearningOutcome(idx)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <div className={styles.inlineComposer}>
                  <input
                    value={outcomeInput}
                    placeholder="Add an outcome (e.g. Build production async microservices)"
                    className={styles.input}
                    onChange={(e) => setOutcomeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOutcome())}
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={addOutcome}>
                    <Plus size={14} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Overview Page Preview */}
        <div className={styles.previewCol}>
          <div className={styles.previewCard}>
            <div className={styles.previewHeader}>
              <span className={styles.previewTag}>Live Overview Preview</span>
              <span className={styles.previewHelp}>Updates in real-time as you edit</span>
            </div>
            <div className={styles.previewCanvas}>
              <LearnerPreview />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
