import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { notificationService } from '@/src/server/domain/notifications/notification.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json({ notifications: [], unreadCount: 0 }, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit')) || 50;

    const result = await notificationService.getUserNotifications(user.id, limit);
    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to get notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
