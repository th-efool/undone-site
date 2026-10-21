import 'server-only';
import { randomUUID } from 'crypto';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export class SessionConflictError extends Error {
  readonly status = 409;
  constructor(message = 'Session version conflict') {
    super(message);
    this.name = 'SessionConflictError';
  }
}

export interface StudySessionDTO {
  id: string;
  userId: string;
  studyRoomId: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'INTERRUPTED';
  targetDurationSeconds: number;
  elapsedSeconds: number;
  startedAt: string;
  resumedAt: string | null;
  pausedAt: string | null;
  deadline: string | null;
  endedAt: string | null;
  version: number;
  serverTime: string;
}

export function formatSessionDTO(session: {
  id: string;
  userId: string;
  studyRoomId?: string | null;
  status: string;
  targetDurationSeconds: number;
  elapsedSeconds: number;
  startedAt: Date | string;
  resumedAt?: Date | string | null;
  pausedAt?: Date | string | null;
  deadline?: Date | string | null;
  endedAt?: Date | string | null;
  version: number;
}): StudySessionDTO {
  return {
    id: session.id,
    userId: session.userId,
    studyRoomId: session.studyRoomId ?? null,
    status: session.status as StudySessionDTO['status'],
    targetDurationSeconds: session.targetDurationSeconds,
    elapsedSeconds: session.elapsedSeconds,
    startedAt: session.startedAt instanceof Date ? session.startedAt.toISOString() : session.startedAt,
    resumedAt: session.resumedAt instanceof Date ? session.resumedAt.toISOString() : session.resumedAt ?? null,
    pausedAt: session.pausedAt instanceof Date ? session.pausedAt.toISOString() : session.pausedAt ?? null,
    deadline: session.deadline instanceof Date ? session.deadline.toISOString() : session.deadline ?? null,
    endedAt: session.endedAt instanceof Date ? session.endedAt.toISOString() : session.endedAt ?? null,
    version: session.version,
    serverTime: new Date().toISOString(),
  };
}

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function emitSessionUpdatedEvent(
  tx: PrismaTransactionClient,
  userId: string,
  sessionDto: StudySessionDTO
): Promise<void> {
  if (!tx.realtimeStream?.findUnique || !tx.realtimeEvent?.create) return;

  try {
    let stream = await tx.realtimeStream.findUnique({
      where: { userId },
    });

    if (!stream && tx.realtimeStream.create) {
      stream = await tx.realtimeStream.create({
        data: {
          userId,
          generation: 1,
          eventCounter: 1,
        },
      });
    } else if (stream && tx.realtimeStream.update) {
      stream = await tx.realtimeStream.update({
        where: { id: stream.id },
        data: { eventCounter: { increment: 1 } },
      });
    }

    if (stream) {
      const eventId = randomUUID();
      await tx.realtimeEvent.create({
        data: {
          streamId: stream.id,
          sequence: stream.eventCounter,
          eventId,
          schemaVersion: 1,
          type: 'study.session.updated',
          generation: stream.generation,
          entityId: sessionDto.id,
          entityRevision: sessionDto.version,
          payload: sessionDto as unknown as Prisma.InputJsonValue,
        },
      });

      if (tx.realtimeDelivery?.create) {
        await tx.realtimeDelivery.create({
          data: {
            eventId,
            destination: `user:${userId}:g${stream.generation}`,
            status: 'PENDING',
          },
        });
      }
    }
  } catch (err) {
    console.warn('Failed to emit study.session.updated outbox event:', err);
  }
}

export const sessionService = {
  /**
   * Starts a focus session. Enforces at most 1 active/paused session per user globally.
   * If an existing active session has expired past its deadline, finalizes it first.
   * If an active or paused session already exists, returns it idempotently.
   */
  async startSession(params: {
    userId: string;
    roomId?: string | null;
    targetDurationSeconds: number;
  }): Promise<StudySessionDTO> {
    const { userId, roomId, targetDurationSeconds } = params;
    const duration = Math.max(60, Math.min(14400, targetDurationSeconds)); // 1 min to 4 hours

    return prisma.$transaction(async (tx) => {
      let existing = await tx.studySession.findFirst({
        where: {
          userId,
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Auto-finalize if existing active session has passed deadline
      if (existing && existing.status === 'ACTIVE' && existing.deadline) {
        const now = new Date();
        if (now >= new Date(existing.deadline)) {
          await tx.studySession.update({
            where: { id: existing.id },
            data: {
              status: 'COMPLETED',
              elapsedSeconds: existing.targetDurationSeconds,
              endedAt: existing.deadline,
              deadline: null,
              version: { increment: 1 },
            },
          });
          existing = null;
        }
      }

      if (existing) {
        return formatSessionDTO(existing);
      }

      const now = new Date();
      const deadline = new Date(now.getTime() + duration * 1000);

      const created = await tx.studySession.create({
        data: {
          userId,
          studyRoomId: roomId ?? null,
          status: 'ACTIVE',
          targetDurationSeconds: duration,
          elapsedSeconds: 0,
          startedAt: now,
          resumedAt: now,
          deadline,
          version: 1,
        },
      });

      const dto = formatSessionDTO(created);
      await emitSessionUpdatedEvent(tx, userId, dto);
      return dto;
    });
  },

  /**
   * Pauses an active session. Calculates elapsed seconds and clears the deadline.
   * Enforces expected version if provided.
   */
  async pauseSession(params: {
    userId: string;
    sessionId: string;
    expectedVersion?: number;
  }): Promise<StudySessionDTO> {
    const { userId, sessionId, expectedVersion } = params;

    return prisma.$transaction(async (tx) => {
      const session = await tx.studySession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        throw new Error('Study session not found');
      }

      // Version conflict check
      if (expectedVersion !== undefined && session.version !== expectedVersion) {
        if (session.status === 'PAUSED') {
          return formatSessionDTO(session);
        }
        throw new SessionConflictError(
          `Session version mismatch: expected ${expectedVersion}, got ${session.version}`
        );
      }

      // Idempotent: already paused
      if (session.status === 'PAUSED') {
        return formatSessionDTO(session);
      }

      if (session.status !== 'ACTIVE') {
        throw new Error(`Cannot pause session in status ${session.status}`);
      }

      const now = new Date();
      const lastActiveTime = session.resumedAt ? new Date(session.resumedAt) : new Date(session.startedAt);
      const additionalElapsed = Math.max(0, Math.floor((now.getTime() - lastActiveTime.getTime()) / 1000));
      const totalElapsed = Math.min(session.targetDurationSeconds, session.elapsedSeconds + additionalElapsed);

      const updated = await tx.studySession.update({
        where: { id: sessionId },
        data: {
          status: 'PAUSED',
          elapsedSeconds: totalElapsed,
          pausedAt: now,
          deadline: null,
          version: { increment: 1 },
        },
      });

      const dto = formatSessionDTO(updated);
      await emitSessionUpdatedEvent(tx, userId, dto);
      return dto;
    });
  },

  /**
   * Resumes a paused session. Recomputes deadline based on remaining duration.
   * Enforces expected version if provided.
   */
  async resumeSession(params: {
    userId: string;
    sessionId: string;
    expectedVersion?: number;
  }): Promise<StudySessionDTO> {
    const { userId, sessionId, expectedVersion } = params;

    return prisma.$transaction(async (tx) => {
      const session = await tx.studySession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        throw new Error('Study session not found');
      }

      // Version conflict check
      if (expectedVersion !== undefined && session.version !== expectedVersion) {
        if (session.status === 'ACTIVE') {
          return formatSessionDTO(session);
        }
        throw new SessionConflictError(
          `Session version mismatch: expected ${expectedVersion}, got ${session.version}`
        );
      }

      // Idempotent: already active
      if (session.status === 'ACTIVE') {
        return formatSessionDTO(session);
      }

      if (session.status !== 'PAUSED') {
        throw new Error(`Cannot resume session in status ${session.status}`);
      }

      const now = new Date();
      const remainingSeconds = Math.max(0, session.targetDurationSeconds - session.elapsedSeconds);
      const deadline = new Date(now.getTime() + remainingSeconds * 1000);

      const updated = await tx.studySession.update({
        where: { id: sessionId },
        data: {
          status: 'ACTIVE',
          resumedAt: now,
          pausedAt: null,
          deadline,
          version: { increment: 1 },
        },
      });

      const dto = formatSessionDTO(updated);
      await emitSessionUpdatedEvent(tx, userId, dto);
      return dto;
    });
  },

  /**
   * Completes a session. Calculates honest elapsed time without inflating early completions.
   * Enforces expected version if provided. Two simultaneous calls idempotently persist one terminal result.
   */
  async completeSession(params: {
    userId: string;
    sessionId: string;
    expectedVersion?: number;
  }): Promise<StudySessionDTO> {
    const { userId, sessionId, expectedVersion } = params;

    return prisma.$transaction(async (tx) => {
      const session = await tx.studySession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        throw new Error('Study session not found');
      }

      // Version conflict check
      if (expectedVersion !== undefined && session.version !== expectedVersion) {
        if (session.status === 'COMPLETED') {
          return formatSessionDTO(session);
        }
        throw new SessionConflictError(
          `Session version mismatch: expected ${expectedVersion}, got ${session.version}`
        );
      }

      // Idempotent terminal transition: if already completed, return existing
      if (session.status === 'COMPLETED') {
        return formatSessionDTO(session);
      }

      if (session.status === 'INTERRUPTED') {
        throw new Error('Cannot complete an interrupted session');
      }

      const now = new Date();
      let actualElapsed = session.elapsedSeconds;

      if (session.status === 'ACTIVE') {
        const lastActiveTime = session.resumedAt ? new Date(session.resumedAt) : new Date(session.startedAt);
        const additionalElapsed = Math.max(0, Math.floor((now.getTime() - lastActiveTime.getTime()) / 1000));
        actualElapsed = Math.min(session.targetDurationSeconds, session.elapsedSeconds + additionalElapsed);

        if (session.deadline && now >= new Date(session.deadline)) {
          actualElapsed = session.targetDurationSeconds;
        }
      } else if (session.status === 'PAUSED') {
        actualElapsed = Math.min(session.targetDurationSeconds, session.elapsedSeconds);
      }

      const updated = await tx.studySession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          elapsedSeconds: actualElapsed,
          endedAt: now,
          deadline: null,
          version: { increment: 1 },
        },
      });

      const dto = formatSessionDTO(updated);
      await emitSessionUpdatedEvent(tx, userId, dto);
      return dto;
    });
  },

  /**
   * Interrupts/aborts a session. Terminal transition with honest elapsed time.
   * Enforces expected version if provided.
   */
  async interruptSession(params: {
    userId: string;
    sessionId: string;
    expectedVersion?: number;
  }): Promise<StudySessionDTO> {
    const { userId, sessionId, expectedVersion } = params;

    return prisma.$transaction(async (tx) => {
      const session = await tx.studySession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        throw new Error('Study session not found');
      }

      if (expectedVersion !== undefined && session.version !== expectedVersion) {
        if (session.status === 'INTERRUPTED') {
          return formatSessionDTO(session);
        }
        throw new SessionConflictError(
          `Session version mismatch: expected ${expectedVersion}, got ${session.version}`
        );
      }

      if (session.status === 'INTERRUPTED' || session.status === 'COMPLETED') {
        return formatSessionDTO(session);
      }

      const now = new Date();
      let actualElapsed = session.elapsedSeconds;
      if (session.status === 'ACTIVE') {
        const lastActiveTime = session.resumedAt ? new Date(session.resumedAt) : new Date(session.startedAt);
        const additionalElapsed = Math.max(0, Math.floor((now.getTime() - lastActiveTime.getTime()) / 1000));
        actualElapsed = Math.min(session.targetDurationSeconds, session.elapsedSeconds + additionalElapsed);
      }

      const updated = await tx.studySession.update({
        where: { id: sessionId },
        data: {
          status: 'INTERRUPTED',
          elapsedSeconds: actualElapsed,
          endedAt: now,
          deadline: null,
          version: { increment: 1 },
        },
      });

      const dto = formatSessionDTO(updated);
      await emitSessionUpdatedEvent(tx, userId, dto);
      return dto;
    });
  },

  /**
   * Returns current active or paused session for a user, or null if none.
   * If an active session has passed its deadline, auto-finalizes it to COMPLETED.
   */
  async getActiveSession(userId: string): Promise<StudySessionDTO | null> {
    const session = await prisma.studySession.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) return null;

    // Guarded reconciliation: if ACTIVE and deadline has passed, finalize to COMPLETED
    if (session.status === 'ACTIVE' && session.deadline) {
      const now = new Date();
      if (now >= new Date(session.deadline)) {
        await prisma.studySession.update({
          where: { id: session.id },
          data: {
            status: 'COMPLETED',
            elapsedSeconds: session.targetDurationSeconds,
            endedAt: session.deadline,
            deadline: null,
            version: { increment: 1 },
          },
        });
        return null;
      }
    }

    return formatSessionDTO(session);
  },

  /**
   * Finalizes expired active sessions whose deadline has passed.
   */
  async reconcileExpiredSessions(limit = 100): Promise<number> {
    const now = new Date();
    const expired = await prisma.studySession.findMany({
      where: {
        status: 'ACTIVE',
        deadline: { lte: now },
      },
      take: limit,
    });

    for (const sess of expired) {
      await prisma.studySession.update({
        where: { id: sess.id },
        data: {
          status: 'COMPLETED',
          elapsedSeconds: sess.targetDurationSeconds,
          endedAt: sess.deadline ?? now,
          deadline: null,
          version: { increment: 1 },
        },
      });
    }

    return expired.length;
  },

  /**
   * Returns paginated focus session history for a user.
   */
  async getSessionHistory(params: {
    userId: string;
    cursor?: string;
    limit?: number;
  }): Promise<{
    sessions: StudySessionDTO[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));

    const items = await prisma.studySession.findMany({
      where: { userId: params.userId },
      take: limit + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      skip: params.cursor ? 1 : 0,
      orderBy: { createdAt: 'desc' },
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id ?? null;
    }

    return {
      sessions: items.map(formatSessionDTO),
      nextCursor,
    };
  },
};
