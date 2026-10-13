# interaction-builder-plan

STATUS: STANDALONE PACKAGE IMPLEMENTED & VERIFIED (`packages/interaction-builder`). S1 + S2 complete; Undone rewired; S3 pasted-text slice in progress (see `MEMORY/interaction-builder-execution.md`).
ROOT: `D:/ThisPC/Documents/SideQuestHQ/undone-site`
SCOPE: reusable embedded human–AI–website interaction layer; cohort creation first domain; agenda reference domain in package.
NOT: website/app/code generation, generated-site hosting, arbitrary executable UI.

## Read routes

| Need | Plan owner |
| --- | --- |
| Scope, decisions, evidence, reference transfer | `plans/interaction-builder/README.md` |
| Packages, ports, domain/plugin/client APIs, adoption recipe | `plans/interaction-builder/01-system-architecture.md` |
| Tables, transactions, model/tool journal, concurrency, REST/SSE, recovery | `plans/interaction-builder/02-runtime-and-protocol.md` |
| Cohort actions/entities, DAG, invalidation, grounding, release | `plans/interaction-builder/03-cohort-domain.md` |
| Chat↔workspace journeys, selection, composer, client store, accessibility | `plans/interaction-builder/04-conversation-and-workspace.md` |
| Exact NEW/MODIFY/retain files, S0–S7 slices, rollout/rollback | `plans/interaction-builder/05-files-and-delivery.md` |
| Security, budgets, deployment, retention, T01–T31 tests, release gates | `plans/interaction-builder/06-production-and-verification.md` |

## Core invariants

```text
chat + UI → same typed action service → policy + deterministic domain validation
          → atomic snapshot/revision + timeline + jobs/outbox → event reducer → both panes
model proposes; server authorizes/executes; browser renders; database owns truth
server-owned bounded run loop; long work = durable jobs; disconnect != cancel
entity versions/read sets/fences prevent stale overwrites
manual overrides/pins separate from generated baseline and immutable evidence
host-supplied renderers; no generated React/HTML/filesystem tools
```

## Implemented Module Boundaries

```text
packages/interaction-builder/core           schemas/contracts/pure reducer; browser-safe, zero host dependencies
packages/interaction-builder/runtime        orchestration/journals/ports/policy/runner/fencing/memory repo
packages/interaction-builder/client         browser store/SSE parser/HTTP transport
packages/interaction-builder/react          InteractionProvider + typed hooks
packages/interaction-builder/adapters/pg    native pg.Pool PostgreSQL repository (no Prisma, ESM-compatible)
packages/interaction-builder/adapters/http  Web Request/Response HTTP dispatcher
packages/interaction-builder/adapters/ai    AI SDK LanguageModel adapter (createAiSdkModelAdapter)
packages/interaction-builder/testkit       MemoryInteractionRepository + mock models + agenda reference domain
src/shared/cohort-builder                   cohort schemas/actions/domain contracts
src/server/domain/cohort-builder            cohort tools/context/text-pipeline/text-worker/tests
src/client/screens/cohortBuilder            cohort renderers/editors
src/server/interaction.runtime.ts           host composition root
```

LIVE routes: `/quest/build/:workspaceId`; `/api/interaction/v1/*`.
CURRENT routes: `/quest/new`; `/quest/draft/:draftId`; `/api/cohort-creation/*`.
MIGRATION: new workspaces opt into v2; v1 keeps its writer/resume route; no dual writes; rollback stops new v2 intake but preserves accepted work.

## Existing authority / evidence

- `MEMORY/cohort-creation.md` = current implementation map, not this proposal.
- `MEMORY/ai-builder-forge.md` + `MEMORY/ai-builder-puter.md` = reference patterns. `plans/ai-builder/` was empty at this planning check; historical reference source locators were not freshly verifiable.
- Current `src/client/screens/cohortCreation/CreationExperience.tsx` has stage-specific regex/scroll handlers; do not wrap them as the new conversation engine.
- Existing material/processing/storage/delivery code is candidate reusable infrastructure only after conformance tests. No requirement to discard proven evidence/ownership safeguards.

## Fast start for future implementation

1. Read README + owning plan document; verify current git/source state.
2. Start S0/S1; demonstrate one persistent chat↔UI loop, then S2 durability/agenda portability.
3. S3 grounded text cohort before widening connectors; S5 release before public rollout.
4. Keep status per slice accurate. Update this memory with actual source/commands after implementation; do not remove proposed labels from unfinished work.

DO_NOT_INFER: implemented package exports, migrations, test passes, worker deployment, live provider reliability, or production readiness from these documents.

## Actual implementation started

| Current file | Purpose | Status |
| --- | --- | --- |
| `src/shared/interaction/contracts.ts` | Typed refs, receipts, message parts, event/action envelopes | Implemented, verified |
| `src/shared/interaction/reducer.ts` | Pure snapshot/event/pending-action client reducer; sequence/gap/workspace guards | Implemented, verified |
| `src/shared/cohort-builder/contracts.ts` | Cohort draft schema + typed intent/audience/time/lesson/order/pin/add/remove actions + pure action planner | Implemented, verified |
| `src/server/domain/interaction/action.service.ts` | Stateless domain commit boundary & receipt generator | Implemented, verified |
| `src/server/domain/interaction/repository.ts` | Typed repository interface, records, canonical payload hashing | Implemented, verified |
| `src/server/domain/interaction/memory.repository.ts` | In-memory testkit double with CAS, idempotency replay, outbox leasing | Implemented, verified |
| `src/server/infrastructure/db/postgres/repositories/interaction.repo.ts` | Postgres / Prisma row-lock CAS transaction repo + outbox | Implemented, verified |
| `src/server/domain/interaction/handlers.ts` | HTTP request handlers (workspaces, actions, messages, events, runner) | Implemented, verified |
| `src/server/domain/interaction/http.ts` | Explicit Next.js dispatcher for `/api/interaction/v1` routes | Implemented, verified |
| `src/server/domain/interaction/sse.ts` | Replay-to-live event stream over SSE with sequence cursor | Implemented, verified |
| `src/server/domain/interaction/runner.ts` | Multi-step assistant runner loop via AI SDK v7 (`generateText` + `stopWhen`) | Implemented, verified |
| `src/server/domain/cohort-builder/tools.ts` | AI SDK cohort tools dispatching through `commitAction` | Implemented, verified |
| `src/server/interaction.runtime.ts` | Composition root wiring Postgres repo, Cohort domain, Gemini model | Implemented, verified |
| `src/shared/interaction/store.ts` | Reconnectable external store with optimistic commits, CAS, gap recovery | Implemented, verified |
| `src/shared/interaction/transport.ts` | Fetch + chunk-safe SSE streaming parser (`parseSseStream`) with `/run` trigger | Implemented, verified |
| `src/client/interaction/provider.tsx` | React 19 external store provider (`InteractionProvider`) | Implemented, verified |
| `src/client/interaction/hooks.ts` | External store hooks (`useInteractionState`, `useWorkspaceView`, `useSendMessage`, etc.) | Implemented, verified |
| `src/client/screens/cohortBuilder/` | Complete 2-column builder UI (`CohortInteractionScreen`, `ChatPane`, `CohortWorkspacePane`, CSS) | Implemented, verified |
| `src/server/domain/cohort-builder/domain.ts` | Pure cohort domain definition decoupled from React/Next.js | Implemented, verified |
| `src/server/interaction-worker.ts` | Supervised worker loop with lease claiming, heartbeating, shutdown | Implemented, verified |
| `scripts/interaction-readiness.ts` | Read-only schema & credentials readiness probe (8 tables + active index) | Implemented, verified |
| `src/server/domain/interaction/__tests__/scheduling.test.ts` | S2 durability test suite (8 tests covering leasing, fencing, replay, stale rejects, proposals) | Implemented, verified |

All 13 test suites (50 tests) passing in Vitest. TypeScript compilation clean (exit code 0). S2 durability verified. Next implementation slice: S3 text-to-cohort processing pipeline & durable DAG execution.
