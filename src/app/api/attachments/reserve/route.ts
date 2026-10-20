import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { attachmentService } from '@/src/server/domain/attachments/attachment.service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot upload attachments' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { channelId, filename, mediaType, byteLength } = body ?? {};

    if (!channelId || !filename || !mediaType || typeof byteLength !== 'number') {
      return NextResponse.json(
        { error: 'channelId, filename, mediaType, and byteLength are required' },
        { status: 400 }
      );
    }

    const reservation = await attachmentService.reserveUpload({
      userId: user.id,
      channelId,
      filename,
      mediaType,
      byteLength,
    });

    return NextResponse.json(reservation, {
      status: 201,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error: any) {
    console.error('Failed to reserve attachment upload:', error);
    const status =
      error.name === 'MessagingForbiddenError'
        ? 403
        : error.name === 'MessagingNotFoundError'
        ? 404
        : 400;
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status });
  }
}
