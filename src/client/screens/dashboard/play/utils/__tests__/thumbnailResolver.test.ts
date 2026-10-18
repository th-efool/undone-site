import { describe, it, expect } from 'vitest';
import { resolveItemThumbnail, CURATED_POSTERS } from '../thumbnailResolver';
import type { FeedItem } from '@/src/shared/feed/feedEngine.types';

describe('thumbnailResolver utility', () => {
  it('returns a curated fallback poster when item is null or undefined', () => {
    const thumb0 = resolveItemThumbnail(null, 0);
    const thumb1 = resolveItemThumbnail(undefined, 1);
    expect(thumb0).toBe(CURATED_POSTERS[0]);
    expect(thumb1).toBe(CURATED_POSTERS[1]);
  });

  it('honors single chunk explicit thumbnail when not avoiding', () => {
    const item = {
      chunkId: 'chunk-1',
      lessonThumbnail: 'https://example.com/unique.jpg',
      totalChunksInLesson: 1,
    } as unknown as FeedItem;

    const res = resolveItemThumbnail(item, 0);
    expect(res).toBe('https://example.com/unique.jpg');
  });

  it('maps YouTube multi-chunk items to distinct frame numbers', () => {
    const item1 = {
      chunkId: 'chunk-1',
      lessonVideoId: 'abc1234',
      chunkOrder: 1,
      totalChunksInLesson: 4,
    } as unknown as FeedItem;

    const item2 = {
      chunkId: 'chunk-2',
      lessonVideoId: 'abc1234',
      chunkOrder: 2,
      totalChunksInLesson: 4,
    } as unknown as FeedItem;

    const res1 = resolveItemThumbnail(item1, 0);
    const res2 = resolveItemThumbnail(item2, 1);

    expect(res1).toBe('https://img.youtube.com/vi/abc1234/1.jpg');
    expect(res2).toBe('https://img.youtube.com/vi/abc1234/2.jpg');
    expect(res1).not.toBe(res2);
  });

  it('falls back to a curated poster if candidate matches avoidUrl', () => {
    const item = {
      chunkId: 'chunk-1',
      lessonThumbnail: 'https://example.com/same.jpg',
      totalChunksInLesson: 1,
    } as unknown as FeedItem;

    // When avoidUrl matches lessonThumbnail, it should return a distinct curated poster
    const res = resolveItemThumbnail(item, 2, 'https://example.com/same.jpg');
    expect(res).not.toBe('https://example.com/same.jpg');
    expect(CURATED_POSTERS).toContain(res);
  });
});
