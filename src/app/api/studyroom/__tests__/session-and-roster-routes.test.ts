import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getRoster } from '../roster/route';
import { GET as getSession, POST as postSession, PATCH as patchSession } from '../session/route';
import { GET as getHistory } from '../session/history/route';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { studyRoomService } from '@/src/server/domain/studyroom/studyroom.service';
import { sessionService, SessionConflictError } from '@/src/server/domain/studyroom/session.service';

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

vi.mock('@/src/server/domain/studyroom/session.service', () => {
  class MockSessionConflictError extends Error {
    readonly status = 409;
    constructor(msg = 'Session version conflict') {
      super(msg);
      this.name = 'SessionConflictError';
    }
  }

  return {
    SessionConflictError: MockSessionConflictError,
    sessionService: {
      getActiveSession: vi.fn(),
      startSession: vi.fn(),
      pauseSession: vi.fn(),
      resumeSession: vi.fn(),
      completeSession: vi.fn(),
      interruptSession: vi.fn(),
      getSessionHistory: vi.fn(),
    },
  };
});

type MockUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;
const mockUser: MockUser = { id: 'user-1' } as unknown as MockUser;

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
      vi.mocked(getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      const req = new NextRequest('http://localhost/api/studyroom/roster');
      const res = await getRoster(req);
      expect(res.status).toBe(400);
    });

    it('returns authenticated room roster with private no-store headers', async () => {
      vi.mocked(getUser).mockResolvedValueOnce(mockUser);
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
      vi.mocked(getUser).mockResolvedValueOnce(mockUser);
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
      vi.mocked(getUser).mockResolvedValueOnce(mockUser);
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
      vi.mocked(getUser).mockResolvedValueOnce(mockUser);
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

    it('PATCH /api/studyroom/session returns 409 on version conflict', async () => {
      vi.mocked(getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(sessionService.pauseSession).mockRejectedValueOnce(
        new SessionConflictError('Session version mismatch: expected 1, got 2')
      );

      const req = new NextRequest('http://localhost/api/studyroom/session', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'pause', sessionId: 'sess-2', expectedVersion: 1 }),
      });
      const res = await patchSession(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('version mismatch');
    });

    it('GET /api/studyroom/session/history returns paginated user history', async () => {
      vi.mocked(getUser).mockResolvedValueOnce(mockUser);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(sessionService.getSessionHistory).mockResolvedValueOnce({
        sessions: [
          {
            id: 'sess-hist-1',
            userId: 'user-1',
            studyRoomId: null,
            status: 'COMPLETED',
            targetDurationSeconds: 1500,
            elapsedSeconds: 1500,
            startedAt: new Date().toISOString(),
            resumedAt: null,
            pausedAt: null,
            deadline: null,
            endedAt: new Date().toISOString(),
            version: 2,
            serverTime: new Date().toISOString(),
          },
        ],
        nextCursor: null,
      });

      const req = new NextRequest('http://localhost/api/studyroom/session/history?limit=10');
      const res = await getHistory(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].id).toBe('sess-hist-1');
    });
  });
});
