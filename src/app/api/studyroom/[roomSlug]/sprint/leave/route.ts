import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { sprintService } from '@/src/server/domain/studyroom/sprint.service';

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
    let sprintId = body.sprintId;

    if (!sprintId) {
      const current = await sprintService.getCurrentRoomSprint(room.id);
      if (!current) {
        return NextResponse.json({ success: true });
      }
      sprintId = current.id;
    }

    const result = await sprintService.leaveSprint(user.id, sprintId);
    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to leave sprint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
