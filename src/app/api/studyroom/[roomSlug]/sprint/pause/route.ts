import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { sprintService } from '@/src/server/domain/studyroom/sprint.service';
import {
  MessagingConflictError,
  MessagingForbiddenError,
  MessagingNotFoundError,
} from '@/src/server/domain/messaging/contracts';

export const dynamic = 'force-dynamic';

export async function POST(
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
    const { sprintId, expectedRevision } = body;

    if (!sprintId || expectedRevision === undefined) {
      return NextResponse.json(
        { error: 'sprintId and expectedRevision are required' },
        { status: 400 }
      );
    }

    const sprint = await sprintService.pauseSprint({
      userId: user.id,
      sprintId,
      expectedRevision: Number(expectedRevision),
    });

    return NextResponse.json(sprint, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof MessagingForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof MessagingNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof MessagingConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Failed to pause sprint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
