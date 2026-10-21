import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { sprintService } from '@/src/server/domain/studyroom/sprint.service';
import { environmentService } from '@/src/server/domain/studyroom/environment.service';
import { rateLimiterService } from '@/src/server/domain/messaging/rate-limiter.service';
import { studyRoomMetricsService } from '@/src/server/domain/studyroom/studyroom-metrics.service';
import { validateMutationOrigin, parseJsonWithLimit } from '@/src/app/api/studyroom/security';
import {
  MessagingConflictError,
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from '@/src/server/domain/messaging/contracts';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomSlug: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json({ error: 'Forbidden for guest accounts' }, { status: 403 });
    }

    const { roomSlug } = await params;
    const room = await sprintService.resolveRoom(roomSlug);
    if (!room) {
      return NextResponse.json({ error: 'Study room not found' }, { status: 404 });
    }

    const env = await environmentService.getRoomEnvironment(room.id);
    return NextResponse.json(env, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to get room environment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ roomSlug: string }> }
) {
  try {
    const originCheck = validateMutationOrigin(req);
    if (!originCheck.valid) {
      return originCheck.errorResponse!;
    }

    const user = await getUser();
    if (!user?.id) {
      studyRoomMetricsService.recordAuthorizationFailure('unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      studyRoomMetricsService.recordAuthorizationFailure('guest_restricted');
      return NextResponse.json({ error: 'Forbidden for guest accounts' }, { status: 403 });
    }

    const { roomSlug } = await params;

    const rateLimit = await rateLimiterService.checkRoomControlRateLimit(user.id, roomSlug);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many environment updates. Please wait.', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: rateLimiterService.createHeaders(rateLimit) }
      );
    }

    const room = await sprintService.resolveRoom(roomSlug);
    if (!room) {
      return NextResponse.json({ error: 'Study room not found' }, { status: 404 });
    }

    const bodyParsed = await parseJsonWithLimit<Record<string, unknown>>(req);
    if (bodyParsed.errorResponse) {
      return bodyParsed.errorResponse;
    }
    const body = bodyParsed.data ?? {};
    const { sceneId, soundscapeId, musicPresetId, musicStreamUrl, expectedRevision } = body;

    const env = await environmentService.updateRoomEnvironment({
      userId: user.id,
      roomId: room.id,
      sceneId: typeof sceneId === 'string' ? sceneId : undefined,
      soundscapeId: typeof soundscapeId === 'string' ? soundscapeId : undefined,
      musicPresetId: typeof musicPresetId === 'string' ? musicPresetId : undefined,
      musicStreamUrl: typeof musicStreamUrl === 'string' ? musicStreamUrl : undefined,
      expectedRevision: expectedRevision !== undefined ? Number(expectedRevision) : undefined,
    });

    return NextResponse.json(env, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof MessagingValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof MessagingForbiddenError) {
      studyRoomMetricsService.recordAuthorizationFailure('forbidden');
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof MessagingNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof MessagingConflictError) {
      studyRoomMetricsService.recordVersionConflict('environment');
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Failed to update room environment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
