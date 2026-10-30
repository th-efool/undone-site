import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  connectToMongoDB: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({
  auth: mocks.auth,
}));

vi.mock('@/src/server/infrastructure/db/mongodb/client', () => ({
  connectToMongoDB: mocks.connectToMongoDB,
}));

vi.mock('@/src/server/database/mongo/models/UserChannelConfig', () => {
  return {
    VALID_CHANNEL_IDS: ['default', 'spark', 'explore', 'build', 'listen', 'deep_dive', 'quick'],
    UserChannelConfig: {
      findOne: mocks.findOne,
      findOneAndUpdate: mocks.findOneAndUpdate,
    },
  };
});

import { GET, PUT } from '../route';

describe('GET /api/user/channel-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectToMongoDB.mockResolvedValue(undefined);
  });

  it('returns 401 when user is not authenticated', async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 503 when MongoDB fails to connect', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'usr-1' } });
    mocks.connectToMongoDB.mockRejectedValue(new Error('Connection failed'));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Database service unavailable' });
  });

  it('returns 200 with sanitized preferences', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'usr-1' } });
    mocks.findOne.mockReturnValue({
      lean: () => ({
        exec: vi.fn().mockResolvedValue({
          activeChannel: 'explore',
          prefs: new Map([
            ['depth', '0.80'],
            ['weekly_goal', '12 hours'],
            ['invalid_key', 'some_value'],
            ['spark_novelty', '0.90'],
          ]),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.activeChannel).toBe('explore');
    expect(data.prefs).toEqual({
      depth: '0.80',
      weekly_goal: '12 hours',
      spark_novelty: '0.90',
    });
    // Invalid key filtered out
    expect(data.prefs.invalid_key).toBeUndefined();
  });
});

describe('PUT /api/user/channel-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectToMongoDB.mockResolvedValue(undefined);
  });

  it('returns 401 when user is not authenticated', async () => {
    mocks.auth.mockResolvedValue(null);
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ activeChannel: 'spark' }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 on malformed JSON body', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'usr-1' } });
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: 'invalid-json',
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' });
  });

  it('returns 400 on unrecognized active channel', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'usr-1' } });
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ activeChannel: 'unsupported_channel' }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid active channel parameter' });
  });

  it('returns 400 on out-of-range numeric slider', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'usr-1' } });
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ prefs: { depth: '1.50' } }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid preference parameter: depth' });
  });

  it('returns 400 on unrecognized enum string', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'usr-1' } });
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ prefs: { weekly_goal: '100 hours' } }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid preference parameter: weekly_goal' });
  });

  it('returns 400 when exceeding 50 preference parameters', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'usr-1' } });
    const manyPrefs: Record<string, string> = {};
    for (let i = 0; i < 55; i++) {
      manyPrefs[`spark_p${i}`] = '0.50';
    }
    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ prefs: manyPrefs }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Too many preference parameters' });
  });

  it('successfully updates and returns normalized configuration', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'usr-1' } });
    mocks.findOneAndUpdate.mockReturnValue({
      lean: () => ({
        exec: vi.fn().mockResolvedValue({
          activeChannel: 'build',
          prefs: {
            build_guidance: '0.40',
            weekly_goal: '8 hours',
          },
        }),
      }),
    });

    const req = new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({
        activeChannel: 'build',
        prefs: {
          build_guidance: 0.4,
          weekly_goal: '8 hours',
        },
      }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.activeChannel).toBe('build');
    expect(data.prefs).toEqual({
      build_guidance: '0.40',
      weekly_goal: '8 hours',
    });
  });
});
