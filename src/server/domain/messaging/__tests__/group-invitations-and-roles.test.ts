import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { conversationService } from '../conversation.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    userBlock: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    conversationParticipant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    conversationInvitation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    channel: {
      create: vi.fn(),
    },
    realtimeStream: {
      create: vi.fn(),
    },
    messageReport: {
      create: vi.fn(),
    },
    $transaction: vi.fn((arg) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg(prisma);
    }),
  },
}));

describe('group invitations and role management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createGroupInvitation', () => {
    it('creates group invitation when caller is active member and no blocks exist', async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValueOnce({
        id: 'group-1',
        kind: 'GROUP',
        participants: [{ userId: 'inviter-1', role: 'MEMBER' }],
      } as any);

      vi.mocked(prisma.userBlock.findFirst).mockResolvedValueOnce(null);

      vi.mocked(prisma.conversationInvitation.upsert).mockResolvedValueOnce({
        id: 'inv-1',
        conversationId: 'group-1',
        inviterId: 'inviter-1',
        inviteeId: 'invitee-1',
        status: 'PENDING',
      } as any);

      const inv = await conversationService.createGroupInvitation(
        'inviter-1',
        'group-1',
        'invitee-1'
      );

      expect(inv.id).toBe('inv-1');
      expect(inv.status).toBe('PENDING');
      expect(prisma.conversationInvitation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            conversationId_inviteeId_status: {
              conversationId: 'group-1',
              inviteeId: 'invitee-1',
              status: 'PENDING',
            },
          },
        })
      );
    });

    it('rejects invitation if inviter and invitee have an active block', async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValueOnce({
        id: 'group-1',
        kind: 'GROUP',
        participants: [{ userId: 'inviter-1', role: 'OWNER' }],
      } as any);

      vi.mocked(prisma.userBlock.findFirst).mockResolvedValueOnce({
        blockerId: 'invitee-1',
        blockedId: 'inviter-1',
      } as any);

      await expect(
        conversationService.createGroupInvitation('inviter-1', 'group-1', 'invitee-1')
      ).rejects.toThrow('Cannot invite a blocked user');
    });

    it('rejects invitation if user is already an active member', async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValueOnce({
        id: 'group-1',
        kind: 'GROUP',
        participants: [
          { userId: 'inviter-1', role: 'OWNER' },
          { userId: 'invitee-1', role: 'MEMBER' },
        ],
      } as any);

      await expect(
        conversationService.createGroupInvitation('inviter-1', 'group-1', 'invitee-1')
      ).rejects.toThrow('User is already an active member');
    });
  });

  describe('acceptGroupInvitation', () => {
    it('accepts invitation, protects pre-join history by setting historyVisibleFromSequence, and increments accessGeneration', async () => {
      vi.mocked(prisma.conversationInvitation.findUnique).mockResolvedValueOnce({
        id: 'inv-1',
        conversationId: 'group-1',
        inviteeId: 'invitee-1',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
        conversation: {
          channel: { id: 'ch-1', messageCounter: 55 },
        },
      } as any);

      const result = await conversationService.acceptGroupInvitation('invitee-1', 'inv-1');
      expect(result.success).toBe(true);

      // Verifies invitation marked ACCEPTED
      expect(prisma.conversationInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: 'ACCEPTED' },
      });

      // Verifies participant added with historyVisibleFromSequence = 55 (pre-join privacy protected!)
      expect(prisma.conversationParticipant.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            userId: 'invitee-1',
            conversationId: 'group-1',
            role: 'MEMBER',
            historyVisibleFromSequence: 55,
          }),
        })
      );

      // Verifies accessGeneration incremented
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: { accessGeneration: { increment: 1 } },
      });
    });

    it('rejects accepting already accepted or expired invitation', async () => {
      vi.mocked(prisma.conversationInvitation.findUnique).mockResolvedValueOnce({
        id: 'inv-expired',
        inviteeId: 'invitee-1',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 10000), // Expired
      } as any);

      await expect(
        conversationService.acceptGroupInvitation('invitee-1', 'inv-expired')
      ).rejects.toThrow('Invitation has expired');
    });
  });

  describe('transferGroupOwnership', () => {
    it('transfers ownership from current owner to target member and demotes current owner to ADMIN', async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValueOnce({
        id: 'group-1',
        kind: 'GROUP',
        participants: [
          { userId: 'owner-1', role: 'OWNER', leftAt: null },
          { userId: 'member-2', role: 'MEMBER', leftAt: null },
        ],
      } as any);

      const result = await conversationService.transferGroupOwnership(
        'owner-1',
        'group-1',
        'member-2'
      );

      expect(result.success).toBe(true);
      expect(prisma.conversationParticipant.update).toHaveBeenCalledWith({
        where: { conversationId_userId: { conversationId: 'group-1', userId: 'owner-1' } },
        data: { role: 'ADMIN' },
      });
      expect(prisma.conversationParticipant.update).toHaveBeenCalledWith({
        where: { conversationId_userId: { conversationId: 'group-1', userId: 'member-2' } },
        data: { role: 'OWNER' },
      });
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: { creatorId: 'member-2' },
      });
    });

    it('rejects transfer if caller is not the owner', async () => {
      vi.mocked(prisma.conversation.findUnique).mockResolvedValueOnce({
        id: 'group-1',
        kind: 'GROUP',
        participants: [
          { userId: 'admin-1', role: 'ADMIN', leftAt: null },
          { userId: 'member-2', role: 'MEMBER', leftAt: null },
        ],
      } as any);

      await expect(
        conversationService.transferGroupOwnership('admin-1', 'group-1', 'member-2')
      ).rejects.toThrow('Only the current group owner can transfer ownership');
    });
  });

  describe('removeGroupMember', () => {
    it('removes member by owner/admin and increments accessGeneration', async () => {
      vi.mocked(prisma.conversationParticipant.findUnique)
        .mockResolvedValueOnce({
          conversationId: 'group-1',
          userId: 'owner-1',
          role: 'OWNER',
          leftAt: null,
        } as any) // caller check
        .mockResolvedValueOnce({
          conversationId: 'group-1',
          userId: 'bad-actor',
          role: 'MEMBER',
          leftAt: null,
        } as any); // target check

      const result = await conversationService.removeGroupMember('owner-1', 'group-1', 'bad-actor');
      expect(result.success).toBe(true);

      expect(prisma.conversationParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conversationId_userId: { conversationId: 'group-1', userId: 'bad-actor' } },
          data: expect.objectContaining({ leftAt: expect.any(Date) }),
        })
      );

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: { accessGeneration: { increment: 1 } },
      });
    });

    it('prevents an admin from removing another admin or owner', async () => {
      vi.mocked(prisma.conversationParticipant.findUnique)
        .mockResolvedValueOnce({
          conversationId: 'group-1',
          userId: 'admin-1',
          role: 'ADMIN',
          leftAt: null,
        } as any)
        .mockResolvedValueOnce({
          conversationId: 'group-1',
          userId: 'admin-2',
          role: 'ADMIN',
          leftAt: null,
        } as any);

      await expect(
        conversationService.removeGroupMember('admin-1', 'group-1', 'admin-2')
      ).rejects.toThrow('Admins cannot remove other admins');
    });
  });
});
