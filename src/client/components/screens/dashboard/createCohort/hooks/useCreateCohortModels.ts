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
import type {
  CurriculumSummaryModel,
  ImportWorkspaceModel,
  ImportedSourceModel,
  SourceImportCardModel,
} from '../models/import';
import {
  categoryOptions,
  difficultyOptions,
  sourceTypeOptions,
  visibilityOptions,
} from '../mock/createCohort.mock';

function parseDurationLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  if (!normalized || normalized === '--' || normalized === '0m' || normalized === '0') {
    return 0;
  }

  const hoursMatch = normalized.match(/(\d+)\s*h/);
  const minutesMatch = normalized.match(/(\d+)\s*m/);

  const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;

  return hours * 60 + minutes;
}

function formatMinutes(totalMinutes: number) {
  if (totalMinutes <= 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
}

function buildSourceCards(
  sourceOrder: string[],
  cards: Record<string, SourceImportCardModel>,
) {
  return sourceOrder
    .map((sourceId) => cards[sourceId])
    .filter((card): card is SourceImportCardModel => Boolean(card));
}

function buildImportedTotals(importedSources: ImportedSourceModel[]) {
  const totalLessons = importedSources.reduce((sum, source) => sum + source.lessonCount, 0);
  const totalMinutes = importedSources.reduce(
    (sum, source) => sum + parseDurationLabel(source.totalDuration),
    0,
  );

  return {
    totalLessons,
    totalDuration: formatMinutes(totalMinutes),
  };
}

function buildStepModels(currentStep: string): WizardStepModel[] {
  const currentIndex = createCohortStepOrder.indexOf(currentStep as (typeof createCohortStepOrder)[number]);

  return createCohortStepOrder.map((stepId, index) => {
    const isCurrent = stepId === currentStep;
    const disabled = index >= 3;

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
  const { state, validation, importState, curriculumState } = useWizardContext();

  const steps = useMemo(() => buildStepModels(state.currentStep), [state.currentStep]);

  const footer: WizardFooterModel = useMemo(() => {
    const currentIndex = createCohortStepOrder.indexOf(state.currentStep) + 1;
    const isDetails = state.currentStep === 'details';
    const isSources = state.currentStep === 'sources';
    const isCurriculum = state.currentStep === 'curriculum';
    const importing = importState.status === 'running';
    const failed = importState.status === 'failed';

    return {
      currentIndex,
      totalSteps: createCohortStepOrder.length,
      currentLabel: createCohortStepLabels[state.currentStep],
      progressLabel: `Step ${currentIndex} of ${createCohortStepOrder.length}`,
      previousVisible: isSources && !importing ? true : state.currentStep === 'curriculum',
      previousDisabled: false,
      continueDisabled:
        (isDetails && !validation.details) ||
        (isSources && importing) ||
        (isCurriculum && !validation.curriculum) ||
        importState.status === 'canceled',
      continueLabel: isSources
        ? failed
          ? 'Retry import'
          : importing
            ? 'Importing'
            : 'Continue'
        : isCurriculum
          ? 'Continue to Publish'
          : 'Continue',
      helperText: isDetails
        ? validation.details
          ? 'Ready to move into sources.'
          : 'Complete the required fields to continue.'
        : isSources
          ? failed
            ? 'Resolve the error or retry the import.'
            : importing
              ? 'The import pipeline is actively fetching content.'
              : 'Continue to begin the live import pipeline.'
          : 'Curriculum structure is ready. Review and adjust before publishing.',
    };
  }, [importState.status, state.currentStep, validation.details, validation.curriculum]);

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

  const importWorkspace: ImportWorkspaceModel = useMemo(() => {
    const sourceCards = buildSourceCards(
      state.draft.sources.map((source) => source.id),
      importState.sourceCards,
    );
    const totals = buildImportedTotals(importState.importedSources);

    return {
      status: importState.status,
      overallProgress: importState.overallProgress,
      currentOperation: importState.currentOperation,
      currentSourceLabel: importState.currentSourceLabel,
      estimatedRemaining: importState.estimatedRemaining,
      liveStatus: importState.liveStatus,
      activeSourceId: importState.activeSourceId,
      sourceCards,
      feed: importState.feed,
      importedSources: importState.importedSources,
      totalLessons: totals.totalLessons,
      totalDuration: totals.totalDuration,
      error: importState.error,
    };
  }, [
    importState.activeSourceId,
    importState.currentOperation,
    importState.currentSourceLabel,
    importState.estimatedRemaining,
    importState.feed,
    importState.importedSources,
    importState.liveStatus,
    importState.error,
    importState.overallProgress,
    importState.sourceCards,
    importState.status,
    state.draft.sources,
  ]);

  const curriculum: CurriculumSummaryModel = useMemo(() => {
    const importedSources = importState.importedSources;
    const totals = buildImportedTotals(importedSources);
    const primarySource = importedSources[0];

    return {
      title: 'Cohort Curriculum',
      description: 'Review and customize your cohort structure.',
      importedSources,
      importedCount: importedSources.length,
      totalLessons: totals.totalLessons,
      totalDuration: totals.totalDuration,
      creator: primarySource?.creator ?? 'SideQuest HQ',
      currentPlaylist: primarySource?.title ?? (importState.currentSourceLabel || 'Imported source'),
      continueLabel: 'Continue to Publish',
    };
  }, [importState.currentSourceLabel, importState.importedSources]);

  return {
    header: {
      title: 'Create Cohort',
      description: 'Create a learning journey others can follow.',
    },
    steps,
    footer,
    details,
    sources,
    importWorkspace,
    curriculum,
  };
}
