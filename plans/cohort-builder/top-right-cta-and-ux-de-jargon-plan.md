# Cohort Creation UI/UX & Pipeline Audit & Remediation Plan

## 1. Executive Summary & Root-Cause Diagnosis

Based on a full audit of the Cohort Builder (`src/client/screens/cohortBuilder/**`, `src/shared/cohort-builder/**`, `src/server/domain/cohort-builder/**`, and `src/app/api/import/youtube/**`) and the 10 live screenshots from `https://www.undone.one`, nine systemic problems have been traced to their exact root causes:

1. **Infinite `queued → processing → failed → queued` Loop on Failed Videos (Screenshots 8, 9 & 10):**
   - **Where it happens:**
     - `src/server/infrastructure/db/postgres/text-job-runtime.ts` (lines 104–111)
     - `src/server/domain/cohort-builder/text-job-recovery.ts` (line 15)
     - `src/server/domain/cohort-builder/text-job-scheduler.ts` (lines 66–68 & 119–128)
     - `src/server/domain/cohort-builder/text-jobs.ts` (lines 53–63)
     - `src/app/api/import/youtube/metadata/route.ts` (lines 173–184)
     - `src/server/domain/cohort-builder/journey-video-adapter.ts` (lines 89–120)
   - **Root causes (3-part chain):**
     1. **Every-10-Second Auto-Reset Bug (`text-job-runtime.ts` + `text-job-recovery.ts` + `text-job-scheduler.ts`):** Every 10 seconds, `text-job-runtime.ts` queries workspaces with `status IN ('queued', 'failed')` and calls `recoverTextWorkspace`. `recoverTextWorkspace` calls `enqueueTextJobPlanInTransaction`. In commit `d59fc85d`, `enqueueTextJobPlanInTransaction` was changed to include `if (existing.status === 'superseded' || existing.status === 'failed') { toUnsupersede.push(existing.id); }`, which executes `UPDATE "cohort_text_jobs" SET "status" = 'queued', "attempts" = 0, "errorCode" = NULL WHERE "status" IN ('superseded', 'failed')`. As a result, **every 10 seconds, every failed job is automatically wiped back to `status = 'queued'` with `attempts = 0`**, causing the worker to claim it (`processing`), fail it (`failed`), and reset it to `queued` in a **never-ending infinite loop**!
     2. **Missing `attempts` Column in `claimTextJob` (`text-jobs.ts` lines 53–63):** `claimTextJob` increments `"attempts" = j."attempts" + 1` in SQL, but omits `j."attempts"` from its `RETURNING` clause, so `job.attempts` is always `undefined` (`0`) inside `failTextJob`.
     3. **Deleted/Unavailable Playlist Videos Added as `"YouTube Video"` & Unhandled Gemini `canObserve: false` on Demo Videos:**
        - In `/api/import/youtube/metadata/route.ts` (lines 173–184), when `playlistItems` returns a deleted/unavailable video ID (like Source 84 in the screenshot), the `/videos` batch lookup omits that ID from `videoDetailsMap`, yet line 178 still adds it with fallback title `'YouTube Video'`. When the worker tries to observe that unavailable video, `YoutubeMetadataReader` throws `VIDEO_NOT_FOUND`.
        - For silent/short demo videos (`Arduino Off Road RC Robot Demo`, `Wireless Car Project`), Gemini returns `canObserve: false` (`DATA_UNAVAILABLE`) or hits the 8-second timeout in `VercelMaterialObservation`, and `LiveVideoObservationProvider.observeVideo` throws instead of falling back to grounded metadata observations from the verified `validVideo` metadata.

2. **Stepper Blinking / Simultaneous Multi-Stage Highlighting Bug (Screenshots 6 & 7):**
   - **Where it happens:** `deriveStageProgress` in `src/shared/cohort-builder/creation-progress.ts` (lines 41–44).
   - **Root cause:** Neither `failedCount > 0` nor `j.status === 'running'` checks `priorComplete`. When Source 1 reaches `chunking` or `analysis` while Source 60 is still in `understanding`, multiple stages get `status === 'running'` or `status === 'failed'` simultaneously—causing `UNDERSTANDING` and `CHUNKING` / `ANALYZING` to blink or turn red at the same time.

3. **Playlists Exploding into 87–120 Individual Cards Instead of 1 Playlist Card:**
   - **Where it happens:** `MaterialStageView.tsx` (`Added material`) and `DiscoveryStageView.tsx` (`Added material`).
   - **Root cause:** Batch-added playlist sources (`${actionId}:yt:0 .. N`) are rendered as `N` separate cards instead of collapsing into **1 Playlist card** (`Playlist · 87 videos`) with a single remove button.

4. **Cramped 2-Column List & Eye-Strain Text Labels for Playlist vs Video:**
   - **Where it happens:** `MaterialStageView.module.css` and `DiscoveryStageView.tsx`.
   - **Root cause:** `.workspace` is capped at `max-width: 820px` with 2-column horizontal strips where Playlists and Videos look identical except for tiny 12px uppercase text.

5. **Shallow YouTube Search Returning Shorts/Teasers Instead of One-Shot Courses, Practical Projects & Playlists:**
   - **Where it happens:** `src/app/api/import/youtube/search/route.ts` and `DiscoveryStageView.tsx`.

6. **Progress Bar & Live Status Buried at the Bottom Instead of the Top (Screenshot 4):**
   - **Where it happens:** `UnderstandingStageView.tsx`, `ChunkingStageView.tsx`, `AnalysisStageView.tsx`.

7. **Useless Header Bloat & Obvious `"Selected material"` Heading Wasting Top-of-Page Space (Screenshot 5 - Green Circle):**
   - **Where it happens:** `UnderstandingStageView.tsx` (lines 72–84), `ChunkingStageView.tsx`, `AnalysisStageView.tsx`, `AssemblyStageView.tsx`.

8. **Scattered, Hidden & Jargon-Heavy Stage Controls (Screenshots 1 & 2):**
   - **Where it happens:** `CohortWorkspacePane.tsx` and all stage views.

9. **Contradictory Per-Source Status Signals (`"0 retained segments · queued"` + `✓`) & Noisy Concept Cloud Chips (Screenshots 3 & 5):**
   - **Where it happens:** `UnderstandingStageView.tsx` (lines 87–100) and `extractSourceConceptTopics` in `src/shared/cohort-builder/cohort-metadata.ts` (lines 59–137).

---

## 2. Detailed 8-Phase Implementation Plan

### Phase 1: Stop the Infinite `queued → processing → failed` Loop & Harden Playlist Video Acquisition
**Files:**
- `src/server/domain/cohort-builder/text-job-scheduler.ts`
- `src/server/domain/cohort-builder/text-action-jobs.ts`
- `src/server/domain/cohort-builder/text-jobs.ts`
- `src/app/api/import/youtube/metadata/route.ts`
- `src/server/domain/cohort-builder/journey-video-adapter.ts`

**Changes:**
1. **Do Not Auto-Reset `failed` Jobs During Background Recovery (`text-job-scheduler.ts` & `text-action-jobs.ts`):**
   - In `enqueueTextJobPlanInTransaction(tx, workspaceId, state, planned, options?: { retryFailed?: boolean })`:
     - Only push `existing.status === 'superseded'` to `toUnsupersede` by default.
     - Only include `existing.status === 'failed'` when `options?.retryFailed === true`.
   - In `reconcileTextAction` (`text-action-jobs.ts`):
     - Pass `{ retryFailed: typed.type === 'retry_processing' || typed.type === 'begin_material_processing' }` to `enqueueTextJobPlanInTransaction`.
   - This guarantees background recovery (`recoverTextWorkspace`) never resets failed jobs back to `queued` with `attempts = 0`.
2. **Return `attempts` in `claimTextJob` (`text-jobs.ts`):**
   - Add `j."attempts"` to the `RETURNING` clause in `claimTextJob` and set `attempts: Number(row.attempts)` on the returned `ClaimedTextJob` so transient backoff ceiling checks (`(job.attempts ?? 0) < 5`) work properly.
3. **Exclude Deleted/Unavailable Videos from Playlists (`src/app/api/import/youtube/metadata/route.ts`):**
   - In `/api/import/youtube/metadata/route.ts` (lines 173–184), filter `rawVideoIds` by `videoDetailsMap.has(id)` (when `videoDetailsMap.size > 0`) so deleted, private, or region-removed videos that the YouTube `/videos` endpoint omits are never added as `'YouTube Video'`.
4. **Graceful Metadata Fallback for Unobservable Videos in Production (`journey-video-adapter.ts`):**
   - In `LiveVideoObservationProvider.observeVideo` (`src/server/domain/cohort-builder/journey-video-adapter.ts`), when `!this.hasCustomObserver && !this.model` (live production mode) and `observer.observeVideo(validVideo, signal)` throws a non-abort, non-budget observation error (`DATA_UNAVAILABLE`, `AI_INVALID_OUTPUT`, `AI_UNAVAILABLE`, or timeout), fall back to deterministic grounded intervals derived from `validVideo` (`title`, `description`, `durationSeconds`) so silent demo videos never stall or fail the playlist build.

---

### Phase 2: Fix Stepper Blinking / Simultaneous Active & Failed Stages (`creation-progress.ts`)
**File:**
- `src/shared/cohort-builder/creation-progress.ts`

**Changes:**
- Gate `failed`, `stopped`, and `active` strictly on `priorComplete`:
  ```ts
  const failed = priorComplete && (failedCount > 0 || (!jobs.length && workspace.processing.status === 'failed' && i === index));
  const stopped = priorComplete && ((canceled && (!jobs.length || stageJobs.length > 0)) || stageJobs.some(j => j.status === 'canceled'));
  const active = priorComplete && (stageJobs.some(j => j.status === 'running' || j.status === 'queued') || (!jobs.length && ['queued', 'processing'].includes(workspace.processing.status) && i === index));
  ```

---

### Phase 3: Collapse Playlists into 1 Card, 3–4 Column Visual Grid & Better YouTube Discovery
**Files:**
- `src/app/api/import/youtube/search/route.ts`
- `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`
- `src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx`
- `src/client/screens/cohortBuilder/stages/MaterialStageView.module.css`

**Changes:**
1. **Collapse Playlists into a Single Card in `Added material` (`MaterialStageView.tsx` & `DiscoveryStageView.tsx`):**
   - Group `workspace.sources` by batch playlist prefix (`source.id.match(/^(.+):yt:\d+$/)?.[1]`) when 2 or more sources share the same batch prefix (storing playlist metadata title/thumbnail in `sessionStorage` when added).
   - Render a grouped playlist as **1 single Playlist Card** showing the stacked playlist thumbnail, playlist title, `Playlist · N videos` badge, and a single remove button that removes all videos in that playlist.
2. **3-to-4 Column Visual Card Grid & Instant Playlist vs Video Visual Cues (`MaterialStageView.module.css` & `DiscoveryStageView.tsx`):**
   - Expand `.workspace` max-width to `1160px` and use a responsive 3–4 column card grid (`grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))`).
   - **Playlist Card:** Visible **stacked-card deck silhouette** above the 16:9 thumbnail + a dark translucent **overlay bar** on the thumbnail with a `ListVideo` icon and `PLAYLIST` badge.
   - **Video Card:** Single-layer 16:9 thumbnail with a `▶ Video` badge.
3. **Smarter YouTube Search for One-Shot, Project-Based & Playlist Learning (`src/app/api/import/youtube/search/route.ts` & `DiscoveryStageView.tsx`):**
   - Enrich generic topic queries in `/api/import/youtube/search/route.ts` to target **one-shot full courses, practical project-based tutorials, and playlists**, and filter out `#shorts`.
   - Add 1-click filter pills in `DiscoveryStageView.tsx` (`All`, `Playlists`, `One-Shot Courses`, `Project-Based`).

---

### Phase 4: Remove Top-of-Page Bloat & Move Progress Bar to the Top Across All Processing Stages
**Files:**
- `src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx`
- `src/client/screens/cohortBuilder/stages/ChunkingStageView.tsx`
- `src/client/screens/cohortBuilder/stages/AnalysisStageView.tsx`
- `src/client/screens/cohortBuilder/stages/AssemblyStageView.tsx`
- `src/client/screens/cohortCreation/components/UnderstandingProgress.module.css`

**Changes:**
- Delete the filler `<header><p>` subtitle, delete `.cohortSummary`, and delete the redundant `"Selected material"` heading across `UnderstandingStageView`, `ChunkingStageView`, `AnalysisStageView`, and `AssemblyStageView`.
- Move `<div className={styles.progress}>` (`60 / 87 sources`) and `<ProcessingFailures />` to the **very top** of `.inventory`—directly above the scrollable source list.

---

### Phase 5: Unified Top-Right Stage Action Bar & Consistent `Next →` CTA
**Files:**
- `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx`
- `src/client/screens/cohortBuilder/CohortBuilder.module.css`
- `src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx`
- `src/client/screens/cohortBuilder/stages/ChunkingStageView.tsx`
- `src/client/screens/cohortBuilder/stages/AnalysisStageView.tsx`
- `src/client/screens/cohortBuilder/stages/AssemblyStageView.tsx`
- `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`
- `src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx`
- `src/client/screens/cohortBuilder/stages/RecommendationsStageView.tsx`
- `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx`

**Changes:**
- Add a unified `.topStageActions` bar in the top-right header area of `CohortWorkspacePane.tsx` with icon-only `Back` (`←`), `Cancel` (`■`), `Retry` (`↻`) controls and the consistent `Next →` primary forward CTA across stages.
- Remove all bottom `.controls` button bars from `UnderstandingStageView`, `ChunkingStageView`, `AnalysisStageView`, and `AssemblyStageView`.

---

### Phase 6: Truthful Per-Source Status & Bounded Scroll List in `UnderstandingStageView`
**Files:**
- `src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx`
- `src/client/screens/cohortCreation/components/UnderstandingProgress.module.css`

**Changes:**
- Show `<Check size={18} aria-label="Read" />` **only** when a source's understanding is complete, `<LoaderCircle size={16} className={styles.spin} aria-label="Reading" />` while `queued`/`running`, and `<AlertCircle size={18} aria-label="Needs attention" />` when `failed`, with human status copy (`"In queue"`, `"Reading now…"`, `"Read"`, `"Needs attention"`).
- Cap `.inventory ul` at `max-height: 360px; overflow-y: auto; padding-right: 4px;`.

---

### Phase 7: Clean Concept Extraction in `cohort-metadata.ts` (Screenshots 3 & 5 Fix)
**Files:**
- `src/shared/cohort-builder/cohort-metadata.ts`
- `src/shared/cohort-builder/__tests__/cohort-metadata.test.ts`

**Changes:**
- Strip `#hashtags`, emojis, and bracketed/parenthetical YouTube tags (`[MUST KNOW TIPS]`, `[Ep. 7]`, `[Fully Explained]`).
- Reject conversational/interrogative/clickbait fragments (`Why It Is The Best`, `Why AI Is Important`, `To Get Started`, `Step by Step`, `MUST KNOW TIPS`, `Robotics Are You Ready`, `Robotics How Robots`, `Basics Comes First`, `Beginners`, `My Secret`, `Our Viewers`, `Does It Work`, `Codes and Tutorial Https`, `Be Building`).

---

### Phase 8: Full De-Jargoning Pass Across Remaining Stage Views & Chat Suggestions
**Files:**
- `src/client/screens/cohortBuilder/stages/ChunkingStageView.tsx`
- `src/client/screens/cohortBuilder/stages/AnalysisStageView.tsx`
- `src/client/screens/cohortBuilder/stages/AssemblyStageView.tsx`
- `src/client/screens/cohortBuilder/stages/CurriculumStageView.tsx`
- `src/client/screens/cohortBuilder/chat-suggestions.ts`

**Changes:**
- Remove `Checksum: {chunk.checksum.slice(0, 12)}`, `Chunk: characters 0–50`, `Deterministic estimates, normalized from 0 to 1`, `Grounded in its retained source`, `unavailable retained passage`, and replace `Review chunks` chip in `chat-suggestions.ts` with `Key topics`.
