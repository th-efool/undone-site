import { describe, it, expect } from 'vitest';
import { resolveMediaSource, extractYouTubeId, isDirectVideoUrl } from '../mediaSource';
import type { FeedItem } from '@/src/shared/feed/feedEngine.types';

describe('mediaSource resolution', () => {
  describe('extractYouTubeId', () => {
    it('extracts ID from standard watch URL', () => {
      expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from short URL', () => {
      expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ');
    });

    it('extracts ID from embed URL', () => {
      expect(extractYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('returns raw ID string if already 11 alphanumeric characters', () => {
      expect(extractYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('returns null for non-YouTube strings', () => {
      expect(extractYouTubeId('https://example.com/video.mp4')).toBeNull();
      expect(extractYouTubeId('')).toBeNull();
      expect(extractYouTubeId(undefined)).toBeNull();
    });
  });

  describe('isDirectVideoUrl', () => {
    it('recognizes mp4 and webm extensions', () => {
      expect(isDirectVideoUrl('https://cdn.example.com/stream.mp4')).toBe(true);
      expect(isDirectVideoUrl('https://cdn.example.com/stream.webm')).toBe(true);
      expect(isDirectVideoUrl('https://cdn.example.com/stream.mp4?token=123')).toBe(true);
    });

    it('recognizes HLS m3u8 playlists', () => {
      expect(isDirectVideoUrl('https://cdn.example.com/master.m3u8')).toBe(true);
      expect(isDirectVideoUrl('https://cdn.example.com/master.m3u8?token=xyz')).toBe(true);
    });

    it('rejects YouTube URLs', () => {
      expect(isDirectVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false);
      expect(isDirectVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(false);
    });

    it('rejects html or empty strings', () => {
      expect(isDirectVideoUrl('https://example.com/page.html')).toBe(false);
      expect(isDirectVideoUrl('')).toBe(false);
    });
  });

  describe('resolveMediaSource', () => {
    const baseItem: FeedItem = {
      chunkId: 'chunk-1',
      chunkTitle: 'Chunk 1',
      chunkOrder: 1,
      chunkDuration: '3m',
      startSeconds: 0,
      endSeconds: 180,
      lessonId: 'lesson-1',
      cohortId: 'cohort-1',
      lessonTitle: 'Lesson 1',
      cohortTitle: 'Cohort 1',
      matchScore: 90,
    };

    it('resolves explicit YouTube videoId', () => {
      const item: FeedItem = {
        ...baseItem,
        lessonType: 'video',
        lessonVideoId: 'dQw4w9WgXcQ',
      };
      const result = resolveMediaSource(item);
      expect(result.kind).toBe('youtube');
      expect(result.isYouTube).toBe(true);
      expect(result.videoId).toBe('dQw4w9WgXcQ');
      expect(result.isDirectVideo).toBe(false);
    });

    it('resolves direct MP4 videoUrl', () => {
      const item: FeedItem = {
        ...baseItem,
        lessonType: 'video',
        lessonVideoUrl: 'https://cdn.example.com/lesson1.mp4',
      };
      const result = resolveMediaSource(item);
      expect(result.kind).toBe('direct_video');
      expect(result.isDirectVideo).toBe(true);
      expect(result.isHls).toBe(false);
      expect(result.videoUrl).toBe('https://cdn.example.com/lesson1.mp4');
      expect(result.isYouTube).toBe(false);
    });

    it('resolves HLS m3u8 stream', () => {
      const item: FeedItem = {
        ...baseItem,
        lessonType: 'video',
        sourceUrl: 'https://streaming.example.com/live/manifest.m3u8',
      };
      const result = resolveMediaSource(item);
      expect(result.kind).toBe('direct_video');
      expect(result.isDirectVideo).toBe(true);
      expect(result.isHls).toBe(true);
      expect(result.videoUrl).toBe('https://streaming.example.com/live/manifest.m3u8');
    });

    it('resolves reading lesson', () => {
      const item: FeedItem = {
        ...baseItem,
        lessonType: 'reading',
        content: { text: 'Hello microlearning reading content.', limitations: [] },
      };
      const result = resolveMediaSource(item);
      expect(result.kind).toBe('reading');
      expect(result.isReading).toBe(true);
      expect(result.isYouTube).toBe(false);
      expect(result.isDirectVideo).toBe(false);
    });

    it('handles null item or unsupported media gracefully', () => {
      expect(resolveMediaSource(null).kind).toBe('unsupported');
      expect(resolveMediaSource(undefined).kind).toBe('unsupported');
      expect(resolveMediaSource({ ...baseItem, lessonType: 'assignment' }).kind).toBe('unsupported');
    });
  });
});
