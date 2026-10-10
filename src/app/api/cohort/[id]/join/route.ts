import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params); // Next 15 compatibility
    const id = resolvedParams?.id;

    if (!id || typeof id !== 'string' || !id.trim()) {
      return NextResponse.json({ error: 'Cohort ID is required' }, { status: 400 });
    }

    const cohortId = id.trim();
    const cohort = await prisma.cohort.findFirst({ where: { id: cohortId, ...accessibleCohortWhere(userId) }, select: { id: true } });
    if (!cohort) return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    // Repeating join is safe, including a lost successful response.
    await prisma.cohortMember.upsert({
      where: { cohortId_userId: { cohortId, userId } }, update: {}, create: {
        userId,
        cohortId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to join cohort', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
