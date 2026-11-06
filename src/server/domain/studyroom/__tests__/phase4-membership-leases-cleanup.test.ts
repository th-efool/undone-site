/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { studyRoomService } from '../studyroom.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

// Database doubles execute serially. The PostgreSQL gate covers real lock interleavings.
vi.mock('@/src/server/domain/studyroom/room-access', async (load) => ({
  ...await load<typeof import('@/src/server/domain/studyroom/room-access')>(),
  lockRooms: vi.fn(), lockUser: vi.fn(),
}));
vi.mock('server-only', () => ({}));

vi.mock('@/src/server/domain/studyroom/studyroom.policy', () => ({
  studyroomPolicy: {
    resolveRoomEligibility: vi.fn().mockResolvedValue({ eligible: true, reason: 'ELIGIBLE' }),
    validateRoomSlug: vi.fn((slug: string) => slug),
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
  const mockStudyRoom = {
    updateMany:vi.fn(async()=>({count:1})),
    findUniqueOrThrow: vi.fn(async () => {
      const model = prisma.studyRoom;
      const recent = [model.findUnique,model.findFirst].flatMap(fn => vi.isMockFunction(fn) ? fn.mock.results.slice(-1) : []);
      for (const call of recent) { const room = await call.value; if (room) return room; }
      throw Error('Missing room fixture');
    }),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  };

  const mockRoomParticipant = {
    updateMany:vi.fn(async()=>({count:1})),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };

  const mockRoomLease = {
    updateMany:vi.fn(async()=>({count:1})),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  };

  const mockRealtimeStream = {
    upsert:vi.fn(async()=>({id:'s',eventCounter:1,generation:1})),
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
      const candidate = {id:'expired',userId:'ghost',studyRoomId:'room-1',generation:3};
      vi.mocked(prisma.roomLease.findMany).mockResolvedValueOnce([candidate] as any);
      vi.mocked(prisma.roomLease.deleteMany).mockResolvedValueOnce({count:1});
      vi.mocked(prisma.roomLease.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.roomParticipant.deleteMany).mockResolvedValueOnce({count:1});
      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{userId:'alive'}] as any);
      const result = await studyRoomService.reconcileExpiredLeases({batchSize:10,gracePeriodMs:5000});
      expect(result).toMatchObject({evictedLeasesCount:1,evictedParticipantsCount:1,updatedRoomsCount:1});
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(prisma.roomLease.findMany).toHaveBeenCalledWith(expect.objectContaining({take:10,where:{expiresAt:{lte:expect.any(Date)}}}));
      expect(prisma.roomLease.deleteMany).toHaveBeenCalledWith({where:{id:'expired',expiresAt:{lte:expect.any(Date)}}});
      expect(prisma.roomParticipant.deleteMany).toHaveBeenCalledWith({where:{userId:'ghost',studyRoomId:'room-1',generation:3}});
      expect(prisma.studyRoom.updateMany).toHaveBeenCalledWith({where:{id:'room-1',onlineCount:{not:1}},data:{onlineCount:1}});
    });
  });
});
