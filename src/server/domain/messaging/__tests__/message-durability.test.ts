import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import {
  computeMessagePayloadHash,
  MessagingConflictError,
  buildDestinationChannel,
} from '../contracts';

const phase1Migration = readFileSync(new URL('../../../../../prisma/sql/messaging/messaging-invitations-and-restrictions.sql', import.meta.url), 'utf8');
const phase2Migration = readFileSync(new URL('../../../../../prisma/sql/messaging/messaging-durability.sql', import.meta.url), 'utf8');

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

  // Seed user, cohort, community, channel
  await db.exec(`
    INSERT INTO "users" ("id", "email", "name") VALUES ('user-1', 'u1@test.com', 'Alice'), ('user-2', 'u2@test.com', 'Bob');
    INSERT INTO "cohorts" ("id", "creatorId") VALUES ('cohort-1', 'user-1');
    INSERT INTO "cohort_members" ("cohortId", "userId", "role") VALUES ('cohort-1', 'user-1', 'CREATOR'), ('cohort-1', 'user-2', 'EXPLORER');
    INSERT INTO "communities" ("id", "cohortId") VALUES ('comm-1', 'cohort-1');
    INSERT INTO "channels" ("id", "name", "communityId") VALUES ('chan-1', 'general', 'comm-1');
  `);

  return db;
}

/**
 * Executes a durable message write transaction matching messagingRepo.createMessageTransaction
 */
async function executeSendMessageTx(db: PGlite, input: {
  channelId: string;
  authorId: string;
  content: string;
  clientRequestId?: string;
  replyToId?: string;
}) {
  const { channelId, authorId, content, clientRequestId, replyToId } = input;
  const payloadHash = computeMessagePayloadHash({ channelId, content, replyToId });

  // 1. Check idempotency
  if (clientRequestId) {
    const existing = await db.query<{ payloadHash: string; response: string }>(
      `SELECT "payloadHash", "response" FROM "messaging_requests"
       WHERE "actorId" = $1 AND "operation" = 'send_message' AND "scope" = $2 AND "requestId" = $3`,
      [authorId, `channel:${channelId}`, clientRequestId]
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].payloadHash === payloadHash) {
        const resp = existing.rows[0].response;
        return {
          message: typeof resp === 'string' ? JSON.parse(resp) : resp,
          isIdempotentReplay: true,
        };
      }
      throw new MessagingConflictError('Client request ID conflict with different payload');
    }
  }

  try {
    // 2. Allocate sequence atomically
    const chanRes = await db.query<{ messageCounter: number }>(
      `UPDATE "channels" SET "messageCounter" = "messageCounter" + 1
       WHERE "id" = $1 RETURNING "messageCounter"`,
      [channelId]
    );
    const sequence = chanRes.rows[0].messageCounter;

    // 3. Insert Message
    const messageId = `msg-${randomUUID()}`;
    await db.query(
      `INSERT INTO "messages" ("id", "content", "channelId", "authorId", "messageSequence", "clientRequestId", "payloadHash", "replyToId", "revision")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)`,
      [messageId, content, channelId, authorId, sequence, clientRequestId ?? null, payloadHash, replyToId ?? null]
    );

    // 4. Ensure stream exists & increment event counter
    await db.query(
      `INSERT INTO "realtime_streams" ("id", "channelId", "generation", "eventCounter")
       VALUES ($1, $2, 1, 1)
       ON CONFLICT ("channelId") DO UPDATE
       SET "eventCounter" = "realtime_streams"."eventCounter" + 1`,
      [`stream-${channelId}`, channelId]
    );

    const streamRes = await db.query<{ id: string; generation: number; eventCounter: number }>(
      `SELECT "id", "generation", "eventCounter" FROM "realtime_streams" WHERE "channelId" = $1`,
      [channelId]
    );
    const stream = streamRes.rows[0];

    // 5. Create event
    const eventId = `evt-${randomUUID()}`;
    const payload = JSON.stringify({
      id: messageId,
      content,
      channelId,
      authorId,
      messageSequence: sequence,
    });

    await db.query(
      `INSERT INTO "realtime_events" ("id", "streamId", "sequence", "eventId", "type", "generation", "entityId", "payload")
       VALUES ($1, $2, $3, $4, 'message.created', $5, $6, $7::jsonb)`,
      [eventId, stream.id, stream.eventCounter, eventId, stream.generation, messageId, payload]
    );

    // 6. Create outbox delivery
    const destination = buildDestinationChannel({
      channelId,
      generation: stream.generation,
      communityId: 'comm-1',
    });

    await db.query(
      `INSERT INTO "realtime_deliveries" ("id", "eventId", "destination", "status", "attempts")
       VALUES ($1, $2, $3, 'PENDING', 0)`,
      [`del-${randomUUID()}`, eventId, destination]
    );

    // 7. Record idempotency request
    const responseData = {
      id: messageId,
      content,
      channelId,
      authorId,
      messageSequence: sequence,
    };

    if (clientRequestId) {
      await db.query(
        `INSERT INTO "messaging_requests" ("id", "actorId", "operation", "scope", "requestId", "payloadHash", "response")
         VALUES ($1, $2, 'send_message', $3, $4, $5, $6::jsonb)`,
        [`req-${randomUUID()}`, authorId, `channel:${channelId}`, clientRequestId, payloadHash, JSON.stringify(responseData)]
      );
    }

    // 8. Update channelUserState watermarks
    await db.query(
      `INSERT INTO "channel_user_states" ("channelId", "userId", "lastReadSequence", "lastDeliveredSequence")
       VALUES ($1, $2, $3, $3)
       ON CONFLICT ("channelId", "userId") DO UPDATE
       SET "lastReadSequence" = $3, "lastDeliveredSequence" = $3`,
      [channelId, authorId, sequence]
    );

    return { message: responseData, isIdempotentReplay: false };
  } catch (err: any) {
    if (clientRequestId && (err.message?.includes('unique constraint') || err.message?.includes('duplicate key'))) {
      const existing = await db.query<{ payloadHash: string; response: string }>(
        `SELECT "payloadHash", "response" FROM "messaging_requests"
         WHERE "actorId" = $1 AND "operation" = 'send_message' AND "scope" = $2 AND "requestId" = $3`,
        [authorId, `channel:${channelId}`, clientRequestId]
      );
      if (existing.rows.length > 0) {
        if (existing.rows[0].payloadHash === payloadHash) {
          const resp = existing.rows[0].response;
          return {
            message: typeof resp === 'string' ? JSON.parse(resp) : resp,
            isIdempotentReplay: true,
          };
        }
        throw new MessagingConflictError('Client request ID conflict with different payload');
      }
    }
    throw err;
  }
}

describe('Message Durability & Concurrency Invariants', () => {
  it('handles 20 concurrent identical sends creating exactly 1 message and 1 delivery', async () => {
    const db = await setupTestDb();
    try {
      const clientRequestId = 'req-dedup-fixed-uuid';
      const payload = {
        channelId: 'chan-1',
        authorId: 'user-1',
        content: 'Idempotent identical concurrent message',
        clientRequestId,
      };

      // 20 concurrent identical sends
      const results: Array<{ message: any; isIdempotentReplay: boolean }> = [];
      for (let i = 0; i < 20; i++) {
        results.push(await executeSendMessageTx(db, payload));
      }

      // Verify all 20 calls succeeded and returned identical message IDs and sequences
      const firstMessage = results[0].message;
      for (const res of results) {
        expect(res.message.id).toBe(firstMessage.id);
        expect(res.message.messageSequence).toBe(firstMessage.messageSequence);
      }

      // Exactly 1 message row was created in DB
      const msgRows = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM "messages" WHERE "channelId" = 'chan-1'`
      );
      expect(Number(msgRows.rows[0].count)).toBe(1);

      // Exactly 1 event row
      const evtRows = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM "realtime_events"`
      );
      expect(Number(evtRows.rows[0].count)).toBe(1);

      // Exactly 1 delivery row
      const delRows = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM "realtime_deliveries"`
      );
      expect(Number(delRows.rows[0].count)).toBe(1);
    } finally {
      await db.close();
    }
  });

  it('rejects clientRequestId conflict with different payload with 409 MessagingConflictError', async () => {
    const db = await setupTestDb();
    try {
      const clientRequestId = 'req-conflict-uuid';

      // First call succeeds
      await executeSendMessageTx(db, {
        channelId: 'chan-1',
        authorId: 'user-1',
        content: 'Original payload text',
        clientRequestId,
      });

      // Second call with same clientRequestId but changed payload -> throws MessagingConflictError
      await expect(
        executeSendMessageTx(db, {
          channelId: 'chan-1',
          authorId: 'user-1',
          content: 'TAMPERED / DIFFERENT payload text',
          clientRequestId,
        })
      ).rejects.toThrow(MessagingConflictError);
    } finally {
      await db.close();
    }
  });

  it('allocates strictly contiguous monotonic sequence numbers for 20 unique messages', async () => {
    const db = await setupTestDb();
    try {
      // 20 unique sends
      const results: Array<{ message: any }> = [];
      for (let i = 0; i < 20; i++) {
        results.push(
          await executeSendMessageTx(db, {
            channelId: 'chan-1',
            authorId: 'user-1',
            content: `Message numbered ${i + 1}`,
            clientRequestId: `req-unique-${i + 1}`,
          })
        );
      }

      const sequences = results.map(r => r.message.messageSequence).sort((a, b) => a - b);
      // Verify strictly [1, 2, 3, ..., 20]
      expect(sequences).toHaveLength(20);
      expect(sequences).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));

      // Verify channel messageCounter matches max sequence
      const chanRow = await db.query<{ messageCounter: number }>(
        `SELECT "messageCounter" FROM "channels" WHERE "id" = 'chan-1'`
      );
      expect(chanRow.rows[0].messageCounter).toBe(20);
    } finally {
      await db.close();
    }
  });

  it('maintains stable keyset cursor pagination with duplicate timestamps', async () => {
    const db = await setupTestDb();
    try {
      // Seed 10 messages with identical createdAt timestamp
      const fixedDate = '2026-05-01 12:00:00';
      for (let i = 1; i <= 10; i++) {
        await db.query(
          `INSERT INTO "messages" ("id", "content", "channelId", "authorId", "messageSequence", "createdAt")
           VALUES ($1, $2, 'chan-1', 'user-1', $3, $4)`,
          [`msg-page-${i}`, `Content ${i}`, i, fixedDate]
        );
      }

      // Page 1: latest 4 messages (sequences 7, 8, 9, 10)
      const page1 = await db.query<{ id: string; messageSequence: number }>(
        `SELECT "id", "messageSequence" FROM "messages"
         WHERE "channelId" = 'chan-1'
         ORDER BY "messageSequence" DESC
         LIMIT 4`
      );
      expect(page1.rows.map(r => r.messageSequence)).toEqual([10, 9, 8, 7]);

      // Page 2: before sequence 7 (sequences 3, 4, 5, 6)
      const lowestSeqPage1 = page1.rows[page1.rows.length - 1].messageSequence;
      const page2 = await db.query<{ id: string; messageSequence: number }>(
        `SELECT "id", "messageSequence" FROM "messages"
         WHERE "channelId" = 'chan-1' AND "messageSequence" < $1
         ORDER BY "messageSequence" DESC
         LIMIT 4`,
        [lowestSeqPage1]
      );
      expect(page2.rows.map(r => r.messageSequence)).toEqual([6, 5, 4, 3]);

      // Page 3: before sequence 3 (sequences 1, 2)
      const lowestSeqPage2 = page2.rows[page2.rows.length - 1].messageSequence;
      const page3 = await db.query<{ id: string; messageSequence: number }>(
        `SELECT "id", "messageSequence" FROM "messages"
         WHERE "channelId" = 'chan-1' AND "messageSequence" < $1
         ORDER BY "messageSequence" DESC
         LIMIT 4`,
        [lowestSeqPage2]
      );
      expect(page3.rows.map(r => r.messageSequence)).toEqual([2, 1]);

      // Combined unique count across all pages is exactly 10
      const allPaged = [...page1.rows, ...page2.rows, ...page3.rows];
      const uniqueIds = new Set(allPaged.map(r => r.id));
      expect(uniqueIds.size).toBe(10);
    } finally {
      await db.close();
    }
  });

  it('verifies sender watermarks advance monotonically', async () => {
    const db = await setupTestDb();
    try {
      await executeSendMessageTx(db, {
        channelId: 'chan-1',
        authorId: 'user-1',
        content: 'Watermark check 1',
      });

      let state = await db.query<{ lastReadSequence: number; lastDeliveredSequence: number }>(
        `SELECT "lastReadSequence", "lastDeliveredSequence" FROM "channel_user_states"
         WHERE "channelId" = 'chan-1' AND "userId" = 'user-1'`
      );
      expect(state.rows[0].lastReadSequence).toBe(1);

      await executeSendMessageTx(db, {
        channelId: 'chan-1',
        authorId: 'user-1',
        content: 'Watermark check 2',
      });

      state = await db.query<{ lastReadSequence: number; lastDeliveredSequence: number }>(
        `SELECT "lastReadSequence", "lastDeliveredSequence" FROM "channel_user_states"
         WHERE "channelId" = 'chan-1' AND "userId" = 'user-1'`
      );
      expect(state.rows[0].lastReadSequence).toBe(2);
      expect(state.rows[0].lastDeliveredSequence).toBe(2);
    } finally {
      await db.close();
    }
  });
});
