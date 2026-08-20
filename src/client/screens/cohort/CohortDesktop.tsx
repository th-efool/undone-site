'use client';

import type { Cohort as CohortType } from './models';
import { CohortLayout } from './components/CohortLayout/CohortLayout';
import styles from './Cohort.module.css';

interface CohortDesktopProps {
  cohort: CohortType;
  navigationItems: Array<{ id: string; label: string; href: string }>;
  isEnrolled?: boolean;
  isLoggedIn?: boolean;
  children: React.ReactNode;
}

export function CohortDesktop({ cohort, navigationItems, isEnrolled = true, isLoggedIn = true, children }: CohortDesktopProps) {
  return (
    <div className={styles.cohort}>
      <CohortLayout
        cohort={cohort}
        navigationItems={navigationItems}
        isEnrolled={isEnrolled}
        isLoggedIn={isLoggedIn}
      >
        {children}
      </CohortLayout>
    </div>
  );
}
