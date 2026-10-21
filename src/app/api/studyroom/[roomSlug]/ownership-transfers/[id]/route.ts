import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { sprintService } from '@/src/server/domain/studyroom/sprint.service';
import { roomGovernanceService } from '@/src/server/domain/studyroom/room-governance.service';
import { StudyRoomError } from '@/src/shared/studyroom/contracts';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ roomSlug: string; id: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'ROOM_UNAUTHORIZED' }, { status: 401 });
    }

    const { roomSlug, id: transferId } = await params;
    const room = await sprintService.resolveRoom(roomSlug);
    if (!room) {
      return NextResponse.json({ error: 'Study room not found', code: 'ROOM_NOT_FOUND' }, { status: 404 });
    }

    await roomGovernanceService.cancelOwnershipTransfer(room.id, transferId, user.id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof StudyRoomError) {
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    console.error('Failed to cancel ownership transfer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
