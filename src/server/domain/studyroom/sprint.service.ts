import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import {
  type RoomSprintSnapshot,
  type StartSprintInput,
  type ControlSprintInput,
  type SprintStatus,
} from './sprint.contracts';
import { MessagingConflictError, MessagingForbiddenError, MessagingNotFoundError } from '../messaging/contracts';

const MIN_SPRINT_DURATION_SEC = 60; // 1 minute
const MAX_SPRINT_DURATION_SEC = 7200; // 2 hours
const DEFAULT_SPRINT_DURATION_SEC = 1500; // 25 minutes

export const sprintService = {
  /**
   * Resolves a room by ID or slug.
   */
  async resolveRoom(roomSlugOrId: string) {
    let room = await prisma.studyRoom.findUnique({
      where: { id: roomSlugOrId },
    });

    if (!room) {
      const rooms = await prisma.studyRoom.findMany();
      room = rooms.find(
        (r) =>
          r.id === roomSlugOrId ||
          r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') === roomSlugOrId.toLowerCase()
      ) ?? null;
    }

    return room;
  },

  /**
   * Evaluates if a user has controller/moderator authority in a study room.
   */
  async isRoomController(roomId: string, userId: string): Promise<boolean> {
    // 1. Direct RoomController role check
    const controller = await prisma.roomController.findUnique({
      where: {
        studyRoomId_userId: {
          studyRoomId: roomId,
          userId,
        },
      },
    });

    if (controller && ['OWNER', 'MODERATOR', 'HOST'].includes(controller.role)) {
      return true;
    }

    // 2. Direct room owner check
    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
      select: { ownerId: true, cohortId: true },
    });

    if (room?.ownerId && room.ownerId === userId) {
      return true;
    }

    // 3. Cohort governance check
    if (room?.cohortId) {
      const cohort = await prisma.cohort.findUnique({
        where: { id: room.cohortId },
        select: { creatorId: true },
      });
      if (cohort?.creatorId === userId) {
        return true;
      }
      const membership = await prisma.cohortMember.findUnique({
        where: { cohortId_userId: { cohortId: room.cohortId, userId } },
        select: { role: true },
      });
      if (membership && (membership.role === 'CREATOR' || membership.role === 'MODERATOR')) {
        return true;
      }
    } else {
      const channel = await prisma.channel.findFirst({
        where: { studyRoomId: roomId },
        include: {
          community: {
            include: {
              cohort: { select: { creatorId: true } },
            },
          },
        },
      });

      if (channel?.community?.cohort?.creatorId === userId) {
        return true;
      }
    }

    // Insecure fallback to any participant when 0 controllers exist is explicitly REMOVED.
    return false;
  },

  /**
   * Starts a shared room sprint.
   */
  async startSprint(input: StartSprintInput): Promise<RoomSprintSnapshot> {
    const { userId, roomId, title } = input;
    const targetDurationSeconds = Math.max(
      MIN_SPRINT_DURATION_SEC,
      Math.min(MAX_SPRINT_DURATION_SEC, input.targetDurationSeconds ?? DEFAULT_SPRINT_DURATION_SEC)
    );

    const isController = await this.isRoomController(roomId, userId);
    if (!isController) {
      throw new MessagingForbiddenError('Only room controllers or moderators can start a sprint');
    }

    const room = await prisma.studyRoom.findUnique({
      where: { id: roomId },
    });
    if (!room) {
      throw new MessagingNotFoundError('Study room not found');
    }

    // Check if an ACTIVE or PAUSED sprint already exists
    const existing = await prisma.roomSprint.findFirst({
      where: {
        studyRoomId: roomId,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
    });

    const now = new Date();

    if (existing) {
      // Check if existing sprint has already expired past its deadline
      if (existing.status === 'ACTIVE' && existing.deadline && existing.deadline <= now) {
        // Complete it automatically
        await this.completeSprint(existing.id);
      } else {
        throw new MessagingConflictError('A shared sprint is already in progress in this room');
      }
    }

    const deadline = new Date(now.getTime() + targetDurationSeconds * 1000);

    const sprint = await prisma.$transaction(async (tx) => {
      const created = await tx.roomSprint.create({
        data: {
          studyRoomId: roomId,
          creatorId: userId,
          title: title?.trim() || null,
          targetDurationSeconds,
          elapsedSeconds: 0,
          status: 'ACTIVE',
          startedAt: now,
          resumedAt: now,
          deadline,
          version: 1,
          revision: 1,
        },
      });

      // Auto-join creator
      await tx.roomSprintParticipant.create({
        data: {
          sprintId: created.id,
          userId,
          status: 'JOINED',
          joinedAt: now,
        },
      });

      return created;
    });

    return this.getSprintSnapshot(sprint.id);
  },

  /**
   * Joins an active or paused room sprint.
   */
  async joinSprint(userId: string, sprintId: string): Promise<RoomSprintSnapshot> {
    const sprint = await prisma.roomSprint.findUnique({
      where: { id: sprintId },
    });

    if (!sprint) {
      throw new MessagingNotFoundError('Sprint not found');
    }

    if (!['ACTIVE', 'PAUSED'].includes(sprint.status)) {
      throw new MessagingConflictError('Cannot join a sprint that has ended');
    }

    // User must be an active participant in this study room
    const participant = await prisma.roomParticipant.findFirst({
      where: { studyRoomId: sprint.studyRoomId, userId },
    });

    if (!participant) {
      throw new MessagingForbiddenError('You must join the study room before participating in its sprint');
    }

    await prisma.roomSprintParticipant.upsert({
      where: {
        sprintId_userId: {
          sprintId,
          userId,
        },
      },
      create: {
        sprintId,
        userId,
        status: 'JOINED',
        joinedAt: new Date(),
      },
      update: {
        status: 'JOINED',
        leftAt: null,
      },
    });

    return this.getSprintSnapshot(sprintId);
  },

  /**
   * Leaves a room sprint.
   */
  async leaveSprint(userId: string, sprintId: string): Promise<{ success: boolean }> {
    const participant = await prisma.roomSprintParticipant.findUnique({
      where: {
        sprintId_userId: {
          sprintId,
          userId,
        },
      },
    });

    if (!participant || participant.status === 'LEFT') {
      return { success: true };
    }

    await prisma.roomSprintParticipant.update({
      where: {
        sprintId_userId: {
          sprintId,
          userId,
        },
      },
      data: {
        status: 'LEFT',
        leftAt: new Date(),
      },
    });

    return { success: true };
  },

  /**
   * Pauses an active sprint with revision checking.
   */
  async pauseSprint(input: ControlSprintInput): Promise<RoomSprintSnapshot> {
    const { userId, sprintId, expectedRevision } = input;

    const sprint = await prisma.roomSprint.findUnique({
      where: { id: sprintId },
    });

    if (!sprint) {
      throw new MessagingNotFoundError('Sprint not found');
    }

    const isController = await this.isRoomController(sprint.studyRoomId, userId);
    if (!isController) {
      throw new MessagingForbiddenError('Only room controllers can pause the sprint');
    }

    if (sprint.revision !== expectedRevision) {
      throw new MessagingConflictError('Sprint revision conflict; please refresh sprint status');
    }

    if (sprint.status !== 'ACTIVE') {
      throw new MessagingConflictError(`Cannot pause sprint in status ${sprint.status}`);
    }

    const now = new Date();
    const lastActiveStart = sprint.resumedAt || sprint.startedAt;
    const additionalElapsed = Math.max(0, Math.floor((now.getTime() - lastActiveStart.getTime()) / 1000));
    const newElapsedSeconds = sprint.elapsedSeconds + additionalElapsed;

    await prisma.roomSprint.update({
      where: { id: sprintId },
      data: {
        status: 'PAUSED',
        pausedAt: now,
        deadline: null,
        elapsedSeconds: newElapsedSeconds,
        revision: { increment: 1 },
      },
    });

    return this.getSprintSnapshot(sprintId);
  },

  /**
   * Resumes a paused sprint with revision checking.
   */
  async resumeSprint(input: ControlSprintInput): Promise<RoomSprintSnapshot> {
    const { userId, sprintId, expectedRevision } = input;

    const sprint = await prisma.roomSprint.findUnique({
      where: { id: sprintId },
    });

    if (!sprint) {
      throw new MessagingNotFoundError('Sprint not found');
    }

    const isController = await this.isRoomController(sprint.studyRoomId, userId);
    if (!isController) {
      throw new MessagingForbiddenError('Only room controllers can resume the sprint');
    }

    if (sprint.revision !== expectedRevision) {
      throw new MessagingConflictError('Sprint revision conflict; please refresh sprint status');
    }

    if (sprint.status !== 'PAUSED') {
      throw new MessagingConflictError(`Cannot resume sprint in status ${sprint.status}`);
    }

    const now = new Date();
    const remainingSeconds = Math.max(0, sprint.targetDurationSeconds - sprint.elapsedSeconds);

    if (remainingSeconds <= 0) {
      await this.completeSprint(sprintId);
      return this.getSprintSnapshot(sprintId);
    }

    const newDeadline = new Date(now.getTime() + remainingSeconds * 1000);

    await prisma.roomSprint.update({
      where: { id: sprintId },
      data: {
        status: 'ACTIVE',
        resumedAt: now,
        pausedAt: null,
        deadline: newDeadline,
        revision: { increment: 1 },
      },
    });

    return this.getSprintSnapshot(sprintId);
  },

  /**
   * Stops/cancels a sprint with revision checking.
   */
  async stopSprint(input: ControlSprintInput): Promise<RoomSprintSnapshot> {
    const { userId, sprintId, expectedRevision } = input;

    const sprint = await prisma.roomSprint.findUnique({
      where: { id: sprintId },
    });

    if (!sprint) {
      throw new MessagingNotFoundError('Sprint not found');
    }

    const isController = await this.isRoomController(sprint.studyRoomId, userId);
    if (!isController) {
      throw new MessagingForbiddenError('Only room controllers can stop the sprint');
    }

    if (sprint.revision !== expectedRevision) {
      throw new MessagingConflictError('Sprint revision conflict; please refresh sprint status');
    }

    if (!['ACTIVE', 'PAUSED'].includes(sprint.status)) {
      throw new MessagingConflictError('Sprint has already ended');
    }

    const now = new Date();

    await prisma.roomSprint.update({
      where: { id: sprintId },
      data: {
        status: 'CANCELLED',
        endedAt: now,
        deadline: null,
        revision: { increment: 1 },
      },
    });

    return this.getSprintSnapshot(sprintId);
  },

  /**
   * Atomically completes a sprint once and marks participants completed.
   */
  async completeSprint(sprintId: string): Promise<RoomSprintSnapshot> {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const sprint = await tx.roomSprint.findUnique({
        where: { id: sprintId },
      });

      if (!sprint || ['COMPLETED', 'CANCELLED'].includes(sprint.status)) {
        return;
      }

      await tx.roomSprint.update({
        where: { id: sprintId },
        data: {
          status: 'COMPLETED',
          endedAt: now,
          deadline: null,
          elapsedSeconds: sprint.targetDurationSeconds,
          revision: { increment: 1 },
        },
      });

      await tx.roomSprintParticipant.updateMany({
        where: {
          sprintId,
          status: 'JOINED',
        },
        data: {
          status: 'COMPLETED',
          completedAt: now,
        },
      });
    });

    return this.getSprintSnapshot(sprintId);
  },

  /**
   * Retrieves the authoritative sprint snapshot by sprintId.
   */
  async getSprintSnapshot(sprintId: string): Promise<RoomSprintSnapshot> {
    const sprint = await prisma.roomSprint.findUnique({
      where: { id: sprintId },
      include: {
        participants: {
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
        },
      },
    });

    if (!sprint) {
      throw new MessagingNotFoundError('Sprint not found');
    }

    const now = new Date();

    // Check if ACTIVE sprint has passed its deadline
    if (sprint.status === 'ACTIVE' && sprint.deadline && now >= sprint.deadline) {
      return this.completeSprint(sprintId);
    }

    let remainingSeconds = 0;
    if (sprint.status === 'ACTIVE' && sprint.deadline) {
      remainingSeconds = Math.max(0, Math.floor((sprint.deadline.getTime() - now.getTime()) / 1000));
    } else if (sprint.status === 'PAUSED') {
      remainingSeconds = Math.max(0, sprint.targetDurationSeconds - sprint.elapsedSeconds);
    }

    const participants = sprint.participants.map((p) => ({
      userId: p.user.id,
      name: p.user.name || p.user.username || 'Peer',
      username: p.user.username || '',
      image: p.user.image || '/undone-logo.svg',
      status: p.status,
      joinedAt: p.joinedAt.toISOString(),
    }));

    return {
      id: sprint.id,
      studyRoomId: sprint.studyRoomId,
      creatorId: sprint.creatorId,
      title: sprint.title,
      targetDurationSeconds: sprint.targetDurationSeconds,
      elapsedSeconds: sprint.elapsedSeconds,
      remainingSeconds,
      status: sprint.status as SprintStatus,
      startedAt: sprint.startedAt.toISOString(),
      deadline: sprint.deadline ? sprint.deadline.toISOString() : null,
      pausedAt: sprint.pausedAt ? sprint.pausedAt.toISOString() : null,
      endedAt: sprint.endedAt ? sprint.endedAt.toISOString() : null,
      version: sprint.version,
      revision: sprint.revision,
      participantCount: participants.filter((p) => p.status === 'JOINED' || p.status === 'COMPLETED').length,
      participants,
    };
  },

  /**
   * Retrieves the current active or latest sprint for a study room.
   */
  async getCurrentRoomSprint(roomId: string): Promise<RoomSprintSnapshot | null> {
    const latestSprint = await prisma.roomSprint.findFirst({
      where: {
        studyRoomId: roomId,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, deadline: true },
    });

    if (!latestSprint) {
      return null;
    }

    const now = new Date();
    if (latestSprint.status === 'ACTIVE' && latestSprint.deadline && now >= latestSprint.deadline) {
      return this.completeSprint(latestSprint.id);
    }

    return this.getSprintSnapshot(latestSprint.id);
  },
};
