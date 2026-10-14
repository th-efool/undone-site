# S5 End-to-End Learner Delivery and Workspace Release Verification

S5 provides deterministic readiness validation, immutable candidate freezing, transactional
relational persistence (`Cohort`, `Season`, `Lesson`, `CohortMember`, `Community`), idempotent
receipt recovery (`interaction_effects`), and activated learner delivery (`/play?cohort=<id>`)
from interactive cohort builder workspaces.

## Baseline and Invariants

- Starting host commit was `9de32ce`, engine remains authoritative and untouched at `bf96b84` (`packages/interaction-builder`).
- S3, S4A, S4B, S4C, and S4D local PostgreSQL and browser verification journeys remain fully preserved and passing.
- Shared schema installation, durable activation, and deployment remain unauthorized. No shared database migrations, paid infrastructure, paid model/provider calls, or npm publications were performed.

---

## Checkpoint 1 — Canonical Actions, Domain Planning, and AI Tools

Implemented in commit `f5739e5`:
- **Schemas & Contracts** (`src/shared/cohort-builder/contracts.ts`):
  - Defined `cohortReleaseReceiptSchema` and `cohortReleaseStateSchema`.
  - Added `release?: CohortReleaseState` to `cohortWorkspaceSchema`.
  - Added `isRestricted: z.boolean().optional()` to `cohortSourceSchema`.
  - Added `prepare_release` and `commit_release` to `cohortActionSchema`.
  - Implemented `planCohortAction` handlers for release actions:
    - `prepare_release`: validates that background processing is complete (`ready` or `idle`), lessons are non-empty with valid titles/objectives, and enforces public release constraints.
    - `commit_release`: marks workspace as `released`, storing `cohortId`, `effectKey`, `releasedAt`, and `receipt`.
    - `invalidateRelease()`: automatically resets release state to `'draft'` on any curriculum mutation (intent, audience, daily minutes, lesson additions, edits, deletions, reorders, pins, or source additions/edits/deletions).
- **Delivery DTO & Adapter** (`src/shared/cohort-builder/delivery.ts`, `src/server/domain/cohort-builder/delivery.adapter.ts`):
  - Added `'youtube'` and `'github'` to `deliverySourceSchema.kind` with full provenance mapping.
  - Added `'YOUTUBE_VIDEO'` and `'GITHUB_REPO'` to `SOURCE_TYPE_MAP`.
  - Propagated `isRestricted` flag to delivery sources.
- **AI Tools** (`src/server/domain/cohort-builder/tools.ts`):
  - Registered `prepare_release` and `commit_release` tools in `createCohortAiTools` with canonical action mapping and deterministic step IDs.
- **Reconciliation Safety** (`src/server/domain/cohort-builder/text-action-jobs.ts`):
  - Ensured `reconcileTextAction` does not re-enqueue background processing jobs during release actions.
- **Tests**:
  - 9 unit tests in `src/server/domain/cohort-builder/__tests__/release-actions.test.ts` pass cleanly.

---

## Checkpoint 2 — PostgreSQL Release Store & Relational Transaction Adapter

Implemented in commit `ab1c4d3`:
- **Additive Database Schema** (`prisma/interaction-s5-effects.sql`):
  - Created `interaction_effects` table with primary key `effectKey`, workspace foreign key, state tracking (`pending`, `committed`, `failed`), receipt JSONB payload, and updated timestamps.
- **Postgres Effect Store** (`src/server/domain/cohort-builder/release-store.ts`):
  - Implemented `PostgresReleaseEffectStore` implementing `ReleaseEffectStore` over SQL transaction query port.
  - Provides atomic `get`, `recordPending`, and `commitReceipt` operations.
- **Transactional Release Service** (`src/server/domain/cohort-builder/release-service.ts`):
  - `releaseWorkspace` runs under an interactive PostgreSQL transaction with row-level locking (`SELECT ... FOR UPDATE` on `interaction_workspaces`).
  - Verifies workspace existence, owner identity, active lifecycle, and deterministic readiness.
  - Computes candidate snapshot hash and freezes candidate.
  - Enforces **downgrade protection**: rejects attempts to downgrade an already `PUBLIC` cohort back to `private_activation` (`CANNOT_DOWNGRADE_PUBLIC_COHORT`).
  - Executes `executeIdempotentRelease` with `PostgresReleaseEffectStore`.
  - Materializes relational Prisma learner records under the same transaction:
    - Creates or updates `Cohort` with deterministic `cohortId` (`PRIVATE` or `PUBLIC`).
    - Creates or updates `Season` and all `Lesson` items.
    - Creates `CohortMember` for the owner with role `OWNER`.
    - Creates `Community` and default discussion channel.
  - Atomically increments workspace `sequence` and `revision`, persists updated snapshot with release receipt, and writes canonical `cohort.released` event to `interaction_events`.
- **Candidate Hashing & Identity Consistency** (`src/server/domain/cohort-builder/release.ts`):
  - `deriveCandidateSnapshotHash` hashes normalized curriculum content (title, intent, audience, dailyMinutes, lessons, sources, chunks) deterministically, independent of workspace revision.
  - `freezeCohortCandidate` preserves `cohortId` across releases, enabling in-place private-to-public promotion without id divergence.
- **Tests**:
  - 5 composed PGlite tests in `src/server/domain/cohort-builder/__tests__/release-postgres.test.ts` pass:
    - Atomic release with relational learner records and receipt persistence.
    - Idempotent recovery and duplicate release avoidance.
    - Private-to-public in-place promotion and downgrade prevention.
    - Restricted source blocking during public publish.
    - Active processing job gating.

---

## Checkpoint 3 — UI ReleasePanel & Learner Activation Flow

Implemented in commit `214a444`:
- **Shared Readiness Logic** (`src/shared/cohort-builder/readiness.ts`):
  - Pure domain function `validateCohortReadiness(workspace, mode)` usable synchronously by both client UI and server execution.
  - Evaluates intent, pacing, lesson completeness, chunk evidence grounding, background processing completion, and redistribution rights.
  - Re-exported by `src/server/domain/cohort-builder/release.ts` for backward compatibility.
- **Release API Route** (`src/app/api/cohort-builder/workspaces/[workspaceId]/release/route.ts`):
  - `GET`: Authenticates owner, fetches workspace snapshot, and returns readiness reports for both `private_activation` and `public_publish` modes.
  - `POST`: Authenticates owner, parses request mode, invokes `releaseWorkspace`, handles `CohortReadinessError` (422), `CANNOT_DOWNGRADE_PUBLIC_COHORT` (409), and returns 200 with receipt.
  - 7 unit tests in `src/app/api/cohort-builder/workspaces/[workspaceId]/release/route.test.ts` pass.
- **ReleasePanel Component** (`src/client/screens/cohortBuilder/components/ReleasePanel.tsx`):
  - Synchronously computes readiness report for the selected mode.
  - Displays readiness status badge ("Ready for Release", "Blockers", or "Released").
  - Renders detailed blockers and warnings lists.
  - Mode selector with accessible radio group:
    - `private_activation` ("Start as Learner (Private)") -> Activates `/play?cohort=<id>`.
    - `public_publish` ("Publish to Directory (Public)") -> Publishes to directory `/cohort/<id>`.
  - Enforces client-side downgrade lock if already published publicly.
  - Shows release button with loading state, error alert on failure, and direct navigation button to the activated learner view on success.
- **Workspace Integration** (`CohortWorkspacePane.tsx`, `CohortInteractionScreen.tsx`):
  - Embedded `ReleasePanel` after the curriculum outline in `CohortWorkspacePane`.
  - Added section navigation anchor `#builder-release` in `CohortInteractionScreen`.
  - Styled with cohesive classes in `CohortBuilder.module.css`.
- **Tests**:
  - 6 component tests in `src/client/screens/cohortBuilder/__tests__/ReleasePanel.test.tsx` pass.
  - 7 workspace tests in `CohortWorkspacePane.test.tsx` pass.

---

## Checkpoint 4 — Integrated Verification & Verification Suite Evidence

### 1. Separate PostgreSQL Lifecycle Verification
Extended `scripts/s3-postgres-verification.ts` with complete S5 end-to-end assertions:
- `interaction_effects` additive DDL applied to test database.
- Private activation release executed via `releaseWorkspace`.
- Verified relational learner rows in PostgreSQL: `Cohort` (visibility `PRIVATE`), `Season`, `Lesson` items, `CohortMember` (role `OWNER`), and `interaction_effects` row (state `committed`).
- Verified workspace sequence increment, revision increment, and `cohort.released` event emission.
- Verified release idempotency: re-running private activation returns cached effect receipt without redundant mutations.
- Verified in-place promotion: releasing with mode `public_publish` updates existing `Cohort` visibility to `PUBLIC` under the exact same `cohortId`.
- Verified downgrade prevention: attempting to re-release as `private_activation` is rejected with `CANNOT_DOWNGRADE_PUBLIC_COHORT`.
- Verified restricted source blocking: public release with restricted sources is rejected by `CohortReadinessError`.

### 2. Full Test Suite & Build Verification
- **Release & Delivery Suite**: 53 tests passed across 7 test files:
  - `src/server/domain/cohort-builder/__tests__/delivery.test.ts` (7 tests)
  - `src/server/domain/cohort-builder/__tests__/release.test.ts` (12 tests)
  - `src/server/domain/cohort-builder/__tests__/release-actions.test.ts` (9 tests)
  - `src/server/domain/cohort-builder/__tests__/release-postgres.test.ts` (5 tests)
  - `src/app/api/cohort-builder/workspaces/[workspaceId]/release/route.test.ts` (7 tests)
  - `src/client/screens/cohortBuilder/__tests__/ReleasePanel.test.tsx` (6 tests)
  - `src/client/screens/cohortBuilder/__tests__/CohortWorkspacePane.test.tsx` (7 tests)
- **TypeScript**: `npx tsc --noEmit` exited with code 0 (zero errors).
- **Vercel Pre-Verification**: `npm run verify:vercel` exited with code 0:
  - Git submodule clean (`packages/interaction-builder`).
  - TypeScript compilation clean.
  - Package distributions built (`@undone/notes-board`, `interaction-builder`).
  - Prisma client generated.
  - Next.js production build simulation passed in 37.6s; all 35 static pages and dynamic API routes compiled cleanly.
- **External Consumer Packaging**: `node scripts/verify-packed-consumer.mjs` passed all 6/6 steps (fresh npm pack tarball, clean isolated installation, type declarations, 'use client' boundary, PostgreSQL adapter ESM instantiation, model turn, and React SSR).
- **Worker Check**: `npm run interaction:worker:check` exited with code 0.
- **Readiness Probes**: `npm run interaction:readiness` exited with code 0.
