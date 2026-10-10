import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { NextResponse } from 'next/server';
import { communityRepo } from '@/src/server/infrastructure/db/postgres/repositories/community.repo';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const { cohortId } = await params;
    const session = await auth();
    const cohort = await prisma.cohort.findFirst({ where: { id: cohortId, ...accessibleCohortWhere(session?.user?.id ?? null) }, select: { id: true } });
    if (!cohort) return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    const community = await communityRepo.getCommunityChannels(cohortId);
    
    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    return NextResponse.json(community.channels);
  } catch (error) {
    console.error('Failed to fetch community channels:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
