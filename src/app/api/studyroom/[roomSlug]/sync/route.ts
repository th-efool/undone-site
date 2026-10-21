import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { studyRoomService } from '@/src/server/domain/studyroom/studyroom.service';
import { StudyRoomError } from '@/src/shared/studyroom/contracts';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomSlug: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'ROOM_UNAUTHORIZED' }, { status: 401 });
    }

    const { roomSlug } = await params;
    const url = new URL(req.url);
    const seqParam = url.searchParams.get('clientSequence');
    const clientSequence = seqParam !== null ? parseInt(seqParam, 10) : undefined;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam !== null ? parseInt(limitParam, 10) : undefined;

    const result = await studyRoomService.syncRoomEvents({
      roomIdOrSlug: roomSlug,
      userId: user.id,
      clientSequence: isNaN(clientSequence as number) ? undefined : clientSequence,
      limit: isNaN(limit as number) ? undefined : limit,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof StudyRoomError) {
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    console.error('Failed to sync room events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
