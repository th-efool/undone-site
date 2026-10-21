import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  channelFindUnique: vi.fn(),
  cohortMemberFindUnique: vi.fn(),
  userRestrictionFindUnique: vi.fn(),
  getChannelMessages: vi.fn(),
  addMessage: vi.fn(),
  getChannelWithParent: vi.fn(),
  createMessageTransaction: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: mocks.getUser,
}));

vi.mock('@/src/server/infrastructure/db/postgres/repositories/messaging.repo', () => ({
  messagingRepo: {
    getChannelWithParent: mocks.getChannelWithParent,
    createMessageTransaction: mocks.createMessageTransaction,
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    channel: {
      findUnique: mocks.channelFindUnique,
    },
    cohortMember: {
      findUnique: mocks.cohortMemberFindUnique,
    },
    userRestriction: {
      findUnique: mocks.userRestrictionFindUnique,
    },
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/repositories/community.repo', () => ({
  communityRepo: {
    getChannelMessages: mocks.getChannelMessages,
    addMessage: mocks.addMessage,
  },
}));

import { GET, POST } from '../route';

describe('API: /api/community/channels/[channelId]/messages - Member Authorization & Validation', () => {
  const createParams = (channelId: string) => ({
    params: Promise.resolve({ channelId }),
  });

  const validChannel = {
    id: 'chan-1',
    community: {
      cohortId: 'cohort-1',
      chatEnabled: true,
      cohort: {
        creatorId: 'user-creator',
      },
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getChannelWithParent.mockImplementation(async (id: string) => {
      return mocks.channelFindUnique({ where: { id } });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a) 401 Unauthorized when user is unauthenticated', async () => {
    mocks.getUser.mockResolvedValue(null);

    const getRes = await GET(
      new Request('http://localhost/api/community/channels/chan-1/messages'),
      createParams('chan-1')
    );
    expect(getRes.status).toBe(401);
    expect(await getRes.json()).toEqual({ error: 'Unauthorized' });

    const postRes = await POST(
      new Request('http://localhost/api/community/channels/chan-1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Hello' }),
      }),
      createParams('chan-1')
    );
    expect(postRes.status).toBe(401);
    expect(await postRes.json()).toEqual({ error: 'Unauthorized' });
  });

  it('b) 403 Forbidden when user is a shared guest account', async () => {
    mocks.getUser.mockResolvedValue({ id: 'guest-1', email: 'guest@undone.com' });

    const getRes = await GET(
      new Request('http://localhost/api/community/channels/chan-1/messages'),
      createParams('chan-1')
    );
    expect(getRes.status).toBe(403);
    expect(await getRes.json()).toEqual({ error: 'Guest accounts cannot access community messages' });

    const postRes = await POST(
      new Request('http://localhost/api/community/channels/chan-1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Hello' }),
      }),
      createParams('chan-1')
    );
    expect(postRes.status).toBe(403);
    expect(await postRes.json()).toEqual({ error: 'Guest accounts cannot send community messages' });
  });

  it('c) 403 Forbidden when user is restricted from messaging', async () => {
    mocks.getUser.mockResolvedValue({ id: 'user-restricted', email: 'restricted@test.com' });
    mocks.userRestrictionFindUnique.mockResolvedValue({ expiresAt: null });

    const postRes = await POST(
      new Request('http://localhost/api/community/channels/chan-1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Hello' }),
      }),
      createParams('chan-1')
    );
    expect(postRes.status).toBe(403);
    expect(await postRes.json()).toEqual({
      error: 'Messaging privileges are restricted for this account',
    });
  });

  it('d) 403 Forbidden when user is not a cohort member', async () => {
    mocks.getUser.mockResolvedValue({ id: 'user-nonmember' });
    mocks.userRestrictionFindUnique.mockResolvedValue(null);
    mocks.channelFindUnique.mockResolvedValue(validChannel);
    mocks.cohortMemberFindUnique.mockResolvedValue(null);

    const postRes = await POST(
      new Request('http://localhost/api/community/channels/chan-1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Hello' }),
      }),
      createParams('chan-1')
    );
    expect(postRes.status).toBe(403);
    expect(await postRes.json()).toEqual({
      error: 'Active cohort membership is required to post in this channel',
    });
  });

  it('e) 400 Bad Request when message exceeds 4000 characters or is empty', async () => {
    mocks.getUser.mockResolvedValue({ id: 'user-member' });
    mocks.userRestrictionFindUnique.mockResolvedValue(null);

    // Empty content
    const resEmpty = await POST(
      new Request('http://localhost/api/community/channels/chan-1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '   ' }),
      }),
      createParams('chan-1')
    );
    expect(resEmpty.status).toBe(400);
    expect(await resEmpty.json()).toEqual({ error: 'Message content cannot be empty' });

    // Exceeds limit
    const resOversize = await POST(
      new Request('http://localhost/api/community/channels/chan-1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'a'.repeat(4001) }),
      }),
      createParams('chan-1')
    );
    expect(resOversize.status).toBe(400);
    expect(await resOversize.json()).toEqual({
      error: 'Message content exceeds maximum allowed length of 4000 characters',
    });
  });

  it('f) 201 Created and saves message for active member', async () => {
    mocks.getUser.mockResolvedValue({ id: 'user-member' });
    mocks.userRestrictionFindUnique.mockResolvedValue(null);
    mocks.channelFindUnique.mockResolvedValue(validChannel);
    mocks.cohortMemberFindUnique.mockResolvedValue({ role: 'EXPLORER' });
    const now = new Date();
    const createdMsg = {
      id: 'msg-1',
      content: 'Valid message',
      channelId: 'chan-1',
      authorId: 'user-member',
      createdAt: now,
    };
    mocks.createMessageTransaction.mockResolvedValue({
      message: createdMsg,
      deliveryId: 'del-1',
      isIdempotentReplay: false,
    });

    const res = await POST(
      new Request('http://localhost/api/community/channels/chan-1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Valid message' }),
      }),
      createParams('chan-1')
    );

    expect(res.status).toBe(201);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await res.json()).toEqual({
      ...createdMsg,
      createdAt: now.toISOString(),
    });
    expect(mocks.createMessageTransaction).toHaveBeenCalledWith({
      channelId: 'chan-1',
      authorId: 'user-member',
      content: 'Valid message',
      clientRequestId: undefined,
      replyToId: undefined,
    });
  });

  it('g) GET 200 OK returns messages in chronological order with private no-store headers', async () => {
    mocks.getUser.mockResolvedValue({ id: 'user-member' });
    mocks.channelFindUnique.mockResolvedValue(validChannel);
    mocks.cohortMemberFindUnique.mockResolvedValue({ role: 'EXPLORER' });

    const d1 = new Date('2026-10-20T10:00:00.000Z');
    const d2 = new Date('2026-10-20T10:05:00.000Z');
    const messagesDesc = [
      { id: 'msg-2', content: 'newer msg', createdAt: d2, channelId: 'chan-1' },
      { id: 'msg-1', content: 'older msg', createdAt: d1, channelId: 'chan-1' },
    ];
    mocks.getChannelMessages.mockResolvedValue(messagesDesc);

    const res = await GET(
      new Request('http://localhost/api/community/channels/chan-1/messages?limit=20'),
      createParams('chan-1')
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const data = await res.json();
    expect(data[0].id).toBe('msg-1');
    expect(data[1].id).toBe('msg-2');
  });
});
