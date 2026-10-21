import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export type RealtimeScopeType =
  | 'user'
  | 'community'
  | 'dm'
  | 'group'
  | 'room'
  | 'roomchat'
  | 'signal';

export interface ManifestChannelEntry {
  channel: string;
  scopeType: RealtimeScopeType;
  entityId: string;
  generation: number;
}

export interface SubscriptionManifest {
  userId: string;
  generatedAt: string;
  channels: ManifestChannelEntry[];
}

export const manifestService = {
  async getAuthorizedSubscriptionManifest(userId: string): Promise<SubscriptionManifest> {
    const channels: ManifestChannelEntry[] = [];
    const seenChannels = new Set<string>();

    const addChannel = (entry: ManifestChannelEntry) => {
      if (!seenChannels.has(entry.channel)) {
        seenChannels.add(entry.channel);
        channels.push(entry);
      }
    };

    // 1. User Personal Inbox Channel
    addChannel({
      channel: `user:${userId}:g1`,
      scopeType: 'user',
      entityId: userId,
      generation: 1,
    });

    // 2. Cohort Community Channels (as member or creator)
    const [enrolledMemberships, createdCohorts] = await Promise.all([
      prisma.cohortMember.findMany({
        where: { userId },
        select: {
          cohort: {
            select: {
              id: true,
              community: {
                select: {
                  id: true,
                  chatEnabled: true,
                  accessGeneration: true,
                  channels: {
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.cohort.findMany({
        where: { creatorId: userId },
        select: {
          id: true,
          community: {
            select: {
              id: true,
              chatEnabled: true,
              accessGeneration: true,
              channels: {
                select: { id: true },
              },
            },
          },
        },
      }),
    ]);

    const communityList = [
      ...enrolledMemberships.map(m => m.cohort.community),
      ...createdCohorts.map(c => c.community),
    ].filter(Boolean);

    for (const community of communityList) {
      if (!community || !community.chatEnabled) continue;
      const generation = community.accessGeneration || 1;
      for (const chan of community.channels) {
        addChannel({
          channel: `community:${chan.id}:g${generation}`,
          scopeType: 'community',
          entityId: chan.id,
          generation,
        });
      }
    }

    // 3. Direct and Group Conversations
    const conversationMemberships = await prisma.conversationParticipant.findMany({
      where: {
        userId,
        leftAt: null,
      },
      select: {
        conversation: {
          select: {
            id: true,
            kind: true,
            accessGeneration: true,
            channel: {
              select: { id: true },
            },
          },
        },
      },
    });

    for (const m of conversationMemberships) {
      const conv = m.conversation;
      const generation = conv.accessGeneration || 1;
      const prefix = conv.kind === 'DIRECT' ? 'dm' : 'group';
      addChannel({
        channel: `${prefix}:${conv.id}:g${generation}`,
        scopeType: conv.kind === 'DIRECT' ? 'dm' : 'group',
        entityId: conv.id,
        generation,
      });
    }

    // 4. Current Active Study Room
    const roomParticipant = await prisma.roomParticipant.findUnique({
      where: { userId },
      select: {
        generation: true,
        room: {
          select: {
            id: true,
            status: true,
            channel: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (roomParticipant && ['active', 'open'].includes(roomParticipant.room.status?.toLowerCase())) {
      const activeLease = await prisma.roomLease.findFirst({
        where: {
          studyRoomId: roomParticipant.room.id,
          userId,
          expiresAt: { gt: new Date() },
        },
      });

      if (activeLease) {
        const room = roomParticipant.room;
        const gen = activeLease.generation || roomParticipant.generation || 1;
        addChannel({
          channel: `room:${room.id}:g${gen}`,
          scopeType: 'room',
          entityId: room.id,
          generation: gen,
        });
        if (room.channel) {
          addChannel({
            channel: `roomchat:${room.channel.id}:g${gen}`,
            scopeType: 'roomchat',
            entityId: room.channel.id,
            generation: gen,
          });
        }
      }
    }

    return {
      userId,
      generatedAt: new Date().toISOString(),
      channels,
    };
  },
};
