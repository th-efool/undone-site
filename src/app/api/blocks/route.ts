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
        { error: 'Guest accounts cannot block users' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { blockedId } = body || {};

    if (!blockedId || typeof blockedId !== 'string') {
      return NextResponse.json({ error: 'blockedId is required' }, { status: 400 });
    }

    const result = await conversationService.blockUser(user.id, blockedId);

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error: any) {
    console.error('Failed to block user:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot unblock users' },
        { status: 403 }
      );
    }

    let blockedId: string | null = null;
    const { searchParams } = new URL(req.url);
    blockedId = searchParams.get('blockedId');

    if (!blockedId) {
      try {
        const body = await req.json();
        blockedId = body?.blockedId ?? null;
      } catch {
        // Ignored if JSON parsing fails
      }
    }

    if (!blockedId || typeof blockedId !== 'string') {
      return NextResponse.json({ error: 'blockedId is required' }, { status: 400 });
    }

    const result = await conversationService.unblockUser(user.id, blockedId);

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error: any) {
    console.error('Failed to unblock user:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 400 }
    );
  }
}
