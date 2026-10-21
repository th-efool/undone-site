import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { moderationService } from '@/src/server/domain/messaging/moderation.service';
import {
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from '@/src/server/domain/messaging/contracts';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json({ error: 'Forbidden for guest accounts' }, { status: 403 });
    }

    const { messageId } = await params;
    const body = await req.json().catch(() => ({}));
    const { isAnnouncement = true, reason } = body;

    const result = await moderationService.setAnnouncementState({
      userId: user.id,
      messageId,
      isAnnouncement: Boolean(isAnnouncement),
      reason,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof MessagingValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof MessagingForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof MessagingNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('Failed to set announcement state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
