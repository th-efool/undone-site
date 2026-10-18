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
});
