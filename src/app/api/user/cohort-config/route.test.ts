import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), connect: vi.fn(), write: vi.fn(), execute: vi.fn(), bulkWrite: vi.fn() }));
vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({ auth: mocks.auth }));
vi.mock('@/src/server/infrastructure/db/mongodb/client', () => ({ connectToMongoDB: mocks.connect }));
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
  mocks.bulkWrite.mockResolvedValue({ modifiedCount: 2, upsertedCount: 0, matchedCount: 0 });
});
function request(body: object) {
  return new Request('http://localhost/api/user/cohort-config', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
describe('database pause persistence', () => {
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
  });
  it('writes resume state and clears the stored pause timestamp', async () => {
    expect((await PUT(request({ cohortId: 'systems', isPaused: false, pausedUntil: null }))).status).toBe(200);
    expect(mocks.write).toHaveBeenCalledWith(
      { userId: 'learner', cohortId: 'systems' },
      { $set: { isPaused: false, pausedUntil: null } },
      expect.any(Object),
    );
  });
  it('rejects a missing session before attempting a database write', async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await PUT(request({ cohortId: 'systems', isPaused: true }))).status).toBe(401);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('calls bulkWrite with batch operations for cohort reordering and returns success', async () => {
    const response = await PUT(request({
      cohorts: [
        { cohortId: 'c1', rank: 1 },
        { cohortId: 'c2', rank: 2 },
      ],
    }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({ success: true, count: 2 });
    expect(mocks.bulkWrite).toHaveBeenCalledWith(
      [
        {
          updateOne: {
            filter: { userId: 'learner', cohortId: 'c1' },
            update: {
              $set: { rank: 1 },
              $setOnInsert: {
                dailyGoalMinutes: 20,
                scheduleDays: ['Mon', 'Wed', 'Fri'],
                scheduleLabel: 'Mon, Wed, Fri',
                frequency: 'Often',
                orderStyle: 'Sequential',
                isPaused: false,
                isHidden: false,
              },
            },
            upsert: true,
          },
        },
        {
          updateOne: {
            filter: { userId: 'learner', cohortId: 'c2' },
            update: {
              $set: { rank: 2 },
              $setOnInsert: {
                dailyGoalMinutes: 20,
                scheduleDays: ['Mon', 'Wed', 'Fri'],
                scheduleLabel: 'Mon, Wed, Fri',
                frequency: 'Often',
                orderStyle: 'Sequential',
                isPaused: false,
                isHidden: false,
              },
            },
            upsert: true,
          },
        },
      ],
      { ordered: false }
    );
  });
});