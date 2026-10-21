import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

export type HealthStatus = 'healthy' | 'degraded' | 'critical';

export interface MessagingMetricsSummary {
  status: HealthStatus;
  timestamp: string;
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

export const messagingMetricsService = {
  /**
   * Computes diagnostics, outbox lag, and health status across the messaging subsystem.
   */
  async getMetricsSummary(): Promise<MessagingMetricsSummary> {
    const now = new Date();

    const [
      pendingDeliveries,
      deadLetters,
      oldestPending,
      activeRooms,
      activeLeases,
      activeSprints,
    ] = await Promise.all([
      prisma.realtimeDelivery.count({
        where: { status: 'PENDING' },
      }),
      prisma.realtimeDelivery.count({
        where: { status: 'DEAD_LETTER' },
      }),
      prisma.realtimeDelivery.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.studyRoom.count({
        where: { status: 'ACTIVE' },
      }),
      prisma.roomLease.count({
        where: { expiresAt: { gt: now } },
      }),
      prisma.roomSprint.count({
        where: { status: 'ACTIVE' },
      }),
    ]);

    const oldestPendingAgeSeconds = oldestPending
      ? Math.max(0, Math.floor((now.getTime() - oldestPending.createdAt.getTime()) / 1000))
      : 0;

    const alerts: string[] = [];
    let status: HealthStatus = 'healthy';

    if (deadLetters > 0) {
      status = 'critical';
      alerts.push(`CRITICAL: ${deadLetters} message deliveries have moved to DEAD_LETTER status.`);
    }

    if (oldestPendingAgeSeconds > 300) {
      status = 'critical';
      alerts.push(`CRITICAL: Outbox delivery lag exceeds 5 minutes (${oldestPendingAgeSeconds}s).`);
    } else if (oldestPendingAgeSeconds > 30) {
      if (status !== 'critical') status = 'degraded';
      alerts.push(`WARNING: Outbox delivery lag exceeds 30 seconds (${oldestPendingAgeSeconds}s).`);
    }

    return {
      status,
      timestamp: now.toISOString(),
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

  /**
   * Formats current metrics in standard Prometheus exposition format.
   */
  async getPrometheusFormat(): Promise<string> {
    const summary = await this.getMetricsSummary();

    const lines: string[] = [
      '# HELP undone_messaging_outbox_pending Total pending deliveries in outbox',
      '# TYPE undone_messaging_outbox_pending gauge',
      `undone_messaging_outbox_pending ${summary.outbox.pendingDeliveries}`,
      '',
      '# HELP undone_messaging_outbox_dead_letters Total dead-lettered deliveries',
      '# TYPE undone_messaging_outbox_dead_letters counter',
      `undone_messaging_outbox_dead_letters ${summary.outbox.deadLetters}`,
      '',
      '# HELP undone_messaging_outbox_oldest_pending_age_seconds Age of oldest pending delivery',
      '# TYPE undone_messaging_outbox_oldest_pending_age_seconds gauge',
      `undone_messaging_outbox_oldest_pending_age_seconds ${summary.outbox.oldestPendingAgeSeconds}`,
      '',
      '# HELP undone_studyroom_active_rooms Count of active study rooms',
      '# TYPE undone_studyroom_active_rooms gauge',
      `undone_studyroom_active_rooms ${summary.studyRooms.activeRooms}`,
      '',
      '# HELP undone_studyroom_active_leases Count of active participant leases',
      '# TYPE undone_studyroom_active_leases gauge',
      `undone_studyroom_active_leases ${summary.studyRooms.activeLeases}`,
      '',
      '# HELP undone_studyroom_active_sprints Count of active shared sprints',
      '# TYPE undone_studyroom_active_sprints gauge',
      `undone_studyroom_active_sprints ${summary.studyRooms.activeSprints}`,
      '',
    ];

    return lines.join('\n');
  },
};
