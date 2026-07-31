import { useMemo } from 'react';

import { useWizardContext } from '../providers/WizardProvider';
import {
  createCohortStepLabels,
  createCohortStepOrder,
  type CreateCohortDetailsModel,
  type CreateCohortSelectOption,
  type CreateCohortSourceModel,
  type CreateCohortSourcesModel,
  type CreateCohortViewModel,
  type WizardFooterModel,
  type WizardStepModel,
} from '../models/createCohort';
import {
  categoryOptions,
  difficultyOptions,
  sourceTypeOptions,
  visibilityOptions,
} from '../mock/createCohort.mock';

function buildStepModels(currentStep: string): WizardStepModel[] {
  const currentIndex = createCohortStepOrder.indexOf(currentStep as (typeof createCohortStepOrder)[number]);

  return createCohortStepOrder.map((stepId, index) => {
    const isCurrent = stepId === currentStep;
    const disabled = index >= 2;

    return {
      id: stepId,
      label: createCohortStepLabels[stepId],
      index,
      status: disabled
        ? 'disabled'
        : isCurrent
          ? 'current'
          : index < currentIndex
            ? 'complete'
            : 'upcoming',
      disabled,
    };
  });
}

function buildSelectOptions(values: string[], selectedValue: string): CreateCohortSelectOption[] {
  return values.map((value) => ({
    id: value.toLowerCase().replace(/\s+/g, '-'),
    label: value,
    selected: value === selectedValue,
  }));
}

export function useCreateCohortViewModel(): CreateCohortViewModel {
  const { state, validation, actions } = useWizardContext();

  const steps = useMemo(() => buildStepModels(state.currentStep), [state.currentStep]);

  const footer: WizardFooterModel = useMemo(
    () => ({
      currentIndex: createCohortStepOrder.indexOf(state.currentStep) + 1,
      totalSteps: createCohortStepOrder.length,
      currentLabel: createCohortStepLabels[state.currentStep],
      progressLabel: `Step ${createCohortStepOrder.indexOf(state.currentStep) + 1} of ${createCohortStepOrder.length}`,
      previousVisible: state.currentStep === 'sources',
      previousDisabled: false,
      continueDisabled:
        state.currentStep === 'sources' ? true : !validation.details || state.currentStep !== 'details',
      continueLabel: 'Continue',
      helperText:
        state.currentStep === 'details'
          ? validation.details
            ? 'Ready to move into sources.'
            : 'Complete the required fields to continue.'
          : 'Curriculum and publish remain staged for a later step.',
    }),
    [state.currentStep, validation.details],
  );

  const details: CreateCohortDetailsModel = useMemo(
    () => ({
      title: 'Details',
      description: 'Set the metadata that defines the cohort before it is shared.',
      coverImage: {
        src: state.draft.coverImage,
        alt: `${state.draft.title} cover preview`,
        label: 'Cover image',
        helperText: 'Mock upload placeholder only.',
      },
      titleField: {
        id: 'cohort-title',
        label: 'Cohort Title',
        value: state.draft.title,
        placeholder: 'Design systems for ambitious teams',
      },
      subtitleField: {
        id: 'cohort-subtitle',
        label: 'Subtitle',
        value: state.draft.subtitle,
        placeholder: 'A tight, specific promise for the creator journey',
      },
      descriptionField: {
        id: 'cohort-description',
        label: 'Description',
        value: state.draft.description,
        placeholder: 'Describe what this cohort helps creators achieve.',
      },
      estimatedCompletionTimeField: {
        id: 'cohort-completion-time',
        label: 'Estimated Completion Time',
        value: state.draft.estimatedCompletionTime,
        placeholder: '3-4 weeks',
      },
      languageField: {
        id: 'cohort-language',
        label: 'Language',
        value: state.draft.language,
        placeholder: 'English',
      },
      primaryTopicField: {
        id: 'cohort-primary-topic',
        label: 'Primary Topic',
        value: state.draft.primaryTopic,
        placeholder: 'Attention systems',
      },
      difficultyOptions: buildSelectOptions(difficultyOptions, state.draft.difficulty),
      visibilityOptions: buildSelectOptions(visibilityOptions, state.draft.visibility),
      categoryOptions: categoryOptions.map((category) => ({
        id: category.toLowerCase().replace(/\s+/g, '-'),
        label: category,
        selected: state.draft.categories.includes(category),
      })),
      tags: state.draft.tags.map((tag) => ({
        id: tag.toLowerCase().replace(/\s+/g, '-'),
        label: tag,
      })),
      tagsInputPlaceholder: 'Add a tag and press Enter',
      requirements: {
        id: 'requirements',
        label: 'Requirements',
        items: state.draft.requirements,
        placeholder: 'Add a requirement',
      },
      learningOutcomes: {
        id: 'learning-outcomes',
        label: 'Learning Outcomes',
        items: state.draft.learningOutcomes,
        placeholder: 'Add a learning outcome',
      },
    }),
    [
      state.draft.categories,
      state.draft.description,
      state.draft.difficulty,
      state.draft.estimatedCompletionTime,
      state.draft.language,
      state.draft.learningOutcomes,
      state.draft.primaryTopic,
      state.draft.requirements,
      state.draft.subtitle,
      state.draft.tags,
      state.draft.title,
      state.draft.visibility,
      state.draft.coverImage,
    ],
  );

  const sources: CreateCohortSourcesModel = useMemo(
    () => ({
      title: 'Learning Sources',
      description: 'Add every resource that should become part of this cohort.',
      emptyLabel: 'No sources yet. Add the first resource to begin.',
      addLabel: 'Add source',
      countLabel: `${state.draft.sources.length} source${state.draft.sources.length === 1 ? '' : 's'}`,
      sourceTypeOptions,
      sources: state.draft.sources.map((source, index) => ({
        id: source.id,
        index,
        type: source.type,
        typeLabel: source.type,
        title: source.title,
        url: source.url,
        collapsed: source.collapsed,
        dragLabel: `Drag source ${index + 1}`,
      })),
    }),
    [state.draft.sources],
  );

  return {
    header: {
      title: 'Create Cohort',
      description: 'Create a learning journey others can follow.',
    },
    steps,
    footer,
    details,
    sources,
  };
}
