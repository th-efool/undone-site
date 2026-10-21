import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RoomNotFoundError,
  RoomForbiddenError,
} from '@/src/shared/studyroom/contracts';

vi.mock('server-only', () => ({}));

const hoisted = vi.hoisted(() => ({
  getUser: vi.fn(),
  seedRooms: vi.fn(),
  studyRoomCount: vi.fn(),
  studyRoomFindMany: vi.fn(),
  joinRoom: vi.fn(),
  renewLease: vi.fn(),
  leaveRoom: vi.fn(),
  updateParticipantGoal: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: hoisted.getUser,
}));

vi.mock('@/src/server/infrastructure/db/postgres/repositories/studyRoom.repo', () => ({
  studyRoomRepo: {
    seedRooms: hoisted.seedRooms,
  },
}));

vi.mock('@/src/server/domain/messaging/rate-limiter.service', () => ({
  rateLimiterService: {
    checkRoomJoinRateLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 15, remaining: 14, resetSeconds: 60 }),
    checkRoomRenewRateLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 20, remaining: 19, resetSeconds: 60 }),
    checkRoomControlRateLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 30, remaining: 29, resetSeconds: 60 }),
    checkRoomGoalRateLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 20, remaining: 19, resetSeconds: 60 }),
    createHeaders: vi.fn(() => ({})),
  },
}));

vi.mock('@/src/server/domain/studyroom/studyroom.service', () => ({
  studyRoomService: {
    joinRoom: hoisted.joinRoom,
    renewLease: hoisted.renewLease,
    leaveRoom: hoisted.leaveRoom,
    updateParticipantGoal: hoisted.updateParticipantGoal,
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
  return {
    prisma: {
      studyRoom: {
        count: hoisted.studyRoomCount,
        findMany: hoisted.studyRoomFindMany,
      },
    },
  };
});

import { GET, POST } from '../route';
import { resetRoomsSeededForTest, clearStudyRoomCacheForTest } from '../cache';

describe('/api/studyroom route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearStudyRoomCacheForTest();
    resetRoomsSeededForTest();
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

    it('skips prisma.studyRoom.count() once roomsSeeded is true across requests', async () => {
      hoisted.studyRoomCount.mockResolvedValue(3);
      hoisted.studyRoomFindMany.mockResolvedValue([
        { id: 'room-1', title: 'Fireplace', onlineCount: 0, participants: [] },
      ]);

      // First call seeds and sets roomsSeeded = true
      await GET();
      expect(hoisted.studyRoomCount).toHaveBeenCalledTimes(1);

      // Invalidate cache to force a new DB read while preserving roomsSeeded
      clearStudyRoomCacheForTest();
      hoisted.studyRoomCount.mockClear();
      hoisted.studyRoomFindMany.mockClear();

      await GET();
      // count() should be completely skipped
      expect(hoisted.studyRoomCount).not.toHaveBeenCalled();
      expect(hoisted.studyRoomFindMany).toHaveBeenCalledTimes(1);
    });

    it('generates deterministic weak ETag and returns micro-cache headers on 200', async () => {
      hoisted.studyRoomCount.mockResolvedValue(1);
      hoisted.studyRoomFindMany.mockResolvedValue([
        {
          id: 'room-1',
          onlineCount: 2,
          participants: [{ userId: 'user-a' }, { userId: 'user-b' }],
        },
      ]);

      const res = await GET();
      expect(res.status).toBe(200);
      const etag = res.headers.get('ETag');
      expect(etag).toBeDefined();
      expect(etag).toMatch(/^W\/"[A-Za-z0-9+/=]{1,24}"$/);
      expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=5, stale-while-revalidate=15');
    });

    it('returns 304 Not Modified when If-None-Match matches ETag (both on cache miss and hit)', async () => {
      hoisted.studyRoomCount.mockResolvedValue(1);
      hoisted.studyRoomFindMany.mockResolvedValue([
        { id: 'room-1', onlineCount: 1, participants: [{ userId: 'user-a' }] },
      ]);

      const initialRes = await GET();
      expect(initialRes.status).toBe(200);
      const etag = initialRes.headers.get('ETag');
      expect(etag).toBeTruthy();

      // 1. In-memory cache hit with matching ETag -> 304 fast exit (<0.1ms, null body)
      const cached304Req = new Request('http://localhost/api/studyroom', {
        headers: { 'If-None-Match': etag! },
      });
      const cached304Res = await GET(cached304Req);
      expect(cached304Res.status).toBe(304);
      expect(cached304Res.headers.get('ETag')).toBe(etag);
      expect(await cached304Res.text()).toBe('');

      // 2. Cache miss (cleared) with matching ETag -> computes ETag, matches, returns 304
      clearStudyRoomCacheForTest();
      const miss304Req = new Request('http://localhost/api/studyroom', {
        headers: { 'If-None-Match': etag! },
      });
      const miss304Res = await GET(miss304Req);
      expect(miss304Res.status).toBe(304);
      expect(miss304Res.headers.get('ETag')).toBe(etag);
      expect(await miss304Res.text()).toBe('');
    });

    it('micro-cache hit within 5000ms bypasses prisma.studyRoom.findMany', async () => {
      hoisted.studyRoomCount.mockResolvedValue(1);
      hoisted.studyRoomFindMany.mockResolvedValue([
        { id: 'room-1', title: 'Fireplace', onlineCount: 0, participants: [] },
      ]);

      // Call 1: Cache miss -> calls DB
      const res1 = await GET();
      expect(res1.status).toBe(200);
      expect(hoisted.studyRoomFindMany).toHaveBeenCalledTimes(1);

      // Call 2: Cache hit -> does NOT call DB
      const res2 = await GET();
      expect(res2.status).toBe(200);
      expect(hoisted.studyRoomFindMany).toHaveBeenCalledTimes(1);
      const data = await res2.json();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('room-1');
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

    it('returns 403 when user is guest account', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'guest-1', email: 'guest@undone.com', isGuest: true });

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: 'room-1' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('GUEST_RESTRICTED');
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
      hoisted.joinRoom.mockRejectedValue(new RoomNotFoundError('Study room not found'));

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: 'nonexistent-room' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Study room not found');
    });

    it('denies join with 403 when target room is CLOSED', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.joinRoom.mockRejectedValue(new RoomForbiddenError('Room is closed'));

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: 'room-closed' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Room is closed');
    });

    it('denies join with 403 when user is actively banned from room', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'banned-user' });
      hoisted.joinRoom.mockRejectedValue(new RoomForbiddenError('User is banned from this room'));

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: 'room-1' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('User is banned from this room');
    });

    it('denies join with 403 for cohort-scoped room when user is not enrolled in cohort', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'unenrolled-user' });
      hoisted.joinRoom.mockRejectedValue(new RoomForbiddenError('Cohort enrollment required'));

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: 'room-cohort' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Cohort enrollment required');
    });

    it('joins a room through studyRoomService.joinRoom', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.joinRoom.mockResolvedValue({
        success: true,
        roomId: 'room-1',
        generation: 1,
        isSwitch: false,
        lease: { leaseId: 'lease-1', tabId: 'tab-1', expiresAt: '2026-10-21T10:00:00.000Z' },
      });

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: 'room-1' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      expect(hoisted.joinRoom).toHaveBeenCalledWith({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: undefined,
        requestId: undefined,
      });
    });

    it('returns already in room idempotently if already in target room', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.joinRoom.mockResolvedValue({
        success: true,
        roomId: 'room-1',
        generation: 1,
        isSwitch: false,
        message: 'Already in room',
        lease: { leaseId: 'lease-1', tabId: 'tab-1', expiresAt: '2026-10-21T10:00:00.000Z' },
      });

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
    });

    it('switches rooms through studyRoomService.joinRoom', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.joinRoom.mockResolvedValue({
        success: true,
        roomId: 'room-2',
        generation: 2,
        isSwitch: true,
        lease: { leaseId: 'lease-2', tabId: 'tab-1', expiresAt: '2026-10-21T10:00:00.000Z' },
      });

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: 'room-2' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.isSwitch).toBe(true);

      expect(hoisted.joinRoom).toHaveBeenCalledWith({
        userId: 'user-1',
        roomId: 'room-2',
        tabId: undefined,
        requestId: undefined,
      });
    });

    it('renews lease through studyRoomService.renewLease', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.renewLease.mockResolvedValue({
        success: true,
        expiresAt: '2026-10-21T10:05:00.000Z',
      });

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'renew',
          roomId: 'room-1',
          tabId: 'tab-1',
          generation: 1,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(hoisted.renewLease).toHaveBeenCalledWith({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-1',
        generation: 1,
      });
    });

    it('returns 409 when lease renewal fails with stale generation or not in room', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.renewLease.mockResolvedValue({
        success: false,
        reason: 'stale_generation',
      });

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'renew',
          roomId: 'room-1',
          tabId: 'tab-1',
          generation: 1,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.reason).toBe('stale_generation');
    });

    it('leaves room through studyRoomService.leaveRoom', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.leaveRoom.mockResolvedValue({
        success: true,
        left: true,
        remainingLeases: 0,
      });

      const req = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      expect(hoisted.leaveRoom).toHaveBeenCalledWith({
        userId: 'user-1',
        roomId: undefined,
        tabId: undefined,
        generation: undefined,
        global: true,
      });
    });

    it('returns 500 when transaction throws an unexpected error', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.joinRoom.mockRejectedValue(new Error('Unexpected DB crash'));

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

    it('invalidates micro-cache after successful join operation so subsequent GET re-queries prisma', async () => {
      hoisted.studyRoomCount.mockResolvedValue(1);
      hoisted.studyRoomFindMany.mockResolvedValue([
        { id: 'room-1', title: 'Fireplace', onlineCount: 0, participants: [] },
      ]);

      // Prime the cache
      await GET();
      expect(hoisted.studyRoomFindMany).toHaveBeenCalledTimes(1);

      // Verify GET hits cache
      await GET();
      expect(hoisted.studyRoomFindMany).toHaveBeenCalledTimes(1);

      // Perform successful join
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.joinRoom.mockResolvedValue({ success: true, roomId: 'room-1' });

      const postReq = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: 'room-1' }),
      });
      const postRes = await POST(postReq);
      expect(postRes.status).toBe(200);

      // Next GET should miss cache and query prisma
      await GET();
      expect(hoisted.studyRoomFindMany).toHaveBeenCalledTimes(2);
    });

    it('invalidates micro-cache after successful leave operation so subsequent GET re-queries prisma', async () => {
      hoisted.studyRoomCount.mockResolvedValue(1);
      hoisted.studyRoomFindMany.mockResolvedValue([
        { id: 'room-1', title: 'Fireplace', onlineCount: 1, participants: [{ userId: 'user-1' }] },
      ]);

      // Prime the cache
      await GET();
      expect(hoisted.studyRoomFindMany).toHaveBeenCalledTimes(1);

      // Verify GET hits cache
      await GET();
      expect(hoisted.studyRoomFindMany).toHaveBeenCalledTimes(1);

      // Perform successful leave
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.leaveRoom.mockResolvedValue({ success: true, left: true, remainingLeases: 0 });

      const postReq = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });
      const postRes = await POST(postReq);
      expect(postRes.status).toBe(200);

      // Next GET should miss cache and query prisma
      await GET();
      expect(hoisted.studyRoomFindMany).toHaveBeenCalledTimes(2);
    });

    it('updates participant goal via action: update_goal', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });
      hoisted.updateParticipantGoal.mockResolvedValue({
        success: true,
        publicGoal: 'Learn Rust Concurrency',
      });

      const postReq = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_goal',
          roomId: 'room-1',
          tabId: 'tab-1',
          generation: 1,
          publicGoal: 'Learn Rust Concurrency',
        }),
      });

      const postRes = await POST(postReq);
      expect(postRes.status).toBe(200);
      const data = await postRes.json();
      expect(data.success).toBe(true);
      expect(data.publicGoal).toBe('Learn Rust Concurrency');

      expect(hoisted.updateParticipantGoal).toHaveBeenCalledWith({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-1',
        generation: 1,
        publicGoal: 'Learn Rust Concurrency',
      });
    });

    it('returns 400 when update_goal is missing generation, tabId, or roomId', async () => {
      hoisted.getUser.mockResolvedValue({ id: 'user-1' });

      const postReq = new Request('http://localhost/api/studyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_goal',
          roomId: 'room-1',
          // missing tabId and generation
        }),
      });

      const postRes = await POST(postReq);
      expect(postRes.status).toBe(400);
    });
  });
});
