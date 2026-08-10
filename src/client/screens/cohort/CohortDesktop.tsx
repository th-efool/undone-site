'use client';

import type { Cohort as CohortType } from './models';
import { CohortLayout } from './components/CohortLayout/CohortLayout';
import styles from './Cohort.module.css';

interface CohortDesktopProps {
  cohort: CohortType;
  navigationItems: Array<{ id: string; label: string; href: string }>;
  children: React.ReactNode;
}

export function CohortDesktop({ cohort, navigationItems, children }: CohortDesktopProps) {
  return (
    <div className={styles.cohort}>
      <CohortLayout
        cohort={cohort}
        navigationItems={navigationItems}
      >
        {children}
      </CohortLayout>
    </div>
  );
}
