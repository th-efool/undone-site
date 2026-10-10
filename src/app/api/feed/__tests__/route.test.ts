import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ auth: vi.fn(), lessons: vi.fn(), progress: vi.fn(), generate: vi.fn() }));
vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({ auth: f.auth }));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({ prisma: { lesson: { findMany: f.lessons } } }));
vi.mock('@/src/server/domain/progress/chunkProgress.service', () => ({ ChunkProgressService: { getUserProgressMap: f.progress } }));
vi.mock('@/src/shared/feed/feedEngine', () => ({ generateFeed: f.generate }));
import { GET } from '../route';
import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
const lessons = [{ id: 'lesson', title: 'Reading', order: 1, thumbnailUrl: null, videoId: null, lessonType: 'ARTICLE', seasonId: 'season',
  season: { title: 'Season', order: 1, cohortId: 'cohort', cohort: { title: 'Cohort', coverImage: null } },
  chunks: [{ id: 'one', text: 'Retained text one.', durationSeconds: 10 }, { id: 'two', text: 'Retained text two.', durationSeconds: 12 }] }];
const request = (query = '') => new NextRequest(`http://localhost/api/feed${query}`);
beforeEach(() => { vi.resetAllMocks(); f.auth.mockResolvedValue({ user: { id: 'user' } }); f.lessons.mockResolvedValue(lessons);
  f.progress.mockResolvedValue(new Map()); f.generate.mockReturnValue({ items: [] }); });

describe('owned and public feed boundary', () => {
  it('queries only published accessible cohorts before fetching any progress or retained text', async () => {
    const response = await GET(request()); expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const query = f.lessons.mock.calls[0][0];
    expect(query.where).toMatchObject({ isPublished: true, season: { cohort: { is: { AND: [{ isPublished: true }, accessibleCohortWhere('user')] } } } });
    expect(f.progress).toHaveBeenCalledWith('user', ['one', 'two']);
    expect(f.generate.mock.calls[0][0].allChunks[0].content.text).toBe('Retained text one.');
  });
  it('uses public-only filtering for anonymous requests without progress lookups', async () => {
    f.auth.mockResolvedValue(null); await GET(request());
    expect(f.lessons.mock.calls[0][0].where.season.cohort.is.AND).toEqual([{ isPublished: true }, { isPublished: true, visibility: 'PUBLIC' }]);
    expect(f.progress).not.toHaveBeenCalled();
  });
  it('returns an empty feed without a less restrictive fallback when no accessible lessons exist', async () => {
    f.lessons.mockResolvedValue([]);
    expect(await (await GET(request())).json()).toEqual({ items: [] });
    expect(f.lessons).toHaveBeenCalledOnce(); expect(f.progress).not.toHaveBeenCalled();
    expect(f.generate.mock.calls[0][0].allChunks).toEqual([]);
  });
  it.each(['auth', 'lessons', 'progress'] as const)('fails closed on %s failures without a second query', async failing => {
    f[failing].mockRejectedValue(new Error('private backend detail'));
    const response = await GET(request()); expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Feed is unavailable. Try again.' });
    expect(f.lessons.mock.calls.length).toBeLessThanOrEqual(1); expect(f.generate).not.toHaveBeenCalled();
    if (failing === 'auth') expect(f.lessons).not.toHaveBeenCalled();
  });
  it('filters completed chunks using only progress with matching lesson and cohort identities', async () => {
    f.progress.mockResolvedValue(new Map([
      ['one', { lessonId: 'lesson', cohortId: 'cohort', status: 'COMPLETED', watchedSeconds: 10, totalSeconds: 10 }],
      ['two', { lessonId: 'foreign', cohortId: 'foreign', status: 'COMPLETED', watchedSeconds: 12, totalSeconds: 12 }],
    ]));
    await GET(request()); const input = f.generate.mock.calls[0][0];
    expect(input.allChunks.map((chunk: { chunkId: string }) => chunk.chunkId)).toEqual(['two']);
    expect(Object.keys(input.chunkProgress)).toEqual(['one']);
  });
  it('preserves explicit completed-chunk revisits and scopes lesson/cohort selection before projection', async () => {
    f.progress.mockResolvedValue(new Map([['one', { lessonId: 'lesson', cohortId: 'cohort', status: 'COMPLETED' }]]));
    await GET(request('?cohort=cohort&lesson=lesson&chunk=one&channel=deep_dive'));
    expect(f.lessons.mock.calls[0][0].where).toMatchObject({ id: 'lesson', season: { cohortId: 'cohort' } });
    expect(f.generate.mock.calls[0][0]).toMatchObject({ requestedCohortId: 'cohort', requestedLessonId: 'lesson', requestedChunkId: 'one', activeChannel: 'deep_dive' });
    expect(f.generate.mock.calls[0][0].allChunks).toHaveLength(2);
  });
  it('rejects an unavailable selected chunk instead of substituting another lesson artifact', async () => {
    expect((await GET(request('?chunk=foreign'))).status).toBe(404);
    expect(f.progress).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
  });
  it('never sends malformed retained reading bodies to the feed engine', async () => {
    f.lessons.mockResolvedValue([{ ...lessons[0], chunks: [{ id: 'one' }] }]);
    await GET(request()); expect(f.generate.mock.calls[0][0].allChunks).toEqual([]); expect(f.progress).not.toHaveBeenCalled();
  });
  it('preserves timezone offset behavior within valid timezone bounds', async () => {
    const now = Date.now(); await GET(request('?timezoneOffset=120'));
    expect(Math.abs(f.generate.mock.calls[0][0].currentTime.getTime() - (now - 120 * 60_000))).toBeLessThan(1000);
  });
  it.each(['?limit=0', '?pageIndex=-1', '?pageIndex=101', '?limit=21', '?pageIndex=NaN', '?cohort=', '?lesson=' + 'x'.repeat(129), '?timezoneOffset=900'])('rejects invalid query %s before SQL reads', async query => {
    expect((await GET(request(query))).status).toBe(400); expect(f.lessons).not.toHaveBeenCalled();
  });
});
