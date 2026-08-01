import type { Lesson, TimelineMarker } from './play';

export const lesson: Lesson = {
  platform: 'youtube',

  title: 'Machine Learning in 2 Weeks',

  seasonOrder: 1,
  currentVideo: 1,
  totalVideos: 10,
  currentChunk: 3,
  totalChunks: 4,
  startTime: '00:00',
  endTime: '05:00',
  currentTime: '00:02',
  totalDuration: '05:00',
};

export const timelineMarkers: TimelineMarker[] = [
  {
    id: 'chapter-1',
    position: 18,
    variant: 'checkpoint',
  },
  {
    id: 'quiz',
    position: 49,
    variant: 'quiz',
    active: true,
  },
  {
    id: 'chapter-2',
    position: 72,
    variant: 'chapter',
  },
  {
    id: 'bookmark',
    position: 90,
    variant: 'bookmark',
  },
];
