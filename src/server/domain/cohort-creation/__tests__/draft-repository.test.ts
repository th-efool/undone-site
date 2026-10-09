import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialSnapshot, applyCommand } from '@/src/shared/cohort-creation/flow';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), queryRaw: vi.fn(), writeEvent: vi.fn(), createMany: vi.fn(), findUnique: vi.fn(), getUser: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({ prisma: {
  $transaction: (work: (tx: unknown) => unknown) => work({ $queryRaw: mocks.queryRaw }),
  creationDraft: { findFirst: mocks.findFirst, createMany: mocks.createMany },
  user: { findUnique: mocks.findUnique },
} }));
vi.mock('@/src/server/infrastructure/db/postgres/repositories/creationEvent.repo', () => ({ writeDraftEvent: mocks.writeEvent }));
vi.mock('@/src/server/infrastructure/auth/getUser', () => ({ getUser: mocks.getUser }));
import { creationDraftRepo } from '@/src/server/infrastructure/db/postgres/repositories/creationDraft.repo';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';

describe('PostgreSQL ownership and revision boundaries', () => {
  beforeEach(() => vi.resetAllMocks());
  it('filters reads by owner and creates without reassigning existing ownership', async () => {
    const snapshot = initialSnapshot(draftId);
    mocks.findFirst.mockResolvedValue({ snapshot, revision: 0, schemaVersion: 1 });
    expect(await creationDraftRepo.create('alice', draftId)).toEqual(snapshot);
    expect(mocks.createMany).toHaveBeenCalledWith({ data: [{ id: draftId, ownerId: 'alice', snapshot }], skipDuplicates: true });
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: draftId, ownerId: 'alice', expiredAt: null } });
  });
  it('uses an atomic owner/revision predicate and reports zero updated rows as a conflict', async () => {
    const next = applyCommand(initialSnapshot(draftId), { type: 'request_recommendations', requestId: result.requestId, query: result.intent.rawQuery });
    mocks.queryRaw.mockResolvedValueOnce([{ revision: 0 }]).mockResolvedValueOnce([{ revision: 1 }]);
    expect(await creationDraftRepo.swap('alice', draftId, 0, next)).toBe(true);
    expect(await creationDraftRepo.swap('alice', draftId, 0, next)).toBe(false);
    expect(mocks.writeEvent).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'alice', next, 'snapshot');
    const [sql, id, owner] = mocks.queryRaw.mock.calls[0];
    expect(sql.join('')).toContain('FOR UPDATE');
    expect([id, owner]).toEqual([draftId, 'alice']);
    await expect(creationDraftRepo.swap('alice', draftId, 1, next)).rejects.toThrow('Invalid revision transition');
  });
  it('requires both an authenticated session and an authoritative database user', async () => {
    mocks.getUser.mockResolvedValueOnce(null);
    expect(await getCreationOwner()).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValue({ id: 'guest' });
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'guest' });
    expect(await getCreationOwner()).toBeNull();
    expect(await getCreationOwner()).toBe('guest');
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: 'guest' }, select: { id: true } });
  });
});
