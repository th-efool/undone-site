import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { MessagingOutboxDispatcher } from '../dispatcher';
import { InMemoryRealtimeTransport } from '../transport';

const phase1Migration = readFileSync(new URL('../../../../../prisma/messaging-invitations-and-restrictions.sql', import.meta.url), 'utf8');
const phase2Migration = readFileSync(new URL('../../../../../prisma/messaging-durability.sql', import.meta.url), 'utf8');

async function setupTestDb() {
  const db = new PGlite();
  await db.exec(`
    CREATE TYPE "MemberRole" AS ENUM ('EXPLORER', 'MODERATOR', 'CREATOR');
    CREATE TABLE "users" ("id" TEXT PRIMARY KEY, "email" TEXT, "name" TEXT, "username" TEXT);
    CREATE TABLE "cohorts" ("id" TEXT PRIMARY KEY, "creatorId" TEXT NOT NULL REFERENCES "users"("id"), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE "cohort_members" ("cohortId" TEXT NOT NULL REFERENCES "cohorts"("id") ON DELETE CASCADE, "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "role" "MemberRole" NOT NULL DEFAULT 'EXPLORER', "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("cohortId", "userId"));
    CREATE TABLE "communities" ("id" TEXT PRIMARY KEY, "cohortId" TEXT UNIQUE NOT NULL REFERENCES "cohorts"("id") ON DELETE CASCADE, "chatEnabled" BOOLEAN NOT NULL DEFAULT true, "eventsEnabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE "channels" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "communityId" TEXT NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE "messages" ("id" TEXT PRIMARY KEY, "content" TEXT NOT NULL, "channelId" TEXT NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE, "authorId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE "study_rooms" ("id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "thumbnail" TEXT NOT NULL, "status" TEXT NOT NULL, "onlineCount" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `);

  await db.exec(phase1Migration);
  await db.exec(phase2Migration);

  // Seed sample data
  await db.exec(`
    INSERT INTO "users" ("id", "email") VALUES ('user-1', 'u1@test.com');
    INSERT INTO "cohorts" ("id", "creatorId") VALUES ('cohort-1', 'user-1');
    INSERT INTO "communities" ("id", "cohortId") VALUES ('comm-1', 'cohort-1');
    INSERT INTO "channels" ("id", "name", "communityId") VALUES ('chan-1', 'general', 'comm-1');
    INSERT INTO "realtime_streams" ("id", "channelId") VALUES ('stream-1', 'chan-1');
  `);

  const sqlExecutor = {
    query: async <T = unknown>(stmt: string, params: unknown[] = []) => {
      const res = await db.query<T>(stmt, params);
      return res.rows;
    },
    execute: async (stmt: string, params: unknown[] = []) => {
      const res = await db.query(stmt, params);
      return res.affectedRows ?? 0;
    },
  };

  return { db, sqlExecutor };
}

describe('MessagingOutboxDispatcher', () => {
  it('prevents two concurrent workers from claiming the same delivery', async () => {
    const { db, sqlExecutor } = await setupTestDb();
    try {
      // Seed 6 deliveries with dueAt in the past
      for (let i = 1; i <= 6; i++) {
        await db.exec(`
          INSERT INTO "realtime_events" ("id", "streamId", "sequence", "eventId", "type", "payload")
          VALUES ('evt-${i}', 'stream-1', ${i}, 'evt-uuid-${i}', 'message.created', '{"index": ${i}}');
          INSERT INTO "realtime_deliveries" ("id", "eventId", "destination", "status", "dueAt")
          VALUES ('del-${i}', 'evt-${i}', 'community:chan-1:g1', 'PENDING', CURRENT_TIMESTAMP - INTERVAL '1 minute');
        `);
      }

      const worker1 = new MessagingOutboxDispatcher({ workerId: 'worker-1', batchSize: 3, sqlExecutor });
      const worker2 = new MessagingOutboxDispatcher({ workerId: 'worker-2', batchSize: 3, sqlExecutor });

      // Run concurrent claims
      const [claim1, claim2] = await Promise.all([
        worker1.claimBatch(),
        worker2.claimBatch(),
      ]);

      expect(claim1.claimed).toHaveLength(3);
      expect(claim2.claimed).toHaveLength(3);

      const ids1 = new Set(claim1.claimed.map(d => d.id));
      const ids2 = new Set(claim2.claimed.map(d => d.id));

      // Overlap must be strictly zero!
      for (const id of ids1) {
        expect(ids2.has(id)).toBe(false);
      }
    } finally {
      await db.close();
    }
  });

  it('reclaims expired lease after worker dies', async () => {
    const { db, sqlExecutor } = await setupTestDb();
    try {
      await db.exec(`
        INSERT INTO "realtime_events" ("id", "streamId", "sequence", "eventId", "type", "payload")
        VALUES ('evt-1', 'stream-1', 1, 'evt-uuid-1', 'message.created', '{"test": true}');
        INSERT INTO "realtime_deliveries" ("id", "eventId", "destination", "status", "dueAt")
        VALUES ('del-1', 'evt-1', 'community:chan-1:g1', 'PENDING', CURRENT_TIMESTAMP - INTERVAL '1 minute');
      `);

      // Worker 1 claims with a 30ms lease
      const worker1 = new MessagingOutboxDispatcher({ workerId: 'worker-1', leaseDurationMs: 30, sqlExecutor });
      const claim1 = await worker1.claimBatch();
      expect(claim1.claimed).toHaveLength(1);
      expect(claim1.claimed[0].id).toBe('del-1');

      // Worker 2 tries immediately before lease expiry -> nothing available
      const worker2 = new MessagingOutboxDispatcher({ workerId: 'worker-2', leaseDurationMs: 1000, sqlExecutor });
      const immediateClaim = await worker2.claimBatch();
      expect(immediateClaim.claimed).toHaveLength(0);

      // Wait 50ms for lease to expire
      await new Promise(r => setTimeout(r, 50));

      const reclaimed = await worker2.claimBatch();
      expect(reclaimed.claimed).toHaveLength(1);
      expect(reclaimed.claimed[0].id).toBe('del-1');
      expect(reclaimed.claimed[0].attempts).toBe(2);
    } finally {
      await db.close();
    }
  });

  it('fences out stale worker ACK when new lease has been granted', async () => {
    const { db, sqlExecutor } = await setupTestDb();
    try {
      await db.exec(`
        INSERT INTO "realtime_events" ("id", "streamId", "sequence", "eventId", "type", "payload")
        VALUES ('evt-1', 'stream-1', 1, 'evt-uuid-1', 'message.created', '{"test": true}');
        INSERT INTO "realtime_deliveries" ("id", "eventId", "destination", "status", "dueAt")
        VALUES ('del-1', 'evt-1', 'community:chan-1:g1', 'PENDING', CURRENT_TIMESTAMP - INTERVAL '1 minute');
      `);

      const worker1 = new MessagingOutboxDispatcher({ workerId: 'worker-1', leaseDurationMs: 30, sqlExecutor });
      const worker2 = new MessagingOutboxDispatcher({ workerId: 'worker-2', leaseDurationMs: 5000, sqlExecutor });

      const claim1 = await worker1.claimBatch();
      const leaseToken1 = claim1.leaseToken;

      // Wait for lease to expire
      await new Promise(r => setTimeout(r, 50));

      const claim2 = await worker2.claimBatch();
      const leaseToken2 = claim2.leaseToken;

      expect(leaseToken1).not.toBe(leaseToken2);

      // Stale Worker 1 wakes up and attempts to ACK delivery using its old leaseToken
      const staleAck = await worker1.acknowledge('del-1', leaseToken1);
      expect(staleAck).toBe(false); // REJECTED / FENCED OUT!

      // Worker 2 ACKs with current leaseToken -> succeeds!
      const validAck = await worker2.acknowledge('del-1', leaseToken2);
      expect(validAck).toBe(true);

      // Verify row status is DELIVERED
      const row = await db.query<{ status: string; deliveredAt: string }>(
        `SELECT "status", "deliveredAt" FROM "realtime_deliveries" WHERE "id" = 'del-1'`
      );
      expect(row.rows[0].status).toBe('DELIVERED');
      expect(row.rows[0].deliveredAt).toBeTruthy();
    } finally {
      await db.close();
    }
  });

  it('dispatches to transport and transitions to DEAD_LETTER after max failures', async () => {
    const { db, sqlExecutor } = await setupTestDb();
    const transport = new InMemoryRealtimeTransport();

    try {
      await db.exec(`
        INSERT INTO "realtime_events" ("id", "streamId", "sequence", "eventId", "type", "payload")
        VALUES ('evt-poison', 'stream-1', 1, 'evt-uuid-poison', 'message.created', '{"corrupt": true}');
        INSERT INTO "realtime_deliveries" ("id", "eventId", "destination", "status", "dueAt", "attempts")
        VALUES ('del-poison', 'evt-poison', 'community:chan-1:g1', 'PENDING', CURRENT_TIMESTAMP - INTERVAL '1 minute', 2);
      `);

      // Configure transport to simulate repeated errors
      transport.simulateFailure(10, 'Centrifugo network timeout');

      // Max attempts = 3
      const dispatcher = new MessagingOutboxDispatcher({
        workerId: 'worker-test',
        maxAttempts: 3,
        sqlExecutor,
      });

      const res = await dispatcher.dispatchBatch(transport);
      expect(res.claimedCount).toBe(1);
      expect(res.deliveredCount).toBe(0);
      expect(res.failedCount).toBe(1);

      // Verify delivery transitioned to DEAD_LETTER
      const row = await db.query<{ status: string; attempts: number; lastError: string }>(
        `SELECT "status", "attempts", "lastError" FROM "realtime_deliveries" WHERE "id" = 'del-poison'`
      );
      expect(row.rows[0].status).toBe('DEAD_LETTER');
      expect(row.rows[0].attempts).toBe(3);
      expect(row.rows[0].lastError).toBe('Centrifugo network timeout');
    } finally {
      await db.close();
    }
  });

  it('successfully dispatches batch and delivers to destination', async () => {
    const { db, sqlExecutor } = await setupTestDb();
    const transport = new InMemoryRealtimeTransport();

    try {
      await db.exec(`
        INSERT INTO "realtime_events" ("id", "streamId", "sequence", "eventId", "type", "payload")
        VALUES ('evt-clean', 'stream-1', 1, 'evt-uuid-clean', 'message.created', '{"text": "hello world"}');
        INSERT INTO "realtime_deliveries" ("id", "eventId", "destination", "status", "dueAt")
        VALUES ('del-clean', 'evt-clean', 'community:chan-1:g1', 'PENDING', CURRENT_TIMESTAMP - INTERVAL '1 minute');
      `);

      const dispatcher = new MessagingOutboxDispatcher({ workerId: 'worker-clean', sqlExecutor });
      const res = await dispatcher.dispatchBatch(transport);

      expect(res.claimedCount).toBe(1);
      expect(res.deliveredCount).toBe(1);
      expect(res.failedCount).toBe(0);

      expect(transport.published).toHaveLength(1);
      expect(transport.published[0].destination).toBe('community:chan-1:g1');
      expect(transport.published[0].event.eventId).toBe('evt-uuid-clean');

      const row = await db.query<{ status: string }>(
        `SELECT "status" FROM "realtime_deliveries" WHERE "id" = 'del-clean'`
      );
      expect(row.rows[0].status).toBe('DELIVERED');
    } finally {
      await db.close();
    }
  });
});
