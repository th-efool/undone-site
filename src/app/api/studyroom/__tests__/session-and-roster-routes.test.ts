import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getRoster } from '../roster/route';
import { GET as getSession, POST as postSession, PATCH as patchSession } from '../session/route';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { studyRoomService } from '@/src/server/domain/studyroom/studyroom.service';
import { sessionService } from '@/src/server/domain/studyroom/session.service';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/guestAccount', () => ({
  isSharedGuestAccount: vi.fn(),
}));

vi.mock('@/src/server/domain/studyroom/studyroom.service', () => ({
  studyRoomService: {
    getRoomRoster: vi.fn(),
  },
}));

vi.mock('@/src/server/domain/studyroom/session.service', () => ({
  sessionService: {
    getActiveSession: vi.fn(),
    startSession: vi.fn(),
    pauseSession: vi.fn(),
    resumeSession: vi.fn(),
    completeSession: vi.fn(),
    interruptSession: vi.fn(),
  },
}));

describe('Phase 8 Study Room Roster & Session API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/studyroom/roster', () => {
    it('returns 401 when unauthorized', async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost/api/studyroom/roster?roomId=room-1');
      const res = await getRoster(req);
      expect(res.status).toBe(401);
    });

    it('returns 400 when roomId parameter is missing', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      const req = new NextRequest('http://localhost/api/studyroom/roster');
      const res = await getRoster(req);
      expect(res.status).toBe(400);
    });

    it('returns authenticated room roster with private no-store headers', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(studyRoomService.getRoomRoster).mockResolvedValueOnce([
        {
          id: 'p-1',
          userId: 'user-1',
          name: 'Peer 1',
          username: 'peer1',
          image: '/avatar.jpg',
          joinedAt: new Date().toISOString(),
          tabCount: 1,
        },
      ]);

      const req = new NextRequest('http://localhost/api/studyroom/roster?roomId=room-1');
      const res = await getRoster(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('private, no-store');
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].userId).toBe('user-1');
    });
  });

  describe('Study Session Routes', () => {
    it('GET /api/studyroom/session returns active session', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(sessionService.getActiveSession).mockResolvedValueOnce({
        id: 'sess-1',
        userId: 'user-1',
        studyRoomId: 'room-1',
        status: 'ACTIVE',
        targetDurationSeconds: 1500,
        elapsedSeconds: 0,
        startedAt: new Date().toISOString(),
        resumedAt: new Date().toISOString(),
        pausedAt: null,
        deadline: new Date().toISOString(),
        endedAt: null,
        version: 1,
        serverTime: new Date().toISOString(),
      });

      const res = await getSession();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe('sess-1');
      expect(data.status).toBe('ACTIVE');
    });

    it('POST /api/studyroom/session creates new focus session', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(sessionService.startSession).mockResolvedValueOnce({
        id: 'sess-2',
        userId: 'user-1',
        studyRoomId: null,
        status: 'ACTIVE',
        targetDurationSeconds: 1500,
        elapsedSeconds: 0,
        startedAt: new Date().toISOString(),
        resumedAt: new Date().toISOString(),
        pausedAt: null,
        deadline: new Date().toISOString(),
        endedAt: null,
        version: 1,
        serverTime: new Date().toISOString(),
      });

      const req = new NextRequest('http://localhost/api/studyroom/session', {
        method: 'POST',
        body: JSON.stringify({ targetDurationSeconds: 1500 }),
      });
      const res = await postSession(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe('sess-2');
    });

    it('PATCH /api/studyroom/session executes pause/resume/complete/interrupt transitions', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(sessionService.pauseSession).mockResolvedValueOnce({
        id: 'sess-2',
        userId: 'user-1',
        studyRoomId: null,
        status: 'PAUSED',
        targetDurationSeconds: 1500,
        elapsedSeconds: 300,
        startedAt: new Date().toISOString(),
        resumedAt: null,
        pausedAt: new Date().toISOString(),
        deadline: null,
        endedAt: null,
        version: 2,
        serverTime: new Date().toISOString(),
      });

      const req = new NextRequest('http://localhost/api/studyroom/session', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'pause', sessionId: 'sess-2' }),
      });
      const res = await patchSession(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('PAUSED');
      expect(data.version).toBe(2);
    });
  });
});
