import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  owner: 'owner-uuid' as string | null,
  findFirst: vi.fn(),
  queryRawUnsafe: vi.fn(),
  assertSourceSchema: vi.fn(),
  capabilities: {
    pdf: true,
    web: true,
    github: true,
    youtube: true,
  } as Record<string, boolean>,
  youtubeTranscript: { enabled: true, code: null as string | null },
  youtubeVideo: { enabled: true, code: null as string | null },
  github: { enabled: true, code: null as string | null },
}));

vi.mock('@/src/server/infrastructure/auth/getCreationOwner', () => ({
  getCreationOwner: async () => fake.owner,
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    interactionWorkspace: {
      findFirst: (...args: unknown[]) => fake.findFirst(...args),
    },
    $queryRawUnsafe: (...args: unknown[]) => fake.queryRawUnsafe(...args),
  },
}));

vi.mock('@/src/server/domain/cohort-builder/source-policy', () => ({
  assertSourceSchema: (...args: unknown[]) => fake.assertSourceSchema(...args),
  sourceCapability: vi.fn((kind: string) => fake.capabilities[kind] ?? false),
}));

vi.mock('@/src/server/domain/cohort-builder/youtube-transcript-policy', () => ({
  youtubeTranscriptReadiness: vi.fn(() => fake.youtubeTranscript),
}));

vi.mock('@/src/server/domain/cohort-builder/youtube-video-policy', () => ({
  youtubeVideoReadiness: vi.fn(() => fake.youtubeVideo),
}));

vi.mock('@/src/server/domain/cohort-builder/github-policy', () => ({
  githubSourceReadiness: vi.fn(() => fake.github),
}));

import { GET, clearVerifiedSourcesWorkspacesCacheForTests } from '../route';

function createRequest(workspaceId: string, headers: Record<string, string> = {}) {
  return new Request(`https://test.local/api/cohort-builder/workspaces/${workspaceId}/sources`, {
    method: 'GET',
    headers,
  });
}

describe('GET /api/cohort-builder/workspaces/[workspaceId]/sources', () => {
  const validWorkspaceId = '54103d7b-2709-4dd6-bb18-522f96b97241';
  const secondWorkspaceId = '8f3e3a9c-4571-482a-bc96-d446f2aa4e31';
  const nonExistentWorkspaceId = 'c8b2a1e0-4710-4f59-9ea2-3f11d9a24d77';
  const originalDriver = process.env.INTERACTION_TEXT_DRIVER;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));
    clearVerifiedSourcesWorkspacesCacheForTests();

    process.env.INTERACTION_TEXT_DRIVER = 'durable';
    fake.owner = 'owner-uuid';
    fake.findFirst.mockReset();
    fake.queryRawUnsafe.mockReset();
    fake.assertSourceSchema.mockReset();

    fake.findFirst.mockResolvedValue({ id: validWorkspaceId });
    fake.assertSourceSchema.mockResolvedValue(undefined);
    fake.capabilities = { pdf: true, web: true, github: true, youtube: true };
    fake.youtubeTranscript = { enabled: true, code: null };
    fake.youtubeVideo = { enabled: true, code: null };
    fake.github = { enabled: true, code: null };
  });

  afterEach(() => {
    vi.useRealTimers();
    clearVerifiedSourcesWorkspacesCacheForTests();
    if (originalDriver !== undefined) {
      process.env.INTERACTION_TEXT_DRIVER = originalDriver;
    } else {
      delete process.env.INTERACTION_TEXT_DRIVER;
    }
  });

  describe('Authentication & Validation', () => {
    it('returns 404 when unauthenticated (owner is null)', async () => {
      fake.owner = null;
      const req = createRequest(validWorkspaceId);
      const res = await GET(req, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });

      expect(res.status).toBe(404);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
      const data = await res.json();
      expect(data).toEqual({ code: 'NOT_FOUND' });
      expect(fake.findFirst).not.toHaveBeenCalled();
    });

    it('returns 404 when workspaceId is not a valid UUID', async () => {
      const invalidId = 'not-a-valid-uuid';
      const req = createRequest(invalidId);
      const res = await GET(req, { params: Promise.resolve({ workspaceId: invalidId }) });

      expect(res.status).toBe(404);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
      const data = await res.json();
      expect(data).toEqual({ code: 'NOT_FOUND' });
      expect(fake.findFirst).not.toHaveBeenCalled();
    });

    it('returns 404 when workspace is not found in database', async () => {
      fake.findFirst.mockResolvedValue(null);
      const req = createRequest(nonExistentWorkspaceId);
      const res = await GET(req, { params: Promise.resolve({ workspaceId: nonExistentWorkspaceId }) });

      expect(res.status).toBe(404);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
      const data = await res.json();
      expect(data).toEqual({ code: 'NOT_FOUND' });
      expect(fake.findFirst).toHaveBeenCalledWith({
        where: {
          id: nonExistentWorkspaceId,
          ownerId: 'owner-uuid',
          domainId: 'cohort',
          lifecycle: 'active',
        },
        select: { id: true },
      });
    });
  });

  describe('Successful Retrieval & ETag Header', () => {
    it('returns 200 with capability flags and ETag header on valid request', async () => {
      const req = createRequest(validWorkspaceId);
      const res = await GET(req, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });

      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('private, no-store');

      const data = await res.json();
      expect(data).toEqual({
        pdf: true,
        web: true,
        youtube: true,
        youtubeUnavailableReason: null,
        youtubeVideo: true,
        youtubeTranscript: true,
        github: true,
        githubUnavailableReason: 'GITHUB_CAPABILITY_DISABLED',
        pdfBytes: 2 * 1024 * 1024,
        webBytes: 1024 * 1024,
      });

      const expectedEtag = `W/"${createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex')}"`;
      expect(res.headers.get('etag')).toBe(expectedEtag);
      expect(expectedEtag).toMatch(/^W\/"[a-f0-9]{64}"$/);
    });

    it('returns 200 with disabled capabilities when driver is not durable', async () => {
      process.env.INTERACTION_TEXT_DRIVER = 'ephemeral';
      const req = createRequest(validWorkspaceId);
      const res = await GET(req, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pdf).toBe(false);
      expect(data.web).toBe(false);
      expect(data.github).toBe(false);
      expect(fake.assertSourceSchema).not.toHaveBeenCalled();
    });

    it('gracefully handles assertSourceSchema failure by setting ready to false', async () => {
      fake.assertSourceSchema.mockRejectedValue(new Error('SCHEMA_ERROR'));
      const req = createRequest(validWorkspaceId);
      const res = await GET(req, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.pdf).toBe(false);
      expect(data.web).toBe(false);
      expect(data.github).toBe(false);
    });
  });

  describe('HTTP 304 Not Modified Fast-Exit', () => {
    it('returns 304 Not Modified when If-None-Match matches the computed ETag without sending JSON body', async () => {
      const initialReq = createRequest(validWorkspaceId);
      const initialRes = await GET(initialReq, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
      expect(initialRes.status).toBe(200);
      const etag = initialRes.headers.get('etag');
      expect(etag).toBeTruthy();

      const pollingReq = createRequest(validWorkspaceId, { 'if-none-match': etag! });
      const pollingRes = await GET(pollingReq, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });

      expect(pollingRes.status).toBe(304);
      expect(pollingRes.headers.get('etag')).toBe(etag);
      expect(pollingRes.headers.get('cache-control')).toBe('private, no-store');
      const bodyText = await pollingRes.text();
      expect(bodyText).toBe('');
    });

    it('returns 200 when If-None-Match does not match the computed ETag', async () => {
      const pollingReq = createRequest(validWorkspaceId, { 'if-none-match': 'W/"stale-etag-value"' });
      const pollingRes = await GET(pollingReq, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });

      expect(pollingRes.status).toBe(200);
      const body = await pollingRes.json();
      expect(body.pdf).toBe(true);
    });

    it('returns 200 with new ETag when payload changes beyond prefix 24, whereas identical payload returns 304', async () => {
      const initialReq = createRequest(validWorkspaceId);
      const initialRes = await GET(initialReq, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
      expect(initialRes.status).toBe(200);
      const initialEtag = initialRes.headers.get('etag');
      expect(initialEtag).toBeTruthy();

      // Identical payload with matching If-None-Match returns 304
      const identicalReq = createRequest(validWorkspaceId, { 'if-none-match': initialEtag! });
      const identicalRes = await GET(identicalReq, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
      expect(identicalRes.status).toBe(304);
      expect(identicalRes.headers.get('etag')).toBe(initialEtag);
      expect(await identicalRes.text()).toBe('');

      // Mutate a field that appears far beyond the first 24 characters of the serialized payload
      // In old base64 prefix 24, only {"pdf":true,"web": was hashed.
      // Changing githubUnavailableReason from 'GITHUB_CAPABILITY_DISABLED' to 'GITHUB_TOKEN_EXPIRED':
      fake.github = { enabled: true, code: 'GITHUB_TOKEN_EXPIRED' };

      const modifiedReq = createRequest(validWorkspaceId, { 'if-none-match': initialEtag! });
      const modifiedRes = await GET(modifiedReq, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
      expect(modifiedRes.status).toBe(200);
      const modifiedData = await modifiedRes.json();
      expect(modifiedData.githubUnavailableReason).toBe('GITHUB_TOKEN_EXPIRED');

      const modifiedEtag = modifiedRes.headers.get('etag');
      expect(modifiedEtag).toBeTruthy();
      expect(modifiedEtag).not.toBe(initialEtag);
      expect(modifiedEtag).toMatch(/^W\/"[a-f0-9]{64}"$/);

      // Subsequent request with the new ETag returns 304
      const subsequentReq = createRequest(validWorkspaceId, { 'if-none-match': modifiedEtag! });
      const subsequentRes = await GET(subsequentReq, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
      expect(subsequentRes.status).toBe(304);
      expect(subsequentRes.headers.get('etag')).toBe(modifiedEtag);
    });
  });

  describe('Worker-Process Workspace Ownership Memoization', () => {
    it('second request within 60 seconds bypasses prisma.interactionWorkspace.findFirst', async () => {
      // Request 1: cache miss -> queries DB
      const req1 = createRequest(validWorkspaceId);
      const res1 = await GET(req1, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
      expect(res1.status).toBe(200);
      expect(fake.findFirst).toHaveBeenCalledTimes(1);

      // Request 2 (after 5 seconds): cache hit -> bypasses DB
      vi.advanceTimersByTime(5000);
      const req2 = createRequest(validWorkspaceId);
      const res2 = await GET(req2, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
      expect(res2.status).toBe(200);
      expect(fake.findFirst).toHaveBeenCalledTimes(1);

      // Request 3 (at 59 seconds): still within 60s TTL -> bypasses DB
      vi.advanceTimersByTime(54000);
      const req3 = createRequest(validWorkspaceId);
      const res3 = await GET(req3, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
      expect(res3.status).toBe(200);
      expect(fake.findFirst).toHaveBeenCalledTimes(1);

      // Request 4 (at 61 seconds): TTL expired -> re-queries DB
      vi.advanceTimersByTime(2000);
      const req4 = createRequest(validWorkspaceId);
      const res4 = await GET(req4, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
      expect(res4.status).toBe(200);
      expect(fake.findFirst).toHaveBeenCalledTimes(2);
    });

    it('segregates cache entries by workspaceId and ownerId', async () => {
      fake.findFirst.mockResolvedValue({ id: secondWorkspaceId });

      // Request for workspace 2
      const reqWorkspace2 = createRequest(secondWorkspaceId);
      const resWorkspace2 = await GET(reqWorkspace2, { params: Promise.resolve({ workspaceId: secondWorkspaceId }) });
      expect(resWorkspace2.status).toBe(200);
      expect(fake.findFirst).toHaveBeenCalledWith({
        where: {
          id: secondWorkspaceId,
          ownerId: 'owner-uuid',
          domainId: 'cohort',
          lifecycle: 'active',
        },
        select: { id: true },
      });

      // Different owner on workspace 2 requires fresh DB verification
      fake.findFirst.mockClear();
      fake.owner = 'different-owner-uuid';
      fake.findFirst.mockResolvedValue({ id: secondWorkspaceId });

      const reqDifferentOwner = createRequest(secondWorkspaceId);
      const resDifferentOwner = await GET(reqDifferentOwner, { params: Promise.resolve({ workspaceId: secondWorkspaceId }) });
      expect(resDifferentOwner.status).toBe(200);
      expect(fake.findFirst).toHaveBeenCalledTimes(1);
      expect(fake.findFirst).toHaveBeenCalledWith({
        where: {
          id: secondWorkspaceId,
          ownerId: 'different-owner-uuid',
          domainId: 'cohort',
          lifecycle: 'active',
        },
        select: { id: true },
      });
    });

    it('does not cache failed workspace lookups (returns 404 again on subsequent call)', async () => {
      fake.findFirst.mockResolvedValue(null);

      const req1 = createRequest(nonExistentWorkspaceId);
      const res1 = await GET(req1, { params: Promise.resolve({ workspaceId: nonExistentWorkspaceId }) });
      expect(res1.status).toBe(404);
      expect(fake.findFirst).toHaveBeenCalledTimes(1);

      const req2 = createRequest(nonExistentWorkspaceId);
      const res2 = await GET(req2, { params: Promise.resolve({ workspaceId: nonExistentWorkspaceId }) });
      expect(res2.status).toBe(404);
      expect(fake.findFirst).toHaveBeenCalledTimes(2);
    });

    it('clearVerifiedSourcesWorkspacesCacheForTests resets the cache immediately', async () => {
      const req1 = createRequest(validWorkspaceId);
      const res1 = await GET(req1, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
      expect(res1.status).toBe(200);
      expect(fake.findFirst).toHaveBeenCalledTimes(1);

      clearVerifiedSourcesWorkspacesCacheForTests();

      const req2 = createRequest(validWorkspaceId);
      const res2 = await GET(req2, { params: Promise.resolve({ workspaceId: validWorkspaceId }) });
      expect(res2.status).toBe(200);
      expect(fake.findFirst).toHaveBeenCalledTimes(2);
    });
  });
});
