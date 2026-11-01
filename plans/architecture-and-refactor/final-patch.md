# Comprehensive Audit & Final Patch Blueprint (`final-patch.md`)

## Executive Summary
This document provides an exhaustive, forensic review of all changes introduced across commits `6fb117ef..c835002f` and `PLAN.md`. It identifies every remaining incomplete item, shallow workaround, latent defect, quality deficit, dead code remnant, and over-engineered complexity across the composer, client-device extraction, intake pipeline, centered chat, and builder workspace subsystems.

**Status**: Audit & Blueprint Only. **No code modifications executed in this step.**

---

## 1. Still Pending / Half-Finished Work

### 1.1 In-Chat Attachment & Source Composer in `ChatPane.tsx` (Reference Image 1)
- **Problem**: The user explicitly requested that during conversational planning (and throughout AI chat), users can upload files and attach links with ChatGPT-style attachment pills above the input (matching Reference Image 1).
- **Current State**: `useComposerAttachments`, `AttachmentTray`, and `LinkRows` were implemented and wired **only** into `LearningPromptBar.tsx` on the landing page. In `/quest/build/[workspaceId]` (`ChatPane.tsx`), the composer is still a bare `<textarea>` with an `<ArrowUp>` send button. Users cannot attach reference PDFs, upload notes, or paste links directly into the ongoing chat.
- **Root Fix Required**:
  1. Integrate `useComposerAttachments` into `ChatPane.tsx`.
  2. Render `AttachmentTray` immediately above the chat textarea when `composerAttachments.files.length > 0`.
  3. Add a `+` / Paperclip upload button to the chat composer toolbar.
  4. Pass attached sources/files as client-extracted evidence payloads in `sendMessage`.

### 1.2 `MaterialStageView.tsx` on `/quest/build/[workspaceId]` Still Uses Legacy Binary Uploads
- **Problem**: A core architectural directive of this project is that all parsing/extraction executes on the user's client device to avoid CPU-intensive work and binary uploads in Vercel Serverless Lambdas.
- **Current State**: While `LearningPromptBar.tsx` uses `extractPdfClient`, `MaterialStageView.tsx` (lines 347–352) still performs legacy binary file uploads via `POST /api/cohort-builder/workspaces/${effectiveWorkspaceId}/pdf`. Furthermore, web links added in `MaterialStageView.tsx` dispatch `add_web_source` without client extraction (`extractWebClient`), falling back to server workers.
- **Root Fix Required**:
  1. In `MaterialStageView.tsx`, replace the binary `fetch('/api/.../pdf')` with `extractPdfClient(file)`.
  2. Dispatch `add_pdf_source` with the structured `{ extraction: { text, locations, provenance, checksum } }` payload.
  3. Wire web link additions through `extractWebClient(url)` and dispatch `add_web_source` with `{ extraction }`.

### 1.3 Unauthenticated Auth Handoff Drops Attached Sources
- **Problem**: When an unauthenticated visitor enters a query, attaches PDFs or links on the landing page, and clicks "Plan" or "Begin journey", `LearningPromptBar.tsx` saves the intake draft and redirects to `/auth?returnTo=...`.
- **Current State**: On return from authentication, `LearningPromptBar.tsx` (lines 265–285) restores `query` and `sourceText`, but completely ignores `intakeDraft.sources`. The user's uploaded PDFs and extracted links disappear from state.
- **Root Fix Required**:
  1. In `LearningPromptBar.tsx` mount effect, check if `intakeDraft?.sources` contains ready items.
  2. Restore these items into `composerAttachments` state (or auto-submit the saved intake draft directly to `/api/cohort-builder/intake` once `session.user.id` is available).

### 1.4 `CohortIntakeScreen.tsx` on `/quest/start` Missing Centered Chat Layout Parity
- **Problem**: When a user submits in Plan mode and routes through `/quest/start` (`CohortIntakeScreen.tsx`), they should see the centered chat layout (Reference Image 2).
- **Current State**: `CohortIntakeScreen.tsx` hardcodes the two-column split layout (`data-variant="material"`, no `data-layout="centered"`). During intake submission, it briefly flashes the old split layout.
- **Root Fix Required**:
  1. Pass `data-layout={draft?.mode === 'plan' ? 'centered' : 'split'}` to `CohortIntakeScreen`'s root element.
  2. Hide the right canvas in `CohortIntakeScreen` when in Plan mode.

---

## 2. Shallowly Patched / Symptomatically Treated Issues (Root Causes Unresolved)

### 2.1 Recommendation Search "Cancel" Button Hijacked to `create_own_cohort`
- **Problem**: In Reference Image 3, when recommendations are searching ("Searching for matching cohorts and creators right now…"), a "Cancel" button is visible. Clicking it should cancel the search and return to chat.
- **Current State**: In `src/client/screens/cohortBuilder/stages/RecommendationsStageView.tsx` (line 158), `creationAdapter.cancel` is wired to `handleCreateOwn` (`dispatchAction({ type: 'create_own_cohort' })`). Clicking "Cancel" forces the user into cohort creation (`starting_point`), the exact opposite of cancelling.
- **Root Fix Required**:
  1. Wire `creationAdapter.cancel` to `dispatchAction({ type: 'close_panel' })`.
  2. Clicking "Cancel" cleanly cancels the recommendation search and returns the interface to centered chat mode.

### 2.2 Turbopack Build Warning on `pdfjs-dist` ESM Worker
- **Problem**: `npm run verify:vercel` emitted:
  `Package pdfjs-dist can't be external. The request pdfjs-dist/build/pdf.worker.min.mjs matches serverExternalPackages... require() resolves to an EcmaScript module.`
- **Current State**: `next.config.ts` lists `serverExternalPackages: ['pdfjs-dist']`, while `pdfClientExtractor.ts` uses `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()`. Node external resolution tries CommonJS `require()` on an ESM file.
- **Root Fix Required**:
  1. Copy or statically serve `pdf.worker.min.mjs` from the `public/` directory (e.g. `/pdf.worker.min.mjs`), or configure Turbopack/Webpack rule to resolve the worker script asset as client-only.
  2. Set `pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'` in `pdfClientExtractor.ts`.

### 2.3 Silent Error Swallow & Premature Draft Purge on Intake Route Failure
- **Problem**: In `LearningPromptBar.tsx` (lines 386–392), if `/api/cohort-builder/intake` returns an error status (e.g. 413 `INPUT_TOO_LARGE`, 400 `INVALID_INPUT`, 409 `SESSION_CHANGED`, or 503), the catch block swallows it, executes `clearPromptDraft()`, and redirects to `/quest/start`.
- **Current State**: Clearing the prompt draft destroys the user's input before they can view the error or retry.
- **Root Fix Required**:
  1. If `/api/cohort-builder/intake` fails with an HTTP error, do not call `clearPromptDraft()`.
  2. Display `intakeError` in `LearningPromptBar` so the user can reduce attachments or retry.

---

## 3. Bugs, Regressions & Latent Breakages

### 3.1 `ChatPane.tsx` Enter vs Shift+Enter Keyboard Inconsistency
- **Problem**: On `LearningPromptBar`, `Enter` adds a newline and `Shift+Enter` triggers Plan submission. But in `ChatPane.tsx` (line 99), pressing plain `Enter` immediately submits the message.
- **Current State**: Users accustomed to modern multi-line AI chat composers accidentally submit half-written messages when attempting to create a newline.
- **Root Fix Required**:
  1. Standardize `ChatPane.tsx` to require `Enter` (without Shift) for send only when configured for single-line, or provide a toggle/modifier check that permits clean multi-line drafting.

### 3.2 `close_panel` Leaves Stale Recommendations / Discovery in State
- **Problem**: In `src/shared/cohort-builder/contracts.ts` (lines 359–373), `close_panel` sets `current.step = 'chat'` and resets `processing.status = 'idle'`. However, it leaves `next.recommendations` and `next.discovery` populated.
- **Current State**: If the user later searches for a new topic via `start_search`, old search results can briefly flash before the new query arrives.
- **Root Fix Required**:
  1. In `contracts.ts` `close_panel` handler, cleanly delete `next.recommendations` and `next.discovery`.

### 3.3 Session Loss Jitter in `CohortInteractionScreen.tsx` Purges Draft
- **Problem**: In `CohortInteractionScreen.tsx` (lines 254–259), if NextAuth session `status === 'unauthenticated'`, it logs `Identity lost` and purges `sessionStorage.removeItem('undone:cohort-intake')`.
- **Current State**: During initial hydration or token refresh, if `status` briefly flickers, the user's intake draft in `sessionStorage` is permanently wiped.
- **Root Fix Required**:
  1. Only clear the draft when authentication explicitly fails with a permanent 401 error, never on transient client hydration state.

---

## 4. Quality Standards & UX Deficits

### 4.1 `ChatPane.tsx` Suggestion Pills Clickable During Active Turn
- **Problem**: In `ChatPane.tsx` (lines 446–455), suggestion pills at the bottom remain interactive while `sending` is true or when an assistant turn is running.
- **Current State**: Rapidly clicking multiple suggestion pills queues overlapping, conflicting turns to the backend runner.
- **Root Fix Required**:
  1. Disable suggestion pills when `sending || !!activeTurn`.

### 4.2 Missing `aria-live` Announcement for Layout Transitions
- **Problem**: Screen readers are not notified when the interface dynamically transitions between centered chat and the two-panel workspace view.
- **Root Fix Required**:
  1. Add an `aria-live="polite"` region in `CohortInteractionScreen` announcing: `"Workspace panel opened"` / `"Returned to centered chat"`.

### 4.3 Data URL Memory Leak on High-Volume PDF Attachments
- **Problem**: `pdfClientExtractor.ts` generates thumbnail previews as base64 JPEG strings (`canvas.toDataURL`). If a user repeatedly uploads and removes large PDFs, these strings remain in memory.
- **Root Fix Required**:
  1. Generate thumbnails as blob object URLs (`URL.createObjectURL`) and invoke `URL.revokeObjectURL` in `removeFile` / `clearAll`.

---

## 5. Dead Code & Redundant Endpoints

### 5.1 Redundant Route `/api/cohort-builder/workspaces/[id]/pdf`
- **Location**: `src/app/api/cohort-builder/workspaces/[workspaceId]/pdf/route.ts` and `src/server/domain/cohort-creation/materials/pdf-parser.worker.mjs`.
- **Status**: Once `MaterialStageView.tsx` is updated to client extraction (Item 1.2), this entire 250-line serverless route and its worker become 100% obsolete.
- **Action**: Deprecate and remove after Item 1.2 verification.

### 5.2 Legacy Import Endpoints (`/api/import/{notion,github,youtube/playlist}`)
- **Location**: `src/app/api/import/{notion,github,youtube/playlist}/route.ts`.
- **Status**: Kept strictly because `src/client/screens/dashboard/createCohort/services/importService.ts` calls them on the mounted `/create-cohort` route.
- **Action**: Preserve until `/create-cohort` is formally retired.

---

## 6. Over-Engineered & Redundant Complexity to Lean Down

### 6.1 Duplicate Layout Trees in `CohortIntakeScreen.tsx`
- **Problem**: `CohortIntakeScreen.tsx` replicates the entire DOM tree of `CohortInteractionScreen.tsx` (~285 lines) simply to show a skeleton/status during workspace redirect.
- **Root Fix Required**:
  1. Collapse `CohortIntakeScreen.tsx` into a lean loading bridge that delegates rendering to `CohortInteractionScreen` or a lightweight shell.

### 6.2 `ChatMarkdown` Dynamic Import Complexity in `ChatPane.tsx`
- **Problem**: Lines 16–23 in `ChatPane.tsx` implement a dynamic import wrapped with a test-environment ternary switch:
  `const ChatMarkdown = typeof process !== 'undefined' && process.env.NODE_ENV === 'test' ? StaticChatMarkdown : DynamicChatMarkdown;`
- **Root Fix Required**:
  1. Use standard Next.js dynamic import or direct component import with proper SSR handling.

### 6.3 Double JSON Serialization in `intake-draft.ts`
- **Problem**: `saveIntakeDraft` serializes and parses the object multiple times to check `prior.requestId`.
- **Root Fix Required**:
  1. Compare fields directly in JavaScript objects before calling `JSON.stringify`.

---

## Execution Readiness Checklist

| Work Item | Subsystem / Files | Complexity | Priority |
| :--- | :--- | :--- | :--- |
| **PATCH-01** | Wire `useComposerAttachments` into `ChatPane.tsx` + add upload/tray UI | Medium | P1 |
| **PATCH-02** | Upgrade `MaterialStageView.tsx` to `extractPdfClient` & `extractWebClient` | Medium | P1 |
| **PATCH-03** | Fix Recommendations "Cancel" button in `RecommendationsStageView.tsx` | Low | P1 |
| **PATCH-04** | Restore `intakeDraft.sources` upon returning from unauthenticated auth redirect | Low | P2 |
| **PATCH-05** | Fix Turbopack `pdfjs-dist` worker bundling via public static worker | Low | P2 |
| **PATCH-06** | Prevent intake error swallow & premature draft purge in `LearningPromptBar.tsx` | Low | P2 |
| **PATCH-07** | Clean stale recommendations/discovery on `close_panel` in `contracts.ts` | Low | P2 |
| **PATCH-08** | Disable suggestion pills during active turn in `ChatPane.tsx` | Low | P3 |
| **PATCH-09** | Streamline `CohortIntakeScreen.tsx` and add centered layout parity | Medium | P3 |
| **PATCH-10** | Deprecate dead server-side PDF upload route after client migration | Low | P3 |
