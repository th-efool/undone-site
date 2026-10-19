// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { TrendingContentCard } from '../components/TrendingContentCard/TrendingContentCard';
import { ExploreMobile } from '../ExploreMobile';
import type { UseExploreResult } from '@/src/client/screens/dashboard/explore/hooks/useExplore';

describe('TrendingContentCard component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders default static bottle content when no item is passed', () => {
    render(<TrendingContentCard />);

    expect(screen.getByText(/Your Content/i)).toBeTruthy();
    expect(screen.getByText(/Consumption detox/i)).toBeTruthy();
    expect(screen.getByText('trending')).toBeTruthy();
    expect(screen.getByText('want to try')).toBeTruthy();
  });

  it('renders dynamic title, description, and link when item is provided', () => {
    render(
      <TrendingContentCard
        item={{
          id: 'test-quest-123',
          cohortId: 'test-quest-123',
          title: 'Dynamic Quest Title',
          subtitle: 'A mindful journey into algorithms',
          dailyGoal: '25 min/day',
          thumbnail: '/images/rust.png',
          participantCount: '48 learners',
        }}
        showPullTab={false}
      />,
    );

    expect(screen.getByText('Dynamic Quest Title')).toBeTruthy();
    expect(screen.getByText('A mindful journey into algorithms')).toBeTruthy();
    expect(screen.getByText('25 min/day')).toBeTruthy();
    expect(screen.getByText(/View Quest/i)).toBeTruthy();

    const link = screen.getByRole('link', { name: /view quest/i });
    expect(link.getAttribute('href')).toBe('/cohort/test-quest-123');
  });
});

describe('ExploreMobile screen', () => {
  afterEach(() => {
    cleanup();
  });

  const baseMockModel: UseExploreResult = {
    searchSuggestions: [],
    peopleFinishing: [],
    topics: [
      { id: '1', name: 'Design', icon: 'design', color: '#ec4899' },
      { id: '2', name: 'Engineering', icon: 'code', color: '#6366f1' },
    ],
    trendingSideQuests: [
      {
        id: 'quest-1',
        cohortId: 'quest-1',
        title: 'Mastering TypeScript',
        subtitle: 'Type safety from scratch',
        dailyGoal: '15 min/day',
        thumbnail: '/images/ts.png',
        featuredParticipants: [],
        participantCount: '150 participants',
      },
    ],
    trendingQuests: [
      {
        id: 'quest-1',
        cohortId: 'quest-1',
        title: 'Mastering TypeScript',
        subtitle: 'Type safety from scratch',
        dailyGoal: '15 min/day',
        thumbnail: '/images/ts.png',
        featuredParticipants: [],
        participantCount: '150 participants',
      },
    ],
    recentlyPublished: [
      {
        id: 'article-1',
        cohortId: 'cohort-art-1',
        title: 'Architecture of Distributed Systems',
        author: 'Staff Guide',
        thumbnail: '/images/arch.png',
        learnerCount: '75 learners',
        publishedLabel: '2 days ago',
        bookmarked: false,
      },
    ],
    freshDiscoveries: [
      {
        id: 'article-1',
        cohortId: 'cohort-art-1',
        title: 'Architecture of Distributed Systems',
        author: 'Staff Guide',
        thumbnail: '/images/arch.png',
        learnerCount: '75 learners',
        publishedLabel: '2 days ago',
        bookmarked: false,
      },
    ],
    loadMoreFreshDiscoveries: async () => {},
    hasMoreFreshDiscoveries: false,
    isLoadingMoreFreshDiscoveries: false,
    loading: false,
  };

  it('renders real mobile explore shell without skeleton or shimmer when explore.loading is true', () => {
    const loadingModel: UseExploreResult = {
      ...baseMockModel,
      loading: true,
    };

    const { container } = render(<ExploreMobile model={loadingModel} />);
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /explore by topic/i })).toBeTruthy();
    expect(container.querySelectorAll('[class*="skeleton"]').length).toBe(0);
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
  });

  it('renders dynamic trending quests and fresh discoveries', () => {
    render(<ExploreMobile model={baseMockModel} />);

    expect(screen.getByText('Mastering TypeScript')).toBeTruthy();
    expect(screen.getByText('Fresh Discoveries')).toBeTruthy();
    expect(screen.getByText('Architecture of Distributed Systems')).toBeTruthy();
    expect(screen.getByText('By Staff Guide')).toBeTruthy();
  });

  it('falls back to default bottle card if trendingQuests is empty', () => {
    const emptyTrendingModel: UseExploreResult = {
      ...baseMockModel,
      trendingQuests: [],
      trendingSideQuests: [],
      freshDiscoveries: [],
      recentlyPublished: [],
    };

    render(<ExploreMobile model={emptyTrendingModel} />);
    expect(screen.getByText(/Your Content/i)).toBeTruthy();
  });
});
