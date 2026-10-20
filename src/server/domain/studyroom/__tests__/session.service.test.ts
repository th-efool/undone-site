import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sessionService } from '../session.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
  const mockStudySession = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };

  const mockTransaction = vi.fn(async (callback) => {
    if (typeof callback === 'function') {
      return callback({
        studySession: mockStudySession,
      });
    }
    return Promise.all(callback);
  });

  return {
    prisma: {
      studySession: mockStudySession,
      $transaction: mockTransaction,
    },
  };
});

describe('Phase 8: Durable StudySession Domain Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startSession', () => {
    it('creates a new active session with deadline derived from server timestamp', async () => {
      vi.mocked(prisma.studySession.findFirst).mockResolvedValueOnce(null);

      const now = new Date();
      const deadline = new Date(now.getTime() + 1500 * 1000);

      vi.mocked(prisma.studySession.create).mockResolvedValueOnce({
        id: 'sess-1',
        userId: 'user-1',
        studyRoomId: 'room-1',
        status: 'ACTIVE',
        targetDurationSeconds: 1500,
        elapsedSeconds: 0,
        startedAt: now,
        resumedAt: now,
        pausedAt: null,
        deadline,
        endedAt: null,
        version: 1,
      } as any);

      const session = await sessionService.startSession({
        userId: 'user-1',
        roomId: 'room-1',
        targetDurationSeconds: 1500,
      });

      expect(session.id).toBe('sess-1');
      expect(session.status).toBe('ACTIVE');
      expect(session.deadline).toBe(deadline.toISOString());
      expect(session.version).toBe(1);
    });

    it('returns existing session idempotently when user already has an active session', async () => {
      const existingNow = new Date();
      vi.mocked(prisma.studySession.findFirst).mockResolvedValueOnce({
        id: 'sess-existing',
        userId: 'user-1',
        status: 'ACTIVE',
        targetDurationSeconds: 1500,
        elapsedSeconds: 300,
        startedAt: existingNow,
        resumedAt: existingNow,
        pausedAt: null,
        deadline: new Date(existingNow.getTime() + 1200000),
        endedAt: null,
        version: 2,
      } as any);

      const session = await sessionService.startSession({
        userId: 'user-1',
        targetDurationSeconds: 1500,
      });

      expect(session.id).toBe('sess-existing');
      expect(prisma.studySession.create).not.toHaveBeenCalled();
    });
  });

  describe('pauseSession', () => {
    it('pauses active session, accumulates elapsed seconds, and clears deadline', async () => {
      const startedAt = new Date(Date.now() - 300 * 1000); // 300s ago
      vi.mocked(prisma.studySession.findUnique).mockResolvedValueOnce({
        id: 'sess-pause',
        userId: 'user-1',
        status: 'ACTIVE',
        targetDurationSeconds: 1500,
        elapsedSeconds: 0,
        startedAt,
        resumedAt: startedAt,
        version: 1,
      } as any);

      (prisma.studySession.update as any).mockImplementationOnce(({ data }: any) => {
        return Promise.resolve({
          id: 'sess-pause',
          userId: 'user-1',
          status: data.status,
          targetDurationSeconds: 1500,
          elapsedSeconds: data.elapsedSeconds,
          startedAt,
          pausedAt: data.pausedAt,
          deadline: data.deadline,
          version: 2,
        } as any);
      });

      const paused = await sessionService.pauseSession({
        userId: 'user-1',
        sessionId: 'sess-pause',
      });

      expect(paused.status).toBe('PAUSED');
      expect(paused.deadline).toBeNull();
      expect(paused.elapsedSeconds).toBeGreaterThanOrEqual(299);
      expect(paused.version).toBe(2);
    });

    it('is idempotent when session is already paused', async () => {
      vi.mocked(prisma.studySession.findUnique).mockResolvedValueOnce({
        id: 'sess-already-paused',
        userId: 'user-1',
        status: 'PAUSED',
        targetDurationSeconds: 1500,
        elapsedSeconds: 300,
        startedAt: new Date(),
        version: 2,
      } as any);

      const result = await sessionService.pauseSession({
        userId: 'user-1',
        sessionId: 'sess-already-paused',
      });

      expect(result.status).toBe('PAUSED');
      expect(prisma.studySession.update).not.toHaveBeenCalled();
    });
  });

  describe('resumeSession', () => {
    it('resumes paused session with recalculated deadline based on remaining duration', async () => {
      vi.mocked(prisma.studySession.findUnique).mockResolvedValueOnce({
        id: 'sess-resume',
        userId: 'user-1',
        status: 'PAUSED',
        targetDurationSeconds: 1500,
        elapsedSeconds: 500, // 1000s remaining
        startedAt: new Date(),
        version: 2,
      } as any);

      (prisma.studySession.update as any).mockImplementationOnce(({ data }: any) => {
        return Promise.resolve({
          id: 'sess-resume',
          userId: 'user-1',
          status: data.status,
          targetDurationSeconds: 1500,
          elapsedSeconds: 500,
          startedAt: new Date(),
          resumedAt: data.resumedAt,
          deadline: data.deadline,
          version: 3,
        } as any);
      });

      const resumed = await sessionService.resumeSession({
        userId: 'user-1',
        sessionId: 'sess-resume',
      });

      expect(resumed.status).toBe('ACTIVE');
      expect(resumed.deadline).not.toBeNull();
      expect(resumed.version).toBe(3);
    });
  });

  describe('completeSession & Interrupt', () => {
    it('idempotently completes session on simultaneous calls from two tabs', async () => {
      vi.mocked(prisma.studySession.findUnique).mockResolvedValueOnce({
        id: 'sess-comp',
        userId: 'user-1',
        status: 'ACTIVE',
        targetDurationSeconds: 1500,
        elapsedSeconds: 1500,
        startedAt: new Date(),
        version: 3,
      } as any);

      vi.mocked(prisma.studySession.update).mockResolvedValueOnce({
        id: 'sess-comp',
        userId: 'user-1',
        status: 'COMPLETED',
        targetDurationSeconds: 1500,
        elapsedSeconds: 1500,
        startedAt: new Date(),
        endedAt: new Date(),
        deadline: null,
        version: 4,
      } as any);

      const firstTab = await sessionService.completeSession({
        userId: 'user-1',
        sessionId: 'sess-comp',
      });

      expect(firstTab.status).toBe('COMPLETED');
      expect(firstTab.version).toBe(4);

      // Second tab completes already-completed session
      vi.mocked(prisma.studySession.findUnique).mockResolvedValueOnce({
        id: 'sess-comp',
        userId: 'user-1',
        status: 'COMPLETED',
        targetDurationSeconds: 1500,
        elapsedSeconds: 1500,
        startedAt: new Date(),
        endedAt: new Date(),
        version: 4,
      } as any);

      const secondTab = await sessionService.completeSession({
        userId: 'user-1',
        sessionId: 'sess-comp',
      });

      expect(secondTab.status).toBe('COMPLETED');
      // Update was only called once during firstTab!
      expect(prisma.studySession.update).toHaveBeenCalledTimes(1);
    });

    it('interrupts active session', async () => {
      vi.mocked(prisma.studySession.findUnique).mockResolvedValueOnce({
        id: 'sess-int',
        userId: 'user-1',
        status: 'ACTIVE',
        targetDurationSeconds: 1500,
        elapsedSeconds: 200,
        startedAt: new Date(),
        version: 1,
      } as any);

      vi.mocked(prisma.studySession.update).mockResolvedValueOnce({
        id: 'sess-int',
        userId: 'user-1',
        status: 'INTERRUPTED',
        targetDurationSeconds: 1500,
        elapsedSeconds: 200,
        startedAt: new Date(),
        endedAt: new Date(),
        deadline: null,
        version: 2,
      } as any);

      const interrupted = await sessionService.interruptSession({
        userId: 'user-1',
        sessionId: 'sess-int',
      });

      expect(interrupted.status).toBe('INTERRUPTED');
      expect(interrupted.version).toBe(2);
    });
  });

  describe('getActiveSession', () => {
    it('returns null if no active or paused session exists', async () => {
      vi.mocked(prisma.studySession.findFirst).mockResolvedValueOnce(null);

      const active = await sessionService.getActiveSession('user-no-session');
      expect(active).toBeNull();
    });

    it('returns formatted DTO with server timestamp', async () => {
      const now = new Date();
      vi.mocked(prisma.studySession.findFirst).mockResolvedValueOnce({
        id: 'sess-active',
        userId: 'user-1',
        status: 'ACTIVE',
        targetDurationSeconds: 1500,
        elapsedSeconds: 100,
        startedAt: now,
        resumedAt: now,
        deadline: new Date(now.getTime() + 1400000),
        version: 1,
      } as any);

      const active = await sessionService.getActiveSession('user-1');
      expect(active).not.toBeNull();
      expect(active?.serverTime).toBeDefined();
      expect(active?.status).toBe('ACTIVE');
    });
  });
});
