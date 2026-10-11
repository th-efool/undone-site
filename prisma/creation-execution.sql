-- Apply after creation-durability.sql. Transport receipts contain identifiers only.
CREATE TABLE IF NOT EXISTS "creation_execution_dispatches" (
 "jobId" TEXT PRIMARY KEY REFERENCES "creation_jobs"("id") ON DELETE CASCADE,
 "token" TEXT NOT NULL, "leaseUntil" TIMESTAMP(3) NOT NULL,
 "runId" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
