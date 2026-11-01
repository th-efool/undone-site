# Quality Assessment Report: Cohort Material Intake, Stage Transitions & System Health

**Date**: 2026-11-01
**Auditor**: Antigravity (IdiotCheckInQualityAssessment Protocol)
**Git Baseline**: Commit `0603c64f` (`master`, synchronized with `origin/master`)
**Scope**: All changes and integrations delivered under Guide G3 (`IdiotHandOffGuide-cohort-material-intake.md`), including shared contracts (`contracts.ts`), UI intake and discovery components (`MaterialStageView.tsx`, `DiscoveryStageView.tsx`, `StartingPoint.tsx`, `CohortWorkspacePane.tsx`, `ReadyStageView.tsx`), transition state machines, background verification pipelines (`npm run verify:vercel`), and regression suites across 150 test files.

---

## 1. Verdict and Assessed Scope

### Overall Verdict: **CONDITIONAL ACCEPTANCE WITH REMEDIATIONS REQUIRED**

The implementation of Guide G3 has established the core functional intake and selection architecture:
1. **Intake Restructuring Delivered**: The starting point selector was successfully simplified from 3 legacy choices to 2 distinct paths (`have_material` and `find_material`), routing directly into the revised URL-first `MaterialStageView` and `DiscoveryStageView`.
2. **Back Navigation Repaired**: Ready screen navigation was decoupled from readiness guards (`requiresReady = false`), allowing creators to navigate back to material even if a build is incomplete.
3. **Pipeline & Build Posture**: Full TypeScript check (`tsc --noEmit --incremental false`) passed with **0 errors**, the Vercel deployment pipeline (`npm run verify:vercel`) passed across all 5 stages in 88.5s (50/50 routes compiled statically/dynamically), and **150 test files with 1,191 automated tests passed with 100% success**.
4. **Prior Remediations Maintained**: Fixes from Guides G1 and G2 (DM deletion in `useMessage.ts`, ref hydration in `ToastProvider.tsx`, and aria-labels in `PlayDesktop.tsx`) remain green and fully intact.

However, an exhaustive audit of caller trees, state transitions, ESLint diagnostics, and React lifecycle invariants reveals **1 High Severity React Hook violation** in `CohortWorkspacePane.tsx`, along with **3 Medium Severity logic and state consistency findings** and **2 Low Severity hygiene issues**.

### Scope Inventory

| Area | Authoritative Files |
|---|---|
| **Intake & Material UI** | `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx`<br>`src/client/screens/cohortBuilder/stages/MaterialStageView.module.css`<br>`src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx`<br>`src/client/screens/cohortCreation/components/StartingPoint.tsx`<br>`src/client/screens/cohortCreation/components/StartingPoint.module.css` |
| **Workspace & Ready Views** | `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx`<br>`src/client/screens/cohortBuilder/stages/ReadyStageView.tsx`<br>`src/client/screens/cohortBuilder/stage-selectors.ts`<br>`src/shared/cohort-builder/cohort-metadata.ts` |
| **Domain Contracts & Pipeline** | `src/shared/cohort-builder/contracts.ts`<br>`src/shared/cohort-builder/client-pipeline.ts`<br>`src/client/lib/sourceExtractors/youtubeClientExtractor.ts`<br>`src/client/lib/sourceExtractors/webClientExtractor.ts`<br>`src/server/domain/cohort-builder/text-assembly-acceptance.ts`<br>`src/server/domain/cohort-builder/tools.ts` |
| **Test Suites** | `src/client/screens/cohortBuilder/__tests__/material-stage-view.test.tsx`<br>`src/client/screens/cohortBuilder/__tests__/ready-stage-view.test.tsx`<br>`src/client/screens/cohortBuilder/__tests__/journey-checkpoint2-navigation.test.tsx`<br>`src/client/screens/cohortBuilder/__tests__/journey-checkpoint3-material.test.tsx`<br>`src/client/screens/cohortBuilder/__tests__/journey-checkpoint4-branch.test.tsx`<br>`src/client/screens/cohortBuilder/__tests__/journey-checkpoint5-processing.test.tsx`<br>`src/client/screens/cohortBuilder/__tests__/journey-stages.test.tsx`<br>`src/client/screens/cohortCreation/__tests__/CreationExperience.test.tsx`<br>`src/shared/cohort-builder/__tests__/contracts.test.ts`<br>`src/shared/cohort-builder/__tests__/journey-actions.test.ts` |

---

## 2. Requirement and Component Coverage

### Requirement Disposition Matrix

| Req ID | Requirement Summary | Component / Route | Review Type | Result | Evidence / Finding ID |
|---|---|---|---|---|---|
| **G3-S01** | URL input first in `MaterialStageView` | `MaterialStageView.tsx` | Vitest, Source | **Verified** | URL input first in DOM; previews precede form |
| **G3-S02** | Styles for `MaterialStageView` | `MaterialStageView.module.css` | Source, Build | **Verified** | Layout and responsive CSS validated |
| **G3-S03** | `DiscoveryStageView` with goal search | `DiscoveryStageView.tsx` | Vitest, Source | **Verified** | Dispatches `start_discovery` and `select_discovery_resources` |
| **G3-S04** | 2-choice StartingPoint selector | `StartingPoint.tsx` | Vitest, Source | **Verified** | Choices `have_material` and `find_material` rendered |
| **G3-S05** | Styles for `StartingPoint` | `StartingPoint.module.css` | Source, Build | **Verified** | Verified with `StartingPointArt` decorations |
| **G3-S06** | `CohortWorkspacePane` route `goal_setup` to discovery | `CohortWorkspacePane.tsx` | Vitest, Source | **Finding** | **FINDING-HOOK-01**: `useEffect` called after early return |
| **G3-S07** | Strict domain schemas & batch actions | `contracts.ts` | Vitest, Source | **Verified** | `CohortStartingPointChoice`, `add_youtube_sources_batch` |
| **G3-G02** | Ready stage Back button navigation repair | `ReadyStageView.tsx` | Vitest, Source | **Finding** | **FINDING-READY-01**: `handleActivate` ignores failure; unconditional success heading |
| **G3-T01** | Unit tests for material intake | `material-stage-view.test.tsx` | Vitest | **Verified** | 12/12 unit tests passing |
| **G3-T02** | Checkpoint 3 material intake tests | `journey-checkpoint3-material.test.tsx` | Vitest | **Verified** | 12/12 integration tests passing |
| **G3-T03** | Checkpoint 4 discovery & goal tests | `journey-checkpoint4-branch.test.tsx` | Vitest | **Verified** | 14/14 branch integration tests passing |
| **G3-G04** | Dedicated ReadyStageView Back tests | `ready-stage-view.test.tsx` | Vitest | **Verified** | 3/3 tests verify Back button dispatches when !ready |

### Accounting for the Six Finding Categories

- **Category A (Pending or half-finished implementation)**: Evaluated. In `MaterialStageView.tsx`, "Upload a file" and "Paste text" buttons are disabled with `title="Temporarily unavailable"`. This is an intentional spec decision to enforce URL-first intake without eliminating the affordance. In `src/server/domain/cohort-builder/tools.ts`, `start_discovery` is omitted from `STAGE_TOOL_NAMES['chat']` (`FINDING-TOOL-01`).
- **Category B (Symptom-only fixes and unresolved root causes)**: Evaluated. In `ReadyStageView.tsx`, the Back button was decoupled from `requiresReady`, resolving the button trap. However, the screen's main heading ("All set. Your learning experience is ready.") remains unconditional even when `ready === false`, presenting a contradictory UI state (`FINDING-READY-02`).
- **Category C (Existing defects, breakage, and regressions)**: Evaluated. Found 1 critical React lifecycle defect: conditional hook execution in `CohortWorkspacePane.tsx` (`FINDING-HOOK-01`), and unhandled error swallowing during activation in `ReadyStageView.tsx` (`FINDING-READY-01`).
- **Category D (Quality-standard gaps)**: Evaluated. Found 2 code-quality issues: synchronous `setState` inside effect (`FINDING-HOOK-02`) and raw `<img>` element instead of `<Image />` in `MaterialStageView.tsx` (`FINDING-LINT-01`).
- **Category E (Dead code and unused artifacts)**: Evaluated. `GoalStageView.tsx` and `GoalStageView.module.css` are no longer rendered anywhere in the application runtime after routing was unified into `DiscoveryStageView` (`FINDING-DEAD-01`).
- **Category F (Duplication and overengineering)**: Evaluated. Legacy `goal_setup` branch aliasing in `CohortWorkspacePane.tsx` duplicates the `DiscoveryStageView` render branch; can be unified once migration of old drafts is complete.

---

## 3. Prioritized Findings

### High Severity

#### `FINDING-HOOK-01` — React Hook `useEffect` is called conditionally after an early return in `CohortWorkspacePane.tsx`
- **Category**: Category C (Defect / React Rules of Hooks Violation)
- **Severity**: **High**
- **Affected Requirement**: G3-S06 (`CohortWorkspacePane.tsx` Component Lifecycle)
- **Source Location**: [src/client/screens/cohortBuilder/CohortWorkspacePane.tsx:280-309](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/CohortWorkspacePane.tsx#L280-L309)
- **Observed Code**:
  ```tsx
  if (!workspace) {
    return <div className={styles.rightPane}>Loading workspace state...</div>;
  }

  const progress = getProcessingProgress(workspace);
  const activeStage = getActiveStage(workspace);
  // ...
  useEffect(() => {
    if (inspectedStage) {
      const inspectedStep = progress.steps.find(s => stepToStageMap[s.label] === inspectedStage);
      if (!inspectedStep || (!inspectedStep.isComplete && !inspectedStep.isCurrent && !inspectedStep.isFailed)) {
        setInspectedStage(null);
      }
    }
  }, [activeStage, progress.steps, inspectedStage]);
  ```
- **Root Cause**:
  `useEffect` is defined on line 302, which is positioned *after* the early return guard `if (!workspace) return ...;` on line 280.
- **Impact**:
  Violates React's fundamental invariant: hooks must execute in the exact same sequence on every render. If `workspace` is null during initial load (e.g. slow network or first mount) and subsequently populated, React throws `Rendered more hooks than during the previous render` in development and causes undefined behavior in production.
- **Attribution**: Introduced in Guide G3 / pre-existing in pane refactor.
- **Remediation**:
  Hoist all hooks (`useMemo`, `useEffect`) above any conditional early returns, or compute `inspectedStage` reset inline / using a helper hook before checking `if (!workspace)`.

---

### Medium Severity

#### `FINDING-READY-01` — `ReadyStageView.handleActivate` executes `open_review` without checking if `prepare_release` succeeded
- **Category**: Category C (State Consistency / Error Handling)
- **Severity**: **Medium**
- **Affected Requirement**: G3-G02 (Ready Stage Activation Actions)
- **Source Location**: [src/client/screens/cohortBuilder/stages/ReadyStageView.tsx:57-61](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/ReadyStageView.tsx#L57-L61)
- **Observed Code**:
  ```ts
  const handleActivate = async () => {
    // Prepare private activation
    await dispatchAction({ type: 'prepare_release', mode: 'private_activation' });
    await dispatchAction({ type: 'open_review' });
  };
  ```
- **Root Cause**:
  `dispatchAction` returns a `Promise<boolean>` indicating whether the state mutation succeeded. `handleActivate` ignores the boolean returned by `prepare_release` and unconditionally proceeds to dispatch `open_review`.
- **Expected vs Actual**:
  - *Expected*: If `prepare_release` fails (e.g. release validation error, missing title/description, or network failure), activation stops and displays feedback to the creator.
  - *Actual*: The failure is ignored, and `open_review` is dispatched regardless, causing a cascade of errors or transitioning the creator to review without preparing the release payload.
- **Attribution**: Introduced in Guide G3 / Section G02.
- **Remediation**:
  Check the return value:
  ```ts
  const handleActivate = async () => {
    const prepared = await dispatchAction({ type: 'prepare_release', mode: 'private_activation' });
    if (!prepared) return;
    await dispatchAction({ type: 'open_review' });
  };
  ```

#### `FINDING-READY-02` — `ReadyStageView` displays unconditional success heading when build is incomplete
- **Category**: Category B (Symptom-only fix / UI State Inconsistency)
- **Severity**: **Medium**
- **Affected Requirement**: G3-G02 (Ready Stage Presentation)
- **Source Location**: [src/client/screens/cohortBuilder/stages/ReadyStageView.tsx:73-86](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/ReadyStageView.tsx#L73-L86)
- **Observed Code**:
  ```tsx
  <header className={styles.heading}>
    <p className={styles.eyebrow}>Your learning experience is ready</p>
    <h1>All set.</h1>
    <p>I’ve turned your material into a learning experience...</p>
  </header>
  ```
- **Root Cause**:
  `computeActiveStage(workspace)` returns `'ready'` whenever `workspace.journey.step === 'ready'`. However, `workspace.processing.status` can be `'processing'`, `'queued'`, or `'failed'` if sources were subsequently added or preferences changed. In this scenario, `ReadyStageView` renders with disabled primary buttons and a badge saying "Build not complete", but the main heading unconditionally proclaims "All set. Your learning experience is ready".
- **Impact**:
  User is presented with contradictory messaging: a triumphant "All set" announcement alongside disabled action buttons and a "Build not complete" badge.
- **Attribution**: Pre-existing in `ReadyStageView`, highlighted by the state-machine diagnosis.
- **Remediation**:
  Render conditional copy based on `ready`:
  ```tsx
  <header className={styles.heading}>
    <p className={styles.eyebrow}>{ready ? 'Your learning experience is ready' : 'Building your curriculum'}</p>
    <h1>{ready ? 'All set.' : 'In progress.'}</h1>
    <p>{ready ? 'I’ve turned your material into a learning experience...' : 'Your material is being processed into lessons...'}</p>
  </header>
  ```

#### `FINDING-TOOL-01` — `start_discovery` AI tool is omitted from the `chat` stage toolset
- **Category**: Category A (Incomplete Tool Integration)
- **Severity**: **Medium**
- **Affected Requirement**: Discovery & AI Co-Design
- **Source Location**: [src/server/domain/cohort-builder/tools.ts:35-40](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/server/domain/cohort-builder/tools.ts#L35-L40)
- **Observed Code**:
  ```ts
  chat: [
    ...ALWAYS_TOOLS, 'set_audience', 'set_daily_minutes', 'edit_presentation',
    'add_lesson', 'draft_curriculum', 'edit_lesson', 'remove_lesson', 'reorder_lessons', 'set_lesson_pin',
    'add_web_source', 'add_youtube_source', 'add_github_source',
    'add_text_source', 'add_pdf_source',
  ],
  ```
- **Root Cause**:
  `ALWAYS_TOOLS` contains `start_search` (which searches community cohorts), but does not contain `start_discovery` (which finds learning resources for a goal). While `CO_DESIGN_TOOLS` includes `start_discovery`, the `chat` stage explicitly defines its tool list and omits `start_discovery`.
- **Impact**:
  When a user asks the AI assistant in the chat pane to find YouTube videos or articles for a learning topic, the AI cannot invoke the resource discovery tool.
- **Attribution**: Pre-existing in tool routing.
- **Remediation**:
  Include `start_discovery` in `STAGE_TOOL_NAMES['chat']`.

---

### Low Severity

#### `FINDING-HOOK-02` — Synchronous `setState` inside `useEffect` causes cascading render in `CohortWorkspacePane.tsx`
- **Category**: Category D (Quality Standard / ESLint `react-hooks/set-state-in-effect`)
- **Severity**: **Low**
- **Source Location**: [src/client/screens/cohortBuilder/CohortWorkspacePane.tsx:302-309](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/CohortWorkspacePane.tsx#L302-L309)
- **Observed Code**:
  ```tsx
  useEffect(() => {
    if (inspectedStage) {
      const inspectedStep = progress.steps.find(s => stepToStageMap[s.label] === inspectedStage);
      if (!inspectedStep || (!inspectedStep.isComplete && !inspectedStep.isCurrent && !inspectedStep.isFailed)) {
        setInspectedStage(null);
      }
    }
  }, [activeStage, progress.steps, inspectedStage]);
  ```
- **Root Cause**:
  Synchronous state update inside `useEffect` body triggers an immediate secondary render cycle.
- **Remediation**:
  Derive valid inspected stage during render or memoize the stage validity instead of synchronizing via state.

#### `FINDING-DEAD-01` — `GoalStageView.tsx` and `GoalStageView.module.css` are orphaned from production runtime
- **Category**: Category E (Dead Code / Unused Artifacts)
- **Severity**: **Low**
- **Source Location**: [src/client/screens/cohortBuilder/stages/GoalStageView.tsx](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/GoalStageView.tsx)
- **Observed Code**:
  `CohortWorkspacePane.tsx` routes both `discovery` and `goal_setup` stages to `DiscoveryStageView`. `GoalStageView` is only referenced in test files.
- **Impact**:
  Maintenance overhead of maintaining a duplicate goal screen that is never displayed to end users.
- **Remediation**:
  Safely decommission `GoalStageView.tsx` and update legacy tests to exercise `DiscoveryStageView`.

#### `FINDING-LINT-01` — Native `<img>` tag used for YouTube thumbnails in `MaterialStageView.tsx`
- **Category**: Category D (Quality Standard / Next.js Image Optimization)
- **Severity**: **Low**
- **Source Location**: [src/client/screens/cohortBuilder/stages/MaterialStageView.tsx:52](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/cohortBuilder/stages/MaterialStageView.tsx#L52)
- **Observed Code**:
  ```tsx
  <img className={styles.thumbnail} src={'https://i.ytimg.com/vi/'+videoId+'/hqdefault.jpg'} alt="" loading="lazy" referrerPolicy="no-referrer" />
  ```
- **Impact**:
  Triggers `@next/next/no-img-element` warning during linting.
- **Remediation**:
  Add `i.ytimg.com` to `remotePatterns` in `next.config.js` and use Next.js `<Image />` component with fixed width/height.

---

## 4. Checks and Evidence

| Check ID | Tool / Command | Target / Scope | Result | Observed Evidence |
|---|---|---|---|---|
| **CHK-01** | `npm run verify:vercel` | Full repo build & submodules | **PASSED** (88.5s) | Submodules ok, internal packages built, Prisma client generated, TSC passed (29.6s), Production build simulation compiled 50/50 pages (45.5s) |
| **CHK-02** | `npx tsc --noEmit --incremental false` | Whole project types | **PASSED** (29.6s) | 0 type errors |
| **CHK-03** | `git diff --check` | Working tree whitespace | **PASSED** | 0 whitespace or formatting errors |
| **CHK-04** | `npx vitest run src/client/screens/cohortBuilder src/client/screens/cohortCreation src/shared/cohort-builder` | Cohort builder unit & integration | **PASSED** (25.4s) | 65 test files, 572 tests passed (100%) |
| **CHK-05** | `npx vitest run src/client/feedback src/client/components/global/Toast src/client/screens/dashboard src/client/personal-workspace` | Dashboard & Feedback surfaces | **PASSED** (25.8s) | 85 test files, 619 tests passed (100%) |
| **CHK-06** | `npx eslint` on G3 modified files | S1–S7 and G2 modified files | **FAILED** (Code 1) | Detected conditional `useEffect` in `CohortWorkspacePane.tsx` (`react-hooks/rules-of-hooks`) and `<img>` warning in `MaterialStageView.tsx` |

---

## 5. Unverified Risks and Blocked Investigation

1. **Third-Party YouTube API Rate Limits**:
   - Client calls `/api/import/youtube/metadata` to inspect playlist items. If the YouTube API key quota is exhausted in production, playlists fail gracefully, but fall back to single video URLs. Verified non-fatal in unit tests, but real network behavior depends on deployment environment credentials.
2. **Server Background Worker Queuing**:
   - Non-deterministic video observation pipelines schedule asynchronous background extraction jobs. The unit tests mock the job scheduler; real production worker latency under high concurrency remains to be monitored via `worker-diagnostics.ts`.

---

## 6. Correction Order and Completion Criteria

To elevate the cohort creation workflow from **Conditional Acceptance** to **Full Perfection**, apply the following targeted remediations in dependency order:

1. **Phase 1: React Lifecycle & Hook Safety (`FINDING-HOOK-01` & `FINDING-HOOK-02`)**:
   - Move `useEffect` in `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx` above the `if (!workspace)` guard.
   - Refactor `inspectedStage` validity check so it does not trigger cascading synchronous `setState`.
   - *Verification*: `npx eslint src/client/screens/cohortBuilder/CohortWorkspacePane.tsx` passes with 0 errors.

2. **Phase 2: Ready Stage Error Safety & Heading Truthfulness (`FINDING-READY-01` & `FINDING-READY-02`)**:
   - In `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx`, guard `open_review` with `if (!prepared) return;`.
   - Update header copy to show "In progress" when `!ready` instead of "All set".
   - *Verification*: Run `ready-stage-view.test.tsx` and assert correct status copy on incomplete builds.

3. **Phase 3: AI Chat Tool Parity (`FINDING-TOOL-01`)**:
   - In `src/server/domain/cohort-builder/tools.ts`, add `'start_discovery'` to `STAGE_TOOL_NAMES['chat']`.
   - *Verification*: Run `src/server/domain/cohort-builder/__tests__/external-tools.test.ts`.

4. **Phase 4: Dead Code Pruning (`FINDING-DEAD-01`)**:
   - Remove `GoalStageView.tsx` and `GoalStageView.module.css` or archive them.
   - *Verification*: Run `journey-checkpoint4-branch.test.tsx`.
