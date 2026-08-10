'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExploreSkeleton } from '@/src/client/components/global/Skeleton';
import type { UseExploreResult } from '@/src/client/screens/dashboard/explore/hooks/useExplore';

import styles from './ExploreMobile.module.css';

interface ExploreMobileProps {
  model: UseExploreResult;
}

export function ExploreMobile({ model: explore }: ExploreMobileProps) {
  const [query, setQuery] = useState('');

  if (explore.loading) {
    return <ExploreSkeleton />;
  }

  const quests = explore.trendingSideQuests.filter((item) =>
    !query || item.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className={styles.mobileExplore}>
      <header className={styles.header}>
        <h1 className={styles.title}>Explore Quests</h1>
        <input
          type="text"
          className={styles.searchBar}
          placeholder="Search topics, skills, cohorts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      <div className={styles.topicsScroll}>
        {explore.topics.map((topic) => (
          <span key={topic.id} className={styles.topicChip}>
            {topic.name}
          </span>
        ))}
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Trending Quests</h2>
        <div className={styles.questList}>
          {quests.map((item) => (
            <Link key={item.id} href="/create-cohort" className={styles.questCard}>
              <span className={styles.questProvider}>{item.dailyGoal || 'COHORT'}</span>
              <h3 className={styles.questTitle}>{item.title}</h3>
              <span className={styles.questLearners}>{item.subtitle}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
