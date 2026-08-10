'use client';

import { useState } from 'react';
import { ExploreSkeleton } from '@/src/client/components/global/Skeleton';
import type { UseExploreResult } from '@/src/client/screens/dashboard/explore/hooks/useExplore';

import { ExploreHero } from './components/ExploreHero/ExploreHero';
import { ExploreSearch } from './components/ExploreSearch/ExploreSearch';
import { ExploreTopics } from './components/ExploreTopics/ExploreTopics';
import { TrendingContentCard } from './components/TrendingContentCard/TrendingContentCard';

import styles from './ExploreMobile.module.css';

interface ExploreMobileProps {
  model: UseExploreResult;
}

export function ExploreMobile({ model: explore }: ExploreMobileProps) {
  const [query, setQuery] = useState('');

  if (explore.loading) {
    return <ExploreSkeleton />;
  }

  // Filter topics based on query if needed, or filter quests.
  // We'll keep the topic filtering simple or just pass all topics if query is empty.
  const filteredTopics = explore.topics.filter((topic) =>
    !query || topic.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className={styles.mobileExplore}>
      <ExploreHero />
      <ExploreSearch query={query} onChange={setQuery} />
      <ExploreTopics topics={filteredTopics} />
      
      <section className={styles.bottomSection}>
        <TrendingContentCard />
        {/* We can map over trending quests using TrendingContentCard if desired, 
            but the reference design shows a single prominent Bottle card. 
            We'll render one for now to match the visual requirement. */}
      </section>
    </main>
  );
}
