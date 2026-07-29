import Link from 'next/link';
import { ArrowLeft, MessageCircle } from 'lucide-react';

import { SearchBar } from '@/src/client/components/global/SearchBar';

import type { Cohort, NavigationItem } from '../../models';
import { CohortHero } from '../CohortHero/CohortHero';
import { CohortNavigation } from '../CohortNavigation/CohortNavigation';

import styles from './CohortLayout.module.css';

interface CohortLayoutProps {
  cohort: Cohort;
  navigationItems: NavigationItem[];
  children: React.ReactNode;
}

export function CohortLayout({ cohort, navigationItems, children }: CohortLayoutProps) {
  return (
    <main className={styles.layout}>
      <div className={styles.topBar}>
        <Link
          href="/cohort"
          className={styles.pillButton}
        >
          <ArrowLeft size={17} />
          <span>My Cohorts</span>
        </Link>

        <SearchBar className={styles.searchBar} />

        <Link
          href={`/message?community=${cohort.id}`}
          className={styles.pillButton}
        >
          <MessageCircle size={17} />
          <span>Community</span>
        </Link>
      </div>

      <CohortHero cohort={cohort} />
      <CohortNavigation items={navigationItems} />
      <section className={styles.content}>{children}</section>
    </main>
  );
}
