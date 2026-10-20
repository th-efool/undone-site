import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findFirst: vi.fn(),
  getCommunityChannels: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({
  auth: mocks.auth,
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    cohort: {
      findFirst: mocks.findFirst,
    },
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/repositories/community.repo', () => ({
  communityRepo: {
    getCommunityChannels: mocks.getCommunityChannels,
  },
}));

import { GET } from '../route';

describe('GET /api/community/[cohortId]/channels - Caching & Auth Boundary', () => {
  const createParams = (cohortId: string) => ({
    params: Promise.resolve({ cohortId }),
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a) returns community channels with public micro-cache and vary headers for public cohorts', async () => {
    mocks.auth.mockResolvedValue(null);
    mocks.findFirst.mockResolvedValue({
      id: 'cohort-public',
      visibility: 'PUBLIC',
    });
    const channels = [
      { id: 'chan-1', name: 'general', messages: [] },
      { id: 'chan-2', name: 'announcements', messages: [] },
    ];
    mocks.getCommunityChannels.mockResolvedValue({
      channels,
    });

    const response = await GET(
      new Request('http://localhost/api/community/cohort-public/channels'),
      createParams('cohort-public')
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(channels);
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=15, stale-while-revalidate=60');
    expect(response.headers.get('Vary')).toBe('Cookie, Authorization');
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'cohort-public' }),
      select: { id: true, visibility: true },
    });
    expect(mocks.getCommunityChannels).toHaveBeenCalledWith('cohort-public');
  });

  it('b) returns private no-cache headers without Vary header for private cohort with member session', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'member-1' } });
    mocks.findFirst.mockResolvedValue({
      id: 'cohort-private',
      visibility: 'PRIVATE',
    });
    const channels = [{ id: 'chan-priv', name: 'private-discussion', messages: [] }];
    mocks.getCommunityChannels.mockResolvedValue({
      channels,
    });

    const response = await GET(
      new Request('http://localhost/api/community/cohort-private/channels'),
      createParams('cohort-private')
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(channels);
    expect(response.headers.get('Cache-Control')).toBe('private, no-cache, no-store');
    expect(response.headers.get('Vary')).toBeNull();
    expect(mocks.getCommunityChannels).toHaveBeenCalledWith('cohort-private');
  });

  it('c) returns 404 if cohort is inaccessible or does not exist', async () => {
    mocks.auth.mockResolvedValue(null);
    mocks.findFirst.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/community/cohort-missing/channels'),
      createParams('cohort-missing')
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Community not found' });
    expect(mocks.getCommunityChannels).not.toHaveBeenCalled();
  });

  it('d) returns 404 if community channels entity is missing', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'member-1' } });
    mocks.findFirst.mockResolvedValue({
      id: 'cohort-empty',
      visibility: 'PUBLIC',
    });
    mocks.getCommunityChannels.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/community/cohort-empty/channels'),
      createParams('cohort-empty')
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Community not found' });
    expect(mocks.getCommunityChannels).toHaveBeenCalledWith('cohort-empty');
  });

  it('e) handles database error and returns 500 when cohort lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.auth.mockResolvedValue(null);
    mocks.findFirst.mockRejectedValue(new Error('Postgres connection failure'));

    const response = await GET(
      new Request('http://localhost/api/community/cohort-err/channels'),
      createParams('cohort-err')
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
    expect(mocks.getCommunityChannels).not.toHaveBeenCalled();
  });

  it('e2) handles database error and returns 500 when channel lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.auth.mockResolvedValue(null);
    mocks.findFirst.mockResolvedValue({
      id: 'cohort-err2',
      visibility: 'PUBLIC',
    });
    mocks.getCommunityChannels.mockRejectedValue(new Error('Postgres query timeout'));

    const response = await GET(
      new Request('http://localhost/api/community/cohort-err2/channels'),
      createParams('cohort-err2')
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
  });
});
