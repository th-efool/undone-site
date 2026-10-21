import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { moderationService } from '../moderation.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import {
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from '../contracts';

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    channel: {
      findUnique: vi.fn(),
    },
    message: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    cohortMember: {
      findUnique: vi.fn(),
    },
    messageModerationAudit: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

describe('moderationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setPinState', () => {
    it('pins a message and writes a moderation audit record when caller is moderator', async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({
        id: 'msg-1',
        channelId: 'ch-1',
        deletedAt: null,
      } as any);

      // Channel has cohort creator
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-1',
        community: {
          cohortId: 'cohort-1',
          cohort: { creatorId: 'mod-1' },
        },
      } as any);

      const now = new Date();
      vi.mocked(prisma.message.update).mockResolvedValueOnce({
        id: 'msg-1',
        channelId: 'ch-1',
        content: 'Important pin notice',
        messageSequence: 5,
        isPinned: true,
        pinnedAt: now,
        pinnedBy: { id: 'mod-1', name: 'Moderator', username: 'mod' },
        isAnnouncement: false,
        author: { id: 'u1', name: 'User', username: 'user', image: null },
        createdAt: now,
      } as any);

      const result = await moderationService.setPinState({
        userId: 'mod-1',
        messageId: 'msg-1',
        isPinned: true,
        reason: 'Key schedule update',
      });

      expect(result.isPinned).toBe(true);
      expect(prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'msg-1' },
          data: expect.objectContaining({
            isPinned: true,
            pinnedById: 'mod-1',
          }),
        })
      );
      expect(prisma.messageModerationAudit.create).toHaveBeenCalledWith({
        data: {
          channelId: 'ch-1',
          messageId: 'msg-1',
          moderatorId: 'mod-1',
          action: 'PIN',
          reason: 'Key schedule update',
        },
      });
    });

    it('rejects pinning when user lacks moderator authority', async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({
        id: 'msg-1',
        channelId: 'ch-1',
        deletedAt: null,
      } as any);

      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-1',
        community: {
          cohortId: 'cohort-1',
          cohort: { creatorId: 'mod-owner' },
        },
      } as any);

      // Caller is regular EXPLORER, not MODERATOR or CREATOR
      vi.mocked(prisma.cohortMember.findUnique).mockResolvedValueOnce({
        role: 'EXPLORER',
      } as any);

      await expect(
        moderationService.setPinState({
          userId: 'regular-user',
          messageId: 'msg-1',
          isPinned: true,
        })
      ).rejects.toThrow(MessagingForbiddenError);
    });

    it('rejects pinning a deleted message', async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({
        id: 'msg-deleted',
        channelId: 'ch-1',
        deletedAt: new Date(),
      } as any);

      await expect(
        moderationService.setPinState({
          userId: 'mod-1',
          messageId: 'msg-deleted',
          isPinned: true,
        })
      ).rejects.toThrow(MessagingValidationError);
    });
  });

  describe('setAnnouncementState', () => {
    it('sets announcement state with audit trail', async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({
        id: 'msg-2',
        channelId: 'ch-2',
        deletedAt: null,
      } as any);

      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-2',
        conversation: {
          id: 'conv-1',
          participants: [{ role: 'OWNER' }],
        },
      } as any);

      vi.mocked(prisma.message.update).mockResolvedValueOnce({
        id: 'msg-2',
        channelId: 'ch-2',
        content: 'Community Wide Announcement',
        messageSequence: 10,
        isPinned: false,
        pinnedAt: null,
        pinnedBy: null,
        isAnnouncement: true,
        author: { id: 'u1', name: 'User', username: 'user', image: null },
        createdAt: new Date(),
      } as any);

      const result = await moderationService.setAnnouncementState({
        userId: 'owner-1',
        messageId: 'msg-2',
        isAnnouncement: true,
        reason: 'Release 2.0 announcement',
      });

      expect(result.isAnnouncement).toBe(true);
      expect(prisma.messageModerationAudit.create).toHaveBeenCalledWith({
        data: {
          channelId: 'ch-2',
          messageId: 'msg-2',
          moderatorId: 'owner-1',
          action: 'SET_ANNOUNCEMENT',
          reason: 'Release 2.0 announcement',
        },
      });
    });
  });

  describe('getChannelPins', () => {
    it('returns all pinned messages in order of pinnedAt desc', async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({ id: 'ch-1' } as any);

      const pinDate = new Date();
      vi.mocked(prisma.message.findMany).mockResolvedValueOnce([
        {
          id: 'msg-pinned-1',
          channelId: 'ch-1',
          content: 'Pin #1',
          messageSequence: 3,
          isPinned: true,
          pinnedAt: pinDate,
          pinnedBy: { id: 'mod', name: 'Mod', username: 'mod' },
          isAnnouncement: false,
          author: { id: 'author', name: 'Author', username: 'author', image: null },
          createdAt: pinDate,
        },
      ] as any);

      const pins = await moderationService.getChannelPins('ch-1', 'user-1');
      expect(pins).toHaveLength(1);
      expect(pins[0].id).toBe('msg-pinned-1');
      expect(pins[0].isPinned).toBe(true);
    });
  });
});
