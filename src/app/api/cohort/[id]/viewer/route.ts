import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import {
  getCachedCohortMember,
  setCachedCohortMember,
} from '@/src/server/infrastructure/auth/permissionsCache';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cohortId } = await params;
  const headers = { 'Cache-Control': 'private, no-store' };

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ enrolled: false, isCreator: false }, { headers });
    }

    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { creatorId: true },
    });

    if (!cohort) {
      return NextResponse.json({ enrolled: false, isCreator: false }, { status: 404, headers });
    }

    const isCreator = cohort.creatorId === userId;
    if (isCreator) {
      setCachedCohortMember(cohortId, userId, { isMember: true, role: 'CREATOR' });
      return NextResponse.json({ enrolled: true, role: 'CREATOR', isCreator: true }, { headers });
    }

    const cached = getCachedCohortMember(cohortId, userId);
    if (cached !== null) {
      return NextResponse.json(
        { enrolled: cached.isMember, role: cached.role, isCreator: false },
        { headers }
      );
    }

    const member = await prisma.cohortMember.findUnique({
      where: {
        cohortId_userId: {
          cohortId,
          userId,
        },
      },
      select: { role: true },
    });

    setCachedCohortMember(cohortId, userId, {
      isMember: Boolean(member),
      role: member?.role,
    });

    return NextResponse.json(
      { enrolled: Boolean(member), role: member?.role, isCreator: false },
      { headers }
    );
  } catch (error) {
    console.error('Failed to resolve cohort viewer state:', error);
    return NextResponse.json({ enrolled: false, isCreator: false }, { status: 500, headers });
  }
}
