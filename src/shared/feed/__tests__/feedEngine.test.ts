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

  describe('explicit chunk selection & replay priority before ranking (FH-03)', () => {
    const chunk1: FeedChunkInput = {
      chunkId: 'chunk1',
      chunkTitle: 'Chunk 1 Introduction',
      chunkOrder: 1,
      chunkDuration: '3m',
      startSeconds: 0,
      endSeconds: 180,
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
      isStrictlyLinear: true,
    };

    const chunk2: FeedChunkInput = {
      ...chunk1,
      chunkId: 'chunk2',
      chunkTitle: 'Chunk 2 Deep Concept',
      chunkOrder: 2,
      startSeconds: 180,
      endSeconds: 360,
    };

    const baseInput: FeedEngineInput = {
      allChunks: [chunk1, chunk2],
      chunkProgress: {},
      cohortStates: [
        {
          cohortId: 'cohort1',
          orderStyle: 'Sequential',
          subscribedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          dailyGoalMinutes: 20,
          scheduleDays: [],
          priority: 1,
        },
      ],
      currentTime: new Date(),
      dailyGoalMinutes: 20,
      completedTodayMinutes: 0,
      feedSize: 5,
    };

    it('requests chunk 2 in a sequential lesson with chunk 1 incomplete: first output is chunk 2', () => {
      const result = generateFeed({
        ...baseInput,
        requestedChunkId: 'chunk2',
      });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items[0].chunkId).toBe('chunk2');
    });

    it('replays completed chunk 1 while chunk 2 incomplete: first output is chunk 1', () => {
      const result = generateFeed({
        ...baseInput,
        chunkProgress: {
          chunk1: {
            chunkId: 'chunk1',
            lessonId: 'lesson1',
            cohortId: 'cohort1',
            status: 'completed',
            watchedSeconds: 180,
            totalSeconds: 180,
          },
        },
        requestedChunkId: 'chunk1',
      });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items[0].chunkId).toBe('chunk1');
    });

    it('returns empty feed when all chunks are completed and no explicit selection exists', () => {
      const result = generateFeed({
        ...baseInput,
        chunkProgress: {
          chunk1: {
            chunkId: 'chunk1',
            lessonId: 'lesson1',
            cohortId: 'cohort1',
            status: 'completed',
            watchedSeconds: 180,
            totalSeconds: 180,
          },
          chunk2: {
            chunkId: 'chunk2',
            lessonId: 'lesson1',
            cohortId: 'cohort1',
            status: 'completed',
            watchedSeconds: 180,
            totalSeconds: 180,
          },
        },
      });

      expect(result.items).toHaveLength(0);
    });

    it('returns requested chunk once when all chunks are completed with explicit selection', () => {
      const result = generateFeed({
        ...baseInput,
        chunkProgress: {
          chunk1: {
            chunkId: 'chunk1',
            lessonId: 'lesson1',
            cohortId: 'cohort1',
            status: 'completed',
            watchedSeconds: 180,
            totalSeconds: 180,
          },
          chunk2: {
            chunkId: 'chunk2',
            lessonId: 'lesson1',
            cohortId: 'cohort1',
            status: 'completed',
            watchedSeconds: 180,
            totalSeconds: 180,
          },
        },
        requestedChunkId: 'chunk1',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].chunkId).toBe('chunk1');
    });
  });
});
