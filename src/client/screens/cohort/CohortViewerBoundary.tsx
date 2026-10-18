'use client';

import React from 'react';
import { Cohort } from './Cohort';
import type { Cohort as CohortModel } from './models';
import { useCohortViewer } from './hooks/useCohortViewer';

export function CohortViewerBoundary({
  cohort,
  children,
}: {
  cohort: CohortModel;
  children: React.ReactNode;
}) {
  const { isLoggedIn, isEnrolled } = useCohortViewer(cohort.id);

  return (
    <Cohort cohort={cohort} isLoggedIn={isLoggedIn} isEnrolled={isEnrolled}>
      {children}
    </Cohort>
  );
}
