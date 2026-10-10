import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialSnapshot, applyCommand } from '@/src/shared/cohort-creation/flow';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), queryRaw: vi.fn(), writeEvent: vi.fn(), createMany: vi.fn(), findUnique: vi.fn(), getUser: vi.fn(), detach: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({ prisma: {
  $transaction: (work: (tx: unknown) => unknown) => work({ $queryRaw: mocks.queryRaw, creationStorageObject: { updateMany: mocks.detach } }),
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
    mocks.queryRaw.mockResolvedValueOnce([{ revision: 0, snapshot: initialSnapshot(draftId) }]).mockResolvedValueOnce([{ revision: 1 }]);
    expect(await creationDraftRepo.swap('alice', draftId, 0, next)).toBe(true);
    expect(await creationDraftRepo.swap('alice', draftId, 0, next)).toBe(false);
    expect(mocks.writeEvent).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'alice', next, 'snapshot');
    const [sql, id, owner] = mocks.queryRaw.mock.calls[0];
    expect(sql.join('')).toContain('FOR UPDATE');
    expect([id, owner]).toEqual([draftId, 'alice']);
    await expect(creationDraftRepo.swap('alice', draftId, 1, next)).rejects.toThrow('Invalid revision transition');
  });
  it('detaches removed pins with the owner event and preserves shared/published references', async () => {
    const id = '44444444-4444-4444-8444-444444444444';
    const shared = '55555555-5555-4555-8555-555555555555';
    const artifactRef = '66666666-6666-4666-8666-666666666666';
    const previous = { ...initialSnapshot(draftId), materials: [
      { id, kind: 'markdown' as const, input: { kind: 'upload' as const, assetId: shared }, selectedUnitIds: [], status: 'ready' as const },
      { id: shared, kind: 'markdown' as const, input: { kind: 'upload' as const, assetId: shared }, selectedUnitIds: [], status: 'ready' as const },
    ], extractions: [{ materialId: id, artifactRef, version: 'a'.repeat(64), checksum: 'b'.repeat(64), extractionKind: 'text' as const, segmentCount: 1, complete: true }] };
    const next = { ...previous, revision: 1, materials: [previous.materials[1]], extractions: [] };
    mocks.queryRaw.mockResolvedValue([{ revision: 0, snapshot: previous }]);
    expect(await creationDraftRepo.swap('alice', draftId, 0, next)).toBe(true);
    expect(mocks.detach).toHaveBeenCalledExactlyOnceWith({ where: { id: { in: [artifactRef] }, ownerId: 'alice', draftId, publishedAt: null }, data: { referencedAt: null } });
    expect(mocks.detach.mock.invocationCallOrder[0]).toBeLessThan(mocks.writeEvent.mock.invocationCallOrder[0]);
    mocks.queryRaw.mockResolvedValue([]); mocks.detach.mockClear();
    expect(await creationDraftRepo.swap('bob', draftId, 0, next)).toBe(false); expect(mocks.detach).not.toHaveBeenCalled();
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
  it('detaches retained receipt pins even if extraction never completed', async () => {
    const materialId = '44444444-4444-4444-8444-444444444444';
    const rawId = '55555555-5555-4555-8555-555555555555';
    const receiptId = '66666666-6666-4666-8666-666666666666';
    const previous = { ...initialSnapshot(draftId), materials: [{ id: materialId, kind: 'web' as const,
      input: { kind: 'url' as const, url: 'https://docs.example.com/lesson' }, selectedUnitIds: [], status: 'failed' as const }],
      materialRefs: [{ materialId, ids: [rawId, receiptId] }] };
    mocks.queryRaw.mockResolvedValue([{ revision: 0, snapshot: previous }]);
    const next = { ...initialSnapshot(draftId), revision: 1 };
    expect(await creationDraftRepo.swap('alice', draftId, 0, next)).toBe(true);
    expect(mocks.detach).toHaveBeenCalledExactlyOnceWith({ where: { id: { in: [rawId, receiptId] }, ownerId: 'alice', draftId, publishedAt: null }, data: { referencedAt: null } });
  });
});
