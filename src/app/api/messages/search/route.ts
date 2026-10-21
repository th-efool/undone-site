import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { searchService } from '@/src/server/domain/messaging/search.service';
import {
  MessagingForbiddenError,
  MessagingNotFoundError,
} from '@/src/server/domain/messaging/contracts';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(
        { messages: [], nextCursor: null },
        { status: 200, headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const channelId = searchParams.get('channelId') || undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 20;
    const cursor = searchParams.get('cursor') || undefined;

    const result = await searchService.searchMessages({
      userId: user.id,
      query,
      channelId,
      limit,
      cursor,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof MessagingForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof MessagingNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('Message search failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
