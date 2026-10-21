import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { conversationService } from '@/src/server/domain/messaging/conversation.service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot report messages' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { messageId, reason } = body || {};

    if (!messageId || typeof messageId !== 'string') {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }

    const result = await conversationService.reportMessage(user.id, messageId, reason);

    return NextResponse.json(result, {
      status: 201,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error: any) {
    console.error('Failed to report message:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    );
  }
}
