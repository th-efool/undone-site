export type QualityGrade = 'Excellent' | 'Good' | 'Needs Attention' | 'Incomplete';

export interface QualityDeduction {
  id: string;
  category: 'thumbnail' | 'description' | 'title' | 'duration' | 'metadata' | 'season' | 'curriculum';
  title: string;
  message: string;
  penalty: number;
  seasonId?: string;
  lessonId?: string;
}

export interface QualityScoreModel {
  score: number;
  grade: QualityGrade;
  color: string;
  deductions: QualityDeduction[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  passed: boolean;
  required: boolean;
  seasonId?: string;
  lessonId?: string;
}

export interface PublishingChecklistModel {
  isReady: boolean;
  passedCount: number;
  totalCount: number;
  statusLabel: string;
  items: ChecklistItem[];
}

export interface MultiSelectionState {
  selectedLessonIds: string[];
  selectedSeasonIds: string[];
}

export interface CurriculumHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
}
