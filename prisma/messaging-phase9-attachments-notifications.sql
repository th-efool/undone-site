-- ─────────────────────────────────────────────────────────────────
-- Phase 9 Additive DDL: Chat Attachments & Notifications
-- ─────────────────────────────────────────────────────────────────

-- 1. Create chat_attachments table
CREATE TABLE IF NOT EXISTS "chat_attachments" (
  "id" TEXT NOT NULL,
  "uploader_id" TEXT NOT NULL,
  "channel_id" TEXT NOT NULL,
  "message_id" TEXT,
  "storage_key" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "media_type" TEXT NOT NULL,
  "byte_length" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "quarantined_until" TIMESTAMP(3),
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "chat_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_attachments_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chat_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_attachments_storage_key_key" ON "chat_attachments"("storage_key");
CREATE INDEX IF NOT EXISTS "chat_attachments_channel_id_status_idx" ON "chat_attachments"("channel_id", "status");
CREATE INDEX IF NOT EXISTS "chat_attachments_uploader_id_created_at_idx" ON "chat_attachments"("uploader_id", "created_at");
CREATE INDEX IF NOT EXISTS "chat_attachments_message_id_idx" ON "chat_attachments"("message_id");

-- 2. Create notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "actor_id" TEXT,
  "scope_type" TEXT NOT NULL,
  "scope_id" TEXT NOT NULL,
  "entity_id" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- 3. Create notification_preferences table
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "user_id" TEXT NOT NULL,
  "email_notifications" BOOLEAN NOT NULL DEFAULT TRUE,
  "push_notifications" BOOLEAN NOT NULL DEFAULT TRUE,
  "mention_only" BOOLEAN NOT NULL DEFAULT FALSE,
  "muted_scopes" JSONB NOT NULL DEFAULT '[]',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 4. Create push_subscriptions table
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_user_id_endpoint_key" ON "push_subscriptions"("user_id", "endpoint");
CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");
