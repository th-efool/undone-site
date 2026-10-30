import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({
  auth: vi.fn(),
  lessons: vi.fn(),
  progress: vi.fn(),
  generate: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({ auth: f.auth }));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: { lesson: { findMany: f.lessons } },
}));
vi.mock('@/src/server/domain/progress/chunkProgress.service', () => ({
  ChunkProgressService: { getUserProgressMap: f.progress },
}));
vi.mock('@/src/shared/feed/feedEngine', () => ({ generateFeed: f.generate }));

import { GET, POST } from '../route';

beforeEach(() => {
  vi.resetAllMocks();
  f.auth.mockResolvedValue(null);
  f.lessons.mockResolvedValue([]);
  f.progress.mockResolvedValue(new Map());
  f.generate.mockReturnValue({ items: [], hasMore: false });
});

describe('feed continuation protocol (FH-04)', () => {
  it('rejects GET with pageIndex > 0 with FEED_CONTINUATION_REQUIRED code', async () => {
    const res = await GET(new NextRequest('http://localhost/api/feed?pageIndex=1&limit=5'));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('FEED_CONTINUATION_REQUIRED');
    expect(body.error).toContain('Mutable offset pagination is discontinued');
  });

  it('allows GET with pageIndex = 0 for initial-page/direct-link consumers', async () => {
    f.generate.mockReturnValue({ items: [{ chunkId: 'c1' }], hasMore: true });
    const res = await GET(new NextRequest('http://localhost/api/feed?pageIndex=0&limit=5'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.hasMore).toBe(true);
    expect(f.generate.mock.calls[0][0].excludedChunkIds.size).toBe(0);
  });

  it('handles POST continuation with excludeChunkIds', async () => {
    f.generate.mockReturnValue({ items: [{ chunkId: 'c3' }], hasMore: false });
    const postReq = new NextRequest('http://localhost/api/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'default',
        limit: 5,
        excludeChunkIds: ['c1', 'c2'],
      }),
    });

    const res = await POST(postReq);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].chunkId).toBe('c3');
    expect(body.hasMore).toBe(false);

    const genInput = f.generate.mock.calls[0][0];
    expect(genInput.excludedChunkIds.has('c1')).toBe(true);
    expect(genInput.excludedChunkIds.has('c2')).toBe(true);
    expect(genInput.targetLimit).toBe(5);
  });

  it('rejects POST with more than 5000 excludeChunkIds with 400', async () => {
    const oversizedExclusions = Array.from({ length: 5001 }, (_, i) => `chunk_${i}`);
    const postReq = new NextRequest('http://localhost/api/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'default',
        limit: 5,
        excludeChunkIds: oversizedExclusions,
      }),
    });

    const res = await POST(postReq);
    expect(res.status).toBe(400);
  });

  it('rejects POST body exceeding 1 MiB with 413', async () => {
    const postReq = new NextRequest('http://localhost/api/feed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '1048577',
      },
      body: JSON.stringify({ channel: 'default' }),
    });

    const res = await POST(postReq);
    expect(res.status).toBe(413);
  });
});
