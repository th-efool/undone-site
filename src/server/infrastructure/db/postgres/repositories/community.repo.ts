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
    return prisma.cohortMember.findMany({
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
    });
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
      },
    });
  },
};
