'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { NavigationItem } from '../../models';

import styles from './CohortNavigation.module.css';

interface CohortNavigationProps {
  items: NavigationItem[];
}

export function CohortNavigation({ items }: CohortNavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      className={styles.navigation}
      aria-label="Cohort navigation"
    >
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`${styles.link} ${pathname === item.href ? styles.active : ''}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
