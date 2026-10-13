# interaction-builder-plan

STATUS: PARTIAL IMPLEMENTATION. Architecture recorded 2026-10-13. S0/S1 pure contracts started; durable server/API/UI runtime still not implemented. Do not use proposed paths as current implementation evidence.
ROOT: `D:/ThisPC/Documents/SideQuestHQ/undone-site`
SCOPE: reusable embedded human–AI–website interaction layer; cohort creation first domain.
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

## Planned module boundaries

```text
packages/interaction-core        schemas/contracts/pure reducer; no host/provider/UI
packages/interaction-runtime     orchestration/journals/ports/policy; no cohort semantics
packages/interaction-adapters    PostgreSQL/AI SDK/HTTP/SSE/Node/Workflow subpath adapters
packages/interaction-react       hooks + optional shell; no server code
packages/interaction-testkit     deterministic infrastructure + unrelated agenda fixture
src/shared/cohort-builder        cohort schemas/actions/dependencies/projection
src/server/domain/cohort-builder cohort tools/context/jobs/acceptance/release
src/client/screens/cohortBuilder cohort renderers/editors
src/server/interaction.runtime.ts host composition
```

PLANNED routes: `/quest/build/:workspaceId`; `/api/interaction/v1/*`.
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
| `src/shared/cohort-builder/contracts.ts` | Cohort draft schema + typed intent/audience/time/lesson/order/pin actions + pure action planner | Implemented, verified |
| `src/server/domain/interaction/action.service.ts` | Stateless domain commit boundary & receipt generator | Implemented, verified |
| `src/server/domain/interaction/repository.ts` | Typed repository interface, records, canonical payload hashing | Implemented, verified |
| `src/server/domain/interaction/memory.repository.ts` | In-memory testkit double with CAS, idempotency replay, outbox leasing | Implemented, verified |
| `src/server/infrastructure/db/postgres/repositories/interaction.repo.ts` | Postgres / Prisma row-lock CAS transaction repo + outbox | Implemented, verified |
| `src/shared/interaction/__tests__/reducer.test.ts` | Duplicate, gap, foreign workspace, commit revision tests | Verified (4 tests passed) |
| `src/shared/cohort-builder/__tests__/contracts.test.ts` | Action, pin, stale revision/entity, order validation tests | Verified (3 tests passed) |
| `src/server/domain/interaction/__tests__/action.service.test.ts` | Receipt/revision and stale workspace tests | Verified (2 tests passed) |
| `src/server/domain/interaction/__tests__/repository.test.ts` | Concurrency, CAS, idempotency replay/mismatch, outbox lifecycle | Verified (5 tests passed) |
| `src/server/domain/interaction/__tests__/portability.test.ts` | Engine portability fixture with Agenda domain (zero cohort imports) | Verified (1 test passed) |

These files provide the headless interaction core, cohort action planner, durable repository layer with Postgres CAS and outbox, and memory testkit. Next implementation slice: S3 text-to-cohort processing pipeline & durable DAG execution.
