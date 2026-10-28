import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../sql/messaging/messaging-invitations-and-restrictions.sql', import.meta.url), 'utf8');

describe('messaging invitations and restrictions additive SQL migration', () => {
  it('applies idempotently with zero destructive DDL and enforces constraints', async () => {
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i);

    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TYPE "MemberRole" AS ENUM ('EXPLORER', 'MODERATOR', 'CREATOR');
        CREATE TABLE "users" ("id" TEXT PRIMARY KEY, "email" TEXT, "name" TEXT, "username" TEXT);
        CREATE TABLE "cohorts" ("id" TEXT PRIMARY KEY, "creatorId" TEXT NOT NULL REFERENCES "users"("id"), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE "cohort_members" ("cohortId" TEXT NOT NULL REFERENCES "cohorts"("id") ON DELETE CASCADE, "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "role" "MemberRole" NOT NULL DEFAULT 'EXPLORER', "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("cohortId", "userId"));
        CREATE TABLE "communities" ("id" TEXT PRIMARY KEY, "cohortId" TEXT UNIQUE NOT NULL REFERENCES "cohorts"("id") ON DELETE CASCADE, "chatEnabled" BOOLEAN NOT NULL DEFAULT true, "eventsEnabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE "channels" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "communityId" TEXT NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
      `);

      // Seed a user and cohort without membership/community
      await db.exec(`INSERT INTO "users" ("id", "email") VALUES ('user-1', 'u1@test.com'), ('user-2', 'u2@test.com')`);
      await db.exec(`INSERT INTO "cohorts" ("id", "creatorId") VALUES ('cohort-1', 'user-1')`);

      // First run
      await db.exec(migration);

      // Verify creator membership backfilled
      const members = await db.query<{ cohortId: string; userId: string; role: string }>(
        `SELECT "cohortId", "userId", "role" FROM "cohort_members"`
      );
      expect(members.rows).toHaveLength(1);
      expect(members.rows[0]).toEqual({ cohortId: 'cohort-1', userId: 'user-1', role: 'CREATOR' });

      // Verify community backfilled
      const comms = await db.query<{ id: string; cohortId: string; chatEnabled: boolean }>(
        `SELECT "id", "cohortId", "chatEnabled" FROM "communities"`
      );
      expect(comms.rows).toHaveLength(1);
      expect(comms.rows[0].cohortId).toBe('cohort-1');

      // Verify general channel backfilled
      const chans = await db.query<{ id: string; name: string }>(
        `SELECT "id", "name" FROM "channels" WHERE "communityId" = $1`,
        [comms.rows[0].id]
      );
      expect(chans.rows).toHaveLength(1);
      expect(chans.rows[0].name).toBe('general');

      // Second run (idempotency test)
      await db.exec(migration);

      // Verify invitation insertion and uniqueness
      await db.exec(`
        INSERT INTO "cohort_invitations" ("id", "cohortId", "inviterId", "tokenHash", "expiresAt")
        VALUES ('inv-1', 'cohort-1', 'user-1', 'hash-123', NOW() + INTERVAL '7 days')
      `);

      // Duplicate tokenHash must fail
      await expect(
        db.exec(`
          INSERT INTO "cohort_invitations" ("id", "cohortId", "inviterId", "tokenHash", "expiresAt")
          VALUES ('inv-2', 'cohort-1', 'user-1', 'hash-123', NOW() + INTERVAL '7 days')
        `)
      ).rejects.toThrow();

      // Verify user restriction insertion and uniqueness
      await db.exec(`
        INSERT INTO "user_restrictions" ("id", "userId", "reason")
        VALUES ('res-1', 'user-2', 'Spamming')
      `);

      // Duplicate userId restriction must fail
      await expect(
        db.exec(`
          INSERT INTO "user_restrictions" ("id", "userId", "reason")
          VALUES ('res-2', 'user-2', 'Another reason')
        `)
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });
});
