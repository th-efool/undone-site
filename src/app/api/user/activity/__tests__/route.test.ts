import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  record: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({
  auth: mocks.auth,
}));

vi.mock('@/src/server/infrastructure/logging/activityBuffer.service', () => ({
  activityBuffer: {
    record: mocks.record,
  },
}));

import { POST } from '../route';

function createRequest(body: any, rawBody?: string) {
  return new Request('http://localhost/api/user/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody !== undefined ? rawBody : JSON.stringify(body),
  });
}

describe('POST /api/user/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'test-user-123' } });
  });

  it('returns 401 when user is not authenticated', async () => {
    mocks.auth.mockResolvedValue(null);

    const req = createRequest({ eventType: 'LESSON_VIEW', entityId: 'lesson-1' });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toEqual({ error: 'Unauthorized' });
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it('returns 401 when session has no user id', async () => {
    mocks.auth.mockResolvedValue({ user: {} });

    const req = createRequest({ eventType: 'LESSON_VIEW', entityId: 'lesson-1' });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toEqual({ error: 'Unauthorized' });
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid JSON body', async () => {
    const req = createRequest(null, '{ malformed json:');
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid JSON body');
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it('returns 400 when single event is missing eventType', async () => {
    const req = createRequest({ entityId: 'lesson-1' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Missing required field');
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it('returns 400 when single event is missing entityId', async () => {
    const req = createRequest({ eventType: 'LESSON_VIEW' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Missing required field');
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it('returns 400 when batch events array is empty', async () => {
    const req = createRequest({ events: [] });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('must be a non-empty array');
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it('returns 400 when an event in batch events is missing eventType or entityId', async () => {
    const req = createRequest({
      events: [
        { eventType: 'LESSON_VIEW', entityId: 'lesson-1' },
        { entityId: 'lesson-2' }, // missing eventType
      ],
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('missing required eventType or entityId');
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it('returns 200 on valid single event and buffers it', async () => {
    const payload = {
      eventType: 'LESSON_VIEW',
      entityId: 'lesson-42',
      metadata: { progressSeconds: 120, completed: false },
    };

    const req = createRequest(payload);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ success: true, buffered: 1 });

    expect(mocks.record).toHaveBeenCalledTimes(1);
    expect(mocks.record).toHaveBeenCalledWith({
      userId: 'test-user-123',
      eventType: 'LESSON_VIEW',
      entityId: 'lesson-42',
      metadata: { progressSeconds: 120, completed: false },
      timestamp: undefined,
    });
  });

  it('returns 200 on valid batch events and buffers all items', async () => {
    const eventsPayload = [
      { eventType: 'SEARCH', entityId: 'search-query-1', metadata: { query: 'react' } },
      { eventType: 'LESSON_VIEW', entityId: 'lesson-99' },
      { eventType: 'HEARTBEAT', entityId: 'session-live', timestamp: 1700000000000 },
    ];

    const req = createRequest({ events: eventsPayload });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ success: true, buffered: 3 });

    expect(mocks.record).toHaveBeenCalledTimes(3);
    expect(mocks.record).toHaveBeenNthCalledWith(1, {
      userId: 'test-user-123',
      eventType: 'SEARCH',
      entityId: 'search-query-1',
      metadata: { query: 'react' },
      timestamp: undefined,
    });
    expect(mocks.record).toHaveBeenNthCalledWith(2, {
      userId: 'test-user-123',
      eventType: 'LESSON_VIEW',
      entityId: 'lesson-99',
      metadata: undefined,
      timestamp: undefined,
    });
    expect(mocks.record).toHaveBeenNthCalledWith(3, {
      userId: 'test-user-123',
      eventType: 'HEARTBEAT',
      entityId: 'session-live',
      metadata: undefined,
      timestamp: 1700000000000,
    });
  });
});
