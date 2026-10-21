import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { conversationService } from '@/src/server/domain/messaging/conversation.service';

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
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const people = await conversationService.searchPeople(user.id, query, limit);

    return NextResponse.json(people, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to search people:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
