import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../[roomSlug]/sync/route';
import { studyRoomService } from '@/src/server/domain/studyroom/studyroom.service';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { RoomForbiddenError } from '@/src/shared/studyroom/contracts';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/src/server/domain/studyroom/studyroom.service', () => ({
  studyRoomService: {
    syncRoomEvents: vi.fn(),
  },
}));

describe('GET /api/studyroom/[roomSlug]/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if user is not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/studyroom/lofi-cafe/sync');
    const res = await GET(req, { params: Promise.resolve({ roomSlug: 'lofi-cafe' }) });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe('ROOM_UNAUTHORIZED');
  });

  it('delegates to studyRoomService.syncRoomEvents and returns 200 with result', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
    vi.mocked(studyRoomService.syncRoomEvents).mockResolvedValueOnce({
      mode: 'DELTA',
      roomId: 'room-1',
      streamId: 'stream-1',
      currentSequence: 50,
      generation: 1,
      events: [],
      serverTime: new Date().toISOString(),
    });

    const req = new NextRequest('http://localhost/api/studyroom/lofi-cafe/sync?clientSequence=45&limit=20');
    const res = await GET(req, { params: Promise.resolve({ roomSlug: 'lofi-cafe' }) });

    expect(res.status).toBe(200);
    expect(studyRoomService.syncRoomEvents).toHaveBeenCalledWith({
      roomIdOrSlug: 'lofi-cafe',
      userId: 'user-1',
      clientSequence: 45,
      limit: 20,
    });
    const json = await res.json();
    expect(json.mode).toBe('DELTA');
    expect(json.currentSequence).toBe(50);
  });

  it('handles StudyRoomError and returns appropriate error status', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
    vi.mocked(studyRoomService.syncRoomEvents).mockRejectedValueOnce(
      new RoomForbiddenError('Active room lease required')
    );

    const req = new NextRequest('http://localhost/api/studyroom/lofi-cafe/sync?clientSequence=1');
    const res = await GET(req, { params: Promise.resolve({ roomSlug: 'lofi-cafe' }) });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Active room lease required');
    expect(json.code).toBe('ROOM_FORBIDDEN');
  });
});
