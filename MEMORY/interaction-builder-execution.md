# Interaction builder execution checkpoint

STATUS: S3 LOCAL IMPLEMENTATION COMPLETE AND VERIFIED. Shared rollout remains pending authorization.
LAST_CHECKPOINT: `IB-S3-VERTICAL-SLICE-VERIFIED-2026-10-14`
NEXT: S4A checkpoint 4 integrated PostgreSQL/browser acceptance. Checkpoint 1 committed/pushed `5f0aa02`: atomic owner-scoped intake in `src/server/infrastructure/db/postgres/cohort-intake.ts`, canonical source/message composition; `/api/cohort-builder/intake` server feature/driver/schema gate; `/quest/start` session handoff with explicit authenticated confirmation. Builder GET now reads only. Existing v1 entry remains when v2 disabled. No shared rollout.

S4A checkpoint 3: `assistant-queue.ts` admits saved turns FIFO under the workspace lock after completion/failure/cancel; five pending turn ceiling. Canonical commits recheck run fence after locking; assistant transcript appends carry host lease fence; heartbeats cannot resurrect expired leases. HTTP schedules; supervised worker executes. Owned bounded `/api/cohort-builder/workspaces/:id/activity` exposes safe turn states; UI separates assistant Stop from source Stop, retains conflict edits and guards stale selections. Host transport retries lost message acknowledgement with original ID/key. Concurrent session committed shared queue/UI edits as `64b9d61`, `fedfeac`, `fe66977` and upgraded package pointer to `f2f78b9`; preserved and verified, no package edits by this agent. Real PostgreSQL FIFO/cap/cancel/replacement/recovery tests passed; focused shell/transport/selection tests 10 passed.

S4A checkpoint 2: one mounted provider/panes across responsive switching; native source/outline navigation, full anchored evidence details; accessible dialog focus trap/return; composer respects transcript scroll. Session loss removes workspace provider. Draft edits stay component-local, identity-keyed and do not persist outside mounted workspace. Focused workspace/shell tests 6 passed; TypeScript passed. Concurrent unrelated package edits appeared during this pass and were preserved, not committed.

S4A checkpoint 1 checks: targeted intake/canonical tests 8 passed; real PostgreSQL script passed including concurrent/lost-response intake, mismatch and event-failure rollback. Plan: `plans/interaction-builder/s4a-checkpoints.md`.

## Authoritative boundaries

- `packages/interaction-builder` remains the reusable engine, consumed through public package exports. Its submodule stayed at `7e75a350`; no package changes in this pass.
- `src/shared/cohort-builder/contracts.ts`: owned retained pasted text (exact whitespace/bytes), source versions, strict canonical actions, pins/manual overrides, bounded safe current-job views, targeted retry/cancel.
- `src/server/infrastructure/db/postgres/repositories/interaction.repo.ts`: owner/lifecycle checks, row-lock CAS, idempotency recheck after lock, receipt/event sequencing, and same-transaction cohort DAG reconciliation. Fresh queued assistant claims capture current workspace revision before model execution; recovered running claims retain their journal context.
- `src/server/domain/cohort-builder/text-action-jobs.ts`: canonical action integration; the old standalone source-edit helper is not an HTTP API or production writer.
- `text-job-plan.ts` / `text-job-scheduler.ts`: stable per-source acquisition/understanding/chunking/analysis dependencies and global assembly; edits preserve unrelated source artifacts. Assembly generations distinguish explicit new projections, including returned scopes.
- `text-artifacts.ts` / `text-source-processor.ts` / `text-assembly-processor.ts`: immutable retained artifact bodies, checksums, current dependency identity and deterministic evidence validation. Fabricated/foreign/missing evidence rejects.
- `text-job-acceptance.ts` / `text-assembly-acceptance.ts` / `text-projection-commit.ts`: active-workspace lock, current plan/lease/fence check, package action receipt, canonical projection, revision/contextEpoch/sequence and persisted workspace.committed event in one transaction. Event failure rolls back acceptance and projection.
- `lesson-projection.ts`: preserve pins/manual edits; mark removed/changed evidence orphaned; advance generated entity versions when content changes.
- `text-job-failure.ts` / `text-job-status.ts` / `text-job-recovery.ts`: current graph only, at most 81 public job views, persisted failure/progress events, targeted retry, terminal attempt ceiling and recovery of queued pre-cutover work.
- `durable-text-worker.ts` / `text-job-tick.ts`: real claim/process/artifact/accept composition, lease renewal, three attempts and 45-second computation deadline. SQL runtime bounds statement/lock waits.
- `src/server/infrastructure/db/postgres/text-job-runtime.ts` / `src/server/interaction-worker.ts`: actual supervised durable driver; connection-scoped transactions. `INTERACTION_TEXT_DRIVER` selects exactly snapshot or durable. Persisted durable markers exclude snapshot processing; driver mismatch fails mutations.
- `text-schema-readiness.ts` / `scripts/interaction-readiness.ts`: durable startup/readiness requires S3 tables and supported queued handler versions. Missing schema fails rather than dropping work.
- `src/server/infrastructure/ai/interactionModel.ts`: production uses installed AI SDK provider; explicit deterministic fixture requires development + loopback s3test DB. Production/remote attempts reject. `/run` never borrows another worker's lease.
- `src/client/screens/cohortBuilder/`: canonical source intake/status/retry/cancel, evidence, selected chat refinement, edits/pins/order. Failed saves preserve editors and unsent input. New workspaces start without fabricated placeholder lessons.
- Existing v1 creation path retained; no dual writes, connectors, discovery, publishing, registry publication or deployment.

## Verification evidence

- `npx vitest run --maxWorkers=2`: 181 files passed, 1179 tests passed, 2 skipped (existing skips). Includes package portability/boundary tests, host regression, transaction rollback, source invalidation, deadline and UI conflict tests.
- `npx tsc --noEmit --pretty false`: exit 0.
- `npm run verify:vercel`: exit 0; submodule check, package distributions, Prisma generation and full optimized production build passed. Existing pdfjs/middleware warnings remain; no deployment was performed.
- `scripts/s3-postgres-verification.ts`: passed against real isolated PostgreSQL 18 on separate connections and the production Prisma repository. Concurrent idempotent requests, exclusive claims, expired lease replacement, simultaneous edit/accept, event rollback, restart and contiguous events passed.
- `scripts/s3-browser-verification.mjs`: exit 0 against actual authenticated Next builder/API/SSE, supervised worker and real isolated PostgreSQL. Pasted text, chat goal, grounded evidence, selected refinement via AI SDK mock/tools, pin/manual edit, reload, source change/orphan preservation, worker restart, corrupted-artifact failure/targeted retry, reconnect and two-tab 200/409 conflict with unsent input preservation passed.
- Deterministic provider review uses actual AI SDK mock, generic runner, cohort tools, canonical repository, persisted transcript and public client store. No paid model calls.
- `scripts/s3-local-environment.mjs`: verified fresh local PostgreSQL provisioning and schema generation/installation. `docs/s3-verification.md` contains reproducible commands; test-only binaries live under `.tmp`, outside production dependencies.
- Local database/server/browser services were stopped after verification; retained synthetic fixtures/screenshots remain under `.tmp`.

## Rollout status

- Shared database: read-only probe confirmed 0 of 3 S3 tables present. No shared migration was applied and no deployment occurred.
- Reviewed additive SQL: `prisma/interaction-s3-storage.sql`; operator command/configuration in `plans/interaction-builder/s3-schema-rollout.md`.
- Authorize/install the additive schema, then select durable consistently for HTTP/worker and check readiness before shared activation. Default snapshot mode remains for the current shared environment.
- Local S3 verification is complete; shared rollout, live paid-provider quality evaluations and broader S6 operational/security/load gates remain distinct future work.
