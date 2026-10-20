-- prisma/messaging-durability.sql
-- Additive, idempotent DDL for Phase 2: durable messaging foundation, generalized channels,
-- conversations, channel user states, realtime event journal, and outbox deliveries.

-- 1. Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversationKind') THEN
    CREATE TYPE "ConversationKind" AS ENUM ('DIRECT', 'GROUP');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RealtimeDeliveryStatus') THEN
    CREATE TYPE "RealtimeDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'DEAD_LETTER');
  END IF;
END $$;

-- 2. Alter communities to add accessGeneration
ALTER TABLE "communities"
  ADD COLUMN IF NOT EXISTS "accessGeneration" INTEGER NOT NULL DEFAULT 1;

-- 3. Conversations table
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" TEXT PRIMARY KEY,
  "kind" "ConversationKind" NOT NULL DEFAULT 'DIRECT',
  "title" TEXT,
  "creatorId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "directKey" TEXT,
  "accessGeneration" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "conversations_directKey_key"
  ON "conversations"("directKey")
  WHERE "directKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "conversations_creatorId_idx"
  ON "conversations"("creatorId");

-- 4. Conversation participants table
CREATE TABLE IF NOT EXISTS "conversation_participants" (
  "conversationId" TEXT NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "historyVisibleFromSequence" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("conversationId", "userId")
);

CREATE INDEX IF NOT EXISTS "conversation_participants_userId_leftAt_idx"
  ON "conversation_participants"("userId", "leftAt", "conversationId");

-- 5. Generalize channels (community, conversation, study room)
ALTER TABLE "channels"
  ADD COLUMN IF NOT EXISTS "conversationId" TEXT,
  ADD COLUMN IF NOT EXISTS "studyRoomId" TEXT,
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "messageCounter" INTEGER NOT NULL DEFAULT 0;

-- Ensure communityId is nullable
ALTER TABLE "channels" ALTER COLUMN "communityId" DROP NOT NULL;

-- Unique and FK constraints for channels
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'channels_conversationId_fkey'
  ) THEN
    ALTER TABLE "channels"
      ADD CONSTRAINT "channels_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'channels_studyRoomId_fkey'
  ) THEN
    ALTER TABLE "channels"
      ADD CONSTRAINT "channels_studyRoomId_fkey"
      FOREIGN KEY ("studyRoomId") REFERENCES "study_rooms"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "channels_conversationId_key"
  ON "channels"("conversationId")
  WHERE "conversationId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "channels_studyRoomId_key"
  ON "channels"("studyRoomId")
  WHERE "studyRoomId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "channels_conversationId_idx" ON "channels"("conversationId");
CREATE INDEX IF NOT EXISTS "channels_studyRoomId_idx" ON "channels"("studyRoomId");

-- Enforce exactly one parent on channels
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'channels_single_parent_check'
  ) THEN
    ALTER TABLE "channels"
      ADD CONSTRAINT "channels_single_parent_check"
      CHECK (
        ((CASE WHEN "communityId" IS NOT NULL THEN 1 ELSE 0 END) +
         (CASE WHEN "conversationId" IS NOT NULL THEN 1 ELSE 0 END) +
         (CASE WHEN "studyRoomId" IS NOT NULL THEN 1 ELSE 0 END)) = 1
      );
  END IF;
END $$;

-- 6. Add columns to messages table
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "messageSequence" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT,
  ADD COLUMN IF NOT EXISTS "payloadHash" TEXT,
  ADD COLUMN IF NOT EXISTS "replyToId" TEXT,
  ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletionReason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_replyToId_fkey'
  ) THEN
    ALTER TABLE "messages"
      ADD CONSTRAINT "messages_replyToId_fkey"
      FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill deterministic sequence numbers for existing unsequenced messages
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "channelId" ORDER BY "createdAt" ASC, "id" ASC) AS seq
  FROM "messages"
)
UPDATE "messages" m
SET "messageSequence" = numbered.seq
FROM numbered
WHERE m."id" = numbered."id" AND m."messageSequence" = 0;

-- Backfill channel messageCounter to max messageSequence
UPDATE "channels" c
SET "messageCounter" = COALESCE((
  SELECT MAX("messageSequence") FROM "messages" m WHERE m."channelId" = c."id"
), 0);

-- Unique constraints on messages
CREATE UNIQUE INDEX IF NOT EXISTS "messages_channelId_messageSequence_key"
  ON "messages"("channelId", "messageSequence");

CREATE UNIQUE INDEX IF NOT EXISTS "messages_channel_author_req_key"
  ON "messages"("channelId", "authorId", "clientRequestId")
  WHERE "clientRequestId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "messages_replyToId_idx" ON "messages"("replyToId");

-- 7. Channel user state table (read & delivery watermarks, pins, mutes)
CREATE TABLE IF NOT EXISTS "channel_user_states" (
  "channelId" TEXT NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "lastReadSequence" INTEGER NOT NULL DEFAULT 0,
  "lastDeliveredSequence" INTEGER NOT NULL DEFAULT 0,
  "isPinned" BOOLEAN NOT NULL DEFAULT FALSE,
  "mutedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("channelId", "userId")
);

CREATE INDEX IF NOT EXISTS "channel_user_states_userId_idx" ON "channel_user_states"("userId");

-- 8. Realtime streams table
CREATE TABLE IF NOT EXISTS "realtime_streams" (
  "id" TEXT PRIMARY KEY,
  "channelId" TEXT UNIQUE REFERENCES "channels"("id") ON DELETE CASCADE,
  "studyRoomId" TEXT UNIQUE REFERENCES "study_rooms"("id") ON DELETE CASCADE,
  "userId" TEXT UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "generation" INTEGER NOT NULL DEFAULT 1,
  "eventCounter" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'realtime_streams_single_owner_check'
  ) THEN
    ALTER TABLE "realtime_streams"
      ADD CONSTRAINT "realtime_streams_single_owner_check"
      CHECK (
        ((CASE WHEN "channelId" IS NOT NULL THEN 1 ELSE 0 END) +
         (CASE WHEN "studyRoomId" IS NOT NULL THEN 1 ELSE 0 END) +
         (CASE WHEN "userId" IS NOT NULL THEN 1 ELSE 0 END)) = 1
      );
  END IF;
END $$;

-- 9. Realtime events table
CREATE TABLE IF NOT EXISTS "realtime_events" (
  "id" TEXT PRIMARY KEY,
  "streamId" TEXT NOT NULL REFERENCES "realtime_streams"("id") ON DELETE CASCADE,
  "sequence" INTEGER NOT NULL,
  "eventId" TEXT NOT NULL UNIQUE,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "type" TEXT NOT NULL,
  "generation" INTEGER NOT NULL DEFAULT 1,
  "entityId" TEXT,
  "entityRevision" INTEGER,
  "clientRequestId" TEXT,
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realtime_events_streamId_sequence_key" UNIQUE ("streamId", "sequence")
);

CREATE INDEX IF NOT EXISTS "realtime_events_streamId_occurredAt_idx"
  ON "realtime_events"("streamId", "occurredAt");
CREATE INDEX IF NOT EXISTS "realtime_events_occurredAt_idx"
  ON "realtime_events"("occurredAt");

-- 10. Realtime deliveries table (outbox dispatch queue)
CREATE TABLE IF NOT EXISTS "realtime_deliveries" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL REFERENCES "realtime_events"("id") ON DELETE CASCADE,
  "destination" TEXT NOT NULL,
  "status" "RealtimeDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseOwner" TEXT,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "realtime_deliveries_eventId_destination_key" UNIQUE ("eventId", "destination")
);

CREATE INDEX IF NOT EXISTS "realtime_deliveries_pending_claim_idx"
  ON "realtime_deliveries"("status", "dueAt", "leaseUntil");

-- 11. Messaging requests table (scoped mutation idempotency)
CREATE TABLE IF NOT EXISTS "messaging_requests" (
  "id" TEXT PRIMARY KEY,
  "actorId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "operation" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "response" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messaging_requests_actor_op_scope_req_key" UNIQUE ("actorId", "operation", "scope", "requestId")
);

CREATE INDEX IF NOT EXISTS "messaging_requests_createdAt_idx"
  ON "messaging_requests"("createdAt");
