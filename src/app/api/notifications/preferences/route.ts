import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { notificationService } from '@/src/server/domain/notifications/notification.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json({
        userId: user.id,
        emailNotifications: false,
        pushNotifications: false,
        mentionOnly: false,
        mutedScopes: [],
      });
    }

    const prefs = await notificationService.getPreferences(user.id);
    return NextResponse.json(prefs, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to get notification preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json({ error: 'Guest accounts cannot modify notification preferences' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const updated = await notificationService.updatePreferences(user.id, body);

    return NextResponse.json(updated, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to update notification preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
