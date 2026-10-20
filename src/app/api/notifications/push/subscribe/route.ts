import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { notificationService } from '@/src/server/domain/notifications/notification.service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json({ error: 'Guest accounts cannot register push subscriptions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { endpoint, p256dh, auth, userAgent } = body ?? {};

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'endpoint, p256dh, and auth keys are required' }, { status: 400 });
    }

    await notificationService.subscribePush({
      userId: user.id,
      endpoint,
      p256dh,
      auth,
      userAgent: userAgent || req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ success: true }, {
      status: 201,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to register push subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint parameter is required' }, { status: 400 });
    }

    const success = await notificationService.unsubscribePush(user.id, endpoint);
    return NextResponse.json({ success }, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to delete push subscription:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
