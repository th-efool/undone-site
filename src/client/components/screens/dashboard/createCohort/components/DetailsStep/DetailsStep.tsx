'use client';

import { useState } from 'react';
import { ImageUp, Plus, X } from 'lucide-react';

import { Button } from '@/src/client/components/ui/Button/Button';
import { Stack } from '@/src/client/components/global/layout/Stack';
import { Heading } from '@/src/client/components/ui/Typography/Heading';
import { Text } from '@/src/client/components/ui/Typography/Text';

import type { CreateCohortDetailsModel, CreateCohortDraft } from '../../models/createCohort';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './DetailsStep.module.css';

interface DetailsStepProps {
  details: CreateCohortDetailsModel;
}

interface ScalarFieldProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  helperText?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}

function ScalarField({
  id,
  label,
  value,
  placeholder,
  helperText,
  multiline,
  onChange,
}: ScalarFieldProps) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.fieldLabel}>{label}</span>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {helperText ? <span className={styles.fieldHelper}>{helperText}</span> : null}
    </label>
  );
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  options: { id: string; label: string; selected: boolean }[];
  onChange: (value: string) => void;
}

function SelectField({ id, label, value, options, onChange }: SelectFieldProps) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.fieldLabel}>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option
            key={option.id}
            value={option.label}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChipSelector({
  label,
  helperText,
  options,
  onToggle,
}: {
  label: string;
  helperText?: string;
  options: { id: string; label: string; selected: boolean }[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldHeader}>
        <span className={styles.fieldLabel}>{label}</span>
        {helperText ? <span className={styles.fieldHelper}>{helperText}</span> : null}
      </div>
      <div className={styles.chipGrid}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={option.selected ? styles.chipSelected : styles.chip}
            aria-pressed={option.selected}
            onClick={() => onToggle(option.label)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TagComposer({
  label,
  helperText,
  tags,
  placeholder,
  onAdd,
  onRemove,
}: {
  label: string;
  helperText?: string;
  tags: { id: string; label: string }[];
  placeholder: string;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [value, setValue] = useState('');

  const submit = () => {
    onAdd(value);
    setValue('');
  };

  return (
    <div className={styles.field}>
      <div className={styles.fieldHeader}>
        <span className={styles.fieldLabel}>{label}</span>
        {helperText ? <span className={styles.fieldHelper}>{helperText}</span> : null}
      </div>
      <div className={styles.tagRow}>
        {tags.map((tag) => (
          <span key={tag.id} className={styles.tagChip}>
            {tag.label}
            <button
              type="button"
              className={styles.tagRemove}
              aria-label={`Remove ${tag.label}`}
              onClick={() => onRemove(tag.label)}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className={styles.inlineComposer}>
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button type="button" variant="secondary" size="sm" onClick={submit}>
          <Plus size={14} />
          Add
        </Button>
      </div>
    </div>
  );
}

function ListComposer({
  label,
  helperText,
  items,
  placeholder,
  onAdd,
  onUpdate,
  onRemove,
}: {
  label: string;
  helperText?: string;
  items: string[];
  placeholder: string;
  onAdd: (value: string) => void;
  onUpdate: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  const [value, setValue] = useState('');

  const submit = () => {
    onAdd(value);
    setValue('');
  };

  return (
    <div className={styles.listComposer}>
      <div className={styles.fieldHeader}>
        <span className={styles.fieldLabel}>{label}</span>
        {helperText ? <span className={styles.fieldHelper}>{helperText}</span> : null}
      </div>

      <div className={styles.listItems}>
        {items.map((item, index) => (
          <div
            key={`${label}-${index}`}
            className={styles.listRow}
          >
            <input
              value={item}
              onChange={(event) => onUpdate(index, event.target.value)}
              aria-label={`${label} item ${index + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`Remove ${label.toLowerCase()} item ${index + 1}`}
              onClick={() => onRemove(index)}
            >
              <X size={14} />
            </Button>
          </div>
        ))}
      </div>

      <div className={styles.inlineComposer}>
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button type="button" variant="secondary" size="sm" onClick={submit}>
          <Plus size={14} />
          Add
        </Button>
      </div>
    </div>
  );
}

export function DetailsStep({ details }: DetailsStepProps) {
  const { actions } = useWizardContext();

  return (
    <div className={styles.root}>
      <div className={styles.grid}>
        <aside className={styles.coverPane}>
          <div className={styles.coverFrame}>
            <img
              src={details.coverImage.src}
              alt={details.coverImage.alt}
              className={styles.coverImage}
            />
            <div className={styles.coverOverlay}>
              <Text variant="small" className={styles.coverLabel}>
                {details.coverImage.label}
              </Text>
              <Text variant="small" className={styles.coverHelper}>
                {details.coverImage.helperText}
              </Text>
            </div>
          </div>

          <div className={styles.coverActions}>
            <Button type="button" variant="secondary" size="sm" disabled>
              <ImageUp size={14} />
              Upload placeholder
            </Button>
            <Text variant="muted" className={styles.coverCaption}>
              Mock only. The import pipeline will be attached later.
            </Text>
          </div>
        </aside>

        <Stack gap="8" className={styles.content}>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Heading level={2} className={styles.sectionTitle}>
                Cohort identity
              </Heading>
              <Text variant="muted">Define the narrative and the primary promise.</Text>
            </div>

            <div className={styles.primaryFields}>
              <ScalarField
                id={details.titleField.id}
                label={details.titleField.label}
                value={details.titleField.value}
                placeholder={details.titleField.placeholder}
                onChange={(value) => actions.updateDraftField('title', value)}
              />
              <ScalarField
                id={details.subtitleField.id}
                label={details.subtitleField.label}
                value={details.subtitleField.value}
                placeholder={details.subtitleField.placeholder}
                onChange={(value) => actions.updateDraftField('subtitle', value)}
              />
              <ScalarField
                id={details.descriptionField.id}
                label={details.descriptionField.label}
                value={details.descriptionField.value}
                placeholder={details.descriptionField.placeholder}
                multiline
                helperText="Use this to explain the outcome and tone of the cohort."
                onChange={(value) => actions.updateDraftField('description', value)}
              />
              <ScalarField
                id={details.primaryTopicField.id}
                label={details.primaryTopicField.label}
                value={details.primaryTopicField.value}
                placeholder={details.primaryTopicField.placeholder}
                onChange={(value) => actions.updateDraftField('primaryTopic', value)}
              />
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Heading level={2} className={styles.sectionTitle}>
                Classification
              </Heading>
              <Text variant="muted">Shape how the cohort appears to creators.</Text>
            </div>

            <div className={styles.gridFields}>
              <SelectField
                id="cohort-difficulty"
                label="Difficulty"
                value={details.difficultyOptions.find((option) => option.selected)?.label ?? ''}
                options={details.difficultyOptions}
                onChange={(value) =>
                  actions.updateDraftField(
                    'difficulty',
                    value as CreateCohortDraft['difficulty'],
                  )
                }
              />
              <SelectField
                id="cohort-visibility"
                label="Visibility"
                value={details.visibilityOptions.find((option) => option.selected)?.label ?? ''}
                options={details.visibilityOptions}
                onChange={(value) =>
                  actions.updateDraftField(
                    'visibility',
                    value as CreateCohortDraft['visibility'],
                  )
                }
              />
              <ScalarField
                id={details.estimatedCompletionTimeField.id}
                label={details.estimatedCompletionTimeField.label}
                value={details.estimatedCompletionTimeField.value}
                placeholder={details.estimatedCompletionTimeField.placeholder}
                onChange={(value) => actions.updateDraftField('estimatedCompletionTime', value)}
              />
              <ScalarField
                id={details.languageField.id}
                label={details.languageField.label}
                value={details.languageField.value}
                placeholder={details.languageField.placeholder}
                onChange={(value) => actions.updateDraftField('language', value)}
              />
            </div>

            <ChipSelector
              label="Categories"
              helperText="Pick the categories that match the experience."
              options={details.categoryOptions}
              onToggle={actions.toggleCategory}
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <Heading level={2} className={styles.sectionTitle}>
                Library details
              </Heading>
              <Text variant="muted">Keep the structured lists explicit and editable.</Text>
            </div>

            <TagComposer
              label="Tags"
              helperText="Add focused terms people can scan quickly."
              tags={details.tags}
              placeholder={details.tagsInputPlaceholder}
              onAdd={actions.addTag}
              onRemove={actions.removeTag}
            />

            <div className={styles.listGrid}>
              <ListComposer
                label={details.requirements.label}
                helperText="What someone should bring with them."
                items={details.requirements.items}
                placeholder={details.requirements.placeholder}
                onAdd={actions.addRequirement}
                onUpdate={actions.updateRequirement}
                onRemove={actions.removeRequirement}
              />

              <ListComposer
                label={details.learningOutcomes.label}
                helperText="What they should leave with."
                items={details.learningOutcomes.items}
                placeholder={details.learningOutcomes.placeholder}
                onAdd={actions.addLearningOutcome}
                onUpdate={actions.updateLearningOutcome}
                onRemove={actions.removeLearningOutcome}
              />
            </div>
          </section>
        </Stack>
      </div>
    </div>
  );
}
