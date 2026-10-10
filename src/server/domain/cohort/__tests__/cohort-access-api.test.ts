import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const f = vi.hoisted(() => ({ auth: vi.fn(), getUser: vi.fn(), cohort: vi.fn(), lesson: vi.fn(), channel: vi.fn(),
  join: vi.fn(), channels: vi.fn(), message: vi.fn(), progress: vi.fn() }));
vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({ auth: f.auth }));
vi.mock('@/src/server/infrastructure/auth/getUser', () => ({ getUser: f.getUser }));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({ prisma: {
  cohort: { findFirst: f.cohort }, lesson: { findFirst: f.lesson }, channel: { findFirst: f.channel }, cohortMember: { upsert: f.join },
} }));
vi.mock('@/src/server/infrastructure/db/postgres/repositories/community.repo', () => ({ communityRepo: { getCommunityChannels: f.channels, addMessage: f.message } }));
vi.mock('@/src/server/domain/progress/chunkProgress.service', () => ({ ChunkProgressService: { recordProgress: f.progress } }));
import { POST as join } from '@/src/app/api/cohort/[id]/join/route';
import { GET as channels } from '@/src/app/api/community/[cohortId]/channels/route';
import { POST as message } from '@/src/app/api/community/channels/[channelId]/messages/route';
import { POST as progress } from '@/src/app/api/progress/chunk/route';
import { accessibleCohortWhere } from '../cohortAccessPolicy';
import { generateMetadata } from '@/src/app/(dashboard)/cohort/[cohortId]/page';
const request = (body: unknown = {}) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); f.auth.mockResolvedValue({ user: { id: 'user' } }); f.getUser.mockResolvedValue({ id: 'user' }); });

describe('cohort API access boundaries', () => {
  it('protects metadata independently of the layout and fails closed on authentication failure', async () => {
    f.auth.mockResolvedValueOnce(null); f.cohort.mockResolvedValue(null);
    const hidden = await generateMetadata({ params: Promise.resolve({ cohortId: 'private' }) });
    expect(hidden.title).not.toContain('Secret title');
    expect(f.cohort).toHaveBeenCalledWith({ where: { id: 'private', isPublished: true, visibility: 'PUBLIC' }, select: { title: true, description: true, coverImage: true } });
    f.cohort.mockResolvedValue({ title: 'Owned title', description: 'Owned description', coverImage: null });
    expect((await generateMetadata({ params: Promise.resolve({ cohortId: 'private' }) })).title).toBe('Owned title | Undone');
    f.auth.mockRejectedValueOnce(new Error('Authentication failed')); f.cohort.mockClear();
    await expect(generateMetadata({ params: Promise.resolve({ cohortId: 'private' }) })).rejects.toThrow('Authentication failed');
    expect(f.cohort).not.toHaveBeenCalled();
  });
  it('requires authentication before join lookup and denies unknown/private cohorts before membership writes', async () => {
    f.auth.mockResolvedValueOnce(null);
    expect((await join(request(), { params: Promise.resolve({ id: 'private' }) })).status).toBe(401);
    expect(f.cohort).not.toHaveBeenCalled();
    f.cohort.mockResolvedValue(null);
    expect((await join(request(), { params: Promise.resolve({ id: 'private' }) })).status).toBe(404);
    expect(f.cohort).toHaveBeenCalledWith({ where: { id: 'private', ...accessibleCohortWhere('user') }, select: { id: true } });
    expect(f.join).not.toHaveBeenCalled();
  });
  it('joins an accessible cohort idempotently without exposing an invite bypass', async () => {
    f.cohort.mockResolvedValue({ id: 'public' });
    for (let i = 0; i < 2; i++) expect((await join(request(), { params: Promise.resolve({ id: 'public' }) })).status).toBe(200);
    expect(f.join).toHaveBeenCalledWith({ where: { cohortId_userId: { cohortId: 'public', userId: 'user' } }, update: {}, create: { userId: 'user', cohortId: 'public' } });
  });
  it('guards channel reads before loading messages and uses public-only policy for anonymous users', async () => {
    f.auth.mockResolvedValue(null); f.cohort.mockResolvedValue(null);
    expect((await channels(request(), { params: Promise.resolve({ cohortId: 'private' }) })).status).toBe(404);
    expect(f.channels).not.toHaveBeenCalled();
    expect(f.cohort).toHaveBeenCalledWith({ where: { id: 'private', isPublished: true, visibility: 'PUBLIC' }, select: { id: true } });
    f.cohort.mockResolvedValue({ id: 'public' }); f.channels.mockResolvedValue({ channels: [{ id: 'channel' }] });
    expect(await (await channels(request(), { params: Promise.resolve({ cohortId: 'public' }) })).json()).toEqual([{ id: 'channel' }]);
  });
  it('denies private/unknown channel message writes before repository mutation', async () => {
    f.channel.mockResolvedValue(null);
    expect((await message(request({ content: 'Hello' }), { params: Promise.resolve({ channelId: 'private' }) })).status).toBe(404);
    expect(f.channel).toHaveBeenCalledWith({ where: { id: 'private', community: { cohort: accessibleCohortWhere('user') } }, select: { id: true } });
    expect(f.message).not.toHaveBeenCalled();
    f.getUser.mockResolvedValue(null);
    expect((await message(request({ content: 'Hello' }), { params: Promise.resolve({ channelId: 'private' }) })).status).toBe(401);
  });
  it('requires an accessible cohort and an actual chunk belonging to the supplied lesson before progress writes', async () => {
    const body = { cohortId: 'private', lessonId: 'lesson', chunkId: 'chunk', watchedSeconds: 12, totalSeconds: 60 };
    for (const lesson of [null, { chunks: [{ id: 'different' }] }, { chunks: null }]) {
      f.lesson.mockResolvedValue(lesson); expect((await progress(request(body))).status).toBe(404);
    }
    expect(f.progress).not.toHaveBeenCalled();
    expect(f.lesson).toHaveBeenCalledWith({ where: { id: 'lesson', season: { cohortId: 'private', cohort: accessibleCohortWhere('user') } }, select: { chunks: true } });
    f.lesson.mockResolvedValue({ chunks: [{ id: 'chunk' }] });
    expect((await progress(request(body))).status).toBe(200); expect(f.progress).toHaveBeenCalledOnce();
  });
  it('fails closed when authentication fails without reading content or mutating progress', async () => {
    f.auth.mockRejectedValue(new Error('Authentication unavailable'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await channels(request(), { params: Promise.resolve({ cohortId: 'private' }) })).status).toBe(500);
    expect((await join(request(), { params: Promise.resolve({ id: 'private' }) })).status).toBe(500);
    expect((await progress(request({ cohortId: 'private', lessonId: 'lesson', chunkId: 'chunk' }))).status).toBe(500);
    expect(f.channels).not.toHaveBeenCalled(); expect(f.cohort).not.toHaveBeenCalled(); expect(f.lesson).not.toHaveBeenCalled(); expect(f.join).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
