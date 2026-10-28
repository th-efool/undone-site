-- Durable hosting wake-up reservation. Domain jobs and leases remain authoritative.
CREATE TABLE IF NOT EXISTS "interaction_workflow_dispatches" (
  "id" TEXT PRIMARY KEY,
  "token" TEXT NOT NULL,
  "leaseUntil" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
