import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { messagingRepo } from '@/src/server/infrastructure/db/postgres/repositories/messaging.repo';
import {
  type ChannelSyncParams,
  type ChannelSyncResponse,
  MessagingForbiddenError,
  MessagingNotFoundError,
} from './contracts';

export const syncService = {
  async syncChannel(params: ChannelSyncParams): Promise<ChannelSyncResponse> {
    const { channelId, userId, clientSequence, limit } = params;

    // 1. Authorize channel access
    const channel = await messagingRepo.getChannelWithParent(channelId);
    if (!channel) {
      throw new MessagingNotFoundError('Channel not found');
    }

    if (channel.community) {
      if (!channel.community.chatEnabled) {
        throw new MessagingForbiddenError('Chat is disabled for this community');
      }

      const { cohortId, cohort } = channel.community;
      const isCreator = cohort.creatorId === userId;
      let isMember = isCreator;

      if (!isMember) {
        const membership = await prisma.cohortMember.findUnique({
          where: { cohortId_userId: { cohortId, userId } },
          select: { role: true },
        });
        isMember = Boolean(membership);
      }

      if (!isMember) {
        throw new MessagingForbiddenError('Active cohort membership is required to access messages');
      }
    } else if (channel.conversation) {
      const participant = channel.conversation.participants.find(
        p => p.userId === userId && p.leftAt === null
      );
      if (!participant) {
        throw new MessagingForbiddenError('Not an active participant in this conversation');
      }
    }

    // 2. Locate or create stream for channel
    let stream = await messagingRepo.getStreamForChannel(channelId);
    if (!stream) {
      // No stream yet -> return initial snapshot
      const messages = await messagingRepo.getMessagesKeyset({ channelId, limit: limit ?? 50 });
      return {
        mode: 'SNAPSHOT',
        channelId,
        streamId: '',
        currentSequence: 0,
        watermarkSequence: 0,
        messages,
      };
    }

    const currentSequence = stream.eventCounter;

    // 3. Check if client requires a snapshot or delta
    // If client sequence is 0, missing, or has drifted too far (gap > 150 events), reset to snapshot
    const maxDeltaGap = 150;
    const isResetRequired =
      clientSequence === undefined ||
      clientSequence <= 0 ||
      clientSequence > currentSequence ||
      currentSequence - clientSequence > maxDeltaGap;

    if (isResetRequired) {
      const messages = await messagingRepo.getMessagesKeyset({ channelId, limit: limit ?? 50 });
      return {
        mode: 'SNAPSHOT',
        channelId,
        streamId: stream.id,
        currentSequence,
        watermarkSequence: currentSequence,
        messages,
      };
    }

    // Client is within catchup window -> return delta events
    const events = await messagingRepo.getEventsDelta({
      streamId: stream.id,
      afterSequence: clientSequence,
      limit: limit ?? 100,
    });

    return {
      mode: 'DELTA',
      channelId,
      streamId: stream.id,
      currentSequence,
      watermarkSequence: currentSequence,
      events,
    };
  },

  async acknowledgeWatermark(params: {
    channelId: string;
    userId: string;
    readSequence?: number;
    deliveredSequence?: number;
  }) {
    return messagingRepo.updateUserWatermark(params);
  },
};
