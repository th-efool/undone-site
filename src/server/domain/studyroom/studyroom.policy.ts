import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import {
  type RoomRole,
  type RoomCapabilities,
  type RoomEligibilityReason,
  STUDY_ROOM_LIMITS,
  RESERVED_ROOM_SLUGS,
  RoomForbiddenError,
  RoomValidationError,
  RoomQuotaExceededError,
} from '@/src/shared/studyroom/contracts';

export interface RoomEntity {
  id: string;
  slug: string | null;
  title: string;
  ownerId?: string | null;
  cohortId?: string | null;
  status: string;
  listing: string;
  capacity: number;
  revision: number;
}

export interface UserContext {
  userId: string | null;
  platformRole?: string | null; // e.g. ADMIN, CREATOR, EXPLORER
}

export interface ResolvedRoomRole {
  role: RoomRole;
  isOwner: boolean;
  isPlatformAdmin: boolean;
  isCohortGovernor: boolean;
}

export const studyroomPolicy = {
  /**
   * Validates room slug format and checks for reserved words.
   */
  validateRoomSlug(slug: string): string {
    const normalized = slug.trim().toLowerCase();
    if (!normalized || normalized.length < 2 || normalized.length > 64) {
      throw new RoomValidationError('Slug must be between 2 and 64 characters long');
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
      throw new RoomValidationError('Slug must consist of lowercase letters, numbers, and single hyphens');
    }

    if (RESERVED_ROOM_SLUGS.has(normalized)) {
      throw new RoomValidationError(`Slug '${normalized}' is a reserved route path`);
    }

    return normalized;
  },

  /**
   * Resolves the user's authoritative role within a room.
   */
  async resolveUserRoomRole(
    room: RoomEntity,
    userId: string | null,
    platformRole?: string | null
  ): Promise<ResolvedRoomRole> {
    const isPlatformAdmin = platformRole === 'ADMIN';

    if (!userId) {
      return {
        role: 'VIEWER',
        isOwner: false,
        isPlatformAdmin: false,
        isCohortGovernor: false,
      };
    }

    if (prisma.user?.findUnique) {
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, username: true },
      });
      if (isSharedGuestAccount(userRecord)) {
        return {
          role: 'VIEWER',
          isOwner: false,
          isPlatformAdmin: false,
          isCohortGovernor: false,
        };
      }
    }

    // 1. Direct Owner Check
    if (room.ownerId && room.ownerId === userId) {
      return {
        role: 'OWNER',
        isOwner: true,
        isPlatformAdmin,
        isCohortGovernor: false,
      };
    }

    // 2. Cohort Governance Check (if room is attached to a cohort)
    let isCohortGovernor = false;
    if (room.cohortId) {
      const cohort = await prisma.cohort.findUnique({
        where: { id: room.cohortId },
        select: { creatorId: true },
      });

      if (cohort?.creatorId === userId) {
        isCohortGovernor = true;
      } else {
        const membership = await prisma.cohortMember.findUnique({
          where: {
            cohortId_userId: {
              cohortId: room.cohortId,
              userId,
            },
          },
          select: { role: true },
        });

        if (membership && (membership.role === 'CREATOR' || membership.role === 'MODERATOR')) {
          isCohortGovernor = true;
        }
      }
    }

    // 3. Delegated RoomController Check
    const controller = await prisma.roomController.findUnique({
      where: {
        studyRoomId_userId: {
          studyRoomId: room.id,
          userId,
        },
      },
      select: { role: true },
    });

    if (controller?.role === 'MODERATOR') {
      return {
        role: 'MODERATOR',
        isOwner: false,
        isPlatformAdmin,
        isCohortGovernor,
      };
    }

    if (controller?.role === 'HOST') {
      return {
        role: 'HOST',
        isOwner: false,
        isPlatformAdmin,
        isCohortGovernor,
      };
    }

    // If cohort governor or platform admin with no local role, project as MODERATOR privileges
    if (isCohortGovernor || isPlatformAdmin) {
      return {
        role: 'MODERATOR',
        isOwner: false,
        isPlatformAdmin,
        isCohortGovernor,
      };
    }

    // 4. Participant vs Viewer check
    const activeLease = await prisma.roomLease.findFirst({
      where: {
        studyRoomId: room.id,
        userId,
        expiresAt: { gt: new Date() },
      },
    });

    return {
      role: activeLease ? 'PARTICIPANT' : 'VIEWER',
      isOwner: false,
      isPlatformAdmin,
      isCohortGovernor,
    };
  },

  /**
   * Resolves room eligibility: evaluates if user can join, view, or what restriction blocks them.
   */
  async resolveRoomEligibility(
    room: RoomEntity,
    userId: string | null,
    hasActiveLease = false
  ): Promise<{
    eligible: boolean;
    reason: RoomEligibilityReason;
    details?: Record<string, unknown>;
  }> {
    if (!userId) {
      return { eligible: false, reason: 'NOT_AUTHENTICATED' };
    }

    // Deny shared guest accounts
    if (prisma.user?.findUnique) {
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, username: true },
      });
      if (isSharedGuestAccount(userRecord)) {
        return { eligible: false, reason: 'GUEST_RESTRICTED' };
      }
    }

    // 1. Room Lifecycle State
    const status = (room.status || 'OPEN').toUpperCase();
    if (status === 'DRAFT') {
      // Draft rooms are restricted to managers
      return { eligible: false, reason: 'DRAFT_RESTRICTED' };
    }

    if (status === 'CLOSED' || status === 'ARCHIVED') {
      return { eligible: false, reason: 'ROOM_CLOSED' };
    }

    // 2. Room Restrictions (Bans & Cooldowns)
    const now = new Date();
    type PolicyPrismaClient = typeof prisma & {
      roomRestriction?: {
        findUnique: (args: {
          where: { studyRoomId_userId: { studyRoomId: string; userId: string } };
        }) => Promise<{ action: string; reason?: string | null; expiresAt?: Date | null } | null>;
      };
      cohortMember?: {
        findUnique: (args: {
          where: { cohortId_userId: { cohortId: string; userId: string } };
          include?: { cohort: { select: { title: boolean } } };
        }) => Promise<{ cohort: { title: string } } | null>;
      };
    };
    const db = prisma as unknown as PolicyPrismaClient;

    const restriction = db.roomRestriction?.findUnique
      ? await db.roomRestriction.findUnique({
          where: {
            studyRoomId_userId: {
              studyRoomId: room.id,
              userId,
            },
          },
        })
      : null;

    if (restriction) {
      if (restriction.action === 'BAN') {
        if (!restriction.expiresAt || restriction.expiresAt > now) {
          return {
            eligible: false,
            reason: 'USER_BANNED',
            details: { reason: restriction.reason, expiresAt: restriction.expiresAt?.toISOString() },
          };
        }
      } else if (restriction.action === 'REMOVE') {
        if (restriction.expiresAt && restriction.expiresAt > now) {
          return {
            eligible: false,
            reason: 'USER_KICKED_COOLDOWN',
            details: { expiresAt: restriction.expiresAt.toISOString() },
          };
        }
      }
    }

    // 3. Cohort Scope & Membership Check
    if (room.cohortId && db.cohortMember?.findUnique) {
      const membership = await db.cohortMember.findUnique({
        where: {
          cohortId_userId: {
            cohortId: room.cohortId,
            userId,
          },
        },
        include: {
          cohort: { select: { title: true } },
        },
      });

      if (!membership) {
        return {
          eligible: false,
          reason: 'ENROLLMENT_REQUIRED',
          details: { cohortId: room.cohortId },
        };
      }
    }

    // 4. Capacity Check (if not already inside)
    if (!hasActiveLease) {
      const activeDistinctUsers = await prisma.roomLease.groupBy({
        by: ['userId'],
        where: {
          studyRoomId: room.id,
          expiresAt: { gt: now },
        },
      });

      const capacity = room.capacity ?? STUDY_ROOM_LIMITS.CAPACITY_MAX;
      if (activeDistinctUsers.length >= capacity) {
        return {
          eligible: false,
          reason: 'ROOM_FULL',
          details: { capacity, onlineCount: activeDistinctUsers.length },
        };
      }
    }

    return { eligible: true, reason: 'ELIGIBLE' };
  },

  /**
   * Computes the complete capability matrix for a room and viewer.
   */
  async evaluateCapabilities(
    room: RoomEntity,
    userId: string | null,
    platformRole?: string | null,
    hasActiveLease = false
  ): Promise<RoomCapabilities> {
    const roleResolution = await this.resolveUserRoomRole(room, userId, platformRole);
    const eligibility = await this.resolveRoomEligibility(room, userId, hasActiveLease);

    const isOwner = roleResolution.isOwner || roleResolution.isPlatformAdmin;
    const isManager = isOwner || roleResolution.role === 'MODERATOR';

    // Environment and Sprint control require live active lease in addition to role
    const canControlEnvironment =
      (isOwner || roleResolution.role === 'MODERATOR' || roleResolution.role === 'HOST') &&
      hasActiveLease;

    const canJoin = eligibility.eligible;

    return {
      canJoin,
      canEditRoom: isOwner,
      canControlEnvironment,
      canManageParticipants: isManager,
      canTransferOwnership: roleResolution.isOwner, // strictly durable owner
      canChangeLifecycle: isOwner,
      canManageRoles: isOwner,
      eligibilityReason: eligibility.reason,
    };
  },

  /**
   * Asserts whether a user has authority to control the shared environment or sprint.
   * Throws appropriate typed errors on failure.
   */
  async assertCanControlEnvironment(roomId: string, userId: string): Promise<void> {
    if (prisma.user?.findUnique) {
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, username: true },
      });
      if (isSharedGuestAccount(userRecord)) {
        throw new RoomForbiddenError('Guest accounts cannot control room environment');
      }
    }

    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new RoomValidationError('Study room not found');
    }

    const activeLease = await prisma.roomLease.findFirst({
      where: {
        studyRoomId: roomId,
        userId,
        expiresAt: { gt: new Date() },
      },
    });

    if (!activeLease) {
      throw new RoomForbiddenError('Must be an active room participant with a live lease to control environment');
    }

    const roleResolution = await this.resolveUserRoomRole(room, userId);
    const hasRole =
      roleResolution.isOwner ||
      roleResolution.isPlatformAdmin ||
      roleResolution.isCohortGovernor ||
      roleResolution.role === 'MODERATOR' ||
      roleResolution.role === 'HOST';

    if (!hasRole) {
      throw new RoomForbiddenError('Only room owner, moderators, or hosts can control room environment');
    }
  },

  /**
   * Evaluates target hierarchy for moderator actions (remove / ban).
   * Prevents moderators from targeting owners or peer moderators.
   * Only OWNER and MODERATOR have moderation permissions.
   */
  assertTargetHierarchy(actorRole: RoomRole, targetRole: RoomRole): void {
    if (actorRole !== 'OWNER' && actorRole !== 'MODERATOR') {
      throw new RoomForbiddenError(`A ${actorRole} does not have moderation authority`);
    }

    const hierarchyRank: Record<RoomRole, number> = {
      OWNER: 4,
      MODERATOR: 3,
      HOST: 2,
      PARTICIPANT: 1,
      VIEWER: 1,
    };

    if (hierarchyRank[actorRole] <= hierarchyRank[targetRole]) {
      throw new RoomForbiddenError(`A ${actorRole} cannot take action against a ${targetRole}`);
    }
  },

  /**
   * Enforces room creation quotas.
   */
  async assertCreationQuota(userId: string): Promise<void> {
    if (prisma.user?.findUnique) {
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, username: true },
      });
      if (isSharedGuestAccount(userRecord)) {
        throw new RoomForbiddenError('Guest accounts cannot create study rooms');
      }
    }

    // 1. Max open standalone rooms limit
    const openStandaloneCount = await prisma.studyRoom.count({
      where: {
        ownerId: userId,
        cohortId: null,
        status: 'OPEN',
      },
    });

    if (openStandaloneCount >= STUDY_ROOM_LIMITS.MAX_OPEN_STANDALONE_PER_USER) {
      throw new RoomQuotaExceededError(
        `You have reached the limit of ${STUDY_ROOM_LIMITS.MAX_OPEN_STANDALONE_PER_USER} open standalone study rooms`
      );
    }

    // 2. Daily creation limit (past 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCreationsCount = await prisma.studyRoom.count({
      where: {
        ownerId: userId,
        createdAt: { gte: oneDayAgo },
      },
    });

    if (recentCreationsCount >= STUDY_ROOM_LIMITS.MAX_CREATIONS_PER_DAY_PER_USER) {
      throw new RoomQuotaExceededError(
        `You have reached the daily creation quota of ${STUDY_ROOM_LIMITS.MAX_CREATIONS_PER_DAY_PER_USER} rooms per 24 hours`
      );
    }
  },
};
