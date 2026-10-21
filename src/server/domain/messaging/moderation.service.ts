import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { sprintService } from '../studyroom/sprint.service';
import {
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from './contracts';

export interface PinnedMessageDTO {
  id: string;
  channelId: string;
  content: string;
  messageSequence: number;
  isPinned: boolean;
  pinnedAt: string | null;
  pinnedBy: {
    id: string;
    name: string | null;
    username: string | null;
  } | null;
  isAnnouncement: boolean;
  author: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
  createdAt: string;
}

export const moderationService = {
  /**
   * Verifies if a user has moderation authority in a channel.
   */
  async isChannelModerator(userId: string, channelId: string): Promise<boolean> {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        community: {
          select: {
            cohortId: true,
            cohort: { select: { creatorId: true } },
          },
        },
        conversation: {
          select: {
            id: true,
            participants: {
              where: { userId, leftAt: null },
              select: { role: true },
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

    if (channel.community) {
      if (channel.community.cohort.creatorId === userId) return true;
      const member = await prisma.cohortMember.findUnique({
        where: {
          cohortId_userId: {
            cohortId: channel.community.cohortId,
            userId,
          },
        },
        select: { role: true },
      });
      return member?.role === 'MODERATOR' || member?.role === 'CREATOR';
    }

    if (channel.conversation) {
      const participant = channel.conversation.participants[0];
      return participant?.role === 'OWNER' || participant?.role === 'ADMIN';
    }

    if (channel.studyRoom) {
      return sprintService.isRoomController(channel.studyRoom.id, userId);
    }

    return false;
  },

  /**
   * Pins or unpins a message with moderation audit.
   */
  async setPinState(params: {
    userId: string;
    messageId: string;
    isPinned: boolean;
    reason?: string;
  }): Promise<PinnedMessageDTO> {
    const { userId, messageId, isPinned, reason } = params;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        channelId: true,
        deletedAt: true,
      },
    });

    if (!message) {
      throw new MessagingNotFoundError('Message not found');
    }

    if (message.deletedAt) {
      throw new MessagingValidationError('Cannot pin a deleted message');
    }

    const isModerator = await this.isChannelModerator(userId, message.channelId);
    if (!isModerator) {
      throw new MessagingForbiddenError('Moderator authority required to pin messages in this channel');
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const updatedMsg = await tx.message.update({
        where: { id: messageId },
        data: {
          isPinned,
          pinnedAt: isPinned ? now : null,
          pinnedById: isPinned ? userId : null,
        },
        include: {
          author: { select: { id: true, name: true, username: true, image: true } },
          pinnedBy: { select: { id: true, name: true, username: true } },
        },
      });

      await tx.messageModerationAudit.create({
        data: {
          channelId: message.channelId,
          messageId,
          moderatorId: userId,
          action: isPinned ? 'PIN' : 'UNPIN',
          reason: reason?.trim() || null,
        },
      });

      return updatedMsg;
    });

    return {
      id: updated.id,
      channelId: updated.channelId,
      content: updated.content,
      messageSequence: updated.messageSequence,
      isPinned: updated.isPinned,
      pinnedAt: updated.pinnedAt ? updated.pinnedAt.toISOString() : null,
      pinnedBy: updated.pinnedBy,
      isAnnouncement: updated.isAnnouncement,
      author: updated.author,
      createdAt: updated.createdAt.toISOString(),
    };
  },

  /**
   * Sets announcement status on a message with moderation audit.
   */
  async setAnnouncementState(params: {
    userId: string;
    messageId: string;
    isAnnouncement: boolean;
    reason?: string;
  }): Promise<PinnedMessageDTO> {
    const { userId, messageId, isAnnouncement, reason } = params;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        channelId: true,
        deletedAt: true,
      },
    });

    if (!message) {
      throw new MessagingNotFoundError('Message not found');
    }

    if (message.deletedAt) {
      throw new MessagingValidationError('Cannot mark a deleted message as announcement');
    }

    const isModerator = await this.isChannelModerator(userId, message.channelId);
    if (!isModerator) {
      throw new MessagingForbiddenError('Moderator authority required to set announcements');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedMsg = await tx.message.update({
        where: { id: messageId },
        data: { isAnnouncement },
        include: {
          author: { select: { id: true, name: true, username: true, image: true } },
          pinnedBy: { select: { id: true, name: true, username: true } },
        },
      });

      await tx.messageModerationAudit.create({
        data: {
          channelId: message.channelId,
          messageId,
          moderatorId: userId,
          action: isAnnouncement ? 'SET_ANNOUNCEMENT' : 'REMOVE_ANNOUNCEMENT',
          reason: reason?.trim() || null,
        },
      });

      return updatedMsg;
    });

    return {
      id: updated.id,
      channelId: updated.channelId,
      content: updated.content,
      messageSequence: updated.messageSequence,
      isPinned: updated.isPinned,
      pinnedAt: updated.pinnedAt ? updated.pinnedAt.toISOString() : null,
      pinnedBy: updated.pinnedBy,
      isAnnouncement: updated.isAnnouncement,
      author: updated.author,
      createdAt: updated.createdAt.toISOString(),
    };
  },

  /**
   * Retrieves all currently pinned messages for a channel.
   */
  async getChannelPins(channelId: string, userId: string): Promise<PinnedMessageDTO[]> {
    // Check channel access
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true },
    });

    if (!channel) {
      throw new MessagingNotFoundError('Channel not found');
    }

    const pinned = await prisma.message.findMany({
      where: {
        channelId,
        isPinned: true,
        deletedAt: null,
      },
      orderBy: { pinnedAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, username: true, image: true } },
        pinnedBy: { select: { id: true, name: true, username: true } },
      },
    });

    return pinned.map((m) => ({
      id: m.id,
      channelId: m.channelId,
      content: m.content,
      messageSequence: m.messageSequence,
      isPinned: m.isPinned,
      pinnedAt: m.pinnedAt ? m.pinnedAt.toISOString() : null,
      pinnedBy: m.pinnedBy,
      isAnnouncement: m.isAnnouncement,
      author: m.author,
      createdAt: m.createdAt.toISOString(),
    }));
  },
};
