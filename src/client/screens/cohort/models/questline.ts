import type { CohortIcon } from './cohort';

export enum SeasonStatus {
  Completed = 'completed',
  InProgress = 'inProgress',
  Locked = 'locked',
  Paused = 'paused',
}

export enum LessonStatus {
  Completed = 'completed',
  InStream = 'inStream',
  Ready = 'ready',
  Locked = 'locked',
}

export enum LessonType {
  Video = 'video',
  Reading = 'reading',
  Assignment = 'assignment',
  Project = 'project',
  Quiz = 'quiz',
  Exercise = 'exercise',
}

export interface QuestlineFilter {
  id: string;
  label: string;
}

export interface LessonChunk {
  id: string;
  title: string;
  duration: string;
  order: number;
  startSeconds: number;
  endSeconds: number;
  timeRangeLabel: string;
  timestampUrl?: string;
}

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  duration: string;
  status: LessonStatus;
  totalChunks: number;
  completedChunks: number;
  thumbnail: string;
  videoId?: string;
  videoUrl?: string;
  sourceUrl?: string;
  chunks?: LessonChunk[];
}

export interface Season {
  id: string;
  badge: string;
  title: string;
  status: SeasonStatus;
  progress: number;
  estimatedDuration: string;
  questCount: number;
  lessons: Lesson[];
  summaryLabel: string;
  lockedMessage?: string;
}

export interface AssignmentFeedParticipant {
  id: string;
  avatarUrl: string;
}

export interface AssignmentFeedItem {
  id: string;
  title: string;
  type: LessonType.Assignment | LessonType.Project;
  description: string;
  duration: string;
  thumbnail: string;
  icon: CohortIcon;
  participants: AssignmentFeedParticipant[];
  submittedCount: string;
  shareLabel: string;
  doneLabel: string;
}

export interface LockedFutureNotice {
  icon: CohortIcon;
  title: string;
  description: string;
}

export interface CohortQuestline {
  title: string;
  description: string;
  filters: QuestlineFilter[];
  skipSeasonLabel: string;
  seasons: Season[];
  feedTitle: string;
  feedDescription: string;
  feedSeasonLabel: string;
  feedViewAllLabel: string;
  assignmentFeed: AssignmentFeedItem[];
  lockedFutureNotice: LockedFutureNotice;
}
