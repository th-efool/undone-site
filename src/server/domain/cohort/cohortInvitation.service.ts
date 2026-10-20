import 'server-only';
import crypto from 'node:crypto';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

export async function createCohortInvitation(params: {
  cohortId: string;
  inviterId: string;
  email?: string | null;
  expiresInDays?: number;
}): Promise<{ invitationId: string; token: string; expiresAt: Date }> {
  const { cohortId, inviterId, email, expiresInDays = 7 } = params;

  // Verify inviter is creator or moderator
  const membership = await prisma.cohortMember.findUnique({
    where: { cohortId_userId: { cohortId, userId: inviterId } },
    select: { role: true },
  });
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    select: { creatorId: true },
  });

  const isAuthorized = cohort?.creatorId === inviterId || membership?.role === 'CREATOR' || membership?.role === 'MODERATOR';
  if (!isAuthorized) {
    throw new Error('Unauthorized to create cohort invitation');
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashInvitationToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const invitation = await prisma.cohortInvitation.create({
    data: {
      cohortId,
      inviterId,
      email: email ? email.toLowerCase().trim() : null,
      tokenHash,
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  });

  return {
    invitationId: invitation.id,
    token: rawToken,
    expiresAt: invitation.expiresAt,
  };
}

export async function acceptCohortInvitation(params: {
  rawToken: string;
  userId: string;
  userEmail?: string | null;
}): Promise<{ cohortId: string; role: 'EXPLORER' }> {
  const { rawToken, userId, userEmail } = params;
  const tokenHash = hashInvitationToken(rawToken);

  return prisma.$transaction(async (tx) => {
    const invitation = await tx.cohortInvitation.findUnique({
      where: { tokenHash },
      include: { cohort: { select: { id: true, isPublished: true, visibility: true } } },
    });

    if (!invitation) {
      throw new Error('Invalid or expired invitation token');
    }
    if (invitation.revokedAt) {
      throw new Error('Invitation has been revoked');
    }
    if (invitation.acceptedAt) {
      throw new Error('Invitation has already been used');
    }
    if (invitation.expiresAt < new Date()) {
      throw new Error('Invitation has expired');
    }
    if (invitation.email && userEmail && invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new Error('Invitation is intended for a different email address');
    }

    // Mark invitation accepted
    await tx.cohortInvitation.update({
      where: { id: invitation.id },
      data: {
        acceptedAt: new Date(),
        acceptedById: userId,
      },
    });

    // Upsert membership
    await tx.cohortMember.upsert({
      where: { cohortId_userId: { cohortId: invitation.cohortId, userId } },
      update: {},
      create: {
        cohortId: invitation.cohortId,
        userId,
        role: 'EXPLORER',
      },
    });

    return { cohortId: invitation.cohortId, role: 'EXPLORER' };
  });
}

export async function revokeCohortInvitation(params: {
  invitationId: string;
  cohortId: string;
  userId: string;
}): Promise<void> {
  const { invitationId, cohortId, userId } = params;
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    select: { creatorId: true },
  });
  const membership = await prisma.cohortMember.findUnique({
    where: { cohortId_userId: { cohortId, userId } },
    select: { role: true },
  });
  const isAuthorized = cohort?.creatorId === userId || membership?.role === 'CREATOR' || membership?.role === 'MODERATOR';
  if (!isAuthorized) {
    throw new Error('Unauthorized to revoke cohort invitation');
  }

  await prisma.cohortInvitation.update({
    where: { id: invitationId },
    data: { revokedAt: new Date() },
  });
}
