/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { studyRoomService } from '../studyroom.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/domain/studyroom/studyroom.policy', () => ({
  studyroomPolicy: {
    resolveRoomEligibility: vi.fn().mockResolvedValue({ eligible: true, reason: 'ELIGIBLE' }),
    validateRoomSlug: vi.fn((slug: string) => slug),
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
  const mockStudyRoom = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  };

  const mockRoomParticipant = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };

  const mockRoomLease = {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
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

  const mockRoomAuditLog = {
    findFirst: vi.fn(),
    create: vi.fn(),
  };

  const mockTransaction = vi.fn(async (cb: (tx: any) => Promise<any>) => {
    return cb({
      studyRoom: mockStudyRoom,
      roomParticipant: mockRoomParticipant,
      roomLease: mockRoomLease,
      realtimeStream: mockRealtimeStream,
      realtimeEvent: mockRealtimeEvent,
      realtimeDelivery: mockRealtimeDelivery,
      roomAuditLog: mockRoomAuditLog,
    });
  });

  return {
    prisma: {
      studyRoom: mockStudyRoom,
      roomParticipant: mockRoomParticipant,
      roomLease: mockRoomLease,
      realtimeStream: mockRealtimeStream,
      realtimeEvent: mockRealtimeEvent,
      realtimeDelivery: mockRealtimeDelivery,
      roomAuditLog: mockRoomAuditLog,
      $transaction: mockTransaction,
    },
  };
});

describe('Phase 4: Membership, Leases, and Cleanup Robustness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Monotonic Assignment Epochs', () => {
    it('strictly increments generation when rejoining after room exit or participant deletion', async () => {
      // Room exists
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        slug: 'fireplace',
        status: 'ACTIVE',
      } as any);

      // User has no active participant row (they left earlier)
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValue(null);

      // Audit log records previous historical generation 4
      vi.mocked(prisma.roomAuditLog.findFirst).mockResolvedValue({
        id: 'audit-old',
        studyRoomId: 'room-1',
        action: 'ROOM_JOIN',
        details: { generation: 4 },
      } as any);

      vi.mocked(prisma.roomLease.findFirst).mockResolvedValue({
        generation: 4,
      } as any);

      vi.mocked(prisma.roomParticipant.upsert).mockResolvedValue({
        id: 'part-new',
        userId: 'user-1',
        studyRoomId: 'room-1',
        generation: 5,
      } as any);

      vi.mocked(prisma.roomLease.upsert).mockResolvedValue({
        id: 'lease-new',
        expiresAt: new Date(Date.now() + 90000),
      } as any);

      vi.mocked(prisma.roomLease.groupBy).mockResolvedValue([{ userId: 'user-1' } as any]);

      const result = await studyRoomService.joinRoom({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-1',
      });

      expect(result.success).toBe(true);
      // Epoch must strictly exceed previous historical maximum (4 + 1 = 5)
      expect(result.generation).toBe(5);
      expect(prisma.roomParticipant.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ generation: 5 }),
          update: expect.objectContaining({ generation: 5 }),
        })
      );
    });

    it('strictly increments generation on room switch and emits left + joined events', async () => {
      vi.mocked(prisma.studyRoom.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where.id === 'room-2') return { id: 'room-2', slug: 'library', status: 'ACTIVE' } as any;
        return { id: 'room-1', slug: 'fireplace', status: 'ACTIVE' } as any;
      });

      // User is currently in room-1 at generation 2
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValue({
        id: 'part-old',
        userId: 'user-1',
        studyRoomId: 'room-1',
        generation: 2,
      } as any);

      vi.mocked(prisma.roomLease.findFirst).mockResolvedValue({ generation: 2 } as any);
      vi.mocked(prisma.roomAuditLog.findFirst).mockResolvedValue(null);

      vi.mocked(prisma.roomLease.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.roomParticipant.upsert).mockResolvedValue({} as any);
      vi.mocked(prisma.roomLease.upsert).mockResolvedValue({
        id: 'lease-new',
        expiresAt: new Date(),
      } as any);

      vi.mocked(prisma.realtimeStream.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where.studyRoomId === 'room-1') return { id: 'stream-1', generation: 1, eventCounter: 10 } as any;
        if (where.studyRoomId === 'room-2') return { id: 'stream-2', generation: 1, eventCounter: 20 } as any;
        return null;
      });
      vi.mocked(prisma.realtimeStream.update as any).mockImplementation(async () => {
        return { id: 'stream', generation: 1, eventCounter: 21 } as any;
      });

      const result = await studyRoomService.joinRoom({
        userId: 'user-1',
        roomId: 'room-2',
        tabId: 'tab-switch',
      });

      expect(result.success).toBe(true);
      expect(result.isSwitch).toBe(true);
      expect(result.generation).toBe(3); // 2 + 1 = 3

      // Outbox events emitted: room.participant.left for room-1 and room.assignment.changed for room-2
      expect(prisma.realtimeEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'room.participant.left',
            entityId: 'user-1',
          }),
        })
      );
      expect(prisma.realtimeEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'room.assignment.changed',
            entityId: 'user-1',
          }),
        })
      );
    });
  });

  describe('Idempotency with requestId', () => {
    it('returns cached join result without re-executing join transaction when requestId matches', async () => {
      vi.mocked(prisma.roomAuditLog.findFirst).mockResolvedValue({
        id: 'audit-prev',
        studyRoomId: 'room-1',
        action: 'ROOM_JOIN',
        clientRequestId: 'req-abc-123',
        details: {
          roomId: 'room-1',
          slug: 'fireplace',
          generation: 2,
          leaseId: 'lease-cached',
          tabId: 'tab-1',
          expiresAt: '2026-10-21T12:00:00.000Z',
        },
      } as any);

      // User is currently participant in room-1
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValue({
        userId: 'user-1',
        studyRoomId: 'room-1',
        generation: 2,
      } as any);

      const result = await studyRoomService.joinRoom({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-1',
        requestId: 'req-abc-123',
      });

      expect(result.success).toBe(true);
      expect(result.generation).toBe(2);
      expect(result.lease.leaseId).toBe('lease-cached');
      // Should bypass $transaction
      expect(prisma.roomParticipant.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Fenced Leave Operations', () => {
    it('rejects stale leave with mismatched generation as a no-op without affecting membership', async () => {
      // User is currently at generation 3
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValue({
        id: 'part-1',
        userId: 'user-1',
        studyRoomId: 'room-1',
        generation: 3,
      } as any);

      // Leave request arrived with generation 2 (from old tab before switch/rejoin)
      const result = await studyRoomService.leaveRoom({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'old-tab',
        generation: 2,
      });

      expect(result.success).toBe(true);
      expect(result.left).toBe(false);
      expect(prisma.roomLease.deleteMany).not.toHaveBeenCalled();
      expect(prisma.roomParticipant.delete).not.toHaveBeenCalled();
    });

    it('rejects stale leave with mismatched roomId as a no-op without damaging new room membership', async () => {
      // User is currently in room-2
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValue({
        id: 'part-2',
        userId: 'user-1',
        studyRoomId: 'room-2',
        generation: 1,
      } as any);

      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        slug: 'fireplace',
      } as any);

      // Delayed beacon from room-1 arrives after user already switched to room-2
      const result = await studyRoomService.leaveRoom({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-room-1',
      });

      expect(result.success).toBe(true);
      expect(result.left).toBe(false);
      expect(prisma.roomLease.deleteMany).not.toHaveBeenCalled();
      expect(prisma.roomParticipant.delete).not.toHaveBeenCalled();
    });

    it('successfully leaves room and emits room.participant.left outbox event when fenced correctly', async () => {
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValue({
        id: 'part-1',
        userId: 'user-1',
        studyRoomId: 'room-1',
        generation: 2,
      } as any);

      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        slug: 'fireplace',
      } as any);

      vi.mocked(prisma.roomLease.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.realtimeStream.findUnique).mockResolvedValue({
        id: 'stream-1',
        generation: 1,
        eventCounter: 5,
      } as any);
      vi.mocked(prisma.realtimeStream.update).mockResolvedValue({
        id: 'stream-1',
        generation: 1,
        eventCounter: 6,
      } as any);

      const result = await studyRoomService.leaveRoom({
        userId: 'user-1',
        roomId: 'room-1',
        generation: 2,
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

      expect(prisma.realtimeEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'room.participant.left',
            entityId: 'user-1',
          }),
        })
      );
      expect(prisma.realtimeDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            destination: 'room:room-1:g1',
          }),
        })
      );
    });
  });

  describe('Reconciliation Sweep with Grace Period Buffer', () => {
    it('sweeps only expired leases past the safety grace buffer and returns duration metrics', async () => {
      vi.mocked(prisma.roomLease.deleteMany).mockResolvedValue({ count: 3 } as any);
      vi.mocked(prisma.roomParticipant.findMany).mockResolvedValue([
        { id: 'part-dead', userId: 'user-expired', studyRoomId: 'room-1' },
        { id: 'part-alive', userId: 'user-active', studyRoomId: 'room-1' },
      ] as any);

      vi.mocked(prisma.roomLease.findMany).mockResolvedValue([
        { userId: 'user-active', studyRoomId: 'room-1' },
      ] as any);

      vi.mocked(prisma.studyRoom.findMany).mockResolvedValue([{ id: 'room-1' }] as any);
      vi.mocked(prisma.roomLease.groupBy).mockResolvedValue([{ userId: 'user-active' } as any]);

      const result = await studyRoomService.reconcileExpiredLeases({
        gracePeriodMs: 5000,
      });

      expect(result.evictedLeasesCount).toBe(3);
      expect(result.evictedParticipantsCount).toBe(1);
      expect(result.updatedRoomsCount).toBe(1);
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // Verify cutoff applied with grace buffer
      expect(prisma.roomLease.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            expiresAt: expect.objectContaining({
              lte: expect.any(Date),
            }),
          },
        })
      );
      // Ghost participant was deleted
      expect(prisma.roomParticipant.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['part-dead'] } },
      });
    });
  });
});
