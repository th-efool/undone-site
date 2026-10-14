# Interaction builder execution checkpoint

STATUS: S3 IN PROGRESS — bounded pasted-text pipeline is worker-driven and restartable in revisioned workspace snapshots; plan-level job/artifact and live verification gates remain open.
LAST_CHECKPOINT: `IB-S3-DURABLE-DRIVER-INTEGRATION-2026-10-14`

DRIVER INTEGRATION: supervised `interaction-worker.ts` selects snapshot or durable through `text-driver.ts`. Durable SQL runtime uses the same configured PostgreSQL database with connection-scoped acceptance transactions; startup checks S3 tables/handler versions, source acceptance checks active cohort lifecycle, claims reject unknown handlers, and long ticks renew leases. Worker import check, root TypeScript, 12 acceptance/tick tests, and 2 driver/readiness tests pass. Rollout instructions: plans/interaction-builder/s3-schema-rollout.md. Shared migration remains unauthorized/unapplied. Next: bounded source-job status and canonical targeted retry/cancel; then composed journey and live gates.

CURRENT INTEGRATION: `INTERACTION_TEXT_DRIVER=durable` enables DAG reconciliation inside the production repository's authorized/idempotent commit transaction. Snapshot is the default pending schema rollout. Assembly acceptance now uses the package action planner, increments revision/sequence/contextEpoch, and inserts a compatible workspace.committed receipt/event atomically. Production-repository PGlite bridge tests prove duplicate receipt replay and rollback of graph/snapshot/request on event failure; assembly tests prove event rollback restores running job. Package unchanged. Next: configured supervised durable driver and lifecycle/schema readiness, then targeted per-source status/retry.

FINALIZATION AUDIT (supersedes earlier completion claims): S3 is NOT complete.
- Repaired `text-assembly-acceptance.ts`: fenced acceptance now precedes workspace mutation inside the same transaction; later projection conflict throws to roll back both. Expired leases cannot commit workspace changes.
- Assembly acceptance revalidates against accepted owned chunk/analysis artifacts using the assembly processor, rejects forged lesson bodies, and reconstructs canonical chunks/analyses/understanding/source readiness so fresh snapshots can complete the composed job chain.
- Acceptance tests now execute actual source jobs rather than marking fake prerequisite rows accepted. Composed replacement worker resumes expired assembly and a second tick is idle with revision unchanged.
- Verification: `npx vitest run src/server/domain/cohort-builder src/shared/cohort-builder` passed 23 files / 92 tests; `npx tsc --noEmit --pretty false` passed.
- Still missing: production canonical action/repository integration of DAG reconciliation; durable worker activation/configuration; transactional receipt/event/sequence emission for projections; per-source failure/retry projection into UI; authenticated browser journey; separate-connection PostgreSQL tests. Existing source-edit helper is not a production API and lacks owner/CAS/idempotency/event integration.
- Docker daemon remains unavailable. Shared additive migration remains unapplied by instruction. A deterministic provider adapter review is distinct from paid live provider validation and must not be marked blocked merely by spending restrictions.
- NEXT: integrate domain hooks into the canonical repository commit transaction and reuse its ownership, idempotency, receipts, and event sequencing; then wire the durable worker behind explicit schema/config readiness and verify the actual browser path. Do not move to S4 yet.

S3 CURRENT SLICE:
- `src/shared/cohort-builder/contracts.ts` owns retained, size-bounded pasted-text sources, source versions, chunks, understanding, analysis, processing checkpoint, and public add/edit/remove/retry actions. The old synchronous `process_sources` action is removed.
- `src/server/domain/cohort-builder/text-pipeline.ts` computes five deterministic server-only stages (acquisition → understanding → chunking → analysis → assembly). Acceptance verifies source fingerprints, exact retained text offsets/checksums, ownership, and expected result shape; revision CAS fences superseded workers.
- `src/server/domain/cohort-builder/text-worker.ts` advances one persisted stage per call; the supervised `src/server/interaction-worker.ts` polls queued cohort workspaces and `scripts/dev.mjs` launches it locally. Restart resumes from the next accepted stage. Failure is persisted with an explicit retry action.
- Adding/editing/removing a source invalidates affected descendants; unchanged source chunks/analysis are reused. Pinned or manually edited lessons survive regeneration. Intent/pacing changes queue assembly, audience changes queue analysis.
- Assembly covers every accepted chunk (up to 100); excessive scope fails visibly instead of silently dropping material. A retained manual/pinned lesson whose source changed is marked `evidenceStatus: orphaned` in the UI.
- Deterministic selected units split on Unicode code-point boundaries at no more than 24 KiB UTF-8; chunk acceptance checks complete non-whitespace retained-text coverage and rejects fabricated gaps. The 100-unit ceiling remains explicit. This is the live snapshot pipeline boundary; durable job cutover remains unwired.
- `src/server/domain/cohort-builder/context.ts` gives the assistant bounded, untrusted source excerpts and current lessons; chat stays available while source processing is queued.
- `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx` provides paste/edit/remove intake, real stage/status, retry, grounded lesson excerpts, and the same canonical action path used by chat.
- `src/server/domain/cohort-builder/selection.ts` resolves the durable triggering user turn's selected lesson ID/version (paging older messages when needed); both direct runner and supervised worker pass it to cohort tools. Selected edit/pin/remove actions must target that lesson and carry its entity version; stale or wrong targets reject before mutation. The remove action now checks entity version too.
- The reusable package's handler maps a host domain's Zod validation error to HTTP 400 even when host and package have different Zod majors; the host regression test and package conformance test pass.
- The reusable runner pages durable chat history to the run's `triggeringMessageId` and gives the model only bounded context ending there; later user messages cannot silently retarget an earlier run. The host-selected lesson resolver uses the same trigger identity.
- `src/client/screens/cohortBuilder/__tests__/CohortWorkspacePane.test.tsx` exercises interactive paste/edit, evidence display, orphan warning, and retry; source form controls have associated labels.
- Focused worker tests cover restart, fabricated/foreign/missing anchors, source edits, stale results, concurrent acceptance, preserved overrides, dependency reuse, size limits, and visible failure/retry.
- Prepared but did NOT apply additive host-owned `cohort_text_artifacts`, `cohort_text_jobs`, and `cohort_text_job_edges` schema in `prisma/schema.prisma` and `prisma/interaction-s3-storage.sql`. Workspace-scoped composite foreign keys prevent cross-workspace job dependencies and result artifacts. Existing production worker remains on snapshot checkpoints until migration authorization and runtime integration.
- `src/server/domain/cohort-builder/text-artifacts.ts` is an unwired, injected-SQL artifact adapter: server computes bytes/hash, owner-scoped reads rehash body, and stale/foreign/malformed refs fail. `prisma/__tests__/interaction-s3-storage.test.ts` and `src/server/domain/cohort-builder/__tests__/text-artifacts.test.ts` run against isolated PGlite; PGlite is an explicit dev dependency.
- `src/server/domain/cohort-builder/text-jobs.ts` is an unwired host job adapter. A single SQL claim only selects dependency-ready jobs; heartbeat and acceptance check lease token/fence; acceptance verifies artifact bytes and rechecks workspace/source identity, stage kind, fingerprint, and prerequisite state; retry is bounded and old source-version jobs are superseded. Isolated PGlite tests simulate expiry/reclaim and stale worker rejection.
- Job failure transitions also require an unexpired lease at an explicit clock; an expired worker cannot fail a job while its replacement is about to reclaim it. Isolated PGlite regression covers expiry, reclaim, and retry.
- An expired running job at the three-attempt ceiling is marked `failed` with `RETRY_EXHAUSTED` and is never silently reclaimed again; explicit retry rejects at that ceiling. Isolated PGlite test covers three claims, terminal failure, and retry refusal.
- `src/server/domain/cohort-builder/text-job-plan.ts` derives stable per-source acquisition → understanding → chunking → analysis keys plus global assembly dependencies. Source edits preserve other sources' keys; intent/pacing affect assembly only; audience affects analysis and assembly. `text-job-scheduler.ts` inserts the full graph in one transaction, idempotently by workspace/key; a failed edge insert rolls the graph back. These are prepared and not yet wired to the live worker.
- The prepared scheduler now transactionally supersedes obsolete queued/running/failed graph nodes (fence increment, lease cleared), including an empty-source plan. Unchanged source jobs retain their identities; a failed edge write rolls back both insertion and supersession. Historical accepted artifacts remain.
- A previously superseded logical job key is reactivated under a fresh fence when its exact dependency scope returns (goal A → B → A); its attempts/error/lease reset, while accepted historical jobs stay accepted. PGlite regression covers identity reuse and reactivation.
- `src/server/domain/cohort-builder/text-job-tick.ts` composes one prepared claim → injected host-stage processor → owned immutable artifact write → fenced acceptance. Processor failure is recorded only while lease is current; late results remain unreferenced and return stale. Isolated PGlite tests cover prerequisite progression, restart without duplicate work, visible failure/retry, and late result rejection. It is not wired to the production worker.
- `src/server/domain/cohort-builder/text-source-processor.ts` is a host-only, unwired processor for per-source acquisition/understanding/chunking/analysis jobs. It checks the current planned fingerprint, reads exactly one accepted owned prerequisite, verifies artifact integrity and source version, reuses the existing deterministic stage calculator, and emits schema-checked bytes. PGlite tests cover two-source progression, edit-only recomputation, source-specific failure/retry, stale source and tampered prerequisite rejection.
- `src/server/domain/cohort-builder/text-job-acceptance.ts` prepares a workspace-row-locked transaction that compares the canonical snapshot, exact current plan key/fingerprint, and claimed job fields before invoking the existing fenced artifact acceptance. `text-job-tick.ts` now requires an explicit acceptance callback so a production caller cannot silently use the lower-level unchecked acceptance. Isolated PGlite tests prove edit-before-accept rejection, accept-before-edit history, unplanned-key rejection, and stale tick result after an edit during processing. This is still unwired.
- `src/server/domain/cohort-builder/text-assembly-processor.ts` prepares global assembly from exactly the accepted analysis and chunk artifacts for every planned source. It rechecks planned keys/versions, artifact ownership and checksums, deterministic chunk/analysis evidence, and schema/coverage before emitting lesson bytes; it does not project into the canonical workspace. PGlite tests cover full two-source progression and stale, missing, foreign, or tampered prerequisites. Still unwired.
- `src/server/domain/cohort-builder/text-source-reconciliation.ts` applies a pasted-source edit and reconciles the complete durable DAG while holding the workspace row lock. Obsolete source-version jobs are superseded/fenced, new jobs are inserted, and assembly is requeued in the same transaction. PGlite proves the revision bump, exact replacement scope, and old claimed work becoming superseded. This remains prepared until the durable worker/schema cutover is authorized.
- `src/server/domain/cohort-builder/durable-text-worker.ts` composes the prepared durable tick with source/assembly processors and guarded acceptance/projection. It is injectable and opt-in; the existing production interaction worker remains snapshot-driven until the additive schema is authorized and deployed. Focused composition plus existing PGlite processor suites cover restart, retry, dependency progression, and stale results.
- The builder UI and chat both use the canonical cohort action/store path for source intake, retry, lesson edits, pins, ordering, and selected refinement. Component/domain verification passes; the UI is truthful about queued/failed/ready snapshot processing. Durable SQL-backed worker activation remains gated on additive schema rollout.
- Cutover gate still open: source-edit commit, DAG reconciliation, and current projection need one coherent transaction/guard; the serial PGlite tests do not prove separate-connection PostgreSQL concurrency. Do not wire this path live yet.
- NOT YET IMPLEMENTED to the full authoritative plan: live use of the prepared job/artifact tables, per-source partial failure, rich lesson assembly, real SQL concurrency with separate connections, authenticated browser E2E, and provider-backed acceptance. Do not call S3 complete.

SELECTED-REFINEMENT VERIFICATION: `npx vitest run` passed 162 files, 1105 tests, 2 skipped before one additional trigger-message regression test; `npx vitest run src/server/domain/cohort-builder/__tests__/selection.test.ts` passed all 3 tests after that addition; `npx tsc --noEmit --pretty false` exit 0; `npm run build` exit 0 (existing pdfjs/middleware warnings). No paid model or shared-DB migration was run.
UNIT-BOUNDARY VERIFICATION: `npx vitest run` passed 162 files, 1108 tests, 2 skipped; `npx tsc --noEmit --pretty false` exit 0. Exact 24 KiB Unicode and fabricated-gap cases added to text-pipeline tests.
JOB-FAILURE-FENCE VERIFICATION: `npx vitest run` passed 162 files, 1109 tests, 2 skipped; `npx tsc --noEmit --pretty false` exit 0. No shared database migration or paid provider calls.
JOB-RETRY-CEILING VERIFICATION: `npx vitest run` passed 162 files, 1110 tests, 2 skipped; `npx tsc --noEmit --pretty false` exit 0. No shared database migration or paid provider calls.
DAG-RECONCILE VERIFICATION: `npx vitest run` passed 162 files, 1111 tests, 2 skipped; `npx tsc --noEmit --pretty false` exit 0. Isolated PGlite test covers source edit, empty scope, stale lease revocation, and transaction rollback; no shared database migration.
TRIGGERED-CONTEXT VERIFICATION: package build exit 0; `npx vitest run` passed 162 files, 1112 tests, 2 skipped; `npx tsc --noEmit --pretty false` exit 0; `node scripts/verify-packed-consumer.mjs` passed isolated tarball consumer. No live PostgreSQL or browser E2E performed.
DAG-REACTIVATION VERIFICATION: `npx vitest run` passed 162 files, 1113 tests, 2 skipped; `npx tsc --noEmit --pretty false` exit 0. Prepared scheduler only; no shared database migration.
JOB-TICK VERIFICATION: `npx vitest run` passed 163 files, 1115 tests, 2 skipped; `npx tsc --noEmit --pretty false` exit 0. Deterministic injected processor in isolated PGlite only; no provider or shared database calls.
SOURCE-PROCESSOR VERIFICATION: `npx vitest run` passed 164 files, 1118 tests, 2 skipped; `npx tsc --noEmit --pretty false` exit 0. Isolated PGlite only; no live database or paid provider call.
CURRENT-ACCEPT VERIFICATION: `npx vitest run` passed 165 files, 1122 tests, 2 skipped; `npx tsc --noEmit --pretty false` exit 0. Isolated PGlite serial ordering only; separate-connection PostgreSQL concurrency remains open.
ASSEMBLY-ARTIFACT VERIFICATION: `npx vitest run src/server/domain/cohort-builder/__tests__/text-assembly-processor.test.ts` passed 3 tests; `npx tsc --noEmit --pretty false` exit 0; `npx vitest run` passed 172 files, 1143 tests, 2 skipped. The package submodule had unrelated pre-existing uncommitted changes; this checkpoint does not modify or commit them. No shared database or paid provider call.
SOURCE-DAG-RECONCILIATION VERIFICATION: focused reconciliation test passed; `npx tsc --noEmit --pretty false` exit 0. Old claimed jobs are fenced/superseded after the edit. No shared database migration or provider call.
DURABLE-TICK-AND-RESUME VERIFICATION: `npx vitest run src/server/domain/cohort-builder/__tests__/durable-text-worker.test.ts src/server/domain/cohort-builder/__tests__/text-job-tick.test.ts` passed 3 tests; `npx tsc --noEmit --pretty false` exit 0. Existing source-processor/tick suites cover restart, retry, and stale acceptance in isolated PGlite. No shared database migration, paid provider, or live worker cutover.
UI-CANONICAL-PATH VERIFICATION: `npx vitest run src/server/domain/cohort-builder src/shared/cohort-builder src/client/screens/cohortBuilder/__tests__/CohortWorkspacePane.test.tsx src/shared/interaction` passed 24 files/91 tests; `npm run interaction:worker:check` passed; `npm run interaction:readiness` reported READY for the existing 8-table interaction schema. No authenticated browser journey or paid provider call.

NEXT CHECKPOINT: Prepare atomic assembly projection with manual/pin overlay and evidence validation against current canonical sources; then couple source-edit commit to DAG reconciliation. Prove edit-versus-accept concurrency on isolated PostgreSQL with separate connections when available. Keep production worker on snapshot checkpoints until migration authorization and browser/provider verification.

CURRENT ARCHITECTURE:
- Authoritative standalone package in `packages/interaction-builder` (currently a Git submodule at `3f40a6af`; verify both repository states before package edits) with explicit subpaths:
  - `interaction-builder/core`: browser-safe schemas, envelopes, entity refs, receipts, events, reducer.
  - `interaction-builder/runtime`: action service, generic repository interface, runner loop, handlers, fencing, step journaling, proposals, deterministicUuid, undo (fully decoupled from AI SDK and adapters).
  - `interaction-builder/client`: browser external store, HTTP transport, SSE stream parser.
  - `interaction-builder/react`: `InteractionProvider`, typed hooks (`useWorkspaceView`, `useSendMessage`, `useDispatchAction`, etc.) with `'use client'` boundary preserved.
  - `interaction-builder/adapters/pg`: pure PostgreSQL adapter with `pg.Pool` without Prisma dependencies, ESM compatible.
  - `interaction-builder/adapters/http`: standard Web Request/Response dispatcher.
  - `interaction-builder/adapters/ai`: `createAiSdkModelAdapter` bridging AI SDK `LanguageModel` to provider-agnostic `InteractionModelAdapter` with abort on fatal tool error.
  - `interaction-builder/testkit`: `MemoryInteractionRepository`, scripted mock models, and agenda reference domain.
- Standalone Agenda Domain Example in `packages/interaction-builder/examples/agenda/` consuming public exports and tested both via SSR (`renderToString`) and interactive React component testing (`agenda-ui.test.tsx`).
- Undone (`src/`) rewired to consume `interaction-builder/*` public built distribution (`dist/`) directly without any source aliases:
  - Source aliases removed from `tsconfig.json` and `vitest.config.mts`.
  - `package-lock.json` updated through npm package manager; manual junctions removed.
  - `npm run prebuild` chained with `npm run build:interaction`.
  - Cohort tools in `src/server/domain/cohort-builder/tools.ts`:
    - Run-local revision tracking advancing strictly from commit receipts.
    - Serialized execution queue for parallel tool calls.
    - Deterministic UUIDs derived from `meta.requestId` for `actionId` and `lessonId`, ensuring idempotent replays match envelope hashes.
    - Recovery of completed steps advances revision tracking correctly.
  - Undone's Prisma-backed `postgresInteractionRepo` implements package's `InteractionRepository`.
  - Client re-exports from `interaction-builder/react` and `interaction-builder/client`.

## Verification Matrix

| Verification Tier | Status | Command / Evidence |
| --- | --- | --- |
| TypeScript check (Root) | PASSED | `npx tsc --noEmit --pretty false` (exit 0, resolves via `dist/` types) |
| Production build | PASSED | `npm run build` (exit 0; existing `pdfjs-dist` externalization and middleware deprecation warnings remain) |
| Package tests | PASSED | `npx vitest run packages/interaction-builder` (13 test files, 42 tests passed in 1.4s) |
| Interactive Agenda UI Test | PASSED | `packages/interaction-builder/__tests__/agenda-ui.test.tsx` (jsdom: interactive button clicks, input updates, and chat submission without prod credentials) |
| S3 text pipeline tests | PASSED | `npx vitest run src/server/domain/cohort-builder/__tests__/text-pipeline.test.ts` (11 tests passed after coverage/orphan checks) |
| S3 component tests | PASSED | `npx vitest run src/client/screens/cohortBuilder/__tests__/CohortWorkspacePane.test.tsx` (2 interactive jsdom tests passed) |
| Prepared S3 storage tests | PASSED | `npx vitest run prisma/__tests__/interaction-s3-storage.test.ts src/server/domain/cohort-builder/__tests__/text-artifacts.test.ts` (3 isolated PGlite tests passed; no shared-DB writes) |
| Prepared S3 job lease tests | PASSED | `npx vitest run src/server/domain/cohort-builder/__tests__/text-jobs.test.ts` (4 isolated PGlite tests passed; no shared-DB writes) |
| Prepared S3 DAG tests | PASSED | `npx vitest run src/server/domain/cohort-builder/__tests__/text-job-plan.test.ts src/server/domain/cohort-builder/__tests__/text-job-scheduler.test.ts` (6 tests passed, including idempotent enqueue, graph reconciliation, and rollback) |
| Cohort Builder & Domain tests | PASSED (prior baseline) | `npx vitest run src/server/domain/cohort-builder src/shared/cohort-builder` (9 files, 40 tests passed before S3 edits; covered in current full suite below) |
| Full Monorepo Vitest Suite | PASSED | `npx vitest run` (162 test files passed, 1112 tests passed, 0 failed, 2 skipped) |
| Standalone Package Build | PASSED | `node build.mjs` (ESM bundle + `.d.ts` declaration generation in `dist/` with `'use client'`) |
| NPM Pack & Isolated Consumer Test | PASSED | `node scripts/verify-packed-consumer.mjs` (fresh rebuild -> `npm pack` -> isolated temp directory -> `tsc` exit 0 -> ESM pg load -> full roundtrip -> React SSR render -> exit 0) |
| Boundaries Enforcement | PASSED | `packages/interaction-builder/__tests__/boundaries.test.ts` (0 host imports, 0 AI SDK imports in runtime/core, 0 adapter imports in runtime/core, 0 server imports in browser code) |
| PostgreSQL Adapter ESM | PASSED | `packages/interaction-builder/__tests__/pg-adapter.test.ts` (connectionString & pool construction without dynamic require) |
| SQL Schema & Readiness probe | PASSED (Read-only) | `npm run interaction:readiness` (exit 0: 8 tables + active partial index verified on Neon) |
| Worker CLI verification | PASSED | `npm run interaction:worker:check` (exit 0: imports & conditions valid, no DB/model calls) |
| Multi-tab browser journey | PASSED (Simulated) | `packages/interaction-builder/__tests__/store.test.ts` (journey simulation: message -> assistant edit -> manual edit -> second turn sees edit -> reload -> conflict) |
| Live SQL Concurrency Mutations | BLOCKED / DEFERRED | Preserved non-disposable shared Neon DB; synthetic destructive concurrency tests deferred until isolated test schema is provided |
| Live Headless Browser E2E | BLOCKED / DEFERRED | `/quest/build/:id` requires live NextAuth session cookie (`getCreationOwner()`); no test auth credentials authorized |

## Package Structure & Boundaries

```text
packages/interaction-builder/
├── package.json               # Exports: core, runtime, client, react, adapters/pg, adapters/http, adapters/ai, testkit
├── tsconfig.json
├── build.mjs                  # esbuild + tsc emit + 'use client' insertion
├── README.md
├── migrations/
│   └── 001_interaction_schema.sql  # 8 tables + active partial index DDL
├── src/
│   ├── core/                  # Schemas, envelopes, entity refs, receipts, events, reducer
│   ├── runtime/               # Action service, repository interface, runner loop, handlers, memory repo, SSE
│   ├── client/                # Browser store, HTTP transport, SSE stream parser
│   ├── react/                 # InteractionProvider, typed hooks ('use client' bundle)
│   ├── adapters/
│   │   ├── pg/                # Native pg.Pool adapter (zero Prisma dependency, ESM-compatible)
│   │   ├── http/              # Web Request/Response dispatcher
│   │   └── ai/                # AI SDK adapter (createAiSdkModelAdapter)
│   ├── testkit/               # Agenda domain, mock language models, memory repository
│   └── index.ts
├── examples/agenda/           # Standalone meeting agenda domain, runner example, and React UI
└── __tests__/                 # 12 test files covering all package subpaths, boundaries, and pg adapter
```

## Undone Host Rewiring

```text
src/shared/cohort-builder/contracts.ts
  Imports entityRefSchema, DomainActionPlan from 'interaction-builder/core'.

src/server/domain/cohort-builder/
  domain.ts -> imports DomainDefinition from 'interaction-builder/runtime'.
  tools.ts  -> imports InteractionRepository, DomainDefinition from 'interaction-builder/runtime'.
  __tests__/ -> full cohort integration test suite consuming 'interaction-builder/runtime'.

src/server/infrastructure/db/postgres/repositories/interaction.repo.ts
  Implements InteractionRepository and imports planActionCommit from 'interaction-builder/runtime'.

src/server/interaction.runtime.ts
  Imports createInteractionHandlers, runAssistantTurn from 'interaction-builder/runtime',
  dispatchInteraction from 'interaction-builder/adapters/http'.

src/server/interaction-worker.ts
  Imports runAssistantTurn, InteractionRepository from 'interaction-builder/runtime'.

src/client/interaction/
  provider.tsx -> re-exports InteractionProvider, store, transport from 'interaction-builder/react' and 'client'.
  hooks.ts    -> re-exports typed hooks from 'interaction-builder/react'.
```
