import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  accessibleCohortWhere,
  canReadCohort,
  canEnrollCohort,
  canAccessCohortChat,
} from '../cohortAccessPolicy';

describe('cohort access policy', () => {
  it.each(['PUBLIC', 'PRIVATE', 'INVITE_ONLY'] as const)(
    'keeps unpublished %s previews creator-only, even for members',
    (visibility) => {
      const cohort = { creatorId: 'creator', visibility, isPublished: false };
      expect(canReadCohort(cohort, 'creator')).toBe(true);
      expect(canReadCohort(cohort, 'member', true)).toBe(false);
      expect(canReadCohort(cohort, null, true)).toBe(false);
    }
  );

  it('allows published public reads and only owned/member private/invite-only reads', () => {
    const cohort = { creatorId: 'creator', visibility: 'PRIVATE' as const, isPublished: true };
    expect(canReadCohort(cohort, null)).toBe(false);
    expect(canReadCohort(cohort, 'stranger')).toBe(false);
    expect(canReadCohort(cohort, 'creator')).toBe(true);
    expect(canReadCohort(cohort, 'member', true)).toBe(true);
    expect(canReadCohort(cohort, null, true)).toBe(false);
    expect(canReadCohort({ ...cohort, visibility: 'PUBLIC' }, null)).toBe(true);

    const inviteCohort = { creatorId: 'creator', visibility: 'INVITE_ONLY' as const, isPublished: true };
    expect(canReadCohort(inviteCohort, 'member', true)).toBe(true);
    expect(canReadCohort(inviteCohort, 'stranger')).toBe(false);
  });

  it('expresses the restrictions inside relational queries including INVITE_ONLY for members', () => {
    expect(accessibleCohortWhere(null)).toEqual({ isPublished: true, visibility: 'PUBLIC' });
    expect(accessibleCohortWhere('member')).toEqual({
      OR: [
        { isPublished: true, visibility: 'PUBLIC' },
        { creatorId: 'member' },
        {
          isPublished: true,
          visibility: { in: ['PRIVATE', 'INVITE_ONLY'] },
          members: { some: { userId: 'member' } },
        },
      ],
    });
  });

  it('enforces enrollment eligibility: public vs private/invite-only', () => {
    const publicCohort = { creatorId: 'creator', visibility: 'PUBLIC' as const, isPublished: true };
    expect(canEnrollCohort(publicCohort, 'user-1')).toEqual({ allowed: true });
    expect(canEnrollCohort(publicCohort, null)).toEqual({ allowed: false, reason: 'unauthenticated' });

    const privateCohort = { creatorId: 'creator', visibility: 'PRIVATE' as const, isPublished: true };
    expect(canEnrollCohort(privateCohort, 'user-1')).toEqual({ allowed: false, reason: 'requires_invitation' });
    expect(canEnrollCohort(privateCohort, 'creator')).toEqual({ allowed: true });

    const inviteCohort = { creatorId: 'creator', visibility: 'INVITE_ONLY' as const, isPublished: true };
    expect(canEnrollCohort(inviteCohort, 'user-1')).toEqual({ allowed: false, reason: 'requires_invitation' });
  });

  it('enforces member-only community chat access', () => {
    const cohort = {
      id: 'cohort-1',
      creatorId: 'creator-1',
      isPublished: true,
      community: { chatEnabled: true },
    };

    // Guest rejected
    expect(
      canAccessCohortChat({ cohort, isMember: true, isCreator: false, isGuest: true })
    ).toEqual({ allowed: false, status: 403, error: 'Guest accounts are not permitted to access community chat' });

    // Restricted rejected
    expect(
      canAccessCohortChat({ cohort, isMember: true, isCreator: false, isRestricted: true })
    ).toEqual({ allowed: false, status: 403, error: 'User messaging privileges are restricted' });

    // Disabled chat rejected
    expect(
      canAccessCohortChat({ cohort: { ...cohort, community: { chatEnabled: false } }, isMember: true, isCreator: false })
    ).toEqual({ allowed: false, status: 403, error: 'Community chat is disabled for this cohort' });

    // Non-member rejected even if public
    expect(
      canAccessCohortChat({ cohort, isMember: false, isCreator: false })
    ).toEqual({ allowed: false, status: 403, error: 'Active cohort membership is required to access community chat' });

    // Member allowed
    expect(
      canAccessCohortChat({ cohort, isMember: true, isCreator: false })
    ).toEqual({ allowed: true, status: 200 });

    // Creator allowed
    expect(
      canAccessCohortChat({ cohort, isMember: false, isCreator: true })
    ).toEqual({ allowed: true, status: 200 });
  });
});
