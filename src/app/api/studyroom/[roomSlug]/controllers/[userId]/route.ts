import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { sprintService } from '@/src/server/domain/studyroom/sprint.service';
import { roomGovernanceService } from '@/src/server/domain/studyroom/room-governance.service';
import { StudyRoomError, type DelegatedRoomRole } from '@/src/shared/studyroom/contracts';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ roomSlug: string; userId: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'ROOM_UNAUTHORIZED' }, { status: 401 });
    }

    const { roomSlug, userId: targetUserId } = await params;
    const room = await sprintService.resolveRoom(roomSlug);
    if (!room) {
      return NextResponse.json({ error: 'Study room not found', code: 'ROOM_NOT_FOUND' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const role = (body.role || 'MODERATOR') as DelegatedRoomRole;

    await roomGovernanceService.setController(room.id, targetUserId, role, user.id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof StudyRoomError) {
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    console.error('Failed to set room controller:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roomSlug: string; userId: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'ROOM_UNAUTHORIZED' }, { status: 401 });
    }

    const { roomSlug, userId: targetUserId } = await params;
    const room = await sprintService.resolveRoom(roomSlug);
    if (!room) {
      return NextResponse.json({ error: 'Study room not found', code: 'ROOM_NOT_FOUND' }, { status: 404 });
    }

    await roomGovernanceService.revokeController(room.id, targetUserId, user.id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof StudyRoomError) {
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    console.error('Failed to revoke room controller:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
