# Forensic Commit-by-Commit Audit & Root-Cause Remediation Plan (`356dc078` → `1fab3482`)

> **Scope & Status:** Investigation & Implementation Plan ONLY (`src/` is untouched and clean at `HEAD` `1fab3482`).
> This document audits **all 49 git commits** from `356dc078` (12 hours ago) through `1fab3482` (`HEAD`), reconstructs the exact production database event log for workspace `a4a16638-52ba-47e1-a3f8-bc1f170db525` shown in the screenshots, explains why fixes over the last 12 hours kept running in circles by treating symptoms instead of the architectural root causes, and specifies the complete, surgical plan to fix every issue permanently.

---

## Part 1: Forensic Database Trace of Workspace `a4a16638-52ba-47e1-a3f8-bc1f170db525` (Why `"lets make a cohort"` Jumped Straight to Final `Editable preview`)

We queried `interaction_workspaces`, `interaction_events`, `interaction_requests`, and `interaction_steps` in PostgreSQL for the exact workspace shown in Screenshots 1, 2, and 6 (`a4a16638-52ba-47e1-a3f8-bc1f170db525`). Here is the exact second-by-second chain of events:

| Rev | Timestamp (UTC) | Actor / Operation | What Happened in Code | Resulting State |
|---|---|---|---|---|
| **0 → 1** | `14:36:26Z` | `createWorkspace` (`intent: "nlp"`, `mode: "search"`) | User submitted `"nlp"` from the home bar in Search mode. | `journey.step = 'recommendations'`, right panel closed (`chat` layout). |
| **1 → 2** | `14:37:03Z` | AI Run `7497ff02` after user typed `"?"` | User sent `"?"`. Because `STAGE_TOOL_NAMES.recommendations` in [`tools.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-builder/tools.ts#L28-L35) exposed `choose_starting_point`, the AI **unilaterally called `choose_starting_point({ choice: 'have_goal' })`** (`step:7497ff02:1`), jumping the right panel to `discovery` (`Start with a goal`), and replied in chat with a 4-part NLP outline. | `journey.step = 'discovery'`, `branch = 'find_material'`. |
| **3 → 13** | `14:37:21Z` – `14:46:42Z` | User `commitAction` (`choose_starting_point`) | User clicked back and forth between `I already have material` (`material_input`, **Screenshot 1**) and `Start with a goal` (`discovery`, **Screenshot 2**), encountering the stripped-down UI introduced by commit `8ab41a00`. | Alternated between `material_input` and `discovery`. |
| **14** | `14:46:45Z` | User `commitAction` (`close_panel`) | User clicked the top-right `X` button (`Close workspace panel and return to chat`). [`transitionCreationState`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/shared/cohort-builder/creation-machine.ts#L502-L506) set `journey.step = 'chat'`. | `journey.step = 'chat'` (full-width chat view). |
| **15 → 18** | `14:46:52Z` – `14:46:55Z` | AI Run `81fcd545` after user typed `"lets make a cohort"` | User typed **`"lets make a cohort"`** in `chat`. Because commits `9e558b23`, `c39c2b7f`, and `cc638732` (from 12 hours ago) **removed `choose_starting_point` and `create_own_cohort` from `STAGE_TOOL_NAMES.chat`**, kept **`add_lesson` and `draft_curriculum` in `STAGE_TOOL_NAMES.chat`**, and instructed the model in [`context.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-builder/context.ts#L194-L202) to *"draft tailored lessons with draft_curriculum or add_lesson"* during `chat`, the AI **called `add_lesson` 4 times** with **zero sources, zero understanding, zero chunks, and zero analysis**! Worse, the AI hallucinated: *"I've populated your curriculum canvas with a structured 4-part NLP cohort... Take a look at the right-hand panel."* | `journey.step = 'chat'`, `lessons.length = 4`, `sources = []`, `understanding = []`, `chunks = []`, `analyses = []`, `processingStarted = false`. |
| **19** | `14:47:00Z` | User `commitAction` (`open_review`, Req `35e97403`) | Because `isChatStep && state.view.lessons.length > 0` was now true, [`CohortInteractionScreen.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/CohortInteractionScreen.tsx#L283-L293) (added in commit `c39c2b7f` 12 hours ago) rendered a **`Review curriculum (4)`** button in the top-right header. When clicked, it dispatched `{ type: 'open_review' }`. And because commit `c39c2b7f` (and `2838c5fd`) allowed `open_review` from `chat` whenever `lessons.length > 0` (`const canOpenFromChat = currentStep === 'chat' && state.lessons.length > 0`), [`creation-machine.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/shared/cohort-builder/creation-machine.ts#L507-L530) **fabricated `processing.stage = 'done'` and set `journey.step = 'review'`**, jumping straight to the final **`Editable preview` (`Publish cohort`)** screen (**Screenshot 6**)! | `journey.step = 'review'`, `processing.stage = 'done'`, `processingStarted = false`, `sources = []`, `understanding = []`, `chunks = []`. |

---

## Part 2: Complete Audit of All 49 Commits (Why the Last 12 Hours Ran in Circles)

Over the past 12 hours, 5 waves of commits tried to fix symptoms without resolving a core architectural contradiction introduced in `9e558b23` + `356dc078..cc638732`.

### Wave 1 (12 Hours Ago): `356dc078` → `0665eb3f` — The "Symptom Fix" That Created the Shortcut Trap
1. **Background (`9e558b23`, before `356dc078`):**
   - Previously, `add_lesson` and `draft_curriculum` were added to `STAGE_TOOL_NAMES.chat`, and `add_lesson` in `contracts.ts` had a side effect: `if (next.journey.step === 'chat') next.journey.step = 'review'`.
   - That meant whenever a user chatted in Plan mode (`chat`), the AI called `add_lesson` and **instantly jumped the screen to the final `Editable preview` (`review`) stage**.
2. **What Wave 1 (`356dc078`, `c39c2b7f`, `954eb330`, `cc638732`) did 12 hours ago:**
   - **`356dc078` (`fix(cohort-builder): guard pre-creation system prompt from chunk and excerpt leaks`):** Hid chunk/source excerpts from the system prompt when `processingStarted === false`.
   - **`c39c2b7f` (`feat(cohort-builder): preserve conversational planning on lesson add with explicit review navigation`):**
     - Instead of asking *"Why is the AI calling `add_lesson` in `chat` with zero sources and bypassing the entire 4-stage pipeline (`understanding -> chunking -> analysis -> building -> ready`)?"*, commit `c39c2b7f` **treated only the auto-jump symptom**:
     - It deleted `next.journey.step = 'review'` inside `add_lesson`, **left `add_lesson` and `draft_curriculum` enabled in `chat`**, added the **`Review curriculum ({lessons.length})`** button to the top header of [`CohortInteractionScreen.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/CohortInteractionScreen.tsx#L283-L293), and changed `open_review` in [`contracts.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/shared/cohort-builder/contracts.ts) to accept `'chat'` and **fabricate `processing = { status: 'ready', stage: 'done' }` and `journey.step = 'review'`**!
   - **`cc638732` (`fix(cohort-builder): scope chat-stage AI tools and intake intent precedence`):**
     - Removed `create_own_cohort`, `choose_starting_point`, `begin_material_processing`, `start_goal_generation`, and `start_discovery` from `STAGE_TOOL_NAMES.chat` while **keeping `add_lesson` and `draft_curriculum` in `STAGE_TOOL_NAMES.chat`**.
   - **Why this was a ticking time bomb:**
     - Once `choose_starting_point` and `create_own_cohort` were removed from `chat` (`cc638732`) while `add_lesson` and `draft_curriculum` were left in `chat` (`c39c2b7f`), **a user in `chat` who says `"lets make a cohort"` CANNOT be routed into the cohort creation pipeline by the AI!**
     - Instead, the AI is forced to call `add_lesson` / `draft_curriculum` in `chat`, tells the user *"Take a look at the right-hand panel"*, and gives the user a single button (`Review curriculum (4)`) that jumps **straight to the final `Editable preview` (`Publish cohort`) screen** with zero sources and zero 4-stage processing!

### Wave 2 (11 Hours Ago): `ae15e986` → `c9dc3a54` — Partial Quality Assessment Fixes
- **`ae15e986`:** Unified composer card styling in `ChatPane.tsx`.
- **`fbe9c469`:** Removed `commit_release` from AI tools, and **re-added `'start_discovery'` to `STAGE_TOOL_NAMES.chat`** (allowing the AI in `chat` to jump straight into `discovery` search results, but still not `starting_point` or `material_input`, and still keeping `add_lesson`/`draft_curriculum` in `chat`).
- **`5c43480b`:** Changed `/create-cohort` to redirect to `/quest/start`, **but missed `/quest/new` and `/quest/draft/[draftId]`**, which continued mounting the legacy v1 [`CreationExperience.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/CreationExperience.tsx) (causing **Screenshot 3** and **Screenshot 5** when visited directly or via Playwright).

### Wave 3 (7–8 Hours Ago): `0009cddb` → `eeb7077a` — Error Toast Migration
- Replaced inline error banners with `useFailureToast`. Unrelated to stage routing, except it touched `MaterialStageView.tsx` and `DiscoveryStageView.tsx` right before Wave 4.

### Wave 4 (6 Hours Ago): `8ab41a00` → `13944cdf` — Guide G3 Destroyed the Editorial UI of `MaterialStageView` & `DiscoveryStageView`
- **`8ab41a00` (`feat(cohort-builder): simplify material intake to single link input and 3 source modes`):**
  - Executed `plans/cohort-builder/IdiotHandOffGuide-cohort-material-intake.md`.
  - **What it broke (seen in Screenshots 1 & 2):**
    1. **Gutted [`MaterialStageView.module.css`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/MaterialStageView.module.css):** Replaced 559 lines of bespoke editorial styling (`Playfair Display` serif headers, `InkUnderline`, polaroid collages, warm paper cards, bottom action dock) with **6 lines of minified generic CSS**.
    2. **Gutted [`MaterialStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/MaterialStageView.tsx):** Replaced the 835-line editorial view with a 150-line skeleton, moved `Continue to curriculum →` into an unintuitive floating top-right `stickyTopRight` div (**Screenshot 1**), and kept a `Paste text` button inside `SOURCE_MODES`.
    3. **Gutted [`DiscoveryStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx):** Replaced the 275-line editorial discovery view with a 23-line barebones form (**Screenshot 2**), removed its `<nav aria-label="Starting point">` bar without enabling `showStartingPointNav` for `discovery` in [`CohortWorkspacePane.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/CohortWorkspacePane.tsx#L140-L141), and deleted the discovery resource selection checklist (`selectedIds`, `handleAcquireSelected`, `ResourceCard` grid) when `journey.step === 'discovery'`!

### Wave 5 (1–3 Hours Ago): `e01c4fdb` → `1fab3482` — State Machine Refactor That Preserved the `open_review` Bug & Stripped `ReadyStageView`
- **`e01c4fdb` & `2838c5fd`:** Extracted `creation-state.ts`, `creation-machine.ts`, `creation-view.ts`, and `creation-progress.ts`. However, [`creation-machine.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/shared/cohort-builder/creation-machine.ts#L507-L530) **copied the exact `canOpenFromChat` bug from `c39c2b7f`**, continuing to allow `open_review` to jump from `chat` directly to `review` (`Editable preview`) whenever the AI had called `add_lesson` in `chat`!
- **`fbd800a7` (`feat(cohort-builder): rebuild ready stage as build completion summary`):**
  - Replaced [`ReadyStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/ReadyStageView.tsx) (which used `BuildingArt`, `InkUnderline`, and `ReadyWorkspace.module.css`) with a plain centered white box (`ReadyStageView.module.css`).
  - Also changed [`CohortWorkspacePane.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/CohortWorkspacePane.tsx#L139) so `showProgressHeader` renders the 4-stage pipeline bar (`1 UNDERSTANDING  2 CHUNKING  3 ANALYZING  4 BUILDING`) even when `stage === 'review'` (**Screenshot 6**), which is why the 4 greyed-out stages appear above `Editable preview`!

---

## Part 3: Summary of Every Root Cause vs. Symptom

| # | User-Observed Failure | Why Previous Fixes Failed (Symptom Chasing) | True Architectural Root Cause |
|---|---|---|---|
| **RC-1** | **Typing `"lets make a cohort"` in `chat` bypasses the entire creation flow and jumps straight to final `Editable preview` (`Publish cohort`)** (Screenshot 6) | `c39c2b7f` only stopped `add_lesson` from auto-setting `step = 'review'`, while keeping `add_lesson`/`draft_curriculum` in `chat` and adding a `Review curriculum (4)` (`open_review`) button that jumps from `chat` straight to `review` with `sources: []` and `processingStarted: false`. | 1. `STAGE_TOOL_NAMES.chat` in [`tools.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-builder/tools.ts#L19-L27) exposes `add_lesson` and `draft_curriculum` (which mutate workspace `lessons` without sources or processing) while blocking `create_own_cohort` and `choose_starting_point`.<br>2. [`context.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-builder/context.ts#L194-L202) tells the AI in `chat` to call `add_lesson`/`draft_curriculum` when asked to build a cohort.<br>3. `open_review` in [`creation-machine.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/shared/cohort-builder/creation-machine.ts#L507-L530) allows `canOpenFromChat` (`step === 'chat' && lessons.length > 0`) to fabricate `processing.stage = 'done'` and jump straight to `review`. |
| **RC-2** | **Sending `"?"` in `recommendations` stage unexpectedly opens the right-hand `discovery` panel** (DB Rev 2 of `a4a16638`) | Never diagnosed previously. | `STAGE_TOOL_NAMES.recommendations` in [`tools.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-builder/tools.ts#L28-L35) includes `choose_starting_point` and `create_own_cohort` without strict prompt guardrails in [`context.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-builder/context.ts), so the model calls `choose_starting_point` even on an ambiguous `"?"` message. |
| **RC-3** | **3 different broken versions of Adding Source & Goal (`MaterialStageView` & `DiscoveryStageView`), unstyled white boxes, floating top-right `Continue to curriculum →`, and `Paste text` still visible** (Screenshots 1, 2, 3) | Guide G3 (`8ab41a00`) overwrote `MaterialStageView.tsx`, `MaterialStageView.module.css`, and `DiscoveryStageView.tsx` with barebones HTML/CSS skeletons instead of simplifying the source buttons inside the existing editorial design system. | Commit `8ab41a00` deleted the 559-line `MaterialStageView.module.css`, the polaroid/editorial layout of `MaterialStageView.tsx`, the resource selection UI of `DiscoveryStageView.tsx`, and the top `<nav aria-label="Starting point">` bar on `discovery`, while leaving `Paste text` in `SOURCE_MODES`. |
| **RC-4** | **`UnderstandingStageView` stage-progression buttons (`Start fresh understanding`, `Chunk selected material`, `Back to material`) are tiny, identical ghost pills buried inside the left card** (Screenshot 4) | Never addressed structurally. | In [`UnderstandingStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx#L218-L250) and [`UnderstandingStageView.module.css`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/UnderstandingStageView.module.css#L261-L296), the primary forward CTA (`Chunk selected material`) uses the exact same low-contrast secondary pill style (`.secondaryAction`) as `Start fresh understanding` and `Back to material`, cramped inside the left column instead of a clear primary CTA hierarchy. |
| **RC-5** | **Legacy `"Your learning query"` right-hand form (Screenshot 5) and legacy 6-button `Paste text` screen (Screenshot 3) still reachable** | Commit `5c43480b` only redirected `/create-cohort` → `/quest/start`. | [`src/app/quest/new/page.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/quest/new/page.tsx) and [`src/app/quest/draft/[draftId]/page.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/quest/draft/%5BdraftId%5D/page.tsx) still mount the deprecated v1 [`CreationExperience.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/CreationExperience.tsx). |

---

## Part 4: Definitive Remediation Plan (No Symptom Patching)

### Phase 1: Fix the State Machine, `chat` Stage Tools, and Conversational-to-Creation Handoff (Fixes RC-1 & RC-2)

1. **Eliminate the `chat` → `review` Shortcut in [`src/shared/cohort-builder/creation-machine.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/shared/cohort-builder/creation-machine.ts):**
   - In `case 'open_review'` (lines 507–530), **remove `canOpenFromChat` completely**.
   - `open_review` must **ONLY** succeed when `currentStep === 'ready' && isBuildComplete(workspace)` (or when already in `'review'`).
   - It is **never** legal to jump to `'review'` (`Editable preview` / `Publish cohort`) with `processingStarted === false` or without completing the 4-stage pipeline (`understanding -> chunking -> analysis -> building -> ready`).
2. **Remove the Header `Review curriculum (N)` Shortcut Button from [`src/client/screens/cohortBuilder/CohortInteractionScreen.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/CohortInteractionScreen.tsx):**
   - Remove the `isChatStep && state.view.lessons.length > 0` `Review curriculum ({state.view.lessons.length})` button from the top-right header (lines 283–293) that was added in `c39c2b7f`.
   - In `CohortWorkspacePane.tsx` (line 139), remove `stage === 'review'` from `showProgressHeader` so the 4-stage processing bar (`1 UNDERSTANDING ... 4 BUILDING`) is not rendered above `Editable preview` when in `review`.
3. **Fix `STAGE_TOOL_NAMES.chat` and `STAGE_TOOL_NAMES.recommendations` in [`src/server/domain/cohort-builder/tools.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-builder/tools.ts):**
   - **In `chat` (`Plan` mode):**
     - **Remove `'add_lesson'` and `'draft_curriculum'` from `STAGE_TOOL_NAMES.chat`!** In `chat` mode, the assistant discusses ideas, outlines concepts conversationally in markdown messages, and helps the user plan—it must **never** populate fake ungrounded `lessons` into workspace state before source material is acquired and processed through the 4 stages (`understanding -> chunking -> analysis -> assembly`).
     - **Restore `'create_own_cohort'` and `'choose_starting_point'` to `STAGE_TOOL_NAMES.chat`**, alongside `'set_cohort_title'`, `'set_target_audience'`, `'set_daily_minutes'`, and `'start_discovery'`:
       - When the user is chatting in `chat` mode and explicitly asks to create/make/build a cohort (e.g., `"lets make a cohort"`):
         - If the workspace already has retained sources (`state.sources.length > 0`), the assistant calls `choose_starting_point({ choice: 'have_material' })` (opening `material_input` with their sources ready to process).
         - If the user has been discussing a topic/goal and has no sources yet, the assistant calls `choose_starting_point({ choice: 'have_goal' })` or `create_own_cohort` (opening `starting_point` or `discovery` so they can find/select real materials and run the 4-stage pipeline).
       - If the user is just asking questions or brainstorming (e.g., `"what should I learn in NLP?"`, `"?"`), the assistant **must not call any stage-transition tool**—it replies conversationally in chat.
   - **In `recommendations` (`Search` mode):**
     - Only allow `create_own_cohort` or `choose_starting_point` when the user **explicitly** asks to build/create their own cohort (never on `"?"` or general questions).
4. **Update [`src/server/domain/cohort-builder/context.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-builder/context.ts):**
   - Replace the `step === 'chat'` instruction (`"When asked to build or plan a deep curriculum, draft tailored lessons with draft_curriculum or add_lesson"`) with explicit, unambiguous rules:
     - While in `chat` (Plan mode), brainstorm and outline ideas directly in your conversational markdown response.
     - **Only** when the user explicitly asks to create/make/start building a cohort (e.g., `"let's make a cohort"`, `"build a cohort from this"`), transition into the creation studio by calling `choose_starting_point` (`have_material` if sources are already attached, `have_goal` if starting from a topic/goal) or `create_own_cohort`. Never call stage-transition tools when the user is only asking a question or typing `"?"`.
     - Never tell the user *"Take a look at the right-hand panel"* or claim lessons were added to the canvas during `chat`.

---

### Phase 2: Restore the Editorial UI & Unify `"I already have material"` + `"Start with a goal"` (Fixes RC-3)

1. **`"I already have material"` ([`MaterialStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/MaterialStageView.tsx) + [`MaterialStageView.module.css`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/MaterialStageView.module.css)):**
   - **Flow:** Keep the existing flow intact (`Paste a link` accepts YouTube video URLs, YouTube playlist URLs via `/api/import/youtube/metadata`, and public article URLs via `extractWebClient` -> adds to `Added material` -> clicking `Continue to curriculum →` dispatches `{ type: 'begin_material_processing' }`).
   - **Strictly 2 Source Mode Buttons (`Paste a link` and `Upload a file`):**
     - **Completely remove `Paste text`** — only `Paste a link` (active) and `Upload a file` (disabled, `Temporarily unavailable`) are rendered.
   - **Editorial Styling & Layout:**
     - Restore the editorial `MaterialStageView.module.css` (`Playfair Display` serif headers, `InkUnderline`, polaroid collages on wide viewports, warm cream cards, and bottom `.continueSection` below `Added material` instead of floating top-right).
2. **`"Start with a goal"` ([`DiscoveryStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx) + [`src/app/api/import/youtube/search/route.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/api/import/youtube/search/route.ts)):**
   - **Simple YouTube Video & Playlist Lookup + `+` / `−` Include/Exclude:**
     - Add `GET /api/import/youtube/search?q=<query>` (`src/app/api/import/youtube/search/route.ts`) using `YOUTUBE_API_KEY` (`youtube/v3/search?part=snippet&type=video,playlist&maxResults=12`) with 24h in-memory caching.
     - In `DiscoveryStageView.tsx`, searching the user's learning goal saves `set_intent` (if changed) and queries `/api/import/youtube/search?q=...` to display matching YouTube videos and playlists.
     - Each YouTube video or playlist result has a **`+` (Include)** / **`−` (Exclude)** button:
       - Clicking **`+`** adds the video (`add_youtube_source`) or playlist videos (`add_youtube_sources_batch` via `/api/import/youtube/metadata`) directly into `workspace.sources` (`Added material`).
       - Clicking **`−`** removes the video (or playlist videos) from `workspace.sources` (`remove_source`).
     - Below the search results, renders the **exact same `Added material` list and bottom `Continue to curriculum →` button** (`dispatchAction({ type: 'begin_material_processing' })`) as `"I already have material"`, so clicking next proceeds through the exact same pipeline (`1 Understanding -> 2 Chunking -> 3 Analyzing -> 4 Building -> Ready -> Editable preview`).
3. **Shared Top Starting-Point Nav in [`CohortWorkspacePane.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/CohortWorkspacePane.tsx):**
   - Render `<nav aria-label="Starting point" className={startingStyles.compact}>` across both `material_input` (`I already have material`) and `discovery` / `goal_setup` (`Start with a goal`), allowing seamless switching while preserving `workspace.sources`.

---

### Phase 3: Fix `UnderstandingStageView` Controls Layout (Fixes RC-4)

1. **Clean Action Controls in [`UnderstandingStageView.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx) and [`UnderstandingProgress.module.css`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortCreation/components/UnderstandingProgress.module.css):**
   - Add a `← Back to material` secondary button (`dispatchAction({ type: 'open_materials' })`) when not actively running, and align secondary controls cleanly on the left with retry/action buttons on the right.

---

### Phase 4: Decommission Legacy v1 Routes `/quest/new` & `/quest/draft/[draftId]` (Fixes RC-5)

1. **Redirect [`src/app/(creation)/quest/new/page.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/(creation)/quest/new/page.tsx) and [`src/app/(creation)/quest/draft/[draftId]/page.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/(creation)/quest/draft/%5BdraftId%5D/page.tsx) to `/quest/start`:**
   - Replace the deprecated `CreationExperience` mount in both route files with server-side `redirect('/quest/start')` while keeping `export const metadata`, permanently eliminating the legacy v1 screens (`"Your learning query"`, 6-button `Paste text`, and manual stage advance buttons).

---

### Phase 5: Handoff Guide Execution (`plans/cohort-builder/IdiotHandOffGuide.md`)

All exact file modifications, new files, and updated unit/contract test suites are specified in full in [`plans/cohort-builder/IdiotHandOffGuide.md`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/plans/cohort-builder/IdiotHandOffGuide.md).
