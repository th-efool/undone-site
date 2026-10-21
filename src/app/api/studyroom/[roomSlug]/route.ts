import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { roomManagementService } from '@/src/server/domain/studyroom/room-management.service';
import { StudyRoomError } from '@/src/shared/studyroom/contracts';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomSlug: string }> }
) {
  try {
    const user = await getUser();
    const { roomSlug } = await params;

    const bootstrap = await roomManagementService.getRoomBootstrap(roomSlug, user?.id || null);

    return NextResponse.json(bootstrap, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof StudyRoomError) {
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    console.error('Failed to get room bootstrap:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomSlug: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'ROOM_UNAUTHORIZED' }, { status: 401 });
    }

    const { roomSlug } = await params;
    const body = await req.json().catch(() => ({}));

    const result = await roomManagementService.updateRoomSettings(roomSlug, body, user.id);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof StudyRoomError) {
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    console.error('Failed to update room settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
