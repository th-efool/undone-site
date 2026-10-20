import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPermissionsCache, getCachedCohortMember } from '@/src/server/infrastructure/auth/permissionsCache';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  cohortMemberFindUnique: vi.fn(),
  cohortFindUnique: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({
  auth: mocks.auth,
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    cohort: {
      findUnique: mocks.cohortFindUnique,
    },
    cohortMember: {
      findUnique: mocks.cohortMemberFindUnique,
    },
  },
}));

import { GET } from './route';

describe('Cohort Viewer Route (GET /api/cohort/[id]/viewer)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearPermissionsCache();
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.cohortFindUnique.mockResolvedValue({ creatorId: 'user-creator' });
  });

  const makeParams = (id = 'cohort-1') => ({
    params: Promise.resolve({ id }),
  });

  it('returns enrolled: false for unauthenticated requests without querying DB or cache', async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost'), makeParams());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ enrolled: false, isCreator: false });
    expect(mocks.cohortMemberFindUnique).not.toHaveBeenCalled();
    expect(getCachedCohortMember('cohort-1', 'user-1')).toBeNull();
  });

  it('creator is automatically recognized as enrolled with CREATOR role', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-creator' } });
    mocks.cohortFindUnique.mockResolvedValue({ creatorId: 'user-creator' });

    const response = await GET(new Request('http://localhost'), makeParams('cohort-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ enrolled: true, role: 'CREATOR', isCreator: true });
    expect(mocks.cohortMemberFindUnique).not.toHaveBeenCalled();
    expect(getCachedCohortMember('cohort-1', 'user-creator')).toEqual({ isMember: true, role: 'CREATOR' });
  });

  it('queries database on cache miss and caches member result', async () => {
    mocks.cohortMemberFindUnique.mockResolvedValueOnce({ role: 'EXPLORER' });

    const response = await GET(new Request('http://localhost'), makeParams('cohort-100'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ enrolled: true, role: 'EXPLORER', isCreator: false });
    expect(mocks.cohortMemberFindUnique).toHaveBeenCalledTimes(1);

    // Cache should now have the entry
    const cached = getCachedCohortMember('cohort-100', 'user-1');
    expect(cached).toEqual({ isMember: true, role: 'EXPLORER' });

    // Second call should HIT the cache and NOT query member DB
    mocks.cohortMemberFindUnique.mockClear();
    const secondResponse = await GET(new Request('http://localhost'), makeParams('cohort-100'));
    const secondData = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(secondData).toEqual({ enrolled: true, role: 'EXPLORER', isCreator: false });
    expect(mocks.cohortMemberFindUnique).not.toHaveBeenCalled();
  });

  it('caches negative result (enrolled: false) when user is not a member', async () => {
    mocks.cohortMemberFindUnique.mockResolvedValueOnce(null);

    const response = await GET(new Request('http://localhost'), makeParams('cohort-200'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ enrolled: false, role: undefined, isCreator: false });
    expect(mocks.cohortMemberFindUnique).toHaveBeenCalledTimes(1);

    // Verify negative cache entry
    const cached = getCachedCohortMember('cohort-200', 'user-1');
    expect(cached).toEqual({ isMember: false });

    // Second call should return enrolled: false from cache without member DB hit
    mocks.cohortMemberFindUnique.mockClear();
    const secondResponse = await GET(new Request('http://localhost'), makeParams('cohort-200'));
    const secondData = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(secondData).toEqual({ enrolled: false, role: undefined, isCreator: false });
    expect(mocks.cohortMemberFindUnique).not.toHaveBeenCalled();
  });

  it('returns 500 when database lookup throws an error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.cohortFindUnique.mockRejectedValueOnce(new Error('Postgres connection failed'));

    const response = await GET(new Request('http://localhost'), makeParams('cohort-err'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ enrolled: false, isCreator: false });
    consoleSpy.mockRestore();
  });
});
