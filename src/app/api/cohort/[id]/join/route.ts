import { accessibleCohortWhere } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import { UserCohortConfig } from '@/src/server/database/mongo/models/UserCohortConfig';
import { invalidateHomeServerCache } from '@/src/server/infrastructure/cache/homeServerCache';

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
    await connectToMongoDB();
    await UserCohortConfig.updateOne(
      { userId, cohortId, isHidden: true },
      { $set: { isHidden: false, isPaused: false }, $unset: { pausedUntil: 1 } },
    ).exec();
    // Repeating join is safe, including a lost successful response.
    await prisma.cohortMember.upsert({
      where: { cohortId_userId: { cohortId, userId } }, update: {}, create: {
        userId,
        cohortId,
      },
    });

    invalidateHomeServerCache(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to join cohort', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Removing a subscription never deletes cohort content or the learner's progress.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: cohortId } = await params;
  if (!cohortId?.trim()) return NextResponse.json({ error: 'Cohort ID is required' }, { status: 400 });
  try {
    await connectToMongoDB();
    // A user-scoped marker also removes creator-owned cohorts, which home includes
    // independently of membership, and keeps stale device caches from restoring them.
    await UserCohortConfig.updateOne(
      { userId, cohortId },
      { $set: { isHidden: true } },
      { upsert: true },
    ).exec();
    try {
      await prisma.cohortMember.deleteMany({ where: { userId, cohortId } });
    } catch (error) {
      await UserCohortConfig.updateOne({ userId, cohortId }, { $set: { isHidden: false } }).exec();
      throw error;
    }

    invalidateHomeServerCache(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove cohort subscription', error);
    return NextResponse.json({ error: 'Could not remove subscription' }, { status: 500 });
  }
}
