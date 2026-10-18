import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  getUser: vi.fn(),
  seedRooms: vi.fn(),
  studyRoomCount: vi.fn(),
  studyRoomFindMany: vi.fn(),
  studyRoomFindUnique: vi.fn(),
  studyRoomUpdate: vi.fn(),
  roomParticipantFindFirst: vi.fn(),
  roomParticipantCreate: vi.fn(),
  roomParticipantDelete: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: hoisted.getUser,
}));

vi.mock('@/src/server/infrastructure/db/postgres/repositories/studyRoom.repo', () => ({
  studyRoomRepo: {
    seedRooms: hoisted.seedRooms,
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
  const txMock = {
    studyRoom: {
      count: hoisted.studyRoomCount,
      findMany: hoisted.studyRoomFindMany,
      findUnique: hoisted.studyRoomFindUnique,
      update: hoisted.studyRoomUpdate,
    },
    roomParticipant: {
      findFirst: hoisted.roomParticipantFindFirst,
      create: hoisted.roomParticipantCreate,
      delete: hoisted.roomParticipantDelete,
    },
  };

  return {
    prisma: {
      ...txMock,
      $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<any>) => cb(txMock)),
    },
  };
});

import { GET, POST } from '../route';

describe('/api/studyroom route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/studyroom', () => {
    it('seeds rooms when room count is 0', async () => {
      hoisted.studyRoomCount.mockResolvedValue(0);
      hoisted.seedRooms.mockResolvedValue(undefined);
      hoisted.studyRoomFindMany.mockResolvedValue([
        { id: 'room-1', title: 'Fireplace', onlineCount: 0, participants: [] },
      ]);

      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(hoisted.studyRoomCount).toHaveBeenCalledTimes(1);
      expect(hoisted.seedRooms).toHaveBeenCalledTimes(1);
      expect(hoisted.studyRoomFindMany).toHaveBeenCalledTimes(1);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('room-1');
    });

    it('does not seed rooms when room count is greater than 0', async () => {
      hoisted.studyRoomCount.mockResolvedValue(3);
      hoisted.studyRoomFindMany.mockResolvedValue([
        { id: 'room-1', title: 'Fireplace', onlineCount: 0, participants: [] },
        { id: 'room-2', title: 'Library', onlineCount: 1, participants: [] },
      ]);

      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(hoisted.studyRoomCount).toHaveBeenCalledTimes(1);
      expect(hoisted.seedRooms).not.toHaveBeenCalled();
      expect(hoisted.studyRoomFindMany).toHaveBeenCalledTimes(1);
      expect(data).toHaveLength(2);
    });

    it('handles database errors gracefully and returns 500', async () => {
      hoisted.studyRoomCount.mockRejectedValue(new Error('DB failure'));

      const res = await GET();
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('POST /api/studyroom', () => {
    it('returns 401 when user is unauthenticated', async () => {
      hoisted.getUser.mockResolvedValue(null);

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: 'room-1' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 when action is invalid', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dance' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid action');
    });

    it('returns 400 when action is join but roomId is missing', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Room ID is required');
    });

    it('returns 404 when target room does not exist', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.studyRoomFindUnique.mockResolvedValue(null);

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: 'nonexistent-room' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Room not found');
    });

    it('joins a room when user is not currently in any room', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.studyRoomFindUnique.mockResolvedValue({ id: 'room-1', title: 'Fireplace' });
      hoisted.roomParticipantFindFirst.mockResolvedValue(null);
      hoisted.roomParticipantCreate.mockResolvedValue({ id: 'part-1', userId: 'user-1', studyRoomId: 'room-1' });
      hoisted.studyRoomUpdate.mockResolvedValue({ id: 'room-1', onlineCount: 1 });

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: 'room-1' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      expect(hoisted.roomParticipantCreate).toHaveBeenCalledWith({
        data: { userId: 'user-1', studyRoomId: 'room-1' },
      });
      expect(hoisted.studyRoomUpdate).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { onlineCount: { increment: 1 } },
      });
    });

    it('returns already in room idempotently if already in target room', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.studyRoomFindUnique.mockResolvedValue({ id: 'room-1', title: 'Fireplace' });
      hoisted.roomParticipantFindFirst.mockResolvedValue({ id: 'part-1', userId: 'user-1', studyRoomId: 'room-1' });

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: 'room-1' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Already in room');

      expect(hoisted.roomParticipantCreate).not.toHaveBeenCalled();
      expect(hoisted.roomParticipantDelete).not.toHaveBeenCalled();
      expect(hoisted.studyRoomUpdate).not.toHaveBeenCalled();
    });

    it('switches rooms atomically: decrements old room and increments new room', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.studyRoomFindUnique.mockResolvedValue({ id: 'room-2', title: 'Library' });
      hoisted.roomParticipantFindFirst.mockResolvedValue({ id: 'part-old', userId: 'user-1', studyRoomId: 'room-1' });
      hoisted.roomParticipantDelete.mockResolvedValue({ id: 'part-old' });
      hoisted.roomParticipantCreate.mockResolvedValue({ id: 'part-new', userId: 'user-1', studyRoomId: 'room-2' });
      hoisted.studyRoomUpdate.mockResolvedValue({});

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: 'room-2' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify old room cleaned up
      expect(hoisted.roomParticipantDelete).toHaveBeenCalledWith({
        where: { id: 'part-old' },
      });
      expect(hoisted.studyRoomUpdate).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { onlineCount: { decrement: 1 } },
      });

      // Verify new room joined
      expect(hoisted.roomParticipantCreate).toHaveBeenCalledWith({
        data: { userId: 'user-1', studyRoomId: 'room-2' },
      });
      expect(hoisted.studyRoomUpdate).toHaveBeenCalledWith({
        where: { id: 'room-2' },
        data: { onlineCount: { increment: 1 } },
      });
    });

    it('leaves room atomically and decrements online count', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.roomParticipantFindFirst.mockResolvedValue({ id: 'part-1', userId: 'user-1', studyRoomId: 'room-1' });
      hoisted.roomParticipantDelete.mockResolvedValue({ id: 'part-1' });
      hoisted.studyRoomUpdate.mockResolvedValue({ id: 'room-1' });

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      expect(hoisted.roomParticipantDelete).toHaveBeenCalledWith({
        where: { id: 'part-1' },
      });
      expect(hoisted.studyRoomUpdate).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { onlineCount: { decrement: 1 } },
      });
    });

    it('returns 400 when attempting to leave but user is not in any room', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.roomParticipantFindFirst.mockResolvedValue(null);

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Not in a room');
    });

    it('returns 500 when transaction throws an unexpected error', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.studyRoomFindUnique.mockRejectedValue(new Error('Unexpected DB crash'));

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: 'room-1' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});
