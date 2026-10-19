// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ExploreLoading from '../loading';
import { ExploreMobile } from '@/src/client/mobile/screens/Explore/ExploreMobile';
import { RecentlyPublished } from '@/src/client/screens/dashboard/explore/components/RecentlyPublished/RecentlyPublished';

// Mock next-auth and session safely
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'test-user', name: 'Tester' } },
    status: 'authenticated',
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      searchSuggestions: [],
      peopleFinishing: [],
      topics: [
        { id: '1', name: 'Design', icon: 'design', color: '#ec4899' },
        { id: '2', name: 'Engineering', icon: 'code', color: '#6366f1' },
      ],
      trendingSideQuests: [],
      recentlyPublished: [],
    },
    isLoading: true,
    isFetching: true,
  }),
}));

vi.mock('@/src/client/components/global/CommandPalette/CommandTrigger', () => ({
  useCommandContext: () => ({
    openCommand: vi.fn(),
    closeCommand: vi.fn(),
    toggleCommand: vi.fn(),
    isOpen: false,
  }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/explore',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('Explore Route Loading Boundary (Issue 3)', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the real Explore page composition during loading instead of an obsolete skeleton layout', () => {
    const { container } = render(<ExploreLoading />);

    // Real Explore components must be present
    expect(screen.getByRole('main')).toBeDefined();
    expect(screen.getByPlaceholderText(/search/i)).toBeDefined();
    expect(screen.getByText(/build a cohort/i)).toBeDefined();

    // Must NOT contain obsolete ExploreSkeleton mock elements
    expect(container.querySelector('[class*="darkSkeletonContainer"]')).toBeNull();
    expect(container.querySelector('[class*="skeletonContainer"]')).toBeNull();
    expect(container.querySelector('[class*="greetingBar"]')).toBeNull();

    // Must NOT contain any shimmer elements
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
  });

  it('renders real mobile Explore shell when loading without skeleton or shimmer', () => {
    const { container } = render(
      <ExploreMobile
        model={{
          searchSuggestions: [],
          peopleFinishing: [],
          topics: [],
          trendingSideQuests: [],
          recentlyPublished: [],
          freshDiscoveries: [],
          trendingQuests: [],
          loadMoreFreshDiscoveries: async () => {},
          hasMoreFreshDiscoveries: false,
          isLoadingMoreFreshDiscoveries: false,
          loading: true,
        }}
      />
    );

    expect(screen.getByRole('main')).toBeDefined();
    expect(screen.getByRole('heading', { name: /explore by topic/i })).toBeDefined();

    // Zero skeleton containers or shimmer elements
    expect(container.querySelectorAll('[class*="skeleton"]').length).toBe(0);
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
  });

  it('renders a restrained pagination spinner in RecentlyPublished during pagination with zero shimmer', () => {
    const { container } = render(
      <RecentlyPublished
        items={[
          {
            id: 'art-1',
            cohortId: 'cohort-1',
            title: 'Sample Article',
            author: 'Jane Doe',
            publishedLabel: 'Yesterday',
            learnerCount: '10 learners',
            thumbnail: '/test.png',
            bookmarked: false,
          },
        ]}
        isLoadingMore={true}
      />
    );

    const loader = screen.getByRole('status', { name: /loading more discoveries/i });
    expect(loader).toBeDefined();
    expect(container.querySelector('[class*="paginationSpinner"]')).toBeTruthy();

    // Must NOT contain any obsolete skeleton cards or shimmer animations
    expect(container.querySelector('[class*="skeletonCard"]')).toBeNull();
    expect(container.querySelector('[class*="skeletonImage"]')).toBeNull();
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
  });
});
