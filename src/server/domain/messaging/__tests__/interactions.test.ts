import { describe, expect, it, vi, beforeEach } from 'vitest';
import { interactionService } from '../interaction.service';
import { presenceService } from '../presence.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { centrifugoTransport } from '@/src/server/infrastructure/realtime/centrifugo-transport';
import {
  MessagingConflictError,
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from '../contracts';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/infrastructure/realtime/centrifugo-transport', () => ({
  centrifugoTransport: {
    publish: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
  const mockUser = {
    findUnique: vi.fn(),
  };
  const mockCohortMember = {
    findUnique: vi.fn(),
  };
  const mockChannel = {
    findUnique: vi.fn(),
  };
  const mockChannelUserState = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  };
  const mockMessage = {
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  };
  const mockMessageReaction = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
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

  const mockTransaction = vi.fn(async (callback) => {
    if (typeof callback === 'function') {
      return callback({
        message: mockMessage,
        messageReaction: mockMessageReaction,
        realtimeStream: mockRealtimeStream,
        realtimeEvent: mockRealtimeEvent,
        realtimeDelivery: mockRealtimeDelivery,
      });
    }
    return Promise.all(callback);
  });

  return {
    prisma: {
      user: mockUser,
      cohortMember: mockCohortMember,
      channel: mockChannel,
      channelUserState: mockChannelUserState,
      message: mockMessage,
      messageReaction: mockMessageReaction,
      realtimeStream: mockRealtimeStream,
      realtimeEvent: mockRealtimeEvent,
      realtimeDelivery: mockRealtimeDelivery,
      $transaction: mockTransaction,
    },
  };
});

describe('Phase 7: Messaging Interactions Domain Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    presenceService.clearThrottleForTests();
  });

  describe('Channel Access Authorization', () => {
    it('authorizes community channel for enrolled cohort member', async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-1',
        community: {
          cohortId: 'cohort-1',
          chatEnabled: true,
          cohort: { creatorId: 'creator-99' },
        },
        conversation: null,
        studyRoom: null,
      } as any);

      vi.mocked(prisma.cohortMember.findUnique).mockResolvedValueOnce({
        id: 'cm-1',
        cohortId: 'cohort-1',
        userId: 'user-1',
      } as any);

      const channel = await interactionService.authorizeChannelAccess('user-1', 'ch-1');
      expect(channel.id).toBe('ch-1');
    });

    it('rejects user when community chat is disabled', async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-disabled',
        community: {
          cohortId: 'cohort-1',
          chatEnabled: false,
          cohort: { creatorId: 'creator-99' },
        },
        conversation: null,
        studyRoom: null,
      } as any);

      await expect(
        interactionService.authorizeChannelAccess('user-1', 'ch-disabled')
      ).rejects.toThrow(MessagingForbiddenError);
    });

    it('rejects user not enrolled in cohort', async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-1',
        community: {
          cohortId: 'cohort-1',
          chatEnabled: true,
          cohort: { creatorId: 'creator-99' },
        },
        conversation: null,
        studyRoom: null,
      } as any);

      vi.mocked(prisma.cohortMember.findUnique).mockResolvedValueOnce(null);

      await expect(
        interactionService.authorizeChannelAccess('user-outsider', 'ch-1')
      ).rejects.toThrow(MessagingForbiddenError);
    });

    it('authorizes participant in direct or group conversation', async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-dm-1',
        community: null,
        conversation: {
          id: 'conv-1',
          kind: 'DIRECT',
          accessGeneration: 1,
          participants: [{ userId: 'user-1', role: 'MEMBER' }],
        },
        studyRoom: null,
      } as any);

      const channel = await interactionService.authorizeChannelAccess('user-1', 'ch-dm-1');
      expect(channel.id).toBe('ch-dm-1');
    });

    it('rejects non-participant from private conversation', async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-dm-1',
        community: null,
        conversation: {
          id: 'conv-1',
          kind: 'DIRECT',
          accessGeneration: 1,
          participants: [{ userId: 'user-1', role: 'MEMBER' }],
        },
        studyRoom: null,
      } as any);

      await expect(
        interactionService.authorizeChannelAccess('user-stranger', 'ch-dm-1')
      ).rejects.toThrow(MessagingForbiddenError);
    });
  });

  describe('Read Watermark & Unread Count', () => {
    it('monotonically advances watermark bounded by channel counter', async () => {
      // Mock authorization
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-1',
        messageCounter: 50,
        community: {
          cohortId: 'cohort-1',
          chatEnabled: true,
          cohort: { creatorId: 'user-1' },
        },
      } as any);

      // Existing watermark is 10
      vi.mocked(prisma.channelUserState.findUnique).mockResolvedValueOnce({
        lastReadSequence: 10,
      } as any);

      // Upsert returns advanced sequence 25
      vi.mocked(prisma.channelUserState.upsert).mockResolvedValueOnce({
        channelId: 'ch-1',
        userId: 'user-1',
        lastReadSequence: 25,
      } as any);

      // Remaining unread messages = 2
      vi.mocked(prisma.message.count).mockResolvedValueOnce(2);

      const result = await interactionService.updateReadWatermark({
        userId: 'user-1',
        channelId: 'ch-1',
        sequence: 25,
      });

      expect(result.lastReadSequence).toBe(25);
      expect(result.unreadCount).toBe(2);
      expect(prisma.channelUserState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ lastReadSequence: 25 }),
        })
      );
    });

    it('prevents watermark regression when smaller sequence is submitted', async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-1',
        messageCounter: 50,
        community: {
          cohortId: 'cohort-1',
          chatEnabled: true,
          cohort: { creatorId: 'user-1' },
        },
      } as any);

      // Existing watermark is already at 30
      vi.mocked(prisma.channelUserState.findUnique).mockResolvedValueOnce({
        lastReadSequence: 30,
      } as any);

      vi.mocked(prisma.channelUserState.upsert).mockResolvedValueOnce({
        channelId: 'ch-1',
        userId: 'user-1',
        lastReadSequence: 30,
      } as any);

      vi.mocked(prisma.message.count).mockResolvedValueOnce(0);

      // Attempt to regress watermark to 15
      const result = await interactionService.updateReadWatermark({
        userId: 'user-1',
        channelId: 'ch-1',
        sequence: 15,
      });

      // Target was clamped to Math.max(30, 15) = 30
      expect(prisma.channelUserState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ lastReadSequence: 30 }),
        })
      );
    });

    it('clamps watermark to channel messageCounter if client passes future sequence', async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-1',
        messageCounter: 20, // Only 20 messages exist
        community: {
          cohortId: 'cohort-1',
          chatEnabled: true,
          cohort: { creatorId: 'user-1' },
        },
      } as any);

      vi.mocked(prisma.channelUserState.findUnique).mockResolvedValueOnce({
        lastReadSequence: 5,
      } as any);

      vi.mocked(prisma.channelUserState.upsert).mockResolvedValueOnce({
        channelId: 'ch-1',
        userId: 'user-1',
        lastReadSequence: 20,
      } as any);

      vi.mocked(prisma.message.count).mockResolvedValueOnce(0);

      // Attempt to advance to 999
      await interactionService.updateReadWatermark({
        userId: 'user-1',
        channelId: 'ch-1',
        sequence: 999,
      });

      // Clamped to 20
      expect(prisma.channelUserState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ lastReadSequence: 20 }),
        })
      );
    });
  });

  describe('Channel Preferences (Pin & Mute)', () => {
    it('persists isPinned and mutedUntil preferences', async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-1',
        community: {
          cohortId: 'cohort-1',
          chatEnabled: true,
          cohort: { creatorId: 'user-1' },
        },
      } as any);

      const muteTime = new Date(Date.now() + 3600000);
      vi.mocked(prisma.channelUserState.upsert).mockResolvedValueOnce({
        channelId: 'ch-1',
        userId: 'user-1',
        isPinned: true,
        mutedUntil: muteTime,
      } as any);

      const pref = await interactionService.updateChannelPreferences({
        userId: 'user-1',
        channelId: 'ch-1',
        isPinned: true,
        mutedUntil: muteTime.toISOString(),
      });

      expect(pref.isPinned).toBe(true);
      expect(pref.mutedUntil).toBe(muteTime.toISOString());
    });
  });

  describe('Reactions', () => {
    it('adds reaction, increments revision, and creates realtime outbox delivery', async () => {
      // Channel auth
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-1',
        community: {
          cohortId: 'cohort-1',
          chatEnabled: true,
          cohort: { creatorId: 'user-1' },
        },
      } as any);

      // Target message
      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({
        id: 'msg-1',
        channelId: 'ch-1',
        revision: 2,
        deletedAt: null,
        channel: { id: 'ch-1', communityId: 'comm-1' },
      } as any);

      // Transaction: reaction does not exist yet
      vi.mocked(prisma.messageReaction.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.messageReaction.create).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.message.update).mockResolvedValueOnce({ revision: 3 } as any);
      vi.mocked(prisma.messageReaction.findMany).mockResolvedValueOnce([
        { emoji: '🔥', userId: 'user-1' },
      ] as any);
      vi.mocked(prisma.realtimeStream.findUnique).mockResolvedValueOnce({
        id: 'stream-1',
        generation: 1,
        eventCounter: 4,
      } as any);
      vi.mocked(prisma.realtimeStream.update).mockResolvedValueOnce({
        id: 'stream-1',
        generation: 1,
        eventCounter: 5,
      } as any);
      vi.mocked(prisma.realtimeEvent.create).mockResolvedValueOnce({ id: 'evt-react' } as any);

      const result = await interactionService.toggleReaction({
        userId: 'user-1',
        messageId: 'msg-1',
        emoji: '🔥',
      });

      expect(result.added).toBe(true);
      expect(result.emoji).toBe('🔥');
      expect(result.revision).toBe(3);
      expect(result.reactions).toEqual([
        { emoji: '🔥', count: 1, reactedByMe: true },
      ]);
    });

    it('toggles off reaction if user already reacted with same emoji', async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-1',
        community: {
          cohortId: 'cohort-1',
          chatEnabled: true,
          cohort: { creatorId: 'user-1' },
        },
      } as any);

      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({
        id: 'msg-1',
        channelId: 'ch-1',
        revision: 3,
        deletedAt: null,
        channel: { id: 'ch-1', communityId: 'comm-1' },
      } as any);

      // Reaction already exists
      vi.mocked(prisma.messageReaction.findUnique).mockResolvedValueOnce({
        id: 'mr-1',
        messageId: 'msg-1',
        userId: 'user-1',
        emoji: '🔥',
      } as any);

      vi.mocked(prisma.messageReaction.delete).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.message.update).mockResolvedValueOnce({ revision: 4 } as any);
      vi.mocked(prisma.messageReaction.findMany).mockResolvedValueOnce([]); // No remaining reactions
      vi.mocked(prisma.realtimeStream.findUnique).mockResolvedValueOnce({
        id: 'stream-1',
        generation: 1,
        eventCounter: 5,
      } as any);
      vi.mocked(prisma.realtimeStream.update).mockResolvedValueOnce({
        id: 'stream-1',
        generation: 1,
        eventCounter: 6,
      } as any);
      vi.mocked(prisma.realtimeEvent.create).mockResolvedValueOnce({ id: 'evt-react-del' } as any);

      const result = await interactionService.toggleReaction({
        userId: 'user-1',
        messageId: 'msg-1',
        emoji: '🔥',
      });

      expect(result.added).toBe(false);
      expect(result.reactions).toEqual([]);
    });

    it('rejects reaction on deleted message', async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-1',
        community: {
          cohortId: 'cohort-1',
          chatEnabled: true,
          cohort: { creatorId: 'user-1' },
        },
      } as any);

      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({
        id: 'msg-deleted',
        channelId: 'ch-1',
        deletedAt: new Date(),
      } as any);

      await expect(
        interactionService.toggleReaction({
          userId: 'user-1',
          messageId: 'msg-deleted',
          emoji: '👍',
        })
      ).rejects.toThrow(MessagingForbiddenError);
    });
  });

  describe('Message Edit & Concurrency Conflict', () => {
    it('allows author to edit within 15 minutes', async () => {
      const recent = new Date(Date.now() - 5 * 60 * 1000); // 5 mins old
      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({
        id: 'msg-edit',
        authorId: 'author-1',
        channelId: 'ch-1',
        content: 'Original text',
        createdAt: recent,
        revision: 1,
        deletedAt: null,
        author: { id: 'author-1', name: 'Author' },
        channel: { id: 'ch-1', communityId: 'comm-1' },
      } as any);

      vi.mocked(prisma.message.update).mockResolvedValueOnce({
        id: 'msg-edit',
        authorId: 'author-1',
        channelId: 'ch-1',
        content: 'Updated text',
        createdAt: recent,
        editedAt: new Date(),
        updatedAt: new Date(),
        revision: 2,
        messageSequence: 12,
        author: { id: 'author-1', name: 'Author' },
      } as any);

      vi.mocked(prisma.realtimeStream.findUnique).mockResolvedValueOnce({
        id: 'stream-1',
        generation: 1,
        eventCounter: 10,
      } as any);
      vi.mocked(prisma.realtimeStream.update).mockResolvedValueOnce({
        id: 'stream-1',
        generation: 1,
        eventCounter: 11,
      } as any);
      vi.mocked(prisma.realtimeEvent.create).mockResolvedValueOnce({ id: 'evt-edit' } as any);

      const edited = await interactionService.editMessage({
        messageId: 'msg-edit',
        userId: 'author-1',
        content: 'Updated text',
        expectedRevision: 1,
      });

      expect(edited.content).toBe('Updated text');
      expect(edited.revision).toBe(2);
      expect(edited.editedAt).not.toBeNull();
    });

    it('throws MessagingConflictError when revision conflicts', async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({
        id: 'msg-conflict',
        authorId: 'author-1',
        channelId: 'ch-1',
        content: 'Original text',
        createdAt: new Date(),
        revision: 3, // Database has revision 3
        deletedAt: null,
      } as any);

      // Client passed expectedRevision 2 (stale read)
      await expect(
        interactionService.editMessage({
          messageId: 'msg-conflict',
          userId: 'author-1',
          content: 'Conflicting edit',
          expectedRevision: 2,
        })
      ).rejects.toThrow(MessagingConflictError);
    });

    it('throws MessagingForbiddenError when 15-minute edit window expired', async () => {
      const oldTime = new Date(Date.now() - 16 * 60 * 1000); // 16 mins old
      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({
        id: 'msg-old',
        authorId: 'author-1',
        channelId: 'ch-1',
        content: 'Ancient text',
        createdAt: oldTime,
        revision: 1,
        deletedAt: null,
      } as any);

      await expect(
        interactionService.editMessage({
          messageId: 'msg-old',
          userId: 'author-1',
          content: 'Late edit',
        })
      ).rejects.toThrow(MessagingForbiddenError);
    });

    it('throws MessagingForbiddenError when non-author attempts edit', async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({
        id: 'msg-someone-else',
        authorId: 'author-1',
        channelId: 'ch-1',
        content: 'Text',
        createdAt: new Date(),
        revision: 1,
        deletedAt: null,
      } as any);

      await expect(
        interactionService.editMessage({
          messageId: 'msg-someone-else',
          userId: 'hacker-99',
          content: 'Defacing text',
        })
      ).rejects.toThrow(MessagingForbiddenError);
    });
  });

  describe('Message Tombstone Deletion', () => {
    it('author can soft-delete message and preserves sequence', async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({
        id: 'msg-delete',
        authorId: 'author-1',
        channelId: 'ch-1',
        messageSequence: 42,
        revision: 1,
        deletedAt: null,
        author: { id: 'author-1', name: 'Author' },
        channel: { id: 'ch-1', communityId: 'comm-1' },
      } as any);

      const deletedTimestamp = new Date();
      vi.mocked(prisma.message.update).mockResolvedValueOnce({
        id: 'msg-delete',
        authorId: 'author-1',
        channelId: 'ch-1',
        messageSequence: 42,
        content: '[This message was deleted]',
        deletedAt: deletedTimestamp,
        deletionReason: 'Typo mistake',
        revision: 2,
        createdAt: new Date(),
        updatedAt: deletedTimestamp,
        author: { id: 'author-1', name: 'Author' },
      } as any);

      vi.mocked(prisma.realtimeStream.findUnique).mockResolvedValueOnce({
        id: 'stream-1',
        generation: 1,
        eventCounter: 20,
      } as any);
      vi.mocked(prisma.realtimeStream.update).mockResolvedValueOnce({
        id: 'stream-1',
        generation: 1,
        eventCounter: 21,
      } as any);
      vi.mocked(prisma.realtimeEvent.create).mockResolvedValueOnce({ id: 'evt-del' } as any);

      const tombstone = await interactionService.deleteMessage({
        messageId: 'msg-delete',
        userId: 'author-1',
        reason: 'Typo mistake',
      });

      expect(tombstone.content).toBe('[This message was deleted]');
      expect(tombstone.deletedAt).toBe(deletedTimestamp.toISOString());
      expect(tombstone.messageSequence).toBe(42);
      expect(tombstone.revision).toBe(2);
    });

    it('rejects delete on already deleted message', async () => {
      vi.mocked(prisma.message.findUnique).mockResolvedValueOnce({
        id: 'msg-already-dead',
        authorId: 'author-1',
        deletedAt: new Date(),
      } as any);

      await expect(
        interactionService.deleteMessage({
          messageId: 'msg-already-dead',
          userId: 'author-1',
        })
      ).rejects.toThrow(MessagingValidationError);
    });
  });

  describe('Presence & Ephemeral Typing Signals', () => {
    it('publishes typing signal directly to Centrifugo and throttles rapid duplicates', async () => {
      // Channel authorization mock
      vi.mocked(prisma.channel.findUnique).mockResolvedValue({
        id: 'ch-typing',
        communityId: 'cohort-1',
        community: {
          cohortId: 'cohort-1',
          chatEnabled: true,
          cohort: { creatorId: 'user-1' },
        },
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        name: 'Alice Cooper',
        username: 'alice',
      } as any);

      // 1st signal: succeeds and publishes
      const first = await presenceService.handleTypingSignal('user-1', 'ch-typing', true);
      expect(first.success).toBe(true);
      expect(first.throttled).toBe(false);
      expect(centrifugoTransport.publish).toHaveBeenCalledWith(
        'community:ch-typing:g1',
        expect.objectContaining({
          type: 'typing.signal',
          payload: expect.objectContaining({
            channelId: 'ch-typing',
            userId: 'user-1',
            userName: 'Alice Cooper',
            isTyping: true,
          }),
        })
      );

      // 2nd signal within 2s throttle window: throttled without publishing again
      const second = await presenceService.handleTypingSignal('user-1', 'ch-typing', true);
      expect(second.success).toBe(true);
      expect(second.throttled).toBe(true);
      expect(centrifugoTransport.publish).toHaveBeenCalledTimes(1);
    });
  });
});
