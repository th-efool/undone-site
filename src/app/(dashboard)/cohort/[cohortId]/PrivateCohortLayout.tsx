import { Cohort } from '@/src/client/screens/cohort';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { notFound } from 'next/navigation';
import { getPrivateCohortContext } from './privateCohortCache';

export async function PrivateCohortLayout({
  cohortId,
  children,
}: {
  cohortId: string;
  children: React.ReactNode;
}) {
  const { isLoggedIn, isEnrolled, dbCohort } = await getPrivateCohortContext(cohortId);

  if (!dbCohort) {
    notFound();
  }

  const uiCohort = mapDbCohortToUiCohort(dbCohort);

  return (
    <Cohort cohort={uiCohort} isEnrolled={isEnrolled} isLoggedIn={isLoggedIn}>
      {children}
    </Cohort>
  );
}
