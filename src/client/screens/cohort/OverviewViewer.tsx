'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { Cohort } from './models';
import { useCohortViewer } from './hooks/useCohortViewer';

const Overview = dynamic(() => import('@/src/client/screens/cohort').then((mod) => mod.Overview));

export function OverviewViewer({
  cohortId,
  cohort,
}: {
  cohortId: string;
  cohort: Cohort;
}) {
  const { isLoggedIn, isEnrolled } = useCohortViewer(cohortId);

  return (
    <Overview
      cohortId={cohortId}
      cohort={cohort}
      isEnrolled={isEnrolled}
      isLoggedIn={isLoggedIn}
    />
  );
}
