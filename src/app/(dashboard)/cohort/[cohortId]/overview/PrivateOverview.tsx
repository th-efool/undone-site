import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import React from 'react';
import { Overview } from '@/src/client/screens/cohort';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { notFound } from 'next/navigation';

export async function PrivateOverview({ cohortId }: { cohortId: string }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const isLoggedIn = !!session?.user;

  const [member, dbCohort] = await Promise.all([
    isLoggedIn && userId
      ? prisma.cohortMember.findUnique({
          where: {
            cohortId_userId: {
              cohortId,
              userId,
            },
          },
        })
      : Promise.resolve(null),
    prisma.cohort.findFirst({
      where: { id: cohortId, ...accessibleCohortWhere(userId) },
      include: {
        creator: true,
        seasons: {
          include: {
            lessons: true,
          },
        },
      },
    }),
  ]);

  const isEnrolled = Boolean(member);

  if (!dbCohort) {
    notFound();
  }

  const uiCohort = mapDbCohortToUiCohort(dbCohort);

  return (
    <Overview cohortId={cohortId} cohort={uiCohort} isEnrolled={isEnrolled} isLoggedIn={isLoggedIn} />
  );
}
