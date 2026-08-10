'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Cohort as CohortType } from '@/src/client/screens/cohort/models';
import styles from './CohortMobile.module.css';

interface CohortMobileProps {
  cohort: CohortType;
  navigationItems: Array<{ id: string; label: string; href: string }>;
  children: React.ReactNode;
}

export function CohortMobile({ cohort, navigationItems, children }: CohortMobileProps) {
  const pathname = usePathname();

  return (
    <main className={styles.mobileCohort}>
      <header className={styles.header}>
        <span className={styles.provider}>{cohort.creator?.name}</span>
        <h1 className={styles.title}>{cohort.title}</h1>
      </header>

      <nav className={styles.navTabs}>
        {navigationItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`${styles.tabLink} ${isActive ? styles.tabLinkActive : ''}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.content}>{children}</div>
    </main>
  );
}
