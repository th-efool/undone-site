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
};
