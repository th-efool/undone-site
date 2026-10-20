import { NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { studyRoomRepo } from '@/src/server/infrastructure/db/postgres/repositories/studyRoom.repo';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

let roomsSeeded = false;
let cachedRooms: any[] | null = null;
let cachedRoomsExpiresAt = 0;
let cachedRoomsEtag = '';

export function resetRoomsSeededForTest(): void {
  roomsSeeded = false;
}

export function clearStudyRoomCacheForTest(): void {
  cachedRooms = null;
  cachedRoomsExpiresAt = 0;
  cachedRoomsEtag = '';
}

export async function GET(req: Request = new Request('http://localhost/api/studyroom')) {
  try {
    const ifNoneMatch = req?.headers?.get('if-none-match');

    // 1. In-memory 5-second micro-cache check
    if (Date.now() < cachedRoomsExpiresAt && cachedRooms !== null) {
      const cacheHeaders = {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
        ETag: cachedRoomsEtag,
      };

      if (ifNoneMatch && ifNoneMatch === cachedRoomsEtag) {
        return new Response(null, {
          status: 304,
          headers: cacheHeaders,
        });
      }

      return Response.json(cachedRooms, {
        headers: cacheHeaders,
      });
    }

    // 2. Cache miss: check and seed rooms once per worker lifecycle
    if (!roomsSeeded) {
      const roomCount = await prisma.studyRoom.count();
      if (roomCount === 0) {
        await studyRoomRepo.seedRooms();
      }
      roomsSeeded = true;
    }

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

    const etagPayload = (rooms ?? [])
      .map((r: any) => `${r.id}:${r.onlineCount}:${(r.participants ?? []).map((p: any) => p.userId).join(',')}`)
      .join('|');
    const etag = 'W/"' + Buffer.from(etagPayload).toString('base64').slice(0, 24) + '"';

    cachedRooms = rooms ?? [];
    cachedRoomsExpiresAt = Date.now() + 5000;
    cachedRoomsEtag = etag;

    const responseHeaders = {
      'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
      ETag: etag,
    };

    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: responseHeaders,
      });
    }

    return Response.json(cachedRooms, {
      headers: responseHeaders,
    });
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

    const userId = user.id;
    const body = await req.json().catch(() => ({}));
    const { action, roomId } = body ?? {};

    const cleanAction = typeof action === 'string' ? action.trim().toLowerCase() : '';
    const cleanRoomId = typeof roomId === 'string' ? roomId.trim() : '';

    if (cleanAction === 'join') {
      if (!cleanRoomId) {
        return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const targetRoom = await tx.studyRoom.findUnique({
          where: { id: cleanRoomId },
        });
        if (!targetRoom) {
          return { error: 'Room not found', status: 404 };
        }

        const prev = await tx.roomParticipant.findFirst({
          where: { userId },
        });

        // User is already in this exact room
        if (prev?.studyRoomId === cleanRoomId) {
          return { success: true, message: 'Already in room' };
        }

        // Leave any previous room
        if (prev) {
          await tx.roomParticipant.delete({
            where: { id: prev.id },
          });
          if (prev.studyRoomId) {
            await tx.studyRoom.update({
              where: { id: prev.studyRoomId },
              data: { onlineCount: { decrement: 1 } },
            });
          }
        }

        // Join the new room
        await tx.roomParticipant.create({
          data: {
            userId,
            studyRoomId: cleanRoomId,
          },
        });
        await tx.studyRoom.update({
          where: { id: cleanRoomId },
          data: { onlineCount: { increment: 1 } },
        });

        return { success: true };
      });

      if ('error' in result && result.error) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      // Invalidate micro-cache on room state update (join)
      cachedRooms = null;
      cachedRoomsExpiresAt = 0;
      cachedRoomsEtag = '';

      return NextResponse.json(result);
    } else if (cleanAction === 'leave') {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.roomParticipant.findFirst({
          where: { userId },
        });
        if (!existing) {
          return { error: 'Not in a room', status: 400 };
        }

        await tx.roomParticipant.delete({
          where: { id: existing.id },
        });
        if (existing.studyRoomId) {
          await tx.studyRoom.update({
            where: { id: existing.studyRoomId },
            data: { onlineCount: { decrement: 1 } },
          });
        }

        return { success: true };
      });

      if ('error' in result && result.error) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      // Invalidate micro-cache on room state update (leave)
      cachedRooms = null;
      cachedRoomsExpiresAt = 0;
      cachedRoomsEtag = '';

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Study room operation failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
