import type { CreateCohortSourceDraft, CreateCohortSourceType } from './createCohort';

export type ImportStageStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ImportSourceStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled' | 'pending-provider';

export type ImportTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

export interface ImportPipelineStageModel {
  id: string;
  title: string;
  description: string;
  status: ImportStageStatus;
  progress: number;
}

export interface ImportFeedItemModel {
  id: string;
  title: string;
  detail: string;
  tone: ImportTone;
  timestamp: string;
}

export interface ImportedLessonModel {
  id: string;
  title: string;
  thumbnail: string;
  description: string;
  duration: string;
  position: number;
  provider: string;
  videoId: string;
  publishedLabel: string;
}

export interface ImportedSourceModel {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  provider: string;
  creator: string;
  lessonCount: number;
  totalDuration: string;
  estimatedSeasonCount: number;
  status: ImportSourceStatus;
  lessons: ImportedLessonModel[];
}

export interface ImportErrorModel {
  code: string;
  title: string;
  message: string;
  retryable: boolean;
}

export interface SourceImportCardModel {
  sourceId: string;
  sourceType: CreateCohortSourceType;
  title: string;
  url: string;
  status: ImportSourceStatus;
  progress: number;
  currentOperation: string;
  estimatedRemaining: string;
  liveStatus: string;
  stages: ImportPipelineStageModel[];
  feed: ImportFeedItemModel[];
  importedSource: ImportedSourceModel | null;
  error: ImportErrorModel | null;
}

export interface ImportWorkspaceModel {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'canceled';
  overallProgress: number;
  currentOperation: string;
  currentSourceLabel: string;
  estimatedRemaining: string;
  liveStatus: string;
  activeSourceId: string | null;
  sourceCards: SourceImportCardModel[];
  feed: ImportFeedItemModel[];
  importedSources: ImportedSourceModel[];
  totalLessons: number;
  totalDuration: string;
  error: ImportErrorModel | null;
}

export interface CurriculumSummaryModel {
  title: string;
  description: string;
  importedSources: ImportedSourceModel[];
  importedCount: number;
  totalLessons: number;
  totalDuration: string;
  creator: string;
  currentPlaylist: string;
  continueLabel: string;
}

export interface ImportStreamStageModel {
  id: string;
  title: string;
  description: string;
  status: ImportStageStatus;
  progress: number;
}

export interface ImportStreamFeedModel {
  title: string;
  detail: string;
  tone: ImportTone;
}

export interface ImportStreamSnapshotModel {
  source: ImportedSourceModel;
  stage?: ImportStreamStageModel;
  feed?: ImportStreamFeedModel;
  overallProgress?: number;
  currentOperation?: string;
  currentSourceLabel?: string;
  estimatedRemaining?: string;
  liveStatus?: string;
}

export interface ImportStreamCompleteModel {
  source: ImportedSourceModel;
  overallProgress: number;
  currentOperation: string;
  currentSourceLabel: string;
  estimatedRemaining: string;
  liveStatus: string;
}

export interface ImportStreamErrorModel extends ImportErrorModel {
  overallProgress?: number;
  currentOperation?: string;
  currentSourceLabel?: string;
  estimatedRemaining?: string;
  liveStatus?: string;
}

export type ImportStreamEvent =
  | { type: 'stage'; stage: ImportStreamStageModel }
  | { type: 'feed'; feed: ImportStreamFeedModel }
  | { type: 'snapshot'; snapshot: ImportStreamSnapshotModel }
  | { type: 'complete'; complete: ImportStreamCompleteModel }
  | { type: 'error'; error: ImportStreamErrorModel };

export interface ImportSourceAdapterContext {
  source: CreateCohortSourceDraft;
  signal: AbortSignal;
  onEvent: (event: ImportStreamEvent) => void;
}

export interface ImportSourceJob {
  promise: Promise<ImportedSourceModel>;
  cancel: () => void;
}
