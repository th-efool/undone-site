import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { roomManagementService } from '@/src/server/domain/studyroom/room-management.service';
import { StudyRoomError } from '@/src/shared/studyroom/contracts';

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
    const body = await req.json().catch(() => ({}));

    const result = await roomManagementService.transitionLifecycle(roomSlug, body, user.id);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof StudyRoomError) {
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    console.error('Failed to transition room lifecycle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
