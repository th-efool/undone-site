import { cache } from 'react';
import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export const getPrivateCohortContext = cache(async (cohortId: string) => {
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

  return {
    userId,
    isLoggedIn,
    isEnrolled: Boolean(member),
    dbCohort,
  };
});
