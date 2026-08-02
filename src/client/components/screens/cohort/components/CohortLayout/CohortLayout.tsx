import Link from 'next/link';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

import { SearchBar } from '@/src/client/components/global/SearchBar';
import { isNativeApp } from '@/src/client/utils/isNative';

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
  const isApp = isNativeApp();
  const pathname = usePathname();

  // Build breadcrumb trail from the cohort path
  const breadcrumbSegments = useMemo(() => {
    // pathname looks like: /cohort/{id}/overview (or questline, events, etc.)
    const parts = pathname.split('/').filter(Boolean);
    if (parts[0] !== 'cohort') return [];
    return [
      { label: 'Home', href: '/home' },
      { label: cohort.title || 'Cohort', href: `/cohort/${parts[1]}/overview` },
    ];
  }, [pathname, cohort.title]);

  // Find active tab label from navigation items
  const activeTab = useMemo(() => {
    return navigationItems.find((item) => item.href === pathname)?.label || '';
  }, [navigationItems, pathname]);

  return (
    <main className={styles.layout}>
      {/* Breadcrumb trail — visible on desktop */}
      {breadcrumbSegments.length > 0 && (
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          {breadcrumbSegments.map((seg, i) => (
            <span key={`${seg.href}-${i}`}>
              {i > 0 && <span className={styles.separator}>›</span>}
              <Link href={seg.href}>{seg.label}</Link>
            </span>
          ))}
          {activeTab && (
            <>
              <span className={styles.separator}>›</span>
              <span className={styles.current} aria-current="page">{activeTab}</span>
            </>
          )}
        </nav>
      )}

      <div className={styles.topBar}>
        <Link
          href="/home"
          className={`${styles.pillButton} ${styles.backButton}`}
          aria-label="Back to home"
        >
          <ArrowLeft size={17} strokeWidth={2.5} />
          <span>Home</span>
        </Link>

        <SearchBar className={styles.searchBar} />

        {!isApp && (
          <Link
            href={`/message?community=${cohort.id}`}
            className={styles.pillButton}
          >
            <MessageCircle size={17} strokeWidth={2.5} />
            <span>Community</span>
          </Link>
        )}
      </div>

      <CohortHero cohort={cohort} />
      <CohortNavigation items={navigationItems} />
      <section className={styles.content}>{children}</section>
    </main>
  );
}
