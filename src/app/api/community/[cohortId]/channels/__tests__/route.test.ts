import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  cohortFindUnique: vi.fn(),
  cohortMemberFindUnique: vi.fn(),
  getCommunityChannels: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({
  auth: mocks.auth,
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    cohort: {
      findUnique: mocks.cohortFindUnique,
    },
    cohortMember: {
      findUnique: mocks.cohortMemberFindUnique,
    },
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/repositories/community.repo', () => ({
  communityRepo: {
    getCommunityChannels: mocks.getCommunityChannels,
  },
}));

import { GET } from '../route';

describe('GET /api/community/[cohortId]/channels - Member-only Authorization & Caching', () => {
  const createParams = (cohortId: string) => ({
    params: Promise.resolve({ cohortId }),
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a) returns 401 Unauthorized for unauthenticated requests', async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/community/cohort-1/channels'),
      createParams('cohort-1')
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(mocks.getCommunityChannels).not.toHaveBeenCalled();
  });

  it('b) returns 403 Forbidden for shared guest accounts', async () => {
    mocks.auth.mockResolvedValue({
      user: { id: 'guest-user', email: 'guest@undone.com' },
    });

    const response = await GET(
      new Request('http://localhost/api/community/cohort-1/channels'),
      createParams('cohort-1')
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Guest accounts cannot access community channels',
    });
    expect(mocks.getCommunityChannels).not.toHaveBeenCalled();
  });

  it('c) returns 403 Forbidden for non-member authenticated users', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-nonmember' } });
    mocks.cohortFindUnique.mockResolvedValue({
      id: 'cohort-1',
      creatorId: 'user-creator',
      isPublished: true,
      community: { id: 'comm-1', chatEnabled: true },
    });
    mocks.cohortMemberFindUnique.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/community/cohort-1/channels'),
      createParams('cohort-1')
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Active cohort membership is required to access community channels',
    });
    expect(mocks.getCommunityChannels).not.toHaveBeenCalled();
  });

  it('d) returns 403 Forbidden when chat is disabled for the community', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-member' } });
    mocks.cohortFindUnique.mockResolvedValue({
      id: 'cohort-1',
      creatorId: 'user-creator',
      isPublished: true,
      community: { id: 'comm-1', chatEnabled: false },
    });

    const response = await GET(
      new Request('http://localhost/api/community/cohort-1/channels'),
      createParams('cohort-1')
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Chat is disabled for this community',
    });
  });

  it('e) returns 200 OK with channels and private no-store headers for enrolled member', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-member' } });
    mocks.cohortFindUnique.mockResolvedValue({
      id: 'cohort-1',
      creatorId: 'user-creator',
      isPublished: true,
      community: { id: 'comm-1', chatEnabled: true },
    });
    mocks.cohortMemberFindUnique.mockResolvedValue({ role: 'EXPLORER' });
    const channels = [
      { id: 'chan-1', name: 'general', communityId: 'comm-1' },
      { id: 'chan-2', name: 'resources', communityId: 'comm-1' },
    ];
    mocks.getCommunityChannels.mockResolvedValue({ channels });

    const response = await GET(
      new Request('http://localhost/api/community/cohort-1/channels'),
      createParams('cohort-1')
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(channels);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('f) returns 200 OK for cohort creator without explicit member row', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-creator' } });
    mocks.cohortFindUnique.mockResolvedValue({
      id: 'cohort-1',
      creatorId: 'user-creator',
      isPublished: true,
      community: { id: 'comm-1', chatEnabled: true },
    });
    const channels = [{ id: 'chan-1', name: 'general', communityId: 'comm-1' }];
    mocks.getCommunityChannels.mockResolvedValue({ channels });

    const response = await GET(
      new Request('http://localhost/api/community/cohort-1/channels'),
      createParams('cohort-1')
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(channels);
    expect(mocks.cohortMemberFindUnique).not.toHaveBeenCalled();
  });
});
