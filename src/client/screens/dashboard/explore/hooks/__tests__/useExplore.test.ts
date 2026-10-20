/** @vitest-environment jsdom */
import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useExplore } from '../useExplore';
import type { ExploreModel } from '../../models';

const mockExploreData: ExploreModel = {
  searchSuggestions: [
    { id: '1', label: 'react' },
    { id: '2', label: 'nextjs' },
  ],
  peopleFinishing: [],
  topics: [{ id: 't1', name: 'Tech', icon: 'cpu', color: '#6366f1' }],
  trendingSideQuests: [],
  recentlyPublished: Array.from({ length: 14 }, (_, i) => ({
    id: `art-${i + 1}`,
    cohortId: `cohort-${i + 1}`,
    title: `Article ${i + 1}`,
    author: 'Author',
    thumbnail: '/cover.png',
    learnerCount: '10 learners',
    publishedLabel: 'Just now',
    bookmarked: false,
  })),
};

const mocks = vi.hoisted(() => ({
  data: null as ExploreModel | null,
  useQuery: vi.fn(),
  getExplore: vi.fn(),
  getInitialExplore: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mocks.useQuery(options),
}));

vi.mock('@/src/client/repositories/exploreRepository', () => ({
  exploreRepository: {
    getExplore: () => mocks.getExplore(),
    getInitialExplore: () => mocks.getInitialExplore(),
  },
}));

describe('useExplore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.data = mockExploreData;
    mocks.getExplore.mockResolvedValue(mockExploreData);
    mocks.getInitialExplore.mockReturnValue(mockExploreData);
    mocks.useQuery.mockImplementation(() => ({
      data: mocks.data,
      isLoading: false,
      isFetching: false,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it('configures useQuery with 5m staleTime and refetchOnWindowFocus / refetchOnMount disabled', () => {
    renderHook(() => useExplore());

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['explore'],
        staleTime: 300_000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      }),
    );
  });

  it('returns initial batch of fresh discoveries and handles pagination', async () => {
    const { result } = renderHook(() => useExplore());

    expect(result.current.freshDiscoveries).toHaveLength(6);
    expect(result.current.freshDiscoveries[0].id).toBe('art-1');
    expect(result.current.hasMoreFreshDiscoveries).toBe(true);

    await act(async () => {
      await result.current.loadMoreFreshDiscoveries();
    });

    expect(result.current.freshDiscoveries).toHaveLength(12);
    expect(result.current.hasMoreFreshDiscoveries).toBe(true);
  });
});
