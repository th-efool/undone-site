import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  owner: 'owner-uuid' as string | null,
  findFirst: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/getCreationOwner', () => ({
  getCreationOwner: async () => fake.owner,
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    interactionWorkspace: {
      findFirst: (...args: unknown[]) => fake.findFirst(...args),
    },
    $queryRaw: (...args: unknown[]) => fake.queryRaw(...args),
  },
}));

import { GET } from '../route';

function createRequest(workspaceId: string, headers: Record<string, string> = {}) {
  return new Request(`https://test.local/api/cohort-builder/workspaces/${workspaceId}/activity`, {
    method: 'GET',
    headers,
  });
}

describe('GET /api/cohort-builder/workspaces/[workspaceId]/activity', () => {
  const validWorkspaceId = '54103d7b-2709-4dd6-bb18-522f96b97241';
  const secondWorkspaceId = '8f3e3a9c-4571-482a-bc96-d446f2aa4e31';
  const nonExistentWorkspaceId = 'c8b2a1e0-4710-4f59-9ea2-3f11d9a24d77';
  const customWorkspaceId = '123e4567-e89b-42d3-a456-426614174000';
  const unownedWorkspaceId = 'fa26e255-7033-4f10-a7d0-1533ea7ccdae';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));
    fake.owner = 'owner-uuid';
    fake.findFirst.mockReset();
    fake.queryRaw.mockReset();
    fake.findFirst.mockResolvedValue({ id: validWorkspaceId });
    fake.queryRaw.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Authentication & Validation', () => {
    it('returns 404 when unauthenticated (owner is null)', async () => {
      fake.owner = null;
      const req = createRequest(validWorkspaceId);
      const res = await GET(req, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toEqual({ code: 'NOT_FOUND' });
      expect(fake.findFirst).not.toHaveBeenCalled();
      expect(fake.queryRaw).not.toHaveBeenCalled();
    });

    it('returns 404 when workspaceId is not a valid UUID', async () => {
      const invalidId = 'not-a-valid-uuid';
      const req = createRequest(invalidId);
      const res = await GET(req, { params: Promise.resolve({ workspaceId: invalidId }) });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toEqual({ code: 'NOT_FOUND' });
      expect(fake.findFirst).not.toHaveBeenCalled();
      expect(fake.queryRaw).not.toHaveBeenCalled();
    });

    it('returns 404 when workspace does not exist or owner does not match', async () => {
      fake.findFirst.mockResolvedValue(null);
      const req = createRequest(nonExistentWorkspaceId);
      const res = await GET(req, { params: Promise.resolve({ workspaceId: nonExistentWorkspaceId }) });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toEqual({ code: 'NOT_FOUND' });
      expect(fake.findFirst).toHaveBeenCalledWith({
        where: { id: nonExistentWorkspaceId, ownerId: 'owner-uuid' },
        select: { id: true },
      });
      expect(fake.queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('Successful Retrieval & ETag', () => {
    it('returns 200 with turns and deterministic ETag header on valid request', async () => {
      const turns = [
        { messageId: 'msg-1', runId: null, status: 'pending' },
        { messageId: 'msg-2', runId: 'run-1', status: 'completed' },
      ];
      fake.queryRaw.mockResolvedValue(turns);

      const req = createRequest(validWorkspaceId);
      const res = await GET(req, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });

      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('private, no-store');

      const expectedPayload = 'msg-1::pending|msg-2:run-1:completed';
      const expectedEtag = `W/"${Buffer.from(expectedPayload).toString('base64').slice(0, 32)}"`;
      expect(res.headers.get('etag')).toBe(expectedEtag);

      const data = await res.json();
      expect(data).toEqual({ turns });
    });

    it('returns 200 with empty turns array and valid ETag when no turns exist', async () => {
      fake.queryRaw.mockResolvedValue([]);

      const req = createRequest(validWorkspaceId);
      const res = await GET(req, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });

      expect(res.status).toBe(200);
      expect(res.headers.get('etag')).toBe('W/""');
      const data = await res.json();
      expect(data).toEqual({ turns: [] });
    });
  });

  describe('HTTP 304 Not Modified Fast-Exit', () => {
    it('returns 304 Not Modified with empty body when If-None-Match matches the computed ETag', async () => {
      const turns = [{ messageId: 'msg-1', runId: 'run-1', status: 'completed' }];
      fake.queryRaw.mockResolvedValue(turns);

      const initialReq = createRequest(validWorkspaceId);
      const initialRes = await GET(initialReq, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
      expect(initialRes.status).toBe(200);
      const etag = initialRes.headers.get('etag');
      expect(etag).toBeTruthy();

      // Subsequent polling request sending matching If-None-Match
      const pollingReq = createRequest(validWorkspaceId, { 'if-none-match': etag! });
      const pollingRes = await GET(pollingReq, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });

      expect(pollingRes.status).toBe(304);
      expect(pollingRes.headers.get('etag')).toBe(etag);
      expect(pollingRes.headers.get('cache-control')).toBe('private, no-store');
      const bodyText = await pollingRes.text();
      expect(bodyText).toBe('');
    });

    it('returns 200 with new ETag when turn status changes from pending to completed', async () => {
      // 1. Initial pending turn
      fake.queryRaw.mockResolvedValue([{ messageId: 'msg-1', runId: null, status: 'pending' }]);
      const req1 = createRequest(validWorkspaceId);
      const res1 = await GET(req1, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
      expect(res1.status).toBe(200);
      const etagPending = res1.headers.get('etag')!;
      expect(etagPending).toBeTruthy();

      // 2. Status changes to completed
      fake.queryRaw.mockResolvedValue([{ messageId: 'msg-1', runId: 'run-99', status: 'completed' }]);
      const req2 = createRequest(validWorkspaceId, { 'if-none-match': etagPending });
      const res2 = await GET(req2, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });

      expect(res2.status).toBe(200);
      const etagCompleted = res2.headers.get('etag')!;
      expect(etagCompleted).not.toBe(etagPending);

      const body = await res2.json();
      expect(body.turns[0]).toEqual({ messageId: 'msg-1', runId: 'run-99', status: 'completed' });
    });
  });

  describe('Worker-Process Workspace Ownership Memoization', () => {
    it('caches workspace ownership verification for 60 seconds and avoids redundant DB queries', async () => {
      fake.findFirst.mockResolvedValue({ id: customWorkspaceId });

      // Request 1: cache miss, queries DB
      const req1 = createRequest(customWorkspaceId);
      const res1 = await GET(req1, { params: Promise.resolve({ workspaceId: customWorkspaceId }) });
      expect(res1.status).toBe(200);
      expect(fake.findFirst).toHaveBeenCalledTimes(1);

      // Request 2 (simulated 2s polling tick): cache hit, bypasses DB findFirst
      vi.advanceTimersByTime(2000);
      const req2 = createRequest(customWorkspaceId);
      const res2 = await GET(req2, { params: Promise.resolve({ workspaceId: customWorkspaceId }) });
      expect(res2.status).toBe(200);
      expect(fake.findFirst).toHaveBeenCalledTimes(1);

      // Request 3 (simulated 50s mark): still within 60s TTL, bypasses DB findFirst
      vi.advanceTimersByTime(48000);
      const req3 = createRequest(customWorkspaceId);
      const res3 = await GET(req3, { params: Promise.resolve({ workspaceId: customWorkspaceId }) });
      expect(res3.status).toBe(200);
      expect(fake.findFirst).toHaveBeenCalledTimes(1);

      // Request 4 (simulated 61s elapsed): TTL has expired, re-queries DB
      vi.advanceTimersByTime(11000); // 2 + 48 + 11 = 61s total
      const req4 = createRequest(customWorkspaceId);
      const res4 = await GET(req4, { params: Promise.resolve({ workspaceId: customWorkspaceId }) });
      expect(res4.status).toBe(200);
      expect(fake.findFirst).toHaveBeenCalledTimes(2);
    });

    it('segregates cache entries by workspaceId and ownerId', async () => {
      fake.findFirst.mockResolvedValue({ id: secondWorkspaceId });

      // First workspace lookup
      const reqWorkspace2 = createRequest(secondWorkspaceId);
      const resWorkspace2 = await GET(reqWorkspace2, { params: Promise.resolve({ workspaceId: secondWorkspaceId }) });
      expect(resWorkspace2.status).toBe(200);
      expect(fake.findFirst).toHaveBeenCalledWith({
        where: { id: secondWorkspaceId, ownerId: 'owner-uuid' },
        select: { id: true },
      });

      // Different owner on the same workspace should not use the first owner's cached verification
      fake.findFirst.mockClear();
      fake.owner = 'different-owner-uuid';
      fake.findFirst.mockResolvedValue({ id: secondWorkspaceId });

      const reqDifferentOwner = createRequest(secondWorkspaceId);
      const resDifferentOwner = await GET(reqDifferentOwner, { params: Promise.resolve({ workspaceId: secondWorkspaceId }) });
      expect(resDifferentOwner.status).toBe(200);
      expect(fake.findFirst).toHaveBeenCalledTimes(1);
      expect(fake.findFirst).toHaveBeenCalledWith({
        where: { id: secondWorkspaceId, ownerId: 'different-owner-uuid' },
        select: { id: true },
      });
    });

    it('does not cache failed ownership lookups', async () => {
      fake.findFirst.mockResolvedValue(null);

      const req1 = createRequest(unownedWorkspaceId);
      const res1 = await GET(req1, { params: Promise.resolve({ workspaceId: unownedWorkspaceId }) });
      expect(res1.status).toBe(404);
      expect(fake.findFirst).toHaveBeenCalledTimes(1);

      // Second request immediately after should still query DB and return 404
      const req2 = createRequest(unownedWorkspaceId);
      const res2 = await GET(req2, { params: Promise.resolve({ workspaceId: unownedWorkspaceId }) });
      expect(res2.status).toBe(404);
      expect(fake.findFirst).toHaveBeenCalledTimes(2);
    });
  });
});
