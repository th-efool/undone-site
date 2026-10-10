import { describe, expect, it } from 'vitest';
import { deliveryFeedChunks } from '../delivery-feed';
import { PEDAGOGICAL_DIMENSIONS } from '@/src/shared/curriculum/pedagogicalVector.types';

const lesson = (chunks: unknown, lessonType = 'ARTICLE') => ({ id: 'lesson', title: 'Reading', videoId: null,
  lessonType, thumbnailUrl: null, order: 1, seasonId: 'season', chunks,
  season: { order: 1, title: 'Season', cohortId: 'cohort', cohort: { title: 'Cohort', coverImage: null } } });
const chunk = { id: 'chunk', title: 'Actual section', text: 'Actual retained source text.\nSecond paragraph.', durationSeconds: 12,
  contentOrigin: 'external', durationMethod: 'reading_estimate', coverage: { limitations: ['Selected pages only.'] } };
describe('retained delivery projection', () => {
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
});
