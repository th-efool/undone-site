import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { accessibleCohortWhere, canReadCohort } from '../cohortAccessPolicy';

describe('cohort access policy', () => {
  it.each(['PUBLIC', 'PRIVATE'] as const)('keeps unpublished %s previews creator-only, even for members', visibility => {
    const cohort = { creatorId: 'creator', visibility, isPublished: false };
    expect(canReadCohort(cohort, 'creator')).toBe(true);
    expect(canReadCohort(cohort, 'member', true)).toBe(false);
    expect(canReadCohort(cohort, null, true)).toBe(false);
  });
  it('allows published public reads and only owned/member private reads', () => {
    const cohort = { creatorId: 'creator', visibility: 'PRIVATE' as const, isPublished: true };
    expect(canReadCohort(cohort, null)).toBe(false);
    expect(canReadCohort(cohort, 'stranger')).toBe(false);
    expect(canReadCohort(cohort, 'creator')).toBe(true);
    expect(canReadCohort(cohort, 'member', true)).toBe(true);
    expect(canReadCohort(cohort, null, true)).toBe(false);
    expect(canReadCohort({ ...cohort, visibility: 'PUBLIC' }, null)).toBe(true);
  });
  it('expresses the same restrictions inside relational queries without an anonymous membership fallback', () => {
    expect(accessibleCohortWhere(null)).toEqual({ isPublished: true, visibility: 'PUBLIC' });
    expect(accessibleCohortWhere('member')).toEqual({ OR: [
      { isPublished: true, visibility: 'PUBLIC' }, { creatorId: 'member' },
      { isPublished: true, visibility: 'PRIVATE', members: { some: { userId: 'member' } } },
    ] });
  });
});
