import { describe, it, expect, vi } from 'vitest';

vi.mock('@/src/shared/curriculum', () => ({
  computeTargetVector: vi.fn(() => ({})),
  vectorToArray: vi.fn(() => new Array(12).fill(0)),
  arrayToVector: vi.fn(),
  rawCosineSimilarity: vi.fn(() => 0),
}));

import { generateFeed } from '../feedEngine';
import type { FeedEngineInput, FeedChunkInput } from '../feedEngine.types';

describe('generateFeed', () => {
  it('handles chunks with missing vectors (simulating render backflow)', () => {
    const chunks: FeedChunkInput[] = [
      {
        chunkId: 'chunk1',
        chunkTitle: 'Chunk 1',
        chunkOrder: 1,
        chunkDuration: '5m',
        startSeconds: 0,
        endSeconds: 300,
        lessonId: 'lesson1',
        lessonTitle: 'Lesson 1',
        lessonThumbnail: '',
        lessonOrder: 1,
        lessonType: 'video',
        seasonId: 'season1',
        seasonTitle: 'Season 1',
        seasonOrder: 1,
        cohortId: 'cohort1',
        cohortTitle: 'Cohort 1',
        cohortCoverImage: '',
        cohortProvider: 'Provider 1',
        // chunkVector and fullLessonVector are explicitly missing to simulate backflow
      }
    ];

    const input: FeedEngineInput = {
      allChunks: chunks,
      chunkProgress: {},
      cohortStates: [
        {
          cohortId: 'cohort1',
          subscribedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          dailyGoalMinutes: 15,
          scheduleDays: [],
          priority: 1
        }
      ],
      currentTime: new Date(),
      dailyGoalMinutes: 15,
      completedTodayMinutes: 0,
      targetQueryVector: new Array(12).fill(0.1)
    };

    const result = generateFeed(input);
    expect(result.items.length).toBe(1);
    expect(result.items[0].chunkId).toBe('chunk1');

    // Missing vectors should evaluate to 0, avoiding 0.5 arrays. 
    // In the current implementation, it skips calling rawCosineSimilarity entirely if missing vectors.
  });
});
