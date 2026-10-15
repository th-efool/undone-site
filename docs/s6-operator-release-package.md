# S6 Operator Release Package & Production Handoff

## 1. Executive Summary & Authoritative Release Decision

This document is the authoritative **Operator Release Package & Production Handoff** for the canonical cohort builder (`undone-site` and `packages/interaction-builder`).

### Release Decision
- **S6 Production Gate Status**: **READY FOR OPERATOR HANDOFF**. All 10 production criteria specified in `plans/interaction-builder/06-production-and-verification.md` Section 10 are implemented, tested, and verified via `npm run interaction:gate`.
- **Pre-Rollout Constraint Status**:
  - S4 live YouTube caption acquisition remains explicitly recorded as **OPEN** due to Google Data API v3 OAuth requirements (video owner credentials required). It remains strictly disabled in initial rollout (`INTERACTION_YOUTUBE_ENABLED=0`). Local development and tests continue safely via `INTERACTION_YOUTUBE_FIXTURE=1`.
  - S4 GitHub acquisition works with public unauthenticated API limits (60 req/hr) and must remain disabled in initial rollout (`INTERACTION_GITHUB_ENABLED=0`) until a dedicated monitored personal access token is configured.
  - S5 relational release and learner progress persistence into MongoDB are fully verified.
  - S6 operational supervision, administrative controls, retention lifecycles, and measured load gates are fully verified.
- **Authorization Boundary**: Local implementation, rehearsal, and synthetic validation are complete. Shared production database migration execution, shared environment variable activation, and production service deployment require human operator authorization following this handoff.

---

## 2. Repository & Submodule Baseline

| Component | Pinned Version / Commit | Notes |
|---|---|---|
| **Host Application (`undone-site`)** | `08b0a01` (plus S6 handoff commits) | Branch `master` synchronized with `origin/master` and `origin/planning` |
| **Engine Submodule (`packages/interaction-builder`)** | `4f92118` | Authority for reusable engine; consumed via public exports; clean working tree |
| **End-to-End Acceptance Artifacts** | `s4-enabled-completed.png`, `s5-completed.png` | Located in `.tmp/s4-postgres-runtime/` and `.tmp/s5-postgres-runtime/` |
| **Measured Load Baseline** | `npm run interaction:load:measure` | Intake ack p95 < 3.4ms; event visibility p95 < 0.9ms; reconnect p95 < 0.2ms |

---

## 3. Capability Inventory & Production Readiness Matrix

All 10 canonical cohort builder capabilities are classified across 5 explicit readiness levels:
- **Level A**: Code implemented
- **Level B**: Isolated deterministic tests passed
- **Level C**: Live provider tested & verified
- **Level D**: Shared environment configured
- **Level E**: Shared feature activated

| Capability | Readiness Level | Rollout Status | Prerequisites / Blockers |
|---|---|---|---|
| **1. New V2 Landing Intake** | Level B (Local Verified) | Ready for Profile 2 | Requires `INTERACTION_COHORT_V2_ENABLED=1` and `INTERACTION_TEXT_DRIVER=durable`. |
| **2. Existing V2 Workspace Resume** | Level B (Local Verified) | Always Active | Works regardless of `INTERACTION_COHORT_V2_ENABLED`; zero lock-out risk. |
| **3. Pasted Text Processing** | Level B (Local Verified) | Ready for Profile 2 | Core durable pipeline; 5-stage DAG execution verified. |
| **4. PDF Upload & Extraction** | Level B (Local Verified) | Ready for Profile 2 | S4B schema constraints; 2MB upload ceiling; isolated server-side parsing. |
| **5. Web Extraction** | Level B (Local Verified) | Ready for Profile 2 | S4B schema constraints; SSRF `BlockList` protections active; 200KB bound. |
| **6. YouTube Transcripts** | Level B (Fixture Only) | **DISABLED (`'0'`)** | **Hard Blocker**: Google Data API v3 `captions.download` requires video owner OAuth credentials. Public transcripts cannot be acquired without owner auth. Must remain `'0'`. |
| **7. GitHub Source Acquisition** | Level C (Live Verified) | **DISABLED (`'0'`)** | **Hard Blocker**: Unauthenticated GitHub REST API limited to 60 req/hr. Must remain `'0'` until dedicated monitored token configured. |
| **8. Supervised Runner Execution** | Level B (Local Verified) | Ready for Profile 2 | Supervised Node worker (`interaction-worker.ts`); heartbeats; fail-closed queue capacity (limit: 50). |
| **9. Private Learner Activation** | Level B (Local Verified) | Ready for Profile 2 | Relational cohort/lesson projection; `/play?cohort=...` delivery; MongoDB progress tracking. |
| **10. Public Cohort Release** | Level B (Local Verified) | Ready for Profile 2 | Public publishing; `/cohort/.../overview` discovery; unpublish and downgrade protection. |

---

## 4. Minimal Configuration Profiles

Three configuration profiles are formalized in `docs/s6a-configuration-profiles.md`:

### Profile 1: Isolated Local Verification (`isolated_local`)
- For local unit tests, CI test runs, and isolated rehearsal scripts.
- Uses embedded PostgreSQL (`s3test` loopback on port `15433`).
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

All 5 migrations are additive, non-destructive, and idempotent. Apply them in this exact order:

```bash
# 1. Core interaction engine tables (8 tables + active unique index)
psql "$DATABASE_URL" -f packages/interaction-builder/migrations/001_interaction_schema.sql

# 2. Durable text pipeline (cohort_text_artifacts, cohort_text_jobs, cohort_text_job_edges)
psql "$DATABASE_URL" -f prisma/interaction-s3-storage.sql

# 3. Source constraints expansion (supports source_input, source_raw, acquisition, extraction)
psql "$DATABASE_URL" -f prisma/interaction-s4b-sources.sql

# 4. Release effect journaling (interaction_effects)
psql "$DATABASE_URL" -f prisma/interaction-s5-effects.sql

# 5. S6 Operational supervision, admin controls, artifact protection & retention audit
psql "$DATABASE_URL" -f prisma/interaction-s6-operations.sql
```

---

## 6. Operator Commands & Diagnostics

| Command | Purpose | Expected Output / Result |
|---|---|---|
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
   - Pause: `await setIntakeEnabled(pool, false, 'operator-username', 'Scheduled maintenance')`
   - Resume: `await setIntakeEnabled(pool, true, 'operator-username', 'Maintenance completed')`
   - Behavior when paused: Homepage and `/quest/start` honestly explain intake is unavailable; existing workspaces and learner deliveries remain 100% accessible.
2. **Pause / Resume Model Calls**:
   - Pause: `await setModelCallsPaused(pool, true, 'operator-username', 'Provider outage')`
   - When paused, new model turns fail closed with 503 `MODEL_CALLS_PAUSED`; manual UI edits remain fully functional.
3. **Cancel Specific Job or Run**:
   - `await cancelWorkItem(pool, 'run', runId, 'operator-username', 'Run stuck in loop')`
   - `await cancelWorkItem(pool, 'job', jobId, 'operator-username', 'Source unreadable')`
   - Cancels the item and preserves conservative budget accounting (`unknown_outcome_retained`) without falsely refunding in-flight costs.
4. **Toggle Source Capabilities**:
   - `await setSourceCapabilityEnabled(pool, 'youtube', false, 'operator-username', 'Quota limit reached')`
   - Options: `'pdf' | 'web' | 'youtube' | 'github'`.
5. **Suspend Public Release**:
   - `await setPublicReleaseSuspended(pool, true, 'operator-username', 'Content review ongoing')`

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
   - `const bundle = await exportWorkspaceData(pool, workspaceId, ownerId);`
   - Generates a self-contained JSON backup with SHA-256 checksums, transcript, events, artifacts, and jobs.
2. **Validate Backup Bundle**:
   - `validateBackupBundle(bundle);`
   - Verifies SHA-256 hash match, byte counts, and artifact reference completeness. Fails closed on tampering or corruption.
3. **Restore into Fresh Instance**:
   - `await restoreWorkspaceFromBundle(newPool, bundle, { recoverInFlightJobs: true, demoteCorruptedRelease: true });`
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
- [ ] Migrations 1 through 5 executed in strict sequential order:
  - `packages/interaction-builder/migrations/001_interaction_schema.sql`
  - `prisma/interaction-s3-storage.sql`
  - `prisma/interaction-s4b-sources.sql`
  - `prisma/interaction-s5-effects.sql`
  - `prisma/interaction-s6-operations.sql`
- [ ] `npm run interaction:gate` returns exit code 0 (all 10 production criteria passed).
- [ ] `npm run interaction:readiness` returns exit code 0 with `initial_rollout` profile.
- [ ] `INTERACTION_TEXT_DRIVER=durable` is set on both HTTP app and background worker.
- [ ] `INTERACTION_YOUTUBE_ENABLED=0` and `INTERACTION_GITHUB_ENABLED=0` confirmed.
- [ ] Background interaction worker supervisor (`npm run interaction:worker`) started with matching binary version.
- [ ] Operator verified rollback plan (`INTERACTION_COHORT_V2_ENABLED=0`).
