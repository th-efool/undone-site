# Cohort Builder State-Machine, Editorial Material Intake, and YouTube Goal Discovery — Implementation Handoff Guide

## A. Execution contract

- **Readiness status:** `READY`
- **Repository root:** `d:\ThisPC\Documents\SideQuestHQ\undone-site`
- **OS / shell / toolchain:** Windows (`powershell`), `npm`, Node `>=24 <25`
- **Baseline git state:** Branch `master`, commit `1fab3482b2f91583dea6439f36a48103cda9d42d`. No `src/` files modified prior to execution.
- **Non-goals & Hard Guardrails:**
  - Do **not** allow `open_review` from `chat` or before `isBuildComplete(workspace)` is `true`.
  - Do **not** expose `add_lesson`, `draft_curriculum`, `edit_lesson`, `remove_lesson`, `reorder_lessons`, or `set_lesson_pin` in `STAGE_TOOL_NAMES.chat`.
  - Do **not** include any `Paste text` button or raw-text source mode in `MaterialStageView.tsx`. Only two source mode buttons may appear in `MaterialStageView.tsx`: `Paste a link` (active) and `Upload a file` (disabled).
  - Do **not** leave floating `stickyTopRight` `Continue to curriculum →` buttons in `MaterialStageView.tsx`; place `Continue to curriculum →` in the bottom `.continueSection` below `Added material`.
  - Do **not** use the complex AI web-citation discovery flow for `"Start with a goal"` (`DiscoveryStageView.tsx`). Instead, `"Start with a goal"` must look up YouTube videos and playlists via `/api/import/youtube/search?q=...`, let the user include (`+`) and exclude (`−`) items directly into `workspace.sources` (`Added material`), and when the user clicks `Continue to curriculum →`, dispatch `{ type: 'begin_material_processing' }` to proceed through the exact same processing flow (`1 Understanding -> 2 Chunking -> 3 Analyzing -> 4 Building -> Ready -> Editable preview`) as `"I already have material"`.
  - Do **not** leave legacy v1 `CreationExperience` mounted on `/quest/new` or `/quest/draft/[draftId]`; redirect both routes to `/quest/start`.

---

## B. Requirements and acceptance map

| Requirement ID | Requirement Summary | Files Involved | Verification Step |
|---|---|---|---|
| `REQ-1` | **Eliminate `chat -> review` bypass (`RC-1`):** `open_review` must strictly require `step === 'ready'` and `isBuildComplete(workspace) === true`. Remove the `Review curriculum` button from `CohortInteractionScreen.tsx` during `chat`. Hide the 4-stage stepper on `review`/`curriculum` if `!isBuildComplete(workspace)`. | `src/shared/cohort-builder/contracts.ts`, `src/shared/cohort-builder/creation-machine.ts`, `src/shared/cohort-builder/creation-view.ts`, `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx` | `npx vitest run src/shared/cohort-builder/__tests__/contracts.test.ts src/shared/cohort-builder/__tests__/creation-machine.test.ts` |
| `REQ-2` | **Fix `chat` AI tools & system prompt (`RC-2`):** Remove lesson-mutation tools from `STAGE_TOOL_NAMES.chat` and expose `choose_starting_point` and `create_own_cohort`. Update `context.ts` so `chat` brainstorms in markdown, transitions to studio only when asked to create a cohort, and never triggers stage transitions on `"?"` or general questions. | `src/server/domain/cohort-builder/tools.ts`, `src/server/domain/cohort-builder/context.ts` | `npx vitest run src/server/domain/cohort-builder/__tests__/ai-tools-optimization.test.ts` |
| `REQ-3` | **Restore editorial `"I already have material"` (`MaterialStageView`) & remove `Paste text` (`RC-3a`):** Keep the unified link/YouTube/playlist flow, remove `Paste text` completely (only `Paste a link` active and `Upload a file` disabled), restore editorial `MaterialStageView.module.css` (`InkUnderline`, polaroid collages, warm cream cards), and place `Continue to curriculum →` at the bottom below `Added material`. | `src/client/screens/cohortBuilder/stages/MaterialStageView.module.css`, `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx` | `npx vitest run src/client/screens/cohortBuilder/__tests__/material-stage-view.test.tsx src/client/screens/cohortBuilder/__tests__/journey-checkpoint3-material.test.tsx` |
| `REQ-4` | **Simplify `"Start with a goal"` (`DiscoveryStageView`) to YouTube video/playlist lookup with `+`/`−` include/exclude & shared `Continue to curriculum →` flow (`RC-3b`):** Create `GET /api/import/youtube/search?q=...`, render YouTube video & playlist search results with `+` (include into `workspace.sources`) and `−` (exclude from `workspace.sources`), render the shared `Added material` list and bottom `Continue to curriculum →` button (`begin_material_processing`), and render the top `<nav aria-label="Starting point">` bar on both `"I already have material"` and `"Start with a goal"`. | `src/app/api/import/youtube/search/route.ts`, `src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx`, `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx`, `src/shared/cohort-builder/creation-machine.ts` | `npx vitest run src/client/screens/cohortBuilder/__tests__/journey-checkpoint4-branch.test.tsx` |
| `REQ-5` | **Clean `UnderstandingStageView` controls & decommission legacy v1 routes (`RC-4` & `RC-5`):** Add `← Back to material` (`open_materials`) to `UnderstandingStageView.tsx` controls with clean left/right alignment in `UnderstandingProgress.module.css`, and redirect `/quest/new` and `/quest/draft/[draftId]` to `/quest/start`. | `src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx`, `src/client/screens/cohortCreation/components/UnderstandingProgress.module.css`, `src/app/(creation)/quest/new/page.tsx`, `src/app/(creation)/quest/draft/[draftId]/page.tsx` | `npx vitest run src/client/screens/cohortBuilder/__tests__/journey-checkpoint5-processing.test.tsx src/app/__tests__/tab-titles.test.ts` |

---

## C. File-change manifest

| Path | Action | Summary of Change |
|---|---|---|
| `src/shared/cohort-builder/contracts.ts` | `modify` | Require `step === 'ready'` and `isBuildComplete(next)` for `open_review`. |
| `src/shared/cohort-builder/creation-machine.ts` | `modify` | Add `step === 'discovery'` to `canBeginMaterialProcessing`; restrict `canOpenReview` to `!isPublished && step === 'ready' && buildComplete`. |
| `src/shared/cohort-builder/creation-view.ts` | `modify` | Hide stepper on `review` / `curriculum` when `!isBuildComplete(workspace)`. |
| `src/server/domain/cohort-builder/tools.ts` | `modify` | Remove lesson-mutation tools from `STAGE_TOOL_NAMES.chat` and add `'choose_starting_point'` and `'create_own_cohort'`. |
| `src/server/domain/cohort-builder/context.ts` | `modify` | Update `chat` stage instructions and add strict guard against calling transition tools on ambiguous queries like `"?"`. |
| `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx` | `modify` | Remove the `Review curriculum` shortcut button from the `isChatStep` header. |
| `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx` | `modify` | Render the compact `<nav aria-label="Starting point">` bar across `material_input`, `discovery`, and `goal_setup`. |
| `src/app/api/import/youtube/search/route.ts` | `create` | Add `GET /api/import/youtube/search?q=<query>` endpoint returning YouTube videos and playlists with 24h cache. |
| `src/client/screens/cohortBuilder/stages/MaterialStageView.module.css` | `modify` (write full file) | Restore editorial styling (`InkUnderline`, polaroid collages, warm cream cards, bottom `.continueSection`, and YouTube `+`/`−` result rows). |
| `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx` | `modify` (write full file) | Restore editorial layout, remove `Paste text` (leaving only `Paste a link` active and `Upload a file` disabled), and move `Continue to curriculum →` to the bottom `.continueSection`. |
| `src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx` | `modify` (write full file) | Implement `"Start with a goal"` as YouTube video/playlist lookup with `+` include / `−` exclude into `workspace.sources`, shared `Added material` list, and bottom `Continue to curriculum →` (`begin_material_processing`). |
| `src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx` | `modify` | Add `← Back to material` button (`open_materials`) when not running and refine control layout. |
| `src/client/screens/cohortCreation/components/UnderstandingProgress.module.css` | `modify` | Align `.controls` with `justify-content: space-between` and add `.secondaryBtn` styling. |
| `src/app/(creation)/quest/new/page.tsx` | `modify` (write full file) | Redirect legacy v1 `/quest/new` route to `/quest/start` while keeping `export const metadata`. |
| `src/app/(creation)/quest/draft/[draftId]/page.tsx` | `modify` (write full file) | Redirect legacy v1 `/quest/draft/[draftId]` route to `/quest/start` while keeping `export const metadata`. |
| `src/shared/cohort-builder/__tests__/contracts.test.ts` | `modify` | Update `open_review` contract tests to assert `open_review` from `chat` throws `INVALID_JOURNEY_TRANSITION`. |
| `src/shared/cohort-builder/__tests__/creation-machine.test.ts` | `modify` | Update `creation-machine` tests to assert `open_review` from `chat` is rejected and `begin_material_processing` from `discovery` is allowed. |
| `src/server/domain/cohort-builder/__tests__/ai-tools-optimization.test.ts` | `modify` | Update `chat` stage tool filter assertions to verify `choose_starting_point` and `create_own_cohort` are exposed and `add_lesson`/`draft_curriculum` are excluded. |
| `src/client/screens/cohortBuilder/__tests__/material-stage-view.test.tsx` | `modify` (write full file) | Verify `Paste text` is absent, only `Paste a link` (active) and `Upload a file` (disabled) exist, and `Continue to curriculum` is at the bottom. |
| `src/client/screens/cohortBuilder/__tests__/journey-checkpoint3-material.test.tsx` | `modify` | Update Test 7 to verify `Paste text` is removed and only `Paste a link` (active) and `Upload a file` (disabled) exist. |
| `src/client/screens/cohortBuilder/__tests__/journey-checkpoint4-branch.test.tsx` | `modify` (write full file) | Test the YouTube lookup + `+`/`−` include/exclude + `Continue to curriculum →` flow in `DiscoveryStageView` and `CohortWorkspacePane`. |

---

## D. Ordered implementation steps

### Step 1: Lock `open_review` to `ready` + `isBuildComplete` in `contracts.ts`, `creation-machine.ts`, and `creation-view.ts`

- **Goal:** Prevent jumping from `chat` (or any unbuilt state) directly to `review` (`Editable preview`), allow `begin_material_processing` from `discovery`, and hide the 4-stage stepper if `review`/`curriculum` is ever inspected without a completed build.
- **Files:**
  - `src/shared/cohort-builder/contracts.ts`
  - `src/shared/cohort-builder/creation-machine.ts`
  - `src/shared/cohort-builder/creation-view.ts`

#### 1.1 Edit `src/shared/cohort-builder/contracts.ts`

**Target:**
```ts
  if (action.type === 'open_review') {
    const current = requireStep(['ready', 'chat']);
    if (current.step === 'ready') {
      if (!isBuildComplete(next)) {
        throw new Error('ASSEMBLY_NOT_READY');
      }
    } else {
      if (
        next.processing.status === 'queued' ||
        next.processing.status === 'processing'
      ) {
        throw new Error('PROCESSING_ACTIVE');
      }
      if (next.lessons.length === 0) {
        throw new Error('NO_LESSONS');
      }
    }
    current.step = 'review';
    return navigationResult('Curriculum review opened.');
  }
```

**Replacement:**
```ts
  if (action.type === 'open_review') {
    const current = requireStep('ready');
    if (!isBuildComplete(next)) {
      throw new Error('ASSEMBLY_NOT_READY');
    }
    current.step = 'review';
    return navigationResult('Curriculum review opened.');
  }
```

#### 1.2 Edit `src/shared/cohort-builder/creation-machine.ts`

**Target:**
```ts
  const canBeginMaterialProcessing =
    !isPublished &&
    (workspace.sources ?? []).length > 0 &&
    (step === 'material_input' ||
      step === 'goal_setup' ||
      step === 'review' ||
      step === 'chat');
```

**Replacement:**
```ts
  const canBeginMaterialProcessing =
    !isPublished &&
    (workspace.sources ?? []).length > 0 &&
    (step === 'material_input' ||
      step === 'discovery' ||
      step === 'goal_setup' ||
      step === 'review' ||
      step === 'chat');
```

**Target:**
```ts
  const canOpenReview =
    !isPublished &&
    ((step === 'ready' && buildComplete) ||
      (step === 'chat' &&
        !processingActive &&
        (workspace.lessons ?? []).length > 0));
```

**Replacement:**
```ts
  const canOpenReview = !isPublished && step === 'ready' && buildComplete;
```

#### 1.3 Edit `src/shared/cohort-builder/creation-view.ts`

**Target:**
```ts
  const hideStepper =
    isJourneyInitialStep ||
    effectiveStage === 'published';
```

**Replacement:**
```ts
  const hideStepper =
    isJourneyInitialStep ||
    effectiveStage === 'published' ||
    ((effectiveStage === 'review' || effectiveStage === 'curriculum') &&
      !isBuildComplete(workspace));
```

---

### Step 2: Update `STAGE_TOOL_NAMES.chat` and `context.ts` System Instructions

- **Goal:** Prevent the AI in `chat` (Plan mode) from fabricating ungrounded lessons on the workspace canvas, allow it to transition into the creation studio via `choose_starting_point` or `create_own_cohort` when the user asks to create a cohort, and forbid calling stage-transition tools on ambiguous queries like `"?"`.
- **Files:**
  - `src/server/domain/cohort-builder/tools.ts`
  - `src/server/domain/cohort-builder/context.ts`

#### 2.1 Edit `src/server/domain/cohort-builder/tools.ts`

**Target:**
```ts
  chat: [
    ...ALWAYS_TOOLS,
    'set_audience',
    'set_daily_minutes',
    'edit_presentation',
    'start_discovery',
    'add_web_source',
    'add_youtube_source',
    'add_github_source',
    'add_text_source',
    'add_pdf_source',
    'draft_curriculum',
    'add_lesson',
    'edit_lesson',
    'remove_lesson',
    'reorder_lessons',
    'set_lesson_pin',
  ],
```

**Replacement:**
```ts
  chat: [
    ...ALWAYS_TOOLS,
    'set_audience',
    'set_daily_minutes',
    'edit_presentation',
    'create_own_cohort',
    'choose_starting_point',
    'start_discovery',
    'add_web_source',
    'add_youtube_source',
    'add_github_source',
    'add_text_source',
    'add_pdf_source',
  ],
```

#### 2.2 Edit `src/server/domain/cohort-builder/context.ts`

**Target:**
```ts
    `2. CONVERSATIONAL CO-DESIGN: ${
      step === 'chat'
        ? 'You are in conversational planning mode. Answer questions, brainstorm ideas, and refine the learning plan directly in chat. When asked to build or plan a deep curriculum, draft tailored lessons with draft_curriculum or add_lesson. Do NOT force the user into studio screens unless they explicitly ask to open or review the curriculum.'
        : 'Collaborate naturally with the user to shape their learning goal, audience, daily commitment, source materials, and lesson sequence.'
    }`,
    '3. TOOL PRECEDENCE: When the user explicitly asks to advance, go back, select a starting point, run discovery, or begin processing, call the matching stage tool FIRST before writing your conversational response.',
```

**Replacement:**
```ts
    `2. CONVERSATIONAL CO-DESIGN: ${
      step === 'chat'
        ? 'You are in conversational planning mode. Brainstorm ideas, answer questions, and outline proposed study plans directly in your markdown response. When the user explicitly asks to create, make, or build a cohort (e.g., "let\'s make a cohort"), transition into the creation studio by calling choose_starting_point ("have_material" if sources are already attached, or "find_material" if starting from a learning goal) or create_own_cohort. Never claim you populated a right-hand curriculum canvas while in chat.'
        : 'Collaborate naturally with the user to shape their learning goal, audience, daily commitment, source materials, and lesson sequence.'
    }`,
    '3. TOOL PRECEDENCE & AMBIGUITY GUARD: When the user explicitly asks to advance, go back, select a starting point, run discovery, or begin processing, call the matching stage tool FIRST before writing your conversational response. However, NEVER call choose_starting_point, create_own_cohort, or start_discovery when the user only sends a question mark ("?"), asks a clarifying question, or has not explicitly asked to transition stages.',
```

---

### Step 3: Remove `Review curriculum` Shortcut from `CohortInteractionScreen.tsx` and Unify Top Starting-Point Nav in `CohortWorkspacePane.tsx`

- **Goal:** Remove the `open_review` shortcut button from the centered `chat` view in `CohortInteractionScreen.tsx`, and render the compact `<nav aria-label="Starting point">` bar across `material_input`, `discovery`, and `goal_setup` in `CohortWorkspacePane.tsx`.
- **Files:**
  - `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx`
  - `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx`

#### 3.1 Edit `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx`

**Target:**
```ts
              <div className={styles.centeredTopActions}>
                {state.view.lessons.length > 0 && (
                  <button
                    type="button"
                    className={styles.reviewCurriculumButton}
                    onClick={() => {
                      void dispatchAction({ type: 'open_review' });
                    }}
                  >
                    Review curriculum ({state.view.lessons.length})
                  </button>
                )}
                <BuilderHeaderControls onExit={exitBuilder} />
              </div>
```

**Replacement:**
```ts
              <div className={styles.centeredTopActions}>
                <BuilderHeaderControls onExit={exitBuilder} />
              </div>
```

#### 3.2 Edit `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx`

**Target:**
```ts
  return (
    <main className={styles.workspacePane} aria-label="Cohort workspace">
      <div className={styles.workspaceTopBar}>
        {effectiveStage === 'material_input' ? (
          <nav
            aria-label="Starting point"
            className={`${startingStyles.container} ${startingStyles.compact}`}
          >
            <div className={startingStyles.optionsRow}>
              <button
                type="button"
                className={startingStyles.backButton}
                aria-label="Back to starting point"
                title="Back to starting point"
                onClick={async () => {
                  await dispatchAction({ type: 'back_to_starting_point' });
                }}
              >
                ←
              </button>
              {STARTING_POINT_CHOICES.map((choice) => {
                const isActive = effectiveStage === choice.stage;
                return (
                  <button
                    key={choice.value}
                    type="button"
                    aria-pressed={isActive}
                    className={`${startingStyles.pillButton} ${
                      isActive ? startingStyles.pillButtonActive : ''
                    }`}
                    onClick={async () => {
                      if (isActive) return;
                      const ok = await dispatchAction({
                        type: 'back_to_starting_point',
                      });
                      if (ok) {
                        await dispatchAction({
                          type: 'choose_starting_point',
                          choice: choice.value,
                        });
                      }
                    }}
                  >
                    <span className={startingStyles.pillTitle}>{choice.title}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        ) : !hideStepper ? (
```

**Replacement:**
```ts
  return (
    <main className={styles.workspacePane} aria-label="Cohort workspace">
      <div className={styles.workspaceTopBar}>
        {effectiveStage === 'material_input' ||
        effectiveStage === 'discovery' ||
        effectiveStage === 'goal_setup' ? (
          <nav
            aria-label="Starting point"
            className={`${startingStyles.container} ${startingStyles.compact}`}
          >
            <div className={startingStyles.optionsRow}>
              <button
                type="button"
                className={startingStyles.backButton}
                aria-label="Back to starting point"
                title="Back to starting point"
                onClick={async () => {
                  await dispatchAction({ type: 'back_to_starting_point' });
                }}
              >
                ←
              </button>
              {STARTING_POINT_CHOICES.map((choice) => {
                const isActive =
                  effectiveStage === choice.stage ||
                  (effectiveStage === 'goal_setup' && choice.stage === 'discovery');
                return (
                  <button
                    key={choice.value}
                    type="button"
                    aria-pressed={isActive}
                    className={`${startingStyles.pillButton} ${
                      isActive ? startingStyles.pillButtonActive : ''
                    }`}
                    onClick={async () => {
                      if (isActive) return;
                      const ok = await dispatchAction({
                        type: 'back_to_starting_point',
                      });
                      if (ok) {
                        await dispatchAction({
                          type: 'choose_starting_point',
                          choice: choice.value,
                        });
                      }
                    }}
                  >
                    <span className={startingStyles.pillTitle}>{choice.title}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        ) : !hideStepper ? (
```

---

### Step 4: Create `src/app/api/import/youtube/search/route.ts` for `"Start with a goal"` YouTube Lookup

- **Goal:** Provide a fast, cached endpoint `GET /api/import/youtube/search?q=<query>` that searches YouTube videos and playlists for the user's learning goal.
- **File:** `src/app/api/import/youtube/search/route.ts` (`create`)

**Write full file `src/app/api/import/youtube/search/route.ts`:**
```ts
import { NextRequest, NextResponse } from 'next/server';

export interface YouTubeSearchItem {
  id: string;
  kind: 'video' | 'playlist';
  title: string;
  channelTitle: string;
  description: string;
  thumbnailUrl?: string;
  url: string;
}

export interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE = new Map<string, { expiresAt: number; payload: YouTubeSearchResponse }>();

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    if (!q) {
      return NextResponse.json(
        { error: 'Missing search query parameter "q"' },
        { status: 400 }
      );
    }

    const normalizedQuery = q.toLowerCase().slice(0, 200);
    const cached = CACHE.get(normalizedQuery);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload);
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'YouTube search is not configured on the server (missing YOUTUBE_API_KEY).' },
        { status: 503 }
      );
    }

    const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video,playlist&maxResults=12&q=${encodeURIComponent(
      q.slice(0, 200)
    )}&key=${apiKey}`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      return NextResponse.json(
        { error: `YouTube API returned status ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const rawItems: any[] = Array.isArray(data?.items) ? data.items : [];
    const items: YouTubeSearchItem[] = [];
    const seenUrls = new Set<string>();

    for (const raw of rawItems) {
      const idObj = raw?.id;
      const snippet = raw?.snippet;
      const isPlaylist =
        idObj?.kind === 'youtube#playlist' || Boolean(idObj?.playlistId);
      const rawId: string | undefined = isPlaylist
        ? idObj?.playlistId
        : idObj?.videoId;

      if (!rawId || typeof rawId !== 'string') continue;

      const url = isPlaylist
        ? `https://www.youtube.com/playlist?list=${rawId}`
        : `https://www.youtube.com/watch?v=${rawId}`;

      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      const title = decodeHtmlEntities(
        String(snippet?.title || (isPlaylist ? 'YouTube Playlist' : 'YouTube Video'))
      );
      const channelTitle = decodeHtmlEntities(
        String(snippet?.channelTitle || 'YouTube')
      );
      const description = decodeHtmlEntities(
        String(snippet?.description || '')
      );
      const thumbnailUrl: string | undefined =
        snippet?.thumbnails?.medium?.url ??
        snippet?.thumbnails?.default?.url ??
        undefined;

      items.push({
        id: rawId,
        kind: isPlaylist ? 'playlist' : 'video',
        title,
        channelTitle,
        description,
        thumbnailUrl,
        url,
      });
    }

    const payload: YouTubeSearchResponse = { items };
    CACHE.set(normalizedQuery, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to search YouTube resources' },
      { status: 500 }
    );
  }
}
```

---

### Step 5: Restore Editorial `MaterialStageView.module.css`, `MaterialStageView.tsx`, and Build YouTube `+`/`−` `DiscoveryStageView.tsx`

- **Goal:**
  1. Restore the editorial aesthetic (`Playfair Display`, `InkUnderline`, polaroid collages, warm cream card, bottom `.continueSection` below `Added material`) in `MaterialStageView.module.css`.
  2. In `MaterialStageView.tsx` (`"I already have material"`), keep the flow intact (`Paste a link` supporting YouTube videos, YouTube playlists, and web articles -> `Added material` -> bottom `Continue to curriculum →`), and render **strictly 2 mode buttons** (`Paste a link` active and `Upload a file` disabled; **remove `Paste text` completely**).
  3. In `DiscoveryStageView.tsx` (`"Start with a goal"`), look up YouTube videos and playlists for the user's goal, let the user include (`+`) and exclude (`−`) items directly into `workspace.sources` (`Added material`), and render the exact same `Added material` list and bottom `Continue to curriculum →` button (`begin_material_processing`) as `"I already have material"`.
- **Files:**
  - `src/client/screens/cohortBuilder/stages/MaterialStageView.module.css`
  - `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`
  - `src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx`

#### 5.1 Write full file `src/client/screens/cohortBuilder/stages/MaterialStageView.module.css`

```css
.container {
  position: relative;
  width: 100%;
  min-height: 100%;
  padding: 2.5rem 2rem 5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-x: hidden;
  color: var(--text-primary, #1b1d36);
}

.decorations {
  display: none;
  pointer-events: none;
  user-select: none;
}

@media (min-width: 1320px) {
  .decorations {
    display: block;
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
}

.polaroidLeft {
  position: absolute;
  top: 2rem;
  left: 1.5rem;
  width: 176px;
  background: var(--bg-elevated, #ffffff);
  padding: 0.55rem 0.55rem 1.6rem;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08);
  transform: rotate(-6deg);
  border-radius: 4px;
}

.polaroidRight {
  position: absolute;
  top: 5rem;
  right: 1.5rem;
  width: 186px;
  background: var(--bg-elevated, #ffffff);
  padding: 0.55rem 0.55rem 1.6rem;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.09);
  transform: rotate(5deg);
  border-radius: 4px;
}

.polaroidImg {
  width: 100%;
  height: auto;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  display: block;
  border-radius: 2px;
}

.stickyNote {
  position: absolute;
  top: 16.5rem;
  left: 2.25rem;
  width: 168px;
  padding: 0.9rem;
  background: var(--bg-secondary, #f5f0e3);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
  transform: rotate(3deg);
  font-family: var(--font-Caveat), cursive;
  font-size: 1.25rem;
  line-height: 1.2;
  color: var(--text-primary, #1b1d36);
  text-align: center;
}

.contentWrapper {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 0.25rem;
}

.eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-secondary, #5a5d72);
}

.title {
  font-family: var(--font-Playfair_Display), Georgia, serif;
  font-size: clamp(2rem, 3.6vw, 2.85rem);
  font-weight: 700;
  line-height: 1.14;
  letter-spacing: -0.02em;
  color: var(--text-primary, #1b1d36);
  margin: 0;
}

.italicAccent {
  font-style: italic;
  font-weight: 600;
}

.subtitle {
  font-size: 0.96rem;
  line-height: 1.55;
  color: var(--text-secondary, #5a5d72);
  max-width: 540px;
  margin: 0;
}

.inputCard {
  width: 100%;
  background: var(--bg-elevated, #fcfaf5);
  border: 1px solid var(--border-subtle, rgba(27, 29, 54, 0.12));
  border-radius: 18px;
  padding: 1.5rem 1.6rem;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.fieldGroup {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary, #1b1d36);
}

.urlInputRow {
  display: flex;
  align-items: stretch;
  gap: 0.65rem;
  width: 100%;
}

.textInput {
  flex: 1;
  min-width: 0;
  padding: 0.78rem 1rem;
  font-size: 0.95rem;
  border-radius: 10px;
  border: 1px solid var(--border-subtle, rgba(27, 29, 54, 0.16));
  background: var(--bg-primary, #ffffff);
  color: var(--text-primary, #1b1d36);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.textInput:focus {
  outline: none;
  border-color: var(--accent-primary, #1e2570);
  box-shadow: 0 0 0 3px rgba(30, 37, 112, 0.12);
}

.submitBtn {
  padding: 0 1.25rem;
  border-radius: 10px;
  border: none;
  background: var(--accent-primary, #1b1d36);
  color: var(--text-inverse, #ffffff);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s ease, transform 0.1s ease;
}

.submitBtn:hover:not(:disabled) {
  opacity: 0.92;
}

.submitBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modeToolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.25rem;
}

.modeBtn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 999px;
  border: 1px solid var(--border-subtle, rgba(27, 29, 54, 0.14));
  background: var(--bg-primary, #ffffff);
  color: var(--text-secondary, #5a5d72);
  cursor: pointer;
  transition: all 0.15s ease;
}

.modeBtnActive {
  border-color: var(--accent-primary, #1e2570);
  background: rgba(30, 37, 112, 0.07);
  color: var(--accent-primary, #1e2570);
}

.modeBtn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.limitsLine {
  font-size: 0.8rem;
  color: var(--text-secondary, #5a5d72);
  margin: -0.5rem 0 0;
  text-align: center;
}

.errorBanner {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.25);
  color: #b91c1c;
  font-size: 0.86rem;
  font-weight: 500;
}

.resultsSection,
.sourcesSection {
  width: 100%;
  background: var(--bg-elevated, #fcfaf5);
  border: 1px solid var(--border-subtle, rgba(27, 29, 54, 0.12));
  border-radius: 16px;
  padding: 1.2rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.sourcesHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.sourcesTitle {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-primary, #1b1d36);
}

.sourcesCount {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary, #5a5d72);
}

.sourceList {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.sourceItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  padding: 0.7rem 0.9rem;
  border-radius: 12px;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-subtle, rgba(27, 29, 54, 0.1));
}

.sourceItemMain {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  flex: 1;
}

.sourceThumb {
  width: 64px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  background: rgba(27, 29, 54, 0.06);
}

.sourceInfo {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  flex: 1;
}

.sourceLabel {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary, #1b1d36);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sourceMeta {
  font-size: 0.76rem;
  color: var(--text-secondary, #5a5d72);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.kindBadge {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: rgba(30, 37, 112, 0.08);
  color: var(--accent-primary, #1e2570);
}

.sourceActions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.includeBtn,
.excludeBtn,
.removeBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  min-width: 2.25rem;
  height: 2.1rem;
  padding: 0 0.75rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.includeBtn {
  border: 1px solid var(--accent-primary, #1e2570);
  background: var(--accent-primary, #1e2570);
  color: #ffffff;
}

.includeBtn:hover:not(:disabled) {
  opacity: 0.9;
}

.excludeBtn,
.removeBtn {
  border: 1px solid rgba(220, 38, 38, 0.3);
  background: rgba(220, 38, 38, 0.06);
  color: #b91c1c;
}

.excludeBtn:hover:not(:disabled),
.removeBtn:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.12);
}

.includeBtn:disabled,
.excludeBtn:disabled,
.removeBtn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.continueSection {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  width: 100%;
  padding-top: 0.25rem;
}

.continueBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.85rem 1.65rem;
  border-radius: 999px;
  border: none;
  background: var(--accent-primary, #1b1d36);
  color: var(--text-inverse, #ffffff);
  font-size: 0.94rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(27, 29, 54, 0.16);
  transition: opacity 0.15s ease, transform 0.1s ease;
}

.continueBtn:hover:not(:disabled) {
  opacity: 0.94;
  transform: translateY(-1px);
}

.continueBtn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
  box-shadow: none;
}

.emptyHint {
  font-size: 0.86rem;
  color: var(--text-secondary, #5a5d72);
  text-align: center;
  padding: 0.75rem 0;
}
```

#### 5.2 Write full file `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from '@/src/shared/interaction/ChangeSet';
import { extractWebClient } from '@/src/client/lib/extraction/webClientExtractor';
import { extractYoutubeClient } from '@/src/client/lib/extraction/youtubeClientExtractor';
import { InkUnderline } from '@/src/client/screens/cohortCreation/components/Art';
import styles from './MaterialStageView.module.css';

export interface MaterialStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
}

const MAX_SOURCES = 100;

function isYouTubeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtu.be' ||
    host === 'www.youtu.be'
  );
}

function isYouTubePlaylistUrl(parsed: URL): boolean {
  if (!isYouTubeHost(parsed.hostname)) return false;
  return parsed.pathname.includes('/playlist') || parsed.searchParams.has('list');
}

function deriveHostLabel(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const path = parsed.pathname.replace(/\/$/, '');
    return `${parsed.hostname}${path ? path : ''}`.slice(0, 120);
  } catch {
    return urlStr.slice(0, 120);
  }
}

export function SourceItemRow({
  src,
  busy,
  onRemove,
}: {
  src: CohortWorkspace['sources'][number];
  busy: boolean;
  onRemove: (sourceId: string) => void;
}) {
  const kind = src.input?.kind ?? 'text';
  const kindLabel =
    kind === 'youtube' ? 'YouTube' : kind === 'web' ? 'Article' : kind;

  return (
    <li className={styles.sourceItem}>
      <div className={styles.sourceItemMain}>
        <div className={styles.sourceInfo}>
          <span className={styles.sourceLabel}>{src.label}</span>
          <span className={styles.sourceMeta}>
            <span className={styles.kindBadge}>{kindLabel}</span>
            <span>{src.state}</span>
          </span>
        </div>
      </div>
      <div className={styles.sourceActions}>
        <button
          type="button"
          className={styles.removeBtn}
          disabled={busy}
          onClick={() => onRemove(src.id)}
          aria-label={`Remove ${src.label}`}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

export function MaterialStageView({ workspace, dispatchAction }: MaterialStageViewProps) {
  const [url, setUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sources = workspace.sources ?? [];
  const atCapacity = sources.length >= MAX_SOURCES;
  const canContinue = sources.length > 0 && !busy;

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (atCapacity) {
      setErrorMessage('Maximum of 100 sources reached. Remove a source to add more.');
      return;
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setErrorMessage('Please enter a valid URL.');
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'https:') {
        setErrorMessage('URL must start with https://');
        return;
      }
    } catch {
      setErrorMessage('Please enter a valid https:// URL.');
      return;
    }

    setBusy(true);
    try {
      if (isYouTubeHost(parsed.hostname)) {
        if (isYouTubePlaylistUrl(parsed)) {
          const metaRes = await fetch(
            `/api/import/youtube/metadata?url=${encodeURIComponent(trimmedUrl)}`
          );
          if (!metaRes.ok) {
            const errData = await metaRes.json().catch(() => ({}));
            setErrorMessage(errData.error || 'Could not load YouTube playlist.');
            return;
          }
          const metaData = await metaRes.json();
          if (
            metaData.isPlaylist &&
            Array.isArray(metaData.videos) &&
            metaData.videos.length > 0
          ) {
            const remaining = MAX_SOURCES - sources.length;
            const batch = metaData.videos.slice(0, remaining).map((v: any) => ({
              url: v.url,
              label: v.title || deriveHostLabel(v.url),
              mode: 'video_observation' as const,
            }));
            const ok = await dispatchAction({
              type: 'add_youtube_sources_batch',
              sources: batch,
            });
            if (ok) {
              setUrl('');
            } else {
              setErrorMessage('Could not add playlist sources. Your input was retained.');
            }
            return;
          }
        }

        let extracted: Awaited<ReturnType<typeof extractYoutubeClient>> | null = null;
        try {
          extracted = await extractYoutubeClient(trimmedUrl);
        } catch {
          // Proceed with server-side fallback if client extraction fails
        }

        const resolvedLabel = extracted?.title || deriveHostLabel(trimmedUrl);
        const ok = await dispatchAction({
          type: 'add_youtube_source',
          url: trimmedUrl,
          label: resolvedLabel,
          mode: extracted?.transcript ? 'captions' : 'video_observation',
          value: extracted?.transcript || undefined,
          metadata: extracted
            ? {
                title: extracted.title,
                author: extracted.author,
                durationSeconds: extracted.durationSeconds,
                transcriptAvailable: extracted.transcriptAvailable,
                extractionMethod: extracted.extractionMethod,
                extractedAt: new Date().toISOString(),
              }
            : undefined,
        });

        if (ok) {
          setUrl('');
        } else {
          setErrorMessage('Could not save this action. Your input was retained.');
        }
        return;
      }

      let extracted: Awaited<ReturnType<typeof extractWebClient>> | null = null;
      try {
        extracted = await extractWebClient(trimmedUrl);
      } catch {
        // Proceed with server-side acquisition if client fetch fails
      }

      const resolvedLabel = extracted?.title || deriveHostLabel(trimmedUrl);
      const ok = await dispatchAction({
        type: 'add_web_source',
        url: trimmedUrl,
        label: resolvedLabel,
        extraction: extracted
          ? {
              text: extracted.text,
              checksum: extracted.checksum,
              locations: [{ index: 0, label: 'Article', start: 0, end: extracted.text.length }],
              provenance: {
                method: 'dom-readability',
                extractedAt: new Date().toISOString(),
              },
            }
          : undefined,
      });

      if (ok) {
        setUrl('');
      } else {
        setErrorMessage('Could not save this action. Your input was retained.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveSource = async (sourceId: string) => {
    setErrorMessage(null);
    setBusy(true);
    try {
      const ok = await dispatchAction({ type: 'remove_source', sourceId });
      if (!ok) {
        setErrorMessage('Could not remove source. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleContinue = async () => {
    if (!canContinue) return;
    setErrorMessage(null);
    setBusy(true);
    try {
      const ok = await dispatchAction({ type: 'begin_material_processing' });
      if (!ok) {
        setErrorMessage('Could not start curriculum processing. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.decorations} aria-hidden="true">
        <div className={styles.polaroidLeft}>
          <Image
            src="/polaroid_columns.png"
            alt=""
            width={180}
            height={220}
            className={styles.polaroidImg}
          />
        </div>
        <div className={styles.stickyNote}>
          Same content.
          <br />
          More progress.
        </div>
        <div className={styles.polaroidRight}>
          <Image
            src="/polaroid_books_mug.png"
            alt=""
            width={190}
            height={240}
            className={styles.polaroidImg}
          />
        </div>
      </div>

      <div className={styles.contentWrapper}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>A LITTLE CURIOSITY GOES A LONG WAY</span>
          <h1 className={styles.title}>
            Add <InkUnderline className={styles.italicAccent}>your material</InkUnderline>
          </h1>
          <p className={styles.subtitle}>
            Paste a public YouTube video, playlist, or article link. We’ll understand it and turn it into a structured learning journey.
          </p>
        </header>

        {errorMessage && (
          <div className={styles.errorBanner} role="alert">
            {errorMessage}
          </div>
        )}

        <form className={styles.inputCard} onSubmit={handleAddUrl}>
          <div className={styles.fieldGroup}>
            <label htmlFor="material-url-input" className={styles.label}>
              Public article or YouTube URL
            </label>
            <div className={styles.urlInputRow}>
              <input
                id="material-url-input"
                type="url"
                className={styles.textInput}
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={busy || atCapacity}
              />
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={busy || atCapacity}
              >
                {busy ? 'Adding…' : 'Add link'}
              </button>
            </div>
          </div>

          <div className={styles.modeToolbar} role="group" aria-label="Material input options">
            <button
              type="button"
              className={`${styles.modeBtn} ${styles.modeBtnActive}`}
              aria-pressed="true"
            >
              Paste a link
            </button>
            <button
              type="button"
              className={styles.modeBtn}
              disabled
              title="Temporarily unavailable"
            >
              Upload a file
            </button>
          </div>
        </form>

        <p className={styles.limitsLine}>
          Public YouTube videos, playlists and articles. Up to {MAX_SOURCES} sources.
        </p>

        {sources.length > 0 && (
          <section className={styles.sourcesSection} aria-label="Added material">
            <div className={styles.sourcesHeader}>
              <span className={styles.sourcesTitle}>Added material</span>
              <span className={styles.sourcesCount}>
                {sources.length} / {MAX_SOURCES} sources
              </span>
            </div>
            <ul className={styles.sourceList}>
              {sources.map((src) => (
                <SourceItemRow
                  key={src.id}
                  src={src}
                  busy={busy}
                  onRemove={handleRemoveSource}
                />
              ))}
            </ul>
          </section>
        )}

        <div className={styles.continueSection}>
          <button
            type="button"
            className={styles.continueBtn}
            disabled={!canContinue}
            onClick={handleContinue}
          >
            Continue to curriculum →
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 5.3 Write full file `src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx`

```tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from '@/src/shared/interaction/ChangeSet';
import type { YouTubeSearchItem } from '@/src/app/api/import/youtube/search/route';
import { extractYoutubeClient } from '@/src/client/lib/extraction/youtubeClientExtractor';
import { InkUnderline } from '@/src/client/screens/cohortCreation/components/Art';
import { SourceItemRow } from './MaterialStageView';
import styles from './MaterialStageView.module.css';

export interface DiscoveryStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
}

const MAX_SOURCES = 100;

export function DiscoveryStageView({ workspace, dispatchAction }: DiscoveryStageViewProps) {
  const [goal, setGoal] = useState(workspace.intent || '');
  const [results, setResults] = useState<YouTubeSearchItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyContinue, setBusyContinue] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playlistVideoUrls, setPlaylistVideoUrls] = useState<Record<string, string[]>>({});
  const autoSearchedIntentRef = useRef<string | null>(null);

  useEffect(() => {
    setGoal(workspace.intent || '');
  }, [workspace.intent]);

  const runYouTubeSearch = async (query: string) => {
    setSearching(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/import/youtube/search?q=${encodeURIComponent(query)}`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(
          errData?.error || 'Could not search YouTube right now. Please try again.'
        );
        setHasSearched(true);
        return;
      }
      const data = await res.json();
      setResults(Array.isArray(data?.items) ? data.items : []);
      setHasSearched(true);
    } catch {
      setErrorMessage('Could not search YouTube right now. Please try again.');
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const initialGoal = (workspace.intent || '').trim();
    if (!initialGoal || autoSearchedIntentRef.current === initialGoal) return;
    autoSearchedIntentRef.current = initialGoal;
    void runYouTubeSearch(initialGoal);
  }, [workspace.intent]);

  const sources = workspace.sources ?? [];
  const atCapacity = sources.length >= MAX_SOURCES;
  const canContinue = sources.length > 0 && !busyContinue && !searching;

  const getMatchingSourcesForItem = (item: YouTubeSearchItem) => {
    if (item.kind === 'playlist') {
      const knownUrls = new Set(playlistVideoUrls[item.id] ?? [item.url]);
      return sources.filter(
        (s) => s.input?.kind === 'youtube' && knownUrls.has(s.input.url)
      );
    }
    return sources.filter(
      (s) => s.input?.kind === 'youtube' && s.input.url === item.url
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const trimmed = goal.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a learning goal.');
      return;
    }
    if (trimmed !== (workspace.intent || '').trim()) {
      const saved = await dispatchAction({ type: 'set_intent', intent: trimmed });
      if (!saved) {
        setErrorMessage('Could not save your learning goal. Please try again.');
        return;
      }
    }
    autoSearchedIntentRef.current = trimmed;
    await runYouTubeSearch(trimmed);
  };

  const handleIncludeItem = async (item: YouTubeSearchItem) => {
    if (atCapacity) {
      setErrorMessage('Maximum of 100 sources reached. Exclude a source to add more.');
      return;
    }
    setErrorMessage(null);
    setBusyId(item.id);
    try {
      if (item.kind === 'playlist') {
        const metaRes = await fetch(
          `/api/import/youtube/metadata?url=${encodeURIComponent(item.url)}`
        );
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          if (
            metaData.isPlaylist &&
            Array.isArray(metaData.videos) &&
            metaData.videos.length > 0
          ) {
            const remaining = MAX_SOURCES - sources.length;
            const slice = metaData.videos.slice(0, remaining);
            const urls = slice.map((v: any) => String(v.url));
            const ok = await dispatchAction({
              type: 'add_youtube_sources_batch',
              sources: slice.map((v: any) => ({
                url: String(v.url),
                label: String(v.title || item.title),
                mode: 'video_observation' as const,
              })),
            });
            if (ok) {
              setPlaylistVideoUrls((prev) => ({ ...prev, [item.id]: urls }));
            } else {
              setErrorMessage('Could not include playlist. Please try again.');
            }
            return;
          }
        }
      }

      let extracted: Awaited<ReturnType<typeof extractYoutubeClient>> | null = null;
      try {
        extracted = await extractYoutubeClient(item.url);
      } catch {
        // Proceed with server fallback if client extraction fails
      }

      const ok = await dispatchAction({
        type: 'add_youtube_source',
        url: item.url,
        label: extracted?.title || item.title,
        mode: extracted?.transcript ? 'captions' : 'video_observation',
        value: extracted?.transcript || undefined,
        metadata: extracted
          ? {
              title: extracted.title,
              author: extracted.author,
              durationSeconds: extracted.durationSeconds,
              transcriptAvailable: extracted.transcriptAvailable,
              extractionMethod: extracted.extractionMethod,
              extractedAt: new Date().toISOString(),
            }
          : undefined,
      });
      if (!ok) {
        setErrorMessage('Could not include video. Please try again.');
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleExcludeItem = async (item: YouTubeSearchItem) => {
    const matched = getMatchingSourcesForItem(item);
    if (matched.length === 0) return;
    setErrorMessage(null);
    setBusyId(item.id);
    try {
      for (const src of matched) {
        const ok = await dispatchAction({ type: 'remove_source', sourceId: src.id });
        if (!ok) {
          setErrorMessage('Could not exclude source. Please try again.');
          break;
        }
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveSource = async (sourceId: string) => {
    setErrorMessage(null);
    setBusyId(sourceId);
    try {
      const ok = await dispatchAction({ type: 'remove_source', sourceId });
      if (!ok) {
        setErrorMessage('Could not remove source. Please try again.');
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleContinue = async () => {
    if (!canContinue) return;
    setErrorMessage(null);
    setBusyContinue(true);
    try {
      const ok = await dispatchAction({ type: 'begin_material_processing' });
      if (!ok) {
        setErrorMessage('Could not start curriculum processing. Please try again.');
      }
    } finally {
      setBusyContinue(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.decorations} aria-hidden="true">
        <div className={styles.polaroidLeft}>
          <Image
            src="/polaroid_columns.png"
            alt=""
            width={180}
            height={220}
            className={styles.polaroidImg}
          />
        </div>
        <div className={styles.stickyNote}>
          Pick your videos.
          <br />
          We build the path.
        </div>
        <div className={styles.polaroidRight}>
          <Image
            src="/polaroid_books_mug.png"
            alt=""
            width={190}
            height={240}
            className={styles.polaroidImg}
          />
        </div>
      </div>

      <div className={styles.contentWrapper}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>A LITTLE CURIOSITY GOES A LONG WAY</span>
          <h1 className={styles.title}>
            Start with <InkUnderline className={styles.italicAccent}>a goal</InkUnderline>
          </h1>
          <p className={styles.subtitle}>
            Search YouTube videos and playlists for your goal. Include or exclude them with + and −, then continue to your curriculum.
          </p>
        </header>

        {errorMessage && (
          <div className={styles.errorBanner} role="alert">
            {errorMessage}
          </div>
        )}

        <form className={styles.inputCard} onSubmit={handleSearch}>
          <div className={styles.fieldGroup}>
            <label htmlFor="discovery-goal-input" className={styles.label}>
              Your learning goal
            </label>
            <div className={styles.urlInputRow}>
              <input
                id="discovery-goal-input"
                type="text"
                className={styles.textInput}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What do you want to learn?"
                disabled={searching}
              />
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={searching}
              >
                {searching ? 'Searching…' : 'Find resources'}
              </button>
            </div>
          </div>
        </form>

        {results.length > 0 && (
          <section className={styles.resultsSection} aria-label="YouTube search results">
            <div className={styles.sourcesHeader}>
              <span className={styles.sourcesTitle}>YouTube videos & playlists</span>
              <span className={styles.sourcesCount}>{results.length} results</span>
            </div>
            <ul className={styles.sourceList}>
              {results.map((item) => {
                const matchedSources = getMatchingSourcesForItem(item);
                const isIncluded = matchedSources.length > 0;
                const isItemBusy = busyId === item.id;

                return (
                  <li key={item.id} className={styles.sourceItem}>
                    <div className={styles.sourceItemMain}>
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          className={styles.sourceThumb}
                        />
                      ) : null}
                      <div className={styles.sourceInfo}>
                        <span className={styles.sourceLabel}>{item.title}</span>
                        <span className={styles.sourceMeta}>
                          <span className={styles.kindBadge}>
                            {item.kind === 'playlist' ? 'Playlist' : 'Video'}
                          </span>
                          <span>{item.channelTitle}</span>
                        </span>
                      </div>
                    </div>
                    <div className={styles.sourceActions}>
                      {isIncluded ? (
                        <button
                          type="button"
                          className={styles.excludeBtn}
                          disabled={isItemBusy}
                          onClick={() => handleExcludeItem(item)}
                          aria-label={`Exclude ${item.title}`}
                          title="Exclude from material"
                        >
                          −
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.includeBtn}
                          disabled={isItemBusy || atCapacity}
                          onClick={() => handleIncludeItem(item)}
                          aria-label={`Include ${item.title}`}
                          title="Include in material"
                        >
                          +
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {hasSearched && !searching && results.length === 0 && !errorMessage && (
          <p className={styles.emptyHint}>
            No YouTube videos or playlists found for that query. Try refining your goal above.
          </p>
        )}

        {sources.length > 0 && (
          <section className={styles.sourcesSection} aria-label="Added material">
            <div className={styles.sourcesHeader}>
              <span className={styles.sourcesTitle}>Added material</span>
              <span className={styles.sourcesCount}>
                {sources.length} / {MAX_SOURCES} sources
              </span>
            </div>
            <ul className={styles.sourceList}>
              {sources.map((src) => (
                <SourceItemRow
                  key={src.id}
                  src={src}
                  busy={busyId === src.id}
                  onRemove={handleRemoveSource}
                />
              ))}
            </ul>
          </section>
        )}

        <div className={styles.continueSection}>
          <button
            type="button"
            className={styles.continueBtn}
            disabled={!canContinue}
            onClick={handleContinue}
          >
            Continue to curriculum →
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 6: Improve `UnderstandingStageView.tsx` Controls & Redirect Legacy v1 `/quest/new` and `/quest/draft/[draftId]` Routes

- **Goal:** Add a clean `← Back to material` secondary button to `UnderstandingStageView.tsx` (when not actively running) with left/right control alignment in `UnderstandingProgress.module.css`, and redirect legacy v1 `/quest/new` and `/quest/draft/[draftId]` routes to `/quest/start`.
- **Files:**
  - `src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx`
  - `src/client/screens/cohortCreation/components/UnderstandingProgress.module.css`
  - `src/app/(creation)/quest/new/page.tsx`
  - `src/app/(creation)/quest/draft/[draftId]/page.tsx`

#### 6.1 Edit `src/client/screens/cohortBuilder/stages/UnderstandingStageView.tsx`

**Target:**
```tsx
          <div className={styles.controls}>
            {isRunning && (
              <button
                type="button"
                className={styles.cancelBtn}
                disabled={busy !== null}
                onClick={() => act('cancel', { type: 'cancel_text_processing' })}
              >
                {busy === 'cancel' ? 'Canceling…' : 'Cancel processing'}
              </button>
            )}
            {isFailed && (
              <button
                type="button"
                className={styles.retryBtn}
                disabled={busy !== null}
                onClick={() => act('retry', { type: 'retry_processing' })}
              >
                {busy === 'retry' ? 'Retrying…' : 'Retry understanding'}
              </button>
            )}
          </div>
```

**Replacement:**
```tsx
          <div className={styles.controls}>
            {!isRunning ? (
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={busy !== null}
                onClick={() => act('back', { type: 'open_materials' })}
              >
                ← Back to material
              </button>
            ) : (
              <button
                type="button"
                className={styles.cancelBtn}
                disabled={busy !== null}
                onClick={() => act('cancel', { type: 'cancel_text_processing' })}
              >
                {busy === 'cancel' ? 'Canceling…' : 'Cancel processing'}
              </button>
            )}
            {isFailed && (
              <button
                type="button"
                className={styles.retryBtn}
                disabled={busy !== null}
                onClick={() => act('retry', { type: 'retry_processing' })}
              >
                {busy === 'retry' ? 'Retrying…' : 'Retry understanding'}
              </button>
            )}
          </div>
```

#### 6.2 Edit `src/client/screens/cohortCreation/components/UnderstandingProgress.module.css`

**Target:**
```css
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.retryBtn,
.cancelBtn {
```

**Replacement:**
```css
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  padding-top: 0.25rem;
}

.secondaryBtn,
.retryBtn,
.cancelBtn {
```

**Target:**
```css
.cancelBtn:disabled,
.retryBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Replacement:**
```css
.secondaryBtn {
  border-color: var(--border-subtle, rgba(27, 29, 54, 0.16));
  background: transparent;
  color: var(--text-secondary, #5a5d72);
}

.secondaryBtn:hover:not(:disabled) {
  border-color: var(--text-primary, #1b1d36);
  color: var(--text-primary, #1b1d36);
}

.secondaryBtn:disabled,
.cancelBtn:disabled,
.retryBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

#### 6.3 Write full file `src/app/(creation)/quest/new/page.tsx`

```tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Start a Learning Journey',
};

export default function NewQuestPage() {
  redirect('/quest/start');
}
```

#### 6.4 Write full file `src/app/(creation)/quest/draft/[draftId]/page.tsx`

```tsx
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Building Your Cohort',
};

export default function QuestDraftPage() {
  redirect('/quest/start');
}
```

---

### Step 7: Update Contract, Tool, and UI Test Suites

- **Goal:** Align unit and contract tests with the stricter `open_review` invariant, updated `STAGE_TOOL_NAMES.chat`, 2-button `MaterialStageView`, and YouTube `+`/`−` `DiscoveryStageView`.
- **Files:**
  - `src/shared/cohort-builder/__tests__/contracts.test.ts`
  - `src/shared/cohort-builder/__tests__/creation-machine.test.ts`
  - `src/server/domain/cohort-builder/__tests__/ai-tools-optimization.test.ts`
  - `src/client/screens/cohortBuilder/__tests__/material-stage-view.test.tsx`
  - `src/client/screens/cohortBuilder/__tests__/journey-checkpoint3-material.test.tsx`
  - `src/client/screens/cohortBuilder/__tests__/journey-checkpoint4-branch.test.tsx`

#### 7.1 Edit `src/shared/cohort-builder/__tests__/contracts.test.ts`

**Target:**
```ts
  it('preserves chat step when adding or drafting lessons and transitions to review only on open_review', () => {
    const chat = (): CohortWorkspace => ({
      ...empty(),
      journey: { version: 1, step: 'chat', branch: null, processingStarted: false, intentVersion: 0 },
    });

    const added = planCohortAction(
      chat(),
      { type: 'add_lesson', lessonId: 'lesson-1', title: 'Intro', objective: 'Basics', sourceChunkIds: [] },
      context
    ).nextState;
    expect(added.journey?.step).toBe('chat');
    expect(added.lessons).toHaveLength(1);

    const drafted = planCohortAction(
      chat(),
      {
        type: 'draft_curriculum',
        lessons: [{ id: 'lesson-1', title: 'Part 1', objective: 'Foundations' }],
      },
      context
    ).nextState;
    expect(drafted.journey?.step).toBe('chat');
    expect(drafted.lessons).toHaveLength(1);

    // Explicit open_review transitions to review
    const reviewed = planCohortAction(drafted, { type: 'open_review' }, context).nextState;
    expect(reviewed.journey?.step).toBe('review');

    // Editing lessons while already in review stays in review
    const editedInReview = planCohortAction(
      reviewed,
      { type: 'add_lesson', lessonId: 'lesson-2', title: 'Part 2', objective: 'Deep dive', sourceChunkIds: [] },
      context
    ).nextState;
    expect(editedInReview.journey?.step).toBe('review');

    // open_review from chat requires at least one lesson
    expect(() => planCohortAction(chat(), { type: 'open_review' }, context)).toThrow('NO_LESSONS');

    // open_review rejects if processing is active
    const busy = { ...drafted, processing: { ...drafted.processing, status: 'processing' as const } };
    expect(() => planCohortAction(busy, { type: 'open_review' }, context)).toThrow('PROCESSING_ACTIVE');
  });
```

**Replacement:**
```ts
  it('preserves chat step when adding or drafting lessons and rejects open_review from chat', () => {
    const chat = (): CohortWorkspace => ({
      ...empty(),
      journey: { version: 1, step: 'chat', branch: null, processingStarted: false, intentVersion: 0 },
    });

    const added = planCohortAction(
      chat(),
      { type: 'add_lesson', lessonId: 'lesson-1', title: 'Intro', objective: 'Basics', sourceChunkIds: [] },
      context
    ).nextState;
    expect(added.journey?.step).toBe('chat');
    expect(added.lessons).toHaveLength(1);

    const drafted = planCohortAction(
      chat(),
      {
        type: 'draft_curriculum',
        lessons: [{ id: 'lesson-1', title: 'Part 1', objective: 'Foundations' }],
      },
      context
    ).nextState;
    expect(drafted.journey?.step).toBe('chat');
    expect(drafted.lessons).toHaveLength(1);

    // open_review from chat is strictly forbidden (must go through material processing -> ready -> review)
    expect(() => planCohortAction(drafted, { type: 'open_review' }, context)).toThrow(
      'INVALID_JOURNEY_TRANSITION'
    );
  });
```

#### 7.2 Edit `src/shared/cohort-builder/__tests__/creation-machine.test.ts`

**Target:**
```ts
    const withLesson = transitionCreationState(
      base,
      {
        type: 'add_lesson',
        lessonId: 'l1',
        title: 'Lesson 1',
        objective: 'Learn basics',
        sourceChunkIds: [],
      },
      ctx
    ).nextState;

    const opened = transitionCreationState(withLesson, { type: 'open_review' }, ctx).nextState;
    expect(opened.journey?.step).toBe('review');
```

**Replacement:**
```ts
    const withLesson = transitionCreationState(
      base,
      {
        type: 'add_lesson',
        lessonId: 'l1',
        title: 'Lesson 1',
        objective: 'Learn basics',
        sourceChunkIds: [],
      },
      ctx
    ).nextState;

    expect(() =>
      transitionCreationState(withLesson, { type: 'open_review' }, ctx)
    ).toThrow('INVALID_JOURNEY_TRANSITION');
```

#### 7.3 Edit `src/server/domain/cohort-builder/__tests__/ai-tools-optimization.test.ts`

**Target:**
```ts
    const chatTools = Object.keys(
      createCohortBuilderTools({
        state: makeState(),
        stage: 'chat',
        commitAction: vi.fn(),
        searchYouTube: vi.fn(),
        importYouTube: vi.fn(),
        importWeb: vi.fn(),
        importGitHub: vi.fn(),
      })
    );
    expect(chatTools).toContain('draft_curriculum');
    expect(chatTools).toContain('add_lesson');
    expect(chatTools).not.toContain('choose_starting_point');
    expect(chatTools).not.toContain('create_own_cohort');
```

**Replacement:**
```ts
    const chatTools = Object.keys(
      createCohortBuilderTools({
        state: makeState(),
        stage: 'chat',
        commitAction: vi.fn(),
        searchYouTube: vi.fn(),
        importYouTube: vi.fn(),
        importWeb: vi.fn(),
        importGitHub: vi.fn(),
      })
    );
    expect(chatTools).toContain('choose_starting_point');
    expect(chatTools).toContain('create_own_cohort');
    expect(chatTools).not.toContain('draft_curriculum');
    expect(chatTools).not.toContain('add_lesson');
```

#### 7.4 Write full file `src/client/screens/cohortBuilder/__tests__/material-stage-view.test.tsx`

```tsx
// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  cohortWorkspaceSchema,
  type CohortAction,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';

const mocks = vi.hoisted(() => ({
  extractWebClient: vi.fn(),
  extractYoutubeClient: vi.fn(),
}));

vi.mock('@/src/client/lib/extraction/webClientExtractor', () => ({
  extractWebClient: (...args: unknown[]) => mocks.extractWebClient(...args),
}));

vi.mock('@/src/client/lib/extraction/youtubeClientExtractor', () => ({
  extractYoutubeClient: (...args: unknown[]) => mocks.extractYoutubeClient(...args),
}));

import { MaterialStageView } from '../stages/MaterialStageView';

function createWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Test Cohort',
    intent: 'Learn Consensus',
    audience: 'Engineers',
    dailyMinutes: 30,
    lessons: [],
    sources: [],
    chunks: [],
    understanding: [],
    analyses: [],
    processing: {
      status: 'idle',
      stage: 'done',
      generation: 0,
      sourceFingerprint: null,
      error: null,
    },
    journey: {
      version: 1,
      step: 'material_input',
      branch: 'have_material',
      processingStarted: false,
      intentVersion: 0,
    },
    ...overrides,
  });
}

describe('MaterialStageView: Editorial Link-Only Material Intake', () => {
  let dispatchedActions: CohortAction[] = [];

  beforeEach(() => {
    dispatchedActions = [];
    mocks.extractWebClient.mockReset();
    mocks.extractYoutubeClient.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Renders only Paste a link (active) and Upload a file (disabled), with no Paste text option', () => {
    const ws = createWorkspace();
    render(
      <MaterialStageView
        workspace={ws}
        dispatchAction={async (action) => {
          dispatchedActions.push(action);
          return true;
        }}
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: /Add your material/i })).toBeTruthy();
    expect(screen.getByLabelText(/Public article or YouTube URL/i)).toBeTruthy();

    const pasteLinkBtn = screen.getByRole('button', { name: 'Paste a link' });
    expect(pasteLinkBtn.getAttribute('aria-pressed')).toBe('true');

    const uploadFileBtn = screen.getByRole('button', { name: 'Upload a file' }) as HTMLButtonElement;
    expect(uploadFileBtn.disabled).toBe(true);

    expect(screen.queryByRole('button', { name: /Paste text/i })).toBeNull();

    const continueBtn = screen.getByRole('button', { name: /Continue to curriculum/i }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(true);
  });

  it('2. Adds an article URL, displays Added material, and enables Continue to curriculum', async () => {
    mocks.extractWebClient.mockResolvedValue({
      title: 'Raft Consensus Overview',
      text: 'Leader election and log replication.',
      checksum: 'c'.repeat(64),
    });

    const ws = createWorkspace();
    const { rerender } = render(
      <MaterialStageView
        workspace={ws}
        dispatchAction={async (action) => {
          dispatchedActions.push(action);
          return true;
        }}
      />
    );

    const urlInput = screen.getByLabelText(/Public article or YouTube URL/i);
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'https://raft.github.io/guide' } });
    });

    const addBtn = screen.getByRole('button', { name: 'Add link' });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    expect(dispatchedActions).toHaveLength(1);
    expect(dispatchedActions[0]).toMatchObject({
      type: 'add_web_source',
      url: 'https://raft.github.io/guide',
      label: 'Raft Consensus Overview',
    });

    const wsWithSource = createWorkspace({
      sources: [
        {
          id: 'src-1',
          version: 0,
          label: 'Raft Consensus Overview',
          text: 'Leader election and log replication.',
          checksum: 'c'.repeat(64),
          state: 'ready',
          input: { kind: 'web', url: 'https://raft.github.io/guide' },
        },
      ],
    });

    rerender(
      <MaterialStageView
        workspace={wsWithSource}
        dispatchAction={async (action) => {
          dispatchedActions.push(action);
          return true;
        }}
      />
    );

    expect(screen.getByText('Raft Consensus Overview')).toBeTruthy();
    const continueBtn = screen.getByRole('button', { name: /Continue to curriculum/i }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(continueBtn);
    });

    expect(dispatchedActions).toContainEqual({ type: 'begin_material_processing' });
  });
});
```

#### 7.5 Edit `src/client/screens/cohortBuilder/__tests__/journey-checkpoint3-material.test.tsx`

**Target:**
```ts
  it('7. Renders Upload a file and Paste text buttons as disabled with Temporarily unavailable tooltip', () => {
    const ws = createMaterialWorkspace();
    render(
      <MaterialStageView workspace={ws} dispatchAction={async a => { fake.actions.push(a); return true; }} />
    );

    const pasteLinkBtn = screen.getByRole('button', { name: 'Paste a link' });
    expect(pasteLinkBtn.getAttribute('aria-pressed')).toBe('true');

    const uploadBtn = screen.getByRole('button', { name: 'Upload a file' }) as HTMLButtonElement;
    const pasteTextBtn = screen.getByRole('button', { name: 'Paste text' }) as HTMLButtonElement;

    expect(uploadBtn.disabled).toBe(true);
    expect(uploadBtn.getAttribute('title')).toBe('Temporarily unavailable');
    expect(pasteTextBtn.disabled).toBe(true);
    expect(pasteTextBtn.getAttribute('title')).toBe('Temporarily unavailable');
  });
```

**Replacement:**
```ts
  it('7. Renders Paste a link active, Upload a file disabled, and completely omits Paste text', () => {
    const ws = createMaterialWorkspace();
    render(
      <MaterialStageView workspace={ws} dispatchAction={async a => { fake.actions.push(a); return true; }} />
    );

    const pasteLinkBtn = screen.getByRole('button', { name: 'Paste a link' });
    expect(pasteLinkBtn.getAttribute('aria-pressed')).toBe('true');

    const uploadBtn = screen.getByRole('button', { name: 'Upload a file' }) as HTMLButtonElement;
    expect(uploadBtn.disabled).toBe(true);
    expect(uploadBtn.getAttribute('title')).toBe('Temporarily unavailable');

    expect(screen.queryByRole('button', { name: /Paste text/i })).toBeNull();
  });
```

#### 7.6 Write full file `src/client/screens/cohortBuilder/__tests__/journey-checkpoint4-branch.test.tsx`

```tsx
// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  cohortWorkspaceSchema,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';

const fake = vi.hoisted(() => ({
  state: null as CohortWorkspace | null,
  actions: [] as any[],
  succeeds: true,
  session: {
    status: 'authenticated',
    data: { user: { id: 'owner-alice' } },
  } as { status: string; data: any },
  extractYoutubeClient: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => fake.session,
}));

vi.mock('@/src/client/interaction/hooks', () => ({
  useWorkspaceConnection: () => 'live',
  useInteractionState: () => ({
    workspaceId: 'ws-test-checkpoint4',
    revision: 1,
    view: fake.state,
  }),
  useWorkspaceView: () => fake.state,
  useDispatchAction: () => async (action: any) => {
    fake.actions.push(action);
    return fake.succeeds;
  },
  useWorkspaceMessages: () => [],
  useSendMessage: () => async () => true,
}));

vi.mock('@/src/client/interaction/provider', () => ({
  InteractionProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/src/client/lib/extraction/youtubeClientExtractor', () => ({
  extractYoutubeClient: (...args: unknown[]) => fake.extractYoutubeClient(...args),
}));

import { DiscoveryStageView } from '../stages/DiscoveryStageView';
import { CohortWorkspacePane } from '../CohortWorkspacePane';
import { ChatPane } from '../ChatPane';
import { getActiveStage, getEffectiveStage } from '../stage-selectors';

function createDiscoveryWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems Cohort',
    intent: 'Master Distributed Consensus',
    audience: 'Engineers',
    dailyMinutes: 30,
    lessons: [],
    sources: [],
    chunks: [],
    understanding: [],
    analyses: [],
    processing: {
      status: 'idle',
      stage: 'done',
      generation: 0,
      sourceFingerprint: null,
      error: null,
    },
    journey: {
      version: 1,
      step: 'discovery',
      branch: 'find_material',
      processingStarted: false,
      intentVersion: 0,
    },
    ...overrides,
  });
}

function createGoalWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Distributed Systems Cohort',
    intent: 'Master Distributed Consensus',
    audience: 'Engineers',
    dailyMinutes: 30,
    lessons: [],
    sources: [],
    chunks: [],
    understanding: [],
    analyses: [],
    processing: {
      status: 'idle',
      stage: 'done',
      generation: 0,
      sourceFingerprint: null,
      error: null,
    },
    journey: {
      version: 1,
      step: 'goal_setup',
      branch: 'have_goal',
      processingStarted: false,
      intentVersion: 0,
    },
    ...overrides,
  });
}

describe('Checkpoint 4: Journey Branch UI Suite (Discovery YouTube +/-, WorkspacePane, ChatPane)', () => {
  beforeEach(() => {
    fake.actions = [];
    fake.succeeds = true;
    fake.extractYoutubeClient.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'vid-1',
              kind: 'video',
              title: 'Raft Consensus Explained',
              channelTitle: 'Distributed Systems Channel',
              description: 'Deep dive into Raft.',
              url: 'https://www.youtube.com/watch?v=vid-1',
            },
            {
              id: 'pl-1',
              kind: 'playlist',
              title: 'MIT 6.824 Distributed Systems Playlist',
              channelTitle: 'MIT OpenCourseWare',
              description: 'Full lecture series.',
              url: 'https://www.youtube.com/playlist?list=pl-1',
            },
          ],
        }),
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('DiscoveryStageView (YouTube lookup + include/exclude +/-)', () => {
    it('1. Automatically looks up YouTube videos and playlists for saved intent and renders + include buttons', async () => {
      const ws = createDiscoveryWorkspace();
      await act(async () => {
        render(
          <DiscoveryStageView
            workspace={ws}
            dispatchAction={async (a) => {
              fake.actions.push(a);
              return true;
            }}
          />
        );
      });

      expect(screen.getByRole('heading', { level: 1, name: /Start with a goal/i })).toBeTruthy();
      expect(screen.getByText('Raft Consensus Explained')).toBeTruthy();
      expect(screen.getByText('MIT 6.824 Distributed Systems Playlist')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Include Raft Consensus Explained' })).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Include MIT 6.824 Distributed Systems Playlist' })
      ).toBeTruthy();
    });

    it('2. Includes a YouTube video with +, excludes it with -, and continues with begin_material_processing', async () => {
      fake.extractYoutubeClient.mockResolvedValue(null);
      const ws = createDiscoveryWorkspace();
      const { rerender } = await act(async () =>
        render(
          <DiscoveryStageView
            workspace={ws}
            dispatchAction={async (a) => {
              fake.actions.push(a);
              return true;
            }}
          />
        )
      );

      const includeBtn = screen.getByRole('button', { name: 'Include Raft Consensus Explained' });
      await act(async () => {
        fireEvent.click(includeBtn);
      });

      expect(fake.actions).toContainEqual({
        type: 'add_youtube_source',
        url: 'https://www.youtube.com/watch?v=vid-1',
        label: 'Raft Consensus Explained',
        mode: 'video_observation',
        value: undefined,
        metadata: undefined,
      });

      // Rerender with the added source in workspace.sources
      const wsWithSource = createDiscoveryWorkspace({
        sources: [
          {
            id: 'src-yt-1',
            version: 0,
            label: 'Raft Consensus Explained',
            text: '',
            checksum: null,
            state: 'queued',
            input: {
              kind: 'youtube',
              url: 'https://www.youtube.com/watch?v=vid-1',
              mode: 'video_observation',
            },
          },
        ],
      });

      await act(async () => {
        rerender(
          <DiscoveryStageView
            workspace={wsWithSource}
            dispatchAction={async (a) => {
              fake.actions.push(a);
              return true;
            }}
          />
        );
      });

      // Now shows - Exclude button and enables Continue to curriculum ->
      const excludeBtn = screen.getByRole('button', { name: 'Exclude Raft Consensus Explained' });
      expect(excludeBtn).toBeTruthy();

      const continueBtn = screen.getByRole('button', {
        name: /Continue to curriculum/i,
      }) as HTMLButtonElement;
      expect(continueBtn.disabled).toBe(false);

      await act(async () => {
        fireEvent.click(continueBtn);
      });

      expect(fake.actions).toContainEqual({ type: 'begin_material_processing' });

      // Clicking - Exclude dispatches remove_source
      await act(async () => {
        fireEvent.click(excludeBtn);
      });
      expect(fake.actions).toContainEqual({
        type: 'remove_source',
        sourceId: 'src-yt-1',
      });
    });

    it('3. Updates intent with set_intent when searching a modified goal and stops if set_intent fails', async () => {
      const ws = createDiscoveryWorkspace();
      await act(async () => {
        render(
          <DiscoveryStageView
            workspace={ws}
            dispatchAction={async (a) => {
              fake.actions.push(a);
              if (a.type === 'set_intent') return false;
              return true;
            }}
          />
        );
      });

      const input = screen.getByLabelText(/Your learning goal/i);
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Learn Rust Async' } });
      });

      const findBtn = screen.getByRole('button', { name: /Find resources/i });
      await act(async () => {
        fireEvent.click(findBtn);
      });

      expect(fake.actions).toContainEqual({ type: 'set_intent', intent: 'Learn Rust Async' });
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  describe('CohortWorkspacePane integration', () => {
    it('4. Renders DiscoveryStageView and top Starting point nav when journey.step is discovery', async () => {
      fake.state = createDiscoveryWorkspace();
      await act(async () => {
        render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
      });

      expect(screen.getByRole('heading', { level: 1, name: /Start with a goal/i })).toBeTruthy();
      expect(screen.getByRole('navigation', { name: 'Starting point' })).toBeTruthy();
      expect(screen.queryByRole('list', { name: 'Creation journey progress' })).toBeNull();
    });

    it('5. Renders DiscoveryStageView when journey.step is goal_setup and suppresses stepper nav', async () => {
      fake.state = createGoalWorkspace();
      await act(async () => {
        render(<CohortWorkspacePane onSelectLessonForChat={() => undefined} />);
      });

      expect(screen.getByRole('heading', { level: 1, name: /Start with a goal/i })).toBeTruthy();
      expect(screen.queryByRole('list', { name: 'Creation journey progress' })).toBeNull();
    });
  });

  describe('ChatPane suggestion chips & stage-selectors', () => {
    it('6. Renders discovery suggestion chips during discovery stage', () => {
      fake.state = createDiscoveryWorkspace();
      render(<ChatPane attachedEntity={null} onClearAttachedEntity={() => undefined} />);

      expect(screen.getByRole('button', { name: 'Search again' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Provide my sources' })).toBeTruthy();
    });

    it('7. getActiveStage and getEffectiveStage accurately identify discovery and goal_setup stages', () => {
      const discWs = createDiscoveryWorkspace();
      expect(getActiveStage(discWs)).toBe('discovery');
      expect(getEffectiveStage(discWs, 'chunking')).toBe('discovery');

      const goalWs = createGoalWorkspace();
      expect(getActiveStage(goalWs)).toBe('goal_setup');
      expect(getEffectiveStage(goalWs, 'analysis')).toBe('goal_setup');
    });
  });
});
```

---

## E. Verification and failure handling

Run the following verification commands in order from `d:\ThisPC\Documents\SideQuestHQ\undone-site`:

1. **Contract & State-Machine Unit Tests:**
   ```powershell
   npx vitest run src/shared/cohort-builder/__tests__/contracts.test.ts src/shared/cohort-builder/__tests__/creation-machine.test.ts src/shared/cohort-builder/__tests__/journey-actions.test.ts
   ```
   - *Expected:* 100% pass. If any test fails expecting `open_review` to succeed from `chat`, verify Step 1.1, Step 1.2, Step 7.1, and Step 7.2 were applied verbatim.

2. **AI Tool Filtering & Context Tests:**
   ```powershell
   npx vitest run src/server/domain/cohort-builder/__tests__/ai-tools-optimization.test.ts src/server/infrastructure/ai/__tests__/planning-source-context.test.ts
   ```
   - *Expected:* 100% pass.

3. **Material Intake, YouTube Goal Discovery, Processing, and Route Metadata Tests:**
   ```powershell
   npx vitest run src/client/screens/cohortBuilder/__tests__/material-stage-view.test.tsx src/client/screens/cohortBuilder/__tests__/journey-checkpoint3-material.test.tsx src/client/screens/cohortBuilder/__tests__/journey-checkpoint4-branch.test.tsx src/client/screens/cohortBuilder/__tests__/journey-checkpoint5-processing.test.tsx src/client/screens/cohortBuilder/__tests__/CohortWorkspacePane.test.tsx src/app/__tests__/tab-titles.test.ts
   ```
   - *Expected:* 100% pass.

4. **Typecheck & Production Build Gate:**
   ```powershell
   npx tsc --noEmit
   ```
   - *Expected:* Exit code `0` with zero TypeScript errors.

---

## F. Completion report contract

When execution of this handoff guide is complete, return a concise completion report containing:
1. **Status:** `COMPLETED` or `BLOCKED`
2. **Changed Files List:** Every created and modified file path.
3. **Verification Results:** Exact pass/fail counts and exit codes for commands 1–4 in Section E.
4. **Deviations:** `None` (or exact explanation if any anchor required adjustment).
