import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  connect: vi.fn(),
  write: vi.fn(),
  execute: vi.fn(),
  bulkWrite: vi.fn(),
  invalidateCache: vi.fn(),
  executeCohortStateChange: vi.fn(),
  cohortMemberFindMany: vi.fn(),
  cohortFindMany: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({ auth: mocks.auth }));
vi.mock('@/src/server/infrastructure/db/mongodb/client', () => ({ connectToMongoDB: mocks.connect }));
vi.mock('@/src/server/infrastructure/cache/homeServerCache', () => ({
  invalidateHomeServerCache: mocks.invalidateCache,
}));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    cohortMember: { findMany: (...args: unknown[]) => mocks.cohortMemberFindMany(...args) },
    cohort: { findMany: (...args: unknown[]) => mocks.cohortFindMany(...args) },
  },
}));
vi.mock('@/src/server/domain/home/cohortOrder.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/server/domain/home/cohortOrder.service')>();
  return {
    ...actual,
    executeCohortStateChange: mocks.executeCohortStateChange,
  };
});
vi.mock('@/src/server/database/mongo/models/UserCohortConfig', () => ({
  UserCohortConfig: { findOneAndUpdate: mocks.write, bulkWrite: mocks.bulkWrite = vi.fn() },
  VALID_FREQUENCIES: ['Very Often', 'Often', 'Sometimes', 'Rarely', 'Very Rarely'],
  VALID_ORDER_STYLES: ['Sequential', 'Semantic Randomize', 'Randomize'],
  VALID_SCHEDULE_DAYS: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
}));

import { PUT } from './route';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: 'learner' } });
  mocks.connect.mockResolvedValue(undefined);
  mocks.execute.mockResolvedValue({ userId: 'learner', cohortId: 'systems' });
  mocks.write.mockReturnValue({ lean: () => ({ exec: mocks.execute }) });
  mocks.bulkWrite.mockResolvedValue({ modifiedCount: 2, upsertedCount: 0, matchedCount: 2 });
  mocks.cohortMemberFindMany.mockResolvedValue([{ cohortId: 'c1' }, { cohortId: 'c2' }, { cohortId: 'systems' }]);
  mocks.cohortFindMany.mockResolvedValue([]);
  mocks.executeCohortStateChange.mockResolvedValue({
    active: [{ cohortId: 'c2', rank: 1 }],
    paused: [{ cohortId: 'c1', rank: 2 }],
  });
});

function request(body: object) {
  return new Request('http://localhost/api/user/cohort-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('database pause persistence and cohort reordering', () => {
  it('writes pause state and the exact resume timestamp to the signed-in user config', async () => {
    const until = '2026-11-06T00:00:00.000Z';
    const response = await PUT(request({ cohortId: 'systems', isPaused: true, pausedUntil: until }));
    expect(response.status).toBe(200);
    expect(mocks.write).toHaveBeenCalledWith(
      { userId: 'learner', cohortId: 'systems' },
      { $set: { isPaused: true, pausedUntil: new Date(until) } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );
    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(mocks.invalidateCache).toHaveBeenCalledWith('learner');
  });

  it('writes resume state and clears the stored pause timestamp', async () => {
    expect((await PUT(request({ cohortId: 'systems', isPaused: false, pausedUntil: null }))).status).toBe(200);
    expect(mocks.write).toHaveBeenCalledWith(
      { userId: 'learner', cohortId: 'systems' },
      { $set: { isPaused: false, pausedUntil: null } },
      expect.any(Object),
    );
    expect(mocks.invalidateCache).toHaveBeenCalledWith('learner');
  });

  it('rejects a missing session before attempting a database write', async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await PUT(request({ cohortId: 'systems', isPaused: true }))).status).toBe(401);
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('delegates to executeCohortStateChange when operation is pause or resume', async () => {
    const response = await PUT(
      request({
        operation: 'pause',
        cohortId: 'c1',
        pausedUntil: '2026-11-15T00:00:00.000Z',
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.executeCohortStateChange).toHaveBeenCalledWith('learner', {
      operation: 'pause',
      cohortId: 'c1',
      pausedUntil: '2026-11-15T00:00:00.000Z',
      pausedReason: undefined,
    });
  });

  it('calls bulkWrite with batch operations for cohort reordering and invalidates cache', async () => {
    const response = await PUT(
      request({
        cohorts: [
          { cohortId: 'c1', rank: 1 },
          { cohortId: 'c2', rank: 2 },
        ],
      })
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    // modifiedCount(2) + upsertedCount(0) = 2, avoiding double counting matchedCount
    expect(data).toMatchObject({ success: true, count: 2 });
    expect(mocks.bulkWrite).toHaveBeenCalledOnce();
    expect(mocks.invalidateCache).toHaveBeenCalledWith('learner');
  });

  it('returns count 0 without calling bulkWrite when batch is empty', async () => {
    const response = await PUT(request({ cohorts: [] }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ success: true, count: 0 });
    expect(mocks.bulkWrite).not.toHaveBeenCalled();
  });

  it('rejects batch containing duplicate cohort IDs with 400', async () => {
    const response = await PUT(
      request({
        cohorts: [
          { cohortId: 'c1', rank: 1 },
          { cohortId: 'c1', rank: 2 },
        ],
      })
    );
    expect(response.status).toBe(400);
    expect(mocks.bulkWrite).not.toHaveBeenCalled();
  });

  it('rejects batch containing unauthorized cohort ID with 403', async () => {
    const response = await PUT(
      request({
        cohorts: [
          { cohortId: 'unauthorized_cohort', rank: 1 },
        ],
      })
    );
    expect(response.status).toBe(403);
    expect(mocks.bulkWrite).not.toHaveBeenCalled();
  });
});
