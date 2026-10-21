import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { presenceService } from '@/src/server/domain/messaging/presence.service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot send typing signals' },
        { status: 403 }
      );
    }

    const { channelId } = await params;
    const body = await req.json().catch(() => ({}));
    const isTyping = typeof body?.isTyping === 'boolean' ? body.isTyping : true;

    const result = await presenceService.handleTypingSignal(user.id, channelId, isTyping);

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error: any) {
    console.error('Failed to send typing signal:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.name === 'MessagingForbiddenError' ? 403 : 400 }
    );
  }
}
