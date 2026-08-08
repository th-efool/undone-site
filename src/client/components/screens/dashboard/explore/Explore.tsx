'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader } from 'lucide-react';
import { SearchBar } from '@/src/client/components/global/SearchBar';
import { ExploreSkeleton } from '@/src/client/components/global/Skeleton';
import { EmptyState } from '@/src/client/components/global/EmptyState';

import { ExploreHero } from './components/ExploreHero/ExploreHero';
import { CloudBed } from './components/CloudBed/CloudBed';
import { BrowseTopics } from './components/BrowseTopics/BrowseTopics';
import { PeopleFinishing } from './components/PeopleFinishing/PeopleFinishing';
import { RecentlyPublished } from './components/RecentlyPublished/RecentlyPublished';
import { TrendingSideQuests } from './components/TrendingSideQuests/TrendingSideQuests';

import { useExplore } from './hooks/useExplore';

import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { getRouteTheme } from '@/src/client/config/routeThemeConfig';

import styles from './Explore.module.css';

export function Explore() {
  const pathname = usePathname();
  const isDark = getRouteTheme(pathname) === 'dark';
  const explore = useExplore();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const matches = useCallback(
    (values: string[]) =>
      !debouncedQuery || values.some((value) => value.toLowerCase().includes(debouncedQuery)),
    [debouncedQuery],
  );
  // Task 2.8 #45: Limit People Finishing to max 6 cards
  const peopleFinishing = useMemo(
    () =>
      explore.peopleFinishing
         .filter((item) =>
          matches([item.title, item.provider, item.learnerCount]),
        )
        .slice(0, 6),
    [explore.peopleFinishing, matches],
  );
  const topics = useMemo(
    () => explore.topics.filter((item) => matches([item.name])),
    [explore.topics, matches],
  );
  // Task 2.8 #45: Limit Trending SideQuests to max 8 cards
  const trendingSideQuests = useMemo(
    () =>
      explore.trendingSideQuests
        .filter((item) =>
          matches([item.title, item.subtitle, item.dailyGoal]),
        )
        .slice(0, 8),
    [explore.trendingSideQuests, matches],
  );
  // Task 2.8 #45: Limit Recently Published to max 5 articles
  const freshDiscoveries = useMemo(
    () =>
      explore.freshDiscoveries.filter((item) =>
        matches([item.title, item.author, item.learnerCount]),
      ),
    [explore.freshDiscoveries, matches],
  );
  const hasResults =
    peopleFinishing.length + topics.length + trendingSideQuests.length + freshDiscoveries.length >
    0;

  if (explore.loading) {
    return <ExploreSkeleton />;
  }

  return (
    <main className={clsx(styles.explore, isDark && styles.darkTheme)}>
      <div className={styles.topControlBar}>
        <SearchBar
          className={styles.searchBar}
          value={query}
          onChange={setQuery}
        />
        <Link href="/create-cohort" className={styles.buildCohortBtn}>
          <span className={styles.btnLabel}>BUILD A COHORT</span>
          <span className={styles.iconCircle}>
            <Loader size={18} strokeWidth={2.5} />
          </span>
        </Link>
      </div>

      <ExploreHero />
      <CloudBed />

      {debouncedQuery && !hasResults && (
        <EmptyState
          query={query}
          title={`No results for "${query}"`}
          description="Try a different search term or browse our most popular SideQuests."
          ctaLabel="Browse all SideQuests"
          ctaHref="/explore"
        />
      )}

      <PeopleFinishing items={trendingSideQuests} />
      <BrowseTopics items={topics} />
      <TrendingSideQuests items={peopleFinishing} />
      <RecentlyPublished
        items={freshDiscoveries}
        onLoadMore={explore.loadMoreFreshDiscoveries}
        hasMore={explore.hasMoreFreshDiscoveries}
        isLoadingMore={explore.isLoadingMoreFreshDiscoveries}
      />
    </main>
  );
}
