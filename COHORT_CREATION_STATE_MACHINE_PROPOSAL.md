# Cohort creation: state-machine architecture proposal

Status: architecture proposal, not an implementation handoff or deployed fix.
Audit baseline: eeb7077aab471fc237b1043cd1f8807c15926eba, 2026-11-01. Root: D:/ThisPC/Documents/SideQuestHQ/undone-site. No application code changed. Existing unfinished material-intake handoff is not approved by this proposal; its payloads require revision against this architecture before execution.

## 1. Recommendation

Use one server-authoritative, typed domain state machine for cohort creation, with small independent regions for discovery, building and release. Keep navigation as a separate client concern. All buttons, chat tools and workers go through the same guarded transitions. Compute readiness, allowed actions and progress from the same accepted state.

Use a pure TypeScript transition function, existing Zod boundary schemas, existing transaction/command receipts and existing durable workers. Do not introduce a second orchestration platform, global event bus, microservices, event sourcing rewrite or a second database. A state-machine library is optional tooling, not the source of the guarantees. For this repository, start without a new runtime dependency; exhaustive discriminated unions and a transition table are sufficient.

This cannot make providers, networks or disks infallible. The enforceable promise is: failures do not masquerade as success; stale work does not become current; retries do not duplicate committed effects; saved work remains recoverable. Compile-time types catch invalid program structure; runtime guards validate persisted data and external results; transactions protect concurrent transitions; tests demonstrate the combinations.

## 2. Evidence-backed diagnosis

### A. Navigation and completion have separate authorities

`src/client/screens/cohortBuilder/stage-selectors.ts#computeActiveStage` returns ready when journey.step is ready, without first establishing processing readiness. `stages/ReadyStageView.tsx` separately computes ready from processing.status and lesson count. Its success heading is unconditional. `CohortWorkspacePane.tsx#getProcessingProgress` separately interprets job states, source states and processing status.

Consequence: the screen, checklist and buttons can disagree without a type error. This is sufficient to explain how the contradictory UI is possible, but does not prove which production write produced the screenshot.

### B. Two paths write completion with different evidence

`src/shared/cohort-builder/contracts.ts` can invoke `client-pipeline.ts#runDeterministicPipeline` directly for sources with retained text and locations. That function writes processing ready/done, increments generation and writes journey ready. It replaces the processing object without a jobs projection.

`src/server/domain/cohort-builder/text-assembly-acceptance.ts` uses durable job identity, source evidence, dependency fingerprint, artifact validation and transaction locks before projecting completion.

A fast path is valuable. Separate definitions of accepted completion are not. Both paths must produce the same validated build result and commit through one acceptance boundary; they need not take the same amount of time or create artificial jobs.

### C. Recovery is gated by success

ReadyStageView's shared act wrapper returns when !ready, including for Back. The Back button itself is not disabled by !ready. It also dispatches back_to_starting_point instead of opening material collection. Go to my feed prepares release and opens review without checking the first boolean result. These are concrete action/state inconsistencies.

### D. Tool availability is coupled to visual stage

`src/server/domain/cohort-builder/tools.ts` exposes start_search (community cohorts) in chat but omits start_discovery there. Other stages expose both. Context instructions ask the model to distinguish resource search from community search, but the resource tool is unavailable in that chat tool set.

This is a structural routing hazard consistent with the supplied conversation, not a verified reconstruction of its actual tool journal. Capabilities should depend on domain facts and permissions, not whether a particular screen is open.

### E. Shape validation is weaker than business validity

`contracts.ts` independently stores journey.step, processing.status/stage, source states, optional fingerprint, lessons and release state. Strict Zod objects reject unknown fields, but their existence does not prove cross-field invariants such as current assembly matching current sources. A nonempty lesson list can be a draft, not a completed build.

### F. Shortcuts have semantic consequences too

`client-pipeline.ts` currently derives analyses from text prefixes and a templated question. Successful deterministic processing does not by itself prove rich instructional analysis. Build quality requirements must explicitly distinguish metadata-only evidence, real transcripts, observed video content and authored material. Do not label metadata-derived output as full-video understanding. State-machine correctness and educational quality are separate acceptance dimensions.

### G. Existing strengths to retain

Keep revision-checked commands and stable tool request IDs, serialized tool commits, durable job leases, source version checks, assembly artifact validation, release content hashes/effect receipts and SSE revision handling. These are useful foundations already present. Audit their integration; do not replace them simply to obtain a cleaner diagram.

## 3. The proposed model

The workspace has content plus independent lifecycle regions. Avoid one giant enumeration containing every combination of search, chat, editor and build state.

| Region | States | Authority |
|---|---|---|
| Draft content | Intent, source references, authored curriculum edits, content revision | Accepted domain commands |
| Discovery | idle / searching / results / failed / canceled | Discovery request and verified result |
| Build | idle / running / failed / canceled / completed | Build request and accepted result |
| Release | idle / committing / failed / committed | Frozen candidate and durable release receipt |
| View | plan / materials / processing details / review | Client route/view selection; never proof of completion |
| Chat turn | existing queued / running / finished / failed lifecycle | Existing interaction runtime |

No separate persisted ready boolean or success-screen state. `canActivate`, `canReviewCurrentBuild`, `needsRebuild`, progress and success copy are derived from validated domain state. Distinguish reviewing a draft curriculum from reviewing a completed build so manual co-design remains available.

Build states are a discriminated union. A completed member requires a build ID, immutable accepted output reference and input fingerprint; running requires a request ID and captured inputs; failure requires a safe error code and retry classification. A released member requires its durable receipt. Fields required for one state cannot be optional decorations shared with every other state.

Do not force editing, resource search and chat to stop while processing. Capture build inputs at StartBuild; subsequent edits make that output outdated. Either continue the old job for cache reuse or explicitly cancel it according to cost policy, but never silently attach it as current.

### Fingerprints and revision meanings

- Workspace revision: concurrency order, including changes unrelated to build inputs.
- Source version: semantic revision of a source and its extraction/provenance.
- Build input fingerprint: canonical manifest of source IDs/versions/evidence checksums, intent, audience, pace and algorithm versions actually used by build stages.
- Release content hash: exact reviewed publishable output including presentation and authored overrides.

Do not use workspace revision alone as freshness: a chat or cosmetic edit should not force extraction. Do not use sourceFingerprint alone as whole-build freshness: it currently hashes source id/version/text, not all pedagogical inputs. Maintain stage-specific fingerprints to reuse acquisition/chunking when only audience or pace changes.

A completed build may remain stored while stale. The UI says Changes need rebuilding and can inspect the previous version clearly labelled. It cannot activate that version as though it included new changes.

## 4. One command boundary

Every mutation follows:

1. Decode and validate command envelope; authenticate owner.
2. Load current state under existing revision/transaction protection.
3. Run the authoritative capability/transition guard using current state.
4. Produce next domain state and durable work intents, with no network call inside the reducer.
5. Commit state, command receipt and work intents atomically using the existing repository mechanisms.
6. Workers execute external effects outside the transaction and submit validated completion commands.
7. Stream accepted revision/state to clients. Clients reconcile by revision; they do not create authoritative completion locally.

The UI may predict available actions for responsiveness using the same pure guard; the server always rechecks. A capability computed on an old snapshot is not authorization.

Use a structured command result: accepted with receipt/revision; rejected with a stable reason and recovery action; unknown delivery outcome with request ID for reconciliation. Replace ambiguous Promise<boolean> at workflow boundaries incrementally. A timeout after server commit must resolve the existing command ID, not blindly create a new request. Do not roll back unrelated edits or confirmed server effects.

Batch operations that users perceive as atomic, such as saving build settings and starting that exact build, should be one command. This removes client chains that proceed after a failed save. Keep ordinary content edits small. Multi-lesson drafting should either commit the validated draft atomically within existing payload limits or explicitly report accepted partial results; never claim the full draft exists after a partial loop.

## 5. Transition rules

| Command/event | Required evidence | Accepted effect | Failure behavior |
|---|---|---|---|
| AddSourceReference | Valid supported reference; ownership; capacity | Save source identity and metadata | Preserve input; no phantom preview |
| DiscoverResources | Saved nonempty goal and request identity | Capture discovery inputs and enqueue | Preserve goal; retry same request after unknown outcome |
| AcceptDiscoveryResult | Request ID/input fingerprint match | Retain candidates | Superseded result cannot replace newer results |
| SelectResources | Verified current result and candidate membership | Add selected typed references atomically | No partial insertion on rejected selection |
| StartBuild | Valid selected inputs and explicit user intent | Capture immutable input manifest and schedule | Show specific missing input; keep draft |
| AcceptStageResult | Job lease, source version, dependency hash, validated artifact | Accept reusable artifact | Discard stale result; preserve current state |
| CompleteBuild | All required current artifacts plus valid curriculum/evidence | Create accepted output and completed state | Remain failed/running honestly; no success view |
| EditInputs | Valid edit against expected versions | Persist edit; derive staleness/dependent work | Preserve user draft on conflict |
| CancelBuild | Matching active build | Cancel/fence further acceptance | Late completion cannot resurrect canceled build |
| RetryBuild | Classified retryable failure | Retry failed dependency closure; reuse accepted artifacts | Never blindly redo paid work |
| Activate / Publish | Reviewed current output; explicit mode; expected content hash | Freeze candidate and commit existing release effect | Retry/reconcile receipt; do not duplicate cohort |
| OpenMaterials | View access only | Change view | Never require build success |

StartBuild is not permission to publish. Background processing never chooses a navigation destination. Inspecting an earlier stage never mutates processing. Completion may present an available Review action; if the user is editing materials, preserve that view and show a completion notification rather than hijacking it.

Fast builds may complete immediately. Show all genuinely completed stages, without artificial timers. Slow builds show accepted progress. An empty/failed job projection must never imply completion.

## 6. Modules and ownership

Refactor within existing folders rather than introduce a parallel framework:

- `src/shared/cohort-builder/creation-state.ts`: domain unions and runtime invariant validation, schema version compatibility decoder.
- `src/shared/cohort-builder/creation-machine.ts`: pure guarded transitions and capability rules. This owns lifecycle decisions, not source adapters or UI markup.
- `src/shared/cohort-builder/creation-view.ts`: one view model for progress, current/stale output, action availability and safe explanations.
- Existing source adapters/extractors: produce typed candidates/evidence, never mark whole build complete.
- Existing server command/repository layer: ownership, transaction, request identity and work intents.
- Existing job planner/workers: schedule/execute and submit validated results. Fast local computation is an execution strategy behind this boundary.
- Existing release service: effect reconciliation and receipt. The client navigates using confirmed receipt.destinationUrl only.
- Existing screens: render the view model, hold unsaved fields, dispatch commands. No independent readiness rules.
- Chat tools: thin named adapters to the same commands. Community search and material discovery have distinct names and capabilities.

Split content editing handlers away from lifecycle rules as needed, but do not turn every action into a class/service. Keep the machine small; heavy content arrays and binary artifacts stay in their existing stores. A state diagram is documentation generated or checked against the transition table, not another manually maintained authority.

## 7. AI as an untrusted command client

AI may propose content and invoke allowed commands. It cannot write lifecycle state, declare a job accepted, forge evidence or navigate as a side effect of adding a lesson. Distinguish draft curriculum from built content.

Expose commands based on actual domain capabilities. Rename model-facing tools to unambiguous names such as search_community_cohorts and discover_learning_resources. Keep old wire aliases during migration if needed. In Plan mode, enforce the allowed command set on the server, not only in prompt text. Explicit user creation intent grants the appropriate session scope; do not repeatedly ask for the same approval. Activation/publication remains separately explicit.

Use committed receipts for deterministic status displays: Search started, 3 sources added, Build finished. Natural-language prose can summarize, but cannot be the source of a success badge. Model output quality still needs evaluation; a tool schema cannot eliminate every misleading sentence.

## 8. Failure behavior and observability

Expected failure is a state with a recovery path, not a page takeover. Preserve fields, accepted materials and valid output. Show the existing top-right toast for the action failure; retain contextual retry/status where the user needs it. No full reload to approximate rollback.

Use the existing logger and diagnostics. Correlate workspaceId, commandId, buildId, inputFingerprint, jobId, attempt, fromState, toState, revision, rejectionCode and duration. Server logs retain private details under existing access controls; browser diagnostics receive sanitized codes and owned operation summaries. Never log raw source text or secrets for convenience.

Measure queue wait, provider duration, extraction duration, time to first useful chat content, time to accepted build, reconnect lag, stale-result rejection and duplicate request recovery separately. This distinguishes slow computation from stale UI. Add a diagnostic invariant check that detects contradictory snapshots and offers safe recovery instead of rendering All set. Detection does not silently rewrite old data.

“Anti-fragile” here means each real incident becomes a minimized replay fixture plus an invariant test, so the same class of failure gets harder to reintroduce. It does not mean production failures automatically improve the product without engineering work.

## 9. Validation strategy

Current audit ran:
`npx vitest run src/client/screens/cohortBuilder/__tests__/stage-selectors.test.ts src/client/screens/cohortBuilder/__tests__/stage-canonical-progress.test.ts src/shared/cohort-builder/__tests__/client-pipeline.test.ts`
Result: 3 files, 67 tests passed. This verifies the existing tested behaviors, not the new architecture or the incident fix. Production state/logs were not inspected this turn.

Required new tests are architectural, not screenshots alone:

1. Transition matrix: every command in every lifecycle state either transitions correctly or rejects with no mutation.
2. Sequence tests with reproducible seeds: edit, start, cancel, retry, back, change source, reload and complete in varied order; assert invariants after every accepted transition.
3. Stale worker result, revoked lease, duplicate completion, late completion after cancel, and result from older source version.
4. Two tabs editing; duplicate clicks; request committed but response lost; stream reconnect/out-of-order revision.
5. Fast and durable strategies both satisfy the accepted-output contract; progress and readiness agree. Compare semantically equivalent outputs where algorithms are equal, not arbitrary provider text byte-for-byte.
6. Plan-mode command boundaries and resource/community tool separation.
7. Release crash before/after effect commit; retry resolves exactly one receipt and destination.
8. Browser tests for disabled-action reasons, Back during failed build, preserved unsaved edits, preview ordering and real mobile scrolling.
9. Historical snapshot migration fixtures, including ready-with-incomplete-processing. Ambiguous legacy state becomes recoverable needs-verification, never fabricated completion.
10. Educational quality checks for evidence coverage, unsupported claims, curriculum usefulness and metadata-only limitations. Passing lifecycle tests does not replace these.

Prefer the existing test runner and deterministic seeded sequences first. Add property-testing tooling only if it materially simplifies the matrix. A failing invariant blocks merge. Do not weaken fixtures merely to make the new model pass.

## 10. Incremental migration and gates

### Phase 1: Record invariants and reproduce incidents
Freeze the scope to creation. Capture current fixture shapes, source/version chains, ready-screen incident, tool availability and release behavior. Document which existing contracts are authoritative. Add the contradictory-state tests before moving code. Gate: each reported incident has a failing/reproducible test or is explicitly marked unconfirmed.

### Phase 2: One readiness/view projection
Introduce pure validation and capabilities over existing snapshots. Make stepper, ReadyStageView, Continue/Back/Review and chat status consume it. Guard navigation separately from processing. Initially read existing fields through a compatibility adapter; do not add another writable ready flag. Gate: cross-component consistency and recovery tests pass.

### Phase 3: One command/acceptance path
Route direct UI commands and AI tools through the shared guards. Normalize fast and durable results to the same acceptance contract. Introduce structured receipts at workflow boundaries and atomic StartBuild settings capture. Gate: duplicate/stale/unknown-outcome tests pass; old lifecycle writers are removed from active paths.

### Phase 4: Persist explicit lifecycle state
Add a versioned decoder and idempotent migration. Map provable legacy results to completed; leave ambiguous results recoverable. Retain old published output and receipts. Stop old writers for migrated workspaces; do not maintain indefinitely competing v1/v2 writes. Gate: historical fixtures, revision conflicts and rollback compatibility verified.

### Phase 5: Simplify UI and remove compatibility debt
Implement the requested two-option entry, compact material previews, link default and sticky Continue against new commands. Delete replaced selectors/progress predicates and dead branch UI after caller verification. Keep historical data readers until migration coverage is demonstrated. Gate: full desktop/mobile flow plus pipeline/release integration and build/type checks pass.

Roll out to controlled test workspaces first. Shadow-compute read-only decisions to compare against old selectors where useful; never dual-run effects. Then enable for a limited cohort. Rollback must not feed v2 snapshots into a v1-only writer: pause affected mutations or use a tested compatibility decoder. Keep successful releases available throughout.

## 11. Lean-code guardrails and decision

Accept the architecture only if it reduces decision duplication. Track number of writable lifecycle authorities (target one), readiness predicates (target one shared domain rule), separate progress derivations (target one), action implementations per entry method (target one), and production code added/deleted. Count adapters and temporary compatibility code separately, with removal gates.

Do not promise net line reduction before implementing migration. Temporary additions are acceptable only when they replace named existing logic. Do not create a state-machine wrapper while retaining all old switches underneath. Do not build a universal workflow engine for unrelated Feed/Notes/Messaging.

Recommended decision: adopt this bounded state-machine refactor. Preserve reliable infrastructure; replace competing lifecycle decisions. The deliverable following approval would be an execution-ready migration handoff with exact schema, reducer, adapter, caller and test payloads. This proposal supplies the architecture and acceptance gates, not those unimplemented payloads.
