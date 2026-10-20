import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  clearPermissionsCache,
  getCachedCohortMember,
} from '@/src/server/infrastructure/auth/permissionsCache';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  connect: vi.fn(),
  config: vi.fn(),
  remove: vi.fn(),
  join: vi.fn(),
  findCohort: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({ auth: mocks.auth }));
vi.mock('@/src/server/infrastructure/db/mongodb/client', () => ({ connectToMongoDB: mocks.connect }));
vi.mock('@/src/server/database/mongo/models/UserCohortConfig', () => ({
  UserCohortConfig: { updateOne: mocks.config },
}));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    cohort: { findUnique: mocks.findCohort },
    cohortMember: { deleteMany: mocks.remove, upsert: mocks.join },
  },
}));
vi.mock('@/src/server/domain/cohort/cohortAccessPolicy', () => ({
  canEnrollCohort: () => ({ allowed: true }),
}));

import { DELETE, POST } from './route';

beforeEach(() => {
  vi.resetAllMocks();
  clearPermissionsCache();
  mocks.auth.mockResolvedValue({ user: { id: 'learner' } });
  mocks.config.mockReturnValue({ exec: vi.fn().mockResolvedValue({}) });
  mocks.connect.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue({ count: 1 });
  mocks.findCohort.mockResolvedValue({
    id: 'systems',
    creatorId: 'creator-1',
    isPublished: true,
    visibility: 'PUBLIC',
    community: { id: 'comm-systems', chatEnabled: true },
  });
  mocks.join.mockResolvedValue({ role: 'EXPLORER' });
});

const params = () => ({ params: Promise.resolve({ id: 'systems' }) });

describe('cohort subscription removal and join', () => {
  it('rejects unauthenticated deletion before touching data', async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await DELETE(new Request('http://localhost'), params())).status).toBe(401);
    expect(mocks.config).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(getCachedCohortMember('systems', 'learner')).toBeNull();
  });

  it('removes only the signed-in membership and persists a user-scoped removal marker', async () => {
    expect((await DELETE(new Request('http://localhost'), params())).status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith({ where: { userId: 'learner', cohortId: 'systems' } });
    expect(mocks.config).toHaveBeenCalledWith(
      { userId: 'learner', cohortId: 'systems' },
      { $set: { isHidden: true } },
      { upsert: true },
    );
    expect(getCachedCohortMember('systems', 'learner')).toEqual({ isMember: false });
  });

  it('creator leave preserves creator role and does not delete cohort_members row', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'creator-1' } });
    const res = await DELETE(new Request('http://localhost'), params());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isCreator).toBe(true);
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.config).toHaveBeenCalledWith(
      { userId: 'creator-1', cohortId: 'systems' },
      { $set: { isHidden: true } },
      { upsert: true }
    );
    expect(getCachedCohortMember('systems', 'creator-1')).toEqual({ isMember: true, role: 'CREATOR' });
  });

  it('allows joining again to restore the removed cohort', async () => {
    expect((await POST(new Request('http://localhost'), params())).status).toBe(200);
    expect(mocks.config).toHaveBeenCalledWith(
      { userId: 'learner', cohortId: 'systems' },
      { $set: { isHidden: false, isPaused: false }, $unset: { pausedUntil: 1 } },
      { upsert: true }
    );
    expect(mocks.join).toHaveBeenCalledOnce();
    expect(getCachedCohortMember('systems', 'learner')).toEqual({ isMember: true, role: 'EXPLORER' });
  });
});
