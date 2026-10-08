-- Additive deployment script for the existing schema (no migration history exists).
CREATE TABLE "creation_drafts" (
  "id" TEXT PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "creation_drafts_ownerId_updatedAt_idx" ON "creation_drafts"("ownerId", "updatedAt");
