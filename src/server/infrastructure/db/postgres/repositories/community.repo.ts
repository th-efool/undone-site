import { prisma } from '../client';

export const communityRepo = {
  getCommunityChannels: async (cohortId: string) => {
    return prisma.community.findUnique({
      where: { cohortId },
      include: {
        channels: true,
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
    });
  },
};
