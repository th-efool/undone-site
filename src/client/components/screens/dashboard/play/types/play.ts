import type { FeedItem } from '@/src/shared/feed/feedEngine.types';

export interface Lesson {
  platform: 'youtube' | 'coursera' | 'udemy' | 'book';
  title: string;
  subtitle?: string;
  cohortTitle?: string;
  cohortId?: string;
  seasonOrder: number;
  currentVideo: number;
  totalVideos: number;
  currentChunk: number;
  totalChunks: number;
  startTime: string;
  endTime: string;
  currentTime: string;
  totalDuration: string;
  videoId?: string;
}

export interface TimelineMarker {
  id: string;
  position: number; // 0-100
  variant: 'checkpoint' | 'quiz' | 'note' | 'chapter' | 'bookmark';
  active?: boolean;
}

export type PlayerTool = 'scribe' | 'capture' | 'bookmark' | 'speed' | 'menu';

export interface PlaybackState {
  activeItem: FeedItem | null;
  feedItems: FeedItem[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  playbackSpeed: number;
  bookmarked: boolean;
  currentTimeSeconds: number;
  chunkDurationSeconds: number;
  timelineProgress: number;
  timelineMarkers: TimelineMarker[];
  activeTool: PlayerTool | null;
  notesText: string;
  stats: {
    cohortsCovered: number;
    chunksRemaining: number;
    estimatedMinutes: number;
    dailyProgressPercent: number;
  };
}
