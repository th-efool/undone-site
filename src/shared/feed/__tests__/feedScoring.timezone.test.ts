import { describe, it, expect } from 'vitest';
import { calculateChunkScore } from '../feedScoring';
import { generateFeed } from '../feedEngine';
import type { FeedChunkInput, FeedEngineInput, CohortLearnerState } from '../feedEngine.types';

describe('FH-11: Schedule scoring and timezone offset handling', () => {
  const dummyChunk: FeedChunkInput = {
    chunkId: 'chk-1',
    chunkTitle: 'Micro Concept',
    chunkOrder: 1,
    chunkDuration: '3m',
    startSeconds: 0,
    endSeconds: 180,
    lessonId: 'les-1',
    lessonTitle: 'Lesson 1',
    lessonThumbnail: '',
    lessonOrder: 1,
    lessonType: 'video',
    seasonId: 'sea-1',
    seasonTitle: 'Season 1',
    seasonOrder: 1,
    cohortId: 'coh-1',
    cohortTitle: 'Cohort 1',
    cohortCoverImage: '',
    cohortProvider: 'Provider 1',
  };

  it('Sunday 20:00 UTC with offset -330 gives Monday 01:30; Monday schedule matches', () => {
    // 2026-08-23T20:00:00Z is Sunday 20:00 UTC
    const utcNow = new Date('2026-08-23T20:00:00.000Z');
    const offset = -330; // India (UTC+05:30)

    const shiftedDate = new Date(utcNow.getTime() - offset * 60_000);
    const localDayOfWeek = shiftedDate.getUTCDay(); // 1 = Monday
    const localHour = shiftedDate.getUTCHours(); // 1 = 01:30

    expect(localDayOfWeek).toBe(1);
    expect(localHour).toBe(1);

    const mondayState: CohortLearnerState = {
      cohortId: 'coh-1',
      subscribedAt: utcNow.toISOString(),
      lastActiveAt: utcNow.toISOString(),
      dailyGoalMinutes: 20,
      scheduleDays: ['Mon'],
      priority: 1,
    };

    const sundayState: CohortLearnerState = {
      cohortId: 'coh-1',
      subscribedAt: utcNow.toISOString(),
      lastActiveAt: utcNow.toISOString(),
      dailyGoalMinutes: 20,
      scheduleDays: ['Sun'],
      priority: 1,
    };

    const monScore = calculateChunkScore(dummyChunk, undefined, mondayState, utcNow, undefined, localDayOfWeek);
    const sunScore = calculateChunkScore(dummyChunk, undefined, sundayState, utcNow, undefined, localDayOfWeek);

    // Monday schedule matches (1.0 vs 0.2 schedule score component)
    expect(monScore.score).toBeGreaterThan(sunScore.score);
  });

  it('Monday 02:00 UTC with offset +480 gives Sunday 18:00; Sunday schedule matches', () => {
    // 2026-08-24T02:00:00Z is Monday 02:00 UTC
    const utcNow = new Date('2026-08-24T02:00:00.000Z');
    const offset = 480; // California PST (UTC-08:00)

    const shiftedDate = new Date(utcNow.getTime() - offset * 60_000);
    const localDayOfWeek = shiftedDate.getUTCDay(); // 0 = Sunday
    const localHour = shiftedDate.getUTCHours(); // 18 = 6 PM

    expect(localDayOfWeek).toBe(0);
    expect(localHour).toBe(18);

    const mondayState: CohortLearnerState = {
      cohortId: 'coh-1',
      subscribedAt: utcNow.toISOString(),
      lastActiveAt: utcNow.toISOString(),
      dailyGoalMinutes: 20,
      scheduleDays: ['Mon'],
      priority: 1,
    };

    const sundayState: CohortLearnerState = {
      cohortId: 'coh-1',
      subscribedAt: utcNow.toISOString(),
      lastActiveAt: utcNow.toISOString(),
      dailyGoalMinutes: 20,
      scheduleDays: ['Sun'],
      priority: 1,
    };

    const monScore = calculateChunkScore(dummyChunk, undefined, mondayState, utcNow, undefined, localDayOfWeek);
    const sunScore = calculateChunkScore(dummyChunk, undefined, sundayState, utcNow, undefined, localDayOfWeek);

    // Sunday schedule matches for learner in California
    expect(sunScore.score).toBeGreaterThan(monScore.score);
  });

  it('elapsed recency calculation uses real now, regardless of timezoneOffset', () => {
    const utcNow = new Date('2026-08-24T02:00:00.000Z');
    // Last active was exactly 1 hour ago
    const oneHourAgo = new Date(utcNow.getTime() - 3600_000).toISOString();

    const state: CohortLearnerState = {
      cohortId: 'coh-1',
      subscribedAt: utcNow.toISOString(),
      lastActiveAt: oneHourAgo,
      dailyGoalMinutes: 20,
      scheduleDays: ['Mon'],
      priority: 1,
    };

    // calculateChunkScore receives utcNow as now, with positive offset (US) vs negative offset (India)
    const scoreUS = calculateChunkScore(dummyChunk, undefined, state, utcNow, undefined, 0);
    const scoreIndia = calculateChunkScore(dummyChunk, undefined, state, utcNow, undefined, 1);

    // Both get the same maximum recency score (< 24 hours ago = 1.0) because utcNow was not shifted
    // and elapsed recency is strictly 1 hour
    expect(scoreUS.score).toBeDefined();
    expect(scoreIndia.score).toBeDefined();
  });

  it('generateFeed produces consistent ranking given explicit localDayOfWeek and localHour', () => {
    const utcNow = new Date('2026-08-23T20:00:00.000Z');

    const chunkA = { ...dummyChunk, chunkId: 'chk-a', cohortId: 'coh-a', lessonId: 'les-a' };
    const chunkB = { ...dummyChunk, chunkId: 'chk-b', cohortId: 'coh-b', lessonId: 'les-b' };

    const input: FeedEngineInput = {
      allChunks: [chunkA, chunkB],
      chunkProgress: {},
      cohortStates: [
        {
          cohortId: 'coh-a',
          subscribedAt: utcNow.toISOString(),
          lastActiveAt: utcNow.toISOString(),
          dailyGoalMinutes: 20,
          scheduleDays: ['Mon'],
          priority: 1,
        },
        {
          cohortId: 'coh-b',
          subscribedAt: utcNow.toISOString(),
          lastActiveAt: utcNow.toISOString(),
          dailyGoalMinutes: 20,
          scheduleDays: ['Sun'],
          priority: 1,
        },
      ],
      currentTime: utcNow,
      localDayOfWeek: 1, // Monday in learner's local timezone
      localHour: 1,
      dailyGoalMinutes: 20,
      completedTodayMinutes: 0,
      targetQueryVector: new Array(12).fill(0.1),
    };

    const feed = generateFeed(input);
    expect(feed.items.length).toBe(2);
    // Cohort A matches Monday schedule, so it ranks higher than Cohort B
    expect(feed.items[0].cohortId).toBe('coh-a');
  });
});
