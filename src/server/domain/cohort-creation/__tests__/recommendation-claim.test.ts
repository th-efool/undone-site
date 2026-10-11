import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({ prisma: {
  $transaction: (work: (tx: unknown) => unknown) => work({ $queryRaw: mocks.query }),
} }));
import { creationJobRepo } from '@/src/server/infrastructure/db/postgres/repositories/creationJob.repo';
import { draftId, requestId } from '@/src/shared/cohort-creation/__tests__/fixtures';

describe('recommendation claim boundary', () => {
  beforeEach(() => {
    mocks.query.mockReset().mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([{ count: BigInt(0) }]).mockResolvedValueOnce([]);
  });
  it('limits web claims to recommendation kind, owner, draft and request in SQL', async () => {
    expect(await creationJobRepo.claim('web-search', { ownerId: 'alice', draftId, requestId })).toBeNull();
    const [parts, unrestricted, kind, owner, draft, request] = mocks.query.mock.calls[2];
    const sql = parts.join('?');
    expect(unrestricted).toBe(false);
    expect([owner, draft, request]).toEqual(['alice', draftId, requestId]);
    expect(kind).toBe('recommendations');
    expect(sql).toContain('j."kind"=?');
    expect(sql).toContain('j."ownerId"=? AND j."draftId"=?');
    expect(sql).toContain('j."requestId"=?');
    expect(sql).toContain('FOR UPDATE OF d SKIP LOCKED');
  });
  it('scopes a YouTube inspection without allowing other materials or video observation', async () => {
    await creationJobRepo.claim('web-inspection', { ownerId: 'alice', draftId, requestId, kind: 'inspect_youtube' });
    expect(mocks.query.mock.calls[2].slice(1)).toEqual([false, 'inspect_youtube', 'alice', draftId, requestId]);
  });
  it('preserves unscoped worker claiming and the global concurrency cap', async () => {
    await creationJobRepo.claim('worker');
    expect(mocks.query.mock.calls[2][1]).toBe(true);
    mocks.query.mockReset().mockResolvedValueOnce([{ locked: true }]).mockResolvedValueOnce([{ count: BigInt(2) }]);
    expect(await creationJobRepo.claim('web-search', { ownerId: 'alice', draftId, requestId })).toBeNull();
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
});
