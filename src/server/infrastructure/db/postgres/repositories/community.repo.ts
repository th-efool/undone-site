import { prisma } from '../client';

export const communityRepo = {
  getCommunityChannels: async (cohortId: string) => {
    return prisma.community.findUnique({
      where: { cohortId },
      include: {
        channels: {
          select: {
            id: true,
            name: true,
            communityId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  },

  getUserEnrolledCommunities: async (userId: string) => {
    const [memberships, createdCohorts] = await Promise.all([
      prisma.cohortMember.findMany({
        where: { userId },
        select: {
          role: true,
          cohort: {
            select: {
              id: true,
              title: true,
              coverImage: true,
              isPublished: true,
              community: {
                select: {
                  id: true,
                  chatEnabled: true,
                  channels: {
                    select: {
                      id: true,
                      name: true,
                    },
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
          title: true,
          coverImage: true,
          isPublished: true,
          community: {
            select: {
              id: true,
              chatEnabled: true,
              channels: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const seenCohortIds = new Set<string>();
    const results: Array<{
      role: string;
      cohort: {
        id: string;
        title: string;
        coverImage: string | null;
        isPublished: boolean;
        community: {
          id: string;
          chatEnabled: boolean;
          channels: Array<{ id: string; name: string }>;
        } | null;
      };
    }> = [];

    for (const m of memberships) {
      if (!seenCohortIds.has(m.cohort.id)) {
        seenCohortIds.add(m.cohort.id);
        results.push(m);
      }
    }

    for (const c of createdCohorts) {
      if (!seenCohortIds.has(c.id)) {
        seenCohortIds.add(c.id);
        results.push({
          role: 'CREATOR',
          cohort: c,
        });
      }
    }

    return results;
  },

  getChannelMessages: async (channelId: string, limit = 50, beforeCursor?: string) => {
    const take = Math.min(100, Math.max(1, limit));
    return prisma.message.findMany({
      where: { channelId },
      take,
      ...(beforeCursor ? { skip: 1, cursor: { id: beforeCursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, name: true, image: true, username: true },
        },
        reactions: {
          select: { emoji: true, userId: true },
        },
      },
    });
  },

  addMessage: async (channelId: string, authorId: string, content: string) => {
    return prisma.message.create({
      data: {
        content,
        channelId,
        authorId,
      },
      include: {
        author: {
          select: { id: true, name: true, image: true, username: true },
        },
        reactions: {
          select: { emoji: true, userId: true },
        },
      },
    });
  },
};
