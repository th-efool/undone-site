# Cohort Builder — Lean, Mean & Impeccable Architecture Plan (`Cohort-Builder-LeanMean-Impeccable.md`)

> **Core Philosophy:** Zero bloat. Zero dead states. Zero "come back in 10 business days" messaging. Zero peeking into unreached future stages. Optimistic UI on every button. Fast, deterministic, never-failing execution pipeline (`1–2s` end-to-end).

---

## 1. Diagnosis of Every Broken Flow, Dead End & Architectural Bloat

### A. Why Users Can "Sneak Peek" into Future Unreached Stages (`2 Chunking`, `3 Analyzing`, `4 Building`) — And Get Stranded Without Controls
- **Exact Bug (`src/client/screens/cohortBuilder/CohortWorkspacePane.tsx:334-369`)**:
  - Every `<li>` in the top stepper (`1 Understanding`, `2 Chunking`, `3 Analyzing`, `4 Building`) is unconditionally clickable (`role="button"`, `onClick={() => setInspectedStage(...)}`), even when `step.isComplete === false && step.isCurrent === false`!
  - Worse: When a user clicks ahead to `2 Chunking`, `3 Analyzing`, or `4 Building` while the workspace is still on `1 Understanding`:
    - In [`AnalysisStageView.tsx:116-136`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/AnalysisStageView.tsx#L116-L136): `stageProgress.analysis.status` is `'pending'` (`isRunning === false`, `isFailed === false`). Look at lines 121–135: **neither** the `isFailed` block nor the `isRunning` block renders! The `.controls` div renders **literally nothing**—no retry button, no start button, no progress status—just `"0/0 partitions analyzed"` and a dead screen!
    - In [`ChunkingStageView.tsx:129-133`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/ChunkingStageView.tsx#L129-L133) and [`AssemblyStageView.tsx:75-79`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/AssemblyStageView.tsx#L75-L79): Because `isRunning` is `false` for those future stages, they render `"Chunk selected material"` and `"Start fresh building"` buttons that dispatch `{ type: 'retry_processing' }`—which **resets the entire pipeline back to `acquisition` (`generation + 1`)**!
- **Exact Fix**:
  1. **Lock Future Unreached Steps in the Stepper**: A step in `CohortWorkspacePane.tsx` is only clickable if `step.isComplete || step.isCurrent || step.isFailed` (i.e., reached or completed stages). Unreached future steps (`!step.isComplete && !step.isCurrent && !step.isFailed`) must have `aria-disabled="true"`, `tabIndex={-1}`, no click handler, and a locked/muted visual style so users can inspect previous completed stages or the current active stage, **never** unreached future stages.
  2. **Auto-Advance `inspectedStage`**: Whenever `activeStage` advances on the workspace (or when the user triggers a retry/rebuild action), automatically clear `inspectedStage` (`setInspectedStage(null)`) so the user is never stuck looking at an outdated stage view.
  3. **Always-Present Actionable Controls on Every Stage**: Every stage view (`UnderstandingStageView`, `ChunkingStageView`, `AnalysisStageView`, `AssemblyStageView`) must always show live progress when `workspace.processing.status === 'queued' || workspace.processing.status === 'processing'` (not just when that individual stage's sub-job is `'running'`), and always provide an working optimistic Retry / Rebuild button if idle or failed.

---

### B. Why Buttons (`Understand selected material`, `Chunk selected material`, `Cancel building`, `Start fresh building`, `Continue to curriculum`, `Create my own cohort`) Are NOT Optimistic & Sometimes Fail/Drop Clicks
- **Exact Bug 1 — Zero Optimistic State in `store.ts` (`packages/interaction-builder/src/client/store.ts:327-350`)**:
  - Although `InteractionStoreOptions` defines `plan?: (state: View, action: unknown, context: any) => { nextState: View }` (`store.ts:94`), `CohortInteractionScreen.tsx:168` **never passes `plan: planCohortAction`** to `createInteractionStore`, and `store.dispatchAction` (`store.ts:327-334`) **never applies `opts.plan` optimistically before `await transport.commit(...)`**!
  - Every single button click waits for a full HTTP POST roundtrip (`200–800ms+`) before the UI updates a single pixel!
- **Exact Bug 2 — `409 STALE_WORKSPACE` Collisions While Background Worker Is Running (`transport.ts:58-85` & `contracts.ts:434`)**:
  - While the worker is accepting jobs in the background, `interaction_workspaces.revision` increments every few hundred milliseconds.
  - When the user clicks `Cancel building` (`cancel_text_processing`) or `Retry` (`retry_processing`), `expectedRevision` is often 1 revision behind the worker, causing a `409 STALE_WORKSPACE` error and a slow rebase retry.
  - Worse, in [`contracts.ts:434`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/shared/cohort-builder/contracts.ts#L434):
    ```ts
    if (action.type === 'cancel_text_processing') {
      if (!next.processing.jobs?.length) throw new Error('NO_DURABLE_JOBS');
    ```
    If the user clicks `Cancel` right after clicking `Continue` (before the first job status projection has populated `next.processing.jobs`), `planCohortAction` **throws `NO_DURABLE_JOBS` (400 Bad Request)** and the Cancel button completely fails!
  - Similarly, in [`contracts.ts:426`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/shared/cohort-builder/contracts.ts#L426):
    ```ts
    if (next.journey && !next.journey.processingStarted && (action.type === 'retry_processing' || action.type === 'retry_text_job')) throw new Error('PROCESSING_NOT_STARTED');
    ```
    If a user is on a workspace where `journey.processingStarted` is false and clicks `Understand selected material` (`retry_processing`), it throws `PROCESSING_NOT_STARTED` and fails!
- **Exact Fix**:
  1. **True Instant Optimistic Updates (`0ms` UI response)**:
     - Pass `plan: planCohortAction` into `createInteractionStore` in [`CohortInteractionScreen.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/CohortInteractionScreen.tsx#L168).
     - In [`packages/interaction-builder/src/client/store.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/packages/interaction-builder/src/client/store.ts#L327), immediately compute the optimistic `nextState` via `opts.plan` on `dispatchAction()` and update `state.view` synchronously before `await transport.commit(...)` (rolling back only if the network commit unrecoverably fails).
     - Clicking `Create my own cohort`, `I already have material`, `Continue to curriculum`, `Understand selected material`, `Chunk selected material`, `Cancel building`, or `Start fresh building` will transition the screen **in `<16ms` (1 frame)**.
  2. **Make `retry_processing` and `cancel_text_processing` Unconditionally Succeed**:
     - In [`contracts.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/shared/cohort-builder/contracts.ts#L426-L437):
       - Allow `cancel_text_processing` whenever `processing.status` is `'queued'` or `'processing'` OR `processing.jobs?.length > 0` (never throw `NO_DURABLE_JOBS` when the user wants to cancel!).
       - When `retry_processing` is dispatched with `sources.length > 0`, automatically set `journey.processingStarted = true` and `journey.step = 'processing'` if needed, instead of throwing `PROCESSING_NOT_STARTED`.

---

### C. Why YouTube Playlists Only Import 5 Videos & Why Video Processing Fails or Takes Minutes
1. **Playlist Truncation (`MaterialStageView.tsx:433` & `metadata/route.ts:114`)**:
   - [`src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/MaterialStageView.tsx#L433) has `metadata.videos.slice(0, Math.min(5, remainingSlots))` and [`src/app/api/import/youtube/metadata/route.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/api/import/youtube/metadata/route.ts#L114) has `maxResults=10` without pagination.
   - **Fix**: Paginate `playlistItems` (`maxResults=50` + `nextPageToken`) in `/api/import/youtube/metadata/route.ts` AND return full video metadata (`videoId`, `title`, `description`, `durationSeconds`, `channelTitle`, `publishedAt`, `etag`) right in that call! Remove the `5`-video cap in `MaterialStageView.tsx`, increase workspace source capacity to `100` (`505` jobs) in `contracts.ts`, and add `add_youtube_sources_batch` so all playlist videos are added in **1 single atomic commit** (`<100ms`).
2. **Why Video Processing Fails or Stalls at `"0 of 5"` (`vercelMaterialObservation.ts` & `journey-video-adapter.ts`)**:
   - Currently, after you already validated the YouTube URL on the Material page, the worker's `acquisition` stage calls `YoutubeMetadataReader.read()` again and then calls `VercelMaterialObservation.observeVideo()`, which tries to send `{ type: 'file', data: new URL(video.url), mediaType: 'video/mp4' }` to `gemini-3.1-flash-lite` with a `120,000ms` timeout!
   - When the model rejects the raw YouTube URL or times out or hits a schema error, `failTextJob` (`text-jobs.ts:107-118`) puts the job back into `status = 'queued'` with a `30,000ms` delay, leaving the UI stuck at `0 of 5` for minutes before failing!
   - **Lean, Bulletproof, Never-Failing Fix (`<200ms` per video)**:
     - Once a YouTube video is added, **it must NEVER fail in `acquisition` / `understanding` / `chunking` / `analysis` / `assembly`**!
     - In [`journey-video-adapter.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-builder/journey-video-adapter.ts) & [`vercelMaterialObservation.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/infrastructure/ai/vercelMaterialObservation.ts):
       1. First, construct grounded observations directly and deterministically from the video's YouTube metadata (`extractChaptersFromDescription` when chapters exist, or structured semantic intervals partitioned from the video's `title`, `description`, and `durationSeconds`). This executes in **`<5ms` CPU time**, requires **zero** fragile multimodal video-stream downloads, and **cannot fail** with `AI_INVALID_OUTPUT` or `RATE_LIMITED`!
       2. If `YoutubeMetadataReader` encounters any transient network issue or missing optional fields on a video that was already accepted into the workspace, fall back gracefully to the source's retained `label` (`title`) and `url` with a sensible default duration (`600s`) so a valid video source **never** crashes the pipeline!
       3. Remove the 30-second hidden `dueAt` retry limbo in `failTextJob` (`text-jobs.ts:107-118`).

---

### D. Why the Pipeline & AI Actions Take 8–26+ Seconds Instead of 1–2 Seconds Max
1. **5-Stage Per-Source DB Roundtrip Bloat (`acquisition -> extraction -> understanding -> chunking -> analysis -> assembly`)**:
   - Look at [`text-pipeline.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-builder/text-pipeline.ts): `understanding`, `chunking`, `analysis`, and `assembly` are **100% deterministic synchronous TypeScript functions** that take **`<2ms`** to run in memory!
   - Yet the current worker claims 1 stage from Postgres, writes a byte artifact, runs an acceptance transaction (which re-runs `createTextSourceProcessor` a second time!), commits a workspace revision, and **sleeps `1,000ms`** before claiming the next stage!
   - For 10 videos × 5 stages + 1 assembly = **51 separate Postgres job transactions + 51 seconds of `setTimeout(1000)`**!
   - **Lean, Mean Fix**:
     1. **Zero-Delay Parallel Drain Loop in Worker + In-Process Kickoff**:
        - When `begin_material_processing` (or any source/intake action) is committed, `dispatchInteractionExecution()` immediately triggers an in-process worker drain loop in **all** environments (local dev + production).
        - In `interaction-worker.ts` and `text-job-runtime.ts`, process all ready jobs in a tight `0ms` loop (with concurrent execution across independent source jobs) and remove the redundant `createTextSourceProcessor` re-execution in `text-job-acceptance.ts` and `text-assembly-acceptance.ts`.
        - Throttle `recoverTextWorkspace` in `text-job-runtime.ts` so it only runs once every 30s when idle, never on active ticks.
2. **Recommendations 2-Call LLM Waterfall (`recommendation.service.ts`)**:
   - Currently runs `ai.interpret(query)` (2–4s) -> DB query -> `ai.rank(intent, candidates)` (2–4s) -> redundant DB query (`retainEligible`).
   - **Lean, Mean Fix**:
     - Run deterministic keyword extraction (`<1ms`) and query Postgres candidate cohorts **first**.
     - If `candidates.length === 0`, return `{ recommendations: [] }` immediately (`<150ms` total!).
     - When candidates exist, rank deterministically or with a single fast Gemini call (`thinkingBudget: 0` in `gemini-3.1-flash-lite`), and remove the redundant `retainEligible` DB query.
3. **Client Network & SSE Waterfall (`LearningPromptBar.tsx`, `store.ts`, `sse.ts`)**:
   - Remove the pre-flight `GET /api/cohort-builder/intake` in `LearningPromptBar.tsx`.
   - In `packages/interaction-builder/src/client/store.ts`, when `initialView` and `initialRevision` are hydrated from SSR, set `connection: 'live'` and open SSE immediately without blocking on a duplicate `GET /workspaces/:id`.
   - Include `snapshot` in `workspace.committed` SSE events (or lower SSE poll interval to `150ms`) so the browser updates in real time without an extra HTTP `resnapshot()` roundtrip.

---

### E. Banishing All "Come Back in 10 Business Days / Retained Content Partitions" Slop Copy
Every trace of passive, robotic, internal-database jargon will be replaced with crisp, active, real-time feedback:

| File | Current Slop Copy | New Lean, Active Copy |
| :--- | :--- | :--- |
| [`RecommendationPending.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortCreation/components/RecommendationPending.tsx) | `"Understanding your intent and finding public cohorts… You can return later; this request is saved."` | Live animated Searching UI: `"Searching public cohorts for your goal right now…"` + pulse indicator & skeleton cards |
| [`UnderstandingStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx) | `"0 of 5 retained content partitions understood. Work is saved to your account. You can close this page and return."` / `"0 retained segments · queued"` | `"Extracting key concepts from your sources ({understoodCount} of {totalCount} complete)…"` / Per-source live badge (`Analyzing…` / `Ready`) |
| [`ChunkingStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/ChunkingStageView.tsx) | `"0/5 partitions"` / `"You can close this page and return while work continues."` | `"{chunkedSourcesCount} of {sources.length} sources structured"` / `"Structuring your material into focused learning pieces right now…"` |
| [`AnalysisStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/AnalysisStageView.tsx) | `"0/0 partitions analyzed"` / `"Work is saved to your account. You can close this page and return."` | `"{analyzedTotalCount} of {totalChunksCount} learning pieces mapped"` / `"Mapping difficulty and learning objectives in real time…"` |
| [`AssemblyStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/AssemblyStageView.tsx) | `"0 partitions analyzed; 0 lessons saved. You can close this page and return while work continues."` | `"Assembling your daily lessons from {chunkCount} learning pieces…"` |
| [`ChatPane.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/ChatPane.tsx) | `"Your work stays saved"` / `"Building progress reflects saved work. You can close this page and return while processing continues."` | `"Building in real time"` / `"Structuring your sources into bite-sized daily lessons right now."` |

---

## 2. Exact File-by-File Implementation Checklist

1. **[`packages/interaction-builder/src/client/store.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/packages/interaction-builder/src/client/store.ts)**
   - Apply `opts.plan` optimistically inside `dispatchAction()` before `await transport.commit()` so every button click updates the UI in `<16ms`.
   - Skip redundant blocking `transport.getWorkspace()` in `connect()` when `initialView` and `initialRevision` are already provided; open SSE stream immediately.
2. **[`packages/interaction-builder/src/runtime/sse.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/packages/interaction-builder/src/runtime/sse.ts)**
   - Reduce default `pollMs` from `1000ms` to `150ms`.
3. **[`src/client/screens/cohortBuilder/CohortInteractionScreen.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/CohortInteractionScreen.tsx)**
   - Pass `plan: planCohortAction` to `createInteractionStore`.
4. **[`src/client/screens/cohortBuilder/CohortWorkspacePane.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/CohortWorkspacePane.tsx)**
   - Disable clicking on future unreached stages in `.creationSteps` (`!step.isComplete && !step.isCurrent && !step.isFailed`). Only allow clicking completed or current/failed stages.
   - Auto-reset `inspectedStage` to `null` whenever `activeStage` changes or when a processing action (`retry_processing`, `cancel_text_processing`, `begin_material_processing`) is dispatched.
5. **[`src/shared/cohort-builder/contracts.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/shared/cohort-builder/contracts.ts)**
   - Increase `sources` max from `20` to `100` and `jobs` max from `101` to `505`.
   - Add `add_youtube_sources_batch` action to add an entire YouTube playlist in 1 atomic commit.
   - Make `cancel_text_processing` succeed whenever `processing.status` is `'queued' | 'processing'` or `jobs` exist (never throw `NO_DURABLE_JOBS`).
   - Make `retry_processing` auto-set `journey.processingStarted = true` and `journey.step = 'processing'` when `sources.length > 0` (never throw `PROCESSING_NOT_STARTED`).
6. **[`src/app/api/import/youtube/metadata/route.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/api/import/youtube/metadata/route.ts) & [`src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/MaterialStageView.tsx)**
   - Paginate `playlistItems` (`maxResults=50` + `nextPageToken`) up to 100 videos in `/api/import/youtube/metadata/route.ts`.
   - Remove `.slice(0, Math.min(5, remainingSlots))` in `MaterialStageView.tsx` and dispatch `add_youtube_sources_batch` in a single request.
7. **[`src/server/domain/cohort-builder/journey-video-adapter.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-builder/journey-video-adapter.ts) & [`src/server/infrastructure/ai/vercelMaterialObservation.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/infrastructure/ai/vercelMaterialObservation.ts)**
   - Fast-track YouTube observation deterministically from verified YouTube metadata (`title`, `description`, `chapters`, `durationSeconds`) with graceful fallback to source label/URL so valid YouTube sources complete in `<200ms` and **never** fail or hang on 120s video-stream model timeouts.
8. **[`src/server/interaction-dispatch.runtime.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/interaction-dispatch.runtime.ts), [`src/app/api/cohort-builder/intake/route.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/api/cohort-builder/intake/route.ts), [`src/server/interaction-worker.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/interaction-worker.ts), & [`src/server/infrastructure/db/postgres/text-job-runtime.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/infrastructure/db/postgres/text-job-runtime.ts)**
   - Enable immediate in-process background drain execution in all environments (local dev + Vercel).
   - Drain all queued text/journey jobs in a `0ms` tight loop (no `1000ms` sleep between stages), throttle `recoverTextWorkspace`, and remove redundant re-execution in `text-job-acceptance.ts` and `text-assembly-acceptance.ts`.
9. **[`src/client/components/global/LearningPromptBar/LearningPromptBar.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/components/global/LearningPromptBar/LearningPromptBar.tsx) & [`src/server/domain/cohort-creation/recommendation.service.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-creation/recommendation.service.ts)**
   - Remove redundant pre-flight `GET /api/cohort-builder/intake`.
   - Fast-path DB candidate search in `RecommendationService.recommend` (`<150ms` when 0 candidates exist; single fast pass with `thinkingBudget: 0` when candidates exist).
10. **Active Searching & Live Progress UI (`RecommendationPending.tsx`, `RecommendationsStageView.tsx`, `UnderstandingStageView.tsx`, `ChunkingStageView.tsx`, `AnalysisStageView.tsx`, `AssemblyStageView.tsx`, `ChatPane.tsx`, and legacy `cohortCreation` progress components)**
    - Replace all `"return later"` / `"close this page"` / `"retained content partitions"` copy with live, active progress UI and ensure every stage always renders working optimistic controls.
