import { cache } from 'react';
import type { Prisma } from '@/generated/prisma/client';
import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

const cohortSelect = {
  id: true,
  title: true,
  subtitle: true,
  description: true,
  coverImage: true,
  difficulty: true,
  categories: true,
  tags: true,
  learningOutcomes: true,
  requirements: true,
  estimatedCompletionTime: true,
  language: true,
  primaryTopic: true,
  publishedAt: true,
  updatedAt: true,
  creationSettings: true,
  _count: {
    select: {
      members: true,
    },
  },
  creator: {
    select: {
      id: true,
      name: true,
      image: true,
      role: true,
      bio: true,
    },
  },
  seasons: {
    orderBy: { order: 'asc' },
    select: {
      id: true,
      title: true,
      order: true,
      lessons: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          duration: true,
          order: true,
          lessonType: true,
          thumbnailUrl: true,
          videoId: true,
          videoUrl: true,
          sourceUrl: true,
          chunks: true,
          isPublished: true,
        },
      },
    },
  },
} satisfies Prisma.CohortSelect;

export const getPrivateCohortContext = cache(async (cohortId: string) => {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const isLoggedIn = !!session?.user;

  if (isLoggedIn && userId) {
    const [member, dbCohort] = await prisma.$transaction([
      prisma.cohortMember.findUnique({
        where: {
          cohortId_userId: {
            cohortId,
            userId,
          },
        },
        // Restrict to primary key scalar projection; CohortMember uses compound key @@id([cohortId, userId])
        select: { cohortId: true },
      }),
      prisma.cohort.findFirst({
        where: { id: cohortId, ...accessibleCohortWhere(userId) },
        select: cohortSelect,
      }),
    ]);

    return {
      userId,
      isLoggedIn,
      isEnrolled: Boolean(member),
      dbCohort,
    };
  }

  const dbCohort = await prisma.cohort.findFirst({
    where: { id: cohortId, ...accessibleCohortWhere(userId) },
    select: cohortSelect,
  });

  return {
    userId,
    isLoggedIn,
    isEnrolled: false,
    dbCohort,
  };
});
