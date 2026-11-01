# Cohort Builder & AI Interaction — Complete Root Cause Diagnosis & Fix Plan (`Cohort-Builder-fix.md`)

---

## PART A: Previous Findings — Cohort Creation, Recommendations & `interaction-builder` Speed Overhaul (1–2s Target)

### A1. Why Cohort Creation & Recommendations Take 8–15+ Seconds (Or Hang)

1. **Redundant Pre-flight HTTP Call on Prompt Submit (`+150–400ms`)**
   - [`src/client/components/global/LearningPromptBar/LearningPromptBar.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/components/global/LearningPromptBar/LearningPromptBar.tsx#L355-L386) makes a blocking `GET /api/cohort-builder/intake` before `POST /api/cohort-builder/intake` even starts, just to check `{ ownerId, enabled }` which `POST` already validates.
2. **In-Process Execution Kickoff Is Disabled Outside Vercel (`+1,000ms to ∞`)**
   - [`src/server/interaction-dispatch.runtime.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/interaction-dispatch.runtime.ts#L9-L10) immediately exits with `if (process.env.VERCEL !== '1' || process.env.INTERACTION_TEXT_DRIVER !== 'durable') return;`.
   - Neither [`POST /api/cohort-builder/intake`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/api/cohort-builder/intake/route.ts#L59-L80) nor [`handleInteractionRequest`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/interaction.runtime.ts#L101) kicks off an immediate in-process worker tick in local/standard server environments. Everything sits idle waiting for an external polling process.
3. **Worker Unconditionally Sleeps `1000ms` After Every Single Job + Runs 20-Workspace Recovery Sweeps (`+1,000–5,000ms+`)**
   - [`src/server/interaction-worker.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/interaction-worker.ts#L86-L119) claims **1 job**, and even when more jobs are immediately ready in the queue, hits `await new Promise((r) => setTimeout(r, pollIntervalMs))` (`1000ms`).
   - Worse, [`src/server/infrastructure/db/postgres/text-job-runtime.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/infrastructure/db/postgres/text-job-runtime.ts#L58-L61) queries up to 20 workspaces (`SELECT "id" FROM "interaction_workspaces" ...`) and runs `recoverTextWorkspace` in a loop **before every single job claim**.
4. **Two Serial Blocking LLM Calls + Redundant DB Queries for Recommendations (`+3,500–8,000ms`)**
   - [`src/server/domain/cohort-creation/recommendation.service.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-creation/recommendation.service.ts#L17-L84) runs:
     1. `ai.interpret(query)` (LLM Call #1: ~1.5–4s) **before** even checking if any public cohorts exist in Postgres!
     2. `repository.findCandidates(intent)` in [`src/server/infrastructure/db/postgres/creationRecommendation.repo.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/infrastructure/db/postgres/creationRecommendation.repo.ts#L28-L55).
     3. `ai.rank(intent, candidates)` (LLM Call #2: another ~1.5–4s).
     4. `repository.retainEligible()` (re-queries the exact same cohort IDs from Postgres a second time).
5. **`interaction-builder` Client Store + SSE + Resnapshot Waterfall (`+1,200–2,500ms`)**
   - **SSR Hydrate Ignored on Connect**: [`src/app/(creation)/quest/build/[workspaceId]/page.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/(creation)/quest/build/[workspaceId]/page.tsx#L28-L41) already passes `initialView={ws.snapshot}` and `initialRevision={ws.revision}` from SSR. Yet [`packages/interaction-builder/src/client/store.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/packages/interaction-builder/src/client/store.ts#L298-L320) still blocks on `await transport.getWorkspace()` before opening the SSE stream!
   - **Slow SSE Poll + Missing Snapshot Payload**: [`packages/interaction-builder/src/runtime/sse.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/packages/interaction-builder/src/runtime/sse.ts#L31) polls Postgres every `1000ms`. When `workspace.committed` arrives, it only includes `{ receipt, revision }` (no `view`), forcing [`store.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/packages/interaction-builder/src/client/store.ts#L262-L268) to fire an extra HTTP `GET /api/interaction/v1/workspaces/:id` (`resnapshot()`) roundtrip!
   - **9 Sequential DB Queries Before Chat AI Call + All 25 Tools Sent Every Turn**:
     - [`src/server/interaction-worker.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/interaction-worker.ts#L136-L160) + [`packages/interaction-builder/src/runtime/runner.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/packages/interaction-builder/src/runtime/runner.ts#L92-L125) load the workspace twice and list messages three times before calling `model.executeTurn()`.
     - [`src/server/domain/cohort-builder/tools.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-builder/tools.ts#L121-L580) sends all 25 tool schemas on every turn regardless of stage.

---

## PART B: The 3 New Hidden Problems (Playlist Truncation, "0 of 5 Retained Content Partitions", and Slow/Stuck Video Processing)

### Problem 1: Why Pasting a YouTube Playlist Only Imports the First 5 Videos Instead of All Videos

**Exact Root Cause (Hardcoded Caps in 4 Places!):**
1. **Hardcoded `.slice(0, Math.min(5, remainingSlots))` in `MaterialStageView.tsx`**:
   - Look at [`src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/MaterialStageView.tsx#L430-L435):
     ```ts
     if (metadata?.isPlaylist && metadata.videos && metadata.videos.length > 0) {
       // For playlists, add videos from the playlist (up to remaining capacity, max 5)
       const remainingSlots = Math.max(1, 20 - (workspace.sources?.length ?? 0));
       const videosToAdd = metadata.videos.slice(0, Math.min(5, remainingSlots));
     ```
   - Someone literally hardcoded `Math.min(5, remainingSlots)` in the client handler, silently dropping every video after the 5th one!
2. **Hardcoded `maxResults=10` with ZERO Pagination in `/api/import/youtube/metadata`**:
   - Look at [`src/app/api/import/youtube/metadata/route.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/api/import/youtube/metadata/route.ts#L114):
     ```ts
     const itemsRes = await fetch(`${YT_BASE}/playlistItems?part=snippet&maxResults=10&playlistId=${playlistId}&key=${apiKey}`);
     ```
   - The metadata API route only requests `maxResults=10` and **never paginates** `nextPageToken` (unlike `youtube-import.service.ts` and `YoutubeMetadataReader` which fetch `maxResults=50` per page across all pages).
3. **Sequential `for (const v of videosToAdd) await dispatchAction(...)` Loop**:
   - In [`MaterialStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/MaterialStageView.tsx#L435-L444), each video in the playlist is dispatched as a separate sequential HTTP POST action (`add_youtube_source` 1 by 1), causing `N` serial DB transactions and `N` workspace revisions instead of a single batch `add_youtube_sources` action (or importing all playlist videos in one atomic commit).
4. **Workspace Source & Job Cap (`max(20)` sources / `max(101)` jobs in `contracts.ts`)**:
   - [`src/shared/cohort-builder/contracts.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/shared/cohort-builder/contracts.ts#L188-L198) caps `sources` at `.max(20)` and `jobs` at `.max(101)` (since 20 sources × 5 stages + 1 assembly = 101 jobs). If a playlist has up to 50–100 videos, `sources` and `jobs` limits must scale to support full playlists (e.g. up to 100 sources and 505 jobs, plus a batch `add_youtube_sources` action so adding a playlist takes **1 HTTP request** instead of 50 sequential requests).

---

### Problem 2 & Problem 3: Why It Says `"0 of 5 retained content partitions understood. Work is saved to your account. You can close this page and return."` AND Why It Takes Forever / Stalls at `0 of 5`

**Why It Takes Forever & Gets Stuck at `0 of 5` (6 Compounding Server Bugs):**
1. **MaterialStageView Lies That Sources Are `"Ready"` Before They Are Even Acquired**:
   - Look at [`src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/MaterialStageView.tsx#L80-L85) and [`SourceItemRow`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/MaterialStageView.tsx#L246-L252):
     - In `planCohortAction` (`contracts.ts:470-472`), when you add a YouTube URL during `material_input`, `journey.processingStarted` is `false`! So **ZERO background acquisition jobs are started while you are on the Material page**!
     - Yet `SourceItemRow` renders a green checkmark `Ready` (`isFailed ? 'Needs attention' : 'Ready'`) even when `source.state === 'queued'` and `0` segments have been fetched!
     - **Fix**: Start pre-acquiring/extracting sources immediately when added on the Material page, AND show real status (`Queued` / `Extracting...` / `Ready`).
2. **`acquisition` Calls `generateText` with Native Video Multimodal Processing on Gemini (`30–120s` per Video!) Instead of Fast YouTube Metadata + Description/Chapters/Captions (`<1s`)**:
   - Look at [`src/server/infrastructure/ai/vercelMaterialObservation.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/infrastructure/ai/vercelMaterialObservation.ts#L68-L119):
     - For every single YouTube video under 90 minutes (`durationSeconds <= 5400`), `VercelMaterialObservation.observeVideo` sends `{ type: 'file', data: new URL(video.url), mediaType: 'video/mp4' }` to Gemini with `maxOutputTokens: 12_000` and a `120_000ms` (2-minute!) timeout!
     - Having Gemini download and watch an entire YouTube video stream takes **30 to 90+ seconds per video** (or fails with model/token/URL errors and sleeps `3,000ms` before retrying, and then `failTextJob` in `text-jobs.ts:109` schedules a `30,000ms`–`120,000ms` retry backoff!).
     - Even worse: `DEFAULT_COHORT_MODEL` in [`src/server/infrastructure/ai/modelRegistry.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/infrastructure/ai/modelRegistry.ts#L6) is set to `'gemini-3.1-flash-lite'`, which may not even support native YouTube video stream ingestion or fails validation, triggering retries and 30-second backoff delays!
     - **Fast-Path Solution (`<1s` per video / parallelized)**:
       - `YoutubeMetadataReader` (`youtube-metadata.ts`) ALREADY fetches the video's full `title`, `description`, `channelTitle`, and `durationSeconds` from the YouTube Data API v3 in `~150ms`!
       - If the video description has chapters (`extractChaptersFromDescription`), or rich description/title metadata, or captions, we can construct structured, grounded observations **instantly** (deterministic fast-path from YouTube Data API snippet/chapters/description or a fast text-only prompt with `thinkingBudget: 0` in `<800ms`), instead of forcing a 60-second multimodal video-stream download per video!
3. **Worker Processes Only 1 Job at a Time Serially + Sleeps `1000ms` Between Every Job**:
   - For 5 videos × 5 stages (`acquisition`, `extraction`, `understanding`, `chunking`, `analysis`) + 1 `assembly` = **26 jobs**.
   - Because [`src/server/interaction-worker.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/interaction-worker.ts#L86-L119) runs 1 job per tick and sleeps `1,000ms` after each job, just the `setTimeout(1000)` sleep alone adds **26 seconds of dead waiting**, plus running 5 video acquisitions serially instead of concurrently!
4. **Why `UnderstandingStageView` Shows `"0 retained segments · queued"` and `"0 of 5 retained content partitions understood"` the Whole Time**:
   - Look at [`src/client/screens/cohortBuilder/stage-selectors.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stage-selectors.ts#L443-L456):
     - `UnderstandingStageView` is shown during `acquisition`, `extraction`, AND `understanding`.
     - While `acquisition` and `extraction` are running (or stuck retrying), `understoodCount` is `0`, `source.locations` is undefined (`0 retained segments`), and `source.state` is `'queued'` or `'processing'`.
     - And if `acquisition` hits a transient failure (`AI_UNAVAILABLE` / `RATE_LIMITED` / `VIDEO_OBSERVATION_DEADLINE`), [`failTextJob`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-builder/text-jobs.ts#L107-L118) sets `status = 'queued'` with `dueAt = now + 30_000ms`! Because `status` is set back to `'queued'` (not `'failed'`), the UI hides the error and just sits at `"0 retained segments · queued"` and `"0 of 5 retained content partitions understood"` for minutes until all 5 retries exhaust!
5. **Robotic, Infuriating Internal Jargon & "Close This Page and Return" Copy**:
   - Look at the copy in [`UnderstandingStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx):
     - `"0 of 5 retained content partitions understood."`
     - `"Work is saved to your account. You can close this page and return."`
     - `"0 retained segments · queued"`
     - `"Concepts appear after a retained content partition is understood."`
     - `"Reading retained material. Concepts will appear after it is understood."`
     - `"Entries retain source evidence; repeated ideas may appear across partitions."`
   - And in [`ChatPane.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/ChatPane.tsx#L164,L184):
     - `"Your work stays saved"` / `"Building progress reflects saved work. You can close this page and return while processing continues."`
   - And in [`ChunkingStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/ChunkingStageView.tsx#L101,L114), [`AnalysisStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/AnalysisStageView.tsx#L113,L130), and [`AssemblyStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/AssemblyStageView.tsx#L53-L55):
     - All repeat `"retained content partitions"` and `"You can close this page and return while work continues."`

---

## PART C: Comprehensive Execution Plan

### Phase 1: Fix YouTube Playlist Import (Fetch ALL Videos + Batch Add in 1 Request)
1. **[`src/app/api/import/youtube/metadata/route.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/api/import/youtube/metadata/route.ts)**:
   - Change `maxResults=10` to `maxResults=50` and paginate `nextPageToken` (up to 100 videos) so the metadata endpoint returns **all** videos in the playlist, plus their descriptions and durations.
2. **[`src/shared/cohort-builder/contracts.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/shared/cohort-builder/contracts.ts)**:
   - Increase `sources` limit from `.max(20)` to `.max(100)` and `jobs` view limit from `.max(101)` to `.max(505)`.
   - Add a `add_youtube_sources_batch` action (or allow `add_youtube_source` / batch addition) so adding a 20–50 video playlist commits in **one single atomic action** (~100ms) instead of 20–50 sequential HTTP roundtrips!
3. **[`src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/MaterialStageView.tsx)**:
   - Remove the `Math.min(5, remainingSlots)` cap on line 433! Import **all** playlist videos up to the workspace capacity (`100` sources) in a single batch dispatch.

### Phase 2: Make Source Processing & Understanding Instant (`<1–2s` Instead of Minutes)
1. **Fast-Path YouTube Video Observation (`src/server/domain/cohort-builder/journey-video-adapter.ts` & `src/server/infrastructure/ai/vercelMaterialObservation.ts`)**:
   - In `VercelMaterialObservation.observeVideo`:
     - First, if description chapters exist (`descChapters.length >= 2`), use them immediately (`0ms` LLM wait!) regardless of whether the video is over 5400s!
     - Second, when chapters aren't explicitly timestamped in the description, construct grounded structured intervals from the YouTube Data API v3 metadata (`title`, `description`, `channelTitle`, `durationSeconds`)—or use a fast text-based structured call with `thinkingBudget: 0` (`~400ms`)—instead of passing the raw `video/mp4` URL for Gemini to stream-watch for 90 seconds!
     - Never silently hide failures behind a 30-second `dueAt` delay when a fast fallback from verified YouTube metadata can complete the observation immediately.
2. **Parallel Source Pipeline + Zero-Delay Drain Loop (`src/server/interaction-worker.ts` & `src/server/infrastructure/db/postgres/text-job-runtime.ts`)**:
   - Remove the `1000ms` sleep between jobs in `interaction-worker.ts`; drain all ready jobs in a tight `0ms` loop and run up to 4 concurrent source jobs in parallel!
   - Collapse or fast-track `acquisition -> extraction -> understanding -> chunking -> analysis -> assembly` so deterministic stages (`extraction`, `understanding`, `chunking`, `analysis`, `assembly`) execute back-to-back in `<100ms` total without redundant re-execution in `text-job-acceptance.ts` and `text-assembly-acceptance.ts`.
   - Trigger in-process execution immediately on `begin_material_processing` / `POST /api/interaction/v1/...` via `dispatchInteractionExecution()` in all environments (local dev + production).

### Phase 3: Sub-Second Intake, Fast Recommendations & Real-Time `interaction-builder` SSE
1. **[`src/client/components/global/LearningPromptBar/LearningPromptBar.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/components/global/LearningPromptBar/LearningPromptBar.tsx)**:
   - Eliminate the redundant pre-flight `GET /api/cohort-builder/intake` before `POST`.
2. **[`src/server/domain/cohort-creation/recommendation.service.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-creation/recommendation.service.ts)**:
   - Query candidate cohorts from Postgres first using fast keyword extraction; if `0` candidates exist, return `{ recommendations: [] }` immediately without blocking on two serial LLM calls (`interpret` + `rank`).
   - Add `providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } }` to Gemini calls.
3. **[`packages/interaction-builder/src/client/store.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/packages/interaction-builder/src/client/store.ts) & [`sse.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/packages/interaction-builder/src/runtime/sse.ts)**:
   - Open SSE immediately when `initialView` is hydrated from SSR; reduce SSE outbox poll interval from `1000ms` to `150ms`.

### Phase 4: Purge All "Return Later / Close This Page / Retained Content Partitions" Copy & Add Live Searching/Loading UI
1. **Replace Passive Copy & Internal Jargon Across All Screens**:
   - **Banish** `"You can return later; this request is saved"`, `"Work is saved to your account. You can close this page and return"`, `"You can close this page and return while work continues"`, and `"retained content partitions"` from:
     - [`RecommendationPending.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortCreation/components/RecommendationPending.tsx) & [`RecommendationsStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/RecommendationsStageView.tsx)
     - [`UnderstandingStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx)
     - [`ChunkingStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/ChunkingStageView.tsx)
     - [`AnalysisStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/AnalysisStageView.tsx)
     - [`AssemblyStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/AssemblyStageView.tsx)
     - [`ChatPane.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/ChatPane.tsx)
     - Legacy [`src/client/screens/cohortCreation/components/`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortCreation/components/UnderstandingProgress.tsx) (`UnderstandingProgress.tsx`, `ChunkingProgress.tsx`, `AnalysisProgress.tsx`, `BuildingProgress.tsx`, `DiscoveryMaterials.tsx`, `GeneratedGuideOption.tsx`, `ReviewConversation.tsx`, `TextMaterial.tsx`, `CreationExperience.tsx`).
2. **Human, Live, Active Copy & Visual Feedback**:
   - In `RecommendationPending.tsx`: Show a live animated Searching Screen (`"Searching public cohorts matching your goal…"` with an active pulse spinner + skeleton cards).
   - In `UnderstandingStageView.tsx`: Show `"Analyzing X of Y sources — extracting key concepts in real time…"` with active per-source status badges (`Extracting concepts…` / `Complete`) instead of `"0 retained segments · queued"` and `"0 of 5 retained content partitions understood"`.
   - In `ChatPane.tsx`: Show `"Live progress — building your learning journey right now."` instead of `"You can close this page and return while processing continues."`
