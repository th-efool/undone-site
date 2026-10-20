-- Performance Indexes Migration for Undone Core Entities
CREATE INDEX IF NOT EXISTS "cohorts_isPublished_visibility_publishedAt_idx" ON "cohorts"("isPublished", "visibility", "publishedAt");
CREATE INDEX IF NOT EXISTS "cohorts_isPublished_visibility_qualityScore_idx" ON "cohorts"("isPublished", "visibility", "qualityScore");
CREATE INDEX IF NOT EXISTS "lessons_seasonId_order_idx" ON "lessons"("seasonId", "order");
CREATE INDEX IF NOT EXISTS "lessons_isPublished_seasonId_idx" ON "lessons"("isPublished", "seasonId");
CREATE INDEX IF NOT EXISTS "messages_channelId_createdAt_idx" ON "messages"("channelId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "room_participants_userId_idx" ON "room_participants"("userId");
CREATE INDEX IF NOT EXISTS "room_participants_userId_studyRoomId_idx" ON "room_participants"("userId", "studyRoomId");
