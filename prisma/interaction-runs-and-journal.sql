-- Additive migration for Interaction S2 Durability: Runs, Steps, Proposals
BEGIN;

CREATE TABLE IF NOT EXISTS "interaction_runs" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "interaction_workspaces"("id") ON DELETE CASCADE,
  "triggeringMessageId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "contextEpoch" INTEGER NOT NULL DEFAULT 0,
  "observedRevision" INTEGER NOT NULL DEFAULT 0,
  "cursor" INTEGER NOT NULL DEFAULT 0,
  "fence" INTEGER NOT NULL DEFAULT 0,
  "leaseOwner" TEXT,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMPTZ,
  "deadline" TIMESTAMPTZ,
  "budgetReservation" JSONB,
  "budgetActual" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "interaction_runs_workspaceId_status_idx" ON "interaction_runs"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "interaction_runs_status_leaseUntil_idx" ON "interaction_runs"("status", "leaseUntil");
CREATE UNIQUE INDEX IF NOT EXISTS "interaction_runs_active_unique_idx" ON "interaction_runs"("workspaceId") WHERE "status" IN ('queued', 'running');

CREATE TABLE IF NOT EXISTS "interaction_steps" (
  "id" TEXT PRIMARY KEY,
  "runId" TEXT NOT NULL REFERENCES "interaction_runs"("id") ON DELETE CASCADE,
  "ordinal" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "toolName" TEXT,
  "inputHash" TEXT,
  "inputPayload" JSONB,
  "state" TEXT NOT NULL DEFAULT 'started',
  "result" JSONB,
  "error" TEXT,
  "effectKey" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "interaction_steps_runId_ordinal_key" UNIQUE ("runId", "ordinal")
);

CREATE INDEX IF NOT EXISTS "interaction_steps_runId_toolName_inputHash_idx" ON "interaction_steps"("runId", "toolName", "inputHash");

CREATE TABLE IF NOT EXISTS "interaction_proposals" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "interaction_workspaces"("id") ON DELETE CASCADE,
  "actionPayload" JSONB NOT NULL,
  "readSet" JSONB,
  "summary" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMPTZ,
  "decisionActor" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "interaction_proposals_workspaceId_state_idx" ON "interaction_proposals"("workspaceId", "state");

COMMIT;
