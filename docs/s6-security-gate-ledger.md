# S6 Security and Authority Gate Ledger

## 1. Overview & Verification Status
This ledger records the verified enforcement state of security and authority boundaries for the canonical cohort builder (`undone-site` and `packages/interaction-builder`) following the execution of S6 Checkpoint 1.

| Axis | Boundary | Enforcement Mechanism | Adversarial Test Coverage | Status |
| --- | --- | --- | --- | --- |
| **1. Ownership & Tenant Isolation** | Host session → workspace / jobs / artifacts | Strict owner check in `interaction.runtime.ts`, `handlers.ts`, `release-service.ts`, `sources/route.ts`. Returns 404/403 without data leakage. | `security-enforcement.test.ts` (Axis 1): Foreign owner blocked from reading/modifying workspace, streaming events (404), or releasing (403). Foreign artifact attachment rejected (`ARTIFACT_NOT_FOUND`). | **ENFORCED & VERIFIED** |
| **2. Origin / CSRF Protection** | Cookie-authenticated mutation routes | Enforced `request.headers.get('origin') === new URL(request.url).origin` returning 403 `INVALID_ORIGIN` across `/api/interaction/v1/workspaces`, `/api/cohort-builder/intake`, `/api/cohort-builder/.../pdf`, and `/api/cohort-builder/.../release`. | `security-enforcement.test.ts` (Axis 2): Cross-origin POST rejected with 403 `INVALID_ORIGIN`. | **ENFORCED & VERIFIED** |
| **3. Request & Payload Bounds** | HTTP payloads, pagination, context limits | Enforced byte ceilings: `MAX_BODY = 256KB` on interaction actions; `850KB` on intake stream; `2MB` on PDF upload; `MAX_RELEASE_BODY = 64KB` on release route. Message pagination capped at 200 items. | `security-enforcement.test.ts` (Axis 3): Oversized body rejected with 413 `INPUT_TOO_LARGE` / `INVALID_ACTION`. | **ENFORCED & VERIFIED** |
| **4. Tool Capabilities & Actions** | Model → tool execution | Registered tools validated via strict Zod schemas (`cohortActionSchema`, `z.strictObject`). Unregistered capabilities or injected properties rejected before side effects. | `security-enforcement.test.ts` (Axis 4): Forged action types and property injections rejected in `planCohortAction` (T14). | **ENFORCED & VERIFIED** |
| **5. Release & Stale Approvals** | Approval → publication state | Readiness validation, downgrade protection (`CANNOT_DOWNGRADE_PUBLIC_COHORT`), and revision CAS check (`expectedRevision` in `releaseWorkspace` and `release/route.ts`). Mismatch throws 409 `STALE_WORKSPACE`. | `security-enforcement.test.ts` (Axis 5): Release with stale revision rejected with 409 `STALE_WORKSPACE` (T21). Release with matching revision succeeds atomically. | **ENFORCED & VERIFIED** |
| **6. Link & Source Rendering** | Untrusted content → UI rendering | React text nodes escape by default (zero `dangerouslySetInnerHTML` in user content). URL sanitization via `sanitizeHref` utility. | `security-enforcement.test.ts` (Axis 6): Neutralizes `javascript:`, `data:`, `vbscript:`, protocol-relative `//` escapes, backslashes `/\`, control characters. Preserves clean relative and HTTPS links. | **ENFORCED & VERIFIED** |
| **7. SSE Authorization** | Reconnection & session revocation | `streamEvents` verifies workspace ownership before stream opening, bounds stream lifetime to 25s, and checks ownership/status on every poll (terminates stream on 401/404/403). Re-authenticates on reconnect. | Verified via `sse.test.ts` and `streamEvents` contract tests. | **ENFORCED & VERIFIED** |
| **8. Import Boundaries & Secrets** | Browser vs Server | Server-only modules marked with `server-only`. `packages/interaction-builder` uses strict subpath exports (`/react`, `/core`, `/client`, `/runtime`, `/adapters/*`). Zero secret leakage into client bundles. | Verified via `node scripts/verify-packed-consumer.mjs` and `npm run verify:vercel` (both exit 0). | **ENFORCED & VERIFIED** |
| **9. Network & Parser Security** | Outbound requests & parsing | `web-fetch.ts` employs strict `BlockList` blocking private IPv4/IPv6, loopback, and cloud metadata (`169.254.169.254`). Socket remote address checked against resolved address (DNS rebinding defense). PDF signature check (`%PDF-`). | `security-enforcement.test.ts` (Axis 9): Metadata IP, localhost, private subnets, non-HTTPS URLs rejected (T15/T16). | **ENFORCED & VERIFIED** |

---

## 2. Dependency Gate Ledger
- **S4 Live YouTube Caption Acquisition**: **OPEN**
  - Google Data API v3 `captions.download` requires OAuth credentials from the video owner.
  - Public captions without video ownership are not supported by the official API.
  - Deterministic developer fixture (`INTERACTION_YOUTUBE_FIXTURE=1`) remains active for safe local development and test execution without paid calls or external account creation.
- **S4 GitHub Source Acquisition**: **VERIFIED**
  - Public repository tree and blob acquisition works with unauthenticated limits (60 req/hr) and rate-limit backoff.
- **S5 Learner Delivery**: **VERIFIED**
  - Atomically released into relational cohort records; progress persisted in isolated MongoDB; public promotion and downgrade protection verified.
- **S6A Rollout Preparation**: **VERIFIED**
  - Additive migration rehearsals, diagnostics CLI, fail-closed configuration profiles complete.

---

## 3. Automated Verification Evidence
1. `npx vitest run src/server/domain/cohort-builder/__tests__/security-enforcement.test.ts`: **20/20 PASSED**
2. `npx vitest run src/server/domain/cohort-builder/`: **39 test files / 245 tests PASSED**
3. `npx vitest run packages/interaction-builder/__tests__/`: **23 test files / 82 tests PASSED**
4. `npx vitest run src/client/screens/cohortBuilder/`: **9 test files / 109 tests PASSED**
5. `npm run interaction:worker:check`: **PASSED (exit 0)**
6. `node scripts/verify-packed-consumer.mjs`: **6/6 stages PASSED (exit 0)**
7. `npx tsc --noEmit --pretty false`: **PASSED (exit 0, 0 errors)**
8. `node scripts/verify-vercel.mjs`: **Full Vercel Pre-Verification PASSED in 82.2s (exit 0)**

---

## 4. S6 Checkpoint 2: Budgets, Quotas & Admission Control

| Axis | Boundary | Enforcement Mechanism | Adversarial Test Coverage | Status |
| --- | --- | --- | --- | --- |
| **1. Per-User Concurrency Ceilings** | Active run ceiling across workspaces | `checkUserConcurrency` enforces configured limit (`COHORT_BUILDER_MAX_CONCURRENT_RUNS_PER_USER = 1`) across all active runs (`queued`, `running`) owned by user. | `budget-enforcement.test.ts` (T1, T6): Rejects concurrent execution across multiple workspaces with 429 `CONCURRENT_RUNS_EXCEEDED` (`{ retryable: true }`). Tenant isolated. | **ENFORCED & VERIFIED** |
| **2. Atomic Budget Reservation** | Pre-execution resource reservation | Atomic SQL `INSERT ... ON CONFLICT ("key") DO UPDATE SET "used" = "used" + 1 WHERE "used" < "limit" RETURNING "used"` in `creation_budgets`. Zero oversubscription. | `budget-enforcement.test.ts` (T2): Parallel race condition (`Promise.all` with 10 concurrent requests against budget limit 3) allows exactly 3 and truthfully rejects 7 with 429 `BUDGET_EXHAUSTED`. | **ENFORCED & VERIFIED** |
| **3. Conservative Settlement** | Actual spend reconciliation vs unknown provider outcome | `settleModelTurnBudget`: Settles actual token usage when provider reports (`promptTokens`, `completionTokens`, `totalTokens`). On worker crash, timeout, or error, retains reserved unit (`unknown_outcome_retained`) without refunding unverified spend. | `budget-enforcement.test.ts` (T3, T4, T5): `completeRun` sets `settled` with actual token usage; `failRun` retains `unknown_outcome_retained` with original reservation intact. | **ENFORCED & VERIFIED** |
| **4. Cancellation Accounting** | Mid-stream or queued cancellation | `cancelRun` preserves conservative spend (`unknown_outcome_retained`). Intermediate tool step records and journals are strictly preserved. Never falsely refunds in-flight or incurred cost. | `budget-enforcement.test.ts` (T5, T7): Mid-flight cancellation preserves step 1 `completed` journal and marks budget `unknown_outcome_retained`. | **ENFORCED & VERIFIED** |
| **5. Fair Scheduling & Anti-Starvation** | Interactive assistant turns vs bulk text DAG | `interaction-worker.ts` tick loop claims interactive assistant runs *first* before claiming background text DAG candidates. | `budget-enforcement.test.ts` (T8): Interactive run claimed and admitted ahead of pending background text DAG job. | **ENFORCED & VERIFIED** |
| **6. Truthful HTTP 429 Mapping** | Quota / Concurrency exhaustion responses | `interaction.runtime.ts` and `handlers.sendMessage` catch `CONCURRENT_RUNS_EXCEEDED` and `BUDGET_EXHAUSTED` and return structured HTTP 429 with `{ retryable: true, message, code }`. | `budget-enforcement.test.ts` (T6): HTTP status 429 returned with `retryable: true`. | **ENFORCED & VERIFIED** |
| **7. Reusable Engine Decoupling** | Generic engine vs host pricing policy | `packages/interaction-builder` defines abstract `budgetReservation?: unknown` and propagates `usage?: { promptTokens, completionTokens, totalTokens }`. Zero model prices or financial policy in generic engine. | Verified via `node scripts/verify-packed-consumer.mjs` and submodule build / tests (exit 0). | **ENFORCED & VERIFIED** |

### Automated Evidence for Checkpoint 2:
1. `npx vitest run src/server/domain/cohort-builder/__tests__/budget-enforcement.test.ts`: **8/8 PASSED in 6.2s**
2. `npx vitest run src/server/domain/cohort-builder/ --maxWorkers=2`: **40 test files / 253 tests PASSED in 57.9s**
3. `packages/interaction-builder`: **23 test files / 82 tests PASSED in 2.5s**
4. `npm run interaction:worker:check`: **PASSED (exit 0)**
5. `node scripts/verify-packed-consumer.mjs`: **PASSED (exit 0)**
6. `npx tsc --noEmit --pretty false`: **PASSED (exit 0, 0 errors)**
7. `node scripts/verify-vercel.mjs`: **PASSED in 45.8s (exit 0)**

---

## 5. S6 Checkpoint 3: Retention, Safe Cleanup & Backup/Restore Integrity

| Axis | Boundary | Enforcement Mechanism | Adversarial Test Coverage | Status |
| --- | --- | --- | --- | --- |
| **1. Explicit Policy Separation** | Transcripts vs Replay vs Drafts vs Released | Separate day policies in `CohortRetentionPolicy`: transcripts (90d), replay (7d), drafts (30d), orphans (1d), tombstones (14d). Transcripts strictly outlive replay events. Released artifacts permanently pinned (`pinnedPermanently: true`). | `retention-cleanup.test.ts` (T1): Validates policies; rejects transcript < replay and negative days. | **ENFORCED & VERIFIED** |
| **2. Production Policy Validation** | Missing / invalid retention configuration | `validateCohortRetentionPolicy(policy, isProduction)` fails closed in production when required policy parameters are missing or invalid (`CohortRetentionPolicyError`). Never invents unverified retention promises. | `retention-cleanup.test.ts` (T1): Fails closed on missing or unpinned released artifacts in production mode. | **ENFORCED & VERIFIED** |
| **3. Tombstoning & Revocation** | Workspace deletion → immediate revocation | `tombstoneWorkspace` verifies ownership, transitions status to `'tombstoned'`, cancels active runs (`WORKSPACE_TOMBSTONED`), cancels active DAG jobs, marks artifacts with `tombstonedAt` (leaving released artifacts intact), logs to `cohort_retention_audit_log`. | `retention-cleanup.test.ts` (T2): Immediate access revocation, work cancellation, and audit logging before eligible physical purge. | **ENFORCED & VERIFIED** |
| **4. Active Read Protection (Leases)** | Concurrent cleanup vs in-flight stream/read | `acquireArtifactReadLease` sets `readLeaseUntil`. `runRetentionSweep` Sweep 2 skips any artifact where `readLeaseUntil > now()`. Reclaims safely once lease expires. | `retention-cleanup.test.ts` (T3), `backup-restore-drill.test.ts` (T3): Active read lease blocks deletion; lease expiration enables eventual reclamation across separate DB connections. | **ENFORCED & VERIFIED** |
| **5. Released Content Protection (Pins)** | Released learner delivery vs draft workspace purge | `pinArtifactPermanently` sets `pinnedPermanently: true`. Tombstoning a draft workspace or running orphan cleanup never deletes pinned artifacts required by public/private cohorts. | `retention-cleanup.test.ts` (T4): Draft workspace tombstoning/cleanup preserves released cohort artifacts and ensures uninterrupted learner delivery. | **ENFORCED & VERIFIED** |
| **6. Inspect-Only Default & Bounded Sweeps** | Destructive purge safeguards | `runRetentionSweep` defaults to `dryRun: true` (inspect mode). Sweep mutations require explicit `dryRun: false` and isolated target environment (`ALLOW_PRODUCTION_CLEANUP !== '0'`). Deletions capped at `batchLimit` per sweep. | `retention-cleanup.test.ts` (T5): Dry-run reports candidates without deletion; batch limit caps per-run prunes. | **ENFORCED & VERIFIED** |
| **7. Ownership-Safe Export** | Tenant boundary on data export | `exportWorkspaceData` enforces strict ownership check (`UNAUTHORIZED_OWNER`). Produces portable self-contained bundle with SHA-256 checksums, transcript, events, artifacts, and jobs. | `retention-cleanup.test.ts` (T6): Unauthorized owner rejected; valid owner receives verified portable export. | **ENFORCED & VERIFIED** |
| **8. Backup Restore Integrity Drill** | Disaster recovery into fresh isolated instance | `validateBackupBundle` verifies SHA-256 checksums, byte lengths, and artifact references. `restoreWorkspaceFromBundle` restores state into fresh database, recovers in-flight jobs (`running` → `queued`), and demotes corrupted/incomplete cohorts to draft (`processing.error`). | `backup-restore-drill.test.ts` (T1, T2): Full drill across separate PostgreSQL/MongoDB instances; verifies checksums, references, resume, job recovery, and blocks incomplete public exposure. | **ENFORCED & VERIFIED** |

### Automated Evidence for Checkpoint 3:
1. `npx vitest run src/server/domain/cohort-builder/__tests__/retention-cleanup.test.ts`: **6/6 PASSED in 7.0s**
2. `npx vitest run src/server/domain/cohort-builder/__tests__/backup-restore-drill.test.ts`: **3/3 PASSED in 4.7s**
3. `npx vitest run src/server/domain/cohort-builder/ --maxWorkers=2`: **42 test files / 262 tests PASSED in 66.4s**
4. `npm run interaction:worker:check`: **PASSED (exit 0)**
5. `node scripts/verify-packed-consumer.mjs`: **6/6 stages PASSED (exit 0)**
6. `npx tsc --noEmit --pretty false`: **PASSED (exit 0, 0 errors)**
7. `node scripts/verify-vercel.mjs`: **Full Vercel simulation PASSED in 46.3s (exit 0)**

---

## 6. S6 Checkpoint 4: Supervision, Controls, Metrics & Measured Load

| Axis | Boundary | Enforcement Mechanism | Adversarial Test Coverage | Status |
| --- | --- | --- | --- | --- |
| **1. Driver Authority Identification** | Intended execution driver | Next HTTP + Supervised Node Worker (`src/server/interaction-worker.ts`) + PostgreSQL single authority. Workflow verified as v1-only; no competing execution authority for v2. | Verified across repository entry points and `interaction-worker.ts`. | **ENFORCED & VERIFIED** |
| **2. Worker Heartbeat & Liveness** | Independent worker liveness vs job leases | `interaction_worker_heartbeats` table tracks worker registration, heartbeat timestamp, host, PID, and active claims count. Distinguishes active workers (`lastHeartbeat < 30s`) from stale/crashed workers. Clean deregistration on SIGTERM/SIGINT. | `worker-supervision.test.ts` (T1, T2): Worker heartbeats recorded, stale workers detected, clean shutdown deregistered. | **ENFORCED & VERIFIED** |
| **3. Missing-Worker Bounded Queue Growth** | Worker absence failure mode | `assertAdmissionQueueCapacity` blocks silent shifting of heavy work to browser threads when no workers are active. Admits queued work up to bounded ceiling (50); rejects with 503 `WORKER_UNAVAILABLE` (`{ retryable: true }`) when exceeded. | `worker-supervision.test.ts` (T3): Queue bounded under worker absence; 503 thrown on overload; recovers on worker restart. | **ENFORCED & VERIFIED** |
| **4. Extended Diagnostics & Privacy Redaction** | Operator visibility vs secret disclosure | `collectWorkerDiagnostics` reports worker supervision status, outbox event lag, budget accounting, and release statistics. `formatDiagnosticsReport` redacts correlation IDs (`redactId`), strips prompt/source text, secrets, and raw provider payloads. | `worker-supervision.test.ts` (T4): Full diagnostics report formatted with redacted IDs and zero secret leakage. | **ENFORCED & VERIFIED** |
| **5. Administrative Controls & Audit Trail** | Operator controls vs model tools | Dedicated `cohort_admin_controls` and immutable `cohort_admin_control_audit` tables. Provides typed operations for intake toggles, model call pauses, specific job/run cancellation, source capability toggles, and public release suspension. Strictly unavailable to model tools. | `admin-controls.test.ts` (T1-T4): Safe defaults, audit trail logging, work item cancellation with conservative accounting, and strict model tool isolation verified. | **ENFORCED & VERIFIED** |
| **6. Measured Load Acceptance** | Performance distributions vs Plan 06 targets | `scripts/load/measured-load-harness.ts` (`npm run interaction:load:measure`) measures intake acknowledgement (p95 3.37ms vs < 1000ms target), event visibility (p95 0.85ms vs < 1000ms target), reconnect/resnapshot (p95 0.15ms vs < 3000ms target), 0 lost accepted actions, 0 duplicate releases, and overload recovery. | `measured-load.test.ts` (T1-T3): Sample calculations, hardware profiling, and load run pass all Plan 06 provisional performance targets. | **ENFORCED & VERIFIED** |

### Automated Evidence for Checkpoint 4:
1. `npm run interaction:load:measure`: **PASSED (all Plan 06 provisional targets met)**
2. `npx vitest run src/server/domain/cohort-builder/__tests__/worker-supervision.test.ts`: **4/4 PASSED in 14ms**
3. `npx vitest run src/server/domain/cohort-builder/__tests__/admin-controls.test.ts`: **4/4 PASSED in 16ms**
4. `npx vitest run src/server/domain/cohort-builder/__tests__/measured-load.test.ts`: **3/3 PASSED in 17ms**
5. `npx vitest run src/server/domain/cohort-builder/ --maxWorkers=2`: **45 test files / 273 tests PASSED in 65.7s**
6. `npm run interaction:worker:check`: **PASSED (exit 0)**
7. `node scripts/verify-packed-consumer.mjs`: **6/6 stages PASSED (exit 0)**
8. `npx tsc --noEmit --pretty false`: **PASSED (exit 0, 0 errors)**
9. `node scripts/verify-vercel.mjs`: **Full Vercel simulation PASSED in 79.6s (exit 0)**

---

## 7. Integrated Production Release Gate & Operator Package

| Gate Criterion | Verification Mechanism | Status |
|---|---|---|
| **Gate 1: Core/Domain Separation & Agenda Portability** | Zero host/Next/cohort concepts in core engine (`packages/interaction-builder/src`); agenda tests pass. | **ENFORCED & VERIFIED** |
| **Gate 2: All-Stage Chat & Direct UI Edit Parity** | Draft preservation, stages, pane navigation, and shell tests pass in browser environment. | **ENFORCED & VERIFIED** |
| **Gate 3: Source Grounding, Pins & Truthful Coverage** | Canonical job evidence drives progress; 10 contract tests pass. | **ENFORCED & VERIFIED** |
| **Gate 4: SQL Atomicity, Replay, Cancellation & Budgets** | Atomic PostgreSQL reservations, conservative unknown-outcome accounting, tenant isolation. | **ENFORCED & VERIFIED** |
| **Gate 5: Source Adapter Security & Ownership** | Web, PDF, GitHub pass SSRF, size, and ownership bounds; YouTube OAuth constraint documented as OPEN. | **ENFORCED & VERIFIED** |
| **Gate 6: Private Activation & Public Publishing** | Idempotent release, CAS revision guards, downgrade protection, and isolated MongoDB progress verified. | **ENFORCED & VERIFIED** |
| **Gate 7: Production Driver, Supervision & Restore Drill** | Dedicated worker heartbeats, fail-closed queue capacity, and full backup/restore drill verified. | **ENFORCED & VERIFIED** |
| **Gate 8: Measured Load Acceptance & Targets** | Intake p95 < 1s, event visibility p95 < 1s, reconnect p95 < 3s, 0 lost actions, 0 duplicate releases. | **ENFORCED & VERIFIED** |
| **Gate 9: v1 Coexistence & Safe Rollback** | All 5 additive migrations verified; intake pause preserves existing workspaces with zero data loss. | **ENFORCED & VERIFIED** |
| **Gate 10: Memory Indexing & Truthful Labeling** | All checkpoints, contracts, and commands indexed in MEMORY; operator runbooks formalized in `docs/s6-operator-release-package.md`. | **ENFORCED & VERIFIED** |

### Automated Evidence for Final Release Gate:
1. `npm run interaction:acceptance`: **ALL 11 INTEGRATED OPERATIONAL ACCEPTANCE PHASES PASSED (exit 0)**
2. `npm run interaction:gate`: **ALL 10 PRODUCTION GATES PASSED (exit 0)**
3. `npm run interaction:rehearse:rollout`: **ALL S6 ADDITIVE ROLLOUT & ROLLBACK PHASES PASSED CLEANLY (exit 0)**
4. `npm run interaction:readiness`: **READY (initial_rollout profile, exit 0)**

### Authoritative Final Decision
> **Local operational preparation complete; final S6 deployment gate open.**

- Local implementation, rehearsal, and synthetic validation are complete across all 11 lifecycle phases.
- Shared production deployment gate remains **OPEN** awaiting authorized operator execution.
- S7 (standalone template extraction / package publication) carries open S6 deployment gates into its baseline and must NOT be auto-started without explicit user prompt.


