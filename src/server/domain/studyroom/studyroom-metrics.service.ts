import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export type StudyRoomHealthStatus = 'healthy' | 'degraded' | 'critical';

export interface StudyRoomMetricsSummary {
  status: StudyRoomHealthStatus;
  timestamp: string;
  counters: {
    renewalFailures: Record<string, number>;
    versionConflicts: Record<string, number>;
    authorizationFailures: Record<string, number>;
  };
  reconciliation: {
    lastRunAt: string | null;
    lastDurationMs: number;
    lastSweptCount: number;
    totalSweptCount: number;
  };
  latency: {
    joinAvgMs: number;
    joinP95Ms: number;
    totalJoinsSampled: number;
  };
  outbox: {
    pendingDeliveries: number;
    deadLetters: number;
    oldestPendingAgeSeconds: number;
  };
  studyRooms: {
    activeRooms: number;
    activeLeases: number;
    activeSprints: number;
  };
  alerts: string[];
}

// In-memory operational metrics state
const renewalFailures: Record<string, number> = {};
const versionConflicts: Record<string, number> = {};
const authorizationFailures: Record<string, number> = {};
const joinLatencySamples: number[] = [];
const MAX_LATENCY_SAMPLES = 500;

let reconciliationState = {
  lastRunAt: null as string | null,
  lastDurationMs: 0,
  lastSweptCount: 0,
  totalSweptCount: 0,
};

export const studyRoomMetricsService = {
  recordRenewalFailure(reason: 'stale_generation' | 'not_found' | 'db_error' | 'rate_limited' | string): void {
    renewalFailures[reason] = (renewalFailures[reason] ?? 0) + 1;
  },

  recordReconciliation(sweptCount: number, durationMs: number): void {
    reconciliationState = {
      lastRunAt: new Date().toISOString(),
      lastDurationMs: durationMs,
      lastSweptCount: sweptCount,
      totalSweptCount: reconciliationState.totalSweptCount + sweptCount,
    };
  },

  recordJoinLatency(durationMs: number): void {
    joinLatencySamples.push(durationMs);
    if (joinLatencySamples.length > MAX_LATENCY_SAMPLES) {
      joinLatencySamples.shift();
    }
  },

  recordVersionConflict(entity: 'session' | 'environment' | 'sprint' | 'room_settings' | string): void {
    versionConflicts[entity] = (versionConflicts[entity] ?? 0) + 1;
  },

  recordAuthorizationFailure(reason: 'unauthorized' | 'guest_restricted' | 'cohort_restricted' | 'invalid_origin' | 'banned' | string): void {
    authorizationFailures[reason] = (authorizationFailures[reason] ?? 0) + 1;
  },

  /**
   * Resets in-memory counters (useful for unit tests).
   */
  resetMetricsForTest(): void {
    for (const key of Object.keys(renewalFailures)) delete renewalFailures[key];
    for (const key of Object.keys(versionConflicts)) delete versionConflicts[key];
    for (const key of Object.keys(authorizationFailures)) delete authorizationFailures[key];
    joinLatencySamples.length = 0;
    reconciliationState = {
      lastRunAt: null,
      lastDurationMs: 0,
      lastSweptCount: 0,
      totalSweptCount: 0,
    };
  },

  /**
   * Aggregates diagnostics, outbox lag, database occupancy, and operational counters.
   */
  async getMetricsSummary(): Promise<StudyRoomMetricsSummary> {
    const now = new Date();

    const [
      pendingDeliveries,
      deadLetters,
      oldestPending,
      activeRooms,
      activeLeases,
      activeSprints,
    ] = await Promise.all([
      prisma.realtimeDelivery?.count
        ? prisma.realtimeDelivery.count({ where: { status: 'PENDING' } })
        : Promise.resolve(0),
      prisma.realtimeDelivery?.count
        ? prisma.realtimeDelivery.count({ where: { status: 'DEAD_LETTER' } })
        : Promise.resolve(0),
      prisma.realtimeDelivery?.findFirst
        ? prisma.realtimeDelivery.findFirst({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
          })
        : Promise.resolve(null),
      prisma.studyRoom?.count
        ? prisma.studyRoom.count({ where: { status: 'OPEN' } })
        : Promise.resolve(0),
      prisma.roomLease?.count
        ? prisma.roomLease.count({ where: { expiresAt: { gt: now } } })
        : Promise.resolve(0),
      prisma.roomSprint?.count
        ? prisma.roomSprint.count({ where: { status: 'ACTIVE' } })
        : Promise.resolve(0),
    ]);

    const oldestPendingAgeSeconds = oldestPending
      ? Math.max(0, Math.floor((now.getTime() - oldestPending.createdAt.getTime()) / 1000))
      : 0;

    // Latency calculation
    let joinAvgMs = 0;
    let joinP95Ms = 0;
    const totalJoinsSampled = joinLatencySamples.length;

    if (totalJoinsSampled > 0) {
      const sum = joinLatencySamples.reduce((a, b) => a + b, 0);
      joinAvgMs = Math.round(sum / totalJoinsSampled);
      const sorted = [...joinLatencySamples].sort((a, b) => a - b);
      const p95Index = Math.min(
        sorted.length - 1,
        Math.floor(sorted.length * 0.95)
      );
      joinP95Ms = sorted[p95Index];
    }

    const alerts: string[] = [];
    let status: StudyRoomHealthStatus = 'healthy';

    if (deadLetters > 0) {
      status = 'critical';
      alerts.push(`CRITICAL: ${deadLetters} outbox messages in DEAD_LETTER.`);
    }

    if (oldestPendingAgeSeconds > 300) {
      status = 'critical';
      alerts.push(`CRITICAL: Outbox delivery lag exceeds 5 minutes (${oldestPendingAgeSeconds}s).`);
    } else if (oldestPendingAgeSeconds > 30) {
      if (status !== 'critical') status = 'degraded';
      alerts.push(`WARNING: Outbox delivery lag exceeds 30 seconds (${oldestPendingAgeSeconds}s).`);
    }

    const totalRenewalFailures = Object.values(renewalFailures).reduce((a, b) => a + b, 0);
    if (totalRenewalFailures > 50) {
      if (status !== 'critical') status = 'degraded';
      alerts.push(`WARNING: High renewal failure rate (${totalRenewalFailures} failures recorded).`);
    }

    return {
      status,
      timestamp: now.toISOString(),
      counters: {
        renewalFailures: { ...renewalFailures },
        versionConflicts: { ...versionConflicts },
        authorizationFailures: { ...authorizationFailures },
      },
      reconciliation: { ...reconciliationState },
      latency: {
        joinAvgMs,
        joinP95Ms,
        totalJoinsSampled,
      },
      outbox: {
        pendingDeliveries,
        deadLetters,
        oldestPendingAgeSeconds,
      },
      studyRooms: {
        activeRooms,
        activeLeases,
        activeSprints,
      },
      alerts,
    };
  },
};
