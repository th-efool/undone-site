import { NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { studyRoomRepo } from '@/src/server/infrastructure/db/postgres/repositories/studyRoom.repo';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { roomDiscoveryService } from '@/src/server/domain/studyroom/room-discovery.service';
import { studyRoomService } from '@/src/server/domain/studyroom/studyroom.service';
import { type DiscoveryTab, StudyRoomError } from '@/src/shared/studyroom/contracts';
import { studyRoomCache } from './cache';

export async function GET(req: Request): Promise<Response>;
export async function GET(): Promise<Response>;
export async function GET(req?: Request): Promise<Response> {
  try {
    // 0. Check for Phase 3 Query-backed Discovery
    if (req) {
      const url = new URL(req.url, 'http://localhost');
      const hasDiscoveryQuery =
        url.searchParams.has('tab') ||
        url.searchParams.has('query') ||
        url.searchParams.has('tag') ||
        url.searchParams.has('cohortId') ||
        url.searchParams.has('cursor') ||
        url.searchParams.has('availableOnly') ||
        url.searchParams.get('format') === 'v2';

      if (hasDiscoveryQuery) {
        const user = await getUser();
        const tab = (url.searchParams.get('tab') || 'discover') as DiscoveryTab;
        const queryText = url.searchParams.get('query') || undefined;
        const cohortId = url.searchParams.get('cohortId') || undefined;
        const tag = url.searchParams.get('tag') || undefined;
        const language = url.searchParams.get('language') || undefined;
        const availableOnly = url.searchParams.get('availableOnly') === 'true';
        const cursor = url.searchParams.get('cursor') || undefined;
        const limitParam = url.searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam, 10) : 12;

        const discoveryResult = await roomDiscoveryService.discoverRooms(
          {
            tab,
            query: queryText,
            cohortId,
            tag,
            language,
            availableOnly,
            cursor,
            limit,
          },
          user?.id ?? null
        );

        return Response.json(discoveryResult, {
          headers: {
            'Cache-Control': 'private, no-cache',
          },
        });
      }
    }

    const ifNoneMatch = req?.headers?.get('if-none-match');

    // 1. In-memory 5-second micro-cache check
    if (Date.now() < studyRoomCache.cachedRoomsExpiresAt && studyRoomCache.cachedRooms !== null) {
      const cacheHeaders = {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
        ETag: studyRoomCache.cachedRoomsEtag,
      };

      if (ifNoneMatch && ifNoneMatch === studyRoomCache.cachedRoomsEtag) {
        return new Response(null, {
          status: 304,
          headers: cacheHeaders,
        });
      }

      return Response.json(studyRoomCache.cachedRooms, {
        headers: cacheHeaders,
      });
    }

    // 2. Cache miss: check and seed rooms once per worker lifecycle
    if (!studyRoomCache.roomsSeeded) {
      const roomCount = await prisma.studyRoom.count();
      if (roomCount === 0) {
        await studyRoomRepo.seedRooms();
      }
      studyRoomCache.roomsSeeded = true;
    }

    // Fetch public standalone rooms only (prevent leaking unlisted or private cohort rooms into public cache)
    const rooms = await prisma.studyRoom.findMany({
      where: {
        listing: 'PUBLIC',
        cohortId: null,
      },
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
      .map((r) => `${r.id}:${r.onlineCount}:${(r.participants ?? []).map((p) => p.userId).join(',')}`)
      .join('|');
    const etag = 'W/"' + Buffer.from(etagPayload).toString('base64').slice(0, 24) + '"';

    studyRoomCache.cachedRooms = rooms ?? [];
    studyRoomCache.cachedRoomsExpiresAt = Date.now() + 5000;
    studyRoomCache.cachedRoomsEtag = etag;

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

    return Response.json(studyRoomCache.cachedRooms, {
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

      if (body.tabId) {
        try {
          const joinResult = await studyRoomService.joinRoom({
            userId,
            roomId: cleanRoomId,
            tabId: body.tabId,
            requestId: body.requestId,
          });

          studyRoomCache.cachedRooms = null;
          studyRoomCache.cachedRoomsExpiresAt = 0;
          studyRoomCache.cachedRoomsEtag = '';

          return NextResponse.json(joinResult);
        } catch (err: unknown) {
          if (err instanceof StudyRoomError) {
            return NextResponse.json(err.toJSON(), { status: err.status });
          }
          return NextResponse.json({ error: (err as Error).message || 'Failed to join room' }, { status: 400 });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const targetRoom = await tx.studyRoom.findUnique({
          where: { id: cleanRoomId },
        });
        if (!targetRoom) {
          return { error: 'Room not found', status: 404 };
        }

        // Authoritative eligibility check: closed/draft rooms reject joiners
        if (targetRoom.status && !['active', 'open'].includes(targetRoom.status.toLowerCase())) {
          return { error: 'Room is closed', status: 403 };
        }

        // Restriction check (kicks and bans)
        if (tx.roomRestriction?.findUnique) {
          const restriction = await tx.roomRestriction.findUnique({
            where: {
              studyRoomId_userId: {
                studyRoomId: cleanRoomId,
                userId,
              },
            },
          });
          if (restriction && restriction.action === 'BAN' && (!restriction.expiresAt || restriction.expiresAt > new Date())) {
            return { error: 'User is restricted from this room', status: 403 };
          }
        }

        // Cohort enrollment check
        if (targetRoom.cohortId && tx.cohortMember?.findUnique) {
          const membership = await tx.cohortMember.findUnique({
            where: {
              cohortId_userId: {
                cohortId: targetRoom.cohortId,
                userId,
              },
            },
          });
          if (!membership) {
            return { error: 'Cohort enrollment required', status: 403 };
          }
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
      studyRoomCache.cachedRooms = null;
      studyRoomCache.cachedRoomsExpiresAt = 0;
      studyRoomCache.cachedRoomsEtag = '';

      return NextResponse.json(result);
    } else if (cleanAction === 'renew') {
      const { generation, tabId } = body;
      if (typeof generation !== 'number' || !tabId || !cleanRoomId) {
        return NextResponse.json({ error: 'tabId, roomId, and generation are required for renewal' }, { status: 400 });
      }

      const renewResult = await studyRoomService.renewLease({
        userId,
        roomId: cleanRoomId,
        tabId,
        generation,
      });

      if (!renewResult.success) {
        return NextResponse.json(renewResult, { status: 409 });
      }

      return NextResponse.json(renewResult);
    } else if (cleanAction === 'leave') {
      if (body.tabId) {
        const leaveResult = await studyRoomService.leaveRoom({
          userId,
          roomId: cleanRoomId || undefined,
          tabId: body.tabId,
          global: body.global === true,
        });

        studyRoomCache.cachedRooms = null;
        studyRoomCache.cachedRoomsExpiresAt = 0;
        studyRoomCache.cachedRoomsEtag = '';

        return NextResponse.json(leaveResult);
      }

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
      studyRoomCache.cachedRooms = null;
      studyRoomCache.cachedRoomsExpiresAt = 0;
      studyRoomCache.cachedRoomsEtag = '';

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Study room operation failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
