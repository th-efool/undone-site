import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { messagingRepo } from '@/src/server/infrastructure/db/postgres/repositories/messaging.repo';
import {
  type SendMessageInput,
  type SendMessageResult,
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from './contracts';

const MAX_MESSAGE_CONTENT_LENGTH = 4000;

export const messageService = {
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { channelId, authorId, content, clientRequestId, replyToId } = input;

    // 1. Validate payload
    if (!content || typeof content !== 'string' || !content.trim()) {
      throw new MessagingValidationError('Message content cannot be empty');
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length > MAX_MESSAGE_CONTENT_LENGTH) {
      throw new MessagingValidationError(
        `Message content exceeds maximum allowed length of ${MAX_MESSAGE_CONTENT_LENGTH} characters`
      );
    }

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
      if (channel.studyRoom.status !== 'active') {
        throw new MessagingForbiddenError('Study room is not active');
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
    return messagingRepo.createMessageTransaction({
      channelId,
      authorId,
      content: trimmedContent,
      clientRequestId,
      replyToId,
    });
  },
};
