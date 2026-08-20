'use client';

import { cohortRepository } from '@/src/client/repositories/cohortRepository';
import { useExperience } from '@/src/client/hooks/useExperience';
import { CohortDesktop } from './CohortDesktop';
import { CohortMobile } from '@/src/client/mobile/screens/Cohort/CohortMobile';

import type { Cohort as CohortModel } from './models';

interface CohortProps {
  cohort: CohortModel;
  isEnrolled?: boolean;
  isLoggedIn?: boolean;
  children: React.ReactNode;
}

export function Cohort({ cohort, isEnrolled = true, isLoggedIn = true, children }: CohortProps) {
  const experience = useExperience();
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
    <CohortDesktop cohort={cohort} navigationItems={navigationItems} isEnrolled={isEnrolled} isLoggedIn={isLoggedIn}>
      {children}
    </CohortDesktop>
  );
}
