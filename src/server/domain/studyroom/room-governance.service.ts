import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { studyroomPolicy, type RoomEntity } from './studyroom.policy';
import {
  type DelegatedRoomRole,
  type RoomControllerDTO,
  type RoomRestrictionDTO,
  type OwnershipTransferDTO,
  type RoomAuditLogResponse,
  type RestrictionAction,
  type TransferStatus,
  type RoomAuditAction,
  STUDY_ROOM_LIMITS,
  RoomNotFoundError,
  RoomForbiddenError,
  RoomConflictError,
  RoomValidationError,
} from '@/src/shared/studyroom/contracts';

export const roomGovernanceService = {
  /**
   * Retrieves delegated controllers for a study room.
   */
  async getControllers(roomId: string, actorUserId: string): Promise<RoomControllerDTO[]> {
    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
      select: { id: true, ownerId: true, cohortId: true, status: true, capacity: true, revision: true },
    });

    if (!room) {
      throw new RoomNotFoundError();
    }

    if (actorUserId) {
      await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, actorUserId);
    }

    const controllers = await prisma.roomController.findMany({
      where: { studyRoomId: roomId },
      include: {
        user: { select: { id: true, name: true, username: true, image: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return controllers.map((c) => ({
      userId: c.userId,
      name: c.user.name,
      username: c.user.username,
      image: c.user.image,
      role: c.role as DelegatedRoomRole,
      assignedByUserId: c.assignedByUserId || '',
      assignedAt: c.createdAt.toISOString(),
    }));
  },

  /**
   * Assigns or updates a delegated controller (MODERATOR or HOST). Owner only.
   */
  async setController(
    roomId: string,
    targetUserId: string,
    role: DelegatedRoomRole,
    actorUserId: string
  ): Promise<void> {
    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new RoomNotFoundError();
    }

    // Owner only check
    const roleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, actorUserId);
    if (!roleRes.isOwner && !roleRes.isPlatformAdmin) {
      throw new RoomForbiddenError('Only room owner can assign delegated roles');
    }

    if (targetUserId === room.ownerId) {
      throw new RoomValidationError('Cannot assign delegated controller role to room owner');
    }

    if (!['MODERATOR', 'HOST'].includes(role)) {
      throw new RoomValidationError('Delegated role must be MODERATOR or HOST');
    }

    // Validate target user exists and satisfies room scope
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!targetUser) {
      throw new RoomValidationError('Target user not found');
    }

    if (room.cohortId) {
      const membership = await prisma.cohortMember.findUnique({
        where: { cohortId_userId: { cohortId: room.cohortId, userId: targetUserId } },
      });
      if (!membership) {
        throw new RoomValidationError('Target user is not enrolled in the cohort');
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.roomController.upsert({
        where: {
          studyRoomId_userId: {
            studyRoomId: roomId,
            userId: targetUserId,
          },
        },
        create: {
          studyRoomId: roomId,
          userId: targetUserId,
          role,
          assignedByUserId: actorUserId,
        },
        update: {
          role,
          assignedByUserId: actorUserId,
          updatedAt: new Date(),
        },
      });

      await tx.roomAuditLog.create({
        data: {
          studyRoomId: roomId,
          actorId: actorUserId,
          action: 'CONTROLLER_ASSIGNED',
          targetUserId,
          details: { role },
        },
      });
    });
  },

  /**
   * Revokes a delegated controller role. Owner only.
   */
  async revokeController(roomId: string, targetUserId: string, actorUserId: string): Promise<void> {
    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new RoomNotFoundError();
    }

    const roleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, actorUserId);
    if (!roleRes.isOwner && !roleRes.isPlatformAdmin) {
      throw new RoomForbiddenError('Only room owner can revoke delegated roles');
    }

    await prisma.$transaction(async (tx) => {
      await tx.roomController.deleteMany({
        where: {
          studyRoomId: roomId,
          userId: targetUserId,
        },
      });

      await tx.roomAuditLog.create({
        data: {
          studyRoomId: roomId,
          actorId: actorUserId,
          action: 'CONTROLLER_REVOKED',
          targetUserId,
        },
      });
    });
  },

  /**
   * Removes a participant with a 2-minute rejoin cooldown. Owner or Moderator.
   */
  async removeParticipant(
    roomId: string,
    targetUserId: string,
    reason: string | undefined,
    actorUserId: string
  ): Promise<void> {
    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new RoomNotFoundError();
    }

    const actorRoleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, actorUserId);
    const targetRoleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, targetUserId);

    studyroomPolicy.assertTargetHierarchy(actorRoleRes.role, targetRoleRes.role);

    const now = new Date();
    const cooldownExpiresAt = new Date(now.getTime() + STUDY_ROOM_LIMITS.KICK_COOLDOWN_MS);

    await prisma.$transaction(async (tx) => {
      // 1. Invalidate active leases and participant presence
      await tx.roomLease.deleteMany({
        where: { studyRoomId: roomId, userId: targetUserId },
      });
      await tx.roomParticipant.deleteMany({
        where: { studyRoomId: roomId, userId: targetUserId },
      });

      // 2. Set cooldown restriction
      await tx.roomRestriction.upsert({
        where: {
          studyRoomId_userId: {
            studyRoomId: roomId,
            userId: targetUserId,
          },
        },
        create: {
          studyRoomId: roomId,
          userId: targetUserId,
          action: 'REMOVE',
          reason: reason?.trim() || null,
          issuedByUserId: actorUserId,
          expiresAt: cooldownExpiresAt,
        },
        update: {
          action: 'REMOVE',
          reason: reason?.trim() || null,
          issuedByUserId: actorUserId,
          expiresAt: cooldownExpiresAt,
          updatedAt: now,
        },
      });

      // 3. Recalculate online count
      const activeUsers = await tx.roomLease.groupBy({
        by: ['userId'],
        where: {
          studyRoomId: roomId,
          expiresAt: { gt: now },
        },
      });
      await tx.studyRoom.update({
        where: { id: roomId },
        data: { onlineCount: activeUsers.length },
      });

      // 4. Audit Log
      await tx.roomAuditLog.create({
        data: {
          studyRoomId: roomId,
          actorId: actorUserId,
          action: 'PARTICIPANT_REMOVED',
          targetUserId,
          details: { reason, cooldownMinutes: 2 },
        },
      });
    });
  },

  /**
   * Bans a user from a room with optional duration. Owner or Moderator.
   */
  async banParticipant(
    roomId: string,
    targetUserId: string,
    reason: string | undefined,
    durationMinutes: number | undefined,
    actorUserId: string
  ): Promise<void> {
    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new RoomNotFoundError();
    }

    const actorRoleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, actorUserId);
    const targetRoleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, targetUserId);

    studyroomPolicy.assertTargetHierarchy(actorRoleRes.role, targetRoleRes.role);

    const now = new Date();
    const expiresAt = durationMinutes ? new Date(now.getTime() + durationMinutes * 60 * 1000) : null;

    await prisma.$transaction(async (tx) => {
      // 1. Invalidate leases and presence
      await tx.roomLease.deleteMany({
        where: { studyRoomId: roomId, userId: targetUserId },
      });
      await tx.roomParticipant.deleteMany({
        where: { studyRoomId: roomId, userId: targetUserId },
      });

      // 2. Upsert ban restriction
      await tx.roomRestriction.upsert({
        where: {
          studyRoomId_userId: {
            studyRoomId: roomId,
            userId: targetUserId,
          },
        },
        create: {
          studyRoomId: roomId,
          userId: targetUserId,
          action: 'BAN',
          reason: reason?.trim() || null,
          issuedByUserId: actorUserId,
          expiresAt,
        },
        update: {
          action: 'BAN',
          reason: reason?.trim() || null,
          issuedByUserId: actorUserId,
          expiresAt,
          updatedAt: now,
        },
      });

      // 3. Recalculate online count
      const activeUsers = await tx.roomLease.groupBy({
        by: ['userId'],
        where: {
          studyRoomId: roomId,
          expiresAt: { gt: now },
        },
      });
      await tx.studyRoom.update({
        where: { id: roomId },
        data: { onlineCount: activeUsers.length },
      });

      // 4. Audit Log
      await tx.roomAuditLog.create({
        data: {
          studyRoomId: roomId,
          actorId: actorUserId,
          action: 'PARTICIPANT_BANNED',
          targetUserId,
          details: { reason, durationMinutes: durationMinutes || 'indefinite' },
        },
      });
    });
  },

  /**
   * Unbans a user from a room. Owner or Moderator.
   */
  async unbanParticipant(roomId: string, targetUserId: string, actorUserId: string): Promise<void> {
    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new RoomNotFoundError();
    }

    const actorRoleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, actorUserId);
    if (!actorRoleRes.isOwner && !actorRoleRes.isPlatformAdmin && actorRoleRes.role !== 'MODERATOR') {
      throw new RoomForbiddenError('Only owner or moderator can unban users');
    }

    await prisma.$transaction(async (tx) => {
      await tx.roomRestriction.deleteMany({
        where: {
          studyRoomId: roomId,
          userId: targetUserId,
        },
      });

      await tx.roomAuditLog.create({
        data: {
          studyRoomId: roomId,
          actorId: actorUserId,
          action: 'PARTICIPANT_UNBANNED',
          targetUserId,
        },
      });
    });
  },

  /**
   * Retrieves room restrictions. Owner or Moderator.
   */
  async getRestrictions(roomId: string, actorUserId: string): Promise<RoomRestrictionDTO[]> {
    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new RoomNotFoundError();
    }

    const actorRoleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, actorUserId);
    if (!actorRoleRes.isOwner && !actorRoleRes.isPlatformAdmin && actorRoleRes.role !== 'MODERATOR') {
      throw new RoomForbiddenError('Only owner or moderator can view room restrictions');
    }

    const restrictions = await prisma.roomRestriction.findMany({
      where: { studyRoomId: roomId },
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return restrictions.map((r) => ({
      id: r.id,
      studyRoomId: r.studyRoomId,
      userId: r.userId,
      userName: r.user.name || r.user.username || 'User',
      action: r.action as RestrictionAction,
      reason: r.reason,
      issuedByUserId: r.issuedByUserId || '',
      expiresAt: r.expiresAt?.toISOString() || null,
      createdAt: r.createdAt.toISOString(),
    }));
  },

  /**
   * Initiates an ownership transfer proposal. Owner only.
   */
  async proposeOwnershipTransfer(
    roomId: string,
    recipientUserId: string,
    expectedRevision: number,
    actorUserId: string
  ): Promise<OwnershipTransferDTO> {
    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new RoomNotFoundError();
    }

    // Strictly durable owner only
    if (room.ownerId !== actorUserId) {
      throw new RoomForbiddenError('Only the durable room owner can propose an ownership transfer');
    }

    if (room.revision !== expectedRevision) {
      throw new RoomConflictError();
    }

    if (recipientUserId === actorUserId) {
      throw new RoomValidationError('Cannot transfer ownership to yourself');
    }

    // Verify recipient user eligibility
    const recipient = await prisma.user.findUnique({
      where: { id: recipientUserId },
      select: { id: true, name: true, username: true },
    });
    if (!recipient) {
      throw new RoomValidationError('Recipient user not found');
    }

    if (room.cohortId) {
      const membership = await prisma.cohortMember.findUnique({
        where: { cohortId_userId: { cohortId: room.cohortId, userId: recipientUserId } },
      });
      if (!membership) {
        throw new RoomValidationError('Recipient must be enrolled in the cohort');
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + STUDY_ROOM_LIMITS.TRANSFER_EXPIRY_MS);

    const transfer = await prisma.$transaction(async (tx) => {
      // Cancel any prior pending transfer for this room
      await tx.roomOwnershipTransfer.updateMany({
        where: {
          studyRoomId: roomId,
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
        },
      });

      const created = await tx.roomOwnershipTransfer.create({
        data: {
          studyRoomId: roomId,
          senderId: actorUserId,
          recipientId: recipientUserId,
          status: 'PENDING',
          expectedRevision,
          expiresAt,
        },
      });

      await tx.roomAuditLog.create({
        data: {
          studyRoomId: roomId,
          actorId: actorUserId,
          action: 'OWNERSHIP_TRANSFER_PROPOSED',
          targetUserId: recipientUserId,
          details: { transferId: created.id, expiresAt: expiresAt.toISOString() },
        },
      });

      return created;
    });

    return {
      id: transfer.id,
      studyRoomId: transfer.studyRoomId,
      senderId: transfer.senderId,
      recipientId: transfer.recipientId,
      recipientName: recipient.name || recipient.username || 'User',
      status: transfer.status as TransferStatus,
      expectedRevision: transfer.expectedRevision,
      expiresAt: transfer.expiresAt.toISOString(),
      createdAt: transfer.createdAt.toISOString(),
    };
  },

  /**
   * Accepts an ownership transfer proposal. Recipient only.
   */
  async acceptOwnershipTransfer(
    roomId: string,
    transferId: string,
    recipientUserId: string
  ): Promise<void> {
    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new RoomNotFoundError();
    }

    const transfer = await prisma.roomOwnershipTransfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer || transfer.studyRoomId !== roomId) {
      throw new RoomValidationError('Transfer proposal not found');
    }

    if (transfer.recipientId !== recipientUserId) {
      throw new RoomForbiddenError('Only the designated recipient can accept this transfer');
    }

    if (transfer.status !== 'PENDING') {
      throw new RoomValidationError(`Transfer proposal is ${transfer.status}`);
    }

    const now = new Date();
    if (transfer.expiresAt <= now) {
      await prisma.roomOwnershipTransfer.update({
        where: { id: transferId },
        data: { status: 'EXPIRED' },
      });
      throw new RoomConflictError('Transfer proposal has expired');
    }

    if (room.revision !== transfer.expectedRevision) {
      throw new RoomConflictError('Room revision changed since transfer was proposed');
    }

    // Re-verify recipient eligibility
    if (room.cohortId) {
      const membership = await prisma.cohortMember.findUnique({
        where: { cohortId_userId: { cohortId: room.cohortId, userId: recipientUserId } },
      });
      if (!membership) {
        throw new RoomForbiddenError('Recipient is no longer enrolled in the cohort');
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Swap owner and increment revision
      await tx.studyRoom.update({
        where: { id: roomId },
        data: {
          ownerId: recipientUserId,
          revision: { increment: 1 },
        },
      });

      // 2. Mark transfer ACCEPTED
      await tx.roomOwnershipTransfer.update({
        where: { id: transferId },
        data: {
          status: 'ACCEPTED',
          updatedAt: now,
        },
      });

      // 3. Audit Log
      await tx.roomAuditLog.create({
        data: {
          studyRoomId: roomId,
          actorId: recipientUserId,
          action: 'OWNERSHIP_TRANSFER_ACCEPTED',
          details: { previousOwnerId: room.ownerId, newOwnerId: recipientUserId },
        },
      });
    });
  },

  /**
   * Cancels a pending ownership transfer proposal.
   */
  async cancelOwnershipTransfer(
    roomId: string,
    transferId: string,
    actorUserId: string
  ): Promise<void> {
    const transfer = await prisma.roomOwnershipTransfer.findUnique({
      where: { id: transferId },
      include: { room: true },
    });

    if (!transfer || transfer.studyRoomId !== roomId) {
      throw new RoomValidationError('Transfer proposal not found');
    }

    const isAuthorized =
      transfer.senderId === actorUserId ||
      transfer.recipientId === actorUserId ||
      transfer.room.ownerId === actorUserId;

    if (!isAuthorized) {
      throw new RoomForbiddenError('Unauthorized to cancel this transfer proposal');
    }

    if (transfer.status !== 'PENDING') {
      throw new RoomValidationError(`Cannot cancel transfer with status ${transfer.status}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.roomOwnershipTransfer.update({
        where: { id: transferId },
        data: { status: 'CANCELLED' },
      });

      await tx.roomAuditLog.create({
        data: {
          studyRoomId: roomId,
          actorId: actorUserId,
          action: 'OWNERSHIP_TRANSFER_CANCELLED',
          details: { transferId },
        },
      });
    });
  },

  /**
   * Retrieves paginated management audit log for a study room. Owner or Moderator.
   */
  async getAuditLogs(
    roomId: string,
    actorUserId: string,
    cursor?: string,
    limit = 50
  ): Promise<RoomAuditLogResponse> {
    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new RoomNotFoundError();
    }

    const roleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, actorUserId);
    if (!roleRes.isOwner && !roleRes.isPlatformAdmin && roleRes.role !== 'MODERATOR') {
      throw new RoomForbiddenError('Only room owner or moderator can view audit logs');
    }

    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const logs = await prisma.roomAuditLog.findMany({
      where: { studyRoomId: roomId },
      take: safeLimit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, name: true, username: true } },
        targetUser: { select: { id: true, name: true, username: true } },
      },
    });

    let nextCursor: string | null = null;
    if (logs.length > safeLimit) {
      const nextItem = logs.pop();
      nextCursor = nextItem?.id || null;
    }

    return {
      entries: logs.map((l) => ({
        id: l.id,
        action: l.action as RoomAuditAction,
        actorId: l.actorId || '',
        actorName: l.actor?.name || l.actor?.username || null,
        targetUserId: l.targetUserId,
        targetUserName: l.targetUser?.name || l.targetUser?.username || null,
        clientRequestId: l.clientRequestId,
        details: (l.details as Record<string, unknown>) || null,
        createdAt: l.createdAt.toISOString(),
      })),
      nextCursor,
    };
  },
};
