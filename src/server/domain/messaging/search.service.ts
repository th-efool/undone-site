import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { MessagingForbiddenError, MessagingNotFoundError } from './contracts';

export interface SearchMessageResult {
  id: string;
  channelId: string;
  channelName: string;
  content: string;
  messageSequence: number;
  author: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
  createdAt: string;
}

export interface SearchMessagesInput {
  userId: string;
  query: string;
  channelId?: string;
  limit?: number;
  cursor?: string;
}

export const searchService = {
  /**
   * Performs an authorized, history-boundary-respecting search across chat messages.
   * Prevents foreign channel leaks and suppresses pre-join group history.
   */
  async searchMessages(input: SearchMessagesInput): Promise<{
    messages: SearchMessageResult[];
    nextCursor: string | null;
  }> {
    const { userId, query, channelId, limit = 20, cursor } = input;
    const trimmed = query.trim();
    if (!trimmed) {
      return { messages: [], nextCursor: null };
    }

    const take = Math.min(50, Math.max(1, limit));

    // 1. Single-channel scoped search
    if (channelId) {
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        include: {
          community: {
            select: {
              cohortId: true,
              chatEnabled: true,
              cohort: { select: { creatorId: true } },
            },
          },
          conversation: {
            select: {
              id: true,
              participants: {
                where: { userId, leftAt: null },
                select: { historyVisibleFromSequence: true },
              },
            },
          },
          studyRoom: {
            select: { id: true },
          },
        },
      });

      if (!channel) {
        throw new MessagingNotFoundError('Channel not found');
      }

      let minSequence = 0;

      if (channel.community) {
        if (!channel.community.chatEnabled) {
          throw new MessagingForbiddenError('Community chat is disabled');
        }
        const isCreator = channel.community.cohort.creatorId === userId;
        if (!isCreator) {
          const membership = await prisma.cohortMember.findUnique({
            where: {
              cohortId_userId: {
                cohortId: channel.community.cohortId,
                userId,
              },
            },
          });
          if (!membership) {
            throw new MessagingForbiddenError('Not a member of this cohort');
          }
        }
      } else if (channel.conversation) {
        const participant = channel.conversation.participants[0];
        if (!participant) {
          throw new MessagingForbiddenError('Not an active participant in this conversation');
        }
        minSequence = participant.historyVisibleFromSequence;
      } else if (channel.studyRoom) {
        const participant = await prisma.roomParticipant.findFirst({
          where: { studyRoomId: channel.studyRoom.id, userId },
        });
        if (!participant) {
          throw new MessagingForbiddenError('Not an active participant in this study room');
        }
      } else {
        throw new MessagingForbiddenError('Channel does not have a valid parent context');
      }

      const rows = await prisma.message.findMany({
        where: {
          channelId,
          deletedAt: null,
          messageSequence: { gte: minSequence },
          content: { contains: trimmed, mode: 'insensitive' },
        },
        take: take + 1,
        ...(cursor && {
          skip: 1,
          cursor: { id: cursor },
        }),
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, name: true, username: true, image: true },
          },
          channel: {
            select: { name: true },
          },
        },
      });

      let nextCursor: string | null = null;
      if (rows.length > take) {
        const nextItem = rows.pop();
        nextCursor = nextItem ? nextItem.id : null;
      }

      return {
        messages: rows.map((r) => ({
          id: r.id,
          channelId: r.channelId,
          channelName: r.channel.name,
          content: r.content,
          messageSequence: r.messageSequence,
          author: r.author,
          createdAt: r.createdAt.toISOString(),
        })),
        nextCursor,
      };
    }

    // 2. Multi-channel search across all accessible channels
    // Collect all channel filters with their respective minSequence boundaries
    interface ChannelFilter {
      channelId: string;
      minSequence: number;
    }
    const authorizedFilters: ChannelFilter[] = [];

    // A. Communities: Cohorts where user is creator or member
    const [createdCohorts, cohortMemberships] = await Promise.all([
      prisma.cohort.findMany({
        where: { creatorId: userId },
        select: { community: { select: { channels: { select: { id: true } } } } },
      }),
      prisma.cohortMember.findMany({
        where: { userId },
        select: { cohort: { select: { community: { select: { channels: { select: { id: true } } } } } } },
      }),
    ]);

    for (const c of createdCohorts) {
      if (c.community?.channels) {
        for (const ch of c.community.channels) {
          authorizedFilters.push({ channelId: ch.id, minSequence: 0 });
        }
      }
    }
    for (const m of cohortMemberships) {
      if (m.cohort.community?.channels) {
        for (const ch of m.cohort.community.channels) {
          authorizedFilters.push({ channelId: ch.id, minSequence: 0 });
        }
      }
    }

    // B. Conversations (DMs and Groups)
    const activeParticipations = await prisma.conversationParticipant.findMany({
      where: { userId, leftAt: null },
      select: {
        historyVisibleFromSequence: true,
        conversation: { select: { channel: { select: { id: true } } } },
      },
    });

    for (const p of activeParticipations) {
      if (p.conversation.channel) {
        authorizedFilters.push({
          channelId: p.conversation.channel.id,
          minSequence: p.historyVisibleFromSequence,
        });
      }
    }

    // C. Current Study Room
    const currentStudyRoom = await prisma.roomParticipant.findFirst({
      where: { userId },
      select: { room: { select: { channel: { select: { id: true } } } } },
    });

    if (currentStudyRoom?.room?.channel) {
      authorizedFilters.push({
        channelId: currentStudyRoom.room.channel.id,
        minSequence: 0,
      });
    }

    if (authorizedFilters.length === 0) {
      return { messages: [], nextCursor: null };
    }

    // Build compound OR query for safe execution
    const orConditions = authorizedFilters.map((f) => ({
      channelId: f.channelId,
      messageSequence: { gte: f.minSequence },
    }));

    const rows = await prisma.message.findMany({
      where: {
        deletedAt: null,
        content: { contains: trimmed, mode: 'insensitive' },
        OR: orConditions,
      },
      take: take + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, name: true, username: true, image: true },
        },
        channel: {
          select: { name: true },
        },
      },
    });

    let nextCursor: string | null = null;
    if (rows.length > take) {
      const nextItem = rows.pop();
      nextCursor = nextItem ? nextItem.id : null;
    }

    return {
      messages: rows.map((r) => ({
        id: r.id,
        channelId: r.channelId,
        channelName: r.channel.name,
        content: r.content,
        messageSequence: r.messageSequence,
        author: r.author,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor,
    };
  },
};
