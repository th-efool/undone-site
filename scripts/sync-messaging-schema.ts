import { prisma } from '../src/server/infrastructure/db/postgres/client';

async function main() {
  console.log('--- Synchronizing Messaging & Conversation Schema in Neon Postgres ---');

  // 1. Enums
  console.log('Step 1: Enums...');
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversationKind') THEN
        CREATE TYPE "ConversationKind" AS ENUM ('DIRECT', 'GROUP');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RealtimeDeliveryStatus') THEN
        CREATE TYPE "RealtimeDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'DEAD_LETTER');
      END IF;
    END $$;
  `);

  // 2. Communities accessGeneration
  console.log('Step 2: Communities...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "communities"
      ADD COLUMN IF NOT EXISTS "accessGeneration" INTEGER NOT NULL DEFAULT 1;
  `);

  // 3. Conversations
  console.log('Step 3: Conversations...');
  await prisma.$executeRawUnsafe(`
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

    ALTER TABLE "conversations"
      ADD COLUMN IF NOT EXISTS "kind" "ConversationKind" NOT NULL DEFAULT 'DIRECT',
      ADD COLUMN IF NOT EXISTS "creatorId" TEXT,
      ADD COLUMN IF NOT EXISTS "directKey" TEXT,
      ADD COLUMN IF NOT EXISTS "accessGeneration" INTEGER NOT NULL DEFAULT 1;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'conversations_creatorId_fkey'
      ) THEN
        ALTER TABLE "conversations"
          ADD CONSTRAINT "conversations_creatorId_fkey"
          FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT;
      END IF;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "conversations_directKey_key"
      ON "conversations"("directKey")
      WHERE "directKey" IS NOT NULL;

    CREATE INDEX IF NOT EXISTS "conversations_creatorId_idx"
      ON "conversations"("creatorId");
  `);

  // 4. Conversation participants
  console.log('Step 4: Conversation participants...');
  await prisma.$executeRawUnsafe(`
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
  `);

  // 5. Channels
  console.log('Step 5: Channels...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "channels"
      ALTER COLUMN "communityId" DROP NOT NULL;

    ALTER TABLE "channels"
      ADD COLUMN IF NOT EXISTS "conversationId" TEXT,
      ADD COLUMN IF NOT EXISTS "studyRoomId" TEXT,
      ADD COLUMN IF NOT EXISTS "slug" TEXT,
      ADD COLUMN IF NOT EXISTS "messageCounter" INTEGER NOT NULL DEFAULT 0;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'channels_conversationId_fkey'
      ) THEN
        ALTER TABLE "channels"
          ADD CONSTRAINT "channels_conversationId_fkey"
          FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE;
      END IF;
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
  `);

  // 6. Messages
  console.log('Step 6: Messages...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "messageSequence" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT,
      ADD COLUMN IF NOT EXISTS "payloadHash" TEXT,
      ADD COLUMN IF NOT EXISTS "replyToId" TEXT,
      ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "deletionReason" TEXT,
      ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "pinnedById" TEXT,
      ADD COLUMN IF NOT EXISTS "isAnnouncement" BOOLEAN NOT NULL DEFAULT FALSE;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'messages_replyToId_fkey'
      ) THEN
        ALTER TABLE "messages"
          ADD CONSTRAINT "messages_replyToId_fkey"
          FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'messages_pinnedById_fkey'
      ) THEN
        ALTER TABLE "messages"
          ADD CONSTRAINT "messages_pinnedById_fkey"
          FOREIGN KEY ("pinnedById") REFERENCES "users"("id") ON DELETE SET NULL;
      END IF;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "messages_channelId_messageSequence_key"
      ON "messages"("channelId", "messageSequence");

    CREATE UNIQUE INDEX IF NOT EXISTS "messages_channel_author_req_key"
      ON "messages"("channelId", "authorId", "clientRequestId")
      WHERE "clientRequestId" IS NOT NULL;

    CREATE INDEX IF NOT EXISTS "messages_replyToId_idx" ON "messages"("replyToId");
  `);

  // 7. Channel user states
  console.log('Step 7: Channel user states...');
  await prisma.$executeRawUnsafe(`
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
  `);

  // 8. Realtime streams & events & deliveries
  console.log('Step 8: Realtime streams, events, deliveries...');
  await prisma.$executeRawUnsafe(`
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
  `);

  // 9. Blocks, reports, invitations
  console.log('Step 9: Blocks, reports, invitations...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "user_blocks" (
      "blockerId" TEXT NOT NULL,
      "blockedId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blockerId", "blockedId"),
      CONSTRAINT "user_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "user_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "user_blocks_not_self" CHECK ("blockerId" <> "blockedId")
    );

    CREATE INDEX IF NOT EXISTS "user_blocks_blockedId_idx" ON "user_blocks"("blockedId");

    CREATE TABLE IF NOT EXISTS "message_reports" (
      "id" TEXT NOT NULL,
      "reporterId" TEXT NOT NULL,
      "messageId" TEXT NOT NULL,
      "reason" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "message_reports_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "message_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "message_reports_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS "message_reports_messageId_idx" ON "message_reports"("messageId");
    CREATE INDEX IF NOT EXISTS "message_reports_reporterId_idx" ON "message_reports"("reporterId");

    CREATE TABLE IF NOT EXISTS "conversation_invitations" (
      "id" TEXT NOT NULL,
      "conversationId" TEXT NOT NULL,
      "inviterId" TEXT NOT NULL,
      "inviteeId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "expiresAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "conversation_invitations_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "conversation_invitations_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "conversation_invitations_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "conversation_invitations_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "conversation_invitations_conv_invitee_status_key" ON "conversation_invitations"("conversationId", "inviteeId", "status");
    CREATE INDEX IF NOT EXISTS "conversation_invitations_inviteeId_status_idx" ON "conversation_invitations"("inviteeId", "status");
  `);

  // 10. Study rooms additive columns & room_restrictions
  console.log('Step 10: Study rooms columns & restrictions...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "study_rooms"
      ADD COLUMN IF NOT EXISTS "slug" TEXT,
      ADD COLUMN IF NOT EXISTS "description" TEXT,
      ADD COLUMN IF NOT EXISTS "ownerId" TEXT,
      ADD COLUMN IF NOT EXISTS "cohortId" TEXT,
      ADD COLUMN IF NOT EXISTS "listing" TEXT NOT NULL DEFAULT 'LISTED',
      ADD COLUMN IF NOT EXISTS "capacity" INTEGER NOT NULL DEFAULT 25,
      ADD COLUMN IF NOT EXISTS "rules" TEXT,
      ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'en',
      ADD COLUMN IF NOT EXISTS "visualPresetId" TEXT,
      ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'study_rooms_ownerId_fkey'
      ) THEN
        ALTER TABLE "study_rooms"
          ADD CONSTRAINT "study_rooms_ownerId_fkey"
          FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'study_rooms_cohortId_fkey'
      ) THEN
        ALTER TABLE "study_rooms"
          ADD CONSTRAINT "study_rooms_cohortId_fkey"
          FOREIGN KEY ("cohortId") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS "room_restrictions" (
      "id" TEXT NOT NULL,
      "studyRoomId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "reason" TEXT,
      "issuedByUserId" TEXT,
      "expiresAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "room_restrictions_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "room_restrictions_studyRoomId_fkey" FOREIGN KEY ("studyRoomId") REFERENCES "study_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "room_restrictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "room_restrictions_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "room_leases" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "studyRoomId" TEXT NOT NULL REFERENCES "study_rooms"("id") ON DELETE CASCADE,
      "generation" INTEGER NOT NULL DEFAULT 1,
      "tabId" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "room_leases_userId_tabId_key" UNIQUE ("userId", "tabId")
    );

    CREATE TABLE IF NOT EXISTS "study_sessions" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "studyRoomId" TEXT REFERENCES "study_rooms"("id") ON DELETE SET NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "targetDurationSeconds" INTEGER NOT NULL,
      "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "resumedAt" TIMESTAMP(3),
      "pausedAt" TIMESTAMP(3),
      "deadline" TIMESTAMP(3),
      "endedAt" TIMESTAMP(3),
      "version" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('\n--- Step 11: Validating Prisma Model Queries ---');
  const userAlpha = await prisma.user.findFirst({ where: { username: 'user_alpha' } });
  const userGamma = await prisma.user.findFirst({ where: { username: 'user_gamma' } });
  console.log('User Alpha in DB:', userAlpha?.username, userAlpha?.id);
  console.log('User Gamma in DB:', userGamma?.username, userGamma?.id);

  const convCount = await prisma.conversation.count();
  console.log('Conversations count:', convCount);

  const partCount = await prisma.conversationParticipant.count();
  console.log('Conversation participants count:', partCount);

  const channelCount = await prisma.channel.count();
  console.log('Channels count:', channelCount);

  console.log('\nSUCCESS! Messaging and conversation schema is fully synchronized with Prisma!');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
