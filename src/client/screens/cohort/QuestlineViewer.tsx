'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { Cohort } from './models';

const Questline = dynamic(() => import('@/src/client/screens/cohort').then((mod) => mod.Questline));

export function QuestlineViewer({
  cohortId,
  cohort,
}: {
  cohortId: string;
  cohort: Cohort;
}) {
  return <Questline cohortId={cohortId} cohort={cohort} />;
}
