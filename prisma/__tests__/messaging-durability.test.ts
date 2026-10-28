import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const phase1Migration = readFileSync(new URL('../sql/messaging/messaging-invitations-and-restrictions.sql', import.meta.url), 'utf8');
const phase2Migration = readFileSync(new URL('../sql/messaging/messaging-durability.sql', import.meta.url), 'utf8');

describe('messaging durability additive SQL migration', () => {
  it('applies idempotently with zero destructive DDL and enforces durability constraints', async () => {
    expect(phase2Migration).not.toMatch(/\b(?:DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM)\b/i);

    const db = new PGlite();
    try {
      // 1. Initial base tables matching repo state before Phase 2
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

      // 2. Apply Phase 1 migration
      await db.exec(phase1Migration);

      // 3. Seed users, channels and historical unsequenced messages
      await db.exec(`
        INSERT INTO "users" ("id", "email") VALUES ('user-1', 'u1@test.com'), ('user-2', 'u2@test.com');
        INSERT INTO "cohorts" ("id", "creatorId") VALUES ('cohort-1', 'user-1');
        INSERT INTO "communities" ("id", "cohortId") VALUES ('comm-1', 'cohort-1');
        INSERT INTO "channels" ("id", "name", "communityId") VALUES ('chan-1', 'general', 'comm-1');
        INSERT INTO "messages" ("id", "content", "channelId", "authorId", "createdAt")
        VALUES
          ('msg-1', 'First', 'chan-1', 'user-1', '2026-01-01 10:00:00'),
          ('msg-2', 'Second', 'chan-1', 'user-2', '2026-01-01 10:01:00'),
          ('msg-3', 'Third', 'chan-1', 'user-1', '2026-01-01 10:02:00');
      `);

      // 4. Apply Phase 2 migration
      await db.exec(phase2Migration);

      // Verify sequence backfill
      const msgs = await db.query<{ id: string; messageSequence: number }>(
        `SELECT "id", "messageSequence" FROM "messages" WHERE "channelId" = 'chan-1' ORDER BY "messageSequence" ASC`
      );
      expect(msgs.rows).toHaveLength(3);
      expect(msgs.rows[0]).toEqual({ id: 'msg-1', messageSequence: 1 });
      expect(msgs.rows[1]).toEqual({ id: 'msg-2', messageSequence: 2 });
      expect(msgs.rows[2]).toEqual({ id: 'msg-3', messageSequence: 3 });

      // Verify channel messageCounter backfill
      const chan = await db.query<{ messageCounter: number }>(
        `SELECT "messageCounter" FROM "channels" WHERE "id" = 'chan-1'`
      );
      expect(chan.rows[0].messageCounter).toBe(3);

      // 5. Test idempotency: re-run Phase 2 migration
      await db.exec(phase2Migration);

      // 6. Test Channel Single-Parent Constraint
      // 0 parents: should fail
      await expect(
        db.exec(`INSERT INTO "channels" ("id", "name") VALUES ('chan-invalid-0', 'no-parent')`)
      ).rejects.toThrow();

      // 2 parents: should fail
      await db.exec(`INSERT INTO "study_rooms" ("id", "title", "thumbnail", "status") VALUES ('room-1', 'Study 1', '', 'active')`);
      await expect(
        db.exec(`INSERT INTO "channels" ("id", "name", "communityId", "studyRoomId") VALUES ('chan-invalid-2', 'two-parents', 'comm-1', 'room-1')`)
      ).rejects.toThrow();

      // Exactly 1 parent (conversation): should pass
      await db.exec(`
        INSERT INTO "conversations" ("id", "kind", "creatorId", "directKey")
        VALUES ('conv-1', 'DIRECT', 'user-1', 'user-1:user-2');
      `);
      await db.exec(`
        INSERT INTO "channels" ("id", "name", "conversationId")
        VALUES ('chan-conv-1', 'dm-chat', 'conv-1');
      `);

      // 7. Test Message Unique Sequence per channel
      await expect(
        db.exec(`
          INSERT INTO "messages" ("id", "content", "channelId", "authorId", "messageSequence")
          VALUES ('msg-dup', 'Duplicate Seq', 'chan-1', 'user-1', 1)
        `)
      ).rejects.toThrow();

      // 8. Test RealtimeStream Single-Owner Constraint
      // 0 owners: should fail
      await expect(
        db.exec(`INSERT INTO "realtime_streams" ("id") VALUES ('stream-invalid-0')`)
      ).rejects.toThrow();

      // 2 owners: should fail
      await expect(
        db.exec(`INSERT INTO "realtime_streams" ("id", "channelId", "userId") VALUES ('stream-invalid-2', 'chan-1', 'user-1')`)
      ).rejects.toThrow();

      // 1 owner: should pass
      await db.exec(`INSERT INTO "realtime_streams" ("id", "channelId") VALUES ('stream-chan-1', 'chan-1')`);

      // 9. Test RealtimeEvent and RealtimeDelivery Uniqueness
      await db.exec(`
        INSERT INTO "realtime_events" ("id", "streamId", "sequence", "eventId", "type", "payload")
        VALUES ('evt-1', 'stream-chan-1', 1, 'evt-uuid-1', 'message.created', '{"text":"hello"}');
      `);

      // Duplicate eventId should fail
      await expect(
        db.exec(`
          INSERT INTO "realtime_events" ("id", "streamId", "sequence", "eventId", "type", "payload")
          VALUES ('evt-dup', 'stream-chan-1', 2, 'evt-uuid-1', 'message.created', '{"text":"hello"}')
        `)
      ).rejects.toThrow();

      // Delivery insert
      await db.exec(`
        INSERT INTO "realtime_deliveries" ("id", "eventId", "destination", "status")
        VALUES ('del-1', 'evt-1', 'community:chan-1:g1', 'PENDING');
      `);

      // Duplicate eventId + destination should fail
      await expect(
        db.exec(`
          INSERT INTO "realtime_deliveries" ("id", "eventId", "destination", "status")
          VALUES ('del-2', 'evt-1', 'community:chan-1:g1', 'PENDING')
        `)
      ).rejects.toThrow();

      // 10. Test MessagingRequest idempotency constraint
      await db.exec(`
        INSERT INTO "messaging_requests" ("id", "actorId", "operation", "scope", "requestId", "payloadHash", "response")
        VALUES ('req-1', 'user-1', 'send_message', 'channel:chan-1', 'req-uuid-1', 'hash-abc', '{"id":"msg-1"}');
      `);

      // Same actorId, operation, scope, requestId should fail
      await expect(
        db.exec(`
          INSERT INTO "messaging_requests" ("id", "actorId", "operation", "scope", "requestId", "payloadHash", "response")
          VALUES ('req-2', 'user-1', 'send_message', 'channel:chan-1', 'req-uuid-1', 'hash-xyz', '{"id":"msg-2"}')
        `)
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });
});
