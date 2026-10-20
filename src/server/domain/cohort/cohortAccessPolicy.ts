import 'server-only';
import type { Prisma } from '@/generated/prisma/client';

export type CohortAccess = {
  creatorId: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'INVITE_ONLY';
  isPublished: boolean;
};

/** Unpublished legacy previews stay creator-only; membership never exposes staging. */
export function canReadCohort(cohort: CohortAccess, userId: string | null, member = false): boolean {
  if (userId && cohort.creatorId === userId) return true;
  return cohort.isPublished && (cohort.visibility === 'PUBLIC' || (!!userId && member));
}

/** Apply inside database query for content discovery. Does not grant chat access. */
export function accessibleCohortWhere(userId: string | null): Prisma.CohortWhereInput {
  const publicCohort = { isPublished: true, visibility: 'PUBLIC' as const };
  return userId
    ? {
        OR: [
          publicCohort,
          { creatorId: userId },
          {
            isPublished: true,
            visibility: { in: ['PRIVATE', 'INVITE_ONLY'] as const },
            members: { some: { userId } },
          },
        ],
      }
    : publicCohort;
}

/** Check if user can self-enroll in cohort without invitation. */
export function canEnrollCohort(
  cohort: { visibility: 'PUBLIC' | 'PRIVATE' | 'INVITE_ONLY'; isPublished: boolean; creatorId: string },
  userId: string | null
): { allowed: boolean; reason?: 'unauthenticated' | 'requires_invitation' | 'not_published' } {
  if (!userId) return { allowed: false, reason: 'unauthenticated' };
  if (cohort.creatorId === userId) return { allowed: true };
  if (!cohort.isPublished) return { allowed: false, reason: 'not_published' };
  if (cohort.visibility === 'PUBLIC') return { allowed: true };
  return { allowed: false, reason: 'requires_invitation' };
}

/** Check member-only access to cohort community chat. */
export function canAccessCohortChat(params: {
  cohort: { id: string; isPublished: boolean; creatorId: string; community?: { chatEnabled: boolean } | null };
  isMember: boolean;
  isCreator: boolean;
  isGuest?: boolean;
  isRestricted?: boolean;
}): { allowed: boolean; status: number; error?: string } {
  const { cohort, isMember, isCreator, isGuest, isRestricted } = params;
  if (isGuest) {
    return { allowed: false, status: 403, error: 'Guest accounts are not permitted to access community chat' };
  }
  if (isRestricted) {
    return { allowed: false, status: 403, error: 'User messaging privileges are restricted' };
  }
  if (cohort.community && cohort.community.chatEnabled === false) {
    return { allowed: false, status: 403, error: 'Community chat is disabled for this cohort' };
  }
  if (!isMember && !isCreator) {
    return { allowed: false, status: 403, error: 'Active cohort membership is required to access community chat' };
  }
  return { allowed: true, status: 200 };
}
