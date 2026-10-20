import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { NextResponse } from 'next/server';
import { communityRepo } from '@/src/server/infrastructure/db/postgres/repositories/community.repo';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const { cohortId } = await params;
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isSharedGuestAccount(session.user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot access community channels' },
        { status: 403 }
      );
    }

    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      select: {
        id: true,
        creatorId: true,
        isPublished: true,
        community: {
          select: { id: true, chatEnabled: true },
        },
      },
    });

    if (!cohort || !cohort.community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    if (!cohort.community.chatEnabled) {
      return NextResponse.json({ error: 'Chat is disabled for this community' }, { status: 403 });
    }

    const isCreator = cohort.creatorId === userId;
    let isMember = isCreator;

    if (!isMember) {
      const membership = await prisma.cohortMember.findUnique({
        where: { cohortId_userId: { cohortId, userId } },
        select: { role: true },
      });
      isMember = Boolean(membership);
    }

    if (!isMember) {
      return NextResponse.json(
        { error: 'Active cohort membership is required to access community channels' },
        { status: 403 }
      );
    }

    const community = await communityRepo.getCommunityChannels(cohortId);
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    return NextResponse.json(community.channels, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Failed to fetch community channels:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
