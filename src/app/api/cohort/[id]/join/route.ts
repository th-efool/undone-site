import { NextResponse } from 'next/server';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { connectToMongoDB } from '@/src/server/infrastructure/db/mongodb/client';
import { UserCohortConfig } from '@/src/server/database/mongo/models/UserCohortConfig';
import { invalidateHomeServerCache } from '@/src/server/infrastructure/cache/homeServerCache';
import { invalidateFeedCatalogCache } from '@/src/server/infrastructure/cache/feedServerCache';
import { setCachedCohortMember } from '@/src/server/infrastructure/auth/permissionsCache';
import { canEnrollCohort } from '@/src/server/domain/cohort/cohortAccessPolicy';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { acceptCohortInvitation } from '@/src/server/domain/cohort/cohortInvitation.service';

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

    if (isSharedGuestAccount(session.user)) {
      return NextResponse.json(
        { error: 'Guest accounts cannot enroll in cohort community' },
        { status: 403 }
      );
    }

    const { id: rawId } = await params;
    if (!rawId || typeof rawId !== 'string' || !rawId.trim()) {
      return NextResponse.json({ error: 'Cohort ID is required' }, { status: 400 });
    }

    const cohortId = rawId.trim();
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      select: {
        id: true,
        creatorId: true,
        isPublished: true,
        visibility: true,
        community: {
          select: { id: true, chatEnabled: true },
        },
      },
    });

    if (!cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    // Parse optional invitation token from request body if private/invite-only
    let invitationToken: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.invitationToken === 'string') {
        invitationToken = body.invitationToken;
      }
    } catch {
      // Body empty or not JSON
    }

    const isCreator = cohort.creatorId === userId;
    const enrollPolicy = canEnrollCohort(cohort, userId);

    if (!isCreator && !enrollPolicy.allowed) {
      if (enrollPolicy.reason === 'requires_invitation') {
        if (!invitationToken) {
          return NextResponse.json(
            { error: 'This cohort requires an invitation to join' },
            { status: 403 }
          );
        }
        await acceptCohortInvitation({
          rawToken: invitationToken,
          userId,
          userEmail: session.user.email,
        });
      } else {
        return NextResponse.json(
          { error: 'Cohort is not currently available for enrollment' },
          { status: 403 }
        );
      }
    }

    // Idempotent membership upsert - creator retains CREATOR role
    const membership = await prisma.cohortMember.upsert({
      where: { cohortId_userId: { cohortId, userId } },
      update: {},
      create: {
        userId,
        cohortId,
        role: isCreator ? 'CREATOR' : 'EXPLORER',
      },
      select: { role: true },
    });

    // Cache updated permissions with canonical role
    setCachedCohortMember(cohortId, userId, {
      isMember: true,
      role: membership.role,
    });

    // Secondary effect: update MongoDB learner preferences (non-fatal if Mongo fails)
    try {
      await connectToMongoDB();
      await UserCohortConfig.updateOne(
        { userId, cohortId },
        { $set: { isHidden: false, isPaused: false }, $unset: { pausedUntil: 1 } },
        { upsert: true }
      ).exec();
    } catch (mongoError) {
      console.warn('Failed to update learner config in MongoDB during join:', mongoError);
    }

    invalidateHomeServerCache(userId);
    invalidateFeedCatalogCache(userId);

    return NextResponse.json({
      success: true,
      enrolled: true,
      role: membership.role,
      communityId: cohort.community?.id ?? null,
      chatEnabled: cohort.community?.chatEnabled ?? true,
    });
  } catch (error) {
    console.error('Failed to join cohort', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Removing a subscription or hiding from Home
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: rawId } = await params;
  const cohortId = rawId?.trim();
  if (!cohortId) return NextResponse.json({ error: 'Cohort ID is required' }, { status: 400 });

  try {
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { creatorId: true },
    });

    if (!cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    const isCreator = cohort.creatorId === userId;

    // Secondary effect: mark hidden in MongoDB preferences
    try {
      await connectToMongoDB();
      await UserCohortConfig.updateOne(
        { userId, cohortId },
        { $set: { isHidden: true } },
        { upsert: true },
      ).exec();
    } catch (mongoError) {
      console.warn('Failed to update learner config in MongoDB during leave:', mongoError);
    }

    if (!isCreator) {
      // Ordinary members lose SQL membership
      await prisma.cohortMember.deleteMany({ where: { userId, cohortId } });
      setCachedCohortMember(cohortId, userId, { isMember: false });
    } else {
      // Creators retain CREATOR role in SQL; hiding from Home is solely a personal preference
      setCachedCohortMember(cohortId, userId, { isMember: true, role: 'CREATOR' });
    }

    invalidateHomeServerCache(userId);
    invalidateFeedCatalogCache(userId);

    return NextResponse.json({ success: true, isCreator });
  } catch (error) {
    console.error('Failed to remove cohort subscription', error);
    return NextResponse.json({ error: 'Could not remove subscription' }, { status: 500 });
  }
}
