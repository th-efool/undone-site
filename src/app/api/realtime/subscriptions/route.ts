import { NextResponse } from 'next/server';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { manifestService } from '@/src/server/domain/messaging/manifest.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot obtain realtime subscription manifests' },
        { status: 403 }
      );
    }

    const restriction = await prisma.userRestriction.findUnique({
      where: { userId: user.id },
      select: { expiresAt: true },
    });

    if (restriction && (!restriction.expiresAt || restriction.expiresAt > new Date())) {
      return NextResponse.json(
        { error: 'Realtime privileges are restricted for this account' },
        { status: 403 }
      );
    }

    const manifest = await manifestService.getAuthorizedSubscriptionManifest(user.id);

    return NextResponse.json(manifest, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Failed to resolve subscription manifest:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
