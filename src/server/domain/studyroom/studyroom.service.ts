import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

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
  joinedAt: string;
  tabCount: number;
}

export interface JoinRoomResult {
  success: boolean;
  roomId: string;
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
  async getRoomRoster(roomId: string, _userId: string): Promise<RoomRosterMember[]> {
    const now = new Date();

    // Query active participants who have at least one non-expired lease
    const participants = await prisma.roomParticipant.findMany({
      where: { studyRoomId: roomId },
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
        studyRoomId: roomId,
        userId: { in: userIds },
        expiresAt: { gt: now },
      },
      select: { userId: true },
    });

    const leaseCountMap = new Map<string, number>();
    for (const lease of activeLeases) {
      leaseCountMap.set(lease.userId, (leaseCountMap.get(lease.userId) ?? 0) + 1);
    }

    // Only return participants with active leases or recently joined
    return participants
      .filter((p) => (leaseCountMap.get(p.userId) ?? 0) > 0)
      .map((p) => ({
        id: p.id,
        userId: p.user.id,
        name: p.user.name || p.user.username || 'Peer',
        username: p.user.username || '',
        image: p.user.image || '/undone-logo.svg',
        joinedAt: p.joinedAt.toISOString(),
        tabCount: leaseCountMap.get(p.userId) ?? 1,
      }));
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
  }): Promise<JoinRoomResult> {
    const { userId, roomId } = params;
    const tabId = params.tabId || `tab-${randomUUID()}`;

    return prisma.$transaction(async (tx) => {
      // 1. Verify target room exists
      const targetRoom = await tx.studyRoom.findUnique({
        where: { id: roomId },
      });
      if (!targetRoom) {
        throw new Error('Study room not found');
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + LEASE_DURATION_MS);

      // 2. Check user's current room membership
      const currentParticipant = await tx.roomParticipant.findUnique({
        where: { userId },
      });

      let isSwitch = false;
      let generation = 1;

      if (currentParticipant) {
        if (currentParticipant.studyRoomId === roomId) {
          // Same room: retain generation, record new/renewed tab lease
          generation = currentParticipant.generation;
        } else {
          // Different room: switch rooms! Increment generation and evict old room
          isSwitch = true;
          generation = currentParticipant.generation + 1;
          const oldRoomId = currentParticipant.studyRoomId;

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

      // 3. Upsert RoomParticipant with current generation
      await tx.roomParticipant.upsert({
        where: { userId },
        create: {
          userId,
          studyRoomId: roomId,
          generation,
          joinedAt: now,
        },
        update: {
          studyRoomId: roomId,
          generation,
          updatedAt: now,
        },
      });

      // 4. Upsert RoomLease for this tab
      const lease = await tx.roomLease.upsert({
        where: {
          userId_tabId: {
            userId,
            tabId,
          },
        },
        create: {
          userId,
          studyRoomId: roomId,
          generation,
          tabId,
          expiresAt,
        },
        update: {
          studyRoomId: roomId,
          generation,
          expiresAt,
          updatedAt: now,
        },
      });

      // 5. Recalculate new room onlineCount based on distinct users with active leases
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
        roomId,
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
      const participant = await tx.roomParticipant.findUnique({
        where: { userId },
      });

      if (!participant || participant.studyRoomId !== roomId) {
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
          studyRoomId: roomId,
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
        expiresAt: lease.expiresAt.toISOString(),
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

      const roomId = params.roomId || participant.studyRoomId;
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
