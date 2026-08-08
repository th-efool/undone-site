import Image from 'next/image';
'use client';

import { useState } from 'react';
import { Plus, X, Check, Image as ImageIcon, BookOpen, Target, ShieldCheck, Tag } from 'lucide-react';

import { Button } from '@/src/client/components/ui/Button/Button';
import type { CreateCohortDetailsModel, CreateCohortDraft } from '../../models/createCohort';
import { useWizardContext } from '../../providers/WizardProvider';
import { getAvatar } from '@/src/client/mock/avatars';

import styles from './DetailsStep.module.css';

interface DetailsStepProps {
  details: CreateCohortDetailsModel;
}

export function DetailsStep({ details }: DetailsStepProps) {
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
    <div className={styles.root}>
      <div className={styles.grid}>
        {/* Left Column: Organized Inputs */}
        <div className={styles.formContent}>
          {/* Card 1: Cohort Identity */}
          <div className={styles.cardSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Cohort Identity</h2>
              <span className={styles.sectionSub}>Define the title, promise, and core topic.</span>
            </div>

            <div className={styles.primaryFields}>
              <div className={styles.field}>
                <div className={styles.fieldHeader}>
                  <label htmlFor="cohort-title" className={styles.fieldLabel}>
                    Cohort Title <span className={styles.requiredAsterisk}>* Required</span>
                  </label>
                  {isTitleMissing && (
                    <span className={styles.errorMessage}>Title is required to continue</span>
                  )}
                </div>
                <input
                  id="cohort-title"
                  value={draft.title}
                  placeholder="e.g. Python for Beginners (100 Days of Code)"
                  className={`${styles.input} ${isTitleMissing ? styles.inputError : ''}`}
                  onChange={(e) => actions.updateDraftField('title', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="cohort-subtitle" className={styles.fieldLabel}>
                  Subtitle
                </label>
                <input
                  id="cohort-subtitle"
                  value={draft.subtitle}
                  placeholder="e.g. Build real projects and master programming step by step"
                  className={styles.input}
                  onChange={(e) => actions.updateDraftField('subtitle', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="cohort-description" className={styles.fieldLabel}>
                  Description
                </label>
                <textarea
                  id="cohort-description"
                  value={draft.description}
                  placeholder="Explain what learners will achieve and what makes this cohort unique."
                  className={styles.textarea}
                  onChange={(e) => actions.updateDraftField('description', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="cohort-primary-topic" className={styles.fieldLabel}>
                  Primary Topic <span className={styles.requiredAsterisk}>*</span>
                </label>
                <input
                  id="cohort-primary-topic"
                  value={draft.primaryTopic}
                  placeholder="e.g. Python Development"
                  className={styles.input}
                  onChange={(e) => actions.updateDraftField('primaryTopic', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <div className={styles.fieldHeader}>
                  <label htmlFor="cohort-cover" className={styles.fieldLabel}>
                    Cover Image URL
                  </label>
                  <span className={styles.fieldHelper}>Provide image URL or pick preset</span>
                </div>
                <div className={styles.inlineComposer}>
                  <input
                    id="cohort-cover"
                    value={draft.coverImage}
                    placeholder="https://..."
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
            </div>
          </div>

          {/* Card 2: Classification & Difficulty */}
          <div className={styles.cardSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Classification</h2>
              <span className={styles.sectionSub}>Target level, category, and discovery metadata.</span>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Difficulty Level</span>
              <div className={styles.difficultyGrid}>
                {['Beginner', 'Intermediate', 'Advanced'].map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    className={`${styles.difficultyBtn} ${
                      draft.difficulty === diff ? styles.difficultyActive : ''
                    }`}
                    onClick={() =>
                      actions.updateDraftField(
                        'difficulty',
                        diff as CreateCohortDraft['difficulty'],
                      )
                    }
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.gridFields}>
              <div className={styles.field}>
                <label htmlFor="cohort-visibility" className={styles.fieldLabel}>
                  Visibility
                </label>
                <select
                  id="cohort-visibility"
                  value={draft.visibility}
                  className={styles.select}
                  onChange={(e) =>
                    actions.updateDraftField(
                      'visibility',
                      e.target.value as CreateCohortDraft['visibility'],
                    )
                  }
                >
                  <option value="Public">Public (Discoverable)</option>
                  <option value="Unlisted">Unlisted (Link Only)</option>
                  <option value="Private">Private</option>
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="cohort-completion" className={styles.fieldLabel}>
                  Estimated Duration
                </label>
                <input
                  id="cohort-completion"
                  value={draft.estimatedCompletionTime}
                  placeholder="e.g. 2-4 weeks"
                  className={styles.input}
                  onChange={(e) => actions.updateDraftField('estimatedCompletionTime', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Categories</span>
              <div className={styles.chipGrid}>
                {details.categoryOptions.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={cat.selected ? styles.chipSelected : styles.chip}
                    onClick={() => actions.toggleCategory(cat.label)}
                  >
                    {cat.selected ? <Check size={14} /> : null}
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 3: Library Details */}
          <div className={styles.cardSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Library & Objectives</h2>
              <span className={styles.sectionSub}>Add search tags, requirements, and outcomes.</span>
            </div>

            {/* Tags */}
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Tags</span>
              <div className={styles.tagRow}>
                {draft.tags.map((tag) => (
                  <span key={tag} className={styles.tagChip}>
                    #{tag}
                    <button
                      type="button"
                      className={styles.tagRemove}
                      onClick={() => actions.removeTag(tag)}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className={styles.inlineComposer}>
                <input
                  value={tagInput}
                  placeholder="Add a tag..."
                  className={styles.input}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <Button type="button" variant="secondary" size="sm" onClick={addTag}>
                  <Plus size={14} />
                  Add
                </Button>
              </div>
            </div>

            {/* Requirements & Outcomes */}
            <div className={styles.listGrid}>
              <div className={styles.listComposer}>
                <span className={styles.fieldLabel}>Requirements</span>
                <div className={styles.listItems}>
                  {draft.requirements.map((req, idx) => (
                    <div key={idx} className={styles.listRow}>
                      <input
                        value={req}
                        className={styles.input}
                        onChange={(e) => actions.updateRequirement(idx, e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        iconOnly
                        onClick={() => actions.removeRequirement(idx)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className={styles.inlineComposer}>
                  <input
                    value={reqInput}
                    placeholder="Add requirement..."
                    className={styles.input}
                    onChange={(e) => setReqInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addRequirement();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={addRequirement}>
                    <Plus size={14} />
                    Add
                  </Button>
                </div>
              </div>

              <div className={styles.listComposer}>
                <span className={styles.fieldLabel}>Learning Outcomes</span>
                <div className={styles.listItems}>
                  {draft.learningOutcomes.map((outcome, idx) => (
                    <div key={idx} className={styles.listRow}>
                      <input
                        value={outcome}
                        className={styles.input}
                        onChange={(e) => actions.updateLearningOutcome(idx, e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        iconOnly
                        onClick={() => actions.removeLearningOutcome(idx)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className={styles.inlineComposer}>
                  <input
                    value={outcomeInput}
                    placeholder="Add outcome..."
                    className={styles.input}
                    onChange={(e) => setOutcomeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addOutcome();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={addOutcome}>
                    <Plus size={14} />
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Complete Live Learner Cohort Card Preview (Fixes Issue 3!) */}
        <aside className={styles.previewColumn}>
          <div className={styles.previewHeader}>
            <span className={styles.previewBadge}>
               Live Cohort Card Preview
            </span>
          </div>

          <div className={styles.previewCard}>
            <div className={styles.previewCover}>
              <Image fill
                src={
                  draft.coverImage ||
                  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop'
                }
                alt="Cohort Cover"
                className={styles.previewCoverImg}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop';
                }}
              />
              <div className={styles.previewCoverOverlay} />
              <div className={styles.previewBadges}>
                <span className={styles.previewDiffBadge}>{draft.difficulty || 'Intermediate'}</span>
                <span className={styles.previewDiffBadge}>{draft.visibility || 'Public'}</span>
                {draft.estimatedCompletionTime && (
                  <span className={styles.previewDiffBadge}>{draft.estimatedCompletionTime}</span>
                )}
              </div>
            </div>

            <div className={styles.previewBody}>
              <h3 className={styles.previewTitle}>{draft.title || 'Untitled Cohort'}</h3>

              {draft.subtitle ? (
                <p className={styles.previewSubtitle}>{draft.subtitle}</p>
              ) : null}

              {draft.primaryTopic && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#a5b4fc' }}>
                  <BookOpen size={13} />
                  <span>Topic: {draft.primaryTopic}</span>
                </div>
              )}

              <p className={styles.previewDesc}>
                {draft.description ||
                  'Your cohort description will be rendered here for prospective learners.'}
              </p>

              {/* Categories Preview */}
              {draft.categories.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.2rem' }}>
                  {draft.categories.map((c) => (
                    <span
                      key={c}
                      style={{
                        fontSize: '0.725rem',
                        fontWeight: 700,
                        color: '#38bdf8',
                        background: 'rgba(56, 189, 248, 0.12)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                      }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Tags Preview */}
              {draft.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {draft.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: '0.725rem',
                        color: '#94a3b8',
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                      }}
                    >
                      <Tag size={10} style={{ display: 'inline', marginRight: 3 }} />#{t}
                    </span>
                  ))}
                </div>
              )}

              {/* Learning Outcomes Preview */}
              {draft.learningOutcomes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.3rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Target size={12} color="#34d399" /> What you will learn
                  </span>
                  {draft.learningOutcomes.slice(0, 3).map((out, idx) => (
                    <div key={idx} style={{ fontSize: '0.775rem', color: '#cbd5e1', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ color: '#34d399' }}>✓</span>
                      <span>{out}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Requirements Preview */}
              {draft.requirements.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.3rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ShieldCheck size={12} color="#fbbf24" /> Prerequisites
                  </span>
                  {draft.requirements.slice(0, 2).map((req, idx) => (
                    <div key={idx} style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      • {req}
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.previewCreatorRow}>
                <Image fill
                  src={getAvatar('shaqun')}
                  alt="Creator Avatar"
                  className={styles.previewAvatar}
                 />
                <div className={styles.previewCreatorInfo}>
                  <span className={styles.previewCreatorName}>Shaqun</span>
                  <span className={styles.previewCreatorRole}>Cohort Quest Guide</span>
                </div>
              </div>

              <button type="button" className={styles.previewCtaBtn}>
                Join Cohort Journey
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
