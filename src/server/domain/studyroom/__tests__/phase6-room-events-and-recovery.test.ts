/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { studyRoomService } from '../studyroom.service';
import { roomGovernanceService } from '../room-governance.service';
import { roomManagementService } from '../room-management.service';
import { proxyAuthService } from '@/src/server/domain/messaging/proxy-auth.service';
import { studyroomPolicy } from '@/src/server/domain/studyroom/studyroom.policy';
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
    resolveUserRoomRole: vi.fn().mockResolvedValue({ role: 'PARTICIPANT', isOwner: false }),
    evaluateCapabilities: vi.fn().mockResolvedValue({
      canJoin: true,
      canEditRoom: true,
      canControlEnvironment: true,
      canManageParticipants: true,
      canTransferOwnership: true,
      canChangeLifecycle: true,
      canManageRoles: true,
    }),
    validateRoomSlug: vi.fn((slug: string) => slug),
    assertTargetHierarchy: vi.fn(),
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
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  const mockRoomLease = {
    updateMany:vi.fn(async()=>({count:1})),
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    upsert: vi.fn(),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    count: vi.fn().mockResolvedValue(0),
    groupBy: vi.fn().mockResolvedValue([]),
  };

  const mockRealtimeStream = {
    upsert:vi.fn(async()=>({id:'s',eventCounter:1,generation:1})),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };

  const mockRealtimeEvent = {
    create: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
  };

  const mockRealtimeDelivery = {
    create: vi.fn(),
  };

  const mockRoomAuditLog = {
    findFirst: vi.fn(),
    create: vi.fn(),
  };

  const mockRoomRestriction = {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn(),
  };

  const mockChannel = {
    findUnique: vi.fn(),
  };

  const mockUserRestriction = {
    findUnique: vi.fn(),
  };

  const mockUser = {
    findUnique: vi.fn(),
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
      roomRestriction: mockRoomRestriction,
      channel: mockChannel,
      userRestriction: mockUserRestriction,
      user: mockUser,
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
      roomRestriction: mockRoomRestriction,
      channel: mockChannel,
      userRestriction: mockUserRestriction,
      user: mockUser,
      $transaction: mockTransaction,
    },
  };
});

describe('Phase 6: Room Events and Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('studyRoomService.syncRoomEvents', () => {
    it('returns SNAPSHOT when clientSequence is not provided or 0', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockImplementation((async()=>await vi.mocked(prisma.studyRoom.findFirst).mock.results.at(-1)?.value) as any);
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
        id: 'room-1',
        slug: 'room-one',
        title: 'Room One',
        status: 'OPEN',
        ownerId: 'owner-1',
      } as any);

      vi.mocked(prisma.roomLease.findFirst).mockResolvedValue({
        id: 'lease-1',
        studyRoomId: 'room-1',
        userId: 'user-1',
      } as any);

      vi.mocked(prisma.roomLease.findMany).mockResolvedValueOnce([
        { userId: 'user-1' },
      ] as any);

      vi.mocked(prisma.realtimeStream.findUnique).mockResolvedValueOnce({
        id: 'stream-1',
        studyRoomId: 'room-1',
        generation: 2,
        eventCounter: 45,
      } as any);

      vi.mocked(prisma.roomParticipant.findMany).mockResolvedValueOnce([
        {
          userId: 'user-1',
          joinedAt: new Date(),
          user: { id: 'user-1', name: 'User One', username: 'u1', image: null },
        },
      ] as any);

      const result = await studyRoomService.syncRoomEvents({
        roomIdOrSlug: 'room-one',
        userId: 'user-1',
        clientSequence: 0,
      });

      expect(result.mode).toBe('SNAPSHOT');
      expect(result.roomId).toBe('room-1');
      expect(result.generation).toBe(2);
      expect(result.currentSequence).toBe(45);
      expect(result.roster).toHaveLength(1);
    });

    it('returns SNAPSHOT when sequence gap exceeds maxDeltaGap (150)', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockImplementation((async()=>await vi.mocked(prisma.studyRoom.findFirst).mock.results.at(-1)?.value) as any);
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
        id: 'room-1',
        slug: 'room-one',
        title: 'Room One',
        status: 'OPEN',
        ownerId: 'owner-1',
      } as any);

      vi.mocked(prisma.roomLease.findFirst).mockResolvedValue({
        id: 'lease-1',
        studyRoomId: 'room-1',
        userId: 'user-1',
      } as any);

      vi.mocked(prisma.roomLease.findMany).mockResolvedValueOnce([]);

      vi.mocked(prisma.realtimeStream.findUnique).mockResolvedValueOnce({
        id: 'stream-1',
        studyRoomId: 'room-1',
        generation: 1,
        eventCounter: 250,
      } as any);

      vi.mocked(prisma.roomParticipant.findMany).mockResolvedValueOnce([] as any);

      const result = await studyRoomService.syncRoomEvents({
        roomIdOrSlug: 'room-one',
        userId: 'user-1',
        clientSequence: 50, // 250 - 50 = 200 > 150
      });

      expect(result.mode).toBe('SNAPSHOT');
      expect(result.currentSequence).toBe(250);
    });

    it('returns DELTA with events when clientSequence is within catchup window', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockImplementation((async()=>await vi.mocked(prisma.studyRoom.findFirst).mock.results.at(-1)?.value) as any);
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
        id: 'room-1',
        slug: 'room-one',
        title: 'Room One',
        status: 'OPEN',
        ownerId: 'owner-1',
      } as any);

      vi.mocked(prisma.roomLease.findFirst).mockResolvedValue({
        id: 'lease-1',
        studyRoomId: 'room-1',
        userId: 'user-1',
      } as any);

      vi.mocked(prisma.realtimeStream.findUnique).mockResolvedValueOnce({
        id: 'stream-1',
        studyRoomId: 'room-1',
        generation: 1,
        eventCounter: 50,
      } as any);

      vi.mocked(prisma.realtimeEvent.findMany).mockResolvedValueOnce([
        {
          eventId: 'evt-1',
          sequence: 48,
          type: 'room.participant.joined',
          generation: 1,
          entityId: 'room-1',
          payload: { userId: 'u2' },
          occurredAt: new Date(),
        },
        {
          eventId: 'evt-2',
          sequence: 49,
          type: 'room.roster.changed',
          generation: 1,
          entityId: 'room-1',
          payload: { onlineCount: 2 },
          occurredAt: new Date(),
        },
      ] as any);

      const result = await studyRoomService.syncRoomEvents({
        roomIdOrSlug: 'room-one',
        userId: 'user-1',
        clientSequence: 47,
      });

      expect(result.mode).toBe('DELTA');
      expect(result.events).toHaveLength(2);
      expect(result.currentSequence).toBe(50);
      expect(result.events?.[0].sequence).toBe(48);
    });

    it('throws RoomForbiddenError if user is not authorized or has no active lease', async () => {
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValueOnce({
        id: 'room-1',
        slug: 'room-one',
        ownerId: 'owner-1',
      } as any);

      // No active lease
      vi.mocked(prisma.roomLease.findFirst).mockResolvedValueOnce(null);

      await expect(
        studyRoomService.syncRoomEvents({
          roomIdOrSlug: 'room-one',
          userId: 'user-unauthorized',
          clientSequence: 10,
        })
      ).rejects.toThrow('Active room lease required to sync room events');
    });
  });

  describe('proxyAuthService generation validation', () => {
    it('rejects room subscription with code 103 when client stream generation is outdated', async () => {
      vi.mocked(prisma.userRestriction.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        email: 'user1@test.com',
        username: 'user1',
      } as any);

      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
        id: 'room-1',
        status: 'OPEN',
        realtimeStream: { generation: 3 },
      } as any);

      const result = await proxyAuthService.authorizeSubscription('user-1', 'room:room-1:g2');

      expect(result.allowed).toBe(false);
      expect(result.code).toBe(103);
      expect(result.message).toMatch(/generation/i);
    });

    it('approves room subscription when client stream generation matches room stream', async () => {
      vi.mocked(prisma.userRestriction.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        email: 'user1@test.com',
        username: 'user1',
      } as any);

      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
        id: 'room-1',
        status: 'OPEN',
        realtimeStream: { generation: 2 },
      } as any);

      vi.mocked(prisma.roomLease.findFirst).mockResolvedValueOnce({
        id: 'lease-1',
        studyRoomId: 'room-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60000),
      } as any);

      const result = await proxyAuthService.authorizeSubscription('user-1', 'room:room-1:g2');

      expect(result.allowed).toBe(true);
      expect(result.expireAt).toBeDefined();
    });

    it('rejects roomchat subscription with code 103 when channel stream generation does not match', async () => {
      vi.mocked(prisma.userRestriction.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        email: 'user1@test.com',
        username: 'user1',
      } as any);

      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'chan-1',
        studyRoomId: 'room-1',
        realtimeStream: { generation: 2 },
        studyRoom: {
      findUniqueOrThrow: vi.fn(async () => {
      const model = prisma.studyRoom;
      const recent = [model.findUnique,model.findFirst].flatMap(fn => vi.isMockFunction(fn) ? fn.mock.results.slice(-1) : []);
      for (const call of recent) { const room = await call.value; if (room) return room; }
      throw Error('Missing room fixture');
    }), status: 'OPEN' },
      } as any);

      const result = await proxyAuthService.authorizeSubscription('user-1', 'roomchat:chan-1:g1');

      expect(result.allowed).toBe(false);
      expect(result.code).toBe(103);
    });
  });

  describe('Outbox event publishing on room mutations', () => {
    it('reconcileExpiredLeases emits room.participant.left with LEASE_EXPIRED to outbox', async () => {
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
      expect(prisma.realtimeEvent.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({type:'room.participant.left',payload:expect.objectContaining({reason:'LEASE_EXPIRED'})})}));
      expect(prisma.realtimeDelivery.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({destination:'room:room-1:g1'})}));
    });

    it('roomGovernanceService.removeParticipant emits room.participant.left with KICKED to outbox', async () => {
      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValueOnce({
        role: 'HOST',
        isOwner: true,
      } as any);
      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValueOnce({
        role: 'PARTICIPANT',
        isOwner: false,
      } as any);

      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
        id: 'room-1',
        slug: 'room-1',
        ownerId: 'owner-1',
        revision: 1,
      } as any);

      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
        id: 'rp-1',
        userId: 'target-user',
        studyRoomId: 'room-1',
      } as any);

      vi.mocked(prisma.realtimeStream.findUnique).mockResolvedValueOnce({
        id: 'stream-1',
        studyRoomId: 'room-1',
        generation: 1,
        eventCounter: 10,
      } as any);

      vi.mocked(prisma.realtimeStream.update).mockResolvedValueOnce({
        id: 'stream-1',
        studyRoomId: 'room-1',
        generation: 1,
        eventCounter: 11,
      } as any);

      await roomGovernanceService.removeParticipant(
        'room-1',
        'target-user',
        'Rule violation',
        'owner-1'
      );

      expect(prisma.realtimeDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            destination: 'room:room-1:g1',
            status: 'PENDING',
          }),
        })
      );
    });

    it('roomManagementService.transitionLifecycle increments stream generation and emits room.lifecycle.changed on CLOSE', async () => {
      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValueOnce({
        role: 'HOST',
        isOwner: true,
        isPlatformAdmin: false,
      } as any);

      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValueOnce({
        id: 'room-1',
        slug: 'room-1',
        status: 'OPEN',
        ownerId: 'owner-1',
        revision: 2,
      } as any);

      vi.mocked(prisma.studyRoom.update).mockResolvedValueOnce({
        id: 'room-1',
        status: 'CLOSED',
        revision: 3,
      } as any);

      vi.mocked(prisma.realtimeStream.findUnique).mockResolvedValueOnce({
        id: 'stream-1',
        generation: 1,
        eventCounter: 20,
      } as any);

      vi.mocked(prisma.realtimeStream.update).mockResolvedValueOnce({
        id: 'stream-1',
        generation: 2,
        eventCounter: 21,
      } as any);

      await roomManagementService.transitionLifecycle(
        'room-1',
        { action: 'CLOSE', expectedRevision: 2, requestId: 'req-close-1' },
        'owner-1'
      );

      // Stream generation should be incremented to revoke existing socket subscriptions
      expect(prisma.realtimeStream.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'stream-1' },
          data: expect.objectContaining({
            generation: { increment: 1 },
          }),
        })
      );

      // Verify lifecycle changed event emitted
      expect(prisma.realtimeDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      );
    });
  });
});
