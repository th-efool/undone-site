-- Apply after creation draft/durability/storage scripts. No staged discoverable cohorts.
ALTER TABLE "cohorts" ADD COLUMN IF NOT EXISTS "creationSettings" JSONB;
CREATE TABLE IF NOT EXISTS "creation_publication_reservations" (
  "draftId" TEXT PRIMARY KEY REFERENCES "creation_drafts"("id") ON DELETE CASCADE,
  "cohortId" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "creation_publications" (
  "draftId" TEXT NOT NULL REFERENCES "creation_drafts"("id") ON DELETE CASCADE,
  "requestId" TEXT NOT NULL,
  "cohortId" TEXT NOT NULL,
  "mode" TEXT NOT NULL CHECK ("mode" IN ('private_activation', 'public_publish')),
  "snapshotHash" TEXT NOT NULL,
  "receipt" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("draftId", "requestId")
);
CREATE INDEX IF NOT EXISTS "creation_publications_cohort_idx" ON "creation_publications"("cohortId");
