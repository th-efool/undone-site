# S6A Additive Rollout & Safe Rollback Runbook

## 1. Executive Summary & Purpose

This document provides the authoritative, operator-facing procedure for executing the additive schema rollout and managing the safe rollback/disable workflow for the canonical cohort builder (`/quest/build/[workspaceId]` and `packages/interaction-builder`).

### Scope & Boundaries
- **Rehearsal Context**: Validated locally on disposable isolated PostgreSQL (embedded port `15433`).
- **Authorization Limit**: This runbook describes **rollout preparation** and local verification. Shared database migrations, shared feature activation, and production deployments remain unauthorized until explicit operator sign-off.
- **Zero Data Loss Guarantee**: All migrations are strictly additive. Rolling back or disabling v2 intake does not require dropping tables, truncating data, or modifying v1 creation tables.

---

## 2. Ordered Migration Runbook

All migrations must be executed sequentially in the following strict order. Never apply a migration out of sequence.

| Step | SQL Migration File | Purpose & Objects Created |
|---|---|---|
| **0. Preflight** | Baseline Inspection | Verify baseline database connectivity, existing v1 tables (`users`, `creation_drafts`, `creation_jobs`, `cohorts`, `lessons`). |
| **1. Migration 1** | `packages/interaction-builder/migrations/001_interaction_schema.sql` | Creates 8 core interaction engine tables: `interaction_workspaces`, `interaction_requests`, `interaction_events`, `interaction_outbox`, `interaction_messages`, `interaction_runs`, `interaction_steps`, `interaction_proposals`, and active run unique index. |
| **2. Migration 2** | `prisma/interaction-s3-storage.sql` | Creates 3 durable text storage tables: `cohort_text_artifacts`, `cohort_text_jobs`, `cohort_text_job_edges`, and initial check constraints. |
| **3. Migration 3** | `prisma/interaction-s4b-sources.sql` | Expands check constraints on `cohort_text_artifacts` (`kind_ck`) and `cohort_text_jobs` (`stage_ck`) to support multi-source acquisition and extraction (`source_input`, `source_raw`, `acquisition`, `extraction`). |
| **4. Migration 4** | `prisma/interaction-s5-effects.sql` | Creates `interaction_effects` table with indexes for idempotent learner activation (`/play?cohort=...`) and public cohort release (`/cohort/.../overview`). |

### Command-Line Execution Template
```bash
# Set connection to target PostgreSQL database
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Apply ordered migrations
psql "$DATABASE_URL" -f packages/interaction-builder/migrations/001_interaction_schema.sql
psql "$DATABASE_URL" -f prisma/interaction-s3-storage.sql
psql "$DATABASE_URL" -f prisma/interaction-s4b-sources.sql
psql "$DATABASE_URL" -f prisma/interaction-s5-effects.sql
```

---

## 3. Post-Migration Verification & Readiness Probes

Immediately following migration execution, run the automated verification probes:

### 1. Schema & Configuration Readiness Check
```bash
npm run interaction:readiness
```
**Expected Output:**
- `Profile: initial_rollout` (or `isolated_local` in dev/test)
- `PostgreSQL interaction + S3/S4B durable source schema: ready`
- `INTERACTION_TEXT_DRIVER value (durable): configured`
- `V2 Landing Intake driver agreement (durable): configured`
- `YouTube Source Capability (disabled): disabled`
- `GitHub Source Capability (disabled): disabled`
- Exit Code: `0`

### 2. Worker Lifecycle & Backlog Diagnostics
```bash
npm run interaction:worker:diagnostics
```
**Expected Output:**
- Reports total jobs, active queued/running work, failed jobs (`0`), and lease recovery status.
- Zero secret disclosure (no conversation prompts, credentials, or tokens displayed).

### 3. Automated Local Rehearsal Script
To simulate the entire rollout and rollback cycle on a disposable embedded PostgreSQL instance:
```bash
npm run interaction:rehearse:rollout
```
**Output:**
```
=== S6A Additive Rollout & Safe Rollback Local Rehearsal ===
[Phase 0] PASS: Isolated database created
[Phase 1] PASS: Baseline schema preflight verified with active v1 creation data.
[Phase 2] PASS: Migration 1 applied. 8 interaction tables and active unique index verified.
[Phase 3] PASS: Migration 2 applied. 3 durable text tables verified.
[Phase 4] PASS: Migration 3 applied. S4B source constraints verified.
[Phase 5] PASS: Migration 4 applied. interaction_effects table verified.
[Phase 6] PASS: Schema and readiness probe validated successfully.
[Phase 7] PASS: v1 creation drafts read and written without interference.
[Phase 8] PASS: v2 intake, durability, worker ticks, and diagnostics verified.
[Phase 9] PASS: Stale lease rejected; replacement worker successfully recovered job.
[Phase 10] PASS: Safe rollback preserves all data; new intake disabled while existing workspaces stay intact.
✅ ALL S6A ADDITIVE ROLLOUT & ROLLBACK PHASES PASSED CLEANLY
```

---

## 4. Safe Rollback / Disable Runbook

If an incident occurs in production or the operator decides to pause v2 cohort creation, follow this safe disable procedure.

### Step 1: Disable V2 Intake Flag
Update the environment variable in the host application configuration:
```bash
INTERACTION_COHORT_V2_ENABLED='0'
```
Restart or reload the Next.js application processes.

### Step 2: Verify Intake Fallback Behavior
1. **New User Landing**:
   - Visiting `/` or `/quest/start` detects `INTERACTION_COHORT_V2_ENABLED='0'`.
   - The user is navigated to `/quest/start`, which displays an honest notice: *"New builder intake is unavailable. Existing workspaces remain accessible."*
   - The user's prompt is preserved in browser `sessionStorage` and rendered in a blockquote.
   - For compatible drafts (prompts without pasted sources), an explicit link `<a href="/quest/new?handoff=1">Continue with existing creator</a>` is provided. If pasted text is attached, an honest incompatibility notice is displayed and the text is preserved without redirect.
2. **Existing V2 Workspaces**:
   - Creators with existing workspaces at `/quest/build/[workspaceId]` retain **100% read, resume, and edit access**.
   - Workspaces in `interaction_workspaces` remain accessible.
   - Learner links (`/play?cohort=...`) and public cohort pages (`/cohort/.../overview`) remain fully functional.
3. **Background Workers**:
   - Background worker processes continue processing in-flight jobs or can be drained gracefully.
   - Workers obey fence tokens and will not corrupt state.

### Step 3: Absolute Prohibitions During Rollback
- **DO NOT** drop the `interaction_*`, `cohort_text_*`, or `interaction_effects` tables.
- **DO NOT** delete workspace records or event logs.
- **DO NOT** attempt to convert a durable v2 workspace back to a v1 `CreationDraft`.

---

## 5. Stop Conditions & Failure Scenarios

| Scenario | Indicator / Error Code | Operator Action |
|---|---|---|
| **Driver Mismatch** | `DURABLE_DRIVER_REQUIRED` (HTTP 503) | Ensure `INTERACTION_TEXT_DRIVER='durable'`. Do not set `INTERACTION_COHORT_V2_ENABLED='1'` with `INTERACTION_TEXT_DRIVER='snapshot'`. |
| **Schema Incomplete** | `S3_SCHEMA_NOT_INSTALLED` / `S4B_SCHEMA_NOT_INSTALLED` | Run `npm run interaction:readiness`. Verify all 4 migration scripts were executed in order on the PostgreSQL database. |
| **Handler Version Unsupported** | `S3_HANDLER_VERSION_UNSUPPORTED` | An outdated worker is processing jobs created by a newer handler version. Deploy matching worker binary. |
| **Worker Lease Expiry** | `STALE_WORKSPACE` / Fence mismatch | Normal recovery behavior: the replacement worker increments `fence` and takes over. Stale worker commit is safely rejected. |
| **Provider Quota Exceeded** | `RATE_LIMIT_RISK` / Provider 429 | Keep YouTube and GitHub disabled (`'0'`). Use local fixtures or provision dedicated rate-monitored credentials before enabling. |
