import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  computeDirectKey,
  conversationService,
} from '../conversation.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
  const mockUser = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  };
  const mockUserBlock = {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  };
  const mockConversation = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const mockConversationParticipant = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  };
  const mockChannel = {
    create: vi.fn(),
  };
  const mockRealtimeStream = {
    create: vi.fn(),
  };
  const mockMessage = {
    findUnique: vi.fn(),
  };
  const mockMessageReport = {
    create: vi.fn(),
  };

  const mockTransaction = vi.fn(async (callback) => {
    if (typeof callback === 'function') {
      return callback({
        conversation: mockConversation,
        conversationParticipant: mockConversationParticipant,
        channel: mockChannel,
        realtimeStream: mockRealtimeStream,
      });
    }
    return Promise.all(callback);
  });

  return {
    prisma: {
      user: mockUser,
      userBlock: mockUserBlock,
      conversation: mockConversation,
      conversationParticipant: mockConversationParticipant,
      channel: mockChannel,
      realtimeStream: mockRealtimeStream,
      message: mockMessage,
      messageReport: mockMessageReport,
      $transaction: mockTransaction,
    },
  };
});

describe('Phase 6 Conversation Lifecycle & Moderation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computeDirectKey', () => {
    it('produces canonical lexicographical sorted pair key', () => {
      expect(computeDirectKey('user-b', 'user-a')).toBe('user-a:user-b');
      expect(computeDirectKey('user-a', 'user-b')).toBe('user-a:user-b');
      expect(computeDirectKey('user-z', 'user-m')).toBe('user-m:user-z');
    });
  });

  describe('createDirectConversation', () => {
    it('rejects self-DM attempt', async () => {
      await expect(
        conversationService.createDirectConversation('user-1', 'user-1')
      ).rejects.toThrow('Cannot create a direct conversation with yourself');
    });

    it('rejects conversation when recipient does not exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      await expect(
        conversationService.createDirectConversation('user-1', 'user-2')
      ).rejects.toThrow('Recipient user does not exist');
    });

    it('rejects conversation when user is blocked', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-2',
        name: 'Bob',
        image: null,
        username: 'bob',
      } as any);

      vi.mocked(prisma.userBlock.findFirst).mockResolvedValueOnce({
        blockerId: 'user-2',
        blockedId: 'user-1',
        createdAt: new Date(),
      } as any);

      await expect(
        conversationService.createDirectConversation('user-1', 'user-2')
      ).rejects.toThrow('Cannot create conversation with a blocked user');
    });

    it('returns existing conversation idempotently without re-creating', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-2',
        name: 'Bob',
        image: null,
        username: 'bob',
      } as any);

      vi.mocked(prisma.userBlock.findFirst).mockResolvedValueOnce(null);

      vi.mocked(prisma.conversation.findUnique).mockResolvedValueOnce({
        id: 'conv-existing',
        directKey: 'user-1:user-2',
        channel: { id: 'chan-existing' },
      } as any);

      const result = await conversationService.createDirectConversation('user-1', 'user-2');

      expect(result.isExisting).toBe(true);
      expect(result.conversationId).toBe('conv-existing');
      expect(result.channelId).toBe('chan-existing');
      expect(prisma.conversationParticipant.updateMany).toHaveBeenCalledWith({
        where: {
          conversationId: 'conv-existing',
          userId: { in: ['user-1', 'user-2'] },
          leftAt: { not: null },
        },
        data: { leftAt: null },
      });
    });

    it('creates new conversation, participants, channel, and stream atomically', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-2',
        name: 'Bob',
        image: null,
        username: 'bob',
      } as any);

      vi.mocked(prisma.userBlock.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.conversation.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.conversation.create).mockResolvedValueOnce({
        id: 'conv-new',
        kind: 'DIRECT',
        creatorId: 'user-1',
        directKey: 'user-1:user-2',
        accessGeneration: 1,
      } as any);

      vi.mocked(prisma.channel.create).mockResolvedValueOnce({
        id: 'chan-new',
        name: 'direct',
        conversationId: 'conv-new',
      } as any);

      const result = await conversationService.createDirectConversation('user-1', 'user-2');

      expect(result.isExisting).toBe(false);
      expect(result.conversationId).toBe('conv-new');
      expect(result.channelId).toBe('chan-new');
      expect(result.kind).toBe('DIRECT');
      expect(result.directKey).toBe('user-1:user-2');
    });
  });

  describe('createGroupConversation', () => {
    it('rejects title shorter than 1 or longer than 100 characters', async () => {
      await expect(
        conversationService.createGroupConversation('user-1', '', ['user-2'])
      ).rejects.toThrow('Group title must be between 1 and 100 characters');

      await expect(
        conversationService.createGroupConversation('user-1', 'a'.repeat(101), ['user-2'])
      ).rejects.toThrow('Group title must be between 1 and 100 characters');
    });

    it('rejects groups with fewer than 2 distinct members', async () => {
      await expect(
        conversationService.createGroupConversation('user-1', 'Solo', ['user-1'])
      ).rejects.toThrow('A group must have at least 2 members');
    });

    it('rejects groups with more than 100 members', async () => {
      const overMembers = Array.from({ length: 101 }, (_, i) => `user-${i + 2}`);
      await expect(
        conversationService.createGroupConversation('user-1', 'Huge Group', overMembers)
      ).rejects.toThrow('A group cannot exceed 100 members');
    });

    it('creates group conversation with OWNER for creator and MEMBER for others', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { id: 'user-1' },
        { id: 'user-2' },
        { id: 'user-3' },
      ] as any);

      vi.mocked(prisma.conversation.create).mockResolvedValueOnce({
        id: 'group-conv-1',
        kind: 'GROUP',
        title: 'Study Squad',
        creatorId: 'user-1',
        accessGeneration: 1,
      } as any);

      vi.mocked(prisma.channel.create).mockResolvedValueOnce({
        id: 'group-chan-1',
        name: 'Study Squad',
        conversationId: 'group-conv-1',
      } as any);

      const result = await conversationService.createGroupConversation(
        'user-1',
        'Study Squad',
        ['user-2', 'user-3']
      );

      expect(result.kind).toBe('GROUP');
      expect(result.title).toBe('Study Squad');
      expect(result.participantCount).toBe(3);
      expect(prisma.conversationParticipant.createMany).toHaveBeenCalledWith({
        data: [
          { conversationId: 'group-conv-1', userId: 'user-1', role: 'OWNER' },
          { conversationId: 'group-conv-1', userId: 'user-2', role: 'MEMBER' },
          { conversationId: 'group-conv-1', userId: 'user-3', role: 'MEMBER' },
        ],
      });
    });
  });

  describe('leaveGroup', () => {
    it('rejects leaving a DIRECT conversation', async () => {
      vi.mocked(prisma.conversationParticipant.findUnique).mockResolvedValueOnce({
        conversationId: 'dm-1',
        userId: 'user-1',
        role: 'MEMBER',
        leftAt: null,
        conversation: {
          kind: 'DIRECT',
          participants: [],
        },
      } as any);

      await expect(
        conversationService.leaveGroup('dm-1', 'user-1')
      ).rejects.toThrow('Cannot leave a direct message conversation');
    });

    it('prevents sole owner from leaving without transferring ownership', async () => {
      vi.mocked(prisma.conversationParticipant.findUnique).mockResolvedValueOnce({
        conversationId: 'group-1',
        userId: 'user-1',
        role: 'OWNER',
        leftAt: null,
        conversation: {
          kind: 'GROUP',
          participants: [
            { userId: 'user-1', role: 'OWNER' },
            { userId: 'user-2', role: 'MEMBER' },
          ],
        },
      } as any);

      await expect(
        conversationService.leaveGroup('group-1', 'user-1')
      ).rejects.toThrow('Cannot leave group as the sole owner without transferring ownership first');
    });

    it('sets leftAt and increments accessGeneration on valid leave', async () => {
      vi.mocked(prisma.conversationParticipant.findUnique).mockResolvedValueOnce({
        conversationId: 'group-1',
        userId: 'user-2',
        role: 'MEMBER',
        leftAt: null,
        conversation: {
          kind: 'GROUP',
          participants: [
            { userId: 'user-1', role: 'OWNER' },
            { userId: 'user-2', role: 'MEMBER' },
          ],
        },
      } as any);

      const result = await conversationService.leaveGroup('group-1', 'user-2');

      expect(result.success).toBe(true);
      expect(prisma.conversationParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conversationId_userId: { conversationId: 'group-1', userId: 'user-2' } },
        })
      );
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: { accessGeneration: { increment: 1 } },
      });
    });
  });

  describe('searchPeople', () => {
    it('excludes caller and blocked users without returning email addresses', async () => {
      vi.mocked(prisma.userBlock.findMany).mockResolvedValueOnce([
        { blockerId: 'user-blocked', blockedId: 'user-me' },
      ] as any);

      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        { id: 'user-alice', name: 'Alice', image: null, username: 'alice' },
      ] as any);

      const results = await conversationService.searchPeople('user-me', 'ali', 10);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'user-alice',
        name: 'Alice',
        image: null,
        username: 'alice',
      });
      // Verify email was not requested in Prisma select
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            name: true,
            image: true,
            username: true,
          },
        })
      );
    });
  });

  describe('blockUser & unblockUser', () => {
    it('rejects self-block', async () => {
      await expect(
        conversationService.blockUser('user-1', 'user-1')
      ).rejects.toThrow('Cannot block yourself');
    });

    it('upserts block relationship', async () => {
      const res = await conversationService.blockUser('user-1', 'user-2');
      expect(res.success).toBe(true);
      expect(prisma.userBlock.upsert).toHaveBeenCalledWith({
        where: { blockerId_blockedId: { blockerId: 'user-1', blockedId: 'user-2' } },
        create: { blockerId: 'user-1', blockedId: 'user-2' },
        update: {},
      });
    });

    it('unblocks user cleanly', async () => {
      const res = await conversationService.unblockUser('user-1', 'user-2');
      expect(res.success).toBe(true);
      expect(prisma.userBlock.deleteMany).toHaveBeenCalledWith({
        where: { blockerId: 'user-1', blockedId: 'user-2' },
      });
    });
  });

  describe('reportMessage', () => {
    it('rejects empty reason', async () => {
      await expect(
        conversationService.reportMessage('user-1', 'msg-1', '   ')
      ).rejects.toThrow('Report reason is required');
    });

    it('rejects report when target message does not exist', async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce(null);

      await expect(
        conversationService.reportMessage('user-1', 'msg-1', 'Spam')
      ).rejects.toThrow('Reported message does not exist');
    });

    it('creates report record with PENDING status', async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({ id: 'msg-1' } as any);
      vi.mocked(prisma.messageReport.create).mockResolvedValueOnce({ id: 'rep-123' } as any);

      const res = await conversationService.reportMessage('user-1', 'msg-1', 'Harassment');
      expect(res.id).toBe('rep-123');
      expect(prisma.messageReport.create).toHaveBeenCalledWith({
        data: {
          reporterId: 'user-1',
          messageId: 'msg-1',
          reason: 'Harassment',
          status: 'PENDING',
        },
      });
    });
  });
});
