'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { HomeSkeleton } from '@/src/client/components/global/Skeleton';
import type { UseHomeResult } from '@/src/client/screens/dashboard/home/hooks/useHome';

import styles from './HomeMobile.module.css';

interface HomeMobileProps {
  model: UseHomeResult;
}

export function HomeMobile({ model: home }: HomeMobileProps) {
  const [query, setQuery] = useState('');

  if (home.loading) {
    return <HomeSkeleton />;
  }

  const activeCohorts = home.activeCohorts.filter((item) =>
    !query || item.title.toLowerCase().includes(query.toLowerCase()) || item.provider.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <main className={styles.mobileHome}>
      <header className={styles.header}>
        <h1 className={styles.greeting}>{home.hero.title || 'Welcome Back'}</h1>
        <p className={styles.subtitle}>{home.hero.subtitle || 'Ready to resume your learning quest?'}</p>
        <div className={styles.searchContainer}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={home.searchPlaceholder || 'Search active quests…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Active Quests</h2>
        <div className={styles.cardList}>
          {activeCohorts.map((cohort) => (
            <div key={cohort.id} className={styles.mobileCohortCard}>
              <div className={styles.cardTop}>
                <span className={styles.provider}>{cohort.provider}</span>
              </div>
              <h3 className={styles.cardTitle}>{cohort.title}</h3>
              <Link href={`/cohort/${cohort.id}`} className={styles.continueBtn}>
                <Play size={16} fill="currentColor" />
                <span>Continue Quest</span>
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
