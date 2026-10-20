import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { communityRepo } from '@/src/server/infrastructure/db/postgres/repositories/community.repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(session.user)) {
      return NextResponse.json({ communities: [] }, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    const memberships = await communityRepo.getUserEnrolledCommunities(userId);

    const communities = memberships
      .filter((m) => m.cohort.community !== null)
      .map((m) => ({
        cohortId: m.cohort.id,
        cohortTitle: m.cohort.title,
        coverImage: m.cohort.coverImage,
        role: m.role,
        communityId: m.cohort.community!.id,
        chatEnabled: m.cohort.community!.chatEnabled,
        channels: m.cohort.community!.channels,
      }));

    return NextResponse.json(communities, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to get enrolled communities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
