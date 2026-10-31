import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { studyRoomRepo } from '@/src/server/infrastructure/db/postgres/repositories/studyRoom.repo';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { roomDiscoveryService } from '@/src/server/domain/studyroom/room-discovery.service';
import { studyRoomService } from '@/src/server/domain/studyroom/studyroom.service';
import { type DiscoveryTab, StudyRoomError } from '@/src/shared/studyroom/contracts';
import { studyRoomCache } from './cache';
import { rateLimiterService } from '@/src/server/domain/messaging/rate-limiter.service';
import { studyRoomMetricsService } from '@/src/server/domain/studyroom/studyroom-metrics.service';
import { validateMutationOrigin, parseJsonWithLimit, validateBoundedString } from './security';

export async function GET(req: Request): Promise<Response>;
export async function GET(): Promise<Response>;
export async function GET(req?: Request): Promise<Response> {
  try {
    const ifNoneMatch = req?.headers?.get('if-none-match');

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

        const etag = `W/"${createHash('sha256')
          .update(JSON.stringify(discoveryResult))
          .digest('hex')}"`;
        const discoveryHeaders = {
          'Cache-Control': 'private, no-cache',
          ETag: etag,
        };

        if (ifNoneMatch && ifNoneMatch === etag) {
          return new Response(null, {
            status: 304,
            headers: discoveryHeaders,
          });
        }

        return Response.json(discoveryResult, {
          headers: discoveryHeaders,
        });
      }
    }

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
          select: {
            id: true,
            userId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const payload = rooms ?? [];
    const etag = `W/"${createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')}"`;

    studyRoomCache.cachedRooms = payload;
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
    const originCheck = validateMutationOrigin(req);
    if (!originCheck.valid) {
      return originCheck.errorResponse!;
    }

    const bodyParsed = await parseJsonWithLimit<Record<string, unknown>>(req);
    if (bodyParsed.errorResponse) {
      return bodyParsed.errorResponse;
    }
    const body = bodyParsed.data ?? {};

    const user = await getUser();
    if (!user || !user.id) {
      studyRoomMetricsService.recordAuthorizationFailure('unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      studyRoomMetricsService.recordAuthorizationFailure('guest_restricted');
      return NextResponse.json(
        { error: 'Guest accounts cannot join or manage study rooms', code: 'GUEST_RESTRICTED' },
        { status: 403 }
      );
    }

    const userId = user.id;
    const { action, roomId } = body ?? {};

    const cleanAction = typeof action === 'string' ? action.trim().toLowerCase() : '';
    const cleanRoomId = typeof roomId === 'string' ? roomId.trim() : '';

    if (cleanAction === 'join') {
      if (!cleanRoomId) {
        return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
      }

      const roomCheck = validateBoundedString(cleanRoomId, 'roomId', 128);
      if (!roomCheck.valid) return roomCheck.errorResponse!;

      const tabCheck = validateBoundedString(body.tabId, 'tabId', 128, false);
      if (!tabCheck.valid) return tabCheck.errorResponse!;

      const reqCheck = validateBoundedString(body.requestId, 'requestId', 128, false);
      if (!reqCheck.valid) return reqCheck.errorResponse!;

      const goalCheck = validateBoundedString(body.publicGoal, 'publicGoal', 280, false);
      if (!goalCheck.valid) return goalCheck.errorResponse!;

      const rateLimit = await rateLimiterService.checkRoomJoinRateLimit(userId);
      if (!rateLimit.allowed) {
        studyRoomMetricsService.recordRenewalFailure('rate_limited');
        return NextResponse.json(
          { error: 'Too many join attempts. Please wait.', code: 'RATE_LIMIT_EXCEEDED' },
          { status: 429, headers: rateLimiterService.createHeaders(rateLimit) }
        );
      }

      try {
        const startJoin = Date.now();
        const joinResult = await studyRoomService.joinRoom({
          userId,
          roomId: cleanRoomId,
          tabId: body.tabId as string | undefined,
          requestId: body.requestId as string | undefined,
          publicGoal: body.publicGoal as string | undefined,
        });
        studyRoomMetricsService.recordJoinLatency(Date.now() - startJoin);

        studyRoomCache.cachedRooms = null;
        studyRoomCache.cachedRoomsExpiresAt = 0;
        studyRoomCache.cachedRoomsEtag = '';

        return NextResponse.json(joinResult);
      } catch (err: unknown) {
        if (err instanceof StudyRoomError) {
          return NextResponse.json(err.toJSON(), { status: err.status });
        }
        throw err;
      }
    } else if (cleanAction === 'update_goal') {
      const { generation, tabId, publicGoal } = body;
      if (typeof generation !== 'number' || !tabId || !cleanRoomId) {
        return NextResponse.json(
          { error: 'tabId, roomId, and generation are required for goal update' },
          { status: 400 }
        );
      }

      const goalCheck = validateBoundedString(publicGoal, 'publicGoal', 280, false);
      if (!goalCheck.valid) return goalCheck.errorResponse!;

      const rateLimit = await rateLimiterService.checkRoomGoalRateLimit(userId, cleanRoomId);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: 'Too many goal update attempts. Please wait.', code: 'RATE_LIMIT_EXCEEDED' },
          { status: 429, headers: rateLimiterService.createHeaders(rateLimit) }
        );
      }

      try {
        const goalResult = await studyRoomService.updateParticipantGoal({
          userId,
          roomId: cleanRoomId,
          tabId: String(tabId),
          generation,
          publicGoal: publicGoal as string | null | undefined,
        });
        return NextResponse.json(goalResult);
      } catch (err: unknown) {
        if (err instanceof StudyRoomError) {
          return NextResponse.json(err.toJSON(), { status: err.status });
        }
        throw err;
      }
    } else if (cleanAction === 'renew' || cleanAction === 'renew_lease') {
      const { generation, tabId } = body;
      if (typeof generation !== 'number' || !tabId || !cleanRoomId) {
        return NextResponse.json({ error: 'tabId, roomId, and generation are required for renewal' }, { status: 400 });
      }

      const rateLimit = await rateLimiterService.checkRoomRenewRateLimit(userId, String(tabId));
      if (!rateLimit.allowed) {
        studyRoomMetricsService.recordRenewalFailure('rate_limited');
        return NextResponse.json(
          { error: 'Too many renewal attempts. Please wait.', code: 'RATE_LIMIT_EXCEEDED' },
          { status: 429, headers: rateLimiterService.createHeaders(rateLimit) }
        );
      }

      const renewResult = await studyRoomService.renewLease({
        userId,
        roomId: cleanRoomId,
        tabId: String(tabId),
        generation,
      });

      if (!renewResult.success) {
        studyRoomMetricsService.recordRenewalFailure('stale_generation');
        return NextResponse.json(renewResult, { status: 409 });
      }

      return NextResponse.json(renewResult);
    } else if (cleanAction === 'leave') {
      try {
        const leaveResult = await studyRoomService.leaveRoom({
          userId,
          roomId: cleanRoomId || undefined,
          tabId: body.tabId as string | undefined,
          generation: typeof body.generation === 'number' ? body.generation : undefined,
          global: body.global === true || !body.tabId,
        });

        studyRoomCache.cachedRooms = null;
        studyRoomCache.cachedRoomsExpiresAt = 0;
        studyRoomCache.cachedRoomsEtag = '';

        return NextResponse.json(leaveResult);
      } catch (err: unknown) {
        if (err instanceof StudyRoomError) {
          return NextResponse.json(err.toJSON(), { status: err.status });
        }
        throw err;
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Study room operation failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
