import Image from 'next/image';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { SearchBar } from '@/src/client/components/global/SearchBar';

import type { HomeHeroContent } from '../../models';

import styles from './HomeHero.module.css';

export interface HomeHeroProps {
  content: HomeHeroContent;
  summaries?: any[];
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
}

export function HomeHero({
  content,
  summaries = [],
  searchValue = '',
  searchPlaceholder,
  onSearchChange,
}: HomeHeroProps) {
  const streak = summaries.find(s => s.id === 'current-streak');
  const todayGoal = summaries.find(s => s.id === 'today-goal');

  return (
    <header className={styles.hero}>
      <Image src="/images/home/home-hero.webp" alt="Hero background" className={styles.heroBg}  width={400} height={300} style={{ width: "100%", height: "auto", objectFit: "cover" }}/>
      
      <div className={styles.heroContent}>
        <div className={styles.greeting}>
          <h1 className={styles.title}>
            <span className={styles.titleMain}>Your learning,</span>
            <span className={styles.titleItalic}>in perfect flow</span>
          </h1>
          <p className={styles.subtitle}>All your cohorts. All your progress. One place.</p>
        </div>

        <div className={styles.searchWrapper}>
          <SearchBar
            className={styles.searchBar}
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Search cohorts, topics, lessons..."
          />
        </div>

        <div className={styles.heroStats}>
          <Link href="/create-cohort" className={styles.newButton}>
            <Plus size={18} strokeWidth={2.4} />
            New Cohort
          </Link>

          {streak && (
            <div className={styles.statBadge} title="Current Streak">
              <div className={styles.statBadgeTop}>
                <span className={styles.statIconOrange}>{streak.icon}</span>
                <span className={styles.statValue}>{streak.value.split(' ')[0]}</span>
              </div>
              <span className={styles.statLabel}>Streak</span>
            </div>
          )}

          {todayGoal && (
            <div className={styles.statBadge} title="Today's Goal">
              <div className={styles.statBadgeTop}>
                <div className={styles.clockProgress}>
                  <svg viewBox="0 0 36 36" className={styles.circularChart}>
                    <path className={styles.circleBg} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className={styles.circle} strokeDasharray={`${todayGoal.progress?.percent || 0}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                </div>
                <span className={styles.statValue}>{todayGoal.value}</span>
              </div>
              <span className={styles.statLabel}>Today's Goal</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
