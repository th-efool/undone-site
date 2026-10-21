import { NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { notificationService } from '@/src/server/domain/notifications/notification.service';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json({ count: 0 });
    }

    const count = await notificationService.markAllRead(user.id);
    return NextResponse.json({ count }, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to mark all notifications read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
