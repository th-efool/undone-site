-- ─────────────────────────────────────────────────────────────────
-- Phase 8 Additive DDL: Reliable Study Room Membership & Focus Sessions
-- ─────────────────────────────────────────────────────────────────

-- 1. Extend room_participants with generation and updated_at
ALTER TABLE "room_participants"
  ADD COLUMN IF NOT EXISTS "generation" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2. Create room_leases table for tab/device lifecycle fencing
CREATE TABLE IF NOT EXISTS "room_leases" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "study_room_id" TEXT NOT NULL,
  "generation" INTEGER NOT NULL DEFAULT 1,
  "tab_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "room_leases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "room_leases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "room_leases_study_room_id_fkey" FOREIGN KEY ("study_room_id") REFERENCES "study_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "room_leases_user_id_tab_id_key" ON "room_leases"("user_id", "tab_id");
CREATE INDEX IF NOT EXISTS "room_leases_study_room_id_expires_at_idx" ON "room_leases"("study_room_id", "expires_at");
CREATE INDEX IF NOT EXISTS "room_leases_expires_at_idx" ON "room_leases"("expires_at");

-- 3. Create study_sessions table for durable personal focus timing
CREATE TABLE IF NOT EXISTS "study_sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "study_room_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "target_duration_seconds" INTEGER NOT NULL,
  "elapsed_seconds" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resumed_at" TIMESTAMP(3),
  "paused_at" TIMESTAMP(3),
  "deadline" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "study_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "study_sessions_study_room_id_fkey" FOREIGN KEY ("study_room_id") REFERENCES "study_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "study_sessions_user_id_status_idx" ON "study_sessions"("user_id", "status");
CREATE INDEX IF NOT EXISTS "study_sessions_user_id_created_at_idx" ON "study_sessions"("user_id", "created_at");
