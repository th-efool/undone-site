'use client';

import { cohortRepository } from '@/src/client/repositories/cohortRepository';
import { useExperience } from '@/src/client/hooks/useExperience';
import { useCohort } from './hooks';
import { CohortDesktop } from './CohortDesktop';
import { CohortMobile } from '@/src/client/mobile/screens/Cohort/CohortMobile';

interface CohortProps {
  cohortId: string;
  children: React.ReactNode;
}

export function Cohort({ cohortId, children }: CohortProps) {
  const experience = useExperience();
  const cohort = useCohort(cohortId);
  const navigationItems = cohortRepository.navigationItems.map((item) => ({
    ...item,
    href: `/cohort/${cohort.id}/${item.id}`,
  }));

  if (experience === 'mobile') {
    return (
      <CohortMobile cohort={cohort} navigationItems={navigationItems}>
        {children}
      </CohortMobile>
    );
  }

  return (
    <CohortDesktop cohort={cohort} navigationItems={navigationItems}>
      {children}
    </CohortDesktop>
  );
}
