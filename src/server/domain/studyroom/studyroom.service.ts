import 'server-only';
import { emitRoomChange } from './room-change';
import { lockRooms, lockUser, hasRoomAccess } from './room-access';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { studyroomPolicy, type RoomEntity } from './studyroom.policy';
import {
  type RoomRole,
  RoomNotFoundError,
  RoomForbiddenError,
  RoomQuotaExceededError,
} from '@/src/shared/studyroom/contracts';
import { studyRoomMetricsService } from './studyroom-metrics.service';

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

    if (_userId && !(await hasRoomAccess(actualRoomId,_userId))) throw new RoomForbiddenError('Active room membership required');

    // Query active participants who have at least one non-expired lease
    const participants = await prisma.roomParticipant.findMany({
      where: { studyRoomId: actualRoomId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
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
    const cohort = room.cohortId ? await prisma.cohort.findUnique({where:{id:room.cohortId},select:{creatorId:true}}) : null;
    const governors = room.cohortId ? await prisma.cohortMember.findMany({where:{cohortId:room.cohortId,userId:{in:userIds},role:{in:['CREATOR','MODERATOR']}},select:{userId:true}}) : [];
    const inherited = new Set([cohort?.creatorId,...governors.map(member=>member.userId)]);
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
        } else if (p.user.role === 'ADMIN' && !controllerMap.has(p.user.id)) {
          role = 'MODERATOR';
        } else if (inherited.has(p.user.id) && !controllerMap.has(p.user.id)) {
          role = 'MODERATOR';
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
          publicGoal: p.publicGoal ?? null,
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
      await lockUser(tx, userId);
      // 1. Verify target room exists
      let targetRoom = await findRoomByIdOrSlug(tx.studyRoom, roomId);
      if (!targetRoom) {
        throw new RoomNotFoundError('Study room not found');
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + LEASE_DURATION_MS);

      // 2. Check user's current room membership
      const currentParticipant = await tx.roomParticipant.findUnique({
        where: { userId },
      });

      await lockRooms(tx, [targetRoom.id, ...(currentParticipant ? [currentParticipant.studyRoomId] : [])]);
      targetRoom = await tx.studyRoom.findUniqueOrThrow({ where: { id: targetRoom.id } });
      const isAlreadyInTarget = currentParticipant?.studyRoomId === targetRoom.id &&
        Boolean(await tx.roomLease.findFirst({ where: { userId, studyRoomId: targetRoom.id, expiresAt: { gt: new Date() } } }));

      // 3. Eligibility & Capacity Check
      if (studyroomPolicy && typeof studyroomPolicy.resolveRoomEligibility === 'function') {
        const eligibility = await studyroomPolicy.resolveRoomEligibility(
          targetRoom as unknown as RoomEntity,
          userId,
          isAlreadyInTarget, tx
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
          publicGoal: params.publicGoal?.trim().slice(0,80) || null,
          generation,
          joinedAt: now,
        },
        update: {
          studyRoomId: targetRoom.id,
          publicGoal: params.publicGoal?.trim().slice(0,80) || (isAlreadyInTarget ? undefined : null),
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

      await lockUser(tx,userId);
      await lockRooms(tx,[actualRoomId]);
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

      if (!targetRoom || !(await studyroomPolicy.resolveRoomEligibility(targetRoom,userId,true,tx)).eligible) return { success: false, reason: 'not_in_room' };
      const renewed = await tx.roomLease.updateMany({
        where: { userId, tabId, studyRoomId: actualRoomId, generation, expiresAt: { gt: now } },
        data: { expiresAt },
      });
      if (!renewed.count) return { success: false, reason: 'not_in_room' };

      return {
        success: true,
        expiresAt: expiresAt.toISOString(),
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
      await lockUser(tx, userId);
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
      await lockRooms(tx, [roomId]);
      if (tabId && typeof generation !== 'number') return { success: true, left: false, remainingLeases: 0 };
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
          where: { userId, tabId, studyRoomId: roomId, generation },
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

    await prisma.$transaction(async tx => {
      await lockUser(tx, userId);
      await lockRooms(tx, [actualRoomId]);
      const lease = await tx.roomLease.findFirst({ where: { userId, tabId, generation, studyRoomId: actualRoomId, expiresAt: { gt: new Date() } } });
      if (!lease) throw new RoomForbiddenError('Room assignment expired');
      const changed = await tx.roomParticipant.updateMany({
        where: { userId, studyRoomId: actualRoomId, generation,
          ...(cleanedGoal === null ? { publicGoal: { not: null } } : { OR: [{publicGoal:null},{publicGoal:{not:cleanedGoal}}] }) },
        data: { publicGoal: cleanedGoal },
      });
      if (!changed.count) return;
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
    const cutoff = new Date(Date.now() - (options?.gracePeriodMs ?? 5000));
    const candidates = await prisma.roomLease.findMany({ where: { expiresAt: { lte: cutoff } },
      take: Math.max(1,Math.min(100, options?.batchSize ?? 50)), orderBy: {expiresAt:'asc'} });
    let evictedLeasesCount = 0;
    let evictedParticipantsCount = 0;
    const rooms = new Set<string>();
    for (const candidate of candidates) {
      const result = await prisma.$transaction(async tx => {
        await lockUser(tx, candidate.userId);
        await lockRooms(tx, [candidate.studyRoomId]);
        const removed = await tx.roomLease.deleteMany({ where: { id: candidate.id, expiresAt: {lte:cutoff} } });
        if (!removed.count) return null;
        const remaining = await tx.roomLease.count({where:{userId:candidate.userId, studyRoomId:candidate.studyRoomId, expiresAt:{gt:new Date()}}});
        if (remaining) return { evicted:0, changed:false };
        const people = await tx.roomParticipant.deleteMany({where:{userId:candidate.userId, studyRoomId:candidate.studyRoomId, generation:candidate.generation}});
        const live = await tx.roomLease.groupBy({by:['userId'],where:{studyRoomId:candidate.studyRoomId, expiresAt:{gt:new Date()}}});
        const updated = await tx.studyRoom.updateMany({where:{id:candidate.studyRoomId,onlineCount:{not:live.length}},data:{onlineCount:live.length}});
        if (people.count) await emitRoomChange(tx,candidate.studyRoomId,'room.participant.left',{userId:candidate.userId,reason:'LEASE_EXPIRED',onlineCount:live.length});
        else if (updated.count) await emitRoomChange(tx,candidate.studyRoomId,'room.roster.changed',{onlineCount:live.length});
        return { evicted:people.count, changed:Boolean(updated.count) };
      });
      if (result) {
        evictedLeasesCount++;
        evictedParticipantsCount += result.evicted;
        if (result.changed) rooms.add(candidate.studyRoomId);
      }
    }
    const durationMs = Date.now()-startTime;
    studyRoomMetricsService.recordReconciliation(evictedLeasesCount,durationMs);
    return {evictedLeasesCount,evictedParticipantsCount,updatedRoomsCount:rooms.size,durationMs};
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
