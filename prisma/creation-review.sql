-- Additive and idempotent; apply after creation-draft.sql.
CREATE TABLE IF NOT EXISTS "creation_conversation_entries" (
  "id" TEXT PRIMARY KEY,
  "draftId" TEXT NOT NULL REFERENCES "creation_drafts"("id") ON DELETE CASCADE,
  "requestId" TEXT NOT NULL,
  "role" TEXT NOT NULL CHECK ("role" IN ('user', 'assistant')),
  "message" TEXT NOT NULL,
  "proposal" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("draftId", "requestId", "role")
);
CREATE INDEX IF NOT EXISTS "creation_conversation_draft_created_idx"
  ON "creation_conversation_entries" ("draftId", "createdAt", "id");
