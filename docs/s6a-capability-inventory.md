# S6A Capability and Operational Readiness Inventory

## Overview
This document is the authoritative capability matrix for the canonical cohort builder (`/quest/build/[workspaceId]` and `packages/interaction-builder`). It reconciles what code is implemented, what tests pass, what live provider checks exist, and what remains blocked or unconfigured.

---

## 1. Readiness Levels Defined

To prevent overstated readiness or accidental activation of unverified features, each capability is assessed across five distinct gates:

- **Level A (Code Implemented)**: Domain contracts, schemas, UI components, and server endpoints exist in the repository.
- **Level B (Isolated Integration Passed)**: Deterministic unit, integration, and simulated tests pass cleanly in local test environments.
- **Level C (Live External Acquisition Passed)**: End-to-end acquisition against real external endpoints or production protocols has been verified without mocks.
- **Level D (Shared Environment Configured)**: Shared deployment infrastructure, database migrations, credentials, and environmental variables are provisioned.
- **Level E (Shared Capability Activated)**: Feature flags or policies are turned on for end users in shared/production environments.

---

## 2. Comprehensive Capability Matrix

| Capability | Level A (Code) | Level B (Isolated Tests) | Level C (Live Provider) | Level D (Shared Config) | Level E (Shared Active) | Status Summary |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **1. New v2 Landing Intake** | ✅ | ✅ | N/A | ❌ | ❌ | **Ready for controlled pilot.** Policy guarded by `INTERACTION_COHORT_V2_ENABLED`. Falls back cleanly to v1 if disabled. |
| **2. Existing v2 Workspace Resume** | ✅ | ✅ | ✅ | ❌ | ❌ | **Ready.** Preserves access to already-created workspaces even if new intake is disabled. |
| **3. Pasted Text Processing** | ✅ | ✅ | ✅ | ❌ | ❌ | **Ready.** Durable jobs (`text-acquire` -> `assemble`) verified with PostgreSQL and browser. |
| **4. PDF Upload & Processing** | ✅ | ✅ | ✅ (Local PDF) | ❌ | ❌ | **Local ready; keep disabled in initial shared rollout** until memory bounds and file size quotas are configured. |
| **5. Public Web Scraping** | ✅ | ✅ | ✅ (Public HTTPS) | ❌ | ❌ | **Local ready; keep disabled in initial shared rollout** until network SSRF egress controls and domain allowlists are finalized. |
| **6. YouTube Transcripts** | ✅ | ✅ (Fixture) | ❌ **BLOCKED** | ❌ | ❌ | **BLOCKED.** Official Google Data API v3 `captions.download` requires video owner OAuth credentials. Third-party scrapers prohibited. Must remain disabled. |
| **7. GitHub Repository Sources** | ✅ | ✅ | ✅ (Public API) | ❌ | ❌ | **Adapter works, but keep disabled.** Public unauthenticated API capped at 60 req/hr. Requires dedicated GitHub token and tree-size constraints before activation. |
| **8. Assistant Runner Execution** | ✅ | ✅ | ✅ (Local/Dev) | ❌ | ❌ | **Ready.** Bounded execution loop with tool dispatch (`commitAction`). Requires model provider credentials and budget caps. |
| **9. Private Learner Activation** | ✅ | ✅ | ✅ | ❌ | ❌ | **Ready.** Transactional Prisma materialization (`Cohort`, `Season`, `Lesson`) and learner delivery via `/play?cohort=<id>`. |
| **10. Public Cohort Release** | ✅ | ✅ | ✅ | ❌ | ❌ | **Ready.** Enforces delivery rights, public promotion, anonymous directory access, and permanent downgrade protection (`CANNOT_DOWNGRADE_PUBLIC_COHORT`). |

---

## 3. Detailed Per-Capability Profiles

### 1. New v2 Landing Intake
- **Implemented Entry Points**: `CentralInterface.tsx` -> `GET /api/cohort-builder/intake` (policy & readiness check) -> `POST /api/cohort-builder/intake` (atomic workspace creation) -> `/quest/start` -> `/quest/build/[workspaceId]`.
- **Server Feature Policy**: `INTERACTION_COHORT_V2_ENABLED === '1'` in `intake-policy.ts` and `src/app/api/cohort-builder/intake/route.ts`.
- **Required Schema/Storage**: PostgreSQL `interaction_workspaces`, `interaction_events`.
- **Required Worker/Driver**: Supervised Node worker (`src/server/interaction-worker.ts`).
- **Provider Prerequisites**: PostgreSQL connection.
- **Evidence**: `intake-screen.test.tsx`, `scripts/s3-browser-verification.mjs`, `scripts/s5-browser-verification.mjs`.
- **Safe Disabled Behavior**: When `INTERACTION_COHORT_V2_ENABLED !== '1'`, `CentralInterface` routes to `/quest/start`. `CohortIntakeScreen` displays clear notice: *"New builder intake is unavailable. Existing workspaces remain accessible."* Preserves prompt in sessionStorage and offers explicit link to `/quest/new?handoff=1` if no unsupported attachments are present.

### 2. Existing v2 Workspace Resume
- **Implemented Entry Points**: `/quest/build/[workspaceId]` via `InteractionProvider`.
- **Server Feature Policy**: Authorizes user via session. Does **not** require `INTERACTION_COHORT_V2_ENABLED` to be on; existing workspaces remain readable and resumable forever.
- **Required Schema/Storage**: `interaction_workspaces`, `interaction_events`, `interaction_outbox`.
- **Evidence**: `shell.test.tsx`, `scripts/s5-browser-verification.mjs`.
- **Safe Disabled Behavior**: If worker is offline, workspace opens in read-only inspection mode; mutations queue without data corruption.

### 3. Pasted Text Processing
- **Implemented Entry Points**: Source form in `IntakeStageView.tsx` / `CurriculumStageView.tsx` -> `add_source` domain action (`input.kind === 'text'`).
- **Server Feature Policy**: `INTERACTION_TEXT_PIPELINE_ENABLED !== '0'`.
- **Required Schema/Storage**: `interaction_workspaces`, `interaction_artifacts`, `interaction_jobs`.
- **Required Worker/Driver**: `interaction-worker.ts` with durable text job handlers.
- **Evidence**: `durable-text-worker.test.ts`, `text-job-plan.test.ts`, `s5-browser-verification.mjs`.
- **Safe Disabled Behavior**: If disabled, source remains in pending state with explicit status badge explaining text processing is paused.

### 4. PDF Upload & Processing
- **Implemented Entry Points**: `POST /api/cohort-builder/workspaces/[workspaceId]/pdf` -> `ExternalSources.tsx`.
- **Server Feature Policy**: `INTERACTION_PDF_SOURCE_ENABLED === '1'`. Defaults to `'0'`.
- **Required Schema/Storage**: `interaction_artifacts` (stores PDF binary and extracted text), `interaction_jobs`.
- **Required Worker/Driver**: `interaction-worker.ts` with `pdf-extract` handler using `pdfjs-dist`.
- **Evidence**: `pdf-source.test.ts`, `docs/s4b-verification.md`.
- **Known Blockers**: Must enforce max file size (default 15MB) and page count limits (default 100 pages) before public exposure.
- **Safe Disabled Behavior**: API rejects upload with HTTP 403 `CAPABILITY_DISABLED`; UI hides/disables PDF upload tab.

### 5. Public Web Scraping
- **Implemented Entry Points**: `POST /api/cohort-builder/workspaces/[workspaceId]/sources` with `kind: 'web'`.
- **Server Feature Policy**: `INTERACTION_WEB_SOURCE_ENABLED === '1'`. Defaults to `'0'`.
- **Required Schema/Storage**: `interaction_artifacts`, `interaction_jobs`.
- **Required Worker/Driver**: `interaction-worker.ts` with web scrape/extract handler.
- **Evidence**: `web-source.test.ts`, `docs/s4b-verification.md`.
- **Known Blockers**: SSRF prevention must be strictly active (blocking loopback, link-local, RFC 1918 private IPs, and cloud metadata endpoints).
- **Safe Disabled Behavior**: API rejects with HTTP 403; UI disables Web URL tab.

### 6. YouTube Transcripts
- **Implemented Entry Points**: `POST /api/cohort-builder/workspaces/[workspaceId]/sources` with `kind: 'youtube'`.
- **Server Feature Policy**: `INTERACTION_YOUTUBE_SOURCE_ENABLED === '1'`. Defaults to `'0'`.
- **Required Schema/Storage**: `interaction_artifacts`, `interaction_jobs`.
- **Required Worker/Driver**: `interaction-worker.ts` with `LiveYoutubeTranscriptProvider` or dev test double.
- **Evidence**: `youtube-canonical-jobs.test.ts` (6 tests with `INTERACTION_YOUTUBE_FIXTURE=1`).
- **Known Blockers**: **HARD BLOCKER.** Google Data API v3 `captions.download` requires video owner OAuth credentials. Scraping internal `timedtext` endpoints violates Google terms and is unreliable. Without video owner OAuth, live acquisition is impossible for third-party YouTube videos.
- **Safe Disabled Behavior**: Flag strictly defaults to disabled (`'0'`). UI disables YouTube tab.

### 7. GitHub Repository Sources
- **Implemented Entry Points**: `POST /api/cohort-builder/workspaces/[workspaceId]/sources` with `kind: 'github'`.
- **Server Feature Policy**: `INTERACTION_GITHUB_SOURCE_ENABLED === '1'`. Defaults to `'0'`.
- **Required Schema/Storage**: `interaction_artifacts`, `interaction_jobs`.
- **Required Worker/Driver**: `interaction-worker.ts` with `LiveGithubSourceProvider`.
- **Evidence**: `github-source-live.test.ts` (11 tests passed, smoke test against `octocat/Hello-World`).
- **Known Blockers**: Unauthenticated GitHub API is rate-limited to 60 requests/hour per IP. Without `GITHUB_TOKEN` and strict repo size caps (e.g., max 50 files, max 2MB), shared deployment will instantly exhaust rate limits.
- **Safe Disabled Behavior**: Flag strictly defaults to disabled (`'0'`). UI disables GitHub tab.

### 8. Assistant Runner Execution
- **Implemented Entry Points**: `POST /api/interaction/v1/workspaces/[workspaceId]/messages` -> `runner.ts` -> tool execution.
- **Server Feature Policy**: Available for open workspaces; rate-limited per user.
- **Required Schema/Storage**: `interaction_workspaces`, `interaction_events`.
- **Evidence**: `local-model-fixture.test.ts`, `agenda.test.ts`.
- **Known Blockers**: Requires valid `GEMINI_API_KEY` or `OPENAI_API_KEY`.
- **Safe Disabled Behavior**: If provider key missing, returns bounded explanatory error without crashing workspace.

### 9. Private Learner Activation
- **Implemented Entry Points**: `POST /api/cohort-builder/workspaces/[workspaceId]/release` (`mode: 'private_activation'`).
- **Server Feature Policy**: Core capability; requires ready workspace with valid lessons.
- **Required Schema/Storage**: PostgreSQL `cohorts`, `seasons`, `lessons`, `cohort_members`, `communities`, `interaction_effects`.
- **Evidence**: `release.test.ts`, `scripts/s5-browser-verification.mjs`.
- **Safe Disabled Behavior**: Rejects unready workspaces with structured blocker report.

### 10. Public Cohort Release
- **Implemented Entry Points**: `POST /api/cohort-builder/workspaces/[workspaceId]/release` (`mode: 'public_publish'`).
- **Server Feature Policy**: Core capability; enforces redistribution rights (no restricted sources, no orphaned evidence).
- **Required Schema/Storage**: PostgreSQL `cohorts` (`visibility: 'PUBLIC'`).
- **Evidence**: `delivery.test.ts`, `scripts/s5-browser-verification.mjs`.
- **Safe Disabled Behavior**: Prevents publication if rights violations exist; once published, permanently blocks downgrades (`CANNOT_DOWNGRADE_PUBLIC_COHORT`).
