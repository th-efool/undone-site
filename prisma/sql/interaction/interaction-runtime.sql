-- Additive interaction-builder commit spine. Apply only after schema review/backup.
-- Existing cohort creation tables remain unchanged.
CREATE TABLE "interaction_workspaces" (
  "id" TEXT PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "domainId" TEXT NOT NULL,
  "domainVersion" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "contextEpoch" INTEGER NOT NULL DEFAULT 0,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "lifecycle" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "interaction_workspaces_revision_check" CHECK ("revision" >= 0),
  CONSTRAINT "interaction_workspaces_sequence_check" CHECK ("sequence" >= 0),
  CONSTRAINT "interaction_workspaces_lifecycle_check" CHECK ("lifecycle" IN ('active','paused','released','archived'))
);
CREATE INDEX "interaction_workspaces_ownerId_updatedAt_idx" ON "interaction_workspaces"("ownerId", "updatedAt");
CREATE INDEX "interaction_workspaces_domainId_lifecycle_idx" ON "interaction_workspaces"("domainId", "lifecycle");

CREATE TABLE "interaction_requests" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "interaction_workspaces"("id") ON DELETE CASCADE,
  "actorId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "response" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interaction_requests_workspace_actor_operation_request_key" UNIQUE("workspaceId","actorId","operation","requestId")
);
CREATE INDEX "interaction_requests_createdAt_idx" ON "interaction_requests"("createdAt");

CREATE TABLE "interaction_events" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "interaction_workspaces"("id") ON DELETE CASCADE,
  "sequence" INTEGER NOT NULL,
  "protocolVersion" INTEGER NOT NULL DEFAULT 1,
  "type" TEXT NOT NULL,
  "revision" INTEGER,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interaction_events_workspaceId_sequence_key" UNIQUE("workspaceId","sequence"),
  CONSTRAINT "interaction_events_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "interaction_events_protocol_check" CHECK ("protocolVersion" = 1)
);
CREATE INDEX "interaction_events_createdAt_idx" ON "interaction_events"("createdAt");

CREATE TABLE "interaction_outbox" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "interaction_workspaces"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "dedupKey" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseOwner" TEXT,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "interaction_outbox_status_check" CHECK ("status" IN ('pending','delivering','delivered','failed')),
  CONSTRAINT "interaction_outbox_attempts_check" CHECK ("attempts" >= 0)
);
CREATE INDEX "interaction_outbox_status_dueAt_leaseUntil_idx" ON "interaction_outbox"("status","dueAt","leaseUntil");
