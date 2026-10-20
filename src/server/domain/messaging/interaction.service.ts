import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import {
  type CanonicalMessagePayload,
  type ReactionSummary,
  type UpdateReadWatermarkInput,
  type UpdateChannelPreferencesInput,
  type ToggleReactionInput,
  type EditMessageInput,
  type DeleteMessageInput,
  MessagingConflictError,
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
  buildDestinationChannel,
} from './contracts';

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_MESSAGE_CONTENT_LENGTH = 4000;

export interface ReadWatermarkResult {
  channelId: string;
  userId: string;
  lastReadSequence: number;
  unreadCount: number;
}

export interface ToggleReactionResult {
  messageId: string;
  channelId: string;
  emoji: string;
  added: boolean;
  reactions: ReactionSummary[];
  revision: number;
}

export const interactionService = {
  /**
   * Authorizes channel access for a user. Throws if unauthorized.
   */
  async authorizeChannelAccess(userId: string, channelId: string) {
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
            kind: true,
            accessGeneration: true,
            participants: {
              where: { leftAt: null },
              select: { userId: true, role: true },
            },
          },
        },
        studyRoom: {
          select: { id: true, status: true },
        },
      },
    });

    if (!channel) {
      throw new MessagingNotFoundError('Channel not found');
    }

    if (channel.community) {
      if (!channel.community.chatEnabled) {
        throw new MessagingForbiddenError('Community chat is disabled');
      }
      const isCreator = channel.community.cohort.creatorId === userId;
      if (!isCreator) {
        const member = await prisma.cohortMember.findUnique({
          where: {
            cohortId_userId: {
              cohortId: channel.community.cohortId,
              userId,
            },
          },
        });
        if (!member) {
          throw new MessagingForbiddenError('Not a member of this cohort');
        }
      }
    } else if (channel.conversation) {
      const isParticipant = channel.conversation.participants.some((p) => p.userId === userId);
      if (!isParticipant) {
        throw new MessagingForbiddenError('Not an active participant in this conversation');
      }
    } else if (channel.studyRoom) {
      const participant = await prisma.roomParticipant.findUnique({
        where: { userId },
      });
      if (!participant || participant.studyRoomId !== channel.studyRoom.id) {
        throw new MessagingForbiddenError('Not an active participant in this study room');
      }
    }

    return channel;
  },

  /**
   * Advances the read watermark monotonically (lastReadSequence never moves backward).
   */
  async updateReadWatermark(input: UpdateReadWatermarkInput): Promise<ReadWatermarkResult> {
    const { channelId, userId, sequence } = input;
    if (sequence < 0) {
      throw new MessagingValidationError('Sequence cannot be negative');
    }

    const channel = await this.authorizeChannelAccess(userId, channelId);

    // Enforce watermark cannot advance past the channel's actual messageCounter
    const safeSequence = Math.min(sequence, channel.messageCounter);

    const existingState = await prisma.channelUserState.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });

    const targetSequence = Math.max(existingState?.lastReadSequence ?? 0, safeSequence);

    await prisma.channelUserState.upsert({
      where: { channelId_userId: { channelId, userId } },
      create: {
        channelId,
        userId,
        lastReadSequence: targetSequence,
        lastDeliveredSequence: targetSequence,
      },
      update: {
        lastReadSequence: targetSequence,
        lastDeliveredSequence: Math.max(existingState?.lastDeliveredSequence ?? 0, targetSequence),
      },
    });

    const unreadCount = await this.calculateUnreadCount(userId, channelId, targetSequence);

    return {
      channelId,
      userId,
      lastReadSequence: targetSequence,
      unreadCount,
    };
  },

  /**
   * Updates user channel preferences (pin / mute).
   */
  async updateChannelPreferences(input: UpdateChannelPreferencesInput) {
    const { channelId, userId, isPinned, mutedUntil } = input;
    await this.authorizeChannelAccess(userId, channelId);

    const data: { isPinned?: boolean; mutedUntil?: Date | null } = {};
    if (typeof isPinned === 'boolean') data.isPinned = isPinned;
    if (mutedUntil !== undefined) {
      data.mutedUntil = mutedUntil ? new Date(mutedUntil) : null;
    }

    const updated = await prisma.channelUserState.upsert({
      where: { channelId_userId: { channelId, userId } },
      create: {
        channelId,
        userId,
        isPinned: data.isPinned ?? false,
        mutedUntil: data.mutedUntil ?? null,
      },
      update: data,
    });

    return {
      channelId: updated.channelId,
      userId: updated.userId,
      isPinned: updated.isPinned,
      mutedUntil: updated.mutedUntil ? updated.mutedUntil.toISOString() : null,
    };
  },

  /**
   * Toggles an emoji reaction idempotently on a message, emits reaction event to outbox.
   */
  async toggleReaction(input: ToggleReactionInput): Promise<ToggleReactionResult> {
    const { messageId, userId, emoji } = input;
    const trimmedEmoji = emoji.trim();
    if (!trimmedEmoji || trimmedEmoji.length > 16) {
      throw new MessagingValidationError('Invalid emoji');
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        channel: {
          select: {
            id: true,
            communityId: true,
            conversationId: true,
            studyRoomId: true,
            conversation: { select: { kind: true } },
          },
        },
      },
    });

    if (!message) {
      throw new MessagingNotFoundError('Message not found');
    }

    if (message.deletedAt) {
      throw new MessagingForbiddenError('Cannot react to a deleted message');
    }

    await this.authorizeChannelAccess(userId, message.channelId);

    const existingReaction = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji: trimmedEmoji,
        },
      },
    });

    const isAdding = !existingReaction;

    return prisma.$transaction(async (tx) => {
      if (isAdding) {
        await tx.messageReaction.create({
          data: {
            messageId,
            userId,
            emoji: trimmedEmoji,
          },
        });
      } else {
        await tx.messageReaction.delete({
          where: {
            messageId_userId_emoji: {
              messageId,
              userId,
              emoji: trimmedEmoji,
            },
          },
        });
      }

      // Bump message revision
      const updatedMessage = await tx.message.update({
        where: { id: messageId },
        data: { revision: { increment: 1 } },
        select: { revision: true },
      });

      // Aggregate all active reactions for this message
      const allReactions = await tx.messageReaction.findMany({
        where: { messageId },
        select: { emoji: true, userId: true },
      });

      const reactionCounts = new Map<string, { count: number; reactedByMe: boolean }>();
      for (const r of allReactions) {
        const item = reactionCounts.get(r.emoji) ?? { count: 0, reactedByMe: false };
        item.count += 1;
        if (r.userId === userId) item.reactedByMe = true;
        reactionCounts.set(r.emoji, item);
      }

      const reactionsSummary: ReactionSummary[] = Array.from(reactionCounts.entries()).map(
        ([em, details]) => ({
          emoji: em,
          count: details.count,
          reactedByMe: details.reactedByMe,
        })
      );

      // Append realtime stream event and outbox delivery
      let stream = await tx.realtimeStream.findUnique({
        where: { channelId: message.channelId },
      });

      if (!stream) {
        stream = await tx.realtimeStream.create({
          data: {
            channelId: message.channelId,
            generation: 1,
            eventCounter: 1,
          },
        });
      } else {
        stream = await tx.realtimeStream.update({
          where: { id: stream.id },
          data: { eventCounter: { increment: 1 } },
        });
      }

      const eventPayload = {
        messageId,
        channelId: message.channelId,
        actorId: userId,
        emoji: trimmedEmoji,
        added: isAdding,
        reactions: reactionsSummary,
        revision: updatedMessage.revision,
      };

      const event = await tx.realtimeEvent.create({
        data: {
          streamId: stream.id,
          sequence: stream.eventCounter,
          eventId: randomUUID(),
          schemaVersion: 1,
          type: 'message.reaction_updated',
          generation: stream.generation,
          entityId: messageId,
          entityRevision: updatedMessage.revision,
          payload: eventPayload,
        },
      });

      const destination = buildDestinationChannel({
        channelId: message.channelId,
        generation: stream.generation,
        communityId: message.channel.communityId,
        conversationId: message.channel.conversationId,
        conversationKind: message.channel.conversation?.kind,
        studyRoomId: message.channel.studyRoomId,
      });

      await tx.realtimeDelivery.create({
        data: {
          eventId: event.id,
          destination,
          status: 'PENDING',
          attempts: 0,
          dueAt: new Date(),
        },
      });

      return {
        messageId,
        channelId: message.channelId,
        emoji: trimmedEmoji,
        added: isAdding,
        reactions: reactionsSummary,
        revision: updatedMessage.revision,
      };
    });
  },

  /**
   * Edits message content within the 15-minute window with optimistic concurrency revision check.
   */
  async editMessage(input: EditMessageInput): Promise<CanonicalMessagePayload> {
    const { messageId, userId, content, expectedRevision } = input;
    const trimmed = content.trim();
    if (!trimmed) {
      throw new MessagingValidationError('Message content cannot be empty');
    }
    if (trimmed.length > MAX_MESSAGE_CONTENT_LENGTH) {
      throw new MessagingValidationError(`Message content exceeds maximum allowed length of ${MAX_MESSAGE_CONTENT_LENGTH} characters`);
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        author: { select: { id: true, name: true, image: true, username: true } },
        channel: {
          select: {
            id: true,
            communityId: true,
            conversationId: true,
            studyRoomId: true,
            conversation: { select: { kind: true } },
          },
        },
      },
    });

    if (!message) {
      throw new MessagingNotFoundError('Message not found');
    }

    if (message.deletedAt) {
      throw new MessagingForbiddenError('Cannot edit a deleted message');
    }

    if (message.authorId !== userId) {
      throw new MessagingForbiddenError('Only the author can edit this message');
    }

    const age = Date.now() - message.createdAt.getTime();
    if (age > EDIT_WINDOW_MS) {
      throw new MessagingForbiddenError('Edit window has expired (15 minutes limit)');
    }

    if (expectedRevision !== undefined && message.revision !== expectedRevision) {
      throw new MessagingConflictError('Message revision conflict: message has been modified');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.message.update({
        where: { id: messageId },
        data: {
          content: trimmed,
          editedAt: new Date(),
          revision: { increment: 1 },
        },
        include: {
          author: { select: { id: true, name: true, image: true, username: true } },
        },
      });

      let stream = await tx.realtimeStream.findUnique({
        where: { channelId: message.channelId },
      });

      if (!stream) {
        stream = await tx.realtimeStream.create({
          data: {
            channelId: message.channelId,
            generation: 1,
            eventCounter: 1,
          },
        });
      } else {
        stream = await tx.realtimeStream.update({
          where: { id: stream.id },
          data: { eventCounter: { increment: 1 } },
        });
      }

      const canonicalPayload: CanonicalMessagePayload = {
        id: updated.id,
        content: updated.content,
        channelId: updated.channelId,
        authorId: updated.authorId,
        messageSequence: updated.messageSequence,
        clientRequestId: updated.clientRequestId,
        replyToId: updated.replyToId,
        revision: updated.revision,
        editedAt: updated.editedAt ? updated.editedAt.toISOString() : null,
        deletedAt: updated.deletedAt ? updated.deletedAt.toISOString() : null,
        deletionReason: updated.deletionReason,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        author: updated.author,
      };

      const event = await tx.realtimeEvent.create({
        data: {
          streamId: stream.id,
          sequence: stream.eventCounter,
          eventId: randomUUID(),
          schemaVersion: 1,
          type: 'message.edited',
          generation: stream.generation,
          entityId: messageId,
          entityRevision: updated.revision,
          payload: canonicalPayload as any,
        },
      });

      const destination = buildDestinationChannel({
        channelId: message.channelId,
        generation: stream.generation,
        communityId: message.channel.communityId,
        conversationId: message.channel.conversationId,
        conversationKind: message.channel.conversation?.kind,
        studyRoomId: message.channel.studyRoomId,
      });

      await tx.realtimeDelivery.create({
        data: {
          eventId: event.id,
          destination,
          status: 'PENDING',
          attempts: 0,
          dueAt: new Date(),
        },
      });

      return canonicalPayload;
    });
  },

  /**
   * Soft-deletes / tombstones a message. Preserves sequence and replaces content.
   */
  async deleteMessage(input: DeleteMessageInput): Promise<CanonicalMessagePayload> {
    const { messageId, userId, reason } = input;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        author: { select: { id: true, name: true, image: true, username: true } },
        channel: {
          select: {
            id: true,
            communityId: true,
            conversationId: true,
            studyRoomId: true,
            conversation: { select: { kind: true } },
          },
        },
      },
    });

    if (!message) {
      throw new MessagingNotFoundError('Message not found');
    }

    if (message.deletedAt) {
      throw new MessagingValidationError('Message is already deleted');
    }

    // Author check (or moderator privileges in future)
    if (message.authorId !== userId) {
      throw new MessagingForbiddenError('Only the author can delete this message');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.message.update({
        where: { id: messageId },
        data: {
          content: '[This message was deleted]',
          deletedAt: new Date(),
          deletionReason: reason?.trim() || 'Deleted by author',
          revision: { increment: 1 },
        },
        include: {
          author: { select: { id: true, name: true, image: true, username: true } },
        },
      });

      let stream = await tx.realtimeStream.findUnique({
        where: { channelId: message.channelId },
      });

      if (!stream) {
        stream = await tx.realtimeStream.create({
          data: {
            channelId: message.channelId,
            generation: 1,
            eventCounter: 1,
          },
        });
      } else {
        stream = await tx.realtimeStream.update({
          where: { id: stream.id },
          data: { eventCounter: { increment: 1 } },
        });
      }

      const canonicalPayload: CanonicalMessagePayload = {
        id: updated.id,
        content: updated.content,
        channelId: updated.channelId,
        authorId: updated.authorId,
        messageSequence: updated.messageSequence,
        clientRequestId: updated.clientRequestId,
        replyToId: updated.replyToId,
        revision: updated.revision,
        editedAt: updated.editedAt ? updated.editedAt.toISOString() : null,
        deletedAt: updated.deletedAt ? updated.deletedAt.toISOString() : null,
        deletionReason: updated.deletionReason,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        author: updated.author,
      };

      const event = await tx.realtimeEvent.create({
        data: {
          streamId: stream.id,
          sequence: stream.eventCounter,
          eventId: randomUUID(),
          schemaVersion: 1,
          type: 'message.deleted',
          generation: stream.generation,
          entityId: messageId,
          entityRevision: updated.revision,
          payload: canonicalPayload as any,
        },
      });

      const destination = buildDestinationChannel({
        channelId: message.channelId,
        generation: stream.generation,
        communityId: message.channel.communityId,
        conversationId: message.channel.conversationId,
        conversationKind: message.channel.conversation?.kind,
        studyRoomId: message.channel.studyRoomId,
      });

      await tx.realtimeDelivery.create({
        data: {
          eventId: event.id,
          destination,
          status: 'PENDING',
          attempts: 0,
          dueAt: new Date(),
        },
      });

      return canonicalPayload;
    });
  },

  /**
   * Calculates unread incoming messages for a user in a channel.
   * Excludes own messages and deleted messages.
   */
  async calculateUnreadCount(
    userId: string,
    channelId: string,
    watermarkSequence?: number
  ): Promise<number> {
    let lastRead = watermarkSequence;
    if (lastRead === undefined) {
      const state = await prisma.channelUserState.findUnique({
        where: { channelId_userId: { channelId, userId } },
        select: { lastReadSequence: true },
      });
      lastRead = state?.lastReadSequence ?? 0;
    }

    return prisma.message.count({
      where: {
        channelId,
        messageSequence: { gt: lastRead },
        authorId: { not: userId },
        deletedAt: null,
      },
    });
  },
};
