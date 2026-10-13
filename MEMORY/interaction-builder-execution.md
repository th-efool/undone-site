# Interaction builder execution checkpoint

STATUS: STANDALONE PACKAGE EXTRACTED & VERIFIED (`packages/interaction-builder`); S2 DURABILITY PRESERVED; UNDONE REWIRED
LAST_CHECKPOINT: `IB-PACKAGE-EXTRACTION-COMPLETE-2026-10-13`

CURRENT ARCHITECTURE:
- Authoritative standalone package in `packages/interaction-builder` with explicit subpaths:
  - `interaction-builder/core`: browser-safe schemas, envelopes, entity refs, receipts, events, reducer.
  - `interaction-builder/runtime`: action service, generic repository interface, runner loop, handlers, fencing, step journaling, proposals, undo.
  - `interaction-builder/client`: browser external store, HTTP transport, SSE stream parser.
  - `interaction-builder/react`: `InteractionProvider`, typed hooks (`useWorkspaceView`, `useSendMessage`, `useDispatchAction`, etc.).
  - `interaction-builder/adapters/pg`: pure PostgreSQL adapter with `pg.Pool` without Prisma dependencies.
  - `interaction-builder/adapters/http`: standard Web Request/Response dispatcher.
  - `interaction-builder/testkit`: `MemoryInteractionRepository`, scripted mock models, and agenda reference domain.
- Standalone Agenda Domain Example in `packages/interaction-builder/examples/agenda/` verifying complete domain independence with zero cohort/Undone imports.
- Undone (`src/`) rewired to consume `interaction-builder/*` exclusively:
  - Duplicate files in `src/shared/interaction/` and `src/server/domain/interaction/` retired.
  - Cohort domain implementation and integration tests relocated cleanly to `src/server/domain/cohort-builder/`.
  - Undone's Prisma-backed `postgresInteractionRepo` implements package's `InteractionRepository`.
  - Client re-exports from `interaction-builder/react` and `interaction-builder/client`.

## Verification Matrix

| Verification Tier | Status | Command / Evidence |
| --- | --- | --- |
| TypeScript check | PASSED | `npx tsc --noEmit --pretty false` (exit 0) |
| Unit & Integration tests | PASSED | `npx vitest run` (151 test files, 1061 tests passed in 56s) |
| Package tests | PASSED | `npx vitest run packages/interaction-builder` (10 test files, 31 tests passed in 1.3s) |
| Cohort Builder tests | PASSED | `npx vitest run src/server/domain/cohort-builder src/shared/cohort-builder` (9 files, 35 tests passed) |
| Standalone Package Build | PASSED | `node build.mjs` (ESM bundle + `.d.ts` declaration generation in `dist/`) |
| NPM Pack & Isolated Consumer Test | PASSED | `npm pack` -> `interaction-builder-0.1.0.tgz` installed into isolated temp dir outside repo with zero parent `node_modules` leakage (`node scripts/verify-packed-consumer.mjs`) |
| SQL Schema & Readiness probe | PASSED (Read-only) | `npm run interaction:readiness` (exit 0: 8 tables + active partial index verified on Neon) |
| Worker CLI verification | PASSED | `npm run interaction:worker:check` (exit 0: imports & conditions valid, no DB/model calls) |
| Multi-tab browser journey | PASSED (Simulated) | `packages/interaction-builder/__tests__/store.test.ts` (journey simulation: message -> assistant edit -> manual edit -> second turn sees edit -> reload -> conflict) |
| Live SQL Concurrency Mutations | BLOCKED | Preserved non-disposable shared Neon DB; synthetic destructive concurrency tests deferred until isolated test schema is provided |
| Live Headless Browser E2E | BLOCKED | `/quest/build/:id` requires live NextAuth session cookie (`getCreationOwner()`); no test auth credentials authorized |

## Package Structure & Boundaries

```text
packages/interaction-builder/
├── package.json               # Exports: core, runtime, client, react, adapters/pg, adapters/http, testkit
├── tsconfig.json
├── build.mjs                  # esbuild + tsc emit
├── README.md
├── migrations/
│   └── 001_interaction_schema.sql  # 8 tables + active partial index DDL
├── src/
│   ├── core/                  # Schemas, envelopes, entity refs, receipts, events, reducer
│   ├── runtime/               # Action service, repository interface, runner loop, handlers, memory repo, SSE
│   ├── client/                # Browser store, HTTP transport, SSE stream parser
│   ├── react/                 # InteractionProvider, typed hooks
│   ├── adapters/
│   │   ├── pg/                # Native pg.Pool adapter (zero Prisma dependency)
│   │   └── http/              # Web Request/Response dispatcher
│   ├── testkit/               # Agenda domain, mock language models, memory repository
│   └── index.ts
├── examples/agenda/           # Standalone meeting agenda domain & runner example
└── __tests__/                 # 10 test files covering all package subpaths
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
