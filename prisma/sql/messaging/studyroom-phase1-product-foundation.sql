-- ─────────────────────────────────────────────────────────────────
-- Phase 1 Additive DDL: Study Room Product Foundation Schema
-- ─────────────────────────────────────────────────────────────────

-- 1. Extend study_rooms table with product metadata, scope, and lifecycle
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

-- Add foreign key constraints to users and cohorts if not already present
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

-- 2. Backfill slugs and normalize legacy rows
UPDATE "study_rooms"
SET "slug" = LOWER(REGEXP_REPLACE("title", '[^a-zA-Z0-9]+', '-', 'g'))
WHERE "slug" IS NULL;

-- Ensure default status normalization: map legacy ACTIVE to OPEN if owner exists, else CLOSED
UPDATE "study_rooms"
SET "status" = 'CLOSED'
WHERE "ownerId" IS NULL AND ("status" = 'ACTIVE' OR "status" IS NULL);

UPDATE "study_rooms"
SET "status" = 'OPEN'
WHERE "status" = 'ACTIVE';

-- 3. Extend room_controllers with audit and assignment metadata
ALTER TABLE "room_controllers"
  ADD COLUMN IF NOT EXISTS "assignedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'room_controllers_assignedByUserId_fkey'
  ) THEN
    ALTER TABLE "room_controllers"
      ADD CONSTRAINT "room_controllers_assignedByUserId_fkey"
      FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Reconcile any historical OWNER rows into study_rooms.ownerId
UPDATE "study_rooms" sr
SET "ownerId" = rc."userId"
FROM "room_controllers" rc
WHERE rc."studyRoomId" = sr."id"
  AND rc."role" = 'OWNER'
  AND sr."ownerId" IS NULL;

DELETE FROM "room_controllers"
WHERE "role" = 'OWNER';

-- 4. Create room_restrictions table for temporary kicks (cooldowns) and bans
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

-- 5. Create room_ownership_transfers table for two-phase ownership handoff
CREATE TABLE IF NOT EXISTS "room_ownership_transfers" (
  "id" TEXT NOT NULL,
  "studyRoomId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expectedRevision" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "room_ownership_transfers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "room_ownership_transfers_studyRoomId_fkey" FOREIGN KEY ("studyRoomId") REFERENCES "study_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "room_ownership_transfers_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "room_ownership_transfers_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 6. Create room_audit_logs table for durable room management history
CREATE TABLE IF NOT EXISTS "room_audit_logs" (
  "id" TEXT NOT NULL,
  "studyRoomId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "targetUserId" TEXT,
  "clientRequestId" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "room_audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "room_audit_logs_studyRoomId_fkey" FOREIGN KEY ("studyRoomId") REFERENCES "study_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "room_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "room_audit_logs_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 7. High-efficiency indexes
CREATE UNIQUE INDEX IF NOT EXISTS "study_rooms_slug_key" ON "study_rooms"("slug");
CREATE INDEX IF NOT EXISTS "study_rooms_ownerId_status_idx" ON "study_rooms"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "study_rooms_cohortId_status_listing_idx" ON "study_rooms"("cohortId", "status", "listing");
CREATE INDEX IF NOT EXISTS "study_rooms_listing_status_createdAt_idx" ON "study_rooms"("listing", "status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "room_restrictions_studyRoomId_userId_key" ON "room_restrictions"("studyRoomId", "userId");
CREATE INDEX IF NOT EXISTS "room_restrictions_userId_idx" ON "room_restrictions"("userId");
CREATE INDEX IF NOT EXISTS "room_restrictions_studyRoomId_expiresAt_idx" ON "room_restrictions"("studyRoomId", "expiresAt");

CREATE INDEX IF NOT EXISTS "room_ownership_transfers_studyRoomId_status_idx" ON "room_ownership_transfers"("studyRoomId", "status");
CREATE INDEX IF NOT EXISTS "room_ownership_transfers_recipientId_status_idx" ON "room_ownership_transfers"("recipientId", "status");

CREATE INDEX IF NOT EXISTS "room_audit_logs_studyRoomId_createdAt_idx" ON "room_audit_logs"("studyRoomId", "createdAt");
CREATE INDEX IF NOT EXISTS "room_audit_logs_actorId_idx" ON "room_audit_logs"("actorId");
