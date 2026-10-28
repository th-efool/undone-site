-- Journey stages additive expansion for recommendations and discovery.
-- Expands CHECK constraints on cohort_text_artifacts and cohort_text_jobs.
-- Wrap in BEGIN ... COMMIT.
BEGIN;

ALTER TABLE "cohort_text_artifacts" DROP CONSTRAINT IF EXISTS "cohort_text_artifacts_kind_ck";
ALTER TABLE "cohort_text_artifacts" ADD CONSTRAINT "cohort_text_artifacts_kind_ck"
  CHECK ("kind" IN ('source_input', 'source_raw', 'extraction', 'understanding', 'chunks', 'analysis', 'assembly', 'recommendations', 'discovery'));

ALTER TABLE "cohort_text_jobs" DROP CONSTRAINT IF EXISTS "cohort_text_jobs_stage_ck";
ALTER TABLE "cohort_text_jobs" ADD CONSTRAINT "cohort_text_jobs_stage_ck"
  CHECK ("stage" IN ('acquisition', 'extraction', 'understanding', 'chunking', 'analysis', 'assembly', 'recommendations', 'discovery'));

CREATE TABLE IF NOT EXISTS "cohort_model_invocations" (
  "invocationKey" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "jobKey" TEXT,
  "dependencyFingerprint" TEXT,
  "operation" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "ordinal" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'reserved',
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "totalTokens" INTEGER,
  "stepsCount" INTEGER,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settledAt" TIMESTAMP(3),
  CONSTRAINT "cohort_model_invocations_status_ck"
    CHECK ("status" IN ('reserved', 'settled', 'unknown_outcome_retained'))
);

CREATE INDEX IF NOT EXISTS "cohort_model_invocations_workspace_idx"
  ON "cohort_model_invocations" ("workspaceId", "createdAt" DESC);

COMMIT;

