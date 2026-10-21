import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { studyRoomService } from '@/src/server/domain/studyroom/studyroom.service';
import { rateLimiterService } from '@/src/server/domain/messaging/rate-limiter.service';
import { studyRoomMetricsService } from '@/src/server/domain/studyroom/studyroom-metrics.service';
import { StudyRoomError } from '@/src/shared/studyroom/contracts';
import { validateMutationOrigin, parseJsonWithLimit, validateBoundedString } from '@/src/app/api/studyroom/security';

export const dynamic = 'force-dynamic';

export async function PATCH(
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
      return NextResponse.json(
        { error: 'Unauthorized', code: 'ROOM_UNAUTHORIZED' },
        { status: 401, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    if (isSharedGuestAccount(user)) {
      studyRoomMetricsService.recordAuthorizationFailure('guest_restricted');
      return NextResponse.json(
        { error: 'Guest accounts cannot publish public status', code: 'GUEST_RESTRICTED' },
        { status: 403, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    const { roomSlug } = await params;
    const bodyParsed = await parseJsonWithLimit<{
      tabId?: string;
      generation?: number;
      publicGoal?: string | null;
    }>(req);

    if (bodyParsed.errorResponse) {
      return bodyParsed.errorResponse;
    }

    const body = bodyParsed.data ?? {};
    const { tabId, generation, publicGoal } = body;

    if (!tabId || typeof generation !== 'number') {
      return NextResponse.json(
        { error: 'tabId and generation are required to publish status', code: 'INVALID_INPUT' },
        { status: 400, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    const goalCheck = validateBoundedString(publicGoal, 'publicGoal', 280, false);
    if (!goalCheck.valid) {
      return goalCheck.errorResponse!;
    }

    const rateLimit = await rateLimiterService.checkRoomGoalRateLimit(user.id, roomSlug);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many status updates. Please wait.', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: { ...rateLimiterService.createHeaders(rateLimit), 'Cache-Control': 'private, no-store' } }
      );
    }

    const result = await studyRoomService.updateParticipantGoal({
      userId: user.id,
      roomId: roomSlug,
      tabId,
      generation,
      publicGoal: goalCheck.value || null,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof StudyRoomError) {
      return NextResponse.json(error.toJSON(), {
        status: error.status,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    console.error('Failed to update participant status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
