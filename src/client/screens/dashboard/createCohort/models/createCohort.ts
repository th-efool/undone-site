import type { CurriculumSummaryModel, ImportWorkspaceModel } from './import';

export type CreateCohortStepId = 'topic' | 'sources' | 'curriculum' | 'identity' | 'publish';

export type CreateCohortDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type CreateCohortVisibility = 'Private' | 'Unlisted' | 'Public';
export type CreateCohortDurationPreset =
  | '1 Week'
  | '2 Weeks'
  | '3-4 Weeks'
  | '1-2 Months'
  | '3-6 Months'
  | 'Self-Paced / Custom';

export type CreateCohortSourceType =
  | 'YouTube Playlist'
  | 'YouTube Video'
  | 'Website'
  | 'PDF'
  | 'Markdown'
  | 'GitHub Repository'
  | 'Notion Workspace'
  | 'Notion Page'
  | 'Custom Link';

export interface CreateCohortSourceDraft {
  id: string;
  type: CreateCohortSourceType;
  title: string;
  url: string;
  collapsed: boolean;
  thumbnailUrl?: string;
  domain?: string;
  metaTitle?: string;
  chunkingMethod?: 'semantic' | 'disabled' | 'fixed_interval';
}

export interface CreateCohortDraft {
  coverImage: string;
  title: string;
  subtitle: string;
  description: string;
  difficulty: CreateCohortDifficulty;
  categories: string[];
  visibility: CreateCohortVisibility;
  estimatedCompletionTime: string;
  language: string;
  primaryTopic: string;
  tags: string[];
  requirements: string[];
  learningOutcomes: string[];
  sources: CreateCohortSourceDraft[];
}

export interface CreateCohortWizardState {
  currentStep: CreateCohortStepId;
  draft: CreateCohortDraft;
}

export type StepStatus = 'complete' | 'current' | 'upcoming' | 'disabled';

export interface WizardStepModel {
  id: CreateCohortStepId;
  label: string;
  index: number;
  status: StepStatus;
  disabled: boolean;
}

export interface WizardFooterModel {
  currentIndex: number;
  totalSteps: number;
  currentLabel: string;
  progressLabel: string;
  previousVisible: boolean;
  previousDisabled: boolean;
  continueDisabled: boolean;
  continueLabel: string;
  helperText: string;
}

export interface CreateCohortScalarFieldModel {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  helperText?: string;
}

export interface CreateCohortSelectOption {
  id: string;
  label: string;
  selected: boolean;
}

export interface CreateCohortTagModel {
  id: string;
  label: string;
}

export interface CreateCohortListModel {
  id: string;
  label: string;
  items: string[];
  placeholder: string;
  helperText?: string;
}

export interface CreateCohortDetailsModel {
  title: string;
  description: string;
  coverImage: {
    src: string;
    alt: string;
    label: string;
    helperText: string;
  };
  titleField: CreateCohortScalarFieldModel;
  subtitleField: CreateCohortScalarFieldModel;
  descriptionField: CreateCohortScalarFieldModel;
  estimatedCompletionTimeField: CreateCohortScalarFieldModel;
  durationPresetOptions: CreateCohortSelectOption[];
  languageField: CreateCohortScalarFieldModel;
  primaryTopicField: CreateCohortScalarFieldModel;
  difficultyOptions: CreateCohortSelectOption[];
  visibilityOptions: CreateCohortSelectOption[];
  categoryOptions: CreateCohortSelectOption[];
  tags: CreateCohortTagModel[];
  tagsInputPlaceholder: string;
  requirements: CreateCohortListModel;
  learningOutcomes: CreateCohortListModel;
}

export interface CreateCohortSourceModel {
  id: string;
  index: number;
  type: CreateCohortSourceType;
  typeLabel: string;
  title: string;
  url: string;
  collapsed: boolean;
  dragLabel: string;
  thumbnailUrl?: string;
  domain?: string;
  metaTitle?: string;
  chunkingMethod?: 'semantic' | 'disabled' | 'fixed_interval';
}

export interface CreateCohortSourcesModel {
  title: string;
  description: string;
  emptyLabel: string;
  addLabel: string;
  countLabel: string;
  sourceTypeOptions: CreateCohortSourceType[];
  sources: CreateCohortSourceModel[];
}

export interface CreateCohortViewModel {
  header: {
    title: string;
    description: string;
  };
  steps: WizardStepModel[];
  footer: WizardFooterModel;
  details: CreateCohortDetailsModel;
  sources: CreateCohortSourcesModel;
  importWorkspace: ImportWorkspaceModel;
  curriculum: CurriculumSummaryModel;
}

export const createCohortStepOrder: CreateCohortStepId[] = [
  'topic',
  'sources',
  'curriculum',
  'identity',
  'publish',
];

export const createCohortStepLabels: Record<CreateCohortStepId, string> = {
  topic: 'Topic & Category',
  sources: 'Sources',
  curriculum: 'Curriculum',
  identity: 'Identity & Branding',
  publish: 'Launch',
};
