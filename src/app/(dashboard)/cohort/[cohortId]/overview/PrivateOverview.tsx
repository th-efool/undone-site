import React from 'react';
import { Overview } from '@/src/client/screens/cohort';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { notFound } from 'next/navigation';
import { getPrivateCohortContext } from '../privateCohortCache';

export async function PrivateOverview({ cohortId }: { cohortId: string }) {
  const { isLoggedIn, isEnrolled, dbCohort } = await getPrivateCohortContext(cohortId);

  if (!dbCohort) {
    notFound();
  }

  const uiCohort = mapDbCohortToUiCohort(dbCohort);

  return (
    <Overview cohortId={cohortId} cohort={uiCohort} isEnrolled={isEnrolled} isLoggedIn={isLoggedIn} />
  );
}
