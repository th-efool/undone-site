# IdiotCheckInQualityAssessment: Final Cohort Creation Workflow (Homepage to Delivery)

**Date:** 2026-11-01
**Target Subsystem:** Cohort Creation Workflow End-to-End (Homepage Landing & Dashboard &rarr; Intake & Drafts &rarr; Builder Interaction & Chat &rarr; Source Extraction & AI Co-Design &rarr; Review & Release &rarr; Dashboard Reflection)
**Repository Root:** `D:\ThisPC\Documents\SideQuestHQ\undone-site`
**Git HEAD:** `63ed5b3685616457b50b79d0fef54d931e1aacdb` (`master`, clean working tree)
**Runtime Baseline:** Node `v24.14.1`, Next.js `16.2.11` (webpack), Prisma `7.9.1`, PostgreSQL / PgBouncer, MongoDB v6
**Verification Baseline:** Vitest 4.1.11 (778 tests passing across subsystems), TypeScript 5.x (`tsc --noEmit --incremental false`: 0 errors), Next.js Production Build (50/50 routes compiled)

---

## 1. Verdict and Assessed Scope

### Overall Verdict: CONDITIONAL ACCEPTANCE (CORE WORKFLOW FUNCTIONAL; 5 DEFECTS & UX GAPS REMAIN)

The cohort creation workflow starting from the homepage (`/` landing prompt bar and `/home` dashboard prompt bar) through to cohort release and enrollment has achieved **architectural consolidation and baseline operational stability**:
1. **Route and Engine Consolidation Verified:** All legacy entry points (`/create-cohort`, Command Palette `Cmd+K`, Explore "Build a Cohort") now uniformly funnel into the canonical PostgreSQL-backed AI Cohort Builder (`/quest/start` &rarr; `/quest/build/[workspaceId]`).
2. **AI Tool Safety Enforced:** The destructive `commit_release` action has been completely purged from AI model stage tools (`review`, `ready`, `published`). Release into public catalog or private activation now strictly requires explicit authenticated human interaction through the UI Release Panel (`POST /api/cohort-builder/workspaces/[workspaceId]/release`).
3. **State Machine Integrity:** The `'chat'` step is formally registered in `BuilderStage` and state machine selectors (`stage-selectors.ts`), eliminating spurious fall-through to `'curriculum'` or `'intake'`.
4. **Clean Codebase Baseline:** TypeScript check passes with **0 errors**, and Next.js production build succeeds with **50/50 static and dynamic routes**.

However, an exhaustive end-to-end quality assessment reveals **several critical-to-medium implementation defects and user experience gaps** that degrade the workflow in real-world usage:
- **Source Downgrade Defect (CRITICAL/HIGH):** Structured media attached inside the `ChatPane` composer (YouTube videos, GitHub repos, Web articles) is silently downgraded to plain text (`add_text_source`) because `toCohortSource` drops the `input` discriminator and `ChatPane` performs regex checks on the video title instead of the URL or provenance.
- **UX Dead-End on Direct Navigation (HIGH/MEDIUM):** Navigating directly to `/quest/start` without a pre-existing draft in `sessionStorage` presents an empty card with no input field, telling the user to "Return to landing to begin".
- **Unauthenticated Submit Loophole (MEDIUM):** Clicking submit in `LearningPromptBar` while unauthenticated redirects back to `/` rather than `/quest/start`, leaving the user stranded on the landing page after login requiring a redundant second click.
- **NextAuth Race Condition (MEDIUM):** Submitting `LearningPromptBar` during `status === 'loading'` bypasses the unauthenticated redirect guard and triggers a 401 UNAUTHORIZED failure from `/api/cohort-builder/intake`.
- **Mobile Home Dashboard Omission (LOW/MEDIUM):** The mobile dashboard (`HomeMobile.tsx`) completely omits `LearningPromptBar` and provides no cohort creation action.

### Assessed Scope & Architectural Boundaries

| Layer / Stage | Source Entry Points | Operational Boundary & Responsibilities |
|---|---|---|
| **1. Homepage Entry (Landing & Dashboard)** | `src/app/(landing)/page.tsx`<br>`src/client/screens/landing/Hero/components/CentralInterface.tsx`<br>`src/app/(dashboard)/home/page.tsx`<br>`src/client/screens/dashboard/home/HomeDesktop.tsx`<br>`src/client/mobile/screens/Home/HomeMobile.tsx` | Unauthenticated public prompt intake, authenticated dashboard prompt intake, mode switching (`search` vs `plan`), template prompts, and draft auto-recovery. |
| **2. Intake & Client Extraction** | `src/client/components/global/LearningPromptBar/`<br>`src/client/components/global/Composer/`<br>`src/client/lib/sourceExtractors/`<br>`src/client/screens/cohortBuilder/intake-draft.ts` | In-browser file/URL parsing (PDF thumbnails via canvas, YouTube metadata & chapters, GitHub trees, Web link previews), text budget checks (3MB limit), `sessionStorage` draft persistence. |
| **3. Intake API & DB Initialization** | `src/app/api/cohort-builder/intake/route.ts`<br>`src/server/infrastructure/db/postgres/cohort-intake.ts` | CSRF origin validation, owner session resolution (`getCreationOwner`), advisory locks on workspace UUID, creation of `interaction_workspaces` row, initial user message with attached `sourceRefs`, and DAG job scheduling. |
| **4. Builder Workspace & Stage Navigation** | `src/app/(creation)/quest/start/page.tsx`<br>`src/app/(creation)/quest/build/[workspaceId]/page.tsx`<br>`src/client/screens/cohortBuilder/CohortIntakeScreen.tsx`<br>`src/client/screens/cohortBuilder/CohortInteractionScreen.tsx`<br>`src/client/screens/cohortBuilder/CohortWorkspacePane.tsx`<br>`src/client/screens/cohortBuilder/stage-selectors.ts` | SSE real-time event subscription (`/api/interaction/v1`), layout switching (centered single-column for `chat` mode; split rail/canvas for review and processing), stage inspection stepper, and confirmation dialogs. |
| **5. Conversational Co-Design & AI Tools** | `src/client/screens/cohortBuilder/ChatPane.tsx`<br>`src/server/domain/cohort-builder/tools.ts`<br>`src/server/infrastructure/ai/interactionModel.ts`<br>`src/server/interaction-worker.ts` | Single-row composer card, stage suggestions, tool execution loop (`add_lesson`, `draft_curriculum`, `edit_lesson`), assistant cancellation, and turn budget tracking. |
| **6. Review, Release & Learner Delivery** | `src/client/screens/cohortBuilder/components/ReleasePanel.tsx`<br>`src/client/screens/cohortBuilder/stages/CurriculumStageView.tsx`<br>`src/server/domain/cohort-builder/release-service.ts`<br>`src/server/domain/cohort-builder/delivery.adapter.ts`<br>`src/app/api/cohort-builder/workspaces/[workspaceId]/release/route.ts` | Deterministic readiness validation (`validateCohortReadiness`), content hashing, relational materialization into Prisma `Cohort`, `Season`, `Lesson`, `Chunk`, and `CohortMember` (with role `CREATOR`). |
| **7. Dashboard Reflection** | `src/server/domain/home/home.service.ts`<br>`src/client/screens/dashboard/home/hooks/useHome.ts`<br>`src/client/screens/dashboard/home/components/ActiveCohorts/` | Querying enrolled and created cohorts (`prisma.cohortMember` & `creatorId`), deriving chunk progress, contiguous ranking, pause/resume state, and SubscribedCohortCard rendering. |

---

## 2. Requirement and Component Coverage

| Req ID | Target Requirement / Invariant | Inspected Components | Review Method | Result | Finding ID |
|---|---|---|---|---|---|
| **REQ-01** | Unified entry points: all creation routes route to canonical Postgres builder | `CommandPalette.tsx`, `ExploreDesktop.tsx`, `create-cohort/page.tsx` | Static route audit, redirect test | **Verified** | Resolved (QA/F02) |
| **REQ-02** | User-only deliberate publication: AI cannot autonomously invoke `commit_release` | `src/server/domain/cohort-builder/tools.ts` | Source audit, `ai-tools-optimization.test.ts` | **Verified** | Resolved (QA/F01) |
| **REQ-03** | Text fidelity: client source extraction must not inject Mojibake characters | `src/client/lib/sourceExtractors/webClientExtractor.ts` | Source audit, bullet formatting test | **Verified** | Resolved (QA/F03) |
| **REQ-04** | Complete state machine: `BuilderStage` must include `'chat'` without fall-through | `src/client/screens/cohortBuilder/stage-selectors.ts` | Type definitions, `journey-stages.test.tsx` | **Verified** | Resolved (QA/F04) |
| **REQ-05** | Chat composer source attachments must preserve media type, locations, and provenance | `src/client/screens/cohortBuilder/ChatPane.tsx#L103-138`<br>`src/client/components/global/Composer/useComposerAttachments.ts` | AST tracing, payload simulation | **FAILED** | **FINDING-01** |
| **REQ-06** | Canonical `/quest/start` route must allow direct input when visited without prior draft | `src/client/screens/cohortBuilder/CohortIntakeScreen.tsx#L280-289` | UI component inspection | **FAILED** | **FINDING-02** |
| **REQ-07** | Prompt bar submission must not trigger 401 error while auth status is `'loading'` | `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx#L309`, `#L393` | State transition audit | **FAILED** | **FINDING-03** |
| **REQ-08** | Unauthenticated landing page submission must redirect to creation rather than stranded landing | `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx#L396-402` | Flow trace, returnUrl inspection | **FAILED** | **FINDING-04** |
| **REQ-09** | Feature parity: mobile dashboard must provide accessible cohort creation path | `src/client/mobile/screens/Home/HomeMobile.tsx` | Mobile vs desktop UI diff | **FAILED** | **FINDING-05** |
| **REQ-10** | Automatic navigation on release: user must be directed to destination upon publishing | `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx#L198-206` | Prop binding inspection | **FAILED** | **FINDING-06** |
| **REQ-11** | Dead code elimination: unmounted legacy wizard components should be pruned | `src/client/screens/dashboard/createCohort/` | Tree shaking & grep reference check | **FAILED** | **FINDING-07** |
| **REQ-12** | Database reflection: created cohorts must appear under active cohorts on `/home` | `src/server/domain/home/home.service.ts#L132-155` | DB query audit, `home.service.test.ts` | **Verified** | None |

---

## 3. Prioritized Findings

### High Severity Findings

#### FINDING-01: Multi-Modal Source Downgrade Defect in ChatPane Composer
- **Category:** Category A (Pending or half-finished implementation) / Category C (Existing defect)
- **Severity:** **HIGH**
- **Affected Requirement:** REQ-05 (Multi-modal source preservation)
- **Locations:**
  - `src/client/components/global/Composer/useComposerAttachments.ts#L70-73`, `#L259`
  - `src/client/screens/cohortBuilder/ChatPane.tsx#L103-138`
- **Preconditions:** A user inside the conversational builder (`/quest/build/[workspaceId]`) uses the paperclip icon or pastes a YouTube URL, GitHub repository URL, or Web link.
- **Expected Behavior:**
  1. YouTube videos are dispatched via `{ type: 'add_youtube_source', url, mode: 'video_observation', extraction }` preserving video durations, chapters, and `videoId`.
  2. GitHub repos are dispatched via `{ type: 'add_github_source', repoUrl, ref, extraction }`.
  3. Web pages are dispatched via `{ type: 'add_web_source', url, extraction }`.
- **Actual Behavior:**
  1. `toCohortSource()` in `useComposerAttachments.ts` drops the link's `url` and `kind`, constructing a `CohortSource` where `source.input` is `undefined` and `source.label` is set to the extracted title (e.g. `"Next.js 15 Full Course"` or `"GitHub: owner/repo"`).
  2. In `ChatPane.tsx` line 109, the action dispatcher checks:
     ```typescript
     } else if (source.input?.kind === 'youtube' || source.label.includes('youtube.com') || source.label.includes('youtu.be')) {
     ```
     Because `source.input` is `undefined`, and `source.label` is the video title (which does NOT contain `"youtube.com"`), this condition evaluates to `false`.
  3. Similarly, GitHub and Web links fail their respective checks.
  4. The code falls through to lines 133-138:
     ```typescript
     } else {
       await dispatchAction({
         type: 'add_text_source',
         label: source.label,
         text: source.text,
       });
     }
     ```
  5. The entire structured `extraction`—including timestamps, segment offsets, duration, and provenance—is completely discarded. The media is stored as a generic plain-text markdown note, completely breaking video lesson playback and timed evidence citation.
- **Attribution:** Introduced when client-side source extraction was refactored into `useComposerAttachments`.
- **Minimal Correction Direction:**
  1. In `useComposerAttachments.ts`, update `toCohortSource` (or `getReadySources`) to preserve `input: { kind: l.kind, url: l.url }` (and `repoUrl` for GitHub).
  2. In `ChatPane.tsx`, check `source.input?.kind === 'youtube' || (source.provenance as any)?.videoId` rather than relying on substring matches on `source.label`.

---

#### FINDING-02: UX Dead-End on Canonical `/quest/start` When Navigated Directly
- **Category:** Category A (Half-finished implementation) / Category D (Quality-standard gap)
- **Severity:** **HIGH**
- **Affected Requirement:** REQ-06 (Direct intake usability)
- **Location:** `src/client/screens/cohortBuilder/CohortIntakeScreen.tsx#L280-289`
- **Preconditions:** A user clicks "Create Cohort" in the Command Palette (`Cmd+K`), clicks "BUILD A COHORT" in `/explore`, or opens `/quest/start` directly in a fresh browser session.
- **Expected Behavior:** The user is presented with a prompt bar or creation form to enter their learning goal, topic, or reference materials.
- **Actual Behavior:** `CohortIntakeScreen` checks `readIntakeDraft(ownerId)`. Because the user navigated directly rather than submitting on the landing page, `draft` is `null`. The screen renders an inert card:
  ```tsx
  <div className={styles.card} style={{ textAlign: 'center', padding: '32px 16px' }}>
    <div className={styles.cardHeader}>
      <span className={styles.eyebrow}>No active quest</span>
      <h1 className={styles.title}>Start a new cohort</h1>
    </div>
    <p className={styles.subtitle}>
      No pending input found. <a className={styles.linkButton} href="/#explore">Return to landing</a> to begin.
    </p>
  </div>
  ```
  The user is blocked with no input field, forcing them to click a link back to the landing page `/`.
- **Attribution:** Tech debt remaining from when `/create-cohort` was redirected to `/quest/start` without embedding `LearningPromptBar` as a fallback on `CohortIntakeScreen`.
- **Minimal Correction Direction:** Render `<LearningPromptBar />` inside `CohortIntakeScreen` when `draft === null`, allowing users to type and submit their quest directly from `/quest/start`.

---

### Medium Severity Findings

#### FINDING-03: Race Condition on Submit During NextAuth `'loading'` State
- **Category:** Category C (Existing defect / Timing race condition)
- **Severity:** **MEDIUM**
- **Affected Requirement:** REQ-07 (Reliable intake authentication)
- **Location:** `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx#L309`, `#L393`
- **Preconditions:** A user loads the landing page `/` and immediately submits a query before NextAuth completes its background session probe (`status === 'loading'`).
- **Expected Behavior:** The button is either disabled while auth status resolves (`isBusy = ... || status === 'loading'`), or the unauthenticated guard treats `!ownerId` safely by waiting or routing to `/auth`.
- **Actual Behavior:**
  1. `isBusy` does not check `status === 'loading'`:
     ```typescript
     const isBusy = !draftRestored || submitting || composerAttachments.isExtracting;
     ```
  2. In `handleSubmit`, the auth redirect guard specifies:
     ```typescript
     if (!ownerId && status === 'unauthenticated') { ... redirect to /auth ... }
     ```
  3. When `status === 'loading'`, `ownerId` is null, but `status === 'unauthenticated'` is false.
  4. The request bypasses the redirect guard and directly executes `fetch('/api/cohort-builder/intake')`.
  5. The server rejects the request with HTTP `401 UNAUTHORIZED`.
  6. The prompt bar displays: `"Could not confirm your request. Retry to continue."` instead of redirecting the user to sign in.
- **Attribution:** Edge-case boundary bug in session guard logic.
- **Minimal Correction Direction:** Add `status === 'loading'` to `isBusy`, or adjust the guard to `if (!ownerId && status !== 'authenticated')`.

---

#### FINDING-04: Unauthenticated Landing Submission Redirects Back to Landing Instead of Builder
- **Category:** Category B (Symptom-only fix) / Category D (Quality-standard gap)
- **Severity:** **MEDIUM**
- **Affected Requirement:** REQ-08 (Seamless onboarding flow)
- **Location:** `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx#L396-402`
- **Preconditions:** An unauthenticated visitor types a learning topic on `https://undone.in/` and clicks "Begin journey" or "Start planning".
- **Expected Behavior:** The user signs in via `/auth`, and is immediately transitioned into their newly created cohort builder workspace (`/quest/start` or `/quest/build/[workspaceId]`).
- **Actual Behavior:**
  1. `LearningPromptBar.tsx` saves the draft to `sessionStorage` and constructs:
     ```typescript
     const returnUrl = mode === 'plan'
       ? `/?q=${encodeURIComponent(textToSearch.trim())}&mode=plan`
       : `/?q=${encodeURIComponent(textToSearch.trim())}`;
     const authHref = `/auth?returnTo=${encodeURIComponent(returnUrl)}`;
     ```
  2. After authenticating, NextAuth returns the user to `/?q=...`.
  3. On `/`, the landing page mounts. The input is populated, but `acceptCohortIntake` is NOT called. The user remains stuck on the public landing page and must manually press "Begin journey" a second time.
  4. In contrast, if `returnUrl` pointed to `/quest/start`, `CohortIntakeScreen`'s auto-submit `useEffect` would have picked up the `sessionStorage` draft, invoked `/api/cohort-builder/intake`, and transitioned directly to `/quest/build/[workspaceId]`.
- **Attribution:** Legacy query parameter routing leftover from earlier iterations.
- **Minimal Correction Direction:** Change `returnUrl` to `/quest/start` in `LearningPromptBar.tsx` when redirecting to `/auth`.

---

#### FINDING-05: Mobile Dashboard Omits Cohort Creation Entry Point
- **Category:** Category A (Pending / half-finished implementation) / Category D (Feature parity)
- **Severity:** **LOW to MEDIUM**
- **Affected Requirement:** REQ-09 (Mobile feature parity)
- **Location:** `src/client/mobile/screens/Home/HomeMobile.tsx` vs `src/client/screens/dashboard/home/HomeDesktop.tsx#L37`
- **Preconditions:** A user navigates to `/home` on a mobile viewport or mobile device.
- **Expected Behavior:** Parity with desktop, providing a prominent way to start a new quest or cohort.
- **Actual Behavior:** While `HomeDesktop.tsx` includes `<LearningPromptBar />` right beneath `HomeHero`, `HomeMobile.tsx` only renders `ChannelHub`, `ActiveCohorts`, and `RecentlyCompleted`. There is no prompt bar, search box, or "Create Quest" button on the mobile home screen. A mobile user can only browse existing cohorts.
- **Attribution:** Omission during mobile home screen layout design.
- **Minimal Correction Direction:** Mount `<LearningPromptBar />` or a prominent "Start a New Quest" floating action button / card in `HomeMobile.tsx`.

---

### Low Severity Findings

#### FINDING-06: Unbound `onNavigateToDestination` in `CohortInteractionScreen.tsx`
- **Category:** Category A (Half-finished wiring)
- **Severity:** **LOW**
- **Affected Requirement:** REQ-10 (Automatic release navigation)
- **Location:** `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx#L198-206`
- **Preconditions:** User clicks "Publish Cohort" or "Release & Start Learning" in `ReleasePanel`.
- **Expected Behavior:** Upon HTTP 200 response, the browser automatically navigates to `data.receipt.destinationUrl` (`/cohort/[cohortId]` or `/play?cohort=[cohortId]`).
- **Actual Behavior:** `ReleasePanel.tsx` checks `if (onNavigateToDestination) onNavigateToDestination(...)`. However, `CohortInteractionScreen.tsx` instantiates `CohortWorkspacePane` without passing `onNavigateToDestination`. As a result, the callback is undefined, and automatic redirection never occurs. The user must manually spot and click the "Enter Cohort" button.
- **Attribution:** Forgotten prop pass-through during builder UI refactor.
- **Minimal Correction Direction:** Pass `onNavigateToDestination={(url) => router.push(url)}` to `CohortWorkspacePane` in `CohortInteractionScreen.tsx`.

---

#### FINDING-07: ~2,000 Lines of Dead Legacy Wizard Code in `src/client/screens/dashboard/createCohort/`
- **Category:** Category E (Dead code and unused artifacts)
- **Severity:** **LOW**
- **Affected Requirement:** REQ-11 (Codebase hygiene)
- **Locations:**
  - `src/client/screens/dashboard/createCohort/CreateCohort.tsx` (100% unreferenced)
  - `src/client/screens/dashboard/createCohort/components/` (all step components)
  - `src/client/screens/cohortCreation/CreationExperience.tsx`
- **Evidence:** Commit `5c43480b` redirected `/create-cohort` to `/quest/start`. Global grep confirms no active page, route, or link renders `CreateCohort.tsx`.
- **Attribution:** Deprecated legacy implementation retained after canonical route consolidation.
- **Minimal Correction Direction:** Safely delete `src/client/screens/dashboard/createCohort/` (preserving any shared utility files) and clean up `src/client/screens/dashboard/createCohort/index.ts`.

---

## 4. Checks and Evidence

| Check ID | Tool / Command | Target / Scope | Result / Observed Output |
|---|---|---|---|
| **CHK-01** | `npx vitest run src/client/components/global/LearningPromptBar/__tests__ src/client/screens/cohortBuilder/__tests__ src/server/domain/cohort-builder/__tests__` | Full cohort creation & builder test suite | **697 passed, 1 timeout** (82/83 test files passed; total runtime 378s). Timeout was in heavy parallel integration test. |
| **CHK-02** | `npx vitest run src/server/domain/cohort-builder/__tests__/canonical-text-repository.test.ts` | Isolated rerun of timed-out test | **7/7 passed** in 32.29s. Verifies zero real failures in canonical text repository. |
| **CHK-03** | `npx vitest run src/server/domain/home src/client/screens/dashboard/home src/client/mobile/screens/Home "src/app/(dashboard)/home" src/app/api/user/cohort-config` | Home dashboard cohort reflection & controls | **11/11 passed (69/69 tests passed)** in 9.86s. |
| **CHK-04** | `npx vitest run src/client/lib/sourceExtractors/__tests__/sourceExtractors.test.ts src/client/components/global/Composer/__tests__/useComposerAttachments.test.tsx` | Client extractors and attachment hooks | **2/2 passed (12/12 tests passed)** in 5.25s. |
| **CHK-05** | `npx tsc --noEmit --incremental false` | Whole-codebase TypeScript strict typecheck | **Passed (Exit code 0)**; 0 compilation errors across all packages. |
| **CHK-06** | `npm run build` | Next.js production webpack compile & page generation | **Passed (Exit code 0)**; 50/50 static and dynamic routes compiled in 88s. |
| **CHK-07** | AST / Source Trace: `ChatPane.tsx#L103-138` | Source dispatch logic in composer | **FAILED (FINDING-01)**: Confirmed `source.input` is undefined and labels do not match `youtube.com`, falling through to `add_text_source`. |
| **CHK-08** | Source Inspection: `CohortIntakeScreen.tsx#L280-289` | Direct visit to `/quest/start` | **FAILED (FINDING-02)**: Confirmed empty card with "No pending input found. Return to landing to begin." |
| **CHK-09** | Source Inspection: `LearningPromptBar.tsx#L309`, `#L393` | Unauthenticated submit during `'loading'` | **FAILED (FINDING-03)**: Confirmed race condition causing 401 UNAUTHORIZED. |
| **CHK-10** | Source Inspection: `home.service.ts#L132-155` | Created cohort visibility on `/home` | **VERIFIED**: Confirmed `loadHomeForUser` queries both `cohortMember` and `creatorId`, ensuring newly released cohorts appear on the dashboard. |

---

## 5. Unverified Risks and Blocked Investigation

1. **Low-Memory iOS Safari Tab Discard on Multi-Page PDF Thumbnails:**
   - `pdfClientExtractor.ts` uses offscreen HTML `<canvas>` to render PDF page thumbnails before upload. On iOS devices with 3GB RAM or lower, parsing multiple concurrent 30MB PDFs can spike canvas memory and trigger WebKit tab reloads. Investigation on physical mobile hardware is recommended.
2. **SSE Connection Drop Behavior on Aggressive Mobile Carrier Proxies:**
   - The real-time builder connection (`/api/interaction/v1/workspaces/[workspaceId]/events`) relies on a 25-second heartbeat ping. On certain cellular networks with 15-second proxy idle timeouts, silent connection drops may occur before the client's reconnect timer fires. Automated reconnect recovery is verified in unit tests (`transport.test.ts`), but real carrier latency profiles remain unmeasured.

---

## 6. Correction Order and Completion Criteria

To bring the cohort creation workflow from Homepage through to Delivery to 100% production readiness, apply the following minimal fixes in dependency order:

### Phase 1: Source Extraction & Multi-Modal Integrity (Critical / High)
1. **Fix FINDING-01 (Source Attachment Downgrade in ChatPane)**:
   - Edit `src/client/components/global/Composer/useComposerAttachments.ts`:
     - In `toCohortSource`, preserve `input: { kind: l.kind, url: l.url }`.
   - Edit `src/client/screens/cohortBuilder/ChatPane.tsx`:
     - Update lines 103-138 to check `(source.input?.kind === 'youtube') || (source.provenance as any)?.videoId` and dispatch `{ type: 'add_youtube_source', url, extraction }`.
   - *Verification:* Add unit test in `ChatPaneTurnAndInteractive.test.tsx` verifying that attaching a YouTube video dispatches `add_youtube_source` with complete locations and provenance.

### Phase 2: Onboarding Flow & Direct Navigation (High / Medium)
2. **Fix FINDING-02 (UX Dead-End on Direct `/quest/start`)**:
   - Edit `src/client/screens/cohortBuilder/CohortIntakeScreen.tsx`:
     - In the fallback branch (lines 280-289), render `<LearningPromptBar />` so users arriving from Command Palette or `/explore` can start a quest directly.
   - *Verification:* Test that navigating to `/quest/start` with no draft renders an active, focusable prompt bar.
3. **Fix FINDING-03 & FINDING-04 (Auth Loading Race & Post-Auth Return URL)**:
   - Edit `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx`:
     - In `isBusy`, include `status === 'loading'`.
     - In `handleSubmit`, change `returnUrl` from `/?q=...` to `/quest/start`.
   - *Verification:* Test that an unauthenticated user submitting on `/` logs in and arrives on `/quest/start`, where the cohort is auto-created.

### Phase 3: Mobile Dashboard & Polish (Low / Medium)
4. **Fix FINDING-05 (Mobile Dashboard Parity)**:
   - Edit `src/client/mobile/screens/Home/HomeMobile.tsx`:
     - Mount `<LearningPromptBar />` or a "Create Cohort" action button linking to `/quest/start`.
   - *Verification:* Run `HomeMobile.test.tsx`.
5. **Fix FINDING-06 (Wire `onNavigateToDestination`)**:
   - Edit `src/client/screens/cohortBuilder/CohortInteractionScreen.tsx`:
     - Pass `onNavigateToDestination={(url) => router.push(url)}` to `CohortWorkspacePane`.
   - *Verification:* Verify automated navigation in `ReleasePanel.test.tsx`.
6. **Fix FINDING-07 (Prune Legacy Wizard Dead Code)**:
   - Delete unused `src/client/screens/dashboard/createCohort/CreateCohort.tsx` and its unmounted subcomponents.
   - *Verification:* Run `npx tsc --noEmit` and `npm run build` to confirm zero broken imports.
