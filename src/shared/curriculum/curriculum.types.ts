export interface ImportedLessonInput {
  id: string;
  title: string;
  thumbnail: string;
  description: string;
  duration: string;
  position: number;
  provider: string;
  videoId: string;
  sourceUrl?: string;
  publishedLabel: string;
}

export interface ImportedSourceInput {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  provider: string;
  creator: string;
  lessonCount: number;
  totalDuration: string;
  estimatedSeasonCount: number;
  status: 'completed' | 'pending-provider' | 'running' | 'failed' | 'canceled' | string;
  lessons: ImportedLessonInput[];
}

export interface CurriculumGenerationInput {
  title: string;
  description: string;
  importedSources: ImportedSourceInput[];
}

export interface CurriculumGenerationError {
  code: string;
  title: string;
  message: string;
  retryable: boolean;
}

export type CurriculumWarningSeverity = 'info' | 'warning' | 'danger';
export type CurriculumWarningScope = 'curriculum' | 'season' | 'lesson';

export interface CurriculumWarning {
  id: string;
  scope: CurriculumWarningScope;
  severity: CurriculumWarningSeverity;
  title: string;
  message: string;
  seasonId?: string;
  lessonId?: string;
}

export interface CurriculumChunk {
  id: string;
  title: string;
  duration: string;
  order: number;
}

export interface CurriculumLesson {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  thumbnail: string;
  videoId?: string;
  duration: string;
  chunkCount: number;
  chunks: CurriculumChunk[];
  provider: string;
  order: number;
  playlistPosition: number;
  sourceId: string;
  sourceTitle: string;
  sourceUrl?: string;
  publishedLabel: string;
  difficulty: string;
  tags: string[];
  xp: number;
  resources: string[];
  assignments: string[];
  prerequisites?: string[];
  notes?: string;
  visibility?: 'Public' | 'Unlisted' | 'Private' | string;
  learningObjectives?: string[];
  completionMessage?: string;
  visualDependence?: 'REQUIRES SCREEN' | 'GLANCEABLE' | 'AUDIO ONLY';
  cognitiveLoad?: 'LIGHT & BREEZY' | 'STANDARD' | 'HEAVY / DENSE';
  pathway?: 'CORE CURRICULUM' | 'BONUS / TANGENT';
  collapsed: boolean;
}

export interface CurriculumSeason {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  summary?: string;
  thumbnail: string;
  color?: string;
  difficulty?: string;
  estimatedDuration: string;
  lessonCount: number;
  lessons: CurriculumLesson[];
  seasonObjectives?: string[];
  seasonCompletionMessage?: string;
  collapsed: boolean;
}

export interface GeneratedCurriculum {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  categories?: string[];
  primaryLanguage?: string;
  targetAudience?: string;
  requiredExperience?: string;
  creatorNotes?: string;
  journeyOutcomes?: string[];
  totalHours: string;
  totalLessons: number;
  totalChunks: number;
  totalSeasons: number;
  seasons: CurriculumSeason[];
  warnings: CurriculumWarning[];
}

export interface CurriculumSelectionState {
  seasonId: string | null;
  lessonId: string | null;
}

export interface CurriculumEditorStats {
  seasons: number;
  lessons: number;
  chunks: number;
  hours: string;
}
