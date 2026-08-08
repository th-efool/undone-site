'use client';

import { usePathname } from 'next/navigation';
import { getRouteTheme } from '@/src/client/config/routeThemeConfig';
import { Skeleton } from './Skeleton';
import styles from './PageSkeleton.module.css';

/**
 * Home page skeleton — greeting bar, 4 summary cards, cohort rows.
 */
export function HomeSkeleton() {
  const pathname = usePathname();
  const isDark = getRouteTheme(pathname) === 'dark';
  const containerClass = isDark ? styles.darkSkeletonContainer : styles.skeletonContainer;

  return (
    <div className={containerClass}>
      {/* Greeting bar */}
      <div className={styles.greetingBar}>
        <Skeleton className="h-8 w-56 rounded-lg" />
      </div>

      {/* Summary cards */}
      <div className={styles.cardGrid}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.summaryCard}>
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-6 w-32 rounded-md mt-2" />
            {i === 1 && <Skeleton className="h-8 w-full rounded-md mt-3" />}
          </div>
        ))}
      </div>

      {/* Cohort rows */}
      <div className={styles.cohortRows}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl mb-3" />
        ))}
      </div>

      {/* Continue Later */}
      <Skeleton className="h-6 w-40 rounded-md mb-2" />
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl mb-3" />
      ))}
    </div>
  );
}

/**
 * Explore page skeleton — hero bar, section headers + card grids.
 */
export function ExploreSkeleton() {
  const pathname = usePathname();
  const isDark = getRouteTheme(pathname) === 'dark' || true;
  const containerClass = isDark ? styles.darkSkeletonContainer : styles.skeletonContainer;

  return (
    <div className={containerClass}>
      {/* Search bar */}
      <Skeleton className="h-10 w-full rounded-xl mb-4" />

      {/* Hero greeting */}
      <div className={styles.greetingBar}>
        <Skeleton className="h-8 w-52 rounded-lg" />
      </div>

      {/* People Finishing section */}
      <Skeleton className="h-6 w-48 rounded-md mb-3 mt-6" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl mb-3" />
      ))}

      {/* Browse Topics section */}
      <Skeleton className="h-6 w-40 rounded-md mb-3 mt-6" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-xl mb-3" />
      ))}

      {/* Trending SideQuests section */}
      <Skeleton className="h-6 w-52 rounded-md mb-3 mt-6" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl mb-3" />
      ))}

      {/* Recently Published section */}
      <Skeleton className="h-6 w-48 rounded-md mb-3 mt-6" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl mb-3" />
      ))}
    </div>
  );
}

/**
 * Play page skeleton — video placeholder, timeline scrubber, controls.
 */
export function PlaySkeleton() {
  const pathname = usePathname();
  const isDark = getRouteTheme(pathname) === 'dark';
  const containerClass = isDark ? styles.darkSkeletonContainer : styles.skeletonContainer;

  return (
    <div className={containerClass}>
      {/* Video player area */}
      <div className={styles.videoPlaceholder}>
        <Skeleton className="h-full w-full rounded-xl" />
      </div>

      {/* Timeline scrubber bar */}
      <div className={styles.timelineBar}>
        <Skeleton className="h-2 w-full rounded-full mb-4" />
      </div>

      {/* Control buttons row */}
      <div className={styles.controlsRow}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-10 rounded-full" />
        ))}
      </div>

      {/* Lesson card preview */}
      <div className={styles.lessonCard}>
        <Skeleton className="h-6 w-48 rounded-md mb-3 mt-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg mb-2" />
        ))}
      </div>
    </div>
  );
}
