# Interaction builder execution checkpoint

STATUS: S3 IN PROGRESS — bounded pasted-text pipeline is worker-driven and restartable in revisioned workspace snapshots; plan-level job/artifact and live verification gates remain open.
LAST_CHECKPOINT: `IB-S3-STORAGE-PREPARED-2026-10-13`

S3 CURRENT SLICE:
- `src/shared/cohort-builder/contracts.ts` owns retained, size-bounded pasted-text sources, source versions, chunks, understanding, analysis, processing checkpoint, and public add/edit/remove/retry actions. The old synchronous `process_sources` action is removed.
- `src/server/domain/cohort-builder/text-pipeline.ts` computes five deterministic server-only stages (acquisition → understanding → chunking → analysis → assembly). Acceptance verifies source fingerprints, exact retained text offsets/checksums, ownership, and expected result shape; revision CAS fences superseded workers.
- `src/server/domain/cohort-builder/text-worker.ts` advances one persisted stage per call; the supervised `src/server/interaction-worker.ts` polls queued cohort workspaces and `scripts/dev.mjs` launches it locally. Restart resumes from the next accepted stage. Failure is persisted with an explicit retry action.
- Adding/editing/removing a source invalidates affected descendants; unchanged source chunks/analysis are reused. Pinned or manually edited lessons survive regeneration. Intent/pacing changes queue assembly, audience changes queue analysis.
- Assembly covers every accepted chunk (up to 100); excessive scope fails visibly instead of silently dropping material. A retained manual/pinned lesson whose source changed is marked `evidenceStatus: orphaned` in the UI.
- `src/server/domain/cohort-builder/context.ts` gives the assistant bounded, untrusted source excerpts and current lessons; chat stays available while source processing is queued.
- `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx` provides paste/edit/remove intake, real stage/status, retry, grounded lesson excerpts, and the same canonical action path used by chat.
- `src/client/screens/cohortBuilder/__tests__/CohortWorkspacePane.test.tsx` exercises interactive paste/edit, evidence display, orphan warning, and retry; source form controls have associated labels.
- Focused worker tests cover restart, fabricated/foreign/missing anchors, source edits, stale results, concurrent acceptance, preserved overrides, dependency reuse, size limits, and visible failure/retry.
- Prepared but did NOT apply additive host-owned `cohort_text_artifacts`, `cohort_text_jobs`, and `cohort_text_job_edges` schema in `prisma/schema.prisma` and `prisma/interaction-s3-storage.sql`. Workspace-scoped composite foreign keys prevent cross-workspace job dependencies and result artifacts. Existing production worker remains on snapshot checkpoints until migration authorization and runtime integration.
- `src/server/domain/cohort-builder/text-artifacts.ts` is an unwired, injected-SQL artifact adapter: server computes bytes/hash, owner-scoped reads rehash body, and stale/foreign/malformed refs fail. `prisma/__tests__/interaction-s3-storage.test.ts` and `src/server/domain/cohort-builder/__tests__/text-artifacts.test.ts` run against isolated PGlite; PGlite is an explicit dev dependency.
- NOT YET IMPLEMENTED to the full authoritative plan: live use of the prepared job/artifact tables, job claim/lease/fence/acceptance and per-source partial failure, selected-unit/24-KiB partition policy and complete coverage validation, rich lesson assembly, real SQL concurrency, authenticated browser E2E, and provider-backed acceptance. Do not call S3 complete.

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
| Cohort Builder & Domain tests | PASSED (prior baseline) | `npx vitest run src/server/domain/cohort-builder src/shared/cohort-builder` (9 files, 40 tests passed before S3 edits; covered in current full suite below) |
| Full Monorepo Vitest Suite | PASSED | `npx vitest run` (158 test files passed, 1095 tests passed, 0 failed, 2 skipped) |
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
