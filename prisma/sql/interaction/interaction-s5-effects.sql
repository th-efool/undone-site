-- S5 Learner Delivery & Release Effects, additive only. Prepared, NOT applied to shared database.
-- Run against an isolated test database before requesting a shared-DB rollout.

CREATE TABLE IF NOT EXISTS "interaction_effects" (
  "effectKey" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "interaction_workspaces"("id") ON DELETE CASCADE,
  "contentHash" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "cohortId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "receipt" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interaction_effects_state_ck" CHECK ("state" IN ('pending', 'committed', 'failed')),
  CONSTRAINT "interaction_effects_mode_ck" CHECK ("mode" IN ('private_activation', 'public_publish')),
  CONSTRAINT "interaction_effects_hash_ck" CHECK ("contentHash" ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS "interaction_effects_workspaceId_idx" ON "interaction_effects"("workspaceId");
CREATE INDEX IF NOT EXISTS "interaction_effects_cohortId_idx" ON "interaction_effects"("cohortId");
