-- ==============================================================================
-- Migration 5: S6 Operational Supervision, Admin Controls, Artifact Protection & Retention Audit
-- Author: Antigravity Agentic Assistant
-- Scope: Additive, idempotent tables and indexes supporting S6 operational requirements.
-- Zero destructive operations. Zero changes to existing v1 or v2 tables.
-- ==============================================================================

-- 1. Artifact protection table (read leases, release pins, permanent pins, tombstones)
CREATE TABLE IF NOT EXISTS "cohort_text_artifact_protection" (
  "artifactId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "readLeaseUntil" TIMESTAMPTZ,
  "readLeaseToken" TEXT,
  "pendingReleasePinUntil" TIMESTAMPTZ,
  "pinnedPermanently" BOOLEAN NOT NULL DEFAULT FALSE,
  "pinnedCohortId" TEXT,
  "tombstonedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("artifactId", "workspaceId")
);

CREATE INDEX IF NOT EXISTS "cohort_text_artifact_protection_lease_idx"
ON "cohort_text_artifact_protection"("readLeaseUntil", "pendingReleasePinUntil", "pinnedPermanently");

-- 2. Retention and cleanup audit log (immutable append-only history of tombstones and purges)
CREATE TABLE IF NOT EXISTS "cohort_retention_audit_log" (
  "id" TEXT PRIMARY KEY,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "workspaceId" TEXT,
  "reclaimedBytes" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "cohort_retention_audit_log_target_idx"
ON "cohort_retention_audit_log"("targetType", "targetId");

-- 3. Worker supervision and liveness heartbeats (distinct from individual job lease claims)
CREATE TABLE IF NOT EXISTS "interaction_worker_heartbeats" (
  "worker_id" TEXT PRIMARY KEY,
  "hostname" TEXT NOT NULL,
  "pid" INTEGER NOT NULL,
  "registered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_heartbeat_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "active_claims" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB
);

CREATE INDEX IF NOT EXISTS "interaction_worker_heartbeats_last_idx"
ON "interaction_worker_heartbeats"("last_heartbeat_at");

-- 4. Administrative controls (operator toggles for intake, model calls, release, sources)
CREATE TABLE IF NOT EXISTS "cohort_admin_controls" (
  "control_key" TEXT PRIMARY KEY,
  "value" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT NOT NULL,
  "reason" TEXT
);

-- 5. Administrative control audit trail (immutable log of all operator toggle changes)
CREATE TABLE IF NOT EXISTS "cohort_admin_control_audit" (
  "id" TEXT PRIMARY KEY,
  "control_key" TEXT NOT NULL,
  "previous_value" JSONB,
  "new_value" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT NOT NULL,
  "reason" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "cohort_admin_control_audit_key_idx"
ON "cohort_admin_control_audit"("control_key", "updated_at");
