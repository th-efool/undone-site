import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

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

export function formatSessionDTO(session: any): StudySessionDTO {
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

export const sessionService = {
  /**
   * Starts a focus session. Enforces at most 1 active/paused session per user globally.
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
      // Check for existing active or paused session
      const existing = await tx.studySession.findFirst({
        where: {
          userId,
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
        orderBy: { createdAt: 'desc' },
      });

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

      return formatSessionDTO(created);
    });
  },

  /**
   * Pauses an active session. Calculates elapsed seconds and clears the deadline.
   */
  async pauseSession(params: {
    userId: string;
    sessionId: string;
  }): Promise<StudySessionDTO> {
    const { userId, sessionId } = params;

    return prisma.$transaction(async (tx) => {
      const session = await tx.studySession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        throw new Error('Study session not found');
      }

      // Idempotent: already paused
      if (session.status === 'PAUSED') {
        return formatSessionDTO(session);
      }

      if (session.status !== 'ACTIVE') {
        throw new Error(`Cannot pause session in status ${session.status}`);
      }

      const now = new Date();
      const lastActiveTime = session.resumedAt || session.startedAt;
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

      return formatSessionDTO(updated);
    });
  },

  /**
   * Resumes a paused session. Recomputes deadline based on remaining duration.
   */
  async resumeSession(params: {
    userId: string;
    sessionId: string;
  }): Promise<StudySessionDTO> {
    const { userId, sessionId } = params;

    return prisma.$transaction(async (tx) => {
      const session = await tx.studySession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        throw new Error('Study session not found');
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

      return formatSessionDTO(updated);
    });
  },

  /**
   * Completes a session. Two simultaneous completions idempotently persist one terminal result.
   */
  async completeSession(params: {
    userId: string;
    sessionId: string;
  }): Promise<StudySessionDTO> {
    const { userId, sessionId } = params;

    return prisma.$transaction(async (tx) => {
      const session = await tx.studySession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        throw new Error('Study session not found');
      }

      // Idempotent terminal transition: if already completed, return existing
      if (session.status === 'COMPLETED') {
        return formatSessionDTO(session);
      }

      if (session.status === 'INTERRUPTED') {
        throw new Error('Cannot complete an interrupted session');
      }

      const now = new Date();
      const updated = await tx.studySession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          elapsedSeconds: session.targetDurationSeconds,
          endedAt: now,
          deadline: null,
          version: { increment: 1 },
        },
      });

      return formatSessionDTO(updated);
    });
  },

  /**
   * Interrupts/aborts a session. Terminal transition.
   */
  async interruptSession(params: {
    userId: string;
    sessionId: string;
  }): Promise<StudySessionDTO> {
    const { userId, sessionId } = params;

    return prisma.$transaction(async (tx) => {
      const session = await tx.studySession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        throw new Error('Study session not found');
      }

      if (session.status === 'INTERRUPTED' || session.status === 'COMPLETED') {
        return formatSessionDTO(session);
      }

      const now = new Date();
      const updated = await tx.studySession.update({
        where: { id: sessionId },
        data: {
          status: 'INTERRUPTED',
          endedAt: now,
          deadline: null,
          version: { increment: 1 },
        },
      });

      return formatSessionDTO(updated);
    });
  },

  /**
   * Returns current active or paused session for a user, or null if none.
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
    return formatSessionDTO(session);
  },
};
