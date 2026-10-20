import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { acceptCohortInvitation } from '@/src/server/domain/cohort/cohortInvitation.service';
import { setCachedCohortMember } from '@/src/server/infrastructure/auth/permissionsCache';
import { invalidateHomeServerCache } from '@/src/server/infrastructure/cache/homeServerCache';
import { invalidateFeedCatalogCache } from '@/src/server/infrastructure/cache/feedServerCache';

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(session.user)) {
      return NextResponse.json({ error: 'Guest accounts cannot accept invitations' }, { status: 403 });
    }

    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
    }

    const result = await acceptCohortInvitation({
      rawToken: token,
      userId,
      userEmail: session.user.email,
    });

    setCachedCohortMember(result.cohortId, userId, {
      isMember: true,
      role: result.role,
    });

    invalidateHomeServerCache(userId);
    invalidateFeedCatalogCache(userId);

    return NextResponse.json({ success: true, ...result }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
