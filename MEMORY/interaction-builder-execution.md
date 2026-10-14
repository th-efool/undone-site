# Interaction builder execution checkpoint

STATUS: S4B IN PROGRESS. S3/S4A locally verified; shared rollout remains pending authorization.
LAST_CHECKPOINT: `IB-S4A-INTEGRATED-JOURNEY-2026-10-14`
NEXT: S4B checkpoint 4 UI/chat parity. Plan: `plans/interaction-builder/s4b-checkpoints.md`. Do not activate shared durable processing before authorized schema rollout.

S4B checkpoint 3: durable external sources add extraction between acquisition and understanding; input/parser fingerprints exclude derived projections. Handler version 2 prevents old workers claiming external jobs. Accepted raw/extraction IDs, text and provenance project atomically with persisted events; extraction is re-derived before locking and assembly verifies owned accepted retention. PDF page changes reuse bytes; unaffected web analysis remains accepted. Composed PGlite tests cover both actual parsers through canonical actions/jobs/assembly/events, fabricated extraction and event rollback. Focused host suite and TypeScript pass; separate-connection PostgreSQL/browser S4B gates remain checkpoint 5, not satisfied by these tests. Checkpoint 2 `a25602b` pushed with planning.

S4B checkpoint 2: `source-adapters.ts` reuses pinned HTTPS acquisition and isolated PDF/HTML parsing. Retains exact web response; immutable checksum checked before extraction; page scope and location coverage validated. PDF 2 MiB/200 pages, web 1 MiB, output 200,000 UTF-8 bytes; unsupported scanned/encrypted PDFs fail, no OCR. `source-web.worker.mjs` has 192 MiB/20s parser limits. Focused source-adapter + existing PDF/web acquisition/transport tests: 4 files/77 tests passed; root TypeScript exit 0. Not yet connected to durable processing or UI. Checkpoint 1 `7ac3b3f` pushed with planning.

S4B checkpoint 1: optional source input/provenance/scope contracts preserve old pasted snapshots; canonical PDF/web/scope actions in shared contracts. `cohort-pdf-upload.ts` uses one owned locked transaction for immutable SQL input plus the existing canonical action/receipt/event path. `source-policy.ts` gates new capabilities and rejects foreign uploaded refs. Additive `prisma/interaction-s4b-sources.sql` expands artifact/stage checks only; installed only in isolated test fixture. Flags default off (`INTERACTION_PDF_ENABLED`, `INTERACTION_WEB_ENABLED`); extraction/worker/UI activation still pending. Real PostgreSQL upload/replay/foreign/size/stale rollback tests passed; existing focused text/intake tests 17 passed.

## S4A current entry points

- `src/client/screens/landing/Hero/components/CentralInterface.tsx`: private session handoff; optional pasted text. Unsupported upload/template controls disabled.
- `src/shared/cohort-builder/intake.ts` / `src/server/infrastructure/db/postgres/cohort-intake.ts`: owner-derived deterministic workspace identity; one transaction reuses canonical source action, message, run/outbox and request receipt. Advisory creation lock; retry payload mismatch rejects; event failure rolls everything back.
- `/api/cohort-builder/intake`: same-origin, authenticated expected-owner binding, bounded body, feature/allowlist and durable driver/schema gating. Anonymous policy supports authentication handoff without authorizing mutation.
- `/quest/start`: explicit authenticated confirmation; session draft is owner-bound and expires after one hour. `/quest/build/:id` is read-only and never creates workspaces from a GET.
- `/quest/new?handoff=1` / `src/client/screens/cohortCreation/LegacyLandingHandoff.tsx`: private confirmed prompt handoff to the existing v1 writer. Old q links and draft resume retained; no v1/v2 dual writer.
- `CohortInteractionScreen.tsx` / `CohortBuilder.module.css`: fixed viewport with independently scrolling panes, one provider, mounted responsive Chat/Workspace switching, scoped local drafts, source/outline navigation and safe session teardown.
- `BuilderDialog.tsx` / `CohortWorkspacePane.tsx`: focus trap/return, full anchored evidence, explicit lesson/source/overview conflict comparison/reapplication that preserves untouched remote fields.
- `transport.ts`: failed chat acknowledgement retains original message/request identity. `assistant-queue.ts`: FIFO saved-message admission after terminal runs, five pending turn cap; host transcript lease binding.
- `/api/cohort-builder/workspaces/:id/activity` / `useAssistantActivity.ts` / `ChatPane.tsx`: bounded owned turn status; queued/running/terminal truth, assistant Stop distinct from source Stop, stale selection rejection. HTTP schedules; supervised worker executes. Cancellation is idempotent; terminal status and transcript acceptance respect leases.
- Feature names: `INTERACTION_COHORT_V2_ENABLED` defaults off; optional `INTERACTION_COHORT_V2_OWNERS`; v2 intake requires `INTERACTION_TEXT_DRIVER=durable`. Disabling intake preserves owned resume. No shared settings changed.

S4A checks: `npx vitest run --maxWorkers=2` = 188 files/1201 tests passed, 2 existing skips; `npx tsc --noEmit --pretty false` exit 0. Real separate-connection PostgreSQL gate passed atomic intake, retries/rollback, FIFO/cap, idempotent cancellation and stale transcript fences. Authenticated browser gate exit 0 (`BROWSER_JOURNEY_PASS`): landing/auth return, lost intake/chat acknowledgements, grounded refinement, evidence, pins/manual edits, reload/mobile drafts, restart/partial failure/targeted retry, reconnect, two-tab conflict/reapplication, running Stop, disabled intake with v2 resume and private v1 handoff. No paid calls. Commands/configuration: `docs/s4a-verification.md`.

Checkpoint 1 `5f0aa02`; checkpoint 2 `7d6ba14`; checkpoint 3 `7e343fe` (plus concurrent queue/UI commits below); checkpoint 4 `759b0bc`. All verified host checkpoints are pushed with planning synchronization.

`npm run verify:vercel` exit 0: submodule/public distributions, TypeScript, Prisma generation and optimized production build passed (154.1s build). Existing middleware/pdfjs warnings remain. No deployment. Test services on 3107/3108/15433/15434 stopped; synthetic fixtures retained under `.tmp`.

S4A checkpoint 3: `assistant-queue.ts` admits saved turns FIFO under the workspace lock after completion/failure/cancel; five pending turn ceiling. Canonical commits recheck run fence after locking; assistant transcript appends carry host lease fence; heartbeats cannot resurrect expired leases. HTTP schedules; supervised worker executes. Owned bounded `/api/cohort-builder/workspaces/:id/activity` exposes safe turn states; UI separates assistant Stop from source Stop, retains conflict edits and guards stale selections. Host transport retries lost message acknowledgement with original ID/key. Concurrent session committed shared queue/UI edits as `64b9d61`, `fedfeac`, `fe66977` and upgraded package pointer to `f2f78b9`; preserved and verified, no package edits by this agent. Real PostgreSQL FIFO/cap/cancel/replacement/recovery tests passed; focused shell/transport/selection tests 10 passed.

S4A checkpoint 2: one mounted provider/panes across responsive switching; native source/outline navigation, full anchored evidence details; accessible dialog focus trap/return; composer respects transcript scroll. Session loss removes workspace provider. Draft edits stay component-local, identity-keyed and do not persist outside mounted workspace. Focused workspace/shell tests 6 passed; TypeScript passed. Concurrent unrelated package edits appeared during this pass and were preserved, not committed.

S4A checkpoint 1 checks: targeted intake/canonical tests 8 passed; real PostgreSQL script passed including concurrent/lost-response intake, mismatch and event-failure rollback. Plan: `plans/interaction-builder/s4a-checkpoints.md`.

## Authoritative boundaries

- `packages/interaction-builder` remains the reusable engine, consumed through public package exports. Concurrent package work advanced the pointer from S3's `7e75a350` to `f2f78b9`; preserved and verified. This S4A implementation made no package edits.
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

## S3 baseline verification evidence

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
