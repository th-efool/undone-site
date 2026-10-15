# S6A Minimal Configuration Profiles & Fail-Closed Readiness Guide

## Overview
This document defines the authoritative, minimal configuration profiles for deploying and verifying the Canonical Cohort Builder (`/quest/build/[workspaceId]`). It guarantees that HTTP handlers and background workers agree on drivers, schemas, and enabled capabilities, failing closed before accepting work that cannot be processed.

---

## 1. Minimal Configuration Profiles

### Profile 1: Isolated Local Verification (`isolated_local`)
Used for deterministic testing, CI runs, and developer verification against local PostgreSQL.
```bash
# Core Runtime & Database
NODE_ENV="test"
DATABASE_URL="postgresql://s3test:s3-local-only@127.0.0.1:15433/s3test"
INTERACTION_TEXT_DRIVER="durable"
INTERACTION_COHORT_V2_ENABLED="1"

# Local Deterministic Fixtures (Zero Paid API Calls)
INTERACTION_MODEL_FIXTURE="1"
INTERACTION_YOUTUBE_FIXTURE="1"
INTERACTION_GITHUB_TEST_MOCK="1"

# Capabilities (Under Test)
INTERACTION_PDF_ENABLED="1"
INTERACTION_WEB_ENABLED="1"
INTERACTION_YOUTUBE_ENABLED="1"
INTERACTION_GITHUB_ENABLED="1"
```

### Profile 2: Intended Initial Shared Rollout (`initial_rollout`)
The safe, minimal profile recommended for an operator-supervised rollout to internal or pilot users. External unverified providers remain strictly disabled.
```bash
# Core Runtime & Database
NODE_ENV="production"
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<database>?sslmode=require"
INTERACTION_TEXT_DRIVER="durable"
INTERACTION_COHORT_V2_ENABLED="1"

# Production Model Credentials (Budget Capped)
GEMINI_API_KEY="<production_gemini_api_key_minimum_20_chars>"
# ANTHROPIC_API_KEY="<optional_fallback_key>"

# Supported Initial Capabilities
INTERACTION_PDF_ENABLED="0"       # Keep disabled until file size/memory quotas verified
INTERACTION_WEB_ENABLED="0"       # Keep disabled until egress firewall/SSRF rules verified
INTERACTION_YOUTUBE_ENABLED="0"   # Strictly disabled (Google API video owner OAuth required)
INTERACTION_GITHUB_ENABLED="0"    # Strictly disabled (unauthenticated 60 req/hr rate limit risk)
```

### Profile 3: Disabled Intake / Rollback Profile (`disabled_intake`)
Used to pause or roll back new v2 cohort creation while **preserving full read/resume access** to existing workspaces and accepted learner cohorts.
```bash
# Core Runtime & Database
NODE_ENV="production"
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<database>?sslmode=require"
INTERACTION_TEXT_DRIVER="durable"
INTERACTION_COHORT_V2_ENABLED="0"   # Stops new v2 intake immediately

# Existing Workspaces & Learner Delivery
# - /quest/start displays honest notice and offers /quest/new?handoff=1 for compatible inputs
# - /quest/build/[workspaceId] continues serving existing workspaces
# - /play?cohort=<id> and /cohort/<id>/overview continue serving released cohorts
```

---

## 2. Fail-Closed Agreement Rules

| Scenario | HTTP Intake Response | Worker Behavior | Operator Action |
| :--- | :---: | :---: | :--- |
| **`INTERACTION_TEXT_DRIVER` invalid (e.g. `'custom'`)** | HTTP 503 `INVALID_TEXT_DRIVER` | Refuses startup; exits with code 1 | Correct environment variable to `'durable'`. |
| **`INTERACTION_COHORT_V2_ENABLED='1'` but `INTERACTION_TEXT_DRIVER='snapshot'`** | HTTP 503 `DURABLE_DRIVER_REQUIRED` | N/A | Set `INTERACTION_TEXT_DRIVER='durable'`. |
| **Connector enabled without durable driver** | HTTP 503 `DURABLE_DRIVER_REQUIRED` | N/A | Ensure `INTERACTION_TEXT_DRIVER='durable'`. |
| **S3 durable schema not installed in PostgreSQL** | HTTP 503 `S3_SCHEMA_NOT_INSTALLED` | Exits with `S3_SCHEMA_NOT_INSTALLED` | Execute migration `001_interaction_schema.sql` and `cohort_text_jobs` tables. |
| **Unsupported job handler version queued (e.g. v3)** | HTTP 503 `S3_HANDLER_VERSION_UNSUPPORTED` | Refuses to claim; flags incompatibility | Upgrade worker to match handler version. |
| **PDF/Web connector enabled without S4B constraints** | HTTP 503 `S4B_SCHEMA_NOT_INSTALLED` | Exits with `S4B_SCHEMA_NOT_INSTALLED` | Apply S4B additive constraints (`cohort_text_jobs_stage_ck`, `cohort_text_artifacts_kind_ck`). |
| **YouTube enabled without OAuth credentials or fixture** | HTTP 403 `SOURCE_CAPABILITY_DISABLED` | N/A | Keep YouTube disabled (`INTERACTION_YOUTUBE_ENABLED='0'`). |

---

## 3. Secret and Data Safety Rules

1. **No Credentials in Outputs**: Readiness probes reject placeholders (`changeme`, `placeholder`, `[SENSITIVE]`) and never echo secret strings, tokens, or database passwords in error messages, CLI output, or HTTP response bodies.
2. **No Data Mutations**: Readiness probes run read-only SQL queries (`SELECT count(*)` against `information_schema.tables` and `pg_indexes`). They never insert, update, or delete rows in operational tables.
3. **No Paid Provider Calls**: Model presence checks only verify non-empty secret format; they do not invoke provider endpoints.
