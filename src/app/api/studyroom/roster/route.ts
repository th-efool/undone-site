import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { studyRoomService } from '@/src/server/domain/studyroom/studyroom.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json([], {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ error: 'roomId query parameter is required' }, { status: 400 });
    }

    const roster = await studyRoomService.getRoomRoster(roomId, user.id);
    return NextResponse.json(roster, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to get room roster:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
