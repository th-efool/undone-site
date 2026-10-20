import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPermissionsCache, getCachedCohortMember } from '@/src/server/infrastructure/auth/permissionsCache';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({
  auth: mocks.auth,
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    cohortMember: {
      findUnique: mocks.findUnique,
    },
  },
}));

import { GET } from './route';

describe('Cohort Viewer Route (GET /api/cohort/[id]/viewer)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearPermissionsCache();
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } });
  });

  const makeParams = (id = 'cohort-1') => ({
    params: Promise.resolve({ id }),
  });

  it('returns enrolled: false for unauthenticated requests without querying DB or cache', async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost'), makeParams());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ enrolled: false });
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(getCachedCohortMember('cohort-1', 'user-1')).toBeNull();
  });

  it('queries database on cache miss and caches member result', async () => {
    mocks.findUnique.mockResolvedValueOnce({ role: 'EXPLORER' });

    const response = await GET(new Request('http://localhost'), makeParams('cohort-100'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ enrolled: true });
    expect(mocks.findUnique).toHaveBeenCalledTimes(1);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        cohortId_userId: {
          cohortId: 'cohort-100',
          userId: 'user-1',
        },
      },
      select: { role: true },
    });

    // Cache should now have the entry
    const cached = getCachedCohortMember('cohort-100', 'user-1');
    expect(cached).toEqual({ isMember: true, role: 'EXPLORER' });

    // Second call should HIT the cache and NOT query DB
    mocks.findUnique.mockClear();
    const secondResponse = await GET(new Request('http://localhost'), makeParams('cohort-100'));
    const secondData = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(secondData).toEqual({ enrolled: true });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('caches negative result (enrolled: false) when user is not a member', async () => {
    mocks.findUnique.mockResolvedValueOnce(null);

    const response = await GET(new Request('http://localhost'), makeParams('cohort-200'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ enrolled: false });
    expect(mocks.findUnique).toHaveBeenCalledTimes(1);

    // Verify negative cache entry
    const cached = getCachedCohortMember('cohort-200', 'user-1');
    expect(cached).toEqual({ isMember: false });

    // Second call should return enrolled: false from cache without DB hit
    mocks.findUnique.mockClear();
    const secondResponse = await GET(new Request('http://localhost'), makeParams('cohort-200'));
    const secondData = await secondResponse.json();

    expect(secondResponse.status).toBe(200);
    expect(secondData).toEqual({ enrolled: false });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('returns 500 when database lookup throws an error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.findUnique.mockRejectedValueOnce(new Error('Postgres connection failed'));

    const response = await GET(new Request('http://localhost'), makeParams('cohort-err'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ enrolled: false });
    consoleSpy.mockRestore();
  });
});
