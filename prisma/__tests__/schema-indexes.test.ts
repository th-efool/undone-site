import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const schemaContent = readFileSync(new URL('../schema.prisma', import.meta.url), 'utf8');
const sqlContent = readFileSync(new URL('../performance-indexes.sql', import.meta.url), 'utf8');

function extractModelBlock(schema: string, modelName: string): string {
  const match = schema.match(new RegExp(`model\\s+${modelName}\\s+\\{([^}]+)\\}`, 's'));
  if (!match) {
    throw new Error(`Model ${modelName} not found in schema`);
  }
  return match[1];
}

describe('schema.prisma performance indexes', () => {
  it('defines required composite indexes on model Cohort', () => {
    const cohortBlock = extractModelBlock(schemaContent, 'Cohort');
    expect(cohortBlock).toContain('@@index([isPublished, visibility, publishedAt])');
    expect(cohortBlock).toContain('@@index([isPublished, visibility, qualityScore])');
    expect(cohortBlock).toContain('@@index([creatorId])');
    expect(cohortBlock).toContain('@@map("cohorts")');
  });

  it('defines required composite indexes on model Lesson', () => {
    const lessonBlock = extractModelBlock(schemaContent, 'Lesson');
    expect(lessonBlock).toContain('@@index([seasonId, order])');
    expect(lessonBlock).toContain('@@index([isPublished, seasonId])');
    expect(lessonBlock).toContain('@@index([seasonId])');
    expect(lessonBlock).toContain('@@map("lessons")');
  });

  it('defines required descending timestamp index on model Message', () => {
    const messageBlock = extractModelBlock(schemaContent, 'Message');
    expect(messageBlock).toContain('@@index([channelId, createdAt(sort: Desc)])');
    expect(messageBlock).toContain('@@index([channelId])');
    expect(messageBlock).toContain('@@index([authorId])');
    expect(messageBlock).toContain('@@map("messages")');
  });

  it('defines required user indexes on model RoomParticipant', () => {
    const participantBlock = extractModelBlock(schemaContent, 'RoomParticipant');
    expect(participantBlock).toContain('@@index([userId])');
    expect(participantBlock).toContain('@@index([userId, studyRoomId])');
    expect(participantBlock).toContain('@@index([studyRoomId])');
    expect(participantBlock).toContain('@@map("room_participants")');
  });
});

describe('performance-indexes.sql DDL migration', () => {
  const expectedStatements = [
    'CREATE INDEX IF NOT EXISTS "cohorts_isPublished_visibility_publishedAt_idx" ON "cohorts"("isPublished", "visibility", "publishedAt");',
    'CREATE INDEX IF NOT EXISTS "cohorts_isPublished_visibility_qualityScore_idx" ON "cohorts"("isPublished", "visibility", "qualityScore");',
    'CREATE INDEX IF NOT EXISTS "lessons_seasonId_order_idx" ON "lessons"("seasonId", "order");',
    'CREATE INDEX IF NOT EXISTS "lessons_isPublished_seasonId_idx" ON "lessons"("isPublished", "seasonId");',
    'CREATE INDEX IF NOT EXISTS "messages_channelId_createdAt_idx" ON "messages"("channelId", "createdAt" DESC);',
    'CREATE INDEX IF NOT EXISTS "room_participants_userId_idx" ON "room_participants"("userId");',
    'CREATE INDEX IF NOT EXISTS "room_participants_userId_studyRoomId_idx" ON "room_participants"("userId", "studyRoomId");',
  ];

  it('contains all 7 idempotent index creation statements', () => {
    for (const statement of expectedStatements) {
      expect(sqlContent).toContain(statement);
    }
  });

  it('contains no destructive or data modification statements', () => {
    expect(sqlContent).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE\s+FROM|ALTER\s+TABLE\s+.*DROP)\b/i);
  });

  it('executes idempotently in an isolated PostgreSQL instance', async () => {
    const db = new PGlite();
    try {
      // Set up base tables matching the target entities
      await db.exec(`
        CREATE TABLE "cohorts" (
          "id" TEXT PRIMARY KEY,
          "creatorId" TEXT NOT NULL,
          "isPublished" BOOLEAN NOT NULL DEFAULT false,
          "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
          "qualityScore" INTEGER NOT NULL DEFAULT 0,
          "publishedAt" TIMESTAMP WITH TIME ZONE
        );

        CREATE TABLE "lessons" (
          "id" TEXT PRIMARY KEY,
          "seasonId" TEXT NOT NULL,
          "order" INTEGER NOT NULL,
          "isPublished" BOOLEAN NOT NULL DEFAULT false
        );

        CREATE TABLE "messages" (
          "id" TEXT PRIMARY KEY,
          "channelId" TEXT NOT NULL,
          "authorId" TEXT NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );

        CREATE TABLE "room_participants" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "studyRoomId" TEXT NOT NULL
        );
      `);

      // First run: Creates all indexes
      await db.exec(sqlContent);

      // Verify that all 7 indexes were created in pg_indexes
      const result = await db.query<{ indexname: string }>(`
        SELECT indexname FROM pg_indexes
        WHERE indexname IN (
          'cohorts_isPublished_visibility_publishedAt_idx',
          'cohorts_isPublished_visibility_qualityScore_idx',
          'lessons_seasonId_order_idx',
          'lessons_isPublished_seasonId_idx',
          'messages_channelId_createdAt_idx',
          'room_participants_userId_idx',
          'room_participants_userId_studyRoomId_idx'
        )
      `);
      expect(result.rows).toHaveLength(7);

      // Second run: Ensures idempotency (IF NOT EXISTS prevents errors)
      await expect(db.exec(sqlContent)).resolves.not.toThrow();
    } finally {
      await db.close();
    }
  });
});
