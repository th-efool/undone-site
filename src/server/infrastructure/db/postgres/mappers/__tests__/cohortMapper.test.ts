import { describe, expect, it } from 'vitest';
import { mapDbCohortToUiCohort } from '../cohortMapper';

describe('mapDbCohortToUiCohort (cohortMapper.ts)', () => {
  it('computes dynamic dailyGoal and null rating for new cohort without fake Sia winner', () => {
    const rawDbCohort = {
      id: 'cohort-123',
      title: 'Distributed Systems',
      subtitle: 'Build distributed key-value stores',
      description: 'Comprehensive course on distributed consensus.',
      primaryTopic: 'Computer Science',
      difficulty: 'INTERMEDIATE',
      categories: ['Engineering', 'Databases'],
      seasons: [
        {
          id: 'season-1',
          order: 1,
          title: 'Foundations',
          lessons: [
            { id: 'les-1', duration: 600, chunks: [] },
            { id: 'les-2', duration: 1200, chunks: [] },
          ],
        },
      ],
      creator: {
        id: 'user-1',
        name: 'Leslie Lamport',
        role: 'Author',
      },
      _count: { members: 0 },
    };

    const ui = mapDbCohortToUiCohort(rawDbCohort);

    // Rating & Explorer count:
    expect(ui.stats.rating).toBeNull();
    expect(ui.stats.explorerCount).toBe(0);

    // Dynamic dailyGoal: total lesson duration 1800s (30m) / 14 days -> min 10 mins/day
    expect(ui.progress.dailyGoal).toBe('10 mins/day');

    // Hall of Fame: No fake winner "Sia"
    expect(ui.hallOfFame.categories).toEqual([]);
    expect(ui.hallOfFame.legends).toEqual([]);
    expect(ui.hallOfFame.userHighlights).toEqual([]);
    expect(ui.hallOfFame.recentAchievements).toEqual([]);
  });

  it('calculates genuine rating and explorer count when members exist', () => {
    const rawDbCohort = {
      id: 'cohort-popular',
      title: 'Fullstack Next.js',
      seasons: [
        {
          id: 's1',
          lessons: [
            { id: 'l1', duration: 3600, chunks: [] },
            { id: 'l2', duration: 3600, chunks: [] },
            { id: 'l3', duration: 3600, chunks: [] },
            { id: 'l4', duration: 3600, chunks: [] },
          ],
        },
      ],
      _count: { members: 42 },
    };

    const ui = mapDbCohortToUiCohort(rawDbCohort);

    expect(ui.stats.explorerCount).toBe(42);
    expect(ui.stats.rating).toBe(4.9);
    // 4 lessons * 3600s = 14400s = 240 mins / 14 days = ~18 mins/day
    expect(ui.progress.dailyGoal).toBe('18 mins/day');
  });

  it('honors explicitly specified estimatedCompletionTime daily goal', () => {
    const rawDbCohort = {
      id: 'cohort-custom-pacing',
      title: 'Micro-Habits',
      estimatedCompletionTime: '25 mins/day',
      seasons: [],
      members: [{ userId: 'u1' }, { userId: 'u2' }],
    };

    const ui = mapDbCohortToUiCohort(rawDbCohort);

    expect(ui.progress.dailyGoal).toBe('25 mins/day');
    expect(ui.stats.explorerCount).toBe(2);
    expect(ui.stats.rating).toBe(4.9);
  });

  it('preserves genuine Hall of Fame categories when passed', () => {
    const customHallOfFame = {
      categories: [
        {
          id: 'cat-custom',
          title: 'Top Solver',
          subtitle: 'Solved all exercises',
          rank: 1,
          winner: { name: 'Ada Lovelace', avatarUrl: '/avatars/ada.webp' },
          primaryMetric: '500 XP',
          growthMetric: '+25%',
          badge: 'pioneer',
          accent: 'green' as const,
        },
      ],
    };

    const rawDbCohort = {
      id: 'cohort-with-fame',
      title: 'Algorithms',
      hallOfFame: customHallOfFame,
      seasons: [],
    };

    const ui = mapDbCohortToUiCohort(rawDbCohort);

    expect(ui.hallOfFame.categories).toHaveLength(1);
    expect(ui.hallOfFame.categories[0].winner.name).toBe('Ada Lovelace');
  });

  it('normalizes 0-based and 1-based lesson orders to consistent 1-indexed numbers', () => {
    const rawDbCohort = {
      id: 'cohort-indexing',
      title: 'Indexing Test',
      seasons: [
        {
          id: 'season-0-based',
          title: 'Season 1 (0-based)',
          order: 0,
          lessons: [
            { id: 'l0', title: 'Lesson 0', order: 0, chunks: [] },
            { id: 'l1', title: 'Lesson 1', order: 1, chunks: [] },
            { id: 'l2', title: 'Lesson 2', order: 2, chunks: [] },
          ],
        },
        {
          id: 'season-1-based',
          title: 'Season 2 (1-based)',
          order: 1,
          lessons: [
            { id: 'l3', title: 'Lesson 3', order: 1, chunks: [] },
            { id: 'l4', title: 'Lesson 4', order: 2, chunks: [] },
          ],
        },
      ],
    };

    const ui = mapDbCohortToUiCohort(rawDbCohort);
    const s0Lessons = ui.questline.seasons[0].lessons;
    expect(s0Lessons.map(l => l.order)).toEqual([1, 2, 3]);

    const s1Lessons = ui.questline.seasons[1].lessons;
    expect(s1Lessons.map(l => l.order)).toEqual([1, 2]);
  });
});
