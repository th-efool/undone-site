'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  BookOpen,
  Check,
  Image as ImageIcon,
  Plus,
  ShieldCheck,
  Tag,
  Target,
  X,
} from 'lucide-react';

import { Button } from '@/src/client/components/ui/Button/Button';
import { getAvatar } from '@/src/client/mock/avatars';
import type { CreateCohortDetailsModel, CreateCohortDraft } from '../../models/createCohort';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './DetailsStep.module.css';

const DEFAULT_PREVIEW_COVER =
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop';
const DEFAULT_GUIDE_AVATAR = getAvatar('shaqun');

interface DetailsStepProps {
  details: CreateCohortDetailsModel;
}

// ---------------------------------------------------------------------------
// Card 1 Memoized Fields
// ---------------------------------------------------------------------------

interface CohortTitleFieldProps {
  title: string;
  onChange: (value: string) => void;
}

const CohortTitleField = React.memo(function CohortTitleField({
  title,
  onChange,
}: CohortTitleFieldProps) {
  const isTitleMissing = !title || title.trim() === '';

  return (
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
        value={title}
        placeholder="e.g. Python for Beginners (100 Days of Code)"
        className={`${styles.input} ${isTitleMissing ? styles.inputError : ''}`}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
});

interface CohortSubtitleFieldProps {
  subtitle: string;
  onChange: (value: string) => void;
}

const CohortSubtitleField = React.memo(function CohortSubtitleField({
  subtitle,
  onChange,
}: CohortSubtitleFieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor="cohort-subtitle" className={styles.fieldLabel}>
        Subtitle
      </label>
      <input
        id="cohort-subtitle"
        value={subtitle}
        placeholder="e.g. Build real projects and master programming step by step"
        className={styles.input}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
});

interface CohortDescriptionFieldProps {
  description: string;
  onChange: (value: string) => void;
}

const CohortDescriptionField = React.memo(function CohortDescriptionField({
  description,
  onChange,
}: CohortDescriptionFieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor="cohort-description" className={styles.fieldLabel}>
        Description
      </label>
      <textarea
        id="cohort-description"
        value={description}
        placeholder="Explain what learners will achieve and what makes this cohort unique."
        className={styles.textarea}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
});

interface CohortPrimaryTopicFieldProps {
  primaryTopic: string;
  onChange: (value: string) => void;
}

const CohortPrimaryTopicField = React.memo(function CohortPrimaryTopicField({
  primaryTopic,
  onChange,
}: CohortPrimaryTopicFieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor="cohort-primary-topic" className={styles.fieldLabel}>
        Primary Topic <span className={styles.requiredAsterisk}>*</span>
      </label>
      <input
        id="cohort-primary-topic"
        value={primaryTopic}
        placeholder="e.g. Python Development"
        className={styles.input}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
});

interface CohortCoverImageFieldProps {
  coverImage: string;
  onChange: (value: string) => void;
  onSelectPreset: () => void;
}

const CohortCoverImageField = React.memo(function CohortCoverImageField({
  coverImage,
  onChange,
  onSelectPreset,
}: CohortCoverImageFieldProps) {
  return (
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
          value={coverImage}
          placeholder="https://..."
          className={styles.input}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onSelectPreset}
        >
          <ImageIcon size={14} />
          Preset
        </Button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Card 2 Memoized Classification Section
// ---------------------------------------------------------------------------

interface ClassificationSectionProps {
  difficulty: CreateCohortDraft['difficulty'];
  visibility: CreateCohortDraft['visibility'];
  estimatedCompletionTime: string;
  categoryOptions: CreateCohortDetailsModel['categoryOptions'];
  onUpdateDifficulty: (difficulty: CreateCohortDraft['difficulty']) => void;
  onUpdateVisibility: (visibility: CreateCohortDraft['visibility']) => void;
  onUpdateEstimatedTime: (time: string) => void;
  onToggleCategory: (category: string) => void;
}

const ClassificationSection = React.memo(function ClassificationSection({
  difficulty,
  visibility,
  estimatedCompletionTime,
  categoryOptions,
  onUpdateDifficulty,
  onUpdateVisibility,
  onUpdateEstimatedTime,
  onToggleCategory,
}: ClassificationSectionProps) {
  return (
    <div className={styles.cardSection}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Classification</h2>
        <span className={styles.sectionSub}>Target level, category, and discovery metadata.</span>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Difficulty Level</span>
        <div className={styles.difficultyGrid}>
          {(['Beginner', 'Intermediate', 'Advanced'] as const).map((diff) => (
            <button
              key={diff}
              type="button"
              className={`${styles.difficultyBtn} ${
                difficulty === diff ? styles.difficultyActive : ''
              }`}
              onClick={() => onUpdateDifficulty(diff)}
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
            value={visibility}
            className={styles.select}
            onChange={(e) =>
              onUpdateVisibility(e.target.value as CreateCohortDraft['visibility'])
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
            value={estimatedCompletionTime}
            placeholder="e.g. 2-4 weeks"
            className={styles.input}
            onChange={(e) => onUpdateEstimatedTime(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Categories</span>
        <div className={styles.chipGrid}>
          {categoryOptions.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={cat.selected ? styles.chipSelected : styles.chip}
              onClick={() => onToggleCategory(cat.label)}
            >
              {cat.selected ? <Check size={14} /> : null}
              {cat.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Card 3 Memoized Composers & Library Section
// ---------------------------------------------------------------------------

interface TagsComposerProps {
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

const TagsComposer = React.memo(function TagsComposer({
  tags,
  onAddTag,
  onRemoveTag,
}: TagsComposerProps) {
  const [tagInput, setTagInput] = useState('');

  const handleAdd = useCallback(() => {
    if (tagInput.trim()) {
      onAddTag(tagInput.trim());
      setTagInput('');
    }
  }, [tagInput, onAddTag]);

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>Tags</span>
      <div className={styles.tagRow}>
        {tags.map((tag) => (
          <span key={tag} className={styles.tagChip}>
            #{tag}
            <button
              type="button"
              className={styles.tagRemove}
              onClick={() => onRemoveTag(tag)}
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
              handleAdd();
            }
          }}
        />
        <Button type="button" variant="secondary" size="sm" onClick={handleAdd}>
          <Plus size={14} />
          Add
        </Button>
      </div>
    </div>
  );
});

interface RequirementsComposerProps {
  requirements: string[];
  onAddRequirement: (value: string) => void;
  onUpdateRequirement: (index: number, value: string) => void;
  onRemoveRequirement: (index: number) => void;
}

const RequirementsComposer = React.memo(function RequirementsComposer({
  requirements,
  onAddRequirement,
  onUpdateRequirement,
  onRemoveRequirement,
}: RequirementsComposerProps) {
  const [reqInput, setReqInput] = useState('');

  const handleAdd = useCallback(() => {
    if (reqInput.trim()) {
      onAddRequirement(reqInput.trim());
      setReqInput('');
    }
  }, [reqInput, onAddRequirement]);

  return (
    <div className={styles.listComposer}>
      <span className={styles.fieldLabel}>Requirements</span>
      <div className={styles.listItems}>
        {requirements.map((req, idx) => (
          <div key={idx} className={styles.listRow}>
            <input
              value={req}
              className={styles.input}
              onChange={(e) => onUpdateRequirement(idx, e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => onRemoveRequirement(idx)}
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
              handleAdd();
            }
          }}
        />
        <Button type="button" variant="secondary" size="sm" onClick={handleAdd}>
          <Plus size={14} />
          Add
        </Button>
      </div>
    </div>
  );
});

interface LearningOutcomesComposerProps {
  learningOutcomes: string[];
  onAddOutcome: (value: string) => void;
  onUpdateOutcome: (index: number, value: string) => void;
  onRemoveOutcome: (index: number) => void;
}

const LearningOutcomesComposer = React.memo(function LearningOutcomesComposer({
  learningOutcomes,
  onAddOutcome,
  onUpdateOutcome,
  onRemoveOutcome,
}: LearningOutcomesComposerProps) {
  const [outcomeInput, setOutcomeInput] = useState('');

  const handleAdd = useCallback(() => {
    if (outcomeInput.trim()) {
      onAddOutcome(outcomeInput.trim());
      setOutcomeInput('');
    }
  }, [outcomeInput, onAddOutcome]);

  return (
    <div className={styles.listComposer}>
      <span className={styles.fieldLabel}>Learning Outcomes</span>
      <div className={styles.listItems}>
        {learningOutcomes.map((outcome, idx) => (
          <div key={idx} className={styles.listRow}>
            <input
              value={outcome}
              className={styles.input}
              onChange={(e) => onUpdateOutcome(idx, e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => onRemoveOutcome(idx)}
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
              handleAdd();
            }
          }}
        />
        <Button type="button" variant="secondary" size="sm" onClick={handleAdd}>
          <Plus size={14} />
          Add
        </Button>
      </div>
    </div>
  );
});

interface LibraryDetailsSectionProps {
  tags: string[];
  requirements: string[];
  learningOutcomes: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onAddRequirement: (value: string) => void;
  onUpdateRequirement: (index: number, value: string) => void;
  onRemoveRequirement: (index: number) => void;
  onAddOutcome: (value: string) => void;
  onUpdateOutcome: (index: number, value: string) => void;
  onRemoveOutcome: (index: number) => void;
}

const LibraryDetailsSection = React.memo(function LibraryDetailsSection({
  tags,
  requirements,
  learningOutcomes,
  onAddTag,
  onRemoveTag,
  onAddRequirement,
  onUpdateRequirement,
  onRemoveRequirement,
  onAddOutcome,
  onUpdateOutcome,
  onRemoveOutcome,
}: LibraryDetailsSectionProps) {
  return (
    <div className={styles.cardSection}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Library & Objectives</h2>
        <span className={styles.sectionSub}>Add search tags, requirements, and outcomes.</span>
      </div>

      <TagsComposer tags={tags} onAddTag={onAddTag} onRemoveTag={onRemoveTag} />

      <div className={styles.listGrid}>
        <RequirementsComposer
          requirements={requirements}
          onAddRequirement={onAddRequirement}
          onUpdateRequirement={onUpdateRequirement}
          onRemoveRequirement={onRemoveRequirement}
        />
        <LearningOutcomesComposer
          learningOutcomes={learningOutcomes}
          onAddOutcome={onAddOutcome}
          onUpdateOutcome={onUpdateOutcome}
          onRemoveOutcome={onRemoveOutcome}
        />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Live Learner Cohort Card Preview Component (Memoized)
// ---------------------------------------------------------------------------

const LiveCohortPreview = React.memo(function LiveCohortPreview({
  draft,
}: {
  draft: CreateCohortDraft;
}) {
  const visibleOutcomes = useMemo(
    () => draft.learningOutcomes.slice(0, 3),
    [draft.learningOutcomes],
  );
  const visibleRequirements = useMemo(
    () => draft.requirements.slice(0, 2),
    [draft.requirements],
  );

  return (
    <aside className={styles.previewColumn}>
      <div className={styles.previewHeader}>
        <span className={styles.previewBadge}>Live Cohort Card Preview</span>
      </div>

      <div className={styles.previewCard}>
        <div className={styles.previewCover}>
          <Image
            width={400}
            height={300}
            src={draft.coverImage || DEFAULT_PREVIEW_COVER}
            alt="Cohort Cover"
            className={styles.previewCoverImg}
            onError={(e) => {
              (e.target as HTMLImageElement).src = DEFAULT_PREVIEW_COVER;
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                color: '#a5b4fc',
              }}
            >
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
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.35rem',
                marginTop: '0.2rem',
              }}
            >
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
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                marginTop: '0.3rem',
                paddingTop: '0.6rem',
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Target size={12} color="#34d399" /> What you will learn
              </span>
              {visibleOutcomes.map((out, idx) => (
                <div
                  key={idx}
                  style={{
                    fontSize: '0.775rem',
                    color: '#cbd5e1',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                  }}
                >
                  <span style={{ color: '#34d399' }}>✓</span>
                  <span>{out}</span>
                </div>
              ))}
            </div>
          )}

          {/* Requirements Preview */}
          {draft.requirements.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                marginTop: '0.3rem',
                paddingTop: '0.6rem',
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <ShieldCheck size={12} color="#fbbf24" /> Prerequisites
              </span>
              {visibleRequirements.map((req, idx) => (
                <div key={idx} style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  • {req}
                </div>
              ))}
            </div>
          )}

          <div className={styles.previewCreatorRow}>
            <Image
              width={400}
              height={300}
              src={DEFAULT_GUIDE_AVATAR}
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
  );
});

// ---------------------------------------------------------------------------
// Main DetailsStep Component
// ---------------------------------------------------------------------------

export function DetailsStep({ details }: DetailsStepProps) {
  const { state, actions } = useWizardContext();
  const draft = state.draft;

  // Storing actions in a ref ensures stable callback identities,
  // preventing downstream re-renders of unaffected sections during keystrokes.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const handleUpdateTitle = useCallback((val: string) => {
    actionsRef.current.updateDraftField('title', val);
  }, []);

  const handleUpdateSubtitle = useCallback((val: string) => {
    actionsRef.current.updateDraftField('subtitle', val);
  }, []);

  const handleUpdateDescription = useCallback((val: string) => {
    actionsRef.current.updateDraftField('description', val);
  }, []);

  const handleUpdatePrimaryTopic = useCallback((val: string) => {
    actionsRef.current.updateDraftField('primaryTopic', val);
  }, []);

  const handleUpdateCoverImage = useCallback((val: string) => {
    actionsRef.current.updateDraftField('coverImage', val);
  }, []);

  const handlePresetCoverImage = useCallback(() => {
    actionsRef.current.updateDraftField('coverImage', DEFAULT_PREVIEW_COVER);
  }, []);

  const handleUpdateDifficulty = useCallback((diff: CreateCohortDraft['difficulty']) => {
    actionsRef.current.updateDraftField('difficulty', diff);
  }, []);

  const handleUpdateVisibility = useCallback((vis: CreateCohortDraft['visibility']) => {
    actionsRef.current.updateDraftField('visibility', vis);
  }, []);

  const handleUpdateEstimatedTime = useCallback((time: string) => {
    actionsRef.current.updateDraftField('estimatedCompletionTime', time);
  }, []);

  const handleToggleCategory = useCallback((category: string) => {
    actionsRef.current.toggleCategory(category);
  }, []);

  const handleAddTag = useCallback((tag: string) => {
    actionsRef.current.addTag(tag);
  }, []);

  const handleRemoveTag = useCallback((tag: string) => {
    actionsRef.current.removeTag(tag);
  }, []);

  const handleAddRequirement = useCallback((val: string) => {
    actionsRef.current.addRequirement(val);
  }, []);

  const handleUpdateRequirement = useCallback((idx: number, val: string) => {
    actionsRef.current.updateRequirement(idx, val);
  }, []);

  const handleRemoveRequirement = useCallback((idx: number) => {
    actionsRef.current.removeRequirement(idx);
  }, []);

  const handleAddOutcome = useCallback((val: string) => {
    actionsRef.current.addLearningOutcome(val);
  }, []);

  const handleUpdateOutcome = useCallback((idx: number, val: string) => {
    actionsRef.current.updateLearningOutcome(idx, val);
  }, []);

  const handleRemoveOutcome = useCallback((idx: number) => {
    actionsRef.current.removeLearningOutcome(idx);
  }, []);

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
              <CohortTitleField
                title={draft.title}
                onChange={handleUpdateTitle}
              />

              <CohortSubtitleField
                subtitle={draft.subtitle}
                onChange={handleUpdateSubtitle}
              />

              <CohortDescriptionField
                description={draft.description}
                onChange={handleUpdateDescription}
              />

              <CohortPrimaryTopicField
                primaryTopic={draft.primaryTopic}
                onChange={handleUpdatePrimaryTopic}
              />

              <CohortCoverImageField
                coverImage={draft.coverImage}
                onChange={handleUpdateCoverImage}
                onSelectPreset={handlePresetCoverImage}
              />
            </div>
          </div>

          {/* Card 2: Classification & Difficulty */}
          <ClassificationSection
            difficulty={draft.difficulty}
            visibility={draft.visibility}
            estimatedCompletionTime={draft.estimatedCompletionTime}
            categoryOptions={details.categoryOptions}
            onUpdateDifficulty={handleUpdateDifficulty}
            onUpdateVisibility={handleUpdateVisibility}
            onUpdateEstimatedTime={handleUpdateEstimatedTime}
            onToggleCategory={handleToggleCategory}
          />

          {/* Card 3: Library Details */}
          <LibraryDetailsSection
            tags={draft.tags}
            requirements={draft.requirements}
            learningOutcomes={draft.learningOutcomes}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onAddRequirement={handleAddRequirement}
            onUpdateRequirement={handleUpdateRequirement}
            onRemoveRequirement={handleRemoveRequirement}
            onAddOutcome={handleAddOutcome}
            onUpdateOutcome={handleUpdateOutcome}
            onRemoveOutcome={handleRemoveOutcome}
          />
        </div>

        {/* Right Column: Complete Live Learner Cohort Card Preview */}
        <LiveCohortPreview draft={draft} />
      </div>
    </div>
  );
}
