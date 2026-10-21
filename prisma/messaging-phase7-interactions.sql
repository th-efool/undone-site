-- Phase 7: Message Reactions, Edits, Tombstones, and Read State
-- Additive, safe DDL

CREATE TABLE IF NOT EXISTS "message_reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "message_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "message_reactions_messageId_userId_emoji_key" UNIQUE ("messageId", "userId", "emoji")
);

CREATE INDEX IF NOT EXISTS "message_reactions_messageId_idx" ON "message_reactions"("messageId");
CREATE INDEX IF NOT EXISTS "message_reactions_userId_idx" ON "message_reactions"("userId");
