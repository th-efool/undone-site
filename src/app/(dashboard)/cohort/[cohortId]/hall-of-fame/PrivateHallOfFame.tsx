import React from 'react';
import { HallOfFame } from '@/src/client/screens/cohort';
import { notFound } from 'next/navigation';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { getPrivateCohortContext } from '../privateCohortCache';

export async function PrivateHallOfFame({ cohortId }: { cohortId: string }) {
  const { dbCohort } = await getPrivateCohortContext(cohortId);
  if (!dbCohort) {
    notFound();
  }
  const uiCohort = mapDbCohortToUiCohort(dbCohort);
  return <HallOfFame cohortId={cohortId} cohort={uiCohort} />;
}
