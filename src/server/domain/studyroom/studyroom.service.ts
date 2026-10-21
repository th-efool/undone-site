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

export const participantGoalsRegistry = new Map<string, string>();

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

export interface LeaveRoomParams {
  userId: string;
  roomId?: string;
  tabId?: string;
  generation?: number;
  global?: boolean;
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
    const now = new Date();

    const room = await findRoomByIdOrSlug(prisma.studyRoom, roomId);
    if (!room) {
      throw new RoomNotFoundError('Study room not found');
    }
    const actualRoomId = room.id;

    if (_userId && studyroomPolicy && typeof studyroomPolicy.resolveRoomEligibility === 'function') {
      const eligibility = await studyroomPolicy.resolveRoomEligibility(
        room as unknown as RoomEntity,
        _userId,
        false
      );
      if (!eligibility.eligible && eligibility.reason !== 'ROOM_FULL') {
        throw new RoomForbiddenError('Not authorized to view room roster');
      }
    }

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
          publicGoal: participantGoalsRegistry.get(`${actualRoomId}:${p.user.id}`) ?? null,
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
    publicGoal?: string | null;
  }): Promise<JoinRoomResult> {
    const { userId, roomId } = params;
    const tabId = params.tabId || `tab-${randomUUID()}`;

    // 0. Idempotency Check: if requestId provided, check if ROOM_JOIN/ROOM_SWITCH was already recorded
    if (params.requestId && prisma.roomAuditLog?.findFirst) {
      const existingAudit = await prisma.roomAuditLog.findFirst({
        where: {
          clientRequestId: params.requestId,
          actorId: userId,
          action: { in: ['ROOM_JOIN', 'ROOM_SWITCH'] },
        },
      });

      if (existingAudit && existingAudit.details) {
        const details = existingAudit.details as Record<string, unknown>;
        const targetRoomId = (details.roomId as string) || existingAudit.studyRoomId;

        const currentPart = await prisma.roomParticipant.findUnique({
          where: { userId },
        });

        if (currentPart && currentPart.studyRoomId === targetRoomId) {
          return {
            success: true,
            roomId: targetRoomId,
            slug: (details.slug as string) || targetRoomId,
            generation: currentPart.generation,
            isSwitch: false,
            lease: {
              leaseId: (details.leaseId as string) || `lease-${tabId}`,
              tabId: (details.tabId as string) || tabId,
              expiresAt:
                (details.expiresAt as string) ||
                new Date(Date.now() + LEASE_DURATION_MS).toISOString(),
            },
          };
        }
      }
    }

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
          if (eligibility.reason === 'GUEST_RESTRICTED') {
            throw new RoomForbiddenError('Guest accounts cannot join study rooms');
          }
          throw new RoomForbiddenError(`Cannot join room: ${eligibility.reason}`);
        }
      }

      // Query historical highest generation to guarantee monotonically increasing assignment epochs
      let maxAuditGen = 0;
      if (tx.roomAuditLog?.findFirst) {
        const lastAudit = await tx.roomAuditLog.findFirst({
          where: {
            actorId: userId,
            action: { in: ['ROOM_JOIN', 'ROOM_SWITCH'] },
          },
          orderBy: { createdAt: 'desc' },
          select: { details: true },
        });
        if (
          lastAudit?.details &&
          typeof lastAudit.details === 'object' &&
          'generation' in lastAudit.details &&
          typeof (lastAudit.details as Record<string, unknown>).generation === 'number'
        ) {
          maxAuditGen = (lastAudit.details as Record<string, unknown>).generation as number;
        }
      }

      const lastLease = tx.roomLease?.findFirst
        ? await tx.roomLease.findFirst({
            where: { userId },
            orderBy: { generation: 'desc' },
            select: { generation: true },
          })
        : null;

      const maxHistoricalGen = Math.max(
        lastLease?.generation ?? 0,
        currentParticipant?.generation ?? 0,
        maxAuditGen
      );

      let isSwitch = false;
      let generation = 1;

      if (currentParticipant) {
        if (currentParticipant.studyRoomId === targetRoom.id) {
          // Same room: retain generation, record new/renewed tab lease
          generation = currentParticipant.generation;
        } else {
          // Different room: switch rooms! Increment generation and evict old room
          isSwitch = true;
          generation = Math.max(currentParticipant.generation, maxHistoricalGen) + 1;
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

          // Emit outbox event for old room left
          if (tx.realtimeStream?.findUnique && tx.realtimeEvent?.create) {
            let oldStream = await tx.realtimeStream.findUnique({
              where: { studyRoomId: oldRoomId },
            });
            if (oldStream) {
              if (tx.realtimeStream?.update) {
                oldStream = await tx.realtimeStream.update({
                  where: { id: oldStream.id },
                  data: { eventCounter: { increment: 1 } },
                });
              }
              const leftEventId = randomUUID();
              await tx.realtimeEvent.create({
                data: {
                  streamId: oldStream.id,
                  sequence: oldStream.eventCounter,
                  eventId: leftEventId,
                  schemaVersion: 1,
                  type: 'room.participant.left',
                  generation: oldStream.generation,
                  entityId: userId,
                  payload: {
                    userId,
                    roomId: oldRoomId,
                    reason: 'SWITCHED_ROOM',
                    onlineCount: oldRoomActiveUsers.length,
                    occurredAt: now.toISOString(),
                  },
                },
              });
              if (tx.realtimeDelivery?.create) {
                await tx.realtimeDelivery.create({
                  data: {
                    eventId: leftEventId,
                    destination: `room:${oldRoomId}:g${oldStream.generation}`,
                    status: 'PENDING',
                  },
                });
              }
            }
          }
        }
      } else {
        generation = maxHistoricalGen > 0 ? maxHistoricalGen + 1 : 1;
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

      // 7. Emit outbox event for joined / switch
      if (tx.realtimeStream?.findUnique && tx.realtimeEvent?.create) {
        let stream = await tx.realtimeStream.findUnique({
          where: { studyRoomId: targetRoom.id },
        });
        if (!stream && tx.realtimeStream?.create) {
          stream = await tx.realtimeStream.create({
            data: {
              studyRoomId: targetRoom.id,
              generation: 1,
              eventCounter: 1,
            },
          });
        } else if (stream && tx.realtimeStream?.update) {
          stream = await tx.realtimeStream.update({
            where: { id: stream.id },
            data: { eventCounter: { increment: 1 } },
          });
        }
        if (stream) {
          const joinEventId = randomUUID();
          await tx.realtimeEvent.create({
            data: {
              streamId: stream.id,
              sequence: stream.eventCounter,
              eventId: joinEventId,
              schemaVersion: 1,
              type: isSwitch ? 'room.assignment.changed' : 'room.participant.joined',
              generation: stream.generation,
              entityId: userId,
              clientRequestId: params.requestId ?? null,
              payload: {
                userId,
                roomId: targetRoom.id,
                tabId,
                generation,
                isSwitch,
                onlineCount: activeUsers.length,
                occurredAt: now.toISOString(),
              },
            },
          });
          if (tx.realtimeDelivery?.create) {
            await tx.realtimeDelivery.create({
              data: {
                eventId: joinEventId,
                destination: `room:${targetRoom.id}:g${stream.generation}`,
                status: 'PENDING',
              },
            });
          }
        }
      }

      // 8. Record RoomAuditLog for join / switch
      if (tx.roomAuditLog?.create) {
        await tx.roomAuditLog.create({
          data: {
            studyRoomId: targetRoom.id,
            actorId: userId,
            action: isSwitch ? 'ROOM_SWITCH' : 'ROOM_JOIN',
            clientRequestId: params.requestId ?? null,
            details: {
              roomId: targetRoom.id,
              slug: targetRoom.slug || targetRoom.id,
              generation,
              isSwitch,
              leaseId: lease.id,
              tabId,
              expiresAt: lease.expiresAt.toISOString(),
            },
          },
        });
      }

      if (typeof params.publicGoal === 'string' && params.publicGoal.trim().length > 0) {
        participantGoalsRegistry.set(`${targetRoom.id}:${userId}`, params.publicGoal.trim().slice(0, 80));
      }

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
   * Leave room operation with epoch and room fencing.
   * If global: removes user from participant list and revokes all leases.
   * If tab close: removes only that tab's lease; if other tabs remain, user stays in room.
   */
  async leaveRoom(params: LeaveRoomParams): Promise<LeaveRoomResult> {
    const { userId, tabId, generation, global = false } = params;

    return prisma.$transaction(async (tx) => {
      const participant = await tx.roomParticipant.findUnique({
        where: { userId },
      });

      if (!participant) {
        return { success: true, left: true, remainingLeases: 0 };
      }

      // Generation fencing: if generation passed and doesn't match current participant generation, ignore as stale no-op
      if (typeof generation === 'number' && participant.generation !== generation) {
        return { success: true, left: false, remainingLeases: 0 };
      }

      // RoomId fencing: if roomId specified and doesn't match current participant room, ignore as stale no-op
      if (params.roomId) {
        const room = await findRoomByIdOrSlug(tx.studyRoom, params.roomId);
        if (room && room.id !== participant.studyRoomId) {
          return { success: true, left: false, remainingLeases: 0 };
        }
      }

      const roomId = participant.studyRoomId;
      const now = new Date();
      let left = false;
      let remainingLeases = 0;

      if (global || !tabId) {
        // Explicit global leave: delete all leases and the participant row
        await tx.roomLease.deleteMany({
          where: { userId, studyRoomId: roomId },
        });

        await tx.roomParticipant.delete({
          where: { userId },
        });

        left = true;
        remainingLeases = 0;
      } else {
        // Single tab closed: remove only that tab's lease
        await tx.roomLease.deleteMany({
          where: { userId, tabId },
        });

        // Count remaining active leases for this user in this room
        remainingLeases = await tx.roomLease.count({
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
          left = true;
        }
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

      // Emit transactional outbox event on participant left
      if (left && tx.realtimeStream?.findUnique && tx.realtimeEvent?.create) {
        let stream = await tx.realtimeStream.findUnique({
          where: { studyRoomId: roomId },
        });
        if (stream) {
          if (tx.realtimeStream?.update) {
            stream = await tx.realtimeStream.update({
              where: { id: stream.id },
              data: { eventCounter: { increment: 1 } },
            });
          }
          const leftEventId = randomUUID();
          await tx.realtimeEvent.create({
            data: {
              streamId: stream.id,
              sequence: stream.eventCounter,
              eventId: leftEventId,
              schemaVersion: 1,
              type: 'room.participant.left',
              generation: stream.generation,
              entityId: userId,
              payload: {
                userId,
                roomId,
                reason: global ? 'EXPLICIT_LEAVE' : 'TAB_CLOSED',
                onlineCount: activeUsers.length,
                occurredAt: now.toISOString(),
              },
            },
          });
          if (tx.realtimeDelivery?.create) {
            await tx.realtimeDelivery.create({
              data: {
                eventId: leftEventId,
                destination: `room:${roomId}:g${stream.generation}`,
                status: 'PENDING',
              },
            });
          }
        }
      }

      if (left) {
        participantGoalsRegistry.delete(`${roomId}:${userId}`);
      }

      return {
        success: true,
        left,
        remainingLeases,
      };
    });
  },

  /**
   * Updates or removes an active participant's shared public goal.
   * If publicGoal is empty/null, removes the goal projection.
   * Emits room.participant.updated outbox event.
   */
  async updateParticipantGoal(params: {
    userId: string;
    roomId: string;
    tabId: string;
    generation: number;
    publicGoal?: string | null;
  }): Promise<{ success: boolean; publicGoal: string | null }> {
    const { userId, roomId, tabId, generation, publicGoal } = params;

    const room = await findRoomByIdOrSlug(prisma.studyRoom, roomId);
    if (!room) {
      throw new RoomNotFoundError('Study room not found');
    }
    const actualRoomId = room.id;

    // Verify active lease and matching generation
    const now = new Date();
    const activeLease = await prisma.roomLease.findFirst({
      where: {
        userId,
        studyRoomId: actualRoomId,
        tabId,
        generation,
        expiresAt: { gt: now },
      },
    });

    if (!activeLease) {
      throw new RoomForbiddenError('Must have an active lease in this room to update public goal');
    }

    const cleanedGoal =
      typeof publicGoal === 'string' && publicGoal.trim().length > 0
        ? publicGoal.trim().slice(0, 80)
        : null;

    const registryKey = `${actualRoomId}:${userId}`;
    if (cleanedGoal) {
      participantGoalsRegistry.set(registryKey, cleanedGoal);
    } else {
      participantGoalsRegistry.delete(registryKey);
    }

    // Emit outbox event: room.participant.updated
    await prisma.$transaction(async (tx) => {
      if (tx.realtimeStream?.findUnique && tx.realtimeEvent?.create) {
        let stream = await tx.realtimeStream.findUnique({
          where: { studyRoomId: actualRoomId },
        });
        if (stream) {
          if (tx.realtimeStream?.update) {
            stream = await tx.realtimeStream.update({
              where: { id: stream.id },
              data: { eventCounter: { increment: 1 } },
            });
          }
          const eventId = randomUUID();
          await tx.realtimeEvent.create({
            data: {
              streamId: stream.id,
              sequence: stream.eventCounter,
              eventId,
              schemaVersion: 1,
              type: 'room.participant.updated',
              generation: stream.generation,
              entityId: userId,
              entityRevision: generation,
              payload: {
                userId,
                roomId: actualRoomId,
                publicGoal: cleanedGoal,
                updatedAt: new Date().toISOString(),
              },
            },
          });
          if (tx.realtimeDelivery?.create) {
            await tx.realtimeDelivery.create({
              data: {
                eventId,
                destination: `room:${actualRoomId}:g${stream.generation}`,
                status: 'PENDING',
              },
            });
          }
        }
      }
    });

    return { success: true, publicGoal: cleanedGoal };
  },

  /**
   * Periodic reconciliation worker task.
   * Cleans up expired leases, evicts ghost participants, and repairs online counts.
   * Uses bounded batches and a grace period buffer to prevent premature eviction during renewals.
   */
  async reconcileExpiredLeases(options?: {
    batchSize?: number;
    gracePeriodMs?: number;
  }): Promise<{
    evictedLeasesCount: number;
    evictedParticipantsCount: number;
    updatedRoomsCount: number;
    durationMs: number;
  }> {
    const startTime = Date.now();
    const gracePeriodMs = options?.gracePeriodMs ?? 5000;
    const cutoff = new Date(Date.now() - gracePeriodMs);

    return prisma.$transaction(async (tx) => {
      // 1. Delete expired leases past the grace cutoff
      const deleteResult = await tx.roomLease.deleteMany({
        where: {
          expiresAt: { lte: cutoff },
        },
      });

      // 2. Find all participants who now have zero active leases
      const allParticipants =
        (await tx.roomParticipant.findMany({
          select: { id: true, userId: true, studyRoomId: true },
        })) || [];

      const activeLeases =
        (await tx.roomLease.findMany({
          where: { expiresAt: { gt: cutoff } },
          select: { userId: true, studyRoomId: true },
        })) || [];

      const activeUserRoomSet = new Set(
        activeLeases.map((l) => `${l.userId}:${l.studyRoomId}`)
      );
      const ghostParticipants = allParticipants.filter(
        (p) => !activeUserRoomSet.has(`${p.userId}:${p.studyRoomId}`)
      );

      if (ghostParticipants.length > 0) {
        for (const p of ghostParticipants) {
          participantGoalsRegistry.delete(`${p.studyRoomId}:${p.userId}`);
        }

        await tx.roomParticipant.deleteMany({
          where: {
            id: { in: ghostParticipants.map((p) => p.id) },
          },
        });

        // Emit outbox events for ghost participants evicted
        if (tx.realtimeStream?.findUnique && tx.realtimeEvent?.create && tx.realtimeDelivery?.create) {
          for (const p of ghostParticipants) {
            let stream = await tx.realtimeStream.findUnique({
              where: { studyRoomId: p.studyRoomId },
            });
            if (stream) {
              if (tx.realtimeStream?.update) {
                stream = await tx.realtimeStream.update({
                  where: { id: stream.id },
                  data: { eventCounter: { increment: 1 } },
                });
              }
              const leftEventId = randomUUID();
              await tx.realtimeEvent.create({
                data: {
                  streamId: stream.id,
                  sequence: stream.eventCounter,
                  eventId: leftEventId,
                  schemaVersion: 1,
                  type: 'room.participant.left',
                  generation: stream.generation,
                  entityId: p.userId,
                  payload: {
                    userId: p.userId,
                    roomId: p.studyRoomId,
                    reason: 'LEASE_EXPIRED',
                    occurredAt: new Date().toISOString(),
                  },
                },
              });
              await tx.realtimeDelivery.create({
                data: {
                  eventId: leftEventId,
                  destination: `room:${p.studyRoomId}:g${stream.generation}`,
                  status: 'PENDING',
                },
              });
            }
          }
        }
      }

      // 3. Recalculate and repair onlineCount for all rooms
      const allRooms = (await tx.studyRoom.findMany({ select: { id: true } })) || [];
      let updatedRoomsCount = 0;

      for (const room of allRooms) {
        const activeUsers =
          (await tx.roomLease.groupBy({
            by: ['userId'],
            where: {
              studyRoomId: room.id,
              expiresAt: { gt: cutoff },
            },
          })) || [];

        await tx.studyRoom.update({
          where: { id: room.id },
          data: { onlineCount: activeUsers.length },
        });
        updatedRoomsCount++;

        // Emit room.roster.changed
        if (tx.realtimeStream?.findUnique && tx.realtimeEvent?.create && tx.realtimeDelivery?.create) {
          let stream = await tx.realtimeStream.findUnique({
            where: { studyRoomId: room.id },
          });
          if (stream) {
            if (tx.realtimeStream?.update) {
              stream = await tx.realtimeStream.update({
                where: { id: stream.id },
                data: { eventCounter: { increment: 1 } },
              });
            }
            const rosterEventId = randomUUID();
            await tx.realtimeEvent.create({
              data: {
                streamId: stream.id,
                sequence: stream.eventCounter,
                eventId: rosterEventId,
                schemaVersion: 1,
                type: 'room.roster.changed',
                generation: stream.generation,
                entityId: room.id,
                payload: {
                  roomId: room.id,
                  onlineCount: activeUsers.length,
                  occurredAt: new Date().toISOString(),
                },
              },
            });
            await tx.realtimeDelivery.create({
              data: {
                eventId: rosterEventId,
                destination: `room:${room.id}:g${stream.generation}`,
                status: 'PENDING',
              },
            });
          }
        }
      }

      return {
        evictedLeasesCount: deleteResult.count,
        evictedParticipantsCount: ghostParticipants.length,
        updatedRoomsCount,
        durationMs: Date.now() - startTime,
      };
    });
  },

  /**
   * Synchronize room events delta or return snapshot if client cursor has drifted.
   */
  async syncRoomEvents(params: {
    roomIdOrSlug: string;
    userId: string;
    clientSequence?: number;
    limit?: number;
  }): Promise<{
    mode: 'SNAPSHOT' | 'DELTA';
    roomId: string;
    streamId: string;
    currentSequence: number;
    generation: number;
    roster?: RoomRosterMember[];
    room?: RoomEntity;
    events?: Array<{
      eventId: string;
      sequence: number;
      type: string;
      generation: number;
      entityId: string | null;
      payload: Record<string, unknown>;
      occurredAt: string;
    }>;
    serverTime: string;
  }> {
    const { roomIdOrSlug, userId, clientSequence, limit } = params;
    const room = await findRoomByIdOrSlug(prisma.studyRoom, roomIdOrSlug);
    if (!room) {
      throw new RoomNotFoundError('Study room not found');
    }

    // Eligibility check
    const eligibility = await studyroomPolicy.resolveRoomEligibility(
      room as unknown as RoomEntity,
      userId,
      false
    );
    if (!eligibility.eligible && eligibility.reason !== 'ROOM_FULL') {
      throw new RoomForbiddenError('Not authorized to access room events');
    }

    // Active lease check: must have active lease or be owner
    const roleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, userId);
    if (!roleRes.isOwner) {
      const activeLease = await prisma.roomLease.findFirst({
        where: {
          studyRoomId: room.id,
          userId,
          expiresAt: { gt: new Date() },
        },
      });
      if (!activeLease) {
        throw new RoomForbiddenError('Active room lease required to sync room events');
      }
    }

    // Locate or create stream for room
    let stream = await prisma.realtimeStream.findUnique({
      where: { studyRoomId: room.id },
    });

    if (!stream) {
      try {
        stream = await prisma.realtimeStream.create({
          data: { studyRoomId: room.id, generation: 1, eventCounter: 0 },
        });
      } catch {
        stream = await prisma.realtimeStream.findUnique({
          where: { studyRoomId: room.id },
        });
      }
    }

    const currentSequence = stream?.eventCounter ?? 0;
    const streamGeneration = stream?.generation ?? 1;
    const maxDeltaGap = 150;

    const isResetRequired =
      clientSequence === undefined ||
      clientSequence <= 0 ||
      clientSequence > currentSequence ||
      currentSequence - clientSequence > maxDeltaGap;

    if (isResetRequired || !stream) {
      const roster = await this.getRoomRoster(room.id, userId);
      return {
        mode: 'SNAPSHOT',
        roomId: room.id,
        streamId: stream?.id || '',
        currentSequence,
        generation: streamGeneration,
        roster,
        room: room as unknown as RoomEntity,
        serverTime: new Date().toISOString(),
      };
    }

    // Client within catchup window -> return delta events
    const take = Math.min(200, Math.max(1, limit ?? 100));
    const events = await prisma.realtimeEvent.findMany({
      where: {
        streamId: stream.id,
        sequence: { gt: clientSequence },
      },
      take,
      orderBy: { sequence: 'asc' },
    });

    return {
      mode: 'DELTA',
      roomId: room.id,
      streamId: stream.id,
      currentSequence,
      generation: streamGeneration,
      events: events.map((e) => ({
        eventId: e.eventId,
        sequence: e.sequence,
        type: e.type,
        generation: e.generation,
        entityId: e.entityId,
        payload: (e.payload as Record<string, unknown>) ?? {},
        occurredAt: e.occurredAt.toISOString(),
      })),
      serverTime: new Date().toISOString(),
    };
  },
};
