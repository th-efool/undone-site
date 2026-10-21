import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { studyroomPolicy, type RoomEntity } from './studyroom.policy';
import {
  type RoomRole,
  RoomNotFoundError,
  RoomForbiddenError,
  RoomQuotaExceededError,
} from '@/src/shared/studyroom/contracts';

interface RoomFinderModel {
  findUnique: (args: { where: { id: string } }) => Promise<RoomEntity | null>;
  findFirst?: (args: { where: { OR: Array<{ id: string } | { slug: string }> } }) => Promise<RoomEntity | null>;
}

async function findRoomByIdOrSlug(
  model: unknown,
  idOrSlug: string
): Promise<RoomEntity | null> {
  const m = model as RoomFinderModel;
  let room = await m.findUnique({ where: { id: idOrSlug } });
  if (!room && typeof m.findFirst === 'function') {
    room = await m.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
    });
  }
  return room;
}

export interface RoomCatalogItem {
  id: string;
  title: string;
  thumbnail: string;
  status: string;
  onlineCount: number;
  slug?: string;
}

export interface RoomRosterMember {
  id: string;
  userId: string;
  name: string;
  username: string;
  image: string;
  role?: RoomRole;
  joinedAt: string;
  tabCount: number;
  publicGoal?: string | null;
}

export interface JoinRoomResult {
  success: boolean;
  roomId: string;
  slug?: string;
  generation: number;
  isSwitch: boolean;
  lease: {
    leaseId: string;
    tabId: string;
    expiresAt: string;
  };
}

export interface RenewLeaseResult {
  success: boolean;
  reason?: 'not_in_room' | 'stale_generation';
  expiresAt?: string;
}

export interface LeaveRoomResult {
  success: boolean;
  left: boolean;
  remainingLeases?: number;
}

export const LEASE_DURATION_MS = 90 * 1000; // 90 seconds
export const LEASE_RENEWAL_INTERVAL_MS = 30 * 1000; // 30 seconds

export const studyRoomService = {
  /**
   * Explicit, idempotent setup task. Creates default rooms and associated channels.
   * Never called during GET requests.
   */
  async seedRoomsIfEmpty(): Promise<void> {
    const count = await prisma.studyRoom.count();
    if (count > 0) return;

    const defaultRooms = [
      { title: 'Fireplace', thumbnail: '/rooms/fireplace.jpg', status: 'ACTIVE' },
      { title: 'Library', thumbnail: '/rooms/library.jpg', status: 'ACTIVE' },
      { title: 'Developer Den', thumbnail: '/rooms/dev-den.jpg', status: 'ACTIVE' },
    ];

    for (const r of defaultRooms) {
      await prisma.$transaction(async (tx) => {
        const room = await tx.studyRoom.create({
          data: {
            title: r.title,
            thumbnail: r.thumbnail,
            status: r.status,
            onlineCount: 0,
          },
        });

        // Ensure Channel exists for room chat
        await tx.channel.create({
          data: {
            name: room.title,
            studyRoomId: room.id,
            messageCounter: 0,
          },
        });

        // Ensure RealtimeStream exists
        await tx.realtimeStream.create({
          data: {
            studyRoomId: room.id,
            generation: 1,
            eventCounter: 0,
          },
        });
      });
    }
  },

  /**
   * Read-only public room catalog. Generates authoritative SHA-256 ETag.
   * Performs no seeding or database writes.
   */
  async getRoomCatalog(ifNoneMatch?: string | null): Promise<{
    rooms: RoomCatalogItem[];
    etag: string;
    notModified: boolean;
  }> {
    const rooms = await prisma.studyRoom.findMany({
      select: {
        id: true,
        title: true,
        thumbnail: true,
        status: true,
        onlineCount: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const catalogItems: RoomCatalogItem[] = rooms.map((r) => ({
      id: r.id,
      title: r.title,
      thumbnail: r.thumbnail,
      status: r.status,
      onlineCount: r.onlineCount,
      slug: r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    }));

    const digest = createHash('sha256')
      .update(JSON.stringify(catalogItems))
      .digest('hex');
    const etag = `"${digest}"`;

    const notModified = Boolean(ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === `W/${etag}`));

    return {
      rooms: catalogItems,
      etag,
      notModified,
    };
  },

  /**
   * Authenticated participant roster for a specific study room.
   * Does not expose public cache headers.
   */
  async getRoomRoster(roomId: string, _userId?: string): Promise<RoomRosterMember[]> {
    void _userId;
    const now = new Date();

    const room = await findRoomByIdOrSlug(prisma.studyRoom, roomId);
    const actualRoomId = room?.id || roomId;

    // Query active participants who have at least one non-expired lease
    const participants = await prisma.roomParticipant.findMany({
      where: { studyRoomId: actualRoomId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const userIds = participants.map((p) => p.userId);
    const activeLeases = await prisma.roomLease.findMany({
      where: {
        studyRoomId: actualRoomId,
        userId: { in: userIds },
        expiresAt: { gt: now },
      },
      select: { userId: true },
    });

    const leaseCountMap = new Map<string, number>();
    for (const lease of activeLeases) {
      leaseCountMap.set(lease.userId, (leaseCountMap.get(lease.userId) ?? 0) + 1);
    }

    interface ControllerModel {
      roomController?: {
        findMany: (args: {
          where: { studyRoomId: string };
          select: { userId: boolean; role: boolean };
        }) => Promise<Array<{ userId: string; role: string }>>;
      };
    }
    const prismaWithController = prisma as unknown as ControllerModel;

    let controllers: Array<{ userId: string; role: string }> = [];
    if (prismaWithController.roomController?.findMany) {
      controllers = await prismaWithController.roomController.findMany({
        where: { studyRoomId: actualRoomId },
        select: { userId: true, role: true },
      });
    }
    const controllerMap = new Map<string, RoomRole>(
      controllers.map((c) => [c.userId, c.role as RoomRole])
    );

    // Only return participants with active leases or recently joined
    return participants
      .filter((p) => (leaseCountMap.get(p.userId) ?? 0) > 0)
      .map((p) => {
        let role: RoomRole = 'PARTICIPANT';
        if (room?.ownerId && p.user.id === room.ownerId) {
          role = 'OWNER';
        } else if (controllerMap.has(p.user.id)) {
          role = controllerMap.get(p.user.id)!;
        }

        return {
          id: p.id,
          userId: p.user.id,
          name: p.user.name || p.user.username || 'Peer',
          username: p.user.username || '',
          image: p.user.image || '/undone-logo.svg',
          role,
          joinedAt: p.joinedAt.toISOString(),
          tabCount: leaseCountMap.get(p.userId) ?? 1,
          publicGoal: null,
        };
      });
  },

  /**
   * Serialized per-user room join or switch.
   * Enforces at most one selected room per user globally.
   * Multiple tabs in the same room count as 1 distinct user towards onlineCount.
   */
  async joinRoom(params: {
    userId: string;
    roomId: string;
    tabId?: string;
    requestId?: string;
  }): Promise<JoinRoomResult> {
    const { userId, roomId } = params;
    const tabId = params.tabId || `tab-${randomUUID()}`;

    return prisma.$transaction(async (tx) => {
      // 1. Verify target room exists
      const targetRoom = await findRoomByIdOrSlug(tx.studyRoom, roomId);
      if (!targetRoom) {
        throw new RoomNotFoundError('Study room not found');
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + LEASE_DURATION_MS);

      // 2. Check user's current room membership
      const currentParticipant = await tx.roomParticipant.findUnique({
        where: { userId },
      });

      const isAlreadyInTarget = currentParticipant?.studyRoomId === targetRoom.id;

      // 3. Eligibility & Capacity Check
      if (studyroomPolicy && typeof studyroomPolicy.resolveRoomEligibility === 'function') {
        const eligibility = await studyroomPolicy.resolveRoomEligibility(
          targetRoom as unknown as RoomEntity,
          userId,
          isAlreadyInTarget
        );
        if (!eligibility.eligible) {
          if (eligibility.reason === 'ROOM_FULL') {
            throw new RoomQuotaExceededError('Room is at full capacity');
          }
          if (eligibility.reason === 'ROOM_CLOSED') {
            throw new RoomForbiddenError('Room is closed');
          }
          if (eligibility.reason === 'USER_BANNED') {
            throw new RoomForbiddenError('User is banned from this room');
          }
          if (eligibility.reason === 'USER_KICKED_COOLDOWN') {
            throw new RoomForbiddenError('User is temporarily restricted from this room');
          }
          if (eligibility.reason === 'ENROLLMENT_REQUIRED') {
            throw new RoomForbiddenError('Cohort enrollment required');
          }
          if (eligibility.reason === 'DRAFT_RESTRICTED') {
            throw new RoomForbiddenError('Room is currently in draft');
          }
          throw new RoomForbiddenError(`Cannot join room: ${eligibility.reason}`);
        }
      }

      let isSwitch = false;
      let generation = 1;

      if (currentParticipant) {
        if (currentParticipant.studyRoomId === targetRoom.id) {
          // Same room: retain generation, record new/renewed tab lease
          generation = currentParticipant.generation;
        } else {
          // Different room: switch rooms! Increment generation and evict old room
          isSwitch = true;
          generation = currentParticipant.generation + 1;
          const oldRoomId = currentParticipant.studyRoomId;

          // Deterministic lock order on switch: sort room IDs to prevent deadlocks
          const [firstRoomId, secondRoomId] = [targetRoom.id, oldRoomId].sort();
          await tx.studyRoom.findUnique({ where: { id: firstRoomId } });
          await tx.studyRoom.findUnique({ where: { id: secondRoomId } });

          // Delete leases for the old room
          await tx.roomLease.deleteMany({
            where: { userId, studyRoomId: oldRoomId },
          });

          // Delete old participant row
          await tx.roomParticipant.delete({
            where: { userId },
          });

          // Recalculate old room online count
          const oldRoomActiveUsers = await tx.roomLease.groupBy({
            by: ['userId'],
            where: {
              studyRoomId: oldRoomId,
              expiresAt: { gt: now },
            },
          });
          await tx.studyRoom.update({
            where: { id: oldRoomId },
            data: { onlineCount: oldRoomActiveUsers.length },
          });
        }
      }

      // 4. Upsert RoomParticipant with current generation
      await tx.roomParticipant.upsert({
        where: { userId },
        create: {
          userId,
          studyRoomId: targetRoom.id,
          generation,
          joinedAt: now,
        },
        update: {
          studyRoomId: targetRoom.id,
          generation,
          updatedAt: now,
        },
      });

      // 5. Upsert RoomLease for this tab
      const lease = await tx.roomLease.upsert({
        where: {
          userId_tabId: {
            userId,
            tabId,
          },
        },
        create: {
          userId,
          studyRoomId: targetRoom.id,
          generation,
          tabId,
          expiresAt,
        },
        update: {
          studyRoomId: targetRoom.id,
          generation,
          expiresAt,
          updatedAt: now,
        },
      });

      // 6. Recalculate new room onlineCount based on distinct users with active leases
      const activeUsers = await tx.roomLease.groupBy({
        by: ['userId'],
        where: {
          studyRoomId: targetRoom.id,
          expiresAt: { gt: now },
        },
      });

      await tx.studyRoom.update({
        where: { id: targetRoom.id },
        data: { onlineCount: activeUsers.length },
      });

      return {
        success: true,
        roomId: targetRoom.id,
        slug: targetRoom.slug || targetRoom.id,
        generation,
        isSwitch,
        lease: {
          leaseId: lease.id,
          tabId,
          expiresAt: lease.expiresAt.toISOString(),
        },
      };
    });
  },

  /**
   * Renews a tab lease. Rejects stale generations from previous rooms.
   */
  async renewLease(params: {
    userId: string;
    roomId: string;
    tabId: string;
    generation: number;
  }): Promise<RenewLeaseResult> {
    const { userId, roomId, tabId, generation } = params;

    return prisma.$transaction(async (tx) => {
      const targetRoom = await findRoomByIdOrSlug(tx.studyRoom, roomId);
      const actualRoomId = targetRoom?.id || roomId;

      const participant = await tx.roomParticipant.findUnique({
        where: { userId },
      });

      if (!participant || participant.studyRoomId !== actualRoomId) {
        return { success: false, reason: 'not_in_room' };
      }

      // Stale generation check: reject delayed heartbeats from previous rooms
      if (participant.generation !== generation) {
        return { success: false, reason: 'stale_generation' };
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + LEASE_DURATION_MS);

      const lease = await tx.roomLease.upsert({
        where: {
          userId_tabId: {
            userId,
            tabId,
          },
        },
        create: {
          userId,
          studyRoomId: actualRoomId,
          generation,
          tabId,
          expiresAt,
        },
        update: {
          expiresAt,
          updatedAt: now,
        },
      });

      return {
        success: true,
        expiresAt: (lease?.expiresAt ? new Date(lease.expiresAt) : expiresAt).toISOString(),
      };
    });
  },

  /**
   * Leave room operation.
   * If global: removes user from participant list and revokes all leases.
   * If tab close: removes only that tab's lease; if other tabs remain, user stays in room.
   */
  async leaveRoom(params: {
    userId: string;
    roomId?: string;
    tabId?: string;
    global?: boolean;
  }): Promise<LeaveRoomResult> {
    const { userId, tabId, global = false } = params;

    return prisma.$transaction(async (tx) => {
      const participant = await tx.roomParticipant.findUnique({
        where: { userId },
      });

      if (!participant) {
        return { success: true, left: true, remainingLeases: 0 };
      }

      let actualRoomId = participant.studyRoomId;
      if (params.roomId) {
        const room = await findRoomByIdOrSlug(tx.studyRoom, params.roomId);
        if (room) actualRoomId = room.id;
      }

      const roomId = actualRoomId;
      const now = new Date();

      if (global || !tabId) {
        // Explicit global leave: delete all leases and the participant row
        await tx.roomLease.deleteMany({
          where: { userId, studyRoomId: roomId },
        });

        await tx.roomParticipant.delete({
          where: { userId },
        });

        // Recalculate room onlineCount
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

        return { success: true, left: true, remainingLeases: 0 };
      }

      // Single tab closed: remove only that tab's lease
      await tx.roomLease.deleteMany({
        where: { userId, tabId },
      });

      // Count remaining active leases for this user in this room
      const remainingLeases = await tx.roomLease.count({
        where: {
          userId,
          studyRoomId: roomId,
          expiresAt: { gt: now },
        },
      });

      if (remainingLeases === 0) {
        // Last tab closed: remove participant row
        await tx.roomParticipant.delete({
          where: { userId },
        });
      }

      // Recalculate room onlineCount
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

      return {
        success: true,
        left: remainingLeases === 0,
        remainingLeases,
      };
    });
  },

  /**
   * Periodic reconciliation worker task.
   * Cleans up expired leases, evicts ghost participants, and repairs online counts.
   */
  async reconcileExpiredLeases(): Promise<{
    evictedLeasesCount: number;
    evictedParticipantsCount: number;
    updatedRoomsCount: number;
  }> {
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      // 1. Delete all expired leases
      const deleteResult = await tx.roomLease.deleteMany({
        where: {
          expiresAt: { lte: now },
        },
      });

      // 2. Find all participants who now have zero active leases
      const allParticipants = await tx.roomParticipant.findMany({
        select: { id: true, userId: true, studyRoomId: true },
      });

      const activeLeases = await tx.roomLease.findMany({
        where: { expiresAt: { gt: now } },
        select: { userId: true, studyRoomId: true },
      });

      const activeUserRoomSet = new Set(activeLeases.map((l) => `${l.userId}:${l.studyRoomId}`));
      const ghostParticipants = allParticipants.filter(
        (p) => !activeUserRoomSet.has(`${p.userId}:${p.studyRoomId}`)
      );

      if (ghostParticipants.length > 0) {
        await tx.roomParticipant.deleteMany({
          where: {
            id: { in: ghostParticipants.map((p) => p.id) },
          },
        });
      }

      // 3. Recalculate and repair onlineCount for all rooms
      const allRooms = await tx.studyRoom.findMany({ select: { id: true } });
      let updatedRoomsCount = 0;

      for (const room of allRooms) {
        const activeUsers = await tx.roomLease.groupBy({
          by: ['userId'],
          where: {
            studyRoomId: room.id,
            expiresAt: { gt: now },
          },
        });

        await tx.studyRoom.update({
          where: { id: room.id },
          data: { onlineCount: activeUsers.length },
        });
        updatedRoomsCount++;
      }

      return {
        evictedLeasesCount: deleteResult.count,
        evictedParticipantsCount: ghostParticipants.length,
        updatedRoomsCount,
      };
    });
  },
};
