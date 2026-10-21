import { NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { roomManagementService } from '@/src/server/domain/studyroom/room-management.service';
import { StudyRoomError } from '@/src/shared/studyroom/contracts';

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'ROOM_UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const result = await roomManagementService.createRoom(body, user.id);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof StudyRoomError) {
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    console.error('Failed to create room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
