import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { sprintService } from '@/src/server/domain/studyroom/sprint.service';
import { roomGovernanceService } from '@/src/server/domain/studyroom/room-governance.service';
import { StudyRoomError, RoomValidationError } from '@/src/shared/studyroom/contracts';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
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

    const restrictions = await roomGovernanceService.getRestrictions(room.id, user.id);

    return NextResponse.json({ restrictions }, { status: 200 });
  } catch (error) {
    if (error instanceof StudyRoomError) {
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    console.error('Failed to get restrictions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    if (!body.userId || typeof body.userId !== 'string') {
      throw new RoomValidationError('Target userId is required');
    }

    const reason = typeof body.reason === 'string' ? body.reason : undefined;
    const durationMinutes = typeof body.durationMinutes === 'number' ? body.durationMinutes : undefined;

    await roomGovernanceService.banParticipant(room.id, body.userId, reason, durationMinutes, user.id);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof StudyRoomError) {
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    console.error('Failed to ban participant:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
