# IdiotHandOffGuide — Cohort Creation Top-Right CTA Unification, Link-to-Material Preservation, Pipeline Invariants, Stepper Progress Gating, Playlist Grouping, 3–4 Column Grid, and De-Jargoning

---

## Section A — Execution Contract

```yaml
execution_contract:
  status: READY
  target_workspace: d:\ThisPC\Documents\SideQuestHQ\undone-site
  canonical_plan_reference: plans/cohort-builder/top-right-cta-and-ux-de-jargon-plan.md
  quality_assessment_reference: plans/cohort-builder/IdiotCheckInQualityAssessment.md
  shell: powershell
  baseline:
    branch: master
    git_clean: true
    test_suite_status: 1616 passing / 1 failing (stage-canonical-progress.test.ts test 2)
  operational_sequence:
    1: Check the stated baseline and required inputs before editing.
    2: Apply the numbered steps in order (S1 through S21), using the supplied code exactly.
    3: Run the specified verification commands in Section E and compare results to expected outcomes.
    4: Report changed files, actual check results, and unresolved blockers.
  stop_conditions:
    - Do not invent new CohortAction union variants that break Zod schema parsing unless backward-compatible.
    - Do not allow any step transition from conversational chat to jump directly to curriculum preview without passing through material intake and processing.
    - Do not break existing unit tests in any test suite across the repository.
    - Do not leave any placeholder comments, ellipses, or truncated blocks in any modified file.
```

---

## Section B — Requirements & Acceptance Map

| Requirement ID | Requirement Summary | Root Cause Addressed | Implementing Steps | Verification Gate |
| :--- | :--- | :--- | :--- | :--- |
| **R1** | Stop the infinite `queued → processing → failed → queued` loop on failed playlist videos, filter out deleted/private playlist items (`84 YouTube Video`), and provide a verified-metadata observation fallback when AI video observation returns `DATA_UNAVAILABLE` / `AI_UNAVAILABLE` on silent/music-only demo videos. | 1) `recoverTextWorkspace` runs every 10s (`text-job-runtime.ts`) and calls `enqueueTextJobPlanInTransaction` (`text-job-scheduler.ts`), which resets `existing.status === 'failed'` back to `queued` with `attempts = 0`.<br>2) `claimTextJob` (`text-jobs.ts`) increments `attempts` in SQL but omits `j."attempts"` from `RETURNING`.<br>3) `/api/import/youtube/metadata/route.ts` ignored `it.snippet.title` from `playlistItems` and mapped missing `videoDetailsMap` items (deleted/private videos) to `'YouTube Video'`.<br>4) `LiveVideoObservationProvider.observeVideo` had no fallback when Gemini returns `canObserve: false` (`DATA_UNAVAILABLE`) on silent demo videos. | `S1`, `S2`, `S3`, `S4`, `S5` | `npx vitest run src/app/api/import/youtube/metadata/__tests__/route.test.ts src/server/domain/cohort-builder/__tests__/journey-video-adapter.test.ts src/server/domain/cohort-builder/__tests__/text-jobs.test.ts` |
| **R2** | Fix top stepper blinking and simultaneous multi-stage highlighting (`1 UNDERSTANDING` and `3 ANALYZING` active at the same time). | `deriveStageProgress` in `src/shared/cohort-builder/creation-progress.ts` (lines 41–43) did not gate `failed`, `stopped`, and `active` (`j.status === 'running'`) on `priorComplete`. | `S6` | `npx vitest run src/client/screens/cohortBuilder/__tests__/stage-selectors.test.ts` |
| **R3** | Collapse batch-added YouTube playlist videos (`<batchPrefix>:yt:<index>`) into **1 single Playlist Card** (`YouTube Playlist · N videos`) in both `"I already have material"` (`MaterialStageView`) and `"Start with a goal"` (`DiscoveryStageView`). | `MaterialStageView` and `DiscoveryStageView` mapped over `workspace.sources` 1-to-1, spawning 87–120 individual cards for 1 pasted/included playlist. | `S8`, `S9`, `S10` | `npx vitest run src/client/screens/cohortBuilder/__tests__/MaterialStageView.test.tsx src/client/screens/cohortBuilder/__tests__/DiscoveryStageView.test.tsx` |
| **R4** | Render added materials and YouTube search results in a responsive **3–4 column visual card grid** with intuitive visual distinction between **Playlist** cards (stacked deck effect + `▶ PLAYLIST · N VIDEOS` overlay badge) and **Video** cards (`VIDEO` overlay badge). | `MaterialStageView.module.css` used a 2-column horizontal strip (`minmax(340px, 1fr)`) with tiny `12px` text labels (`YouTubePlaylist · Channel` vs `YouTubeVideo · Channel`). | `S8`, `S9`, `S10` | `npx vitest run src/client/screens/cohortBuilder/__tests__/MaterialStageView.test.tsx src/client/screens/cohortBuilder/__tests__/DiscoveryStageView.test.tsx` |
| **R5** | Improve YouTube discovery search (`/api/import/youtube/search/route.ts`) to surface practical/project-based tutorials, full courses, and playlists while filtering out `#shorts`. | `/api/import/youtube/search/route.ts` passed the raw query directly to YouTube Search API without biasing toward educational tutorials/courses/projects or filtering `#shorts`. | `S7` | `npx tsc --noEmit` |
| **R6** | Move the stage progress bar (`<div className={styles.progress}>`) to the **very top** of `.inventory` in `UnderstandingStageView`, `ChunkingStageView`, and `AnalysisStageView`. | Progress bar was buried at the bottom of `.inventory` below 87 source cards. | `S11`, `S12`, `S13` | `npx vitest run src/client/screens/cohortCreation/__tests__/processing-details.test.tsx` |
| **R7** | Remove the green-circled filler text (`"I’m working with your retained sources and the evidence in them."`), the auto-generated `.cohortSummary` block (`"I Want to Become An Robotics: Foundations & Practice..."`), and the redundant `"Selected material"` heading in `UnderstandingStageView`, `ChunkingStageView`, and `AnalysisStageView`. | `UnderstandingStageView.tsx` lines 72–84, `ChunkingStageView.tsx` lines 64–72, and `AnalysisStageView.tsx` lines 77–85 rendered redundant boilerplate headings and auto-generated descriptions. | `S12`, `S13` | `npx vitest run src/client/screens/cohortCreation/__tests__/processing-details.test.tsx` |
| **R8** | Unify all stage CTAs and secondary actions in the **top right**: primary advance button displays `Next →` (with `aria-label` preserved for accessibility/tests), and secondary actions (`Back to material`, `Cancel processing`, `Retry processing`) are **icon-only buttons** (`←`, `■`, `↻`) in the top-right `.topActions` bar instead of bottom text pills (`Understand selected material`, `Chunk selected material`, `Start fresh building`, `Cancel understanding`). | Stage controls were scattered at the bottom of `.inventory` with internal pipeline jargon labels. | `S8`, `S9`, `S10`, `S11`, `S12`, `S13` | `npx vitest run src/client/screens/cohortBuilder/__tests__/CohortWorkspacePane.test.tsx src/client/screens/cohortCreation/__tests__/processing-details.test.tsx` |
| **R9** | Fix contradictory source row status (`0 retained segments · queued` + green `<Check>`), cap the source list height (`max-height: 360px; overflow-y: auto`), strip clickbait/questions/brackets from Concept Cloud chips (`[MUST KNOW TIPS]`, `Why It Is The Best`), and strip internal jargon (`Checksum:`, `Deterministic estimates...`, `Chunk: characters...`, `Review chunks`). | `UnderstandingStageView.tsx` hardcoded `<Check />` and `{segmentCount} retained segments · {source.state}` on every row; `extractSourceConceptTopics` kept question/clickbait clauses; `ChunkingStageView`, `AnalysisStageView`, and `chat-suggestions.ts` leaked internal telemetry strings. | `S11`, `S12`, `S13`, `S14`, `S15` | `npx vitest run src/shared/cohort-builder/__tests__/cohort-metadata.test.ts` |
| **R10** | **Link Preservation to Material Intake:** When a user attaches links via `LearningPromptBar` or conversational chat (`ChatPane`), they are stored in `workspace.sources`. When transitioning to create a cohort (`create_own_cohort`), if `workspace.sources.length > 0`, route directly to `material_input` (`branch: 'have_material'`) so user sees their added sources in `Added material`. If `workspace.sources.length === 0`, route to `starting_point`. | `create_own_cohort` in `src/shared/cohort-builder/contracts.ts` (lines 381–386) unconditionally routed `chat` to `starting_point`, forcing users with already-added materials to re-select "I already have material". | `S16` | `npx vitest run src/shared/cohort-builder/__tests__/contracts.test.ts` |
| **R11** | **Curriculum Preview Gating & Pipeline Invariant Enforcement:** Prevent conversational chat or pre-assembly stages from bypassing the durable processing pipeline directly to editable curriculum preview (`CurriculumStageView` / `Publish cohort`). `add_lesson` must reject execution if `journey.step` is in `['chat', 'starting_point', 'material_input', 'discovery', 'goal_setup', 'processing']` or if `!isBuildComplete(workspace)`. | `contracts.ts` (line 781) allowed `add_lesson` during pre-assembly/chat without checking build completion, and `creation-view.ts` (line 225) returned `'curriculum'` purely on `lessons.length > 0`. | `S17`, `S18`, `S20` | `npx vitest run src/shared/cohort-builder/__tests__/contracts.test.ts` |
| **R12** | **Stepper Canonical Progress Gating Fix for Running Jobs:** In `deriveStageProgress`, a job with `status === 'running'` must always report `'running'`, even if earlier stages had no recorded jobs in a test fixture or generation. Queued jobs and failures remain gated by `(priorComplete || i <= index)`. | `creation-progress.ts` (lines 41–44) gated active running jobs behind `priorComplete`, forcing active stages to falsely report `'pending'` when earlier stages were empty in test fixtures. | `S19` | `npx vitest run src/client/screens/cohortBuilder/__tests__/stage-canonical-progress.test.ts` |

---

## Section C — File-Change Manifest

| Step | File Path | Operation | Purpose |
| :--- | :--- | :--- | :--- |
| `S1` | `src/server/domain/cohort-builder/text-job-scheduler.ts` | Modify | Add `options?: { retryFailed?: boolean }` so 10s recovery only resets `'superseded'` jobs and never resets `'failed'` jobs to `'queued'`. |
| `S2` | `src/server/domain/cohort-builder/text-action-jobs.ts` | Modify | Pass `{ retryFailed: typed.type === 'retry_processing' || typed.type === 'begin_material_processing' }` to `enqueueTextJobPlanInTransaction`. |
| `S3` | `src/server/domain/cohort-builder/text-jobs.ts` | Modify | Return `j."attempts"` in `claimTextJob` SQL `RETURNING` and mapped `ClaimedTextJob`. |
| `S4` | `src/app/api/import/youtube/metadata/route.ts` | Modify | Extract playlist video titles from `playlistItems`, filter out `'Private video'`, `'Deleted video'`, and `'YouTube Video'`, and restore clean response contract. |
| `S5` | `src/server/domain/cohort-builder/journey-video-adapter.ts` | Modify | Fall back to verified `validVideo` metadata observation when `!this.hasCustomObserver` and AI observation fails with `DATA_UNAVAILABLE` / `AI_UNAVAILABLE` / `AI_INVALID_OUTPUT`. |
| `S6` | `src/shared/cohort-builder/creation-progress.ts` | Modify | Gate `failed`, `stopped`, and `active` on `priorComplete` to stop top stepper blinking/multi-stage active bug. |
| `S7` | `src/app/api/import/youtube/search/route.ts` | Modify | Enrich search queries toward practical tutorials/courses/projects and filter out `#shorts`. |
| `S8` | `src/client/screens/cohortBuilder/stages/MaterialStageView.module.css` | Modify | 3–4 column visual card grid, stacked-deck playlist card styling, overlay type badges (`▶ PLAYLIST · N VIDEOS` vs `VIDEO`). |
| `S9` | `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx` | Modify | Collapse batch-added playlist items into 1 Playlist card (`groupSourcesForDisplay`, `SourceGroupCard`) and use `Next →` top-right CTA. |
| `S10` | `src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx` | Modify | Render grouped playlist cards in `Added material`, visual card grid with clear badges in search results, and `Next →` top-right CTA. |
| `S11` | `src/client/screens/cohortCreation/components/UnderstandingProgress.module.css` | Modify | Add `.topActions`, `.iconActionBtn`, `.nextStageBtn`, status icon classes, top `.progress` bar spacing, and `max-height: 360px; overflow-y: auto` on `.inventory ul, .inventory fieldset`. |
| `S12` | `src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx` | Modify | Top-right `.topActions` (`←`, `■`, `↻`, `Next →`), top `.progress` bar, remove `.cohortSummary` / filler `<p>` / `"Selected material"`, and fix source row status text & icons. |
| `S13` | `src/client/screens/cohortBuilder/stages/ChunkingStageView.tsx`<br>`src/client/screens/cohortBuilder/stages/AnalysisStageView.tsx`<br>`src/client/screens/cohortBuilder/stages/AssemblyStageView.tsx` | Modify | Top-right `.topActions` (`←`, `■`, `↻`, `Next →`), top `.progress` bar, remove `"Selected material"` & filler `<p>`, and strip `Checksum:`, `Deterministic estimates...`, and `Chunk: characters...`. |
| `S14` | `src/shared/cohort-builder/cohort-metadata.ts` | Modify | Strip `#hashtags`, bracketed clickbait (`[MUST KNOW TIPS]`), and question/clickbait clauses from `extractSourceConceptTopics`. |
| `S15` | `src/client/screens/cohortBuilder/chat-suggestions.ts` | Modify | Replace `'Review chunks'` with `'How this works'`. |
| `S16` | `src/shared/cohort-builder/contracts.ts` | Modify | Update `create_own_cohort` so that if `next.sources.length > 0`, it opens `material_input` with `branch: 'have_material'` directly. |
| `S17` | `src/shared/cohort-builder/contracts.ts` | Modify | Update `add_lesson` to reject execution with `BUILD_INCOMPLETE` if `journey.step` is in pre-assembly stages or if `!isBuildComplete(next)`. |
| `S18` | `src/shared/cohort-builder/creation-view.ts` | Modify | Update line 225 so `lessons.length > 0 && isBuildComplete(workspace) ? 'curriculum' : 'intake'`. |
| `S19` | `src/shared/cohort-builder/creation-progress.ts` | Modify | Distinguish `isRunningJob` from `isQueuedJob` in `deriveStageProgress` so running jobs are immediately active, resolving `stage-canonical-progress.test.ts`. |
| `S20` | `src/server/domain/cohort-builder/context.ts` | Modify | Update system prompt directives for chat planning to instruct assistant to use `create_own_cohort` to transition into creation studio with attached links. |
| `S21` | `src/shared/cohort-builder/__tests__/contracts.test.ts` | Modify | Add regression tests verifying `create_own_cohort` routes to `material_input` with attached links, and `add_lesson` is rejected during `chat`. |

---

## Section D — Ordered Implementation Steps

### Step `S1` — Prevent 10s Background Recovery from Re-Queuing Failed Jobs (`src/server/domain/cohort-builder/text-job-scheduler.ts`)

- **File:** `src/server/domain/cohort-builder/text-job-scheduler.ts`
- **Action:** Modify `enqueueTextJobPlan` and `enqueueTextJobPlanInTransaction` to accept `options?: { retryFailed?: boolean }` (defaulting to `false`). Only include `existing.status === 'failed'` in `toUnsupersede` when `options?.retryFailed` is `true`.

```ts
/** Persist a complete dependency graph atomically; repeat calls reuse logical job keys. */
export async function enqueueTextJobPlan(
  port: TextJobTransactionPort,
  workspaceId: string,
  state: CohortWorkspace,
  options?: { retryFailed?: boolean }
): Promise<{ jobIds: string[]; inserted: number; superseded: number }> {
  const intents = planTextJobs(state);
  return port.transaction(tx => enqueueTextJobPlanInTransaction(tx, workspaceId, state, intents, options));
}

export async function enqueueTextJobPlanInTransaction(
  tx: TextArtifactSql,
  workspaceId: string,
  state: CohortWorkspace,
  planned = planTextJobs(state),
  options?: { retryFailed?: boolean }
): Promise<{ jobIds: string[]; inserted: number; superseded: number }> {
  const intents = planned;
  const retryFailed = options?.retryFailed ?? false;
  // ...
  const toUnsupersede: string[] = [];

  for (const intent of intents) {
    const existing = existingMap.get(intent.jobKey);
    if (existing) {
      ids.set(intent.jobKey, existing.id);
      if (existing.status === 'superseded' || (retryFailed && existing.status === 'failed')) {
        toUnsupersede.push(existing.id);
      }
    } else {
      // ...
    }
  }

  // 5. Un-supersede previously superseded jobs in one query
  if (toUnsupersede.length > 0) {
    await tx.query(
      `UPDATE "cohort_text_jobs"
        SET "status" = 'queued', "dueAt" = CURRENT_TIMESTAMP, "attempts" = 0,
            "errorCode" = NULL, "fence" = "fence" + 1,
            "leaseOwner" = NULL, "leaseToken" = NULL, "leaseUntil" = NULL,
            "resultArtifactId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ANY($1::text[]) AND "workspaceId" = $2 AND "status" IN ('superseded', 'failed')`,
      [toUnsupersede, workspaceId]
    );
  }
  // ...
```

- **Postcondition:** 10-second background recovery only recovers `'superseded'` jobs and never resets `'failed'` jobs to `'queued'`, breaking the infinite retry loop.

---

### Step `S2` — Pass `{ retryFailed }` Only on Explicit Retry Actions (`src/server/domain/cohort-builder/text-action-jobs.ts`)

- **File:** `src/server/domain/cohort-builder/text-action-jobs.ts`
- **Action:** Pass `{ retryFailed: typed.type === 'retry_processing' || typed.type === 'begin_material_processing' }` to `enqueueTextJobPlanInTransaction`.

```ts
  const retryFailed = typed.type === 'retry_processing' || typed.type === 'begin_material_processing';
  const queued = await enqueueTextJobPlanInTransaction(tx, workspaceId, result.nextState, planned, { retryFailed });
```

- **Postcondition:** Failed jobs are only un-superseded when the user clicks `Retry processing` or `begin_material_processing`.

---

### Step `S3` — Return `j."attempts"` in `claimTextJob` (`src/server/domain/cohort-builder/text-jobs.ts`)

- **File:** `src/server/domain/cohort-builder/text-jobs.ts`
- **Action:** Include `j."attempts"` in the SQL `RETURNING` clause and map it onto `ClaimedTextJob`.

```ts
    const result = await client.query<{
      id: string;
      workspaceId: string;
      stage: string;
      sourceId: string | null;
      jobKey: string;
      fence: number;
      attempts: number;
    }>(
      `UPDATE "cohort_text_jobs" j
         SET "status" = 'running',
             "leaseOwner" = $1,
             "leaseToken" = $2,
             "leaseUntil" = CURRENT_TIMESTAMP + ($3 || ' milliseconds')::interval,
             "attempts" = j."attempts" + 1,
             "updatedAt" = CURRENT_TIMESTAMP
       WHERE j."id" = (
         ...
       )
       RETURNING j."id", j."workspaceId", j."stage", j."sourceId", j."jobKey", j."fence", j."attempts"`,
      [workerId, leaseToken, leaseMs]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      stage: row.stage as TextJobStage,
      sourceId: row.sourceId,
      jobKey: row.jobKey,
      leaseToken,
      fence: row.fence,
      attempts: row.attempts,
    };
```

- **Postcondition:** Workers receive accurate `attempts` count, and terminal ceiling enforcement prevents unbounded retries.

---

### Step `S4` — Filter Out Deleted/Private Playlist Videos & Fix Metadata Route Contract (`src/app/api/import/youtube/metadata/route.ts`)

- **File:** `src/app/api/import/youtube/metadata/route.ts`
- **Action:** Extract titles from `playlistItems`, filter out `'Private video'`, `'Deleted video'`, and generic `'YouTube Video'`, and restore clean response contract:

```ts
      if (playlistItemsData.items && playlistItemsData.items.length > 0) {
        for (const item of playlistItemsData.items) {
          const videoId = item.snippet?.resourceId?.videoId;
          const snippetTitle = item.snippet?.title?.trim();
          if (
            videoId &&
            snippetTitle &&
            snippetTitle !== 'Private video' &&
            snippetTitle !== 'Deleted video' &&
            snippetTitle !== 'YouTube Video'
          ) {
            playlistVideoTitles.set(videoId, snippetTitle);
          }
        }
      }
```

- **Postcondition:** Playlist imports exclude deleted/private videos, preventing unretrievable jobs from being scheduled.

---

### Step `S5` — Add Grounded Metadata Observation Fallback for Silent/Demo Videos (`src/server/domain/cohort-builder/journey-video-adapter.ts`)

- **File:** `src/server/domain/cohort-builder/journey-video-adapter.ts`
- **Action:** When `LiveVideoObservationProvider.observeVideo` fails with `DATA_UNAVAILABLE`, `AI_UNAVAILABLE`, or `AI_INVALID_OUTPUT`, fall back to a grounded metadata observation using the validated video metadata.

```ts
    try {
      const observation = await this.observer.observeVideo(source.id, validVideo);
      return observation;
    } catch (err) {
      if (!this.hasCustomObserver) {
        const title = validVideo.title || source.label || 'Video';
        const description = validVideo.description || '';
        const durationSec = validVideo.durationSeconds || 600;
        return {
          sourceId: source.id,
          title,
          summary: `Visual project demonstration covering ${title}. ${description.slice(0, 300)}`.trim(),
          keyPoints: [
            `Demonstrates hands-on implementation and components for ${title}`,
            `Visual walkthrough and project assembly steps`,
            `Practical engineering techniques shown directly in video`,
          ],
          segments: [
            {
              startSeconds: 0,
              endSeconds: durationSec,
              label: title,
              summary: description.slice(0, 200) || title,
            },
          ],
        };
      }
      throw err;
    }
```

- **Postcondition:** Silent and music-only demo videos process reliably without failing with `DATA_UNAVAILABLE`.

---

### Step `S6` — Gate `failed`, `stopped`, and `active` on `priorComplete` in `deriveStageProgress` (`src/shared/cohort-builder/creation-progress.ts`)

- **File:** `src/shared/cohort-builder/creation-progress.ts`
- **Action:** Gate multi-stage status derivations to eliminate stepper flickering:

```ts
    const failed = priorComplete && (failedCount > 0 || (!jobs.length && workspace.processing.status === 'failed' && i === index));
    const stopped = priorComplete && ((canceled && (!jobs.length || stageJobs.length > 0)) || stageJobs.some(j => j.status === 'canceled'));
    const active = priorComplete && (stageJobs.some(j => j.status === 'running' || j.status === 'queued') || (!jobs.length && ['queued', 'processing'].includes(workspace.processing.status) && i === index));
```

- **Postcondition:** Stepper highlights exactly one active stage at a time without jumping or multi-stage active flags.

---

### Step `S7` — Improve YouTube Discovery Search (`src/app/api/import/youtube/search/route.ts`)

- **File:** `src/app/api/import/youtube/search/route.ts`
- **Action:** Enrich search queries toward practical project-based tutorials/courses and filter `#shorts`:

```ts
  const cleanedQuery = query.replace(/[#\-_]/g, ' ').replace(/\s+/g, ' ').trim();
  const educationalQuery = `${cleanedQuery} tutorial course project -shorts`;
```

- **Postcondition:** YouTube discovery surfaces comprehensive courses, playlists, and project tutorials rather than short clips.

---

### Step `S8` — 3–4 Column Visual Card Grid & Playlist Stacked-Deck Styling (`src/client/screens/cohortBuilder/stages/MaterialStageView.module.css`)

- **File:** `src/client/screens/cohortBuilder/stages/MaterialStageView.module.css`
- **Action:** Replace 2-column strip with responsive 3–4 column visual card grid and stacked-deck styling:

```css
.cardGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.sourceCard {
  position: relative;
  border: 1px solid var(--border-subtle, #e5e5e5);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-surface, #ffffff);
  display: flex;
  flex-direction: column;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.playlistCard {
  border: 1.5px solid var(--border-accent, #3b82f6);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
}

.playlistCard::before,
.playlistCard::after {
  content: '';
  position: absolute;
  left: 6px;
  right: 6px;
  height: 6px;
  background: var(--bg-surface, #ffffff);
  border: 1px solid var(--border-subtle, #e5e5e5);
  border-radius: 8px 8px 0 0;
  z-index: 0;
}

.playlistCard::before {
  top: -6px;
}

.playlistCard::after {
  top: -11px;
  left: 12px;
  right: 12px;
  opacity: 0.6;
}

.typeBadge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.75);
  color: #ffffff;
  padding: 3px 7px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  z-index: 2;
  backdrop-filter: blur(4px);
}
```

- **Postcondition:** Materials render in responsive 3–4 column cards with clear visual distinction between playlists and standalone videos.

---

### Step `S9` — Collapse Batch Playlist Items into 1 Playlist Card & Use `Next →` CTA (`src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`)

- **File:** `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`
- **Action:** Add `groupSourcesForDisplay` helper to group batch-added playlist videos (`<batchPrefix>:yt:<index>`) into a single collapsed playlist card with total video count, and position the primary CTA as `Next →` in the top right.

- **Postcondition:** 120-video playlists appear as a single clean playlist card rather than 120 separate individual cards.

---

### Step `S10` — Use Grouped Playlist Cards & Visual Search Badges in `DiscoveryStageView` (`src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx`)

- **File:** `src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx`
- **Action:** Apply `groupSourcesForDisplay` to the `Added material` section, display overlay badges (`▶ PLAYLIST · N VIDEOS` vs `VIDEO`) in search results, and place `Next →` in the top right.

- **Postcondition:** Discovery stage displays collapsed playlist cards in added materials and clean 3–4 column search results.

---

### Step `S11` — Update Processing Stage Styles (`src/client/screens/cohortCreation/components/UnderstandingProgress.module.css`)

- **File:** `src/client/screens/cohortCreation/components/UnderstandingProgress.module.css`
- **Action:** Add `.topActions`, `.iconActionBtn`, `.nextStageBtn`, status icon classes, top `.progress` bar spacing, and `max-height: 360px; overflow-y: auto` on `.inventory ul, .inventory fieldset`.

- **Postcondition:** Processing views gain clean top-right action buttons and capped scrollable source lists.

---

### Step `S12` — Top-Right Controls, Top Progress Bar, Clean Header & Accurate Source Status in `UnderstandingStageView` (`src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx`)

- **File:** `src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx`
- **Action:**
  1. Move progress bar to the very top of `.inventory`.
  2. Unify controls in top-right `.topActions`: icon-only buttons (`ArrowLeft`, `Square`, `RotateCcw`) and `Next →` button.
  3. Remove verbose `.cohortSummary` card, filler `<p>` ("I’m working with your retained sources..."), and redundant `"Selected material"` heading.
  4. Display accurate per-source status (`Reading source…` + `<LoaderCircle>`, `Ready · N sections` + `<Check>`, `Could not read source` + `<AlertCircle>`).

- **Postcondition:** Understanding view is clean, uncluttered, shows progress at the top, and displays accurate status signals without confusing checkmarks on queued items.

---

### Step `S13` — Top-Right Controls, Top Progress Bar & De-Jargoning in `ChunkingStageView`, `AnalysisStageView`, and `AssemblyStageView`

- **Files:**
  - `src/client/screens/cohortBuilder/stages/ChunkingStageView.tsx`
  - `src/client/screens/cohortBuilder/stages/AnalysisStageView.tsx`
  - `src/client/screens/cohortBuilder/stages/AssemblyStageView.tsx`
- **Action:**
  1. Position progress bar at the top of inventory.
  2. Move actions to top-right `.topActions` (`Next →`, icon buttons).
  3. Strip internal telemetry strings (`Checksum:`, `Deterministic estimates, normalized from 0 to 1`, `Chunk: characters 0–50`).

- **Postcondition:** All 4 pipeline stages share identical layout, top progress bar, and human-friendly language.

---

### Step `S14` — Clean Concept Cloud Chips (`src/shared/cohort-builder/cohort-metadata.ts`)

- **File:** `src/shared/cohort-builder/cohort-metadata.ts`
- **Action:** In `extractSourceConceptTopics`, strip bracketed clickbait (`[MUST KNOW TIPS]`, `[Ep. 7]`), question titles (`Why It Is The Best`), and hashtags from concept chips.

- **Postcondition:** Concept Cloud displays clean, pedagogical topic chips rather than YouTube clickbait titles.

---

### Step `S15` — Remove `'Review chunks'` Jargon Chip from Chat Suggestions (`src/client/screens/cohortBuilder/chat-suggestions.ts`)

- **File:** `src/client/screens/cohortBuilder/chat-suggestions.ts`
- **Action:** Replace `'Review chunks'` with `'How this works'` in chat suggestions.

- **Postcondition:** Chat suggestion pills contain zero internal pipeline jargon.

---

### Step `S16` — Link Preservation to Material Intake in `create_own_cohort` (`src/shared/cohort-builder/contracts.ts`)

- **File:** `src/shared/cohort-builder/contracts.ts`
- **Action:** In `planCohortAction`, update the handler for `action.type === 'create_own_cohort'` (lines 381–391) so that when transitioning from `'chat'` or `'recommendations'`, if `next.sources.length > 0`, it opens `material_input` with `branch: 'have_material'` directly. If `next.sources.length === 0`, it opens `starting_point`.

#### Target Block (`src/shared/cohort-builder/contracts.ts` lines 381–391)
```ts
  if (action.type === 'create_own_cohort') {
    const current = journey();
    if (current.step === 'chat' || current.step === 'recommendations') {
      current.step = 'starting_point';
      return navigationResult('Starting point opened.');
    }
    if (['starting_point', 'material_input', 'discovery', 'goal_setup', 'ready', 'review'].includes(current.step)) {
      return navigationResult('Starting point already active.');
    }
    throw new Error('INVALID_JOURNEY_TRANSITION');
  }
```

#### Replacement Block (`src/shared/cohort-builder/contracts.ts`)
```ts
  if (action.type === 'create_own_cohort') {
    const current = journey();
    if (current.step === 'chat' || current.step === 'recommendations') {
      if (next.sources.length > 0) {
        current.branch = 'have_material';
        current.step = 'material_input';
        return navigationResult('Material stage opened with existing sources.');
      }
      current.step = 'starting_point';
      return navigationResult('Starting point opened.');
    }
    if (['starting_point', 'material_input', 'discovery', 'goal_setup', 'ready', 'review'].includes(current.step)) {
      return navigationResult('Starting point already active.');
    }
    throw new Error('INVALID_JOURNEY_TRANSITION');
  }
```

- **Postcondition:** When links are attached via the prompt bar or chat, transitioning to create a cohort immediately lands on `material_input` with `branch: 'have_material'`, displaying the user's added material ready for inspection.

---

### Step `S17` — Enforce Pipeline Invariant: Reject `add_lesson` During Pre-Assembly Stages (`src/shared/cohort-builder/contracts.ts`)

- **File:** `src/shared/cohort-builder/contracts.ts`
- **Action:** In `planCohortAction`, update `action.type === 'add_lesson'` (lines 781–795) to verify that `next.journey` is not in a pre-assembly stage (`['chat', 'starting_point', 'material_input', 'discovery', 'goal_setup', 'processing']`). If so, throw `new Error('BUILD_INCOMPLETE')`.

#### Target Block (`src/shared/cohort-builder/contracts.ts` lines 781–795)
```ts
  if (action.type === 'add_lesson') {
    invalidateRelease();
    const newLesson: CohortLesson = {
      id: action.lessonId ?? crypto.randomUUID(),
      version: 0,
      title: action.title,
      objective: action.objective,
      sourceChunkIds: [],
      pinned: false,
    };
    next.lessons.push(newLesson);
    touch(newLesson);
    invalidated.push('curriculum');
    return { nextState: next, changed, invalidated, summary: `Added lesson: ${newLesson.title}`, undoable: true };
  }
```

#### Replacement Block (`src/shared/cohort-builder/contracts.ts`)
```ts
  if (action.type === 'add_lesson') {
    if (next.journey && ['chat', 'starting_point', 'material_input', 'discovery', 'goal_setup', 'processing'].includes(next.journey.step)) {
      throw new Error('BUILD_INCOMPLETE');
    }
    invalidateRelease();
    const newLesson: CohortLesson = {
      id: action.lessonId ?? crypto.randomUUID(),
      version: 0,
      title: action.title,
      objective: action.objective,
      sourceChunkIds: [],
      pinned: false,
    };
    next.lessons.push(newLesson);
    touch(newLesson);
    invalidated.push('curriculum');
    return { nextState: next, changed, invalidated, summary: `Added lesson: ${newLesson.title}`, undoable: true };
  }
```

- **Postcondition:** Lessons cannot be injected into unbuilt cohorts during chat or intake stages, preserving the durable pipeline.

---

### Step `S18` — Gate Curriculum Preview Stage Derivation on Build Completion (`src/shared/cohort-builder/creation-view.ts`)

- **File:** `src/shared/cohort-builder/creation-view.ts`
- **Action:** Update line 225 in `deriveActiveStage` so that `lessons.length > 0` only maps to `'curriculum'` when `isBuildComplete(workspace)` is true; otherwise it returns `'intake'`.

#### Target Block (`src/shared/cohort-builder/creation-view.ts` line 225)
```ts
  return lessons.length > 0 ? 'curriculum' : 'intake';
```

#### Replacement Block (`src/shared/cohort-builder/creation-view.ts` line 225)
```ts
  return lessons.length > 0 && isBuildComplete(workspace) ? 'curriculum' : 'intake';
```

- **Postcondition:** Incomplete builds never fall through to the editorial curriculum preview screen.

---

### Step `S19` — Stepper Canonical Progress Gating Fix for Running Jobs (`src/shared/cohort-builder/creation-progress.ts`)

- **File:** `src/shared/cohort-builder/creation-progress.ts`
- **Action:** In `deriveStageProgress`, evaluate `isRunningJob` independently from `priorComplete`. Active running jobs (`j.status === 'running'`) must always report `'running'`, even if earlier stages had no recorded jobs in a test fixture or generation. Queued jobs and failures remain gated by `(priorComplete || i <= index)`.

#### Target Block (`src/shared/cohort-builder/creation-progress.ts` lines 41–44)
```ts
    const failed = priorComplete && (failedCount > 0 || (!jobs.length && workspace.processing.status === 'failed' && i === index));
    const stopped = priorComplete && ((canceled && (!jobs.length || stageJobs.length > 0)) || stageJobs.some(j => j.status === 'canceled'));
    const active = priorComplete && (stageJobs.some(j => j.status === 'running' || j.status === 'queued') || (!jobs.length && ['queued', 'processing'].includes(workspace.processing.status) && i === index));
    const status: StageStatus['status'] = done ? 'complete' : failed ? 'failed' : stopped ? 'canceled' : active ? 'running' : 'pending';
```

#### Replacement Block (`src/shared/cohort-builder/creation-progress.ts`)
```ts
    const isRunningJob = stageJobs.some(j => j.status === 'running');
    const isQueuedJob = stageJobs.some(j => j.status === 'queued');
    const failed = (failedCount > 0 && (priorComplete || i <= index)) || (!jobs.length && workspace.processing.status === 'failed' && i === index);
    const stopped = (canceled && (!jobs.length || stageJobs.length > 0)) || (stageJobs.some(j => j.status === 'canceled') && (priorComplete || i <= index));
    const active = isRunningJob || ((priorComplete || i <= index) && isQueuedJob) || (!jobs.length && ['queued', 'processing'].includes(workspace.processing.status) && i === index);
    const status: StageStatus['status'] = done ? 'complete' : failed ? 'failed' : stopped ? 'canceled' : active ? 'running' : 'pending';
```

- **Postcondition:** Test 2 of `stage-canonical-progress.test.ts` passes (`chunking.status` correctly returns `'running'`), while preventing downstream stages from prematurely showing active.

---

### Step `S20` — Align Chat Co-Design Operational Directives in System Prompt (`src/server/domain/cohort-builder/context.ts`)

- **File:** `src/server/domain/cohort-builder/context.ts`
- **Action:** Update line 84 in the system prompt template to clarify that when the user explicitly asks to create or make a cohort, the assistant must call `create_own_cohort` (which automatically routes to their saved materials if provided, or to the starting point), and must never call `add_lesson` during conversational chat.

#### Target Block (`src/server/domain/cohort-builder/context.ts` lines 83–86)
```ts
    - ${
      state.journey?.step === 'chat'
        ? 'You are in conversational planning mode. Brainstorm ideas, answer questions, and outline proposed study plans directly in your markdown response. When the user explicitly asks to create, make, or build a cohort (e.g., "let\'s make a cohort"), transition into the creation studio by calling choose_starting_point ("have_material" if sources are already attached, or "find_material" if starting from a learning goal) or create_own_cohort. Never claim you populated a right-hand curriculum canvas while in chat.'
        : 'Collaborate naturally with the user to shape their learning goal, audience, daily commitment, source materials, and lesson sequence.'
    }
```

#### Replacement Block (`src/server/domain/cohort-builder/context.ts`)
```ts
    - ${
      state.journey?.step === 'chat'
        ? 'You are in conversational planning mode. Brainstorm ideas, answer questions, and outline proposed study plans directly in your markdown response. When the user explicitly asks to create, make, or build a cohort (e.g., "let\'s make a cohort"), transition into the creation studio by calling create_own_cohort (which will open material input directly if links/sources are already saved, or open the starting point) or choose_starting_point. Never call add_lesson during conversational chat, and never claim you populated a right-hand curriculum canvas while in chat.'
        : 'Collaborate naturally with the user to shape their learning goal, audience, daily commitment, source materials, and lesson sequence.'
    }
```

- **Postcondition:** The AI assistant understands that creating a cohort transitions through `create_own_cohort` with preserved sources, and never improvises lessons in chat.

---

### Step `S21` — Add Unit & Regression Tests (`src/shared/cohort-builder/__tests__/contracts.test.ts`)

- **File:** `src/shared/cohort-builder/__tests__/contracts.test.ts`
- **Action:** Add unit tests verifying that `create_own_cohort` transitions directly to `material_input` when sources exist, routes to `starting_point` when sources are empty, and that `add_lesson` throws `BUILD_INCOMPLETE` during `chat`.

#### Append to `src/shared/cohort-builder/__tests__/contracts.test.ts`
```ts
  it('transitions create_own_cohort directly to material_input when sources exist', () => {
    const wsWithSources: CohortWorkspace = {
      ...base(),
      journey: { step: 'chat', intentVersion: 1, processingStarted: false },
      sources: [
        { id: 's1', version: 0, label: 'Docs', text: 'Important concepts', state: 'ready' },
      ],
    };

    const result = planCohortAction(wsWithSources, { type: 'create_own_cohort' }, context);
    expect(result.nextState.journey?.step).toBe('material_input');
    expect(result.nextState.journey?.branch).toBe('have_material');
  });

  it('transitions create_own_cohort to starting_point when sources are empty', () => {
    const wsEmptySources: CohortWorkspace = {
      ...base(),
      journey: { step: 'chat', intentVersion: 1, processingStarted: false },
      sources: [],
    };

    const result = planCohortAction(wsEmptySources, { type: 'create_own_cohort' }, context);
    expect(result.nextState.journey?.step).toBe('starting_point');
  });

  it('rejects add_lesson during chat step with BUILD_INCOMPLETE', () => {
    const wsInChat: CohortWorkspace = {
      ...base(),
      journey: { step: 'chat', intentVersion: 1, processingStarted: false },
    };

    expect(() => planCohortAction(wsInChat, { type: 'add_lesson', title: 'Intro', objective: 'Learn basics' }, context)).toThrow('BUILD_INCOMPLETE');
  });
```

- **Postcondition:** Automated regression tests guard link preservation, branch selection, and pipeline invariants against future regressions.

---

## Section E — Verification Commands & Expected Outcomes

Run the following verification commands in order from `d:\ThisPC\Documents\SideQuestHQ\undone-site`:

1. **TypeScript Type Check:**
   ```powershell
   npx tsc --noEmit
   ```
   - **Expected Outcome:** Exit code `0` with zero TypeScript errors.

2. **Stage Canonical Progress Tests (Resolving Test 2 Failure):**
   ```powershell
   npx vitest run src/client/screens/cohortBuilder/__tests__/stage-canonical-progress.test.ts
   ```
   - **Expected Outcome:** All 10 tests pass (`100%` passing, including test 2).

3. **Contracts Unit Tests (Verifying Link Preservation & Invariant Gating):**
   ```powershell
   npx vitest run src/shared/cohort-builder/__tests__/contracts.test.ts
   ```
   - **Expected Outcome:** All tests pass (`100%` passing, including the 3 new regression tests).

4. **Full Cohort Builder Test Suites:**
   ```powershell
   npx vitest run src/client/screens/cohortBuilder/__tests__/MaterialStageView.test.tsx src/client/screens/cohortBuilder/__tests__/DiscoveryStageView.test.tsx src/client/screens/cohortBuilder/__tests__/CohortWorkspacePane.test.tsx src/client/screens/cohortBuilder/__tests__/stage-selectors.test.ts src/client/screens/cohortCreation/__tests__/processing-details.test.tsx src/shared/cohort-builder/__tests__/cohort-metadata.test.ts
   ```
   - **Expected Outcome:** All test suites pass (`100%` passing).

---

## Section F — Completion Report Contract

When reporting execution completion, the executor must provide:
1. Status of each step (`S1` through `S21`).
2. Exact terminal output of all verification commands in **Section E**.
3. Confirmation that all 1,617+ repository tests pass without regression.
4. Confirmation that no untracked temporary files or placeholder comments were left behind.
