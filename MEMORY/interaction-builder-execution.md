# Interaction builder execution checkpoint

STATUS: ACTIVE
LAST_CHECKPOINT: `IB-S2E-STORE-2026-10-13`
DONE (S2 server+client core, all verified by command output):
- Server: `handlers.ts` (create/get/commitAction/getEvents), `http.ts` (explicit dispatcher; 401/400/404/409/413; idempotency-key; no-store), `sse.ts` (replay>cursor, live poll, heartbeat comments, 25s bounded, Last-Event-ID, owner 404 pre-stream), `src/server/interaction.runtime.ts` (host composition, cohort domain, Postgres repo), `src/app/api/interaction/v1/[...path]/route.ts`. 17 tests in `src/server/domain/interaction`.
- Client: `src/shared/interaction/store.ts` (framework-free store; transport port; snapshot+SSE via reducer; own-commit authoritative view; foreign commit/gap/conflict â†’ resnapshot; reconnect from cursor; pending/lastReceipt/lastError). 10 tests in `src/shared/interaction` (store 6 + reducer 4). tsc exit 0.
NOT DONE / caveats: `prisma/interaction-runtime.sql` NOT applied to any DB (needs backup+user OK); route never run against live DB; no fetch/EventSource transport yet; messages list not populated (no chat yet).
NEXT: (1) `src/shared/interaction/transport.ts` default fetch+SSE-parser transport (fetch streaming w/ Accept text/event-stream, split-chunk safe) + tests; (2) React provider/hooks `src/client/interaction/`; (3) messages table + `POST messages` + model tool loop calling same commitAction (S1 exit: chat edit â†” right edit); (4) cohort UI route `/quest/build/[workspaceId]`.
UPDATED: 2026-10-13 (Asia/Calcutta)
OWNER: Codex / future agents may resume
PLAN: `plans/interaction-builder/README.md`
MEMORY: `MEMORY/interaction-builder-plan.md`

## Mission

Build reusable embedded humanâ€“AIâ€“website interaction layer. First domain: cohort creation. Not website/app generator. Chat and right workspace must share typed actions, canonical state, durable history, jobs, revisions, and receipts.

## Checkpoint state

| Stage | Status | Evidence |
| --- | --- | --- |
| S0 contract baseline | DONE | New headless interaction/cohort schemas and reducer files below |
| S1 pure action loop | DONE | Cohort action planner + stateless commit boundary + focused tests |
| S1 dependency verification | DONE | `vitest` (3 files, 9 tests passed in 324ms) and `tsc --noEmit` (exit code 0, 0 errors). Verified. |
| S2 durable persistence/outbox | DONE | Additive Prisma models validated/generated; typed repository contracts; in-memory testkit double; Postgres/Prisma row-CAS transaction repo; outbox lease/ack/fail; agenda portability proof (5 files, 15 tests passed in 604ms). |
| S3 real cohort text pipeline | NOT STARTED | Existing v1 untouched |
| S4 UI + source breadth | NOT STARTED | Existing `CreationExperience` untouched |
| S5 release adapter | NOT STARTED | Existing publication path untouched |

## Implemented files

```text
src/shared/interaction/contracts.ts
  EntityRef, ChangeReceipt, typed message parts, event envelope, action envelope.

src/shared/interaction/reducer.ts
  Pure client reducer. Guards workspace identity, duplicate sequence, event gaps,
  revision update only on committed event, pending action state.

src/shared/interaction/__tests__/reducer.test.ts
  Duplicate/gap/foreign-workspace/commit-revision fixtures.

src/shared/cohort-builder/contracts.ts
  Versioned cohort draft schema. Typed actions: intent, audience, daily minutes,
  lesson edit, lesson order, lesson pin. Pure planner. Stale workspace/entity
  checks. Pinned title protection. Invalidation labels.

src/shared/cohort-builder/__tests__/contracts.test.ts
  Edit, pin protection, stale revision/entity, invalid ordering fixtures.

src/server/domain/interaction/action.service.ts
  Stateless action commit boundary. Validates envelope, checks revision, calls
  deterministic domain planner, creates receipt.

src/server/domain/interaction/__tests__/action.service.test.ts
  Receipt/revision and stale workspace fixtures.

src/server/domain/interaction/repository.ts
  Generic interaction repository port, typed records, and canonical JSON SHA-256 payload hasher.

src/server/domain/interaction/memory.repository.ts
  In-memory repository testkit double with atomic CAS, tenant isolation, sequence progression,
  idempotent request replay/mismatch, and outbox leasing.

src/server/infrastructure/db/postgres/repositories/interaction.repo.ts
  PostgreSQL / Prisma repository implementation with transaction row locks (FOR UPDATE),
  CAS verification, request deduplication, event logging, and outbox lease handling.

src/server/domain/interaction/__tests__/repository.test.ts
  Unit and concurrency tests for CAS, owner isolation, idempotency replay/mismatch,
  event sequencing, and outbox leasing/ack/fail backoff.

src/server/domain/interaction/__tests__/fixtures/agenda-domain.ts
  Independent meeting agenda domain fixture with pure action planner and pin protection.

src/server/domain/interaction/__tests__/portability.test.ts
  Portability tests running agenda domain on the generic repository with zero cohort imports.
```

## Verification

Commands executed:

```text
npx vitest run src/shared/interaction/__tests__/reducer.test.ts src/shared/cohort-builder/__tests__/contracts.test.ts src/server/domain/interaction/__tests__/action.service.test.ts src/server/domain/interaction/__tests__/repository.test.ts src/server/domain/interaction/__tests__/portability.test.ts
âœ“ src/server/domain/interaction/__tests__/action.service.test.ts (2 tests) 15ms
âœ“ src/shared/cohort-builder/__tests__/contracts.test.ts (3 tests) 17ms
âœ“ src/shared/interaction/__tests__/reducer.test.ts (4 tests) 36ms
âœ“ src/server/domain/interaction/__tests__/repository.test.ts (5 tests) 16ms
âœ“ src/server/domain/interaction/__tests__/portability.test.ts (1 test) 7ms
Test Files: 5 passed (5), Tests: 15 passed (15), Duration: 604ms.

npx tsc --noEmit --pretty false
Exited 0 with no diagnostic errors.

npx prisma validate && npx prisma generate
Prisma schema validated and Prisma client v7.9.1 generated cleanly.
```

## Resume procedure

1. Read this file, `MEMORY/README.md`, `MEMORY/interaction-builder-plan.md`, then plan `05-files-and-delivery.md`.
2. Run `Test-Path node_modules/typescript`, `Test-Path node_modules/vitest`. If broken, use repository-approved package manager and lockfile. Do not change dependency versions casually.
3. Run focused Vitest files above. Fix source errors only after seeing real diagnostics.
4. Run `npx tsc --noEmit --pretty false`; record exact result here.
5. If S1 passes, checkpoint `IB-S1-VERIFIED` and begin S2: additive Prisma interaction tables, repository transaction/CAS, event/outbox records, and testkit. Do not start UI before durable action path exists.
6. After each meaningful slice, update STATUS/table/files/verification/next step in this file before stopping.
7. Update `MEMORY/interaction-builder-plan.md` actual implementation table and `MEMORY/README.md` only when locators/status materially change.

## Stop-safe rules

- Never mark tests PASS without command output.
- Never claim SQL/API/UI exists until exact files are present and tested.
- Existing v1 cohort creation remains writer for existing drafts; no dual write.
- Never replace this log with a vague summary. Add newest checkpoint, preserve prior evidence.
