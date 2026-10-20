import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  findMany: vi.fn(),
  getExplore: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    cohort: {
      findMany: hoisted.findMany,
    },
  },
}));

vi.mock('@/src/server/infrastructure/db/mock/repositories/explore.repo', () => ({
  exploreRepo: {
    getExplore: hoisted.getExplore,
  },
}));

import { GET } from '../route';

describe('GET /api/explore', () => {
  const sampleMockData = {
    searchSuggestions: [{ id: 's1', label: 'Rust Fundamentals' }],
    peopleFinishing: [],
    topics: [{ id: 't1', name: 'Web Dev' }],
    trendingSideQuests: [
      {
        id: 'mock-quest-1',
        cohortId: 'mock-quest-1',
        title: 'Mock Deep Work',
        subtitle: 'Focus and execute',
        dailyGoal: '25 min/day',
        thumbnail: '/mock/thumbnails/deep-work.webp',
        featuredParticipants: [],
        participantCount: '120 participants',
      },
    ],
    recentlyPublished: [
      {
        id: 'mock-art-1',
        cohortId: 'mock-art-1',
        title: 'Mock Article',
        author: 'Guide Author',
        thumbnail: '/mock/thumbnails/deep-work.webp',
        learnerCount: '40 learners',
        publishedLabel: 'Yesterday',
        bookmarked: false,
      },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    hoisted.getExplore.mockReturnValue(sampleMockData);
  });

  it('queries real published public cohorts and blends them with starter mock data', async () => {
    const publishedDbCohorts = [
      {
        id: 'cohort-real-1',
        title: 'Real Rust Cohort',
        subtitle: 'Build high performance apps',
        description: 'Deep exploration of systems programming',
        coverImage: 'https://images.example.com/rust.png',
        difficulty: 'INTERMEDIATE',
        visibility: 'PUBLIC',
        categories: ['Systems', 'Rust'],
        estimatedCompletionTime: '30 min/day',
        publishedAt: new Date('2026-10-15T10:00:00Z'),
        creator: {
          id: 'user-1',
          name: 'Ferris',
          image: 'https://images.example.com/ferris.png',
        },
        _count: { members: 42 },
        seasons: [{ _count: { lessons: 10 } }],
      },
      {
        id: 'cohort-real-2',
        title: 'Go Microservices',
        subtitle: null,
        description: 'Scale cleanly',
        coverImage: null,
        difficulty: 'BEGINNER',
        visibility: 'PUBLIC',
        categories: [],
        estimatedCompletionTime: null,
        publishedAt: null,
        creator: null,
        _count: { members: 1 },
        seasons: [],
      },
    ];

    hoisted.findMany.mockResolvedValue(publishedDbCohorts);

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=300');

    expect(hoisted.findMany).toHaveBeenCalledWith({
      where: {
        isPublished: true,
        visibility: 'PUBLIC',
      },
      take: 12,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        subtitle: true,
        description: true,
        estimatedCompletionTime: true,
        coverImage: true,
        publishedAt: true,
        creator: { select: { id: true, name: true, image: true } },
        _count: { select: { members: true } },
      },
    });

    const data = await response.json();

    // Verify trendingSideQuests has DB cohorts first
    expect(data.trendingSideQuests).toHaveLength(3); // 2 DB + 1 Mock
    expect(data.trendingSideQuests[0].id).toBe('cohort-real-1');
    expect(data.trendingSideQuests[0].cohortId).toBe('cohort-real-1');
    expect(data.trendingSideQuests[0].title).toBe('Real Rust Cohort');
    expect(data.trendingSideQuests[0].subtitle).toBe('Build high performance apps');
    expect(data.trendingSideQuests[0].dailyGoal).toBe('30 min/day');
    expect(data.trendingSideQuests[0].thumbnail).toBe('https://images.example.com/rust.png');
    expect(data.trendingSideQuests[0].participantCount).toBe('42 participants');
    expect(data.trendingSideQuests[0].featuredParticipants).toEqual([
      { id: 'user-1', image: 'https://images.example.com/ferris.png', alt: 'Ferris' },
    ]);

    // Cohort 2 fallback defaults
    expect(data.trendingSideQuests[1].id).toBe('cohort-real-2');
    expect(data.trendingSideQuests[1].subtitle).toBe('Scale cleanly');
    expect(data.trendingSideQuests[1].dailyGoal).toBe('20 min/day');
    expect(data.trendingSideQuests[1].participantCount).toBe('1 participant');
    expect(data.trendingSideQuests[1].thumbnail).toBe('/mock/thumbnails/deep-work.webp');
    expect(data.trendingSideQuests[1].featuredParticipants).toEqual([]);

    // Mock item appended
    expect(data.trendingSideQuests[2].id).toBe('mock-quest-1');

    // Verify recentlyPublished
    expect(data.recentlyPublished).toHaveLength(3);
    expect(data.recentlyPublished[0].id).toBe('cohort-real-1');
    expect(data.recentlyPublished[0].author).toBe('Ferris');
    expect(data.recentlyPublished[0].learnerCount).toBe('42 learners');

    expect(data.recentlyPublished[1].id).toBe('cohort-real-2');
    expect(data.recentlyPublished[1].author).toBe('SideQuest Guide');
    expect(data.recentlyPublished[1].learnerCount).toBe('1 learner');
    expect(data.recentlyPublished[1].publishedLabel).toBe('Recently published');

    // Verify trendingQuests alias
    expect(data.trendingQuests).toEqual(data.trendingSideQuests);
  });

  it('returns baseMock directly if database has zero published public cohorts', async () => {
    hoisted.findMany.mockResolvedValue([]);

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=300');

    const data = await response.json();
    expect(data).toEqual(sampleMockData);
  });

  it('falls back safely to baseMock if database query rejects or throws error', async () => {
    hoisted.findMany.mockRejectedValue(new Error('PostgreSQL connection timeout'));

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBeNull();

    const data = await response.json();
    expect(data).toEqual(sampleMockData);
  });
});
