import { describe, expect, it, vi } from 'vitest';
import { deliveryFeedChunks } from '../delivery-feed';
import { PEDAGOGICAL_DIMENSIONS } from '@/src/shared/curriculum/pedagogicalVector.types';

const lesson = (chunks: unknown, lessonType = 'ARTICLE') => ({ id: 'lesson', title: 'Reading', videoId: null,
  lessonType, thumbnailUrl: null, order: 1, seasonId: 'season', chunks,
  season: { order: 1, title: 'Season', cohortId: 'cohort', cohort: { title: 'Cohort', coverImage: null } } });
const chunk = { id: 'chunk', title: 'Actual section', text: 'Actual retained source text.\nSecond paragraph.', durationSeconds: 12,
  contentOrigin: 'external', durationMethod: 'reading_estimate', coverage: { limitations: ['Selected pages only.'] } };
describe('retained delivery projection', () => {
  it('accounts for every rejected lesson without exposing raw content or weakening validation', () => {
    const cases = [
      { value: lesson(null), reason: 'INVALID_CHUNKS' }, { value: lesson([]), reason: 'INVALID_CHUNKS' },
      { value: lesson([{ ...chunk, vector: ['private corrupt payload'] }]), reason: 'INVALID_CHUNKS' },
      { value: lesson([chunk], 'UNKNOWN'), reason: 'UNSUPPORTED_LESSON_TYPE' }, { value: lesson([chunk, chunk]), reason: 'DUPLICATE_CHUNKS' },
      { value: lesson([{ ...chunk, startSeconds: 20, endSeconds: 5 }]), reason: 'INVALID_TIMING' },
      { value: lesson([{ id: 'missing' }]), reason: 'MISSING_TEXT' }, { value: lesson([chunk], 'VIDEO'), reason: 'MISSING_VIDEO' },
      { value: lesson([chunk, { ...chunk, id: 'later', endSeconds: 1 }]), reason: 'INVALID_TIMING' },
      { value: lesson([{ ...chunk, id: 'first', durationSeconds: 1.7e308 }, { ...chunk, id: 'next', durationSeconds: 1.7e308 }]), reason: 'INVALID_TIMING' },
    ];
    for (const item of cases) {
      const rejected = vi.fn(); expect(deliveryFeedChunks([item.value, { ...lesson([chunk]), id: 'valid' }], rejected)).toHaveLength(1);
      expect(rejected).toHaveBeenCalledExactlyOnceWith({ lessonId: 'lesson', cohortId: 'cohort', reason: item.reason });
    }
    const rejected = vi.fn(); expect(deliveryFeedChunks([], rejected)).toEqual([]); expect(rejected).not.toHaveBeenCalled();
  });
  it('delivers original text, origin, limitations and reading estimate without needing a video', () => {
    const output = deliveryFeedChunks([lesson([chunk])]); expect(output).toHaveLength(1);
    expect(output[0]).toMatchObject({ chunkId: 'chunk', lessonType: 'reading', startSeconds: 0, endSeconds: 12,
      content: { text: chunk.text, contentOrigin: 'external', limitations: ['Selected pages only.'], durationMethod: 'reading_estimate' } });
    expect(output[0].lessonVideoId).toBeUndefined();
    expect(deliveryFeedChunks([lesson([chunk], 'ASSIGNMENT')])[0].lessonType).toBe('assignment');
  });
  it('maps canonical 12-dimensional vectors and retains explicitly labeled AI guides', () => {
    const vector = Object.fromEntries(PEDAGOGICAL_DIMENSIONS.map((key, index) => [key, index / 12]));
    const output = deliveryFeedChunks([lesson([{ ...chunk, vector, contentOrigin: 'ai' }])]);
    expect(output[0].chunkVector).toEqual(PEDAGOGICAL_DIMENSIONS.map((_, index) => index / 12));
    expect(output[0].content?.contentOrigin).toBe('ai');
  });
  it('rejects malformed lesson groups instead of fabricating unavailable content', () => {
    for (const chunks of [null, {}, [{ id: 'empty' }], [{ ...chunk, text: ' ' }], [{ ...chunk, vector: [0.1] }],
      [{ ...chunk, durationSeconds: -1 }], [{ ...chunk, startSeconds: 10, endSeconds: 3 }], [chunk, chunk]]) {
      expect(deliveryFeedChunks([lesson(chunks)])).toEqual([]);
    }
    expect(deliveryFeedChunks([lesson([chunk], 'UNKNOWN')])).toEqual([]);
    expect(deliveryFeedChunks([lesson([chunk], 'VIDEO')])).toEqual([]);
    expect(deliveryFeedChunks([lesson([chunk, { ...chunk, id: 'later', endSeconds: 1 }])])).toEqual([]);
  });
  it('preserves legacy video ordering and cumulative offsets without invented text', () => {
    const video = { ...lesson([{ id: 'two', order: 2, duration: '1m 30s' }, { id: 'one', order: 1, duration: '2m' }], 'VIDEO'), videoId: 'yt' };
    const output = deliveryFeedChunks([video]);
    expect(output.map(item => [item.chunkId, item.startSeconds, item.endSeconds])).toEqual([['one', 0, 120], ['two', 120, 210]]);
    expect(output.every(item => item.lessonType === 'video' && item.content === undefined)).toBe(true);
  });
  it('delivers chunks formatted by the S5 delivery adapter without rejection', () => {
    const s5Chunk = {
      id: 'chunk-1',
      chunkId: 'chunk-1',
      sourceId: 'source-1',
      sourceLabel: 'TS Handbook',
      title: 'TS Handbook',
      text: 'Generics are a key feature of TypeScript allowing reusable components.',
      order: 0,
      start: 0,
      end: 50,
      checksum: 'b'.repeat(64),
      contentOrigin: 'user',
      durationMethod: 'reading_estimate',
    };
    const l = {
      id: 'lesson-1',
      title: 'Generics',
      videoId: null,
      lessonType: 'ARTICLE',
      thumbnailUrl: null,
      order: 0,
      seasonId: 'season-1',
      chunks: [s5Chunk],
      season: { order: 0, title: 'Season 1', cohortId: 'cohort-1', cohort: { title: 'Cohort 1', coverImage: null } },
    };
    const rejected = vi.fn();
    const output = deliveryFeedChunks([l], rejected);
    expect(rejected).not.toHaveBeenCalled();
    expect(output).toHaveLength(1);
    expect(output[0].chunkId).toBe('chunk-1');
    expect(output[0].content?.text).toContain('Generics');
  });
});
