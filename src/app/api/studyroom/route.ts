import { NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { studyRoomRepo } from '@/src/server/infrastructure/db/postgres/repositories/studyRoom.repo';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export async function GET() {
  try {
    await studyRoomRepo.seedRooms();
    
    // Fetch rooms including participants and their user profiles (for avatars)
    const rooms = await prisma.studyRoom.findMany({
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json(rooms ?? []);
  } catch (error) {
    console.error('Failed to fetch study rooms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user || !user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) ?? {};
    const { action, roomId } = body;

    const cleanAction = typeof action === 'string' ? action.trim().toLowerCase() : '';
    const cleanRoomId = typeof roomId === 'string' ? roomId.trim() : '';

    if (cleanAction === 'join') {
      if (!cleanRoomId) {
        return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
      }

      // Check if user is already in this room
      const existingInRoom = await prisma.roomParticipant.findFirst({
        where: { userId: user.id, studyRoomId: cleanRoomId },
      });
      if (existingInRoom) {
        return NextResponse.json({ success: true, message: 'Already in room' });
      }

      // Leave any existing room first
      const existing = await prisma.roomParticipant.findFirst({ where: { userId: user.id } });
      if (existing) {
        await studyRoomRepo.leaveRoom(user.id);
        if (existing.studyRoomId) {
          await studyRoomRepo.decrementOnlineCount(existing.studyRoomId);
        }
      }

      // Join the new room
      await studyRoomRepo.joinRoom(user.id, cleanRoomId);
      await studyRoomRepo.incrementOnlineCount(cleanRoomId);

      return NextResponse.json({ success: true });
    } else if (cleanAction === 'leave') {
      const existing = await prisma.roomParticipant.findFirst({ where: { userId: user.id } });
      if (existing) {
        await studyRoomRepo.leaveRoom(user.id);
        if (existing.studyRoomId) {
          await studyRoomRepo.decrementOnlineCount(existing.studyRoomId);
        }
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: 'Not in a room' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Study room operation failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
