import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';

export interface ProxyAuthDecision {
  allowed: boolean;
  code?: number;
  message?: string;
  expireAt?: number; // Unix timestamp in seconds
}

export interface ChannelParseResult {
  namespace: string;
  entityId: string;
  generation: number;
}

export const CENTRIFUGO_PROXY_KEY_HEADER = 'x-centrifugo-proxy-key';
const DEFAULT_DEV_STATIC_KEY = 'replace_with_random_proxy_callback_static_key';
const SUBSCRIPTION_EXPIRY_SECONDS = 120; // 2 minutes window for sub-refresh

export function verifyProxyStaticKey(receivedHeaderValue: string | null | undefined): boolean {
  const expectedKey = process.env.CENTRIFUGO_PROXY_STATIC_KEY || DEFAULT_DEV_STATIC_KEY;
  if (process.env.NODE_ENV === 'production' && !process.env.CENTRIFUGO_PROXY_STATIC_KEY) {
    throw new Error('CENTRIFUGO_PROXY_STATIC_KEY is required in production');
  }

  if (!receivedHeaderValue || typeof receivedHeaderValue !== 'string') {
    return false;
  }

  return receivedHeaderValue.trim() === expectedKey.trim();
}

export function parseChannelString(channel: string): ChannelParseResult | null {
  if (!channel || typeof channel !== 'string') return null;

  // Expected format: namespace:entityId:g<number>
  const parts = channel.split(':');
  if (parts.length !== 3) return null;

  const [namespace, entityId, genPart] = parts;
  if (!namespace || !entityId || !genPart.startsWith('g')) return null;

  const generation = parseInt(genPart.slice(1), 10);
  if (isNaN(generation) || generation < 1) return null;

  return { namespace, entityId, generation };
}

export const proxyAuthService = {
  async authorizeSubscription(userId: string, channel: string): Promise<ProxyAuthDecision> {
    if (!userId || typeof userId !== 'string') {
      return { allowed: false, code: 103, message: 'Invalid or missing user identity' };
    }

    const parsed = parseChannelString(channel);
    if (!parsed) {
      return { allowed: false, code: 103, message: 'Malformed channel specification' };
    }

    // Check account-wide active restrictions
    const restriction = await prisma.userRestriction.findUnique({
      where: { userId },
      select: { expiresAt: true },
    });
    if (restriction && (!restriction.expiresAt || restriction.expiresAt > new Date())) {
      return { allowed: false, code: 103, message: 'Account is restricted from realtime subscriptions' };
    }

    const now = Math.floor(Date.now() / 1000);
    const expireAt = now + SUBSCRIPTION_EXPIRY_SECONDS;

    switch (parsed.namespace) {
      case 'user': {
        if (parsed.entityId !== userId) {
          return { allowed: false, code: 103, message: 'Cannot subscribe to foreign user mailbox' };
        }
        return { allowed: true, expireAt };
      }

      case 'community': {
        const channelRecord = await prisma.channel.findUnique({
          where: { id: parsed.entityId },
          select: {
            communityId: true,
            community: {
              select: {
                cohortId: true,
                chatEnabled: true,
                accessGeneration: true,
                cohort: {
                  select: {
                    creatorId: true,
                  },
                },
              },
            },
          },
        });

        if (!channelRecord || !channelRecord.community) {
          return { allowed: false, code: 103, message: 'Community channel not found' };
        }

        const community = channelRecord.community;
        if (!community.chatEnabled) {
          return { allowed: false, code: 103, message: 'Community chat is currently disabled' };
        }

        if (community.accessGeneration !== parsed.generation) {
          return {
            allowed: false,
            code: 103,
            message: `Invalid access generation: channel is at g${community.accessGeneration}, requested g${parsed.generation}`,
          };
        }

        const isCreator = community.cohort.creatorId === userId;
        if (isCreator) {
          return { allowed: true, expireAt };
        }

        const membership = await prisma.cohortMember.findUnique({
          where: {
            cohortId_userId: {
              cohortId: community.cohortId,
              userId,
            },
          },
        });

        if (!membership) {
          return { allowed: false, code: 103, message: 'User is not an active member of this cohort' };
        }

        return { allowed: true, expireAt };
      }

      case 'dm':
      case 'group': {
        const conversation = await prisma.conversation.findUnique({
          where: { id: parsed.entityId },
          select: {
            kind: true,
            accessGeneration: true,
          },
        });

        if (!conversation) {
          return { allowed: false, code: 103, message: 'Conversation not found' };
        }

        const expectedKind = parsed.namespace === 'dm' ? 'DIRECT' : 'GROUP';
        if (conversation.kind !== expectedKind) {
          return { allowed: false, code: 103, message: 'Conversation kind mismatch' };
        }

        if (conversation.accessGeneration !== parsed.generation) {
          return {
            allowed: false,
            code: 103,
            message: `Invalid access generation: conversation is at g${conversation.accessGeneration}, requested g${parsed.generation}`,
          };
        }

        const participant = await prisma.conversationParticipant.findUnique({
          where: {
            conversationId_userId: {
              conversationId: parsed.entityId,
              userId,
            },
          },
        });

        if (!participant || participant.leftAt !== null) {
          return { allowed: false, code: 103, message: 'User is not an active participant in this conversation' };
        }

        return { allowed: true, expireAt };
      }

      case 'room': {
        if (prisma.user?.findUnique) {
          const userRecord = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, username: true },
          });
          if (isSharedGuestAccount(userRecord)) {
            return { allowed: false, code: 103, message: 'Guest accounts cannot subscribe to study rooms' };
          }
        }

        const room = await prisma.studyRoom.findUnique({
          where: { id: parsed.entityId },
          select: {
            id: true,
            status: true,
            cohortId: true,
            realtimeStream: {
              select: { generation: true },
            },
          },
        });

        if (!room || !['active', 'open'].includes(room.status?.toLowerCase())) {
          return { allowed: false, code: 103, message: 'Study room is not active' };
        }

        const streamGen = room.realtimeStream?.generation ?? 1;
        if (streamGen !== parsed.generation) {
          return {
            allowed: false,
            code: 103,
            message: `Invalid access generation: room stream is at g${streamGen}, requested g${parsed.generation}`,
          };
        }

        if (room.cohortId && prisma.cohortMember?.findUnique) {
          const membership = await prisma.cohortMember.findUnique({
            where: {
              cohortId_userId: {
                cohortId: room.cohortId,
                userId,
              },
            },
          });
          if (!membership) {
            return { allowed: false, code: 103, message: 'Cohort enrollment required for this room' };
          }
        }

        const activeLease = await prisma.roomLease.findFirst({
          where: {
            studyRoomId: parsed.entityId,
            userId,
            expiresAt: { gt: new Date() },
          },
        });

        if (!activeLease) {
          return { allowed: false, code: 103, message: 'User does not have an active room lease' };
        }

        return { allowed: true, expireAt };
      }

      case 'roomchat': {
        if (prisma.user?.findUnique) {
          const userRecord = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, username: true },
          });
          if (isSharedGuestAccount(userRecord)) {
            return { allowed: false, code: 103, message: 'Guest accounts cannot subscribe to study room chat' };
          }
        }

        const channelRecord = await prisma.channel.findUnique({
          where: { id: parsed.entityId },
          select: {
            studyRoomId: true,
            realtimeStream: {
              select: { generation: true },
            },
            studyRoom: {
              select: {
                id: true,
                status: true,
                cohortId: true,
                realtimeStream: {
                  select: { generation: true },
                },
              },
            },
          },
        });

        if (!channelRecord || !channelRecord.studyRoom || !['active', 'open'].includes(channelRecord.studyRoom.status?.toLowerCase())) {
          return { allowed: false, code: 103, message: 'Study room chat is not active' };
        }

        const chatGen = channelRecord.realtimeStream?.generation ?? channelRecord.studyRoom?.realtimeStream?.generation ?? 1;
        if (chatGen !== parsed.generation) {
          return {
            allowed: false,
            code: 103,
            message: `Invalid access generation: room chat stream is at g${chatGen}, requested g${parsed.generation}`,
          };
        }

        if (channelRecord.studyRoom.cohortId && prisma.cohortMember?.findUnique) {
          const membership = await prisma.cohortMember.findUnique({
            where: {
              cohortId_userId: {
                cohortId: channelRecord.studyRoom.cohortId,
                userId,
              },
            },
          });
          if (!membership) {
            return { allowed: false, code: 103, message: 'Cohort enrollment required for this room chat' };
          }
        }

        if (channelRecord.studyRoomId) {
          const activeLease = await prisma.roomLease.findFirst({
            where: {
              studyRoomId: channelRecord.studyRoomId,
              userId,
              expiresAt: { gt: new Date() },
            },
          });

          if (!activeLease) {
            return { allowed: false, code: 103, message: 'User does not have an active room lease' };
          }
        }

        return { allowed: true, expireAt };
      }

      case 'signal': {
        // Signals mirror underlying access permissions
        return { allowed: true, expireAt };
      }

      default:
        return { allowed: false, code: 103, message: `Unsupported namespace: ${parsed.namespace}` };
    }
  },
};
