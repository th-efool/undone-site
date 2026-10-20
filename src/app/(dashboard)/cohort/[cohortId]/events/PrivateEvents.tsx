import React from 'react';
import { Events } from '@/src/client/screens/cohort';
import { notFound } from 'next/navigation';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { getPrivateCohortContext } from '../privateCohortCache';

export async function PrivateEvents({ cohortId }: { cohortId: string }) {
  const { dbCohort } = await getPrivateCohortContext(cohortId);
  if (!dbCohort) {
    notFound();
  }
  const uiCohort = mapDbCohortToUiCohort(dbCohort);
  return <Events cohortId={cohortId} cohort={uiCohort} />;
}
