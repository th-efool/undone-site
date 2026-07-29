export enum ArchiveType {
  FieldNote = 'Field Note',
  MindMap = 'Mind Map',
  CheatSheet = 'Cheat Sheet',
  Diagram = 'Diagram',
  CodeSnippet = 'Code Snippet',
  Flashcard = 'Flashcard',
}

export interface ArchiveCategory {
  id: string;
  label: string;
  active?: boolean;
}
export interface ArchiveAuthor {
  name: string;
  avatarUrl: string;
}
export interface ArchiveItem {
  id: string;
  thumbnail: string;
  title: string;
  type: ArchiveType;
  description: string;
  author: ArchiveAuthor;
  publishedAt: string;
  voteCount: number;
  commentCount: number;
}
export interface ArchiveContributor {
  id: string;
  name: string;
  avatarUrl: string;
  notes: number;
}
export interface TrendingArchive {
  id: string;
  title: string;
  score: string;
}
export interface ArchiveSortControl {
  id: string;
  label: string;
}
export interface ArchiveCta {
  title: string;
  description: string;
  buttonLabel: string;
  illustration: string;
}
export interface CohortArchives {
  title: string;
  description: string;
  categories: ArchiveCategory[];
  sortControls: ArchiveSortControl[];
  items: ArchiveItem[];
  contributors: ArchiveContributor[];
  trending: TrendingArchive[];
  shareKnowledge: ArchiveCta;
}
