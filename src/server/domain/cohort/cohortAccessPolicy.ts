import 'server-only';
import type { Prisma } from '@/generated/prisma/client';

type CohortAccess = { creatorId: string; visibility: 'PUBLIC' | 'PRIVATE'; isPublished: boolean };

/** Unpublished legacy previews stay creator-only; membership never exposes staging. */
export function canReadCohort(cohort: CohortAccess, userId: string | null, member = false): boolean {
  if (userId && cohort.creatorId === userId) return true;
  return cohort.isPublished && (cohort.visibility === 'PUBLIC' || !!userId && member);
}

/** Apply inside the database query, before fetching lessons, metadata or community data. */
export function accessibleCohortWhere(userId: string | null): Prisma.CohortWhereInput {
  const publicCohort = { isPublished: true, visibility: 'PUBLIC' as const };
  return userId ? { OR: [publicCohort, { creatorId: userId },
    { isPublished: true, visibility: 'PRIVATE', members: { some: { userId } } }] } : publicCohort;
}
