'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { UseExploreResult } from '@/src/client/screens/dashboard/explore/hooks/useExplore';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';

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

  const trimmedQuery = query.trim().toLowerCase();

  const filteredTopics = useMemo(() => {
    return (explore.topics ?? []).filter(
      (topic) => !trimmedQuery || topic.name.toLowerCase().includes(trimmedQuery),
    );
  }, [explore.topics, trimmedQuery]);

  const allTrending = useMemo(() => {
    const list =
      explore.trendingQuests && explore.trendingQuests.length > 0
        ? explore.trendingQuests
        : explore.trendingSideQuests ?? [];
    return list.filter(
      (quest) =>
        !trimmedQuery ||
        quest.title.toLowerCase().includes(trimmedQuery) ||
        (quest.subtitle && quest.subtitle.toLowerCase().includes(trimmedQuery)),
    );
  }, [explore.trendingQuests, explore.trendingSideQuests, trimmedQuery]);

  const recentDiscoveries = useMemo(() => {
    const articles =
      explore.freshDiscoveries && explore.freshDiscoveries.length > 0
        ? explore.freshDiscoveries
        : explore.recentlyPublished ?? [];
    return articles.filter(
      (article) =>
        !trimmedQuery ||
        article.title.toLowerCase().includes(trimmedQuery) ||
        article.author.toLowerCase().includes(trimmedQuery),
    );
  }, [explore.freshDiscoveries, explore.recentlyPublished, trimmedQuery]);

  return (
    <main className={styles.mobileExplore}>
      <ExploreHero />
      <ExploreSearch query={query} onChange={setQuery} />
      <ExploreTopics topics={filteredTopics} />

      <section className={styles.bottomSection}>
        {allTrending.length > 0 ? (
          allTrending.map((quest, index) => (
            <TrendingContentCard
              key={quest.id}
              item={quest}
              showPullTab={index === 0}
            />
          ))
        ) : (
          <TrendingContentCard />
        )}

        {recentDiscoveries.length > 0 && (
          <div className={styles.recentlyPublishedSection}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Fresh Discoveries</h3>
              <span className={styles.sectionSubtitle}>Recently published</span>
            </div>
            <div className={styles.horizontalScroll}>
              {recentDiscoveries.map((article) => (
                <Link
                  key={article.id}
                  href={getCohortHref(article.cohortId ?? article.id)}
                  className={styles.articleCard}
                >
                  <div className={styles.articleThumbnailWrap}>
                    <Image
                      src={article.thumbnail || '/mock/thumbnails/deep-work.webp'}
                      alt={article.title}
                      fill
                      className={styles.articleThumbnail}
                      sizes="160px"
                      unoptimized
                    />
                  </div>
                  <div className={styles.articleInfo}>
                    <h4 className={styles.articleTitle} title={article.title}>
                      {article.title}
                    </h4>
                    <p className={styles.articleAuthor}>By {article.author}</p>
                    <span className={styles.articleLearners}>{article.learnerCount}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
