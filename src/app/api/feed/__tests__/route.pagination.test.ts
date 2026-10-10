import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ auth: vi.fn(), lessons: vi.fn(), progress: vi.fn(), generate: vi.fn() }));
vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({ auth: f.auth }));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({ prisma: { lesson: { findMany: f.lessons } } }));
vi.mock('@/src/server/domain/progress/chunkProgress.service', () => ({ ChunkProgressService: { getUserProgressMap: f.progress } }));
vi.mock('@/src/shared/feed/feedEngine', () => ({ generateFeed: f.generate }));
import { GET } from '../route';
beforeEach(() => { vi.resetAllMocks(); f.auth.mockResolvedValue(null); f.lessons.mockResolvedValue([]); });
describe('feed pagination', () => {
  it('requests enough ranked candidates and slices the selected page', async () => {
    f.generate.mockReturnValue({ items: Array.from({ length: 15 }, (_, index) => ({ chunkId: `chunk_${index}` })) });
    const response = await GET(new NextRequest('http://localhost/api/feed?pageIndex=1&limit=5'));
    expect(response.status).toBe(200);
    expect((await response.json()).items.map((item: { chunkId: string }) => item.chunkId)).toEqual(['chunk_5', 'chunk_6', 'chunk_7', 'chunk_8', 'chunk_9']);
    expect(f.generate.mock.calls[0][0].feedSize).toBe(10);
    expect(f.lessons).toHaveBeenCalledOnce();
  });
  it('returns an empty page beyond the available ranked results', async () => {
    f.generate.mockReturnValue({ items: [{ chunkId: 'only' }] });
    expect(await (await GET(new NextRequest('http://localhost/api/feed?pageIndex=1&limit=5'))).json()).toEqual({ items: [] });
  });
});
