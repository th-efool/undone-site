import { NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { tokenService } from '@/src/server/infrastructure/realtime/token.service';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot obtain real-time connection tokens' },
        { status: 403 }
      );
    }

    // Check account restrictions
    const restriction = await prisma.userRestriction.findUnique({
      where: { userId: user.id },
      select: { expiresAt: true },
    });

    if (restriction && (!restriction.expiresAt || restriction.expiresAt > new Date())) {
      return NextResponse.json(
        { error: 'Real-time privileges are restricted for this account' },
        { status: 403 }
      );
    }

    const tokenData = await tokenService.createConnectionToken(user.id);

    return NextResponse.json(tokenData, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Failed to generate connection token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
