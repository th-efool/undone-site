import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { searchService } from '../search.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { MessagingForbiddenError, MessagingNotFoundError } from '../contracts';

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    channel: {
      findUnique: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
    },
    cohort: {
      findMany: vi.fn(),
    },
    cohortMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    conversationParticipant: {
      findMany: vi.fn(),
    },
    roomParticipant: {
      findFirst: vi.fn(),
    },
  },
}));

describe('searchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchMessages in single channel', () => {
    it('returns empty array for empty or whitespace query', async () => {
      const res = await searchService.searchMessages({
        userId: 'user-1',
        query: '   ',
      });
      expect(res.messages).toEqual([]);
      expect(res.nextCursor).toBeNull();
      expect(prisma.message.findMany).not.toHaveBeenCalled();
    });

    it('searches messages within authorized community channel', async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-comm',
        name: 'general',
        community: {
          cohortId: 'cohort-1',
          chatEnabled: true,
          cohort: { creatorId: 'user-creator' },
        },
      } as any);

      vi.mocked(prisma.cohortMember.findUnique).mockResolvedValueOnce({
        cohortId: 'cohort-1',
        userId: 'user-1',
        role: 'EXPLORER',
      } as any);

      const msgDate = new Date();
      vi.mocked(prisma.message.findMany).mockResolvedValueOnce([
        {
          id: 'msg-1',
          channelId: 'ch-comm',
          content: 'Hello world! Need help with calculus.',
          messageSequence: 10,
          createdAt: msgDate,
          author: { id: 'u2', name: 'Bob', username: 'bob', image: null },
          channel: { name: 'general' },
        },
      ] as any);

      const res = await searchService.searchMessages({
        userId: 'user-1',
        query: 'calculus',
        channelId: 'ch-comm',
      });

      expect(res.messages).toHaveLength(1);
      expect(res.messages[0].content).toContain('calculus');
      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            channelId: 'ch-comm',
            deletedAt: null,
            content: { contains: 'calculus', mode: 'insensitive' },
          }),
        })
      );
    });

    it('rejects search when user is not a member of the cohort community', async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-comm',
        community: {
          cohortId: 'cohort-1',
          chatEnabled: true,
          cohort: { creatorId: 'other-user' },
        },
      } as any);

      vi.mocked(prisma.cohortMember.findUnique).mockResolvedValueOnce(null);

      await expect(
        searchService.searchMessages({
          userId: 'unauthorized-user',
          query: 'secret plans',
          channelId: 'ch-comm',
        })
      ).rejects.toThrow(MessagingForbiddenError);
    });

    it('enforces historyVisibleFromSequence boundary in group conversation search', async () => {
      vi.mocked(prisma.channel.findUnique).mockResolvedValueOnce({
        id: 'ch-group',
        conversation: {
          id: 'conv-group',
          participants: [
            {
              historyVisibleFromSequence: 42, // Joined at message sequence 42
            },
          ],
        },
      } as any);

      vi.mocked(prisma.message.findMany).mockResolvedValueOnce([]);

      await searchService.searchMessages({
        userId: 'late-joiner',
        query: 'launch date',
        channelId: 'ch-group',
      });

      // Crucial verification: search queries ONLY sequence >= 42
      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            channelId: 'ch-group',
            messageSequence: { gte: 42 },
            deletedAt: null,
          }),
        })
      );
    });
  });

  describe('multi-channel search across authorized scopes', () => {
    it('aggregates search only across authorized cohorts and conversations', async () => {
      // 1 created cohort with channel ch-1
      vi.mocked(prisma.cohort.findMany).mockResolvedValueOnce([
        { community: { channels: [{ id: 'ch-1' }] } },
      ] as any);
      // 0 joined cohorts
      vi.mocked(prisma.cohortMember.findMany).mockResolvedValueOnce([]);

      // 1 active group conversation channel ch-2 with historyVisibleFromSequence = 5
      vi.mocked(prisma.conversationParticipant.findMany).mockResolvedValueOnce([
        {
          historyVisibleFromSequence: 5,
          conversation: { channel: { id: 'ch-2' } },
        },
      ] as any);

      // No active study room
      vi.mocked(prisma.roomParticipant.findFirst).mockResolvedValueOnce(null);

      vi.mocked(prisma.message.findMany).mockResolvedValueOnce([
        {
          id: 'msg-hit',
          channelId: 'ch-1',
          content: 'Found topic keyword',
          messageSequence: 1,
          createdAt: new Date(),
          author: { id: 'u1', name: 'Alice', username: 'alice', image: null },
          channel: { name: 'announcements' },
        },
      ] as any);

      const res = await searchService.searchMessages({
        userId: 'user-1',
        query: 'topic',
      });

      expect(res.messages).toHaveLength(1);
      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            content: { contains: 'topic', mode: 'insensitive' },
            OR: [
              { channelId: 'ch-1', messageSequence: { gte: 0 } },
              { channelId: 'ch-2', messageSequence: { gte: 5 } },
            ],
          }),
        })
      );
    });

    it('returns empty results immediately if user has zero accessible channels', async () => {
      vi.mocked(prisma.cohort.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.cohortMember.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.conversationParticipant.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.roomParticipant.findFirst).mockResolvedValueOnce(null);

      const res = await searchService.searchMessages({
        userId: 'brand-new-user',
        query: 'anything',
      });

      expect(res.messages).toEqual([]);
      expect(prisma.message.findMany).not.toHaveBeenCalled();
    });
  });
});
