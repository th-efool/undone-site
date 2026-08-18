import Image from 'next/image';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { SearchBar } from '@/src/client/components/global/SearchBar';
import { Tooltip } from '@/src/client/components/ui/Tooltip';

import type { HomeHeroContent } from '../../models';

import styles from './HomeHero.module.css';

export interface HomeHeroProps {
  content: HomeHeroContent;
  summaries?: any[];
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  weeklyMinutes?: number;
  activeDays?: number;
  pace?: number;
  onPaceClick?: () => void;
}

export function HomeHero({
  content,
  summaries = [],
  searchValue = '',
  searchPlaceholder,
  onSearchChange,
  weeklyMinutes = 0,
  activeDays = 0,
  pace = 20,
  onPaceClick,
}: HomeHeroProps) {
  const streak = summaries.find(s => s.id === 'current-streak');
  const todayGoal = summaries.find(s => s.id === 'today-goal');

  const fmtTime = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h ${min}m` : `${m}m`;
  };

  return (
    <header className={styles.hero}>
      <Image src="/images/home/home-hero.webp" alt="Hero background" className={styles.heroBg}  width={400} height={300}/>
      
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
          <Tooltip content="Create a new learning cohort" placement="bottom">
            <Link href="/create-cohort" className={styles.newButton} aria-label="Create a new learning cohort">
              <Plus size={18} strokeWidth={2.4} />
              New Cohort
            </Link>
          </Tooltip>

          {streak && (
            <Tooltip content="Current streak: Consecutive days active" placement="top">
              <div className={styles.statBadge}>
                <div className={styles.statBadgeTop}>
                  <span className={styles.statIconOrange}>{streak.icon}</span>
                  <span className={styles.statValue}>{streak.value.split(' ')[0]}</span>
                </div>
                <span className={styles.statLabel}>Streak</span>
              </div>
            </Tooltip>
          )}

          {todayGoal && (
            <Tooltip content="Today's Goal: Daily target progress" placement="top">
              <div className={styles.statBadge}>
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
            </Tooltip>
          )}

          {/* Separator */}
          <div className={styles.statDivider} />

          {/* This Week */}
          {weeklyMinutes > 0 && (
            <Tooltip content="This week's total learning time" placement="top">
              <div className={styles.statBadge}>
                <div className={styles.statBadgeTop}>
                  <span className={styles.statValue}>{fmtTime(weeklyMinutes)}</span>
                </div>
                <span className={styles.statLabel}>This Week</span>
              </div>
            </Tooltip>
          )}

          {/* Active days */}
          {activeDays > 0 && (
            <Tooltip content="Days active this week" placement="top">
              <div className={styles.statBadge}>
                <div className={styles.statBadgeTop}>
                  <span className={styles.statValue}>{activeDays}d</span>
                </div>
                <span className={styles.statLabel}>Active</span>
              </div>
            </Tooltip>
          )}

          {/* Pace */}
          <Tooltip content="Your daily learning pace — click to change" placement="top">
            <button className={`${styles.statBadge} ${styles.paceBtn}`} onClick={onPaceClick}>
              <div className={styles.statBadgeTop}>
                <span className={styles.statValue}>{pace} min</span>
              </div>
              <span className={styles.statLabel}>Pace / day</span>
            </button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}

