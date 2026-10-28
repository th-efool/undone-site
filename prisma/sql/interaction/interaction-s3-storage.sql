-- S3 pasted-text storage, additive only. Prepared, NOT applied to a database.
-- Run against an isolated test database before requesting a shared-DB rollout.

CREATE TABLE IF NOT EXISTS "cohort_text_artifacts" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "interaction_workspaces"("id") ON DELETE CASCADE,
  "sourceId" TEXT,
  "sourceVersion" INTEGER,
  "kind" TEXT NOT NULL,
  "inputFingerprint" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "byteLength" INTEGER NOT NULL,
  "body" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cohort_text_artifacts_source_pair_ck" CHECK (("sourceId" IS NULL) = ("sourceVersion" IS NULL)),
  CONSTRAINT "cohort_text_artifacts_bytes_ck" CHECK ("byteLength" >= 0 AND "byteLength" = octet_length("body")),
  CONSTRAINT "cohort_text_artifacts_checksum_ck" CHECK ("checksum" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "cohort_text_artifacts_kind_ck" CHECK ("kind" IN ('source_raw', 'understanding', 'chunks', 'analysis', 'assembly')),
  CONSTRAINT "cohort_text_artifacts_id_workspace_uq" UNIQUE ("id", "workspaceId")
);
CREATE INDEX IF NOT EXISTS "cohort_text_artifacts_workspace_source_version_kind_idx"
  ON "cohort_text_artifacts"("workspaceId", "sourceId", "sourceVersion", "kind");

CREATE TABLE IF NOT EXISTS "cohort_text_jobs" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "interaction_workspaces"("id") ON DELETE CASCADE,
  "jobKey" TEXT NOT NULL,
  "sourceId" TEXT,
  "sourceVersion" INTEGER,
  "stage" TEXT NOT NULL,
  "handlerVersion" INTEGER NOT NULL DEFAULT 1,
  "dependencyFingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fence" INTEGER NOT NULL DEFAULT 0,
  "leaseOwner" TEXT,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "resultArtifactId" TEXT,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cohort_text_jobs_source_pair_ck" CHECK (("sourceId" IS NULL) = ("sourceVersion" IS NULL)),
  CONSTRAINT "cohort_text_jobs_status_ck" CHECK ("status" IN ('queued', 'running', 'accepted', 'failed', 'canceled', 'superseded')),
  CONSTRAINT "cohort_text_jobs_stage_ck" CHECK ("stage" IN ('acquisition', 'understanding', 'chunking', 'analysis', 'assembly')),
  CONSTRAINT "cohort_text_jobs_attempts_ck" CHECK ("attempts" >= 0 AND "fence" >= 0),
  CONSTRAINT "cohort_text_jobs_workspace_key_uq" UNIQUE ("workspaceId", "jobKey"),
  CONSTRAINT "cohort_text_jobs_id_workspace_uq" UNIQUE ("id", "workspaceId"),
  CONSTRAINT "cohort_text_jobs_result_workspace_uq" UNIQUE ("resultArtifactId", "workspaceId"),
  CONSTRAINT "cohort_text_jobs_result_workspace_fk" FOREIGN KEY ("resultArtifactId", "workspaceId")
    REFERENCES "cohort_text_artifacts"("id", "workspaceId") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "cohort_text_jobs_status_due_lease_idx"
  ON "cohort_text_jobs"("status", "dueAt", "leaseUntil");
CREATE INDEX IF NOT EXISTS "cohort_text_jobs_workspace_source_version_idx"
  ON "cohort_text_jobs"("workspaceId", "sourceId", "sourceVersion");

CREATE TABLE IF NOT EXISTS "cohort_text_job_edges" (
  "workspaceId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "prerequisiteId" TEXT NOT NULL,
  CONSTRAINT "cohort_text_job_edges_pkey" PRIMARY KEY ("workspaceId", "jobId", "prerequisiteId"),
  CONSTRAINT "cohort_text_job_edges_not_self_ck" CHECK ("jobId" <> "prerequisiteId"),
  CONSTRAINT "cohort_text_job_edges_job_fk" FOREIGN KEY ("jobId", "workspaceId")
    REFERENCES "cohort_text_jobs"("id", "workspaceId") ON DELETE CASCADE,
  CONSTRAINT "cohort_text_job_edges_prerequisite_fk" FOREIGN KEY ("prerequisiteId", "workspaceId")
    REFERENCES "cohort_text_jobs"("id", "workspaceId") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "cohort_text_job_edges_prerequisite_idx"
  ON "cohort_text_job_edges"("workspaceId", "prerequisiteId");
