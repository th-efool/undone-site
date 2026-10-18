import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import React from 'react';
import dynamic from 'next/dynamic';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { mapDbCohortToUiCohort } from '@/src/server/infrastructure/db/postgres/mappers/cohortMapper';
import { notFound } from 'next/navigation';

const Overview = dynamic(() => import('@/src/client/screens/cohort').then((mod) => mod.Overview));

export async function PrivateOverview({ cohortId }: { cohortId: string }) {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  let isEnrolled = false;
  if (isLoggedIn && session?.user?.id) {
    const member = await prisma.cohortMember.findUnique({
      where: {
        cohortId_userId: {
          cohortId,
          userId: session.user.id,
        },
      },
    });
    if (member) {
      isEnrolled = true;
    }
  }

  const dbCohort = await prisma.cohort.findFirst({
    where: { id: cohortId, ...accessibleCohortWhere((await auth())?.user?.id ?? null) },
    include: {
      creator: true,
      seasons: {
        include: {
          lessons: true,
        },
      },
    },
  });

  if (!dbCohort) {
    notFound();
  }

  const uiCohort = mapDbCohortToUiCohort(dbCohort);

  return (
    <Overview cohortId={cohortId} cohort={uiCohort} isEnrolled={isEnrolled} isLoggedIn={isLoggedIn} />
  );
}
