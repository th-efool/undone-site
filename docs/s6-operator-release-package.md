# S6 Operator Release Package & Production Handoff

## 1. Executive Summary & Authoritative Release Decision

This document is the authoritative **Operator Release Package & Production Handoff** for the canonical cohort builder (`undone-site` and `packages/interaction-builder`).

### Authoritative Release Decision
> **Local operational preparation complete; final S6 deployment gate open.**

- **S6 Production Gate Status**: Local implementation, isolated database verification, supervision, admin controls, retention sweeps, disaster restore drills, and measured load acceptance are **COMPLETE**. All 10 production criteria specified in `plans/interaction-builder/06-production-and-verification.md` Section 10 are implemented, tested, and verified via `npm run interaction:gate`.
- **Shared Production Status**: The final deployment gate remains **OPEN** awaiting authorized operator execution. Zero shared migrations were executed, zero shared environment variables were activated, zero live cloud deployments were made, and zero paid API calls were triggered.
- **S4 YouTube Live Captions Gate**: Remains explicitly recorded as **OPEN** due to Google Data API v3 OAuth constraints (video owner credentials required). It remains strictly disabled in initial rollout (`INTERACTION_YOUTUBE_ENABLED=0`). Local development and tests continue safely via `INTERACTION_YOUTUBE_FIXTURE=1`.
- **S4 GitHub Acquisition**: Operates with public unauthenticated API limits (60 req/hr) and must remain disabled in initial rollout (`INTERACTION_GITHUB_ENABLED=0`) until a dedicated monitored personal access token is configured.
- **S5 Learner Delivery**: Relational release and learner progress persistence into MongoDB are fully verified locally and across isolated test databases.
- **S6 Operational Readiness**: Operational supervision, administrative controls, retention lifecycles, and measured load gates are fully verified.
- **S7 Decoupling Constraint**: S7 (standalone template/package extraction) carries all open S6 deployment gates into its baseline and must **NOT** be auto-started without an explicit user prompt.

---

## 2. Repository & Submodule Baseline

| Component | Pinned Version / Commit | Notes |
|---|---|---|
| **Host Application (`undone-site`)** | `08b0a01` (plus S6 handoff commits) | Branch `master` synchronized with `origin/master` and `origin/planning` |
| **Engine Submodule (`packages/interaction-builder`)** | `4f92118` | Authority for reusable engine; consumed via public exports; clean working tree |
| **End-to-End Acceptance Artifacts** | `s4-enabled-completed.png`, `s5-completed.png` | Located in `.tmp/s4-postgres-runtime/` and `.tmp/s5-postgres-runtime/` |
| **Measured Load Baseline** | `npm run interaction:load:measure` | Intake ack p95 < 3.4ms; event visibility p95 < 0.9ms; reconnect p95 < 0.2ms |
| **Integrated Acceptance Suite** | `npm run interaction:acceptance` | All 11 operational lifecycle phases passed on isolated PostgreSQL & MongoDB (exit 0) |

---

## 3. Requirement-to-Evidence Matrix (T01–T31 Across 5 Explicit Tiers)

Every requirement from `plans/interaction-builder/06-production-and-verification.md` is strictly classified across 5 distinct operational tiers. Requirements are never downgraded or falsely marked green.

### Tier 1: Verified Local Implementation (Unit, Property, and Schema Tests)
*Tests execute in-repo using deterministic pure logic, Zod schema contracts, and client view-model reducers.*

| Req ID | Requirement Description | Verification Evidence | Status |
|---|---|---|---|
| **T01** | Core/Domain Separation & Agenda Portability | `packages/interaction-builder/__tests__/agenda.test.ts` (Zero host or Next imports in engine core) | **VERIFIED** |
| **T02** | Client Reducer & Immutability | `packages/interaction-builder/__tests__/store.test.ts` (Single-store immutability, zero lost actions) | **VERIFIED** |
| **T03** | Truthful 5-Stage Job Progress Derivation | `src/client/screens/cohortBuilder/__tests__/stage-canonical-progress.test.ts` (10/10 contract tests pass) | **VERIFIED** |
| **T04** | Draft Preservation Across Transitions | `src/client/screens/cohortBuilder/__tests__/draft-preservation.test.tsx` (8/8 tests pass without unmounting) | **VERIFIED** |
| **T05** | Mobile Viewport Navigation & Visibility | `src/client/screens/cohortBuilder/__tests__/shell.test.tsx` (Persistent pane switch at <=820px) | **VERIFIED** |
| **T11** | Action Schema Validation & Tool Filtering | `security-enforcement.test.ts` Axis 4 (Forged actions & unregistered tools rejected in plan) | **VERIFIED** |
| **T12** | Request & Body Payload Ceilings | `security-enforcement.test.ts` Axis 3 (256KB action bound, 2MB PDF bound, 64KB release bound) | **VERIFIED** |
| **T13** | Safe Link Sanitization & Protocol Defense | `security-enforcement.test.ts` Axis 6 (`javascript:`, `vbscript:`, `data:` URLs neutralized) | **VERIFIED** |
| **T14** | Source Prompt Injection Containment | `security-enforcement.test.ts` Axis 4 (Untrusted text safely isolated from system prompt instructions) | **VERIFIED** |
| **T15** | SSRF & Loopback/Metadata BlockList | `security-enforcement.test.ts` Axis 9 (`169.254.169.254`, `127.0.0.1`, private IPv4/IPv6 rejected) | **VERIFIED** |
| **T16** | DNS Rebinding Socket Address Verification | `security-enforcement.test.ts` Axis 9 (Socket remote address matched against resolved IP) | **VERIFIED** |
| **T21** | Revision CAS & Stale Approval Rejection | `security-enforcement.test.ts` Axis 5 (Mismatching `expectedRevision` throws 409 `STALE_WORKSPACE`) | **VERIFIED** |
| **T22** | Public Cohort Downgrade Protection | `release-postgres.test.ts` (Attempt to revert public cohort to private throws 409) | **VERIFIED** |
| **T26** | Conservative Budget Accounting on Failure | `budget-enforcement.test.ts` T3, T4, T5 (Unknown outcome retained as spent without refund) | **VERIFIED** |
| **T27** | Retention Policy Production Validation | `retention-cleanup.test.ts` T1 (Fails closed on missing or unpinned released artifacts) | **VERIFIED** |
| **T28** | Administrative Control Isolation | `admin-controls.test.ts` T1-T4 (Controls strictly excluded from model tools; audit logged) | **VERIFIED** |
| **T31** | Extended Diagnostics Privacy Redaction | `worker-supervision.test.ts` T4 (All correlation IDs redacted; zero secret or prompt leakage) | **VERIFIED** |

### Tier 2: Verified Isolated Integration (Local PostgreSQL, MongoDB, SSE, Supervised Worker)
*Tests execute against disposable loopback PostgreSQL (`15434`), MongoMemoryServer, and real background workers.*

| Req ID | Requirement Description | Verification Evidence | Status |
|---|---|---|---|
| **T06** | Real PostgreSQL Restart & DAG Execution | `scripts/s3-postgres-verification.ts`, `scripts/s6-integrated-acceptance.ts` Phase 2 | **VERIFIED** |
| **T07** | Expired Lease Recovery & CAS Fencing | `scripts/s6-integrated-acceptance.ts` Phase 5 (Replacement worker claims expired lease; fence protects) | **VERIFIED** |
| **T08** | Authenticated SSE Stream Reconnection | `src/app/api/interaction/v1/workspaces/[workspaceId]/events/route.test.ts`, `sse.test.ts` | **VERIFIED** |
| **T09** | PDF Server-Side Upload & Parsing | `scripts/creation-durability-smoke.ts`, `prisma/interaction-s4b-sources.sql` | **VERIFIED** |
| **T10** | Web Extraction & Content Boundary Bounds | `src/server/domain/cohort-creation/__tests__/web-extraction.test.ts` (200KB limit, article extraction) | **VERIFIED** |
| **T17** | Supervised Worker Heartbeats & Draining | `worker-supervision.test.ts`, `scripts/s6-integrated-acceptance.ts` Phase 5 (SIGTERM clean exit) | **VERIFIED** |
| **T18** | Missing-Worker Queue Admission Ceiling | `worker-supervision.test.ts` T3 (Queue capped at 50; throws 503 `WORKER_UNAVAILABLE`) | **VERIFIED** |
| **T19** | Per-User Concurrency Across Workspaces | `budget-enforcement.test.ts` T1, `scripts/s6-integrated-acceptance.ts` Phase 6 (Limit: 1 active run) | **VERIFIED** |
| **T20** | Atomic Budget Reservation in SQL | `budget-enforcement.test.ts` T2, `scripts/s6-integrated-acceptance.ts` Phase 6 (Zero oversubscription) | **VERIFIED** |
| **T23** | Relational Release & Artifact Pinning | `scripts/s6-integrated-acceptance.ts` Phase 7 (Permanent pins protect released cohort artifacts) | **VERIFIED** |
| **T24** | Real Learner Progress in MongoDB | `scripts/s6-integrated-acceptance.ts` Phase 7 (Chunk completion persisted in `user_chunk_progress`) | **VERIFIED** |
| **T25** | Synthetic Public Release & Discovery | `scripts/s6-integrated-acceptance.ts` Phase 8 (Public cohort materialization and overview route) | **VERIFIED** |
| **T29** | Retention Cleanup Dry-Run Sweep | `scripts/s6-integrated-acceptance.ts` Phase 11 (Inspect-only sweep reports candidates safely) | **VERIFIED** |
| **T30** | Disaster Restore Drill & SHA-256 Checksums | `scripts/s6-integrated-acceptance.ts` Phase 11 (`validateBackupBundle` verifies checksums) | **VERIFIED** |

### Tier 3: External-Provider Prerequisites (Requires External Credentials / Quotas)
*Prerequisites that cannot be satisfied by local code and require external account authorization.*

| Req ID | Requirement Description | Operational Prerequisite | Status |
|---|---|---|---|
| **P01** | Live YouTube Caption Acquisition | Google Data API v3 `captions.download` requires video owner OAuth credentials. Public transcripts cannot be downloaded without owner auth. Disabled in production (`INTERACTION_YOUTUBE_ENABLED=0`). Tested via `INTERACTION_YOUTUBE_FIXTURE=1`. | **OPEN (Explicit Blocker)** |
| **P02** | Monitored GitHub API Personal Access Token | Public GitHub API is rate-limited to 60 req/hr unauthenticated. A dedicated monitored GitHub PAT is required before enabling public repo intake (`INTERACTION_GITHUB_ENABLED=0` in Profile 2). | **OPEN (Explicit Blocker)** |
| **P03** | Paid Cloud LLM Provider Accounts | Production API keys for OpenAI / Anthropic / Google Gemini with billing accounts and rate quotas. Tested locally via deterministic fake model streams. | **OPEN for Operator Provisioning** |

### Tier 4: Deployment-Environment Checks (To Validate Post-Deployment in Target Env)
*Infrastructure parameters that depend on target hosting provider (Vercel, AWS, Fly.io, etc.).*

| Check ID | Infrastructure Check | Target Specification | Status |
|---|---|---|---|
| **E01** | Database Network Latency | Regional co-location between HTTP Edge and PostgreSQL (< 50ms latency) | **Pending Deployment** |
| **E02** | PostgreSQL Connection Pool Ceiling | Pool size sized to handle HTTP requests + background worker concurrency | **Pending Deployment** |
| **E03** | Edge CDN Buffering / SSE Bypass | CDN must NOT buffer SSE stream endpoints (`/api/interaction/v1/workspaces/*/events`) | **Pending Deployment** |
| **E04** | Worker Process Supervisor | Process manager (systemd, ECS, Docker) configured with restart policy | **Pending Deployment** |

### Tier 5: Shared Actions Requiring Authorization (Human Operator Execution)
*Actions strictly prohibited from autonomous assistant execution.*

| Action ID | Action Description | Execution Method | Status |
|---|---|---|---|
| **A01** | Shared Production Database Migrations | Execute Migrations 1-5 with `-v ON_ERROR_STOP=1` on production DB | **Requires Operator Auth** |
| **A02** | Production Environment Variables | Configure Profile 2 environment variables in deployment dashboard | **Requires Operator Auth** |
| **A03** | Production Worker Daemon Launch | Start background worker (`npm run interaction:worker`) on production host | **Requires Operator Auth** |
| **A04** | Public DNS / Routing Activation | Point production domain or feature flag to new V2 landing intake | **Requires Operator Auth** |

---

## 4. Minimal Configuration Profiles

Three configuration profiles are formalized in `docs/s6a-configuration-profiles.md`:

### Profile 1: Isolated Local Verification (`isolated_local`)
- For local unit tests, CI test runs, and isolated rehearsal scripts.
- Uses embedded PostgreSQL (`s3test` loopback on port `15434`).
- Uses local deterministic model and provider fixtures (`INTERACTION_LOCAL_MODEL_FIXTURE=1`).

### Profile 2: Recommended Initial Production Rollout (`initial_rollout`)
- Enables canonical v2 text intake, PDF sources, and Web sources.
- YouTube and GitHub remain strictly disabled (`'0'`).
- Strictly enforces durable driver agreement:
```bash
INTERACTION_COHORT_V2_ENABLED=1
INTERACTION_TEXT_DRIVER=durable
INTERACTION_PDF_ENABLED=1
INTERACTION_WEB_ENABLED=1
INTERACTION_YOUTUBE_ENABLED=0
INTERACTION_GITHUB_ENABLED=0
COHORT_BUILDER_MAX_CONCURRENT_RUNS_PER_USER=1
DATABASE_URL="postgresql://user:pass@host:5432/production_db?sslmode=require"
```

### Profile 3: Disabled Intake / Rollback Profile (`disabled_intake`)
- Safely pauses new v2 creation while keeping all existing v2 workspaces and learner deliveries readable:
```bash
INTERACTION_COHORT_V2_ENABLED=0
INTERACTION_TEXT_DRIVER=durable
```

---

## 5. Ordered Database Migration Sequence

All 5 migrations are additive, non-destructive, and idempotent. Apply them in this exact order using `-v ON_ERROR_STOP=1`:

```bash
# 1. Core interaction engine tables (8 tables + active unique index)
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f packages/interaction-builder/migrations/001_interaction_schema.sql

# 2. Durable text pipeline (cohort_text_artifacts, cohort_text_jobs, cohort_text_job_edges)
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f prisma/interaction-s3-storage.sql

# 3. Source constraints expansion (supports source_input, source_raw, acquisition, extraction)
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f prisma/interaction-s4b-sources.sql

# 4. Release effect journaling (interaction_effects)
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f prisma/interaction-s5-effects.sql

# 5. S6 Operational supervision, admin controls, artifact protection & retention audit
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f prisma/interaction-s6-operations.sql
```

---

## 6. Operator Commands & Diagnostics

| Command | Purpose | Expected Output / Result |
|---|---|---|
| `npm run interaction:acceptance` | Runs full 11-phase integrated operational acceptance test suite on isolated PostgreSQL & MongoDB. | `ALL 11 INTEGRATED OPERATIONAL ACCEPTANCE PHASES PASSED!`, exit 0. |
| `npm run interaction:gate` | Runs full S6 production release gate (10 criteria). | `ALL 10 S6 PRODUCTION GATES PASSED!`, exit 0. |
| `npm run interaction:readiness` | Probes environment, database schema, driver agreement, and worker heartbeats. | Reports `status: ready`, profile: `initial_rollout`, exit 0. |
| `npm run interaction:worker:diagnostics` | Read-only operational query for queue backlog, outbox lag, worker heartbeats, and budget accounting. | Formatted diagnostic report with redacted correlation IDs and zero secret exposure. |
| `npm run interaction:worker:check` | Verifies worker imports and Node server condition without DB side-effects. | Reports clean validation, exit 0. |
| `npm run interaction:worker` | Starts supervised Node interaction worker. | Registers worker heartbeat, claims runs/jobs, processes ticks, handles SIGTERM. |
| `npm run interaction:load:measure` | Runs measured load acceptance harness. | Reports latency distributions (p50, p95, p99), 0 lost actions, 0 duplicate releases. |
| `npm run interaction:rehearse:rollout` | Rehearses all 11 phases of rollout, migration, worker recovery, and rollback on isolated disposable PostgreSQL. | `ALL S6 ADDITIVE ROLLOUT & ROLLBACK PHASES PASSED CLEANLY`, exit 0. |
| `npm run verify:vercel` | Full production build simulation (TypeScript, Prisma, distributions, webpack). | `VERIFICATION SUCCESS: Project is ready for Vercel deploy!`, exit 0. |

---

## 7. Operational Runbooks

### Runbook A: Production Driver & Supervised Worker Lifecycle
1. **Starting Workers**:
   - The primary execution driver is the supervised Node worker: `npm run interaction:worker`.
   - Each worker generates a unique `workerId` (`worker-hostname-pid-timestamp`), records registration in `interaction_worker_heartbeats`, and sends a heartbeat update every 15 seconds.
   - Workers claim interactive assistant runs first, then durable DAG candidate jobs, ensuring interactive requests are never starved.
2. **Graceful Shutdown**:
   - On receiving `SIGTERM` or `SIGINT`, the worker stops claiming new work, allows active ticks to finish draining, and cleanly deregisters from `interaction_worker_heartbeats` in the `finally` block.
3. **Worker Crash & Recovery**:
   - If a worker crashes ungracefully, its heartbeat expires after 30 seconds (`last_heartbeat_at < now() - 30s`).
   - Active job leases held by the crashed worker expire at `leaseUntil`.
   - A replacement worker claims the expired job and increments the monotonically increasing `fence` token.
   - Any late-arriving commit from the crashed worker is strictly rejected by PostgreSQL CAS check (`WHERE "id" = $1 AND "fence" = $2`), preventing split-brain commits.
4. **Worker Absence & Queue Protection**:
   - If no workers are active, `assertAdmissionQueueCapacity` allows queued work up to a ceiling of 50 jobs.
   - When the queue exceeds 50 jobs without active workers, the system fails closed with HTTP 503 `WORKER_UNAVAILABLE` (`{ retryable: true }`), preventing uncontrolled queue growth and preventing heavy asynchronous work from silently shifting to browser or HTTP serverless threads.

### Runbook B: Administrative Controls & Operational Toggles
All administrative operations are performed via `src/server/domain/cohort-builder/admin-controls.ts`. Every change is immutably logged to `cohort_admin_control_audit`. These operations are strictly inaccessible to assistant model tools.

1. **Pause / Resume New Intake**:
   - Check status: `await isIntakeEnabled(pool)`
   - Pause: `await setIntakeEnabled(pool, { enabled: false, actorId: 'operator-username', reason: 'Scheduled maintenance' })`
   - Resume: `await setIntakeEnabled(pool, { enabled: true, actorId: 'operator-username', reason: 'Maintenance completed' })`
   - Behavior when paused: Homepage and `/quest/start` honestly explain intake is unavailable; existing workspaces and learner deliveries remain 100% accessible.
2. **Pause / Resume Model Calls**:
   - Pause: `await setModelCallsPaused(pool, { paused: true, actorId: 'operator-username', reason: 'Provider outage' })`
   - When paused, new model turns fail closed with 503 `MODEL_CALLS_PAUSED`; manual UI edits remain fully functional.
3. **Cancel Specific Job or Run**:
   - `await cancelWorkItem(pool, 'run', runId, 'operator-username', 'Run stuck in loop')`
   - `await cancelWorkItem(pool, 'job', jobId, 'operator-username', 'Source unreadable')`
   - Cancels the item and preserves conservative budget accounting (`unknown_outcome_retained`) without falsely refunding in-flight costs.
4. **Toggle Source Capabilities**:
   - `await setSourceCapabilityEnabled(pool, { capability: 'youtube', enabled: false, actorId: 'operator-username', reason: 'Quota limit reached' })`
   - Options: `'pdf' | 'web' | 'youtube' | 'github'`.
5. **Suspend Public Release**:
   - `await setPublicReleaseSuspended(pool, { suspended: true, actorId: 'operator-username', reason: 'Content review ongoing' })`

### Runbook C: Retention Lifecycle & Safe Cleanup
All cleanup operations are performed via `src/server/domain/cohort-builder/retention-cleanup.ts`.

1. **Default Mode (Inspect / Dry Run)**:
   - Always run sweeps in inspect mode first:
     ```ts
     const report = await runRetentionSweep(pool, policy, { dryRun: true });
     ```
   - Reports candidate counts for expired transcripts, replay events, draft artifacts, orphans, and tombstones without modifying any records.
2. **Live Cleanup Execution**:
   - Requires explicit `dryRun: false` and `ALLOW_PRODUCTION_CLEANUP !== '0'`:
     ```ts
     const report = await runRetentionSweep(pool, policy, { dryRun: false, batchLimit: 100 });
     ```
   - Sweeps proceed in 5 audited phases with bounded batch limits (default 100):
     - Phase 1: Replay events older than `replayDays` (7d).
     - Phase 2: Draft artifacts older than `draftArtifactDays` (30d), skipping any artifact with an active read lease (`readLeaseUntil > now()`) or permanent pin (`pinnedPermanently = true`).
     - Phase 3: Unreferenced orphan artifacts older than `orphanArtifactDays` (1d).
     - Phase 4: Purge eligible tombstoned workspaces and their unpinned artifacts.
     - Phase 5: Transcripts older than `transcriptDays` (90d). Transcripts strictly outlive replay events.
3. **Permanent Release Pins**:
   - Released cohorts permanently pin their artifacts in `cohort_text_artifact_protection` (`pinnedPermanently = true`).
   - Pinned artifacts are never deleted by draft cleanup or workspace tombstoning, guaranteeing uninterrupted learner delivery.

### Runbook D: Disaster Recovery & Restore Drill
In the event of database failure or corrupted state:
1. **Export Workspace**:
   - `const bundle = await exportWorkspaceData(sqlAdapter, { workspaceId, ownerId });`
   - Generates a self-contained JSON backup with SHA-256 checksums, transcript, events, artifacts, and jobs.
2. **Validate Backup Bundle**:
   - `validateBackupBundle(bundle);`
   - Verifies SHA-256 hash match, byte counts, and artifact reference completeness. Fails closed on tampering or corruption.
3. **Restore into Fresh Instance**:
   - `await restoreWorkspaceFromBundle(newSql, bundle, { recoverInFlightJobs: true, demoteCorruptedRelease: true });`
   - Restores workspace record, requests, events, messages, and artifacts.
   - Recovers in-flight jobs (`running` → `queued`) so replacement workers can resume processing.
   - If release artifacts are corrupted or incomplete, demotes the cohort to draft (`processing.error = 'CORRUPTED_RESTORE_DEMOTED'`), preventing broken content from becoming public.

### Runbook E: Safe Rollback / Disable Runbook
If an operational incident occurs post-rollout:
1. **Set Environment Variable**:
   ```bash
   INTERACTION_COHORT_V2_ENABLED=0
   ```
2. **Reload HTTP Service**:
   - New cohort creators visiting `/` or `/quest/start` see an honest notice: *"New builder intake is unavailable. Existing workspaces remain accessible."*
   - Compatible drafts (prompts without attached sources) are offered an explicit link to `/quest/new?handoff=1`.
   - Incompatible drafts (with pasted source text) display the retained text and honestly suppress the legacy link.
3. **Zero Data Loss Guarantee**:
   - All existing workspaces in `interaction_workspaces` remain **100% accessible, readable, and resumable** at `/quest/build/[workspaceId]`.
   - All released learner deliveries (`/play?cohort=...` and `/cohort/.../overview`) remain active.
   - **ZERO TABLES DROPPED; ZERO USER RECORDS DELETED**.

---

## 8. Incident Response & Alerting Matrix

| Alert / Symptom | Severity | Probable Cause | Action Runbook |
|---|---|---|---|
| `No active worker heartbeats` | High | Worker process crashed or supervisor stopped | Check worker logs; restart worker via supervisor (`npm run interaction:worker`). |
| `Oldest queued job > 60s` | Medium | Backlog saturation or workers under-provisioned | Inspect queue depth via diagnostics; check provider rate limits; spawn additional worker replica. |
| `HTTP 503 WORKER_UNAVAILABLE` | High | Queue saturated (>50 jobs) while workers absent | Verify worker process is running and heartbeating. System is failing closed to protect browser threads. |
| `HTTP 429 CONCURRENT_RUNS_EXCEEDED` | Low | User attempting concurrent assistant runs across workspaces | Expected enforcement. Client will retry with backoff. |
| `HTTP 429 BUDGET_EXHAUSTED` | Medium | User exceeded daily/monthly model token allowance | User must wait for budget window reset or request quota increase. |
| `HTTP 409 STALE_WORKSPACE` | Low | Multiple tabs edited workspace or revision advanced post-approval | Normal CAS protection. Client presents diff and user reapplies deliberately. |
| `Artifact hash mismatch` | High | Storage corruption or partial write | Check private artifact store; re-extract source or restore from backup bundle. |

---

## 9. Pre-Flight Operator Checklist

Before enabling Profile 2 in a shared or staging environment, verify:
- [ ] Database backup completed before running SQL migrations.
- [ ] Migrations 1 through 5 executed in strict sequential order with `-v ON_ERROR_STOP=1`:
  - `psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f packages/interaction-builder/migrations/001_interaction_schema.sql`
  - `psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f prisma/interaction-s3-storage.sql`
  - `psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f prisma/interaction-s4b-sources.sql`
  - `psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f prisma/interaction-s5-effects.sql`
  - `psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f prisma/interaction-s6-operations.sql`
- [ ] `npm run interaction:acceptance` returns exit code 0 (all 11 operational lifecycle phases passed).
- [ ] `npm run interaction:gate` returns exit code 0 (all 10 production criteria passed).
- [ ] `npm run interaction:readiness` returns exit code 0 with `initial_rollout` profile.
- [ ] `INTERACTION_TEXT_DRIVER=durable` is set on both HTTP app and background worker.
- [ ] `INTERACTION_YOUTUBE_ENABLED=0` and `INTERACTION_GITHUB_ENABLED=0` confirmed.
- [ ] Background interaction worker supervisor (`npm run interaction:worker`) started with matching binary version.
- [ ] Operator verified rollback plan (`INTERACTION_COHORT_V2_ENABLED=0`).
