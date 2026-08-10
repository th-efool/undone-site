import type { CreateCohortStepId } from './createCohort';

export type DeviceViewport = 'desktop' | 'tablet' | 'mobile';

export type LearnerPreviewTab =
  | 'overview'
  | 'questline'
  | 'player'
  | 'assignments'
  | 'events'
  | 'archives'
  | 'hall-of-fame';

export interface OnboardingConfigModel {
  welcomeMessage: string;
  journeyIntroduction: string;
  recommendedDailyGoal: string;
  suggestedWeeklyCommitment: string;
  completionMotivation: string;
  communityGuidelines: string[];
  pinnedResources: string[];
}

export interface CommunityConfigModel {
  discussionFeed: boolean;
  assignments: boolean;
  projects: boolean;
  publicNotes: boolean;
  archives: boolean;
  hallOfFame: boolean;
  events: boolean;
  leaderboards: boolean;
  communityChat: boolean;
  qAndA: boolean;
}

export interface JourneySettingsModel {
  visibility: 'Draft' | 'Private' | 'Unlisted' | 'Public';
  language: string;
  difficulty: string;
  targetAudience: string;
  estimatedWeeklyCommitment: string;
  categories: string[];
  topics: string[];
  keywords: string[];
}

export type LaunchValidationSeverity = 'blocking' | 'warning' | 'suggestion';

export interface LaunchValidationItem {
  id: string;
  severity: LaunchValidationSeverity;
  title: string;
  message: string;
  targetStep: CreateCohortStepId;
  targetField?: string;
  passed: boolean;
}

export interface LaunchValidationSummary {
  blockingCount: number;
  warningCount: number;
  suggestionCount: number;
  canPublish: boolean;
  items: LaunchValidationItem[];
}

export type PublishStage =
  | 'idle'
  | 'preparing-assets'
  | 'search-metadata'
  | 'creating-community'
  | 'publishing'
  | 'live';

export interface PublishResultModel {
  cohortId: string;
  cohortTitle: string;
  cohortUrl: string;
  publishedAt: string;
  version: string;
  visibility: string;
  totalHours: string;
  totalLessons: number;
  totalSeasons: number;
  qualityScore: number;
  coverImage: string;
}
