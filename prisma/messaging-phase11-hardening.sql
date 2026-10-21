-- Phase 11: Failure Hardening, Distributed Atomic Rate Limiting & Abuse Prevention

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_expires ON rate_limit_buckets("expiresAt");
