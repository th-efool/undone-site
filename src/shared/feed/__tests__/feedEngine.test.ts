import { describe, it, expect, vi } from 'vitest';

vi.mock('@/src/shared/curriculum', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/shared/curriculum')>();
  return {
    ...actual,
  };
});

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
  });

  it('ranks hands-on code chunks higher in build channel and short chunks higher in quick channel', () => {
    const chunks: FeedChunkInput[] = [
      {
        chunkId: 'theory_long',
        chunkTitle: 'Formal Ownership Proofs',
        chunkOrder: 1,
        chunkDuration: '10m',
        startSeconds: 0,
        endSeconds: 600,
        lessonId: 'l_theory',
        lessonTitle: 'Abstract Type Systems',
        lessonThumbnail: '',
        lessonOrder: 1,
        lessonType: 'video',
        seasonId: 's1',
        seasonTitle: 'S1',
        seasonOrder: 1,
        cohortId: 'c1',
        cohortTitle: 'Rust',
        cohortCoverImage: '',
        cohortProvider: 'Undone',
        isStrictlyLinear: false,
        // [cogLoad, practicality, visual, scaffolding, linearity, novelty, abstraction, pacing, rigor, interactivity, breadth, energy]
        chunkVector: [0.9, 0.2, 0.5, 0.4, 0.8, 0.5, 0.9, 0.3, 0.95, 0.2, 0.3, 0.4],
        content: { text: 'Formal theorem and mathematical proof of borrow checker invariants.', limitations: [] },
      },
      {
        chunkId: 'hands_on_build',
        chunkTitle: 'Cargo Run & CLI Implementation',
        chunkOrder: 1,
        chunkDuration: '6m',
        startSeconds: 0,
        endSeconds: 360,
        lessonId: 'l_build',
        lessonTitle: 'Hands-On CLI Project',
        lessonThumbnail: '',
        lessonOrder: 2,
        lessonType: 'video',
        seasonId: 's1',
        seasonTitle: 'S1',
        seasonOrder: 1,
        cohortId: 'c1',
        cohortTitle: 'Rust',
        cohortCoverImage: '',
        cohortProvider: 'Undone',
        isStrictlyLinear: false,
        chunkVector: [0.6, 0.95, 0.85, 0.85, 0.5, 0.4, 0.25, 0.6, 0.5, 0.9, 0.3, 0.7],
        content: { text: 'Let us cargo build and implement fn main with struct and impl blocks in terminal.', limitations: [] },
      },
      {
        chunkId: 'quick_bite',
        chunkTitle: '2-Minute Rust Tip',
        chunkOrder: 1,
        chunkDuration: '2m',
        startSeconds: 0,
        endSeconds: 120,
        lessonId: 'l_quick',
        lessonTitle: 'Fast Cargo Tips',
        lessonThumbnail: '',
        lessonOrder: 3,
        lessonType: 'video',
        seasonId: 's1',
        seasonTitle: 'S1',
        seasonOrder: 1,
        cohortId: 'c1',
        cohortTitle: 'Rust',
        cohortCoverImage: '',
        cohortProvider: 'Undone',
        isStrictlyLinear: false,
        chunkVector: [0.2, 0.7, 0.4, 0.5, 0.1, 0.6, 0.2, 0.9, 0.3, 0.5, 0.2, 0.85],
        content: { text: 'Quick tip on cargo check for fast compilation.', limitations: [] },
      },
    ];

    const baseInput = {
      allChunks: chunks,
      chunkProgress: {},
      cohortStates: [],
      currentTime: new Date(),
      dailyGoalMinutes: 20,
      completedTodayMinutes: 0,
    };

    const buildFeed = generateFeed({ ...baseInput, activeChannel: 'build' });
    expect(buildFeed.items[0].chunkId).toBe('hands_on_build');
    expect(buildFeed.items[0].matchReason).toContain('Build');

    const quickFeed = generateFeed({ ...baseInput, activeChannel: 'quick' });
    expect(quickFeed.items[0].chunkId).toBe('quick_bite');
    expect(quickFeed.items[0].matchReason).toContain('Quick Bite');

    const deepDiveFeed = generateFeed({ ...baseInput, activeChannel: 'deep_dive' });
    expect(deepDiveFeed.items[0].chunkId).toBe('theory_long');
    expect(deepDiveFeed.items[0].matchReason).toContain('Deep Dive');

    const ragFeed = generateFeed({ ...baseInput, activeChannel: 'default', searchQuery: 'borrow checker theorem' });
    expect(ragFeed.items[0].chunkId).toBe('theory_long');
    expect(ragFeed.items[0].matchReason).toContain('RAG Match');
  });
});
