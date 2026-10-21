import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sessionService, SessionConflictError } from '../session.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
  const mockStudySession = {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };

  const mockRealtimeStream = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };

  const mockRealtimeEvent = {
    create: vi.fn(),
  };

  const mockRealtimeDelivery = {
    create: vi.fn(),
  };

  const mockTransaction = vi.fn(async (callback) => {
    if (typeof callback === 'function') {
      return callback({
        studySession: mockStudySession,
        realtimeStream: mockRealtimeStream,
        realtimeEvent: mockRealtimeEvent,
        realtimeDelivery: mockRealtimeDelivery,
      });
    }
    return Promise.all(callback);
  });

  return {
    prisma: {
      studySession: mockStudySession,
      realtimeStream: mockRealtimeStream,
      realtimeEvent: mockRealtimeEvent,
      realtimeDelivery: mockRealtimeDelivery,
      $transaction: mockTransaction,
    },
  };
});

interface MockSessionRecord {
  id: string;
  userId: string;
  studyRoomId: string | null;
  status: string;
  targetDurationSeconds: number;
  elapsedSeconds: number;
  startedAt: Date;
  resumedAt: Date | null;
  pausedAt: Date | null;
  deadline: Date | null;
  endedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

type PrismaStudySession = Awaited<ReturnType<typeof prisma.studySession.create>>;

const asSession = (s: Partial<MockSessionRecord>): PrismaStudySession =>
  ({
    id: 'mock-id',
    userId: 'user-1',
    studyRoomId: null,
    status: 'ACTIVE',
    targetDurationSeconds: 1500,
    elapsedSeconds: 0,
    startedAt: new Date(),
    resumedAt: null,
    pausedAt: null,
    deadline: null,
    endedAt: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...s,
  } as unknown as PrismaStudySession);

const mockDb = prisma.studySession as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe('Phase 8: Durable StudySession Domain Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startSession', () => {
    it('creates a new active session with deadline derived from server timestamp', async () => {
      mockDb.findFirst.mockResolvedValueOnce(null);

      const now = new Date();
      const deadline = new Date(now.getTime() + 1500 * 1000);

      mockDb.create.mockResolvedValueOnce(
        asSession({
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
        })
      );

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
      mockDb.findFirst.mockResolvedValueOnce(
        asSession({
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
        })
      );

      const session = await sessionService.startSession({
        userId: 'user-1',
        targetDurationSeconds: 1500,
      });

      expect(session.id).toBe('sess-existing');
      expect(prisma.studySession.create).not.toHaveBeenCalled();
    });

    it('auto-finalizes expired session and starts fresh new session', async () => {
      const pastDeadline = new Date(Date.now() - 60000); // 1 min ago
      mockDb.findFirst.mockResolvedValueOnce(
        asSession({
          id: 'sess-expired',
          userId: 'user-1',
          status: 'ACTIVE',
          targetDurationSeconds: 1500,
          elapsedSeconds: 1400,
          startedAt: new Date(Date.now() - 1600000),
          deadline: pastDeadline,
          version: 1,
        })
      );

      mockDb.update.mockResolvedValueOnce(
        asSession({
          id: 'sess-expired',
          status: 'COMPLETED',
        })
      );

      const now = new Date();
      mockDb.create.mockResolvedValueOnce(
        asSession({
          id: 'sess-new',
          userId: 'user-1',
          status: 'ACTIVE',
          targetDurationSeconds: 1500,
          elapsedSeconds: 0,
          startedAt: now,
          deadline: new Date(now.getTime() + 1500000),
          version: 1,
        })
      );

      const result = await sessionService.startSession({
        userId: 'user-1',
        targetDurationSeconds: 1500,
      });

      expect(prisma.studySession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sess-expired' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        })
      );
      expect(result.id).toBe('sess-new');
    });
  });

  describe('pauseSession with version checking', () => {
    it('pauses active session, accumulates elapsed seconds, and clears deadline', async () => {
      const startedAt = new Date(Date.now() - 300 * 1000); // 300s ago
      mockDb.findUnique.mockResolvedValueOnce(
        asSession({
          id: 'sess-pause',
          userId: 'user-1',
          status: 'ACTIVE',
          targetDurationSeconds: 1500,
          elapsedSeconds: 0,
          startedAt,
          resumedAt: startedAt,
          version: 1,
        })
      );

      mockDb.update.mockImplementationOnce((args: unknown) => {
        const data = (args as { data: Partial<MockSessionRecord> }).data;
        return Promise.resolve(
          asSession({
            id: 'sess-pause',
            userId: 'user-1',
            status: data.status,
            targetDurationSeconds: 1500,
            elapsedSeconds: data.elapsedSeconds,
            startedAt,
            pausedAt: data.pausedAt,
            deadline: data.deadline,
            version: 2,
          })
        );
      });

      const paused = await sessionService.pauseSession({
        userId: 'user-1',
        sessionId: 'sess-pause',
        expectedVersion: 1,
      });

      expect(paused.status).toBe('PAUSED');
      expect(paused.deadline).toBeNull();
      expect(paused.elapsedSeconds).toBeGreaterThanOrEqual(299);
      expect(paused.version).toBe(2);
    });

    it('throws SessionConflictError when expectedVersion does not match', async () => {
      mockDb.findUnique.mockResolvedValueOnce(
        asSession({
          id: 'sess-stale',
          userId: 'user-1',
          status: 'ACTIVE',
          version: 3,
        })
      );

      await expect(
        sessionService.pauseSession({
          userId: 'user-1',
          sessionId: 'sess-stale',
          expectedVersion: 2,
        })
      ).rejects.toThrow(SessionConflictError);
    });

    it('is idempotent when session is already paused even with mismatched expectedVersion', async () => {
      mockDb.findUnique.mockResolvedValueOnce(
        asSession({
          id: 'sess-already-paused',
          userId: 'user-1',
          status: 'PAUSED',
          targetDurationSeconds: 1500,
          elapsedSeconds: 300,
          startedAt: new Date(),
          version: 2,
        })
      );

      const result = await sessionService.pauseSession({
        userId: 'user-1',
        sessionId: 'sess-already-paused',
        expectedVersion: 1,
      });

      expect(result.status).toBe('PAUSED');
      expect(prisma.studySession.update).not.toHaveBeenCalled();
    });
  });

  describe('resumeSession with version checking', () => {
    it('resumes paused session with recalculated deadline based on remaining duration', async () => {
      mockDb.findUnique.mockResolvedValueOnce(
        asSession({
          id: 'sess-resume',
          userId: 'user-1',
          status: 'PAUSED',
          targetDurationSeconds: 1500,
          elapsedSeconds: 500, // 1000s remaining
          startedAt: new Date(),
          version: 2,
        })
      );

      mockDb.update.mockImplementationOnce((args: unknown) => {
        const data = (args as { data: Partial<MockSessionRecord> }).data;
        return Promise.resolve(
          asSession({
            id: 'sess-resume',
            userId: 'user-1',
            status: data.status,
            targetDurationSeconds: 1500,
            elapsedSeconds: 500,
            startedAt: new Date(),
            resumedAt: data.resumedAt,
            deadline: data.deadline,
            version: 3,
          })
        );
      });

      const resumed = await sessionService.resumeSession({
        userId: 'user-1',
        sessionId: 'sess-resume',
        expectedVersion: 2,
      });

      expect(resumed.status).toBe('ACTIVE');
      expect(resumed.deadline).not.toBeNull();
      expect(resumed.version).toBe(3);
    });

    it('throws SessionConflictError when expectedVersion does not match on resume', async () => {
      mockDb.findUnique.mockResolvedValueOnce(
        asSession({
          id: 'sess-resume-conflict',
          userId: 'user-1',
          status: 'PAUSED',
          version: 5,
        })
      );

      await expect(
        sessionService.resumeSession({
          userId: 'user-1',
          sessionId: 'sess-resume-conflict',
          expectedVersion: 4,
        })
      ).rejects.toThrow(SessionConflictError);
    });
  });

  describe('completeSession: Honest Elapsed Time Semantics', () => {
    it('calculates honest elapsed time when completed early without crediting full duration', async () => {
      const startedAt = new Date(Date.now() - 300 * 1000); // 5 mins in
      mockDb.findUnique.mockResolvedValueOnce(
        asSession({
          id: 'sess-early-comp',
          userId: 'user-1',
          status: 'ACTIVE',
          targetDurationSeconds: 1500, // 25 min target
          elapsedSeconds: 0,
          startedAt,
          resumedAt: startedAt,
          deadline: new Date(startedAt.getTime() + 1500 * 1000), // deadline still 20 mins away!
          version: 1,
        })
      );

      mockDb.update.mockImplementationOnce((args: unknown) => {
        const data = (args as { data: Partial<MockSessionRecord> }).data;
        return Promise.resolve(
          asSession({
            id: 'sess-early-comp',
            userId: 'user-1',
            status: data.status,
            targetDurationSeconds: 1500,
            elapsedSeconds: data.elapsedSeconds,
            startedAt,
            endedAt: data.endedAt,
            deadline: null,
            version: 2,
          })
        );
      });

      const completed = await sessionService.completeSession({
        userId: 'user-1',
        sessionId: 'sess-early-comp',
        expectedVersion: 1,
      });

      expect(completed.status).toBe('COMPLETED');
      // Elapsed seconds must be around 300, NEVER inflated to 1500!
      expect(completed.elapsedSeconds).toBeGreaterThanOrEqual(299);
      expect(completed.elapsedSeconds).toBeLessThan(400);
      expect(completed.version).toBe(2);
    });

    it('credits full duration when completed at or past deadline', async () => {
      const pastDeadline = new Date(Date.now() - 5000);
      mockDb.findUnique.mockResolvedValueOnce(
        asSession({
          id: 'sess-natural-comp',
          userId: 'user-1',
          status: 'ACTIVE',
          targetDurationSeconds: 1500,
          elapsedSeconds: 1490,
          startedAt: new Date(Date.now() - 1505000),
          resumedAt: new Date(Date.now() - 1505000),
          deadline: pastDeadline,
          version: 1,
        })
      );

      mockDb.update.mockImplementationOnce((args: unknown) => {
        const data = (args as { data: Partial<MockSessionRecord> }).data;
        return Promise.resolve(
          asSession({
            id: 'sess-natural-comp',
            userId: 'user-1',
            status: data.status,
            targetDurationSeconds: 1500,
            elapsedSeconds: data.elapsedSeconds,
            startedAt: new Date(),
            deadline: null,
            version: 2,
          })
        );
      });

      const completed = await sessionService.completeSession({
        userId: 'user-1',
        sessionId: 'sess-natural-comp',
      });

      expect(completed.status).toBe('COMPLETED');
      expect(completed.elapsedSeconds).toBe(1500);
    });

    it('idempotently completes session on simultaneous calls from two tabs', async () => {
      mockDb.findUnique.mockResolvedValueOnce(
        asSession({
          id: 'sess-comp',
          userId: 'user-1',
          status: 'ACTIVE',
          targetDurationSeconds: 1500,
          elapsedSeconds: 1500,
          startedAt: new Date(),
          version: 3,
        })
      );

      mockDb.update.mockResolvedValueOnce(
        asSession({
          id: 'sess-comp',
          userId: 'user-1',
          status: 'COMPLETED',
          targetDurationSeconds: 1500,
          elapsedSeconds: 1500,
          startedAt: new Date(),
          endedAt: new Date(),
          deadline: null,
          version: 4,
        })
      );

      const firstTab = await sessionService.completeSession({
        userId: 'user-1',
        sessionId: 'sess-comp',
      });

      expect(firstTab.status).toBe('COMPLETED');
      expect(firstTab.version).toBe(4);

      // Second tab completes already-completed session
      mockDb.findUnique.mockResolvedValueOnce(
        asSession({
          id: 'sess-comp',
          userId: 'user-1',
          status: 'COMPLETED',
          targetDurationSeconds: 1500,
          elapsedSeconds: 1500,
          startedAt: new Date(),
          endedAt: new Date(),
          version: 4,
        })
      );

      const secondTab = await sessionService.completeSession({
        userId: 'user-1',
        sessionId: 'sess-comp',
      });

      expect(secondTab.status).toBe('COMPLETED');
      expect(prisma.studySession.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('interruptSession', () => {
    it('interrupts active session and records honest elapsed time', async () => {
      const startedAt = new Date(Date.now() - 200 * 1000);
      mockDb.findUnique.mockResolvedValueOnce(
        asSession({
          id: 'sess-int',
          userId: 'user-1',
          status: 'ACTIVE',
          targetDurationSeconds: 1500,
          elapsedSeconds: 0,
          startedAt,
          resumedAt: startedAt,
          version: 1,
        })
      );

      mockDb.update.mockImplementationOnce((args: unknown) => {
        const data = (args as { data: Partial<MockSessionRecord> }).data;
        return Promise.resolve(
          asSession({
            id: 'sess-int',
            userId: 'user-1',
            status: data.status,
            targetDurationSeconds: 1500,
            elapsedSeconds: data.elapsedSeconds,
            startedAt,
            endedAt: data.endedAt,
            deadline: null,
            version: 2,
          })
        );
      });

      const interrupted = await sessionService.interruptSession({
        userId: 'user-1',
        sessionId: 'sess-int',
        expectedVersion: 1,
      });

      expect(interrupted.status).toBe('INTERRUPTED');
      expect(interrupted.elapsedSeconds).toBeGreaterThanOrEqual(199);
      expect(interrupted.version).toBe(2);
    });
  });

  describe('getActiveSession and reconcileExpiredSessions', () => {
    it('returns null if no active or paused session exists', async () => {
      mockDb.findFirst.mockResolvedValueOnce(null);

      const active = await sessionService.getActiveSession('user-no-session');
      expect(active).toBeNull();
    });

    it('auto-finalizes expired session on getActiveSession and returns null', async () => {
      const pastDeadline = new Date(Date.now() - 10000);
      mockDb.findFirst.mockResolvedValueOnce(
        asSession({
          id: 'sess-expired-active',
          userId: 'user-1',
          status: 'ACTIVE',
          targetDurationSeconds: 1500,
          elapsedSeconds: 1400,
          startedAt: new Date(Date.now() - 1510000),
          deadline: pastDeadline,
          version: 1,
        })
      );

      mockDb.update.mockResolvedValueOnce(
        asSession({
          id: 'sess-expired-active',
          status: 'COMPLETED',
        })
      );

      const active = await sessionService.getActiveSession('user-1');
      expect(active).toBeNull();
      expect(prisma.studySession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sess-expired-active' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        })
      );
    });

    it('reconciles batch of expired sessions in maintenance sweep', async () => {
      mockDb.findMany.mockResolvedValueOnce([
        asSession({
          id: 'sess-exp-1',
          targetDurationSeconds: 1500,
          deadline: new Date(Date.now() - 5000),
        }),
        asSession({
          id: 'sess-exp-2',
          targetDurationSeconds: 3000,
          deadline: new Date(Date.now() - 10000),
        }),
      ]);

      mockDb.update.mockResolvedValue(asSession({}));

      const count = await sessionService.reconcileExpiredSessions(50);
      expect(count).toBe(2);
      expect(prisma.studySession.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSessionHistory', () => {
    it('returns paginated history with nextCursor', async () => {
      const dummyItems = Array.from({ length: 6 }, (_, i) =>
        asSession({
          id: `sess-${i}`,
          userId: 'user-1',
          status: 'COMPLETED',
          targetDurationSeconds: 1500,
          elapsedSeconds: 1500,
          startedAt: new Date(),
          endedAt: new Date(),
          version: 2,
        })
      );

      mockDb.findMany.mockResolvedValueOnce(dummyItems);

      const res = await sessionService.getSessionHistory({
        userId: 'user-1',
        limit: 5,
      });

      expect(res.sessions).toHaveLength(5);
      expect(res.nextCursor).toBe('sess-5');
    });
  });
});
