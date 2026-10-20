import { randomUUID } from 'node:crypto';
import { prisma } from '../client';
import {
  type AuthorSummary,
  type CanonicalMessagePayload,
  type RealtimeEventEnvelope,
  type SendMessageInput,
  type SendMessageResult,
  MessagingConflictError,
  buildDestinationChannel,
  computeMessagePayloadHash,
} from '@/src/server/domain/messaging/contracts';

function formatMessagePayload(msg: {
  id: string;
  content: string;
  channelId: string;
  authorId: string;
  messageSequence: number;
  clientRequestId: string | null;
  replyToId: string | null;
  revision: number;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: AuthorSummary;
}): CanonicalMessagePayload {
  return {
    id: msg.id,
    content: msg.content,
    channelId: msg.channelId,
    authorId: msg.authorId,
    messageSequence: msg.messageSequence,
    clientRequestId: msg.clientRequestId,
    replyToId: msg.replyToId,
    revision: msg.revision,
    editedAt: msg.editedAt ? msg.editedAt.toISOString() : null,
    deletedAt: msg.deletedAt ? msg.deletedAt.toISOString() : null,
    deletionReason: msg.deletionReason,
    createdAt: msg.createdAt.toISOString(),
    updatedAt: msg.updatedAt.toISOString(),
    author: {
      id: msg.author.id,
      name: msg.author.name,
      image: msg.author.image,
      username: msg.author.username,
    },
  };
}

export const messagingRepo = {
  async getChannelWithParent(channelId: string) {
    return prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        community: {
          select: {
            id: true,
            cohortId: true,
            chatEnabled: true,
            accessGeneration: true,
            cohort: {
              select: {
                id: true,
                creatorId: true,
                visibility: true,
              },
            },
          },
        },
        conversation: {
          select: {
            id: true,
            kind: true,
            accessGeneration: true,
            creatorId: true,
            participants: {
              select: {
                userId: true,
                role: true,
                leftAt: true,
              },
            },
          },
        },
        studyRoom: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
  },

  async createMessageTransaction(input: SendMessageInput): Promise<SendMessageResult> {
    const { channelId, authorId, content, clientRequestId, replyToId } = input;
    const payloadHash = computeMessagePayloadHash({ channelId, content, replyToId });

    try {
      return await prisma.$transaction(async tx => {
        // 1. Pre-check idempotency
        if (clientRequestId) {
          const existingRequest = await tx.messagingRequest.findUnique({
            where: {
              actorId_operation_scope_requestId: {
                actorId: authorId,
                operation: 'send_message',
                scope: `channel:${channelId}`,
                requestId: clientRequestId,
              },
            },
          });

          if (existingRequest) {
            if (existingRequest.payloadHash === payloadHash) {
              return {
                message: existingRequest.response as unknown as CanonicalMessagePayload,
                isIdempotentReplay: true,
              };
            }
            throw new MessagingConflictError('Client request ID conflict with different payload');
          }
        }

        // 2. Atomically allocate sequence by incrementing channel messageCounter
        const updatedChannel = await tx.channel.update({
          where: { id: channelId },
          data: { messageCounter: { increment: 1 } },
          select: {
            messageCounter: true,
            communityId: true,
            conversationId: true,
            studyRoomId: true,
          },
        });

        const messageSequence = updatedChannel.messageCounter;

        // 3. Insert canonical Message
        const rawMessage = await tx.message.create({
          data: {
            content,
            channelId,
            authorId,
            messageSequence,
            clientRequestId: clientRequestId ?? null,
            payloadHash,
            replyToId: replyToId ?? null,
            revision: 1,
          },
          include: {
            author: {
              select: { id: true, name: true, image: true, username: true },
            },
          },
        });

        const formattedMessage = formatMessagePayload(rawMessage);

        // 4. Ensure RealtimeStream exists and increment eventCounter
        let stream = await tx.realtimeStream.findUnique({
          where: { channelId },
        });

        if (!stream) {
          stream = await tx.realtimeStream.create({
            data: {
              channelId,
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

        // 5. Create durable RealtimeEvent
        const eventId = randomUUID();
        const event = await tx.realtimeEvent.create({
          data: {
            streamId: stream.id,
            sequence: stream.eventCounter,
            eventId,
            schemaVersion: 1,
            type: 'message.created',
            generation: stream.generation,
            entityId: formattedMessage.id,
            entityRevision: formattedMessage.revision,
            clientRequestId: clientRequestId ?? null,
            payload: formattedMessage as any,
          },
        });

        // 6. Create RealtimeDelivery outbox destination
        const destination = buildDestinationChannel({
          channelId,
          generation: stream.generation,
          communityId: updatedChannel.communityId,
          conversationId: updatedChannel.conversationId,
          studyRoomId: updatedChannel.studyRoomId,
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

        // 7. Record Idempotency Request Record
        if (clientRequestId) {
          await tx.messagingRequest.create({
            data: {
              actorId: authorId,
              operation: 'send_message',
              scope: `channel:${channelId}`,
              requestId: clientRequestId,
              payloadHash,
              response: formattedMessage as any,
            },
          });
        }

        // 8. Update author's channel user state (watermarks)
        await tx.channelUserState.upsert({
          where: {
            channelId_userId: {
              channelId,
              userId: authorId,
            },
          },
          create: {
            channelId,
            userId: authorId,
            lastReadSequence: messageSequence,
            lastDeliveredSequence: messageSequence,
          },
          update: {
            lastReadSequence: { set: messageSequence },
            lastDeliveredSequence: { set: messageSequence },
          },
        });

        return {
          message: formattedMessage,
          isIdempotentReplay: false,
        };
      });
    } catch (err: any) {
      // Reconcile concurrent unique race on clientRequestId
      if (
        clientRequestId &&
        (err.code === 'P2002' ||
          err.code === '23505' ||
          err.message?.includes('Unique constraint') ||
          err.message?.includes('unique constraint'))
      ) {
        const existing = await prisma.messagingRequest.findUnique({
          where: {
            actorId_operation_scope_requestId: {
              actorId: authorId,
              operation: 'send_message',
              scope: `channel:${channelId}`,
              requestId: clientRequestId,
            },
          },
        });

        if (existing) {
          if (existing.payloadHash === payloadHash) {
            return {
              message: existing.response as unknown as CanonicalMessagePayload,
              isIdempotentReplay: true,
            };
          }
          throw new MessagingConflictError('Client request ID conflict with different payload');
        }
      }
      throw err;
    }
  },

  async getMessagesKeyset(params: {
    channelId: string;
    beforeSequence?: number;
    limit?: number;
  }): Promise<CanonicalMessagePayload[]> {
    const take = Math.min(100, Math.max(1, params.limit ?? 50));
    const where: any = { channelId: params.channelId };

    if (params.beforeSequence && params.beforeSequence > 0) {
      where.messageSequence = { lt: params.beforeSequence };
    }

    const messages = await prisma.message.findMany({
      where,
      take,
      orderBy: { messageSequence: 'desc' },
      include: {
        author: {
          select: { id: true, name: true, image: true, username: true },
        },
      },
    });

    return messages.reverse().map(formatMessagePayload);
  },

  async getStreamForChannel(channelId: string) {
    return prisma.realtimeStream.findUnique({
      where: { channelId },
    });
  },

  async getEventsDelta(params: {
    streamId: string;
    afterSequence: number;
    limit?: number;
  }): Promise<RealtimeEventEnvelope[]> {
    const take = Math.min(200, Math.max(1, params.limit ?? 100));
    const events = await prisma.realtimeEvent.findMany({
      where: {
        streamId: params.streamId,
        sequence: { gt: params.afterSequence },
      },
      take,
      orderBy: { sequence: 'asc' },
    });

    return events.map(e => ({
      eventId: e.eventId,
      schemaVersion: e.schemaVersion,
      type: e.type,
      streamId: e.streamId,
      sequence: e.sequence,
      generation: e.generation,
      occurredAt: e.occurredAt.toISOString(),
      entityId: e.entityId,
      entityRevision: e.entityRevision,
      clientRequestId: e.clientRequestId,
      payload: e.payload,
    }));
  },

  async updateUserWatermark(params: {
    channelId: string;
    userId: string;
    readSequence?: number;
    deliveredSequence?: number;
  }) {
    const data: any = {};
    if (params.readSequence !== undefined) {
      data.lastReadSequence = params.readSequence;
    }
    if (params.deliveredSequence !== undefined) {
      data.lastDeliveredSequence = params.deliveredSequence;
    }

    return prisma.channelUserState.upsert({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: params.userId,
        },
      },
      create: {
        channelId: params.channelId,
        userId: params.userId,
        lastReadSequence: params.readSequence ?? 0,
        lastDeliveredSequence: params.deliveredSequence ?? 0,
      },
      update: data,
    });
  },
};
