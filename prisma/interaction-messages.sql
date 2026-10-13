-- Additive: durable chat transcript (second interaction migration).
CREATE TABLE "interaction_messages" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "interaction_workspaces"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "parts" JSONB NOT NULL,
  "sequence" INTEGER NOT NULL,
  "runId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interaction_messages_workspaceId_sequence_key" UNIQUE("workspaceId","sequence"),
  CONSTRAINT "interaction_messages_role_check" CHECK ("role" IN ('user','assistant','system')),
  CONSTRAINT "interaction_messages_sequence_check" CHECK ("sequence" > 0)
);
