import type { CohortArchives } from './archives';
import type { CohortEvents } from './events';
import type { CohortHallOfFame } from './hallOfFame';
import type { CohortQuestline } from './questline';

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type CohortIcon =
  | 'assignment'
  | 'book'
  | 'brain'
  | 'calendar'
  | 'check'
  | 'clock'
  | 'compass'
  | 'file'
  | 'flame'
  | 'heart'
  | 'leaf'
  | 'lesson'
  | 'notes'
  | 'project'
  | 'target';

export interface Category {
  id: string;
  label: string;
}

export interface Creator {
  id: string;
  name: string;
  avatarUrl: string;
  role: string;
  bio: string;
  ctaLabel: string;
}

export interface CohortStats {
  rating: number;
  explorerCount: number;
  completionRate: number;
}

export interface Progress {
  journeyProgress: number;
  completedQuests: number;
  totalQuests: number;
  dailyGoal: string;
  joinedDate: string;
}

export interface LearningPillar {
  id: string;
  icon: CohortIcon;
  title: string;
  description: string;
}

export interface LearningObjective {
  id: string;
  text: string;
}

export interface StatItem {
  id: string;
  icon: CohortIcon;
  label: string;
  value: string;
}

export interface CohortOverview {
  description: string;
  pillars: LearningPillar[];
  learningObjectives: LearningObjective[];
  journeySummary: StatItem[];
  expeditionStats: StatItem[];
  expeditionProgress: StatItem[];
  activeExplorers: string[];
  activeExplorerOverflow: string;
}

export interface Cohort {
  id: string;
  coverImage: string;
  title: string;
  subtitle: string;
  description: string;
  difficulty: Difficulty;
  categories: Category[];
  creator: Creator;
  stats: CohortStats;
  progress: Progress;
  overview: CohortOverview;
  questline: CohortQuestline;
  events: CohortEvents;
  archives: CohortArchives;
  hallOfFame: CohortHallOfFame;
}
