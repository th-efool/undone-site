import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { messagingRepo } from '@/src/server/infrastructure/db/postgres/repositories/messaging.repo';
import { notificationService } from '../notifications/notification.service';
import { sanitizeMessageContent } from './sanitizer';
import {
  type SendMessageInput,
  type SendMessageResult,
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from './contracts';

export const messageService = {
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { channelId, authorId, content, clientRequestId, replyToId } = input;

    // 1. Validate payload and strip dangerous control characters / enforce length
    const sanitizedContent = sanitizeMessageContent(content);

    // 2. Check user restrictions (bans/mutes)
    const restriction = await prisma.userRestriction.findUnique({
      where: { userId: authorId },
      select: { expiresAt: true },
    });

    if (restriction && (!restriction.expiresAt || restriction.expiresAt > new Date())) {
      throw new MessagingForbiddenError('Messaging privileges are restricted for this account');
    }

    // 3. Authorize channel access
    const channel = await messagingRepo.getChannelWithParent(channelId);
    if (!channel) {
      throw new MessagingNotFoundError('Channel not found');
    }

    // Community Channel Authorization
    if (channel.community) {
      if (!channel.community.chatEnabled) {
        throw new MessagingForbiddenError('Chat is disabled for this community');
      }

      const { cohortId, cohort } = channel.community;
      const isCreator = cohort.creatorId === authorId;
      let isMember = isCreator;

      if (!isMember) {
        const membership = await prisma.cohortMember.findUnique({
          where: { cohortId_userId: { cohortId, userId: authorId } },
          select: { role: true },
        });
        isMember = Boolean(membership);
      }

      if (!isMember) {
        throw new MessagingForbiddenError(
          'Active cohort membership is required to post in this channel'
        );
      }
    } else if (channel.conversation) {
      // Direct / Group Conversation Authorization
      const participant = channel.conversation.participants.find(
        p => p.userId === authorId && p.leftAt === null
      );
      if (!participant) {
        throw new MessagingForbiddenError('Not an active participant in this conversation');
      }
    } else if (channel.studyRoom) {
      // Study Room Channel Authorization
      if (!['active', 'open'].includes(channel.studyRoom.status?.toLowerCase())) {
        throw new MessagingForbiddenError('Study room is not active');
      }

      if (prisma.user?.findUnique) {
        const authorUser = await prisma.user.findUnique({
          where: { id: authorId },
          select: { email: true, username: true },
        });
        if (isSharedGuestAccount(authorUser)) {
          throw new MessagingForbiddenError('Guest accounts cannot send messages in study rooms');
        }
      }

      if (channel.studyRoom.cohortId && prisma.cohortMember?.findUnique) {
        const membership = await prisma.cohortMember.findUnique({
          where: {
            cohortId_userId: {
              cohortId: channel.studyRoom.cohortId,
              userId: authorId,
            },
          },
        });
        if (!membership) {
          throw new MessagingForbiddenError('Cohort enrollment required to chat in this room');
        }
      }

      const activeLease = await prisma.roomLease.findFirst({
        where: {
          studyRoomId: channel.studyRoom.id,
          userId: authorId,
          expiresAt: { gt: new Date() },
        },
      });

      if (!activeLease) {
        const participant = await prisma.roomParticipant.findFirst({
          where: {
            studyRoomId: channel.studyRoom.id,
            userId: authorId,
          },
        });
        if (!participant) {
          throw new MessagingForbiddenError('Not an active participant in this study room');
        }
      }
    } else {
      throw new MessagingForbiddenError('Channel does not have a valid parent context');
    }

    // 4. Validate replyTo belongs to the same channel if specified
    if (replyToId) {
      const parentMessage = await prisma.message.findUnique({
        where: { id: replyToId },
        select: { channelId: true },
      });
      if (!parentMessage || parentMessage.channelId !== channelId) {
        throw new MessagingValidationError('Reply target must belong to the same channel');
      }
    }

    // 5. Execute transactional durable message write with idempotency
    const result = await messagingRepo.createMessageTransaction({
      channelId,
      authorId,
      content: sanitizedContent,
      clientRequestId,
      replyToId,
    });

    // 6. If not an idempotent replay, process mentions and dispatch notifications
    if (!result.isIdempotentReplay) {
      const mentionMatches = Array.from(sanitizedContent.matchAll(/(?:^|\s)@([a-zA-Z0-9_-]+)/g)).map(
        (m) => m[1]
      );

      if (mentionMatches.length > 0) {
        const uniqueHandles = Array.from(new Set(mentionMatches));
        const mentionedUsers = await prisma.user.findMany({
          where: {
            username: { in: uniqueHandles, mode: 'insensitive' },
            id: { not: authorId },
          },
          select: { id: true, username: true },
        });

        for (const u of mentionedUsers) {
          let hasAccess = false;
          if (channel.community) {
            const isCreator = channel.community.cohort.creatorId === u.id;
            if (isCreator) {
              hasAccess = true;
            } else {
              const m = await prisma.cohortMember.findUnique({
                where: {
                  cohortId_userId: {
                    cohortId: channel.community.cohortId,
                    userId: u.id,
                  },
                },
              });
              hasAccess = Boolean(m);
            }
          } else if (channel.conversation) {
            hasAccess = channel.conversation.participants.some(
              (p) => p.userId === u.id && p.leftAt === null
            );
          } else if (channel.studyRoom) {
            const p = await prisma.roomParticipant.findFirst({
              where: { studyRoomId: channel.studyRoom.id, userId: u.id },
            });
            hasAccess = Boolean(p);
          }

          if (hasAccess) {
            const scopeType: 'channel' | 'conversation' | 'studyroom' = channel.community
              ? 'channel'
              : channel.conversation
              ? 'conversation'
              : 'studyroom';

            await notificationService.createNotification({
              userId: u.id,
              actorId: authorId,
              scopeType,
              scopeId: channelId,
              entityId: result.message.id,
              type: 'mention',
              title: 'New Mention',
              body: `${result.message.author.name || result.message.author.username || 'Someone'} mentioned you: "${sanitizedContent.slice(0, 100)}"`,
            }).catch(() => {
              // Notification dispatch failures should not roll back completed message write
            });
          }
        }
      }
    }

    return result;
  },
};
