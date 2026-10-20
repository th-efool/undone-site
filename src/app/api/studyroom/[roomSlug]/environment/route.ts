import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { sprintService } from '@/src/server/domain/studyroom/sprint.service';
import { environmentService } from '@/src/server/domain/studyroom/environment.service';
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

    const body = await req.json().catch(() => ({}));
    const { sceneId, soundscapeId, musicPresetId, musicStreamUrl, expectedRevision } = body;

    const env = await environmentService.updateRoomEnvironment({
      userId: user.id,
      roomId: room.id,
      sceneId,
      soundscapeId,
      musicPresetId,
      musicStreamUrl,
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
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof MessagingNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof MessagingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Failed to update room environment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
