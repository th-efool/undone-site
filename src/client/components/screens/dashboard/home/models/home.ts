import type { ReactNode } from 'react';

export type Weekday = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

export interface ProgressInfo {
  current: number;
  target: number;
  unit: string;
  percent: number;
  color?: string;
}

export interface GoalSummary {
  id: string;
  title: string;
  value: string;
  helperText?: string;
  helperTone?: 'brand' | 'success';
  icon: ReactNode;
  iconTone: 'brand' | 'orange' | 'green';
  progress?: ProgressInfo;
  trendPath?: string;
}

export interface LearningSchedule {
  days: Weekday[];
  label: string;
}

export interface ActiveCohort {
  id: string;
  cohortId?: string;
  rank: number;
  title: string;
  provider: string;
  thumbnail: string;
  minutesToday: number;
  dailyGoalMinutes: number;
  progressPercent: number;
  schedule: LearningSchedule;
  featured?: boolean;
  frequency?: 'Very Often' | 'Often' | 'Sometimes' | 'Rarely' | 'Very Rarely';
  orderStyle?: 'Sequential' | 'Semantic Randomize' | 'Randomize';
}

export interface PausedCohort extends Omit<ActiveCohort, 'rank'> {
  pausedUntil: string;
  pausedReason?: string;
  resumeLabel: string;
}

export interface CompletedCourse {
  id: string;
  cohortId?: string;
  title: string;
  thumbnail: string;
  completedLabel: string;
  progressPercent: number;
}

export interface PauseOption {
  id: string;
  label: string;
  days?: number;
}

export interface HomeHeroContent {
  title: string;
  subtitle: string;
  actionLabel: string;
}

export interface HomeSectionContent {
  title: string;
  subtitle?: string;
}

export interface HomeModel {
  hero: HomeHeroContent;
  sections: {
    activeCohorts: HomeSectionContent;
    continueLater: HomeSectionContent;
    recentlyCompleted: HomeSectionContent;
  };
  searchPlaceholder: string;
  summaries: GoalSummary[];
  activeCohorts: ActiveCohort[];
  continueLater: PausedCohort[];
  recentlyCompleted: CompletedCourse[];
  pauseOptions: PauseOption[];
}
