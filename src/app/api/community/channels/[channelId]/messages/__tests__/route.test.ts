import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  channelFindFirst: vi.fn(),
  getChannelMessages: vi.fn(),
  addMessage: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: mocks.getUser,
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    channel: {
      findFirst: mocks.channelFindFirst,
    },
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/repositories/community.repo', () => ({
  communityRepo: {
    getChannelMessages: mocks.getChannelMessages,
    addMessage: mocks.addMessage,
  },
}));

import { GET, POST, clearVerifiedChannelsForTests } from '../route';

describe('API: /api/community/channels/[channelId]/messages - Weak ETag & Memoization', () => {
  const createParams = (channelId: string) => ({
    params: Promise.resolve({ channelId }),
  });

  beforeEach(() => {
    vi.resetAllMocks();
    clearVerifiedChannelsForTests();
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
    expect(mocks.channelFindFirst).not.toHaveBeenCalled();
  });

  it('b) 404 Channel not found when channel does not exist or is inaccessible', async () => {
    mocks.getUser.mockResolvedValue({ id: 'user-1' });
    mocks.channelFindFirst.mockResolvedValue(null);

    const res = await GET(
      new Request('http://localhost/api/community/channels/chan-missing/messages'),
      createParams('chan-missing')
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Channel not found' });
    expect(mocks.getChannelMessages).not.toHaveBeenCalled();
  });

  it('c) 200 OK with messages and ETag header on valid request', async () => {
    mocks.getUser.mockResolvedValue({ id: 'user-1' });
    mocks.channelFindFirst.mockResolvedValue({ id: 'chan-1' });

    const d1 = new Date('2026-10-20T10:00:00.000Z');
    const d2 = new Date('2026-10-20T10:05:00.000Z');
    const messages = [
      { id: 'msg-2', content: 'newer msg', createdAt: d2, channelId: 'chan-1', authorId: 'user-1' },
      { id: 'msg-1', content: 'older msg', createdAt: d1, channelId: 'chan-1', authorId: 'user-2' },
    ];
    mocks.getChannelMessages.mockResolvedValue(messages);

    const expectedEtag = `W/"msg-2:${d2.getTime()}:2"`;

    const res = await GET(
      new Request('http://localhost/api/community/channels/chan-1/messages?limit=20'),
      createParams('chan-1')
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-cache');
    expect(res.headers.get('ETag')).toBe(expectedEtag);

    // Reversed chronological ordering for UI display: [msg-1, msg-2]
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe('msg-1');
    expect(data[1].id).toBe('msg-2');
    expect(mocks.getChannelMessages).toHaveBeenCalledWith('chan-1', 20, undefined);
  });

  it('d) 304 Not Modified when If-None-Match matches computed ETag without returning body', async () => {
    mocks.getUser.mockResolvedValue({ id: 'user-1' });
    mocks.channelFindFirst.mockResolvedValue({ id: 'chan-1' });

    const d1 = new Date('2026-10-20T10:00:00.000Z');
    const messages = [
      { id: 'msg-1', content: 'test', createdAt: d1, channelId: 'chan-1', authorId: 'user-1' },
    ];
    mocks.getChannelMessages.mockResolvedValue(messages);

    const etag = `W/"msg-1:${d1.getTime()}:1"`;

    const res = await GET(
      new Request('http://localhost/api/community/channels/chan-1/messages', {
        headers: { 'if-none-match': etag },
      }),
      createParams('chan-1')
    );

    expect(res.status).toBe(304);
    expect(res.headers.get('Cache-Control')).toBe('private, no-cache');
    expect(res.headers.get('ETag')).toBe(etag);
    const text = await res.text();
    expect(text).toBe('');
  });

  it('d2) returns 200 when empty messages list, and 304 on matching W/"empty"', async () => {
    mocks.getUser.mockResolvedValue({ id: 'user-1' });
    mocks.channelFindFirst.mockResolvedValue({ id: 'chan-1' });
    mocks.getChannelMessages.mockResolvedValue([]);

    const resFresh = await GET(
      new Request('http://localhost/api/community/channels/chan-1/messages'),
      createParams('chan-1')
    );
    expect(resFresh.status).toBe(200);
    expect(resFresh.headers.get('ETag')).toBe('W/"empty"');
    expect(await resFresh.json()).toEqual([]);

    const resMatch = await GET(
      new Request('http://localhost/api/community/channels/chan-1/messages', {
        headers: { 'if-none-match': 'W/"empty"' },
      }),
      createParams('chan-1')
    );
    expect(resMatch.status).toBe(304);
    expect(resMatch.headers.get('ETag')).toBe('W/"empty"');
    expect(await resMatch.text()).toBe('');
  });

  it('e) Channel verification memoization: second call within 60s bypasses prisma.channel.findFirst', async () => {
    mocks.getUser.mockResolvedValue({ id: 'user-mem-1' });
    mocks.channelFindFirst.mockResolvedValue({ id: 'chan-mem-1' });
    mocks.getChannelMessages.mockResolvedValue([]);

    // First call: checks DB
    const res1 = await GET(
      new Request('http://localhost/api/community/channels/chan-mem-1/messages'),
      createParams('chan-mem-1')
    );
    expect(res1.status).toBe(200);
    expect(mocks.channelFindFirst).toHaveBeenCalledTimes(1);

    // Second call with same user & channel: should bypass prisma.channel.findFirst!
    const res2 = await GET(
      new Request('http://localhost/api/community/channels/chan-mem-1/messages'),
      createParams('chan-mem-1')
    );
    expect(res2.status).toBe(200);
    expect(mocks.channelFindFirst).toHaveBeenCalledTimes(1);

    // Third call after clearing verified channels: queries DB again
    clearVerifiedChannelsForTests();
    const res3 = await GET(
      new Request('http://localhost/api/community/channels/chan-mem-1/messages'),
      createParams('chan-mem-1')
    );
    expect(res3.status).toBe(200);
    expect(mocks.channelFindFirst).toHaveBeenCalledTimes(2);
  });

  it('f) POST adds message successfully', async () => {
    mocks.getUser.mockResolvedValue({ id: 'user-1' });
    mocks.channelFindFirst.mockResolvedValue({ id: 'chan-1' });
    const created = {
      id: 'msg-new',
      content: 'Hello everyone!',
      channelId: 'chan-1',
      authorId: 'user-1',
      createdAt: new Date(),
    };
    mocks.addMessage.mockResolvedValue(created);

    const res = await POST(
      new Request('http://localhost/api/community/channels/chan-1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Hello everyone!' }),
      }),
      createParams('chan-1')
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe('msg-new');
    expect(data.content).toBe('Hello everyone!');
    expect(mocks.channelFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'chan-1' }),
      select: { id: true },
    });
    expect(mocks.addMessage).toHaveBeenCalledWith('chan-1', 'user-1', 'Hello everyone!');
  });

  it('f2) POST returns 400 when content is missing', async () => {
    mocks.getUser.mockResolvedValue({ id: 'user-1' });

    const res = await POST(
      new Request('http://localhost/api/community/channels/chan-1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      }),
      createParams('chan-1')
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Content is required' });
    expect(mocks.addMessage).not.toHaveBeenCalled();
  });

  it('f3) POST returns 404 when channel is inaccessible or not found', async () => {
    mocks.getUser.mockResolvedValue({ id: 'user-1' });
    mocks.channelFindFirst.mockResolvedValue(null);

    const res = await POST(
      new Request('http://localhost/api/community/channels/chan-404/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test message' }),
      }),
      createParams('chan-404')
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Channel not found' });
    expect(mocks.addMessage).not.toHaveBeenCalled();
  });

  it('g) GET handles internal error gracefully', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.getUser.mockResolvedValue({ id: 'user-1' });
    mocks.channelFindFirst.mockRejectedValue(new Error('DB failure'));

    const res = await GET(
      new Request('http://localhost/api/community/channels/chan-err/messages'),
      createParams('chan-err')
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal server error' });
  });
});
