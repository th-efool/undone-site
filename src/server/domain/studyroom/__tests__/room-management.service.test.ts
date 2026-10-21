import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { roomManagementService } from '../room-management.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import {
  RoomNotFoundError,
  RoomForbiddenError,
  RoomConflictError,
  RoomValidationError,
} from '@/src/shared/studyroom/contracts';

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    studyRoom: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    user: {
      findUnique: vi.fn(),
    },
    cohort: {
      findUnique: vi.fn(),
    },
    cohortMember: {
      findUnique: vi.fn(),
    },
    channel: {
      create: vi.fn(),
    },
    realtimeStream: {
      create: vi.fn(),
    },
    chatChannel: {
      create: vi.fn(),
    },
    streamChannel: {
      create: vi.fn(),
    },
    roomEnvironment: {
      create: vi.fn(),
    },
    roomAuditLog: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    roomLease: {
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
    },
    roomParticipant: {
      deleteMany: vi.fn(),
    },
    roomController: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    roomOwnershipTransfer: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    roomRestriction: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      return cb(prisma);
    }),
  },
}));

vi.mock('../studyroom.policy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../studyroom.policy')>();
  return {
    ...actual,
    studyroomPolicy: {
      ...actual.studyroomPolicy,
      resolveUserRoomRole: vi.fn(),
      evaluateCapabilities: vi.fn(),
    },
  };
});

import { studyroomPolicy } from '../studyroom.policy';

describe('roomManagementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createRoom', () => {
    it('creates room atomically with channel, stream, environment, and audit log', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.studyRoom.create).mockResolvedValue({
        id: 'room-123',
        slug: 'math-study-group',
        title: 'Math Study Group',
        description: 'Focus room for calculus',
        ownerId: 'user-owner',
        status: 'OPEN',
        capacity: 25,
        revision: 1,
      } as any);

      const result = await roomManagementService.createRoom(
        {
          requestId: 'req-create-1',
          title: 'Math Study Group',
          scopeKind: 'STANDALONE',
          description: 'Focus room for calculus',
          capacity: 25,
        },
        'user-owner'
      );

      expect(result.id).toBe('room-123');
      expect(result.slug).toBe('math-study-group');
      expect(prisma.channel.create).toHaveBeenCalledWith({
        data: {
          name: 'Math Study Group',
          studyRoomId: 'room-123',
          messageCounter: 0,
        },
      });
      expect(prisma.realtimeStream.create).toHaveBeenCalledWith({
        data: {
          studyRoomId: 'room-123',
          generation: 1,
          eventCounter: 0,
        },
      });
      expect(prisma.roomEnvironment.create).toHaveBeenCalled();
      expect(prisma.roomAuditLog.create).toHaveBeenCalled();
    });

    it('rejects duplicate room slug with RoomConflictError when collisions exhausted', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'existing-room',
      } as any);

      await expect(
        roomManagementService.createRoom(
          {
            requestId: 'req-dup-slug',
            title: 'Existing Slug Room',
            scopeKind: 'STANDALONE',
          },
          'user-owner'
        )
      ).rejects.toThrow(RoomConflictError);
    });

    it('rejects creation if user not enrolled in specified cohort', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.cohort.findUnique).mockResolvedValue({
        id: 'cohort-abc',
        creatorId: 'user-cohort-creator',
      } as any);
      vi.mocked(prisma.cohortMember.findUnique).mockResolvedValue(null);

      await expect(
        roomManagementService.createRoom(
          {
            requestId: 'req-cohort-1',
            title: 'Cohort Study Room',
            scopeKind: 'COHORT',
            cohortId: 'cohort-abc',
          },
          'user-outside'
        )
      ).rejects.toThrow(RoomForbiddenError);
    });

    it('rejects invalid capacity below minimum or above maximum', async () => {
      await expect(
        roomManagementService.createRoom(
          {
            requestId: 'req-small',
            title: 'Too Small Room',
            scopeKind: 'STANDALONE',
            capacity: 0,
          },
          'user-owner'
        )
      ).rejects.toThrow(RoomValidationError);

      await expect(
        roomManagementService.createRoom(
          {
            requestId: 'req-big',
            title: 'Too Big Room',
            scopeKind: 'STANDALONE',
            capacity: 500,
          },
          'user-owner'
        )
      ).rejects.toThrow(RoomValidationError);
    });
  });

  describe('updateRoomSettings', () => {
    it('updates room settings when actor is owner and revision matches', async () => {
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
        id: 'room-123',
        ownerId: 'user-owner',
        status: 'OPEN',
        revision: 2,
        capacity: 25,
      } as any);

      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValue({
        role: 'OWNER',
        isOwner: true,
        isPlatformAdmin: false,
        isCohortGovernor: false,
      });

      vi.mocked(prisma.studyRoom.update).mockResolvedValue({
        id: 'room-123',
        slug: 'math-room',
        name: 'Updated Room Name',
        description: 'New Description',
        ownerId: 'user-owner',
        status: 'OPEN',
        capacity: 40,
        revision: 3,
        onlineCount: 5,
        cohortId: null,
        focusModeOnly: false,
        roomPasscode: null,
        allowedBreakRatio: 0.2,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const updated = await roomManagementService.updateRoomSettings(
        'room-123',
        {
          title: 'Updated Room Name',
          description: 'New Description',
          capacity: 40,
          expectedRevision: 2,
        },
        'user-owner'
      );

      expect(updated.id).toBe('room-123');
      expect(updated.revision).toBe(3);
      expect(prisma.roomAuditLog.create).toHaveBeenCalled();
    });

    it('throws RoomConflictError when expectedRevision does not match', async () => {
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
        id: 'room-123',
        ownerId: 'user-owner',
        status: 'OPEN',
        revision: 4,
      } as any);

      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValue({
        role: 'OWNER',
        isOwner: true,
        isPlatformAdmin: false,
        isCohortGovernor: false,
      });

      await expect(
        roomManagementService.updateRoomSettings(
          'room-123',
          {
            title: 'Stale Update',
            expectedRevision: 2,
          },
          'user-owner'
        )
      ).rejects.toThrow(RoomConflictError);
    });

    it('throws RoomForbiddenError if actor cannot manage settings', async () => {
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
        id: 'room-123',
        ownerId: 'user-owner',
        status: 'OPEN',
        revision: 1,
      } as any);

      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValue({
        role: 'PARTICIPANT',
        isOwner: false,
        isPlatformAdmin: false,
        isCohortGovernor: false,
      });

      await expect(
        roomManagementService.updateRoomSettings(
          'room-123',
          {
            title: 'Unauthorized update',
            expectedRevision: 1,
          },
          'user-random'
        )
      ).rejects.toThrow(RoomForbiddenError);
    });
  });

  describe('transitionLifecycle', () => {
    it('transitions from OPEN to CLOSED and evicts active leases/participants', async () => {
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
        id: 'room-123',
        ownerId: 'user-owner',
        status: 'OPEN',
        revision: 1,
      } as any);

      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValue({
        role: 'OWNER',
        isOwner: true,
        isPlatformAdmin: false,
        isCohortGovernor: false,
      });

      vi.mocked(prisma.studyRoom.update).mockResolvedValue({
        id: 'room-123',
        status: 'CLOSED',
        revision: 2,
      } as any);

      await roomManagementService.transitionLifecycle(
        'room-123',
        { action: 'CLOSE', expectedRevision: 1, requestId: 'req-close' },
        'user-owner'
      );

      expect(prisma.roomLease.deleteMany).toHaveBeenCalledWith({
        where: { studyRoomId: 'room-123' },
      });
      expect(prisma.roomParticipant.deleteMany).toHaveBeenCalledWith({
        where: { studyRoomId: 'room-123' },
      });
      expect(prisma.studyRoom.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CLOSED',
            onlineCount: 0,
          }),
        })
      );
    });

    it('rejects invalid lifecycle transition ARCHIVED -> PUBLISH', async () => {
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
        id: 'room-123',
        ownerId: 'user-owner',
        status: 'ARCHIVED',
        revision: 1,
      } as any);

      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValue({
        role: 'OWNER',
        isOwner: true,
        isPlatformAdmin: false,
        isCohortGovernor: false,
      });

      await expect(
        roomManagementService.transitionLifecycle(
          'room-123',
          { action: 'PUBLISH', expectedRevision: 1, requestId: 'req-publish' },
          'user-owner'
        )
      ).rejects.toThrow(RoomValidationError);
    });
  });

  describe('getRoomBootstrap', () => {
    it('returns preview payload for anonymous user on open room', async () => {
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
        id: 'room-123',
        slug: 'preview-room',
        name: 'Preview Room',
        description: 'Test description',
        ownerId: 'user-owner',
        status: 'OPEN',
        capacity: 25,
        onlineCount: 2,
        revision: 1,
        cohortId: null,
        focusModeOnly: false,
        roomPasscode: null,
        allowedBreakRatio: 0.2,
        createdAt: new Date(),
        updatedAt: new Date(),
        environment: {
          backgroundTheme: 'LOFI_CAFE',
          spotifyTrackUri: null,
          externalStreamUrl: null,
          ambientSound: 'RAIN',
          ambientVolume: 50,
          streamMuted: false,
        },
      } as any);

      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValue({
        role: 'PARTICIPANT',
        isOwner: false,
        isPlatformAdmin: false,
        isCohortGovernor: false,
      });

      vi.mocked(studyroomPolicy.evaluateCapabilities).mockResolvedValue({
        canJoin: true,
        canEditRoom: false,
        canControlEnvironment: false,
        canManageParticipants: false,
        canTransferOwnership: false,
        canChangeLifecycle: false,
        canManageRoles: false,
        eligibilityReason: 'ELIGIBLE',
      });

      const bootstrap = await roomManagementService.getRoomBootstrap('room-123', null);

      expect(bootstrap.room.id).toBe('room-123');
      expect(bootstrap.viewer.role).toBe('PARTICIPANT');
      expect(bootstrap.viewer.isJoined).toBe(false);
      expect(bootstrap.viewer.leaseExpiresAt).toBeNull();
      expect(bootstrap.capabilities.canJoin).toBe(true);
      expect(bootstrap.capabilities.canEditRoom).toBe(false);
    });

    it('returns full capabilities and active lease for room owner', async () => {
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue({
        id: 'room-123',
        slug: 'owner-room',
        name: 'Owner Room',
        description: 'Test description',
        ownerId: 'user-owner',
        status: 'OPEN',
        capacity: 25,
        onlineCount: 1,
        revision: 1,
        cohortId: null,
        focusModeOnly: false,
        roomPasscode: null,
        allowedBreakRatio: 0.2,
        createdAt: new Date(),
        updatedAt: new Date(),
        environment: null,
      } as any);

      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValue({
        role: 'OWNER',
        isOwner: true,
        isPlatformAdmin: false,
        isCohortGovernor: false,
      });

      vi.mocked(studyroomPolicy.evaluateCapabilities).mockResolvedValue({
        canJoin: true,
        canEditRoom: true,
        canControlEnvironment: true,
        canManageParticipants: true,
        canTransferOwnership: true,
        canChangeLifecycle: true,
        canManageRoles: true,
        eligibilityReason: 'ELIGIBLE',
      });

      vi.mocked(prisma.roomLease.findFirst).mockResolvedValue({
        id: 'lease-123',
        studyRoomId: 'room-123',
        userId: 'user-owner',
        expiresAt: new Date(Date.now() + 60000),
      } as any);

      vi.mocked(prisma.roomRestriction.findFirst).mockResolvedValue(null);

      const bootstrap = await roomManagementService.getRoomBootstrap('room-123', 'user-owner');

      expect(bootstrap.viewer.role).toBe('OWNER');
      expect(bootstrap.capabilities.canEditRoom).toBe(true);
      expect(bootstrap.capabilities.canManageRoles).toBe(true);
      expect(bootstrap.capabilities.canTransferOwnership).toBe(true);
      expect(bootstrap.viewer.isJoined).toBe(true);
    });
  });
});
