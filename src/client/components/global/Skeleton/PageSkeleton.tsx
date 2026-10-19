'use client';

import { usePathname } from 'next/navigation';
import { getRouteTheme } from '@/src/client/config/routeThemeConfig';
import { Skeleton } from './Skeleton';
import styles from './PageSkeleton.module.css';

import homeStyles from '@/src/client/screens/dashboard/home/Home.module.css';

/**
 * Home page skeleton — mirrors HomeDesktop 2-column grid to eliminate layout shift.
 */
export function HomeSkeleton() {
  return (
    <div className={homeStyles.home}>
      <div className={homeStyles.pageGrid}>
        <main className={homeStyles.leftCol}>
          {/* Hero greeting skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
            <Skeleton className="h-8 w-64 rounded-lg" />
            <Skeleton className="h-4 w-96 rounded-md" />
          </div>

          {/* Prompt bar skeleton */}
          <Skeleton className="h-14 w-full rounded-2xl" />

          {/* Channel hub capsules */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden', padding: '4px 0' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-full flex-shrink-0" />
            ))}
          </div>

          {/* Active cohorts section header & table rows */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <Skeleton className="h-6 w-48 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-xl" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>

          {/* Study rooms skeleton */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <Skeleton className="h-6 w-40 rounded-md" />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-1/2 rounded-2xl" />
            ))}
          </div>
        </main>

        <aside className={homeStyles.rightRail}>
          {/* Upcoming events / Calendar widget */}
          <Skeleton className="h-64 w-full rounded-2xl" />
          {/* Streak widget */}
          <Skeleton className="h-48 w-full rounded-2xl" />
        </aside>
      </div>
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
