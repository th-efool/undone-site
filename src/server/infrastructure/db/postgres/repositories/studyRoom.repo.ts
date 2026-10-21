import { prisma } from '../client';

export const studyRoomRepo = {
  getActiveRooms: async () => {
    return await prisma.studyRoom.findMany();
  },

  joinRoom: async (userId: string, studyRoomId: string) => {
    return await prisma.roomParticipant.create({
      data: {
        userId,
        studyRoomId,
      },
    });
  },

  leaveRoom: async (userId: string) => {
    return await prisma.roomParticipant.deleteMany({
      where: {
        userId,
      },
    });
  },
  seedRooms: async () => {
    const count = await prisma.studyRoom.count();
    if (count === 0) {
      await prisma.studyRoom.createMany({
        data: [
          { title: 'Fireplace', slug: 'fireplace', thumbnail: '/rooms/fireplace.jpg', status: 'OPEN', listing: 'PUBLIC', visualPresetId: 'cozy-fireplace' },
          { title: 'Library', slug: 'library', thumbnail: '/rooms/library.jpg', status: 'OPEN', listing: 'PUBLIC', visualPresetId: 'library' },
          { title: 'Developer Den', slug: 'developer-den', thumbnail: '/rooms/dev-den.jpg', status: 'OPEN', listing: 'PUBLIC', visualPresetId: 'night-sky' },
        ],
      });
    }
  },

  incrementOnlineCount: async (studyRoomId: string) => {
    return await prisma.studyRoom.update({
      where: { id: studyRoomId },
      data: { onlineCount: { increment: 1 } },
    });
  },

  decrementOnlineCount: async (studyRoomId: string) => {
    return await prisma.studyRoom.update({
      where: { id: studyRoomId },
      data: { onlineCount: { decrement: 1 } },
    });
  },
};
