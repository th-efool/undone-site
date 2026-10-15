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

COMMIT;
