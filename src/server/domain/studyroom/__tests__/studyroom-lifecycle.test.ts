import { describe, expect, it, vi, beforeEach } from 'vitest';
import { studyRoomService } from '../studyroom.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { studyroomPolicy } from '../studyroom.policy';
import {
  RoomNotFoundError,
  RoomForbiddenError,
  RoomQuotaExceededError,
} from '@/src/shared/studyroom/contracts';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/domain/studyroom/studyroom.policy', () => ({
  studyroomPolicy: {
    resolveRoomEligibility: vi.fn(),
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
  const mockStudyRoom = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  };

  const mockRoomParticipant = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };

  const mockRoomLease = {
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  };

  const mockRoomController = {
    findMany: vi.fn(),
  };

  const mockTransaction = vi.fn(async (cb: (tx: any) => Promise<any>) =>
    cb({
      studyRoom: mockStudyRoom,
      roomParticipant: mockRoomParticipant,
      roomLease: mockRoomLease,
      roomController: mockRoomController,
    })
  );

  return {
    prisma: {
      studyRoom: mockStudyRoom,
      roomParticipant: mockRoomParticipant,
      roomLease: mockRoomLease,
      roomController: mockRoomController,
      $transaction: mockTransaction,
    },
  };
});

describe('Phase 4: Study Room Lifecycle, Lease Fencing & Multi-Tab Presence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('joinRoom', () => {
    it('throws RoomNotFoundError when target room does not exist', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValueOnce(null);

      await expect(
        studyRoomService.joinRoom({
          userId: 'user-1',
          roomId: 'nonexistent',
          tabId: 'tab-1',
        })
      ).rejects.toThrow(RoomNotFoundError);
    });

    it('rejects joining when room is at full capacity with RoomQuotaExceededError', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
        id: 'room-1',
        slug: 'room-full',
        status: 'OPEN',
        capacity: 2,
      } as any);

      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce(null);

      vi.mocked(studyroomPolicy.resolveRoomEligibility).mockResolvedValueOnce({
        eligible: false,
        reason: 'ROOM_FULL',
      });

      await expect(
        studyRoomService.joinRoom({
          userId: 'user-new',
          roomId: 'room-1',
          tabId: 'tab-1',
        })
      ).rejects.toThrow(RoomQuotaExceededError);
    });

    it('rejects joining when room is CLOSED with RoomForbiddenError', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
        id: 'room-closed',
        slug: 'closed-den',
        status: 'CLOSED',
      } as any);

      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce(null);

      vi.mocked(studyroomPolicy.resolveRoomEligibility).mockResolvedValueOnce({
        eligible: false,
        reason: 'ROOM_CLOSED',
      });

      await expect(
        studyRoomService.joinRoom({
          userId: 'user-1',
          roomId: 'room-closed',
          tabId: 'tab-1',
        })
      ).rejects.toThrow(RoomForbiddenError);
    });

    it('joins room and creates 90-second lease with generation 1 for new participant', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
        id: 'room-1',
        slug: 'fireplace',
        status: 'OPEN',
        capacity: 25,
      } as any);

      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce(null);
      vi.mocked(studyroomPolicy.resolveRoomEligibility).mockResolvedValueOnce({
        eligible: true,
        reason: 'ELIGIBLE',
      });

      const expiresAt = new Date(Date.now() + 90000);
      vi.mocked(prisma.roomLease.upsert).mockResolvedValueOnce({
        id: 'lease-1',
        userId: 'user-1',
        studyRoomId: 'room-1',
        tabId: 'tab-1',
        generation: 1,
        expiresAt,
      } as any);

      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{ userId: 'user-1' }] as any);

      const result = await studyRoomService.joinRoom({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-1',
      });

      expect(result.success).toBe(true);
      expect(result.roomId).toBe('room-1');
      expect(result.slug).toBe('fireplace');
      expect(result.generation).toBe(1);
      expect(result.isSwitch).toBe(false);
      expect(result.lease.tabId).toBe('tab-1');

      expect(prisma.roomParticipant.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            userId: 'user-1',
            studyRoomId: 'room-1',
            generation: 1,
          }),
        })
      );
    });

    it('multi-tab presence: second tab shares generation and counts as 1 distinct user towards onlineCount', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
        id: 'room-1',
        slug: 'fireplace',
        status: 'OPEN',
        capacity: 25,
      } as any);

      // User already present in room-1 with generation 1
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
        userId: 'user-1',
        studyRoomId: 'room-1',
        generation: 1,
      } as any);

      vi.mocked(studyroomPolicy.resolveRoomEligibility).mockResolvedValueOnce({
        eligible: true,
        reason: 'ELIGIBLE',
      });

      const expiresAt = new Date(Date.now() + 90000);
      vi.mocked(prisma.roomLease.upsert).mockResolvedValueOnce({
        id: 'lease-2',
        userId: 'user-1',
        studyRoomId: 'room-1',
        tabId: 'tab-2',
        generation: 1,
        expiresAt,
      } as any);

      // Distinct users = 1 user
      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{ userId: 'user-1' }] as any);

      const result = await studyRoomService.joinRoom({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-2',
      });

      expect(result.success).toBe(true);
      expect(result.generation).toBe(1);
      expect(result.isSwitch).toBe(false);
      expect(prisma.studyRoom.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'room-1' },
          data: { onlineCount: 1 },
        })
      );
    });

    it('atomic room switch: evicts old room leases, increments generation, and updates both online counts', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
        id: 'room-target',
        slug: 'target-room',
        status: 'OPEN',
        capacity: 25,
      } as any);

      // Currently in old room with generation 1
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
        userId: 'user-1',
        studyRoomId: 'room-old',
        generation: 1,
      } as any);

      vi.mocked(studyroomPolicy.resolveRoomEligibility).mockResolvedValueOnce({
        eligible: true,
        reason: 'ELIGIBLE',
      });

      // Old room active users after leave = 0
      vi.mocked(prisma.roomLease.groupBy)
        .mockResolvedValueOnce([]) // old room
        .mockResolvedValueOnce([{ userId: 'user-1' }] as any); // new room

      const expiresAt = new Date(Date.now() + 90000);
      vi.mocked(prisma.roomLease.upsert).mockResolvedValueOnce({
        id: 'lease-new',
        userId: 'user-1',
        studyRoomId: 'room-target',
        tabId: 'tab-1',
        generation: 2,
        expiresAt,
      } as any);

      const result = await studyRoomService.joinRoom({
        userId: 'user-1',
        roomId: 'room-target',
        tabId: 'tab-1',
      });

      expect(result.success).toBe(true);
      expect(result.isSwitch).toBe(true);
      expect(result.generation).toBe(2);

      // Verify old room leases deleted
      expect(prisma.roomLease.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', studyRoomId: 'room-old' },
      });
      // Verify old room online count decremented
      expect(prisma.studyRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-old' },
        data: { onlineCount: 0 },
      });
    });
  });

  describe('renewLease', () => {
    it('renews active lease by extending expiresAt when generation matches', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
        id: 'room-1',
      } as any);

      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
        userId: 'user-1',
        studyRoomId: 'room-1',
        generation: 1,
      } as any);

      const newExpiresAt = new Date(Date.now() + 90000);
      vi.mocked(prisma.roomLease.upsert).mockResolvedValueOnce({
        id: 'lease-1',
        expiresAt: newExpiresAt,
      } as any);

      const result = await studyRoomService.renewLease({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-1',
        generation: 1,
      });

      expect(result.success).toBe(true);
      expect(result.expiresAt).toBe(newExpiresAt.toISOString());
    });

    it('rejects stale generation renewal from an old room session', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
        id: 'room-1',
      } as any);

      // Current participant generation is 2 (switched room)
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
        userId: 'user-1',
        studyRoomId: 'room-1',
        generation: 2,
      } as any);

      // Delayed heartbeat arriving with stale generation 1
      const result = await studyRoomService.renewLease({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-1',
        generation: 1,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('stale_generation');
      expect(prisma.roomLease.upsert).not.toHaveBeenCalled();
    });

    it('returns not_in_room when user has no active participant record', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
        id: 'room-1',
      } as any);

      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce(null);

      const result = await studyRoomService.renewLease({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-1',
        generation: 1,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_in_room');
    });
  });

  describe('leaveRoom', () => {
    it('closing tab 1 when tab 2 is open: deletes tab 1 lease, user remains in room', async () => {
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
        userId: 'user-1',
        studyRoomId: 'room-1',
      } as any);

      // Remaining active leases = 1 (tab 2 still open)
      vi.mocked(prisma.roomLease.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{ userId: 'user-1' }] as any);

      const result = await studyRoomService.leaveRoom({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-1',
      });

      expect(result.success).toBe(true);
      expect(result.left).toBe(false);
      expect(result.remainingLeases).toBe(1);

      // Participant row should NOT be deleted
      expect(prisma.roomParticipant.delete).not.toHaveBeenCalled();
    });

    it('closing last active tab: deletes participant row and decrements room occupancy', async () => {
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
        userId: 'user-1',
        studyRoomId: 'room-1',
      } as any);

      // Remaining active leases = 0
      vi.mocked(prisma.roomLease.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([]);

      const result = await studyRoomService.leaveRoom({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-1',
      });

      expect(result.success).toBe(true);
      expect(result.left).toBe(true);
      expect(result.remainingLeases).toBe(0);

      // Participant row MUST be deleted
      expect(prisma.roomParticipant.delete).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      // Online count updated to 0
      expect(prisma.studyRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { onlineCount: 0 },
      });
    });

    it('explicit global leave: deletes all leases and participant immediately', async () => {
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
        userId: 'user-1',
        studyRoomId: 'room-1',
      } as any);

      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([]);

      const result = await studyRoomService.leaveRoom({
        userId: 'user-1',
        roomId: 'room-1',
        global: true,
      });

      expect(result.success).toBe(true);
      expect(result.left).toBe(true);
      expect(prisma.roomLease.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', studyRoomId: 'room-1' },
      });
      expect(prisma.roomParticipant.delete).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  describe('reconcileExpiredLeases', () => {
    it('prunes expired leases and evicts ghost participants', async () => {
      vi.mocked(prisma.roomLease.deleteMany).mockResolvedValueOnce({ count: 5 } as any);
      vi.mocked(prisma.roomParticipant.findMany).mockResolvedValueOnce([
        { id: 'p-1', userId: 'user-ghost', studyRoomId: 'room-1' },
        { id: 'p-2', userId: 'user-active', studyRoomId: 'room-1' },
      ] as any);
      vi.mocked(prisma.roomLease.findMany).mockResolvedValueOnce([
        { userId: 'user-active', studyRoomId: 'room-1' },
      ] as any);
      vi.mocked(prisma.studyRoom.findMany).mockResolvedValueOnce([{ id: 'room-1' }] as any);
      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{ userId: 'user-active' }] as any);

      const result = await studyRoomService.reconcileExpiredLeases();

      expect(result.evictedLeasesCount).toBe(5);
      expect(result.evictedParticipantsCount).toBe(1);
      expect(prisma.roomParticipant.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['p-1'] } },
      });
      expect(prisma.studyRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { onlineCount: 1 },
      });
    });
  });
});
