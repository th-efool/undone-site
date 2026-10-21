-- Phase 10: Advanced Group Features, Study Room Shared Sprints & Environment, Message Pinning & Moderation Audit

-- 1. Room Sprints
CREATE TABLE IF NOT EXISTS room_sprints (
  id TEXT PRIMARY KEY,
  "studyRoomId" TEXT NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  "creatorId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  "targetDurationSeconds" INTEGER NOT NULL,
  "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resumedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  deadline TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  version INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_room_sprints_room_status ON room_sprints("studyRoomId", status);

-- 2. Room Sprint Participants
CREATE TABLE IF NOT EXISTS room_sprint_participants (
  "sprintId" TEXT NOT NULL REFERENCES room_sprints(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'JOINED',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  PRIMARY KEY ("sprintId", "userId")
);

CREATE INDEX IF NOT EXISTS idx_room_sprint_participants_user ON room_sprint_participants("userId");

-- 3. Room Environments
CREATE TABLE IF NOT EXISTS room_environments (
  "studyRoomId" TEXT PRIMARY KEY REFERENCES study_rooms(id) ON DELETE CASCADE,
  "sceneId" TEXT NOT NULL DEFAULT 'lofi-cafe',
  "soundscapeId" TEXT,
  "musicPresetId" TEXT,
  "musicStreamUrl" TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  "updatedByUserId" TEXT REFERENCES users(id) ON DELETE SET NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Room Controllers
CREATE TABLE IF NOT EXISTS room_controllers (
  "studyRoomId" TEXT NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'MODERATOR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("studyRoomId", "userId")
);

CREATE INDEX IF NOT EXISTS idx_room_controllers_user ON room_controllers("userId");

-- 5. Extend Messages table for Pinning and Announcements
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "pinnedById" TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS "isAnnouncement" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_messages_channel_pinned ON messages("channelId", "isPinned");

-- 6. Message Moderation Audits
CREATE TABLE IF NOT EXISTS message_moderation_audits (
  id TEXT PRIMARY KEY,
  "channelId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  "moderatorId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  reason TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_msg_mod_audits_channel ON message_moderation_audits("channelId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_msg_mod_audits_moderator ON message_moderation_audits("moderatorId");
