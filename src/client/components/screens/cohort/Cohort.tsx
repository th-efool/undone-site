import { cohortRepository } from '@/src/client/repositories/cohortRepository';
import { useCohort } from './hooks';
import { CohortLayout } from './components/CohortLayout/CohortLayout';

import styles from './Cohort.module.css';

interface CohortProps {
  cohortId: string;
  children: React.ReactNode;
}

export function Cohort({ cohortId, children }: CohortProps) {
  const cohort = useCohort(cohortId);
  const navigationItems = cohortRepository.navigationItems.map((item) => ({
    ...item,
    href: `/cohort/${cohort.id}/${item.id}`,
  }));

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
