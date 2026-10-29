# Fix video quest structure, complete playback coverage, overlap, and durations

Status: inspection complete; implementation proposed, not executed.

## Required result

Different source videos remain separate video lessons. One source video must appear once, with its original title and ordered parts underneath:

```text
There's never been a better time to go into math: …
  Part 1   [start–end] [actual duration]
  Part 2   [start–end] [actual duration]
  Part 3   [start–end] [actual duration]
  …
  End
```

`End` marks the actual end of the video, not another empty chunk. No repeated parent video rows for individual observations, no Part 0, no repeated source title beside every part, no omitted playback seconds, and no fabricated 3-minute durations.

The existing code expresses a 60-second minimum target and 15-second successive playback overlap. Preserve these as the implementation baseline. A genuinely short video can have one short part; merge tiny trailing remainders into the preceding part when practical.

## Inspection findings

The screenshot shows repeated source titles, one chunk per lesson, Part 0, 0:00–0:04 followed by 0:11–0:20, and identical 3m labels. It establishes a displayed coverage gap; it does not establish that the underlying video file lost frames.

1. **Assembly makes chunks into separate lessons.** `src/server/domain/cohort-builder/text-pipeline.ts`, `computeTextStage`, maps `state.chunks` directly into generated lessons with titles derived from observation text. Its acceptance path requires lesson count to equal chunk count. `text-assembly-processor.ts` repeats that count requirement. Delivery faithfully publishes each resulting lesson. This is a structural problem upstream of the UI.
2. **Text coverage is not video timeline coverage.** `text-pipeline.ts`, `splitSource`, currently groups timed locations toward 60 seconds and validates retained text characters. It does not require coverage from video time zero to the source duration. Its 24 KiB evidence bound can also produce smaller units. `src/server/domain/cohort-creation/material-observation.ts` explicitly permits and records unobserved temporal gaps. Observation intervals are evidence anchors, not a complete playback partition.
3. **Overlap is not guaranteed by the current helper.** `src/shared/cohort-builder/cohort-metadata.ts`, `deriveChunkVideoInterval`, extends a raw end by 15 seconds, clamped to the final observation end. It does not inspect the next chunk's start. A gap greater than 15 seconds still leaves missing playback; a smaller gap reduces the actual overlap. Leading/trailing video content outside observations is also excluded.
4. **Another chunking path changes duration without changing playback anchors.** `src/server/domain/cohort-creation/chunking.ts`, `groundChunkBoundaries`, calculates a minimum duration and backward overlap but leaves `sourceRefs` unchanged. Its existing minimum/overlap test checks duration numbers only. This cannot prove playable interval coverage or real overlap. Verify whether this path serves the affected cohort before changing its behavior, but align any active video path with the same contract.
5. **Part 0 is a direct indexing leak.** `src/shared/cohort-builder/delivery.ts` stores zero-based chunk order; `LessonRow.tsx` renders `Part {chunk.order}`. `delivery.adapter.ts` also assigns the source label as every chunk's title, explaining the repeated title within parts.
6. **Duration behavior differs between the screenshot and current local code.** Current `delivery.ts` calculates video lesson duration from chunk intervals; its 180-second floor is now limited to non-video lessons. Summing overlapping intervals still inflates a grouped video's duration. `delivery.adapter.ts` persists the duration and labels every chunk as `reading_estimate`, even for video. `cohortStore.ts` contains 3-minute chunk fallbacks. These are verified problems/candidates, but the exact origin of the screenshot's 3m requires checking the affected persisted payload and deployed revision.
7. **Fallbacks can hide missing timing.** `src/server/infrastructure/db/postgres/mappers/cohortMapper.ts` synthesizes five-minute chunks for missing chunk arrays and substitutes zero timestamps. Player/feed paths also need inspection during implementation so missing timing does not become apparently valid playback.

Scope of evidence: local source and supplied screenshot inspected. No production database, deployed revision, or actual retained artifact for this cohort was inspected. Current local 60-second grouping and duration logic mean it would be incorrect to attribute every screenshot symptom to today's code without that comparison. `directives/process_video.md` and `execution/inspect_videos.py` concern local media encoding/inspection, not this curriculum projection.

## Implementation sequence

### 1. Capture a reproducible affected-cohort fixture

- Resolve the exact cohort/workspace from the supplied page and authorized application data. Read its saved sources, source duration/provenance, observation locations, chunks, generated lessons, delivery payload, and deployed code/version.
- Compare saved output with current deterministic projection. Identify stale artifacts, publication snapshots, and mapper fallbacks separately.
- Retain a sanitized regression fixture for the observed 0:00–0:04 / 0:11–0:20 gap, repeated lessons, and 3m labels. Keep transient inspection output in `.tmp/`; never copy secrets into fixtures.

### 2. Define a source-level playback plan

- Introduce one shared, deterministic playback planner using the ordered parts and verified full video duration. Keep immutable text/evidence offsets separate from playable time ranges.
- Partition the full timeline into contiguous core intervals covering exactly `[0, videoDuration]`. Use meaningful boundaries near the existing 60-second target; merge tiny adjacent fragments/remainders. Internal byte-bounded evidence units must not force tiny learner-facing parts.
- Add 15 seconds of context across each successive boundary, clamped to the video end. Validate actual interval intersection, not a claimed overlap field. Consolidate boundary cases where a tiny final interval cannot satisfy the normal rule.
- Example for a 180-second source: playback parts `0:00–1:15`, `1:00–2:15`, `2:00–3:00`. This covers the full video and has 15 seconds of real overlap at each boundary.
- Explicitly include leading, internal, and trailing regions with no observations in playback. Do not invent a transcript or claim those regions were analyzed. Preserve observation limitations independently. If complete semantic analysis is required, missing observations require reacquisition/review, not fabricated summaries.
- If duration/timing cannot be verified, surface that limitation and block acceptance as a complete timed video. Do not substitute 0, 1 second, or 180 seconds as known duration.

### 3. Generate one video lesson containing all its parts

- Update `text-pipeline.ts` assembly and `text-assembly-processor.ts` validation together: group video chunks by canonical source identity/version in source order, and generate one stable lesson per video source with the original video title.
- Keep different videos separate even when their titles match. Preserve non-video behavior unless required by a shared invariant.
- Replace `lessons.length === chunks.length` checks with complete, ordered, exactly-once evidence membership checks appropriate to grouped lessons.
- Update `text-assembly-acceptance.ts`, `lesson-projection.ts`, preview, and delivery to use identical grouping. Handle pinned/manual lessons explicitly so old generated rows cannot survive beside the new grouped row or erase intentional edits.

### 4. Carry truthful timing and labels through delivery

- Extend shared contracts as needed for playback/core ranges, timing availability/provenance, and part identity. Use the shared playback plan in builder preview, delivery, persisted chunks, questline, and player/feed.
- In `delivery.ts`, set the full-video parent duration to verified source duration. Set each part duration to its actual playable end minus start. Do not sum overlapping parts to obtain unique source duration; keep any replay-inclusive study estimate separately named.
- In `delivery.adapter.ts`, retain accurate timing provenance, part metadata, and identifiers instead of labeling videos as reading estimates or duplicating the parent title.
- In `cohortMapper.ts`, `cohortStore.ts`, and the connected player/feed adapters, remove fabricated timing fallback behavior for these video records. Format short durations in seconds and longer durations as minutes plus seconds.
- In `LessonRow.tsx`, render one parent row, child labels Part 1 through Part N, and an end marker. Keep internal ordering zero-based; convert only at the display boundary. All jump links must resolve to the same stored playable starts/ends.
- Update lesson/quest counts, completion totals, season summaries, and navigation to reflect grouped video lessons with independently tracked parts.

### 5. Repair existing output safely

- Version the changed chunking/assembly/delivery algorithms and publication hash inputs. Preserve acquisition identities and reusable retained source artifacts; do not bump the global algorithm version indiscriminately or rerun paid observation by default.
- Implement a dry-run repair that reports old/new lesson counts, part ranges, coverage gaps, overlap, durations, and ID mappings for the affected cohort.
- Rebuild from retained evidence and verified duration. Replace stale generated lessons rather than appending another set. Handle manual edits and existing learner progress through explicit mappings; do not mark newly included content complete merely because old fragments were complete.
- Materialize through existing transactional/idempotent release paths. Preserve rollback data and avoid creating a duplicate learner cohort when the user expects the existing cohort repaired. Confirm the publication identity/update strategy before applying repair.
- This planning task performs no regeneration, paid provider calls, production writes, or deployment.

### 6. Regression checks and acceptance

- One video with many observations produces exactly one parent lesson and sequential Part 1…N. Two distinct videos produce exactly two parents, including when titles match.
- Playback interval union equals the complete verified video timeline: first start 0; last end full duration; no internal gap, including 0:04–0:11. All bounds are valid and monotonic.
- Successive intervals have real 15-second overlap under the normal rule. Short-source/end cases are explicitly tested and consolidated as needed.
- Ordinary non-final parts meet the 60-second baseline without merely inflating a duration field. Test sparse observations, byte-limit splits, Unicode evidence, leading/trailing gaps, and tiny remainders.
- Exact retained evidence and checksums remain intact. Added playback context never masquerades as observed text. Missing metadata produces an explicit incomplete state.
- Parent duration equals the full source duration; part duration equals actual interval length. No blanket 3m label, no overlap double-counting, no Part 0, and no repeated parent title in child rows.
- Exercise the complete projection → persistence → mapper → questline/player path; verify links, part transitions, progress, counts, and restart/idempotent repair behavior.
- Expand existing focused tests in `text-pipeline.test.ts`, `text-assembly-acceptance.test.ts`, `text-assembly-processor.test.ts`, `cohort-metadata.test.ts`, `delivery.test.ts`, `cohortMapper.test.ts`, and the applicable creation chunking tests. Add a focused LessonRow regression and run type checking after implementation.
- Inspect the repaired cohort visually at desktop and mobile widths. Verify the actual saved/reloaded output, not just a mock.
- Update `MEMORY/cohort-builder-processing.md` with the new grouping/playback contract after implementation; leave the unrelated media-encoding directive unchanged.

## Completion condition

The affected existing cohort displays each distinct video once, with correctly numbered substantial parts, complete start-to-end playback, real successive overlap, truthful durations, working navigation, and preserved/mapped learner state. Passing unit tests alone is insufficient; the persisted cohort must meet these conditions after reload.


---
---

# Cleanup & Lean-down Plan — Composer / Client-Extraction / Plan-Chat (commits 6fb117ef..7013bb91)

Reviewed 39 files (+3813/−161). Tags: **[BUG]** defect, **[DUP]** duplicate/dead, **[LEAN]** over-engineered, **[RISK]** latent hazard.
User decisions locked in:
1. **A3 (YouTube Transcripts)**: Fetch real captions when available via `/api/import/youtube/transcript`; fall back cleanly to factual video metadata/chapters when captions are unavailable.
2. **B2 (SHA-256)**: Keep `src/shared/cohort-builder/hash.ts` zero-dependency and small; remove the redundant manual UTF-8 surrogate-pair encoder (`utf8Encode`).
3. **B6 (Legacy Import Routes)**: Delete only routes confirmed to have zero active call sites; preserve `/api/import/{notion,github,youtube/playlist}` while `src/app/(dashboard)/create-cohort/page.tsx` (`importService.ts`) remains mounted.

---

## Execution Status Snapshot (Where Previous Run Paused)

### Already Completed in Working Tree (Uncommitted, Passing `tsc --noEmit` & 25/25 Vitest)
- **[DONE] B5**: Created `src/shared/cohort-builder/source-kind.ts` (`detectSourceKind`) + `src/shared/cohort-builder/__tests__/source-kind.test.ts`.
- **[DONE] A3**: Created `src/app/api/import/youtube/transcript/route.ts` using `LiveYoutubeTranscriptProvider` + `normalizeTranscriptPayload`.
- **[DONE] A2, A3, B3**: Updated `src/client/lib/sourceExtractors/youtubeClientExtractor.ts` to use shared `formatYoutubeTimestamp`, fetch real transcripts first (~90s/2000-char windows), and fall back to factual metadata/chapters with `estimatedIntervals: true` and `limitations` (zero invented `"Core concept: Part 2"` titles).
- **[DONE] B4, C10**: Updated `src/client/lib/sourceExtractors/githubClientExtractor.ts` to use `pLimit(6)` bounded concurrency and renamed `extractGithubRepoClient` directly to `extractGithubClient`.
- **[DONE] A4, B10**: Updated `src/client/lib/sourceExtractors/pdfClientExtractor.ts` to bundle the worker via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()`, removed duplicate `OffscreenCanvas` branch, and threw honest error on empty/scanned PDFs. Kept `declare module 'pdfjs-dist';` in `src/types/ambient.d.ts` (required by TypeScript `bundler` resolution for `pdfjs-dist@6.4.299`).
- **[DONE] C9**: Updated `src/app/api/import/link-preview/route.ts` to strip `<script>`, `<style>`, `<noscript>`, `<svg>` blocks on server, and `src/client/lib/sourceExtractors/webClientExtractor.ts` to throw honest error when page has no readable text.
- **[DONE] C4**: Collapsed `src/client/components/global/Composer/SourceIcon.tsx` from 192 lines to 69 lines (`ICONS` record + single `<svg>` wrapper; dropped unused `variant="mono"`).
- **[DONE] B5, B12, C5**: Cleaned `LinkRows.tsx`, `AttachmentTray.tsx` (removed `file?: File` retention from React state), and `Composer/index.ts`.
- **[DONE] A1, A5 (hook side), C1, C2, C5**: Refactored `src/client/components/global/Composer/useComposerAttachments.ts` (372 -> 198 lines) with YouTube playlist fan-out (reusing batch metadata without re-fetching, cap 100), 3MB total UTF-8 text budget (`MAX_TOTAL_TEXT_BYTES`), and `useSyncedList` ref synchronization. Added `src/client/components/global/Composer/__tests__/useComposerAttachments.test.tsx`.

---

## Remaining Execution Plan (Step-by-Step Instructions for Executor)

Execute the following 6 steps sequentially. Do **not** skip any verification gate.

### Step 1 — Isomorphic Hash & Single Shared Deterministic Pipeline (`B1, B2, B11, C6`)

#### 1.1 `src/shared/cohort-builder/hash.ts` (**B2**)
- Delete the manual `utf8Encode(str: string)` function (lines 30–65).
- In `sha256(value: string | Uint8Array)`, encode strings directly with `const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;`.

#### 1.2 `src/shared/cohort-builder/client-pipeline.ts` (**B1, C6**)
- In `byteLengthUtf8(str: string)` (lines 18–37), replace the manual surrogate loop with `return new TextEncoder().encode(str).byteLength;`.
- Export `validateCoverage` and `validateChunk` (already exported) and `projectGeneratedLessons` (already exported).
- Ensure `sourceFingerprint` accepts `Pick<CohortWorkspace, 'sources'>`.

#### 1.3 `src/server/domain/cohort-builder/text-pipeline.ts` & `lesson-projection.ts` (**B1**)
- In `src/server/domain/cohort-builder/lesson-projection.ts`, replace the duplicate implementation with a direct re-export:
  ```ts
  export { projectGeneratedLessons } from '@/src/shared/cohort-builder/client-pipeline';
  ```
- In `src/server/domain/cohort-builder/text-pipeline.ts`:
  - Remove `createHash` from `'node:crypto'`.
  - Remove duplicate definitions of `MAX_UNIT_BYTES`, `MIN_VIDEO_CHUNK_MS`, `sourceFingerprint`, `pushBoundedTextChunks`, `splitSource`, `validateCoverage`, `validateChunk`, `isVideoSource`, `lessonCopy`, `buildGeneratedLessons`, and `validateGeneratedLessonCoverage`.
  - Import and re-export from `@/src/shared/cohort-builder/client-pipeline`:
    ```ts
    import { sha256 } from '@/src/shared/cohort-builder/hash';
    import {
      MAX_UNIT_BYTES,
      MIN_VIDEO_CHUNK_MS,
      sourceFingerprint,
      splitSource,
      validateCoverage,
      validateChunk,
      buildGeneratedLessons,
      validateGeneratedLessonCoverage,
      projectGeneratedLessons,
    } from '@/src/shared/cohort-builder/client-pipeline';

    export {
      MAX_UNIT_BYTES,
      MIN_VIDEO_CHUNK_MS,
      sourceFingerprint,
      splitSource,
       validateCoverage,
      validateChunk,
      buildGeneratedLessons,
      validateGeneratedLessonCoverage,
    };
    ```
  - In `computeTextStage` and `planTextStage`, replace `digest(x)` with `sha256(x)`.
  - Keep `TextStage`, `TextStageAction`, `computeTextStage`, `planTextStage`, and `planTextFailure` in `text-pipeline.ts` untouched in behavior.

#### 1.4 CSS Orphan Cleanup (**B11**)
- Inspect `src/client/components/global/Composer/AttachmentTray.module.css`: remove unused `.errorBadge` (lines 155–161) if not referenced in `AttachmentTray.tsx`.
- Inspect `src/client/components/global/Composer/LinkRows.module.css`: verify all classes are referenced in `LinkRows.tsx`.

#### 1.5 Step 1 Verification
- Run: `npx vitest run src/shared/cohort-builder/__tests__/hash.test.ts src/shared/cohort-builder/__tests__/client-pipeline.test.ts src/server/domain/cohort-builder/__tests__/text-pipeline.test.ts`

---

### Step 2 — Single-Tree Centered Layout in `CohortInteractionScreen.tsx` & `ChatPane.tsx` (`A8, B9, C3`)

#### 2.1 Why
Currently `InnerBuilderScreen` in `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx` has an `if (isChatStep) { return ... }` early return (lines 75–116) that renders `<main><ChatPane /></main>`, while the split branch renders `<aside><ChatPane /></aside><div className={styles.canvas}>...</div>`. When the user transitions from `step === 'chat'` to `step === 'recommendations'` (or closes the panel back to `chat`), React unmounts and remounts `<ChatPane />`, wiping local `input` draft state and scroll position.

#### 2.2 `src/client/screens/cohortBuilder/ChatPane.tsx` (**B9**)
- Remove `isCentered?: boolean` from `ChatPaneProps` and component signature.
- Render `<div className={styles.railBody}>` (remove `${isCentered ? styles.centeredChatPane : ''}`).

#### 2.3 `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx` (**A8, C3**)
- Remove the `if (isChatStep)` early-return block (lines 75–116).
- Render a **single** root `<div id="main-content" className={styles.page} data-theme={theme} data-layout={isChatStep ? 'centered' : 'split'} data-variant={stage} data-rail-collapsed={!isChatStep && collapsed} data-pane={pane}>`.
- Inside `<div id="main-content">`:
  1. Render `<nav className={styles.paneNavigation} aria-label="Builder views">` only when `!isChatStep` (`{!isChatStep && (<nav ...>...</nav>)}`).
  2. Render `<aside className={styles.rail} aria-label={isChatStep ? 'Conversational cohort planning' : 'Creation conversation'}>`:
     - Inside `<header className={styles.brandHeader} aria-label={isChatStep ? 'Plan chat header' : undefined}>`:
       - Render the `<Link className={styles.brand} href="/" aria-label="Undone home">...</Link>` once.
       - When `isChatStep`: render `<div className={styles.tools}><span className={styles.srOnly}>Rev #{state.revision}</span><ThemeToggle /><Link href="/home" className={styles.account} aria-label="Open your account">Y</Link></div>` on the right side of `.brandHeader`.
       - When `!isChatStep`: render the `<button type="button" className={styles.railToggle} ...>` collapse button.
     - Render `<ChatPane attachedEntity={attachedEntity} onClearAttachedEntity={() => setAttachedEntity(null)} connection={connection} />` in the exact same JSX position in `<aside className={styles.rail}>` regardless of `isChatStep`.
  3. Render `{!isChatStep && (<div className={styles.canvas}>...</div>)}` so the workspace canvas and toolbar only render in split mode.
  4. Keep `{showCloseModal && (...)}` modal dialog as-is.

#### 2.4 `src/client/screens/cohortBuilder/CohortBuilder.module.css` (**A8, B9**)
- Replace `.centeredChatPage`, `.centeredChatHeader`, `.centeredChatMain`, `.centeredChatPane` (lines 2766–2829) with clean `data-layout='centered'` rules on `.page` (zero `!important`):
  ```css
  .page[data-layout='centered'] {
    grid-template-columns: minmax(0, 1fr);
  }

  .page[data-layout='centered'] .rail {
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }

  .page[data-layout='centered'] .brandHeader {
    padding: 16px 36px;
    border-bottom: 1px solid color-mix(in srgb, var(--creation-line) 40%, transparent);
    background: color-mix(in srgb, var(--creation-paper) 80%, transparent);
    backdrop-filter: blur(8px);
  }

  .page[data-layout='centered'] .railBody {
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
  }
  ```

#### 2.5 `src/client/screens/cohortBuilder/__tests__/shell.test.tsx` (**A8, Phase D**)
- Update the `'renders centered single-column chat layout when journey.step is chat (PLAN-023)'` test (lines 249–273):
  - Check `expect(document.getElementById('main-content')?.getAttribute('data-layout')).toBe('centered')`.
  - Check `expect(screen.getByRole('banner', { name: 'Plan chat header' })).toBeDefined()`.
  - Check `expect(screen.queryByRole('banner', { name: 'Workspace toolbar' })).toBeNull()`.
  - Add assertion that typing into `screen.getByLabelText('Message the cohort assistant')` while `step === 'chat'` and then rerendering with `step === 'recommendations'` preserves the exact `HTMLTextAreaElement` DOM node and its typed `.value`!
- Run: `npx vitest run src/client/screens/cohortBuilder/__tests__/shell.test.tsx`

---

### Step 3 — Intake Size Guard, `intake-draft.ts` Quota Safety & `LearningPromptBar.tsx` Cleanup (`A5, A6, A7, B8, C11, D1`)

#### 3.1 `src/app/api/cohort-builder/intake/route.ts` (**A5**)
- Line 47 currently caps the POST stream at `if (size > 850_000)` (~850 KB), whereas the client attachment budget in `useComposerAttachments.ts` is 3 MB (`3 * 1024 * 1024`).
- Raise the stream byte cap in `src/app/api/cohort-builder/intake/route.ts` line 47 from `850_000` to `3_500_000` (3.5 MB, safely under Vercel's 4.5 MB serverless body limit while accommodating the 3 MB extracted text budget).

#### 3.2 `src/client/screens/cohortBuilder/intake-draft.ts` (**A5**)
- In `saveIntakeDraft(body: CohortIntakeInput, ownerId: string | null)`:
  - Wrap `sessionStorage.setItem(key, JSON.stringify({ body: validated, ownerId, createdAt: Date.now() }))` in a `try / catch`.
  - In the `catch` block (e.g. `QuotaExceededError` when `sources` is several megabytes), retry `sessionStorage.setItem` with `sources` omitted (`const { sources: _dropped, ...lightweight } = validated;`) inside a nested `try / catch {}` so saving the draft never throws an unhandled exception or blocks `fetch('/api/cohort-builder/intake')`.

#### 3.3 `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx` (**A6, A7, B8, C11**)
- **A7 (Disable submit while extracting)**:
  - Compute `const isBusy = submitting || composerAttachments.isExtracting;`.
  - On the "Plan" button (line 558): set `disabled={isBusy}` and label `<span>{composerAttachments.isExtracting ? 'Reading…' : 'Plan'}</span>`.
  - On the "Begin journey" button (line 571): set `disabled={isBusy}` and label `<span>{composerAttachments.isExtracting ? 'Reading files…' : 'Begin journey'}</span>`.
  - In `handleSubmit`: guard `if (!textToSearch.trim() || submitting || composerAttachments.isExtracting) return;`.
- **A6 (Shift+Enter keyboard shortcut for Plan mode)**:
  - On `<TextBar>`: pass `onKeyDown={(e) => { if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); void handleSubmit('plan'); } }}`.
- **B8 & C11 (Consolidate draft persistence & clean `handleSubmit`)**:
  - Extract small module-level helper functions in `LearningPromptBar.tsx`:
    - `persistPromptDraft(query: string, sourceText: string, showSource: boolean)`
    - `clearPromptDraft()`
    - `navigateTo(router: ReturnType<typeof useSafeRouter>, href: string)` (`if (router) router.push(href); else if (typeof window !== 'undefined') window.location.assign(href);`)
  - Use `persistPromptDraft` in both the 200ms debounce `useEffect` and `beforeunload` handler, and `clearPromptDraft` once on successful submission. Keep the existing storage keys (`sidequest_prompt_query_draft`, `sidequest_prompt_source_draft`, `sidequest_prompt_source_visible`, `undone:landing-query`) so any external consumers remain 100% compatible.
  - Keep `source` in `cohortIntakeSchema` (`src/shared/cohort-builder/intake.ts`) because `src/shared/cohort-builder/__tests__/intake.test.ts` (lines 8, 19–29) and `acceptCohortIntake` explicitly test `body.source`.

#### 3.4 `src/client/components/global/LearningPromptBar/__tests__/LearningPromptBar.test.tsx` (**Phase D1, A6, A7**)
- Mock `next/navigation` at the top of `LearningPromptBar.test.tsx`:
  ```ts
  const pushMock = vi.fn();
  vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: pushMock }),
  }));
  ```
  This eliminates the jsdom `Error: Not implemented: navigation (except hash changes)` stderr noise during test runs.
- Add unit tests in `LearningPromptBar.test.tsx` for:
  1. `Shift+Enter` in the prompt input submits in `'plan'` mode (`mode: 'plan'`).
  2. While a file or link is extracting (`isExtracting === true`), the `Plan` and `Begin journey` buttons are disabled (`disabled === true`).
- Run: `npx vitest run src/client/components/global/LearningPromptBar/__tests__/LearningPromptBar.test.tsx src/shared/cohort-builder/__tests__/intake.test.ts`

---

### Step 4 — Lean AI Tool List & Context Excerpt Budget (`C7, C8`)

#### 4.1 `src/server/domain/cohort-builder/tools.ts` (**C7**)
- Define `const ALWAYS_TOOLS = ['start_search', 'set_intent'] as const;`.
- Spread `...ALWAYS_TOOLS` into every stage in `STAGE_TOOL_NAMES` (except `processing`, which only exposes cancellation/retry tools `['cancel_text_processing', 'cancel_source_processing', 'retry_text_job']`).
- Remove `'add_pdf_source'` from `STAGE_TOOL_NAMES.chat` (PDFs are uploaded via client device composer, never invented as uploadIds in chat).
- Verify or add a test in `src/server/domain/cohort-builder/__tests__/ai-interaction-optimization.test.ts` confirming `start_search` and `set_intent` are present in `chat`, `recommendations`, `starting_point`, `discovery`, `goal_setup`, `material_input`, `ready`, and `published`, and `add_pdf_source` is not in `chat`.

#### 4.2 `src/server/domain/cohort-builder/context.ts` (**C8**)
- Currently `sourceExcerpts` slices 2,000 chars for up to 8 sources (16,000 chars / ~4k tokens) on **every** turn, even in `ready` or `published` stages when `state.chunks` (30 chunks × 500 chars) and `state.lessons` are already populated and sent in the same prompt.
- Make `sourceExcerpts` stage-aware:
  - When `state.lessons.length === 0` or `state.journey?.step` is `'chat' | 'recommendations' | 'starting_point' | 'material_input' | 'discovery' | 'goal_setup'`: include up to `2000` chars per source (`excerpt: (source.text || '').slice(0, 2000)`).
  - Once `state.lessons.length > 0` and step is `'ready' | 'published'`: include a compact 240-char summary preview (`excerpt: (source.text || '').slice(0, 240)`) since anchored `state.chunks` and `state.lessons` are already in the prompt.
- Run: `npx vitest run src/server/domain/cohort-builder/__tests__/`

---

### Step 5 — Documentation & Operational Memory (`Phase D4, D5`)

1. Create `MEMORY/composer-and-client-extraction.md`:
   - Document authoritative paths:
     - `src/shared/cohort-builder/hash.ts` (isomorphic SHA-256)
     - `src/shared/cohort-builder/source-kind.ts` (`detectSourceKind`)
     - `src/shared/cohort-builder/client-pipeline.ts` (authoritative deterministic chunking, coverage, lesson assembly, and `runDeterministicPipeline`)
     - `src/client/lib/sourceExtractors/{pdf,youtube,github,web}ClientExtractor.ts`
     - `src/app/api/import/{youtube/metadata,youtube/transcript,link-preview}/route.ts`
     - `src/client/components/global/Composer/{useComposerAttachments,LinkRows,AttachmentTray,SourceIcon}.tsx`
     - `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx`
     - `src/client/screens/cohortBuilder/{CohortInteractionScreen,ChatPane}.tsx`
   - Document invariants: 3MB client extracted text budget (`3.5MB` intake route limit), playlist fan-out (up to 100 videos), real caption fetch with factual metadata fallback, bundled `pdfjs-dist` worker, single-tree `data-layout="centered" | "split"` preserving `ChatPane` mount state.
2. Add `- [composer-and-client-extraction.md](composer-and-client-extraction.md): ...` to `MEMORY/README.md`.
3. Append a `## Phase 7: Post-Implementation Cleanup & Lean-down Verification` section to `docs/audit/Composer-Chat-Audit-Ledger.md` summarizing A1–A8, B1–B12, C1–C11 resolutions.

---

### Step 6 — Full Verification, Sequential Commits, Push & Vercel Deployment

1. **Typecheck**: `npx tsc --noEmit` (must exit 0).
2. **Unit & Integration Tests**: `npx vitest run` (all suites must pass).
3. **Vercel Pre-Flight Build Gate**: `npm run verify:vercel` (must exit 0).
4. **Sequential Git Commits** (do not `git add` untracked scratch files if any; only commit tracked/intended files):
   - Commit 1: `fix(extractors): real youtube transcript proxy, factual fallback, bundled pdf worker, p-limit github`
     - Files: `src/shared/cohort-builder/source-kind.ts`, `src/shared/cohort-builder/__tests__/source-kind.test.ts`, `src/app/api/import/youtube/transcript/route.ts`, `src/app/api/import/link-preview/route.ts`, `src/client/lib/sourceExtractors/*`, `src/types/ambient.d.ts`
   - Commit 2: `fix(composer): playlist fan-out, 3MB text budget, extraction gating, lean icons and hook`
     - Files: `src/client/components/global/Composer/*`, `src/client/components/global/LearningPromptBar/*`, `src/client/screens/cohortBuilder/intake-draft.ts`, `src/app/api/cohort-builder/intake/route.ts`
   - Commit 3: `refactor(cohort-builder): deduplicate deterministic text pipeline and hash encoder`
     - Files: `src/shared/cohort-builder/hash.ts`, `src/shared/cohort-builder/client-pipeline.ts`, `src/server/domain/cohort-builder/text-pipeline.ts`, `src/server/domain/cohort-builder/lesson-projection.ts`
   - Commit 4: `refactor(builder): single-tree centered chat layout, lean AI tools and excerpt budget, docs`
     - Files: `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx`, `src/client/screens/cohortBuilder/ChatPane.tsx`, `src/client/screens/cohortBuilder/CohortBuilder.module.css`, `src/client/screens/cohortBuilder/__tests__/shell.test.tsx`, `src/server/domain/cohort-builder/tools.ts`, `src/server/domain/cohort-builder/context.ts`, `src/server/domain/cohort-builder/__tests__/*`, `MEMORY/*`, `docs/audit/Composer-Chat-Audit-Ledger.md`, `PLAN.md`
5. **Push & Verify Live Deployment**:
   - `git push origin master`
   - `npx vercel ls --yes` / `npx vercel inspect <url>` until status reaches `● Ready`.

