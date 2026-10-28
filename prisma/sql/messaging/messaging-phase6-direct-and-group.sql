-- Phase 6: Direct Messages, Group Conversations, User Blocks, and Message Reports
-- Additive, safe DDL

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
