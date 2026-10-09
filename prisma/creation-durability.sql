-- Apply after creation-draft.sql. Additive; no existing cohort tables are changed.
ALTER TABLE "creation_drafts" ADD COLUMN "eventSequence" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "creation_jobs" (
 "id" TEXT PRIMARY KEY, "draftId" TEXT NOT NULL REFERENCES "creation_drafts"("id") ON DELETE CASCADE,
 "ownerId" TEXT NOT NULL, "kind" TEXT NOT NULL, "requestId" TEXT NOT NULL,
 "inputRevision" INTEGER NOT NULL, "inputFingerprint" TEXT NOT NULL, "input" JSONB NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'queued', "attempt" INTEGER NOT NULL DEFAULT 0, "checkpoint" JSONB,
 "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "leaseOwner" TEXT, "leaseToken" TEXT,
 "leaseUntil" TIMESTAMP(3), "heartbeatAt" TIMESTAMP(3), "deadlineAt" TIMESTAMP(3), "cancelRequestedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "creation_jobs_draftId_kind_inputFingerprint_key" UNIQUE("draftId","kind","inputFingerprint"),
 CONSTRAINT "creation_jobs_status_check" CHECK("status" IN ('queued','running','succeeded','failed','canceled'))
);
CREATE INDEX "creation_jobs_status_nextRunAt_leaseUntil_idx" ON "creation_jobs"("status","nextRunAt","leaseUntil");
CREATE TABLE "creation_events" (
 "id" TEXT PRIMARY KEY, "draftId" TEXT NOT NULL REFERENCES "creation_drafts"("id") ON DELETE CASCADE,
 "sequence" INTEGER NOT NULL, "envelope" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "creation_events_draftId_sequence_key" UNIQUE("draftId","sequence")
);
CREATE INDEX "creation_events_createdAt_idx" ON "creation_events"("createdAt");
CREATE TABLE "creation_budgets" ("key" TEXT PRIMARY KEY,"used" INTEGER NOT NULL DEFAULT 0,"expiresAt" TIMESTAMP(3) NOT NULL);
CREATE TABLE "creation_storage_objects" (
 "id" TEXT PRIMARY KEY, "draftId" TEXT NOT NULL REFERENCES "creation_drafts"("id") ON DELETE RESTRICT,
 "ownerId" TEXT NOT NULL, "blobId" TEXT NOT NULL UNIQUE, "kind" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'uploading', "mediaType" TEXT NOT NULL, "filename" TEXT,
 "byteLength" INTEGER NOT NULL DEFAULT 0, "reservedBytes" INTEGER NOT NULL,
 "checksum" TEXT, "artifactType" TEXT, "schemaVersion" INTEGER, "inputFingerprint" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 "completedAt" TIMESTAMP(3),"referencedAt" TIMESTAMP(3),"readLeaseUntil" TIMESTAMP(3),"publishedAt" TIMESTAMP(3),"deletingToken" TEXT
);
CREATE INDEX "creation_storage_objects_draftId_status_idx" ON "creation_storage_objects"("draftId","status");
CREATE INDEX "creation_storage_objects_status_createdAt_idx" ON "creation_storage_objects"("status","createdAt");
