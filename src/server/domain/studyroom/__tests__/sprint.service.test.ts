import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { sprintService } from '../sprint.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { MessagingConflictError, MessagingForbiddenError, MessagingNotFoundError } from '../../messaging/contracts';

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    studyRoom: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    roomSprint: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    roomSprintParticipant: {
      create: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    roomParticipant: {
      findFirst: vi.fn(),
    },
    roomController: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    channel: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

describe('sprintService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startSprint', () => {
    it('starts a new shared sprint and auto-enrolls creator', async () => {
      vi.mocked(prisma.roomController.findUnique).mockResolvedValueOnce({
        studyRoomId: 'room-1',
        userId: 'controller-1',
        role: 'OWNER',
        createdAt: new Date(),
      } as any);

      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
        id: 'room-1',
        title: 'Fireplace',
      } as any);

      vi.mocked(prisma.roomSprint.findFirst).mockResolvedValueOnce(null);

      const now = new Date();
      vi.mocked(prisma.roomSprint.create).mockResolvedValueOnce({
        id: 'sprint-1',
        studyRoomId: 'room-1',
        creatorId: 'controller-1',
        title: 'Deep Work',
        targetDurationSeconds: 1500,
        elapsedSeconds: 0,
        status: 'ACTIVE',
        startedAt: now,
        deadline: new Date(now.getTime() + 1500000),
        version: 1,
        revision: 1,
      } as any);

      vi.mocked(prisma.roomSprint.findUnique).mockResolvedValueOnce({
        id: 'sprint-1',
        studyRoomId: 'room-1',
        creatorId: 'controller-1',
        title: 'Deep Work',
        targetDurationSeconds: 1500,
        elapsedSeconds: 0,
        status: 'ACTIVE',
        startedAt: now,
        deadline: new Date(now.getTime() + 1500000),
        pausedAt: null,
        endedAt: null,
        version: 1,
        revision: 1,
        participants: [
          {
            user: { id: 'controller-1', name: 'Alice', username: 'alice', image: null },
            status: 'JOINED',
            joinedAt: now,
          },
        ],
      } as any);

      const result = await sprintService.startSprint({
        userId: 'controller-1',
        roomId: 'room-1',
        targetDurationSeconds: 1500,
        title: 'Deep Work',
      });

      expect(result.id).toBe('sprint-1');
      expect(result.status).toBe('ACTIVE');
      expect(result.participantCount).toBe(1);
      expect(prisma.roomSprint.create).toHaveBeenCalled();
      expect(prisma.roomSprintParticipant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sprintId: 'sprint-1',
            userId: 'controller-1',
            status: 'JOINED',
          }),
        })
      );
    });

    it('rejects startSprint if user is not room controller and controllers exist', async () => {
      vi.mocked(prisma.roomController.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.channel.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.roomController.count).mockResolvedValueOnce(2);

      await expect(
        sprintService.startSprint({
          userId: 'intruder-1',
          roomId: 'room-1',
        })
      ).rejects.toThrow(MessagingForbiddenError);
    });

    it('rejects startSprint if active sprint is already running in room', async () => {
      vi.mocked(prisma.roomController.findUnique).mockResolvedValueOnce({
        studyRoomId: 'room-1',
        userId: 'controller-1',
        role: 'OWNER',
      } as any);
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({ id: 'room-1' } as any);

      vi.mocked(prisma.roomSprint.findFirst).mockResolvedValueOnce({
        id: 'sprint-active',
        status: 'ACTIVE',
        deadline: new Date(Date.now() + 600000),
      } as any);

      await expect(
        sprintService.startSprint({
          userId: 'controller-1',
          roomId: 'room-1',
        })
      ).rejects.toThrow(MessagingConflictError);
    });
  });

  describe('pauseSprint & resumeSprint', () => {
    it('pauses an active sprint and calculates accumulated elapsed time', async () => {
      const started = new Date(Date.now() - 300000); // 300 seconds ago

      vi.mocked(prisma.roomSprint.findUnique).mockResolvedValueOnce({
        id: 'sprint-1',
        studyRoomId: 'room-1',
        creatorId: 'controller-1',
        status: 'ACTIVE',
        revision: 1,
        startedAt: started,
        resumedAt: started,
        elapsedSeconds: 0,
        targetDurationSeconds: 1500,
      } as any);

      vi.mocked(prisma.roomController.findUnique).mockResolvedValueOnce({
        studyRoomId: 'room-1',
        userId: 'controller-1',
        role: 'OWNER',
      } as any);

      // Snapshot after pause
      vi.mocked(prisma.roomSprint.findUnique).mockResolvedValueOnce({
        id: 'sprint-1',
        studyRoomId: 'room-1',
        creatorId: 'controller-1',
        status: 'PAUSED',
        revision: 2,
        startedAt: started,
        pausedAt: new Date(),
        deadline: null,
        elapsedSeconds: 300,
        targetDurationSeconds: 1500,
        version: 1,
        participants: [],
      } as any);

      const paused = await sprintService.pauseSprint({
        userId: 'controller-1',
        sprintId: 'sprint-1',
        expectedRevision: 1,
      });

      expect(paused.status).toBe('PAUSED');
      expect(paused.revision).toBe(2);
      expect(prisma.roomSprint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sprint-1' },
          data: expect.objectContaining({
            status: 'PAUSED',
            revision: { increment: 1 },
          }),
        })
      );
    });

    it('rejects pauseSprint when revision conflict occurs', async () => {
      vi.mocked(prisma.roomSprint.findUnique).mockResolvedValueOnce({
        id: 'sprint-1',
        studyRoomId: 'room-1',
        status: 'ACTIVE',
        revision: 3, // Current DB revision is 3
      } as any);

      vi.mocked(prisma.roomController.findUnique).mockResolvedValueOnce({
        role: 'OWNER',
      } as any);

      await expect(
        sprintService.pauseSprint({
          userId: 'controller-1',
          sprintId: 'sprint-1',
          expectedRevision: 2, // Client had stale revision 2
        })
      ).rejects.toThrow(MessagingConflictError);
    });

    it('resumes a paused sprint with updated deadline', async () => {
      vi.mocked(prisma.roomSprint.findUnique).mockResolvedValueOnce({
        id: 'sprint-1',
        studyRoomId: 'room-1',
        status: 'PAUSED',
        revision: 2,
        elapsedSeconds: 500,
        targetDurationSeconds: 1500,
      } as any);

      vi.mocked(prisma.roomController.findUnique).mockResolvedValueOnce({
        role: 'MODERATOR',
      } as any);

      vi.mocked(prisma.roomSprint.findUnique).mockResolvedValueOnce({
        id: 'sprint-1',
        studyRoomId: 'room-1',
        creatorId: 'controller-1',
        status: 'ACTIVE',
        revision: 3,
        startedAt: new Date(),
        resumedAt: new Date(),
        deadline: new Date(Date.now() + 1000000),
        pausedAt: null,
        endedAt: null,
        elapsedSeconds: 500,
        targetDurationSeconds: 1500,
        version: 1,
        participants: [],
      } as any);

      const resumed = await sprintService.resumeSprint({
        userId: 'controller-1',
        sprintId: 'sprint-1',
        expectedRevision: 2,
      });

      expect(resumed.status).toBe('ACTIVE');
      expect(resumed.revision).toBe(3);
    });
  });

  describe('joinSprint & leaveSprint', () => {
    it('joins active sprint when user is active room participant', async () => {
      vi.mocked(prisma.roomSprint.findUnique).mockResolvedValueOnce({
        id: 'sprint-1',
        studyRoomId: 'room-1',
        status: 'ACTIVE',
      } as any);

      vi.mocked(prisma.roomParticipant.findFirst).mockResolvedValueOnce({
        userId: 'student-2',
        studyRoomId: 'room-1',
      } as any);

      vi.mocked(prisma.roomSprint.findUnique).mockResolvedValueOnce({
        id: 'sprint-1',
        studyRoomId: 'room-1',
        creatorId: 'controller-1',
        status: 'ACTIVE',
        targetDurationSeconds: 1500,
        elapsedSeconds: 0,
        startedAt: new Date(),
        deadline: new Date(Date.now() + 1500000),
        version: 1,
        revision: 1,
        participants: [
          {
            user: { id: 'student-2', name: 'Bob', username: 'bob', image: null },
            status: 'JOINED',
            joinedAt: new Date(),
          },
        ],
      } as any);

      const snapshot = await sprintService.joinSprint('student-2', 'sprint-1');
      expect(snapshot.participants.some((p) => p.userId === 'student-2')).toBe(true);
      expect(prisma.roomSprintParticipant.upsert).toHaveBeenCalled();
    });

    it('rejects joinSprint if user is not in the study room', async () => {
      vi.mocked(prisma.roomSprint.findUnique).mockResolvedValueOnce({
        id: 'sprint-1',
        studyRoomId: 'room-1',
        status: 'ACTIVE',
      } as any);

      vi.mocked(prisma.roomParticipant.findFirst).mockResolvedValueOnce(null);

      await expect(sprintService.joinSprint('outsider', 'sprint-1')).rejects.toThrow(
        MessagingForbiddenError
      );
    });
  });

  describe('deadline expiration & idempotent completion', () => {
    it('automatically transitions to COMPLETED when deadline has passed', async () => {
      const pastDeadline = new Date(Date.now() - 10000); // 10 seconds ago

      vi.mocked(prisma.roomSprint.findUnique).mockResolvedValueOnce({
        id: 'sprint-expired',
        studyRoomId: 'room-1',
        creatorId: 'user-1',
        status: 'ACTIVE',
        deadline: pastDeadline,
        targetDurationSeconds: 1500,
        elapsedSeconds: 0,
        startedAt: new Date(Date.now() - 1600000),
        participants: [],
      } as any);

      // Second findUnique inside completeSprint
      vi.mocked(prisma.roomSprint.findUnique).mockResolvedValueOnce({
        id: 'sprint-expired',
        status: 'ACTIVE',
        targetDurationSeconds: 1500,
      } as any);

      // Third findUnique in final getSprintSnapshot
      vi.mocked(prisma.roomSprint.findUnique).mockResolvedValueOnce({
        id: 'sprint-expired',
        studyRoomId: 'room-1',
        creatorId: 'user-1',
        status: 'COMPLETED',
        deadline: null,
        endedAt: new Date(),
        targetDurationSeconds: 1500,
        elapsedSeconds: 1500,
        startedAt: new Date(Date.now() - 1600000),
        version: 1,
        revision: 2,
        participants: [],
      } as any);

      const snapshot = await sprintService.getSprintSnapshot('sprint-expired');
      expect(snapshot.status).toBe('COMPLETED');
      expect(snapshot.remainingSeconds).toBe(0);
      expect(prisma.roomSprintParticipant.updateMany).toHaveBeenCalledWith({
        where: { sprintId: 'sprint-expired', status: 'JOINED' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      });
    });
  });
});
