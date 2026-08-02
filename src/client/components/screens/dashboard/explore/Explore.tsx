'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SearchBar } from '@/src/client/components/global/SearchBar';
import { ExploreSkeleton } from '@/src/client/components/global/Skeleton';
import { EmptyState } from '@/src/client/components/global/EmptyState';

import { ExploreHero } from './components/ExploreHero/ExploreHero';
import { BrowseTopics } from './components/BrowseTopics/BrowseTopics';
import { PeopleFinishing } from './components/PeopleFinishing/PeopleFinishing';
import { RecentlyPublished } from './components/RecentlyPublished/RecentlyPublished';
import { TrendingSideQuests } from './components/TrendingSideQuests/TrendingSideQuests';

import { useExplore } from './hooks/useExplore';

import styles from './Explore.module.css';

export function Explore() {
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
  const peopleFinishing = useMemo(
    () =>
      explore.peopleFinishing.filter((item) =>
        matches([item.title, item.provider, item.learnerCount]),
      ),
    [explore.peopleFinishing, matches],
  );
  const topics = useMemo(
    () => explore.topics.filter((item) => matches([item.name])),
    [explore.topics, matches],
  );
  const trendingSideQuests = useMemo(
    () =>
      explore.trendingSideQuests.filter((item) =>
        matches([item.title, item.subtitle, item.dailyGoal]),
      ),
    [explore.trendingSideQuests, matches],
  );
  const recentlyPublished = useMemo(
    () =>
      explore.recentlyPublished.filter((item) =>
        matches([item.title, item.author, item.learnerCount]),
      ),
    [explore.recentlyPublished, matches],
  );
  const hasResults =
    peopleFinishing.length + topics.length + trendingSideQuests.length + recentlyPublished.length >
    0;

  if (explore.loading) {
    return <ExploreSkeleton />;
  }

  return (
    <main className={styles.explore}>
      <SearchBar
        className={styles.searchBar}
        value={query}
        onChange={setQuery}
      />

      <ExploreHero />

      {debouncedQuery && !hasResults && (
        <EmptyState
          query={query}
          title={`No results for "${query}"`}
          description="Try a different search term or browse our most popular SideQuests."
          ctaLabel="Browse all SideQuests"
          ctaHref="/explore"
        />
      )}

      <PeopleFinishing items={peopleFinishing} />
      <BrowseTopics items={topics} />
      <TrendingSideQuests items={trendingSideQuests} />
      <RecentlyPublished items={recentlyPublished} />
    </main>
  );
}
