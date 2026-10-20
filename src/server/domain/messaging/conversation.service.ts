import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export interface DirectConversationResult {
  conversationId: string;
  channelId: string;
  kind: 'DIRECT';
  directKey: string;
  recipient: {
    id: string;
    name: string | null;
    image: string | null;
    username: string | null;
  };
  isExisting: boolean;
}

export interface GroupConversationResult {
  conversationId: string;
  channelId: string;
  kind: 'GROUP';
  title: string;
  creatorId: string;
  participantCount: number;
}

export interface ConversationSummaryDTO {
  id: string;
  kind: 'DIRECT' | 'GROUP';
  title: string;
  channelId: string;
  lastMessage?: {
    id: string;
    content: string;
    createdAt: string;
    authorName: string | null;
  };
  otherParticipant?: {
    id: string;
    name: string | null;
    image: string | null;
    username: string | null;
  };
  participantCount: number;
  accessGeneration: number;
  updatedAt: string;
}

export interface PersonSearchResult {
  id: string;
  name: string | null;
  image: string | null;
  username: string | null;
}

export function computeDirectKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(':');
}

export const conversationService = {
  async createDirectConversation(
    creatorId: string,
    recipientId: string
  ): Promise<DirectConversationResult> {
    if (!creatorId || !recipientId) {
      throw new Error('Both creator and recipient IDs are required');
    }

    if (creatorId === recipientId) {
      throw new Error('Cannot create a direct conversation with yourself');
    }

    // 1. Verify recipient exists
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, name: true, image: true, username: true },
    });

    if (!recipient) {
      throw new Error('Recipient user does not exist');
    }

    // 2. Check blocks
    const activeBlock = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: creatorId, blockedId: recipientId },
          { blockerId: recipientId, blockedId: creatorId },
        ],
      },
    });

    if (activeBlock) {
      throw new Error('Cannot create conversation with a blocked user');
    }

    const directKey = computeDirectKey(creatorId, recipientId);

    // 3. Atomically check or create conversation
    const existing = await prisma.conversation.findUnique({
      where: { directKey },
      include: {
        channel: { select: { id: true } },
      },
    });

    if (existing && existing.channel) {
      // Ensure neither participant is in left status
      await prisma.conversationParticipant.updateMany({
        where: {
          conversationId: existing.id,
          userId: { in: [creatorId, recipientId] },
          leftAt: { not: null },
        },
        data: { leftAt: null },
      });

      return {
        conversationId: existing.id,
        channelId: existing.channel.id,
        kind: 'DIRECT',
        directKey,
        recipient,
        isExisting: true,
      };
    }

    // 4. Create conversation, participants, channel, and stream in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({
        data: {
          kind: 'DIRECT',
          creatorId,
          directKey,
          accessGeneration: 1,
        },
      });

      await tx.conversationParticipant.createMany({
        data: [
          { conversationId: conv.id, userId: creatorId, role: 'MEMBER' },
          { conversationId: conv.id, userId: recipientId, role: 'MEMBER' },
        ],
      });

      const channel = await tx.channel.create({
        data: {
          name: 'direct',
          conversationId: conv.id,
        },
      });

      await tx.realtimeStream.create({
        data: {
          channelId: channel.id,
          generation: 1,
        },
      });

      return {
        conversationId: conv.id,
        channelId: channel.id,
        kind: 'DIRECT' as const,
        directKey,
        recipient,
        isExisting: false,
      };
    });

    return result;
  },

  async createGroupConversation(
    creatorId: string,
    title: string,
    participantIds: string[]
  ): Promise<GroupConversationResult> {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length > 100) {
      throw new Error('Group title must be between 1 and 100 characters');
    }

    const uniqueMemberIds = Array.from(new Set([creatorId, ...participantIds]));
    if (uniqueMemberIds.length < 2) {
      throw new Error('A group must have at least 2 members');
    }

    if (uniqueMemberIds.length > 100) {
      throw new Error('A group cannot exceed 100 members');
    }

    // Verify all participants exist
    const existingUsers = await prisma.user.findMany({
      where: { id: { in: uniqueMemberIds } },
      select: { id: true },
    });

    if (existingUsers.length !== uniqueMemberIds.length) {
      throw new Error('One or more selected participants do not exist');
    }

    return prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({
        data: {
          kind: 'GROUP',
          title: trimmedTitle,
          creatorId,
          accessGeneration: 1,
        },
      });

      await tx.conversationParticipant.createMany({
        data: uniqueMemberIds.map((uid) => ({
          conversationId: conv.id,
          userId: uid,
          role: uid === creatorId ? 'OWNER' : 'MEMBER',
        })),
      });

      const channel = await tx.channel.create({
        data: {
          name: trimmedTitle,
          conversationId: conv.id,
        },
      });

      await tx.realtimeStream.create({
        data: {
          channelId: channel.id,
          generation: 1,
        },
      });

      return {
        conversationId: conv.id,
        channelId: channel.id,
        kind: 'GROUP' as const,
        title: trimmedTitle,
        creatorId,
        participantCount: uniqueMemberIds.length,
      };
    });
  },

  async getUserConversations(userId: string): Promise<ConversationSummaryDTO[]> {
    const memberships = await prisma.conversationParticipant.findMany({
      where: {
        userId,
        leftAt: null,
      },
      include: {
        conversation: {
          include: {
            channel: {
              include: {
                messages: {
                  take: 1,
                  orderBy: { createdAt: 'desc' },
                  include: {
                    author: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
            participants: {
              where: { leftAt: null },
              include: {
                user: {
                  select: { id: true, name: true, image: true, username: true },
                },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const results: ConversationSummaryDTO[] = [];

    for (const m of memberships) {
      const conv = m.conversation;
      if (!conv.channel) continue;

      const latestMsg = conv.channel.messages[0];
      const otherParticipant =
        conv.kind === 'DIRECT'
          ? conv.participants.find((p) => p.userId !== userId)?.user
          : undefined;

      const title =
        conv.kind === 'DIRECT'
          ? (otherParticipant?.name || otherParticipant?.username || 'Direct Message')
          : (conv.title || 'Group Chat');

      results.push({
        id: conv.id,
        kind: conv.kind as 'DIRECT' | 'GROUP',
        title,
        channelId: conv.channel.id,
        lastMessage: latestMsg
          ? {
              id: latestMsg.id,
              content: latestMsg.content,
              createdAt: latestMsg.createdAt.toISOString(),
              authorName: latestMsg.author?.name || null,
            }
          : undefined,
        otherParticipant: otherParticipant
          ? {
              id: otherParticipant.id,
              name: otherParticipant.name,
              image: otherParticipant.image,
              username: otherParticipant.username,
            }
          : undefined,
        participantCount: conv.participants.length,
        accessGeneration: conv.accessGeneration,
        updatedAt: conv.updatedAt.toISOString(),
      });
    }

    return results;
  },

  async leaveGroup(conversationId: string, userId: string): Promise<{ success: boolean }> {
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      include: {
        conversation: {
          include: {
            participants: {
              where: { leftAt: null },
            },
          },
        },
      },
    });

    if (!participant || participant.leftAt !== null) {
      throw new Error('Not an active participant in this conversation');
    }

    if (participant.conversation.kind !== 'GROUP') {
      throw new Error('Cannot leave a direct message conversation');
    }

    const activeMembers = participant.conversation.participants;
    if (participant.role === 'OWNER') {
      const otherOwners = activeMembers.filter(
        (m) => m.userId !== userId && m.role === 'OWNER'
      );
      if (otherOwners.length === 0 && activeMembers.length > 1) {
        throw new Error(
          'Cannot leave group as the sole owner without transferring ownership first'
        );
      }
    }

    // Set leftAt and increment accessGeneration to revoke old socket tokens/subscriptions
    await prisma.$transaction([
      prisma.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        data: { leftAt: new Date() },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { accessGeneration: { increment: 1 } },
      }),
    ]);

    return { success: true };
  },

  async searchPeople(
    currentUserId: string,
    query: string,
    limit = 20
  ): Promise<PersonSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const take = Math.min(50, Math.max(1, limit));

    // Get IDs of users blocked by or blocking current user
    const blocks = await prisma.userBlock.findMany({
      where: {
        OR: [{ blockerId: currentUserId }, { blockedId: currentUserId }],
      },
      select: { blockerId: true, blockedId: true },
    });

    const excludedIds = new Set<string>([currentUserId]);
    for (const b of blocks) {
      excludedIds.add(b.blockerId);
      excludedIds.add(b.blockedId);
    }

    const users = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(excludedIds) },
        OR: [
          { name: { contains: trimmed, mode: 'insensitive' } },
          { username: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      take,
      select: {
        id: true,
        name: true,
        image: true,
        username: true,
      },
    });

    return users;
  },

  async blockUser(blockerId: string, blockedId: string): Promise<{ success: boolean }> {
    if (blockerId === blockedId) {
      throw new Error('Cannot block yourself');
    }

    await prisma.userBlock.upsert({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
      create: {
        blockerId,
        blockedId,
      },
      update: {},
    });

    return { success: true };
  },

  async unblockUser(blockerId: string, blockedId: string): Promise<{ success: boolean }> {
    await prisma.userBlock.deleteMany({
      where: {
        blockerId,
        blockedId,
      },
    });

    return { success: true };
  },

  async reportMessage(
    reporterId: string,
    messageId: string,
    reason: string
  ): Promise<{ id: string }> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error('Report reason is required');
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true },
    });

    if (!message) {
      throw new Error('Reported message does not exist');
    }

    const report = await prisma.messageReport.create({
      data: {
        reporterId,
        messageId,
        reason: trimmedReason,
        status: 'PENDING',
      },
    });

    return { id: report.id };
  },
};
