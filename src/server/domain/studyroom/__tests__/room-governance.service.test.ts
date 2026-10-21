import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { roomGovernanceService } from '../room-governance.service';
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
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    cohortMember: {
      findUnique: vi.fn(),
    },
    roomController: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    roomRestriction: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    roomOwnershipTransfer: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    roomLease: {
      deleteMany: vi.fn(),
      groupBy: vi.fn(),
    },
    roomParticipant: {
      deleteMany: vi.fn(),
    },
    roomAuditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      return cb(prisma);
    }),
  },
}));

vi.mock('../studyroom.policy', () => ({
  studyroomPolicy: {
    resolveUserRoomRole: vi.fn(),
    assertTargetHierarchy: vi.fn(),
  },
}));

import { studyroomPolicy } from '../studyroom.policy';

describe('roomGovernanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setController and revokeController', () => {
    it('sets controller role when called by room owner', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        ownerId: 'user-owner',
        cohortId: null,
      } as any);

      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValue({
        role: 'OWNER',
        isOwner: true,
        isPlatformAdmin: false,
        isCohortGovernor: false,
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'target-mod' } as any);

      await roomGovernanceService.setController('room-1', 'target-mod', 'MODERATOR', 'user-owner');

      expect(prisma.roomController.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            studyRoomId: 'room-1',
            userId: 'target-mod',
            role: 'MODERATOR',
            assignedByUserId: 'user-owner',
          }),
        })
      );
      expect(prisma.roomAuditLog.create).toHaveBeenCalled();
    });

    it('rejects setting controller if actor is not room owner or admin', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        ownerId: 'user-owner',
      } as any);

      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValue({
        role: 'MODERATOR',
        isOwner: false,
        isPlatformAdmin: false,
        isCohortGovernor: false,
      });

      await expect(
        roomGovernanceService.setController('room-1', 'target-mod', 'MODERATOR', 'user-mod')
      ).rejects.toThrow(RoomForbiddenError);
    });

    it('rejects assigning controller role to owner', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        ownerId: 'user-owner',
      } as any);

      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValue({
        role: 'OWNER',
        isOwner: true,
        isPlatformAdmin: false,
        isCohortGovernor: false,
      });

      await expect(
        roomGovernanceService.setController('room-1', 'user-owner', 'MODERATOR', 'user-owner')
      ).rejects.toThrow(RoomValidationError);
    });

    it('revokes controller role when called by owner', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        ownerId: 'user-owner',
      } as any);

      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValue({
        role: 'OWNER',
        isOwner: true,
        isPlatformAdmin: false,
        isCohortGovernor: false,
      });

      await roomGovernanceService.revokeController('room-1', 'target-mod', 'user-owner');

      expect(prisma.roomController.deleteMany).toHaveBeenCalledWith({
        where: { studyRoomId: 'room-1', userId: 'target-mod' },
      });
      expect(prisma.roomAuditLog.create).toHaveBeenCalled();
    });
  });

  describe('removeParticipant and banParticipant', () => {
    it('removes participant with 2-minute cooldown and invalidates leases', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        ownerId: 'user-owner',
      } as any);

      vi.mocked(studyroomPolicy.resolveUserRoomRole)
        .mockResolvedValueOnce({ role: 'OWNER', isOwner: true, isPlatformAdmin: false, isCohortGovernor: false })
        .mockResolvedValueOnce({ role: 'PARTICIPANT', isOwner: false, isPlatformAdmin: false, isCohortGovernor: false });

      vi.mocked(prisma.roomLease.groupBy).mockResolvedValue([] as any);

      await roomGovernanceService.removeParticipant('room-1', 'target-user', 'Disruptive', 'user-owner');

      expect(studyroomPolicy.assertTargetHierarchy).toHaveBeenCalledWith('OWNER', 'PARTICIPANT');
      expect(prisma.roomLease.deleteMany).toHaveBeenCalledWith({
        where: { studyRoomId: 'room-1', userId: 'target-user' },
      });
      expect(prisma.roomParticipant.deleteMany).toHaveBeenCalledWith({
        where: { studyRoomId: 'room-1', userId: 'target-user' },
      });
      expect(prisma.roomRestriction.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            action: 'REMOVE',
            reason: 'Disruptive',
          }),
        })
      );
      expect(prisma.roomAuditLog.create).toHaveBeenCalled();
    });

    it('bans participant with custom duration and cleans leases', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        ownerId: 'user-owner',
      } as any);

      vi.mocked(studyroomPolicy.resolveUserRoomRole)
        .mockResolvedValueOnce({ role: 'MODERATOR', isOwner: false, isPlatformAdmin: false, isCohortGovernor: false })
        .mockResolvedValueOnce({ role: 'PARTICIPANT', isOwner: false, isPlatformAdmin: false, isCohortGovernor: false });

      vi.mocked(prisma.roomLease.groupBy).mockResolvedValue([] as any);

      await roomGovernanceService.banParticipant('room-1', 'target-user', 'Harassment', 60, 'user-mod');

      expect(studyroomPolicy.assertTargetHierarchy).toHaveBeenCalledWith('MODERATOR', 'PARTICIPANT');
      expect(prisma.roomRestriction.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            action: 'BAN',
            reason: 'Harassment',
          }),
        })
      );
      expect(prisma.roomAuditLog.create).toHaveBeenCalled();
    });

    it('unbans user and writes audit log', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        ownerId: 'user-owner',
      } as any);

      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValue({
        role: 'MODERATOR',
        isOwner: false,
        isPlatformAdmin: false,
        isCohortGovernor: false,
      });

      await roomGovernanceService.unbanParticipant('room-1', 'target-user', 'user-mod');

      expect(prisma.roomRestriction.deleteMany).toHaveBeenCalledWith({
        where: { studyRoomId: 'room-1', userId: 'target-user' },
      });
      expect(prisma.roomAuditLog.create).toHaveBeenCalled();
    });
  });

  describe('ownership transfer lifecycle', () => {
    it('proposes transfer when actor is durable owner and revision matches', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        ownerId: 'user-owner',
        revision: 2,
        cohortId: null,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-recipient',
        name: 'Recipient User',
      } as any);

      vi.mocked(prisma.roomOwnershipTransfer.create).mockResolvedValue({
        id: 'transfer-1',
        studyRoomId: 'room-1',
        senderId: 'user-owner',
        recipientId: 'user-recipient',
        status: 'PENDING',
        expectedRevision: 2,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
      } as any);

      const transfer = await roomGovernanceService.proposeOwnershipTransfer(
        'room-1',
        'user-recipient',
        2,
        'user-owner'
      );

      expect(transfer.id).toBe('transfer-1');
      expect(prisma.roomOwnershipTransfer.updateMany).toHaveBeenCalledWith({
        where: { studyRoomId: 'room-1', status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    });

    it('rejects proposing transfer if actor is not durable owner', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        ownerId: 'user-owner',
        revision: 2,
      } as any);

      await expect(
        roomGovernanceService.proposeOwnershipTransfer('room-1', 'user-recipient', 2, 'user-moderator')
      ).rejects.toThrow(RoomForbiddenError);
    });

    it('accepts ownership transfer, updates ownerId and increments revision', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        ownerId: 'user-owner',
        revision: 2,
        cohortId: null,
      } as any);

      vi.mocked(prisma.roomOwnershipTransfer.findUnique).mockResolvedValue({
        id: 'transfer-1',
        studyRoomId: 'room-1',
        senderId: 'user-owner',
        recipientId: 'user-recipient',
        status: 'PENDING',
        expectedRevision: 2,
        expiresAt: new Date(Date.now() + 60000),
      } as any);

      await roomGovernanceService.acceptOwnershipTransfer('room-1', 'transfer-1', 'user-recipient');

      expect(prisma.studyRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: {
          ownerId: 'user-recipient',
          revision: { increment: 1 },
        },
      });
      expect(prisma.roomOwnershipTransfer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'transfer-1' },
          data: expect.objectContaining({ status: 'ACCEPTED' }),
        })
      );
      expect(prisma.roomAuditLog.create).toHaveBeenCalled();
    });

    it('rejects accepting expired ownership transfer', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        ownerId: 'user-owner',
        revision: 2,
      } as any);

      vi.mocked(prisma.roomOwnershipTransfer.findUnique).mockResolvedValue({
        id: 'transfer-1',
        studyRoomId: 'room-1',
        senderId: 'user-owner',
        recipientId: 'user-recipient',
        status: 'PENDING',
        expectedRevision: 2,
        expiresAt: new Date(Date.now() - 1000), // Expired
      } as any);

      await expect(
        roomGovernanceService.acceptOwnershipTransfer('room-1', 'transfer-1', 'user-recipient')
      ).rejects.toThrow(RoomConflictError);
    });

    it('cancels pending transfer if called by sender, recipient, or owner', async () => {
      vi.mocked(prisma.roomOwnershipTransfer.findUnique).mockResolvedValue({
        id: 'transfer-1',
        studyRoomId: 'room-1',
        senderId: 'user-owner',
        recipientId: 'user-recipient',
        status: 'PENDING',
        room: { ownerId: 'user-owner' },
      } as any);

      await roomGovernanceService.cancelOwnershipTransfer('room-1', 'transfer-1', 'user-recipient');

      expect(prisma.roomOwnershipTransfer.update).toHaveBeenCalledWith({
        where: { id: 'transfer-1' },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.roomAuditLog.create).toHaveBeenCalled();
    });
  });

  describe('getAuditLogs', () => {
    it('returns paginated audit logs for room owner or moderator', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        ownerId: 'user-owner',
      } as any);

      vi.mocked(studyroomPolicy.resolveUserRoomRole).mockResolvedValue({
        role: 'OWNER',
        isOwner: true,
        isPlatformAdmin: false,
        isCohortGovernor: false,
      });

      vi.mocked(prisma.roomAuditLog.findMany).mockResolvedValue([
        {
          id: 'log-1',
          action: 'SETTINGS_UPDATED',
          actorId: 'user-owner',
          targetUserId: null,
          clientRequestId: null,
          details: { name: 'Updated' },
          createdAt: new Date(),
          actor: { id: 'user-owner', name: 'Owner', username: 'owner' },
          targetUser: null,
        },
      ] as any);

      const logs = await roomGovernanceService.getAuditLogs('room-1', 'user-owner');

      expect(logs.entries).toHaveLength(1);
      expect(logs.entries[0].action).toBe('SETTINGS_UPDATED');
      expect(logs.nextCursor).toBeNull();
    });
  });
});
