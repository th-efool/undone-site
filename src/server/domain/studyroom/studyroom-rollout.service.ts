import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export type RolloutStage =
  | 'STAGE_0_PREFLIGHT'
  | 'STAGE_1_PROVISION'
  | 'STAGE_2_INTERNAL'
  | 'STAGE_3_COHORT_CANARY'
  | 'STAGE_4_GA';

export interface PreflightCheckResult {
  passed: boolean;
  databaseConnected: boolean;
  modelsPresent: boolean;
  outboxBacklog: number;
  realtimeConfigured: boolean;
  errors: string[];
}

export interface BaselineRoomDefinition {
  slug: string;
  title: string;
  description: string;
  capacity: number;
  atmospherePreset: string;
  defaultScene: string;
  defaultMusic: string;
}

export const BASELINE_STUDY_ROOMS: BaselineRoomDefinition[] = [
  {
    slug: 'fireplace',
    title: 'Cozy Fireplace',
    description: 'A warm hearth with cracking wood and quiet ambiance for deep work.',
    capacity: 25,
    atmospherePreset: 'fireplace',
    defaultScene: 'fireplace',
    defaultMusic: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
  },
  {
    slug: 'library',
    title: 'Old Oak Library',
    description: 'High ceilings, grand bookshelves, and gentle rain outside the tall windows.',
    capacity: 50,
    atmospherePreset: 'library',
    defaultScene: 'library',
    defaultMusic: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
  },
  {
    slug: 'developer-den',
    title: "Developer's Den",
    description: 'Neon ambient glow, mechanical keystrokes, and lo-fi beats for long coding sessions.',
    capacity: 35,
    atmospherePreset: 'lofi',
    defaultScene: 'developer-den',
    defaultMusic: 'https://www.youtube.com/watch?v=DWcJFNfaw9C',
  },
];

export const studyRoomRolloutService = {
  /**
   * Checks whether global emergency kill-switch is active.
   */
  isEmergencyKillSwitchActive(): boolean {
    return process.env.STUDYROOM_EMERGENCY_DISABLED === 'true';
  },

  /**
   * Runs non-destructive pre-flight checks against database models and configuration.
   */
  async runPreflightChecks(client = prisma): Promise<PreflightCheckResult> {
    const errors: string[] = [];
    let databaseConnected = false;
    let modelsPresent = false;
    let outboxBacklog = 0;

    try {
      // 1. Connection check
      await client.$queryRaw`SELECT 1`;
      databaseConnected = true;
    } catch (err) {
      errors.push(`Database connection failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (databaseConnected) {
      try {
        // 2. Models presence check
        const dbAny = client as unknown as {
          studyRoom?: { count: () => Promise<number> };
          roomLease?: { count: () => Promise<number> };
          roomParticipant?: { count: () => Promise<number> };
          realtimeDelivery?: { count: (args: unknown) => Promise<number> };
        };

        if (dbAny.studyRoom?.count && dbAny.roomLease?.count && dbAny.roomParticipant?.count) {
          modelsPresent = true;
        } else {
          errors.push('One or more studyroom Prisma models (studyRoom, roomLease, roomParticipant) are unavailable');
        }

        // 3. Outbox backlog check
        if (dbAny.realtimeDelivery?.count) {
          outboxBacklog = await dbAny.realtimeDelivery.count({
            where: { status: 'PENDING' },
          });
        }
      } catch (err) {
        errors.push(`Model validation error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 4. Realtime config check
    const realtimeConfigured = Boolean(
      process.env.CENTRIFUGO_API_KEY ||
      process.env.CENTRIFUGO_SECRET ||
      process.env.CENTRIFUGO_HTTP_URL ||
      process.env.CENTRIFUGO_WS_URL ||
      process.env.NODE_ENV === 'test'
    );

    if (!realtimeConfigured) {
      errors.push('Centrifugo realtime environment variables are not configured');
    }

    return {
      passed: databaseConnected && modelsPresent && errors.length === 0,
      databaseConnected,
      modelsPresent,
      outboxBacklog,
      realtimeConfigured,
      errors,
    };
  },

  /**
   * Idempotently provisions the baseline standard catalog rooms.
   */
  async provisionBaselineRooms(
    adminUserId: string,
    client = prisma
  ): Promise<{ created: number; updated: number; rooms: string[] }> {
    let created = 0;
    let updated = 0;
    const roomIds: string[] = [];

    for (const def of BASELINE_STUDY_ROOMS) {
      const existing = await client.studyRoom.findFirst({
        where: {
          OR: [{ slug: def.slug }, { title: def.title }],
        },
      });

      if (existing) {
        await client.studyRoom.update({
          where: { id: existing.id },
          data: {
            slug: def.slug,
            title: def.title,
            description: def.description,
            capacity: def.capacity,
            listing: 'PUBLIC',
            status: 'OPEN',
          },
        });
        updated++;
        roomIds.push(existing.id);
      } else {
        const newRoom = await client.studyRoom.create({
          data: {
            slug: def.slug,
            title: def.title,
            description: def.description,
            thumbnail: `/images/studyrooms/scenes/${def.defaultScene}.webp`,
            capacity: def.capacity,
            listing: 'PUBLIC',
            status: 'OPEN',
            ownerId: adminUserId,
            onlineCount: 0,
            revision: 1,
          },
        });
        created++;
        roomIds.push(newRoom.id);

        // Ensure default environment
        const dbAny = client as unknown as {
          roomEnvironment?: {
            create: (args: unknown) => Promise<unknown>;
          };
        };
        if (dbAny.roomEnvironment?.create) {
          await dbAny.roomEnvironment.create({
            data: {
              studyRoomId: newRoom.id,
              activeScene: def.defaultScene,
              activeMusicUrl: def.defaultMusic,
              ambientPreset: def.atmospherePreset,
              ambientVolume: 0.5,
              revision: 1,
            },
          });
        }
      }
    }

    return { created, updated, rooms: roomIds };
  },

  /**
   * Evaluates if a given user has access under a rollout stage.
   */
  evaluateRolloutEligibility(params: {
    stage: RolloutStage;
    user: { id: string; isInternal?: boolean; cohortIds?: string[] };
    room: { id: string; cohortId?: string | null; listing: string; status: string };
  }): { allowed: boolean; reason: string } {
    const { stage, user, room } = params;

    if (this.isEmergencyKillSwitchActive()) {
      return { allowed: false, reason: 'EMERGENCY_KILL_SWITCH_ACTIVE' };
    }

    if (room.status !== 'OPEN') {
      return { allowed: false, reason: 'ROOM_NOT_OPEN' };
    }

    switch (stage) {
      case 'STAGE_0_PREFLIGHT':
      case 'STAGE_1_PROVISION':
        return { allowed: false, reason: 'SYSTEM_STAGING_IN_PROGRESS' };

      case 'STAGE_2_INTERNAL':
        if (!user.isInternal) {
          return { allowed: false, reason: 'INTERNAL_PILOT_ONLY' };
        }
        return { allowed: true, reason: 'INTERNAL_PILOT_ACCESS' };

      case 'STAGE_3_COHORT_CANARY':
        if (user.isInternal) {
          return { allowed: true, reason: 'INTERNAL_ACCESS' };
        }
        if (room.cohortId) {
          const isMember = user.cohortIds?.includes(room.cohortId);
          if (!isMember) {
            return { allowed: false, reason: 'COHORT_ENROLLMENT_REQUIRED' };
          }
          return { allowed: true, reason: 'COHORT_CANARY_ACCESS' };
        }
        return { allowed: false, reason: 'COHORT_CANARY_ACTIVE' };

      case 'STAGE_4_GA':
        if (room.cohortId) {
          const isMember = user.cohortIds?.includes(room.cohortId);
          if (!isMember) {
            return { allowed: false, reason: 'COHORT_ENROLLMENT_REQUIRED' };
          }
          return { allowed: true, reason: 'COHORT_MEMBER_ACCESS' };
        }
        return { allowed: true, reason: 'GA_ACCESS' };

      default:
        return { allowed: false, reason: 'UNKNOWN_STAGE' };
    }
  },

  /**
   * Executes emergency rollback on a room: freezes room to CLOSED, purges active leases,
   * while safely preserving all messages, focus sessions, and audit logs.
   */
  async executeEmergencyRollback(
    roomId: string,
    reason: string,
    client = prisma
  ): Promise<{ success: boolean; roomId: string; leasesEvicted: number }> {
    return client.$transaction(async (tx) => {
      // 1. Update room status to CLOSED
      const room = await tx.studyRoom.findUnique({ where: { id: roomId } });
      if (!room) {
        throw new Error(`Room with ID ${roomId} not found for emergency rollback`);
      }

      await tx.studyRoom.update({
        where: { id: roomId },
        data: {
          status: 'CLOSED',
          onlineCount: 0,
        },
      });

      // 2. Evict all active leases so connected tabs receive closed status on next heartbeat
      const deleteResult = await tx.roomLease.deleteMany({
        where: { studyRoomId: roomId },
      });

      // 3. Clear participant rows for this room
      await tx.roomParticipant.deleteMany({
        where: { studyRoomId: roomId },
      });

      // 4. Record audit log
      const txAny = tx as unknown as {
        roomAuditLog?: {
          create: (args: unknown) => Promise<unknown>;
        };
      };
      if (txAny.roomAuditLog?.create) {
        await txAny.roomAuditLog.create({
          data: {
            studyRoomId: roomId,
            actorId: 'system:rollback',
            action: 'EMERGENCY_ROLLBACK',
            details: {
              reason,
              leasesEvicted: deleteResult.count,
              executedAt: new Date().toISOString(),
            },
          },
        });
      }

      return {
        success: true,
        roomId,
        leasesEvicted: deleteResult.count,
      };
    });
  },
};
