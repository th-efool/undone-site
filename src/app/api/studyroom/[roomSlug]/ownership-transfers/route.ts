import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { sprintService } from '@/src/server/domain/studyroom/sprint.service';
import { roomGovernanceService } from '@/src/server/domain/studyroom/room-governance.service';
import { StudyRoomError, RoomValidationError } from '@/src/shared/studyroom/contracts';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomSlug: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'ROOM_UNAUTHORIZED' }, { status: 401 });
    }

    const { roomSlug } = await params;
    const room = await sprintService.resolveRoom(roomSlug);
    if (!room) {
      return NextResponse.json({ error: 'Study room not found', code: 'ROOM_NOT_FOUND' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    if (!body.recipientUserId || typeof body.recipientUserId !== 'string') {
      throw new RoomValidationError('recipientUserId is required');
    }
    if (typeof body.expectedRevision !== 'number') {
      throw new RoomValidationError('expectedRevision must be a number');
    }

    const transfer = await roomGovernanceService.proposeOwnershipTransfer(
      room.id,
      body.recipientUserId,
      body.expectedRevision,
      user.id
    );

    return NextResponse.json({ transfer }, { status: 201 });
  } catch (error) {
    if (error instanceof StudyRoomError) {
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    console.error('Failed to propose ownership transfer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
