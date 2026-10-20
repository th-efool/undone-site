import { randomUUID } from 'node:crypto';
import { prisma } from '../db/postgres/client';
import { type RealtimeTransport } from './transport';
import { type RealtimeEventEnvelope } from '@/src/server/domain/messaging/contracts';

export interface ClaimedDelivery {
  id: string;
  eventId: string;
  destination: string;
  status: string;
  attempts: number;
  dueAt: Date;
  leaseOwner: string | null;
  leaseToken: string | null;
  leaseUntil: Date | null;
  deliveredAt: Date | null;
  lastError: string | null;
}

export interface DispatcherOptions {
  workerId?: string;
  batchSize?: number;
  leaseDurationMs?: number;
  maxAttempts?: number;
  sqlExecutor?: {
    query: <T = unknown>(stmt: string, params?: unknown[]) => Promise<T[]>;
    execute: (stmt: string, params?: unknown[]) => Promise<number>;
  };
}

export class MessagingOutboxDispatcher {
  private workerId: string;
  private batchSize: number;
  private leaseDurationMs: number;
  private maxAttempts: number;
  private sqlExecutor?: DispatcherOptions['sqlExecutor'];

  constructor(options: DispatcherOptions = {}) {
    this.workerId = options.workerId ?? `worker-${randomUUID()}`;
    this.batchSize = options.batchSize ?? 20;
    this.leaseDurationMs = options.leaseDurationMs ?? 30_000;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.sqlExecutor = options.sqlExecutor;
  }

  /**
   * Atomically claims a bounded batch of pending deliveries using PostgreSQL FOR UPDATE SKIP LOCKED
   * and lease tokens for strict concurrency fencing. Uses database CURRENT_TIMESTAMP for consistent timing.
   */
  async claimBatch(options?: { batchSize?: number; leaseDurationMs?: number }): Promise<{
    claimed: ClaimedDelivery[];
    leaseToken: string;
  }> {
    const batchSize = options?.batchSize ?? this.batchSize;
    const leaseDurationMs = options?.leaseDurationMs ?? this.leaseDurationMs;
    const leaseToken = randomUUID();

    const claimSql = `
      WITH candidates AS (
        SELECT d.id
        FROM "realtime_deliveries" d
        WHERE d."status" = 'PENDING'
          AND d."dueAt" <= CURRENT_TIMESTAMP
          AND (d."leaseUntil" IS NULL OR d."leaseUntil" < CURRENT_TIMESTAMP)
        ORDER BY d."dueAt" ASC, d."id" ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "realtime_deliveries" rd
      SET
        "leaseOwner" = $2,
        "leaseToken" = $3,
        "leaseUntil" = CURRENT_TIMESTAMP + ($4 || ' milliseconds')::INTERVAL,
        "attempts" = rd."attempts" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      FROM candidates
      WHERE rd.id = candidates.id
      RETURNING rd."id", rd."eventId", rd."destination", rd."status", rd."attempts",
                rd."dueAt", rd."leaseOwner", rd."leaseToken", rd."leaseUntil",
                rd."deliveredAt", rd."lastError";
    `;

    const params = [batchSize, this.workerId, leaseToken, String(leaseDurationMs)];

    let rows: any[];
    if (this.sqlExecutor) {
      rows = await this.sqlExecutor.query<any>(claimSql, params);
    } else {
      rows = await prisma.$queryRawUnsafe<any[]>(claimSql, ...params);
    }

    const claimed: ClaimedDelivery[] = (rows || []).map(r => ({
      id: r.id,
      eventId: r.eventId,
      destination: r.destination,
      status: r.status,
      attempts: Number(r.attempts),
      dueAt: new Date(r.dueAt),
      leaseOwner: r.leaseOwner,
      leaseToken: r.leaseToken,
      leaseUntil: r.leaseUntil ? new Date(r.leaseUntil) : null,
      deliveredAt: r.deliveredAt ? new Date(r.deliveredAt) : null,
      lastError: r.lastError,
    }));

    return { claimed, leaseToken };
  }

  /**
   * Fenced acknowledgement: marks delivery as DELIVERED only if the worker still holds
   * the exact lease token. Returns true if acknowledged, false if lease expired/fenced.
   */
  async acknowledge(deliveryId: string, leaseToken: string): Promise<boolean> {
    const ackSql = `
      UPDATE "realtime_deliveries"
      SET
        "status" = 'DELIVERED',
        "deliveredAt" = CURRENT_TIMESTAMP,
        "leaseUntil" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $1
        AND "leaseOwner" = $2
        AND "leaseToken" = $3
        AND "status" = 'PENDING';
    `;

    const params = [deliveryId, this.workerId, leaseToken];

    let count = 0;
    if (this.sqlExecutor) {
      count = await this.sqlExecutor.execute(ackSql, params);
    } else {
      count = await prisma.$executeRawUnsafe(ackSql, ...params);
    }

    return count > 0;
  }

  /**
   * Fenced failure handling: calculates exponential backoff or transitions to DEAD_LETTER
   * if max attempts exceeded, quarantining poison events.
   */
  async recordFailure(
    deliveryId: string,
    leaseToken: string,
    error: string,
    currentAttempts: number
  ): Promise<'RETRIED' | 'DEAD_LETTER' | 'FENCED_OUT'> {
    const isDeadLetter = currentAttempts >= this.maxAttempts;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s... capped at 60s
    const backoffMs = Math.min(60_000, 1000 * Math.pow(2, Math.max(0, currentAttempts - 1)));

    const failSql = `
      UPDATE "realtime_deliveries"
      SET
        "status" = CASE WHEN $1 = TRUE THEN 'DEAD_LETTER'::"RealtimeDeliveryStatus" ELSE 'PENDING'::"RealtimeDeliveryStatus" END,
        "dueAt" = CURRENT_TIMESTAMP + ($2 || ' milliseconds')::INTERVAL,
        "leaseUntil" = NULL,
        "lastError" = $3,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = $4
        AND "leaseOwner" = $5
        AND "leaseToken" = $6
        AND "status" = 'PENDING';
    `;

    const params = [isDeadLetter, String(backoffMs), error, deliveryId, this.workerId, leaseToken];

    let count = 0;
    if (this.sqlExecutor) {
      count = await this.sqlExecutor.execute(failSql, params);
    } else {
      count = await prisma.$executeRawUnsafe(failSql, ...params);
    }

    if (count === 0) {
      return 'FENCED_OUT';
    }

    if (isDeadLetter) {
      console.error(
        `[dispatcher] Delivery ${deliveryId} transitioned to DEAD_LETTER after ${currentAttempts} attempts. Error: ${error}`
      );
      return 'DEAD_LETTER';
    }

    return 'RETRIED';
  }

  /**
   * Dispatches a single claimed batch to the transport adapter with independent destination ACKs.
   */
  async dispatchBatch(
    transport: RealtimeTransport,
    options?: { batchSize?: number }
  ): Promise<{
    claimedCount: number;
    deliveredCount: number;
    failedCount: number;
    fencedCount: number;
  }> {
    const { claimed, leaseToken } = await this.claimBatch(options);
    if (claimed.length === 0) {
      return { claimedCount: 0, deliveredCount: 0, failedCount: 0, fencedCount: 0 };
    }

    const eventIds = Array.from(new Set(claimed.map(d => d.eventId)));

    // Load corresponding events
    let events: Array<{
      id: string;
      eventId: string;
      schemaVersion: number;
      type: string;
      streamId: string;
      sequence: number;
      generation: number;
      occurredAt: Date;
      entityId: string | null;
      entityRevision: number | null;
      clientRequestId: string | null;
      payload: any;
    }>;

    if (this.sqlExecutor) {
      const placeholders = eventIds.map((_, i) => `$${i + 1}`).join(',');
      const rows = await this.sqlExecutor.query<any>(
        `SELECT "id", "eventId", "schemaVersion", "type", "streamId", "sequence", "generation",
                "occurredAt", "entityId", "entityRevision", "clientRequestId", "payload"
         FROM "realtime_events"
         WHERE "id" IN (${placeholders})`,
        eventIds
      );
      events = rows.map(r => ({
        ...r,
        occurredAt: new Date(r.occurredAt),
        sequence: Number(r.sequence),
        generation: Number(r.generation),
        payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
      }));
    } else {
      events = await prisma.realtimeEvent.findMany({
        where: { id: { in: eventIds } },
      });
    }

    const eventMap = new Map(events.map(e => [e.id, e]));

    let deliveredCount = 0;
    let failedCount = 0;
    let fencedCount = 0;

    for (const delivery of claimed) {
      const event = eventMap.get(delivery.eventId);
      if (!event) {
        // Poison delivery pointing to missing event -> dead letter
        await this.recordFailure(delivery.id, leaseToken, 'Associated event record not found', this.maxAttempts);
        failedCount++;
        continue;
      }

      const envelope: RealtimeEventEnvelope = {
        eventId: event.eventId,
        schemaVersion: event.schemaVersion,
        type: event.type,
        streamId: event.streamId,
        sequence: event.sequence,
        generation: event.generation,
        occurredAt: event.occurredAt.toISOString(),
        entityId: event.entityId,
        entityRevision: event.entityRevision,
        clientRequestId: event.clientRequestId,
        payload: event.payload,
      };

      try {
        await transport.publish(delivery.destination, envelope);
        const ackSuccess = await this.acknowledge(delivery.id, leaseToken);
        if (ackSuccess) {
          deliveredCount++;
        } else {
          fencedCount++;
        }
      } catch (publishErr) {
        const errorMsg = publishErr instanceof Error ? publishErr.message : String(publishErr);
        const failStatus = await this.recordFailure(delivery.id, leaseToken, errorMsg, delivery.attempts);
        if (failStatus === 'FENCED_OUT') {
          fencedCount++;
        } else {
          failedCount++;
        }
      }
    }

    return {
      claimedCount: claimed.length,
      deliveredCount,
      failedCount,
      fencedCount,
    };
  }
}
