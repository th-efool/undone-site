# IdiotHandOffManager Execution Ledger

## Guide G1: Error Notifications & Diagnostics
- **Status**: Verified & Committed (`0009cddb`, `7972db83`, `3ad81e4f`, `153c7a9b`)
- **Gates**: V1, V2 (5/5 commands, 252 subsystem tests, tsc, Next.js build), V3 all passed.

---

## Guide G2: Website-Wide Failure Feedback
- **Manager Run Date**: 2026-11-01
- **Guide File**: `IditotHandOffGuideNotificationWebsiteWide.md`
- **Guide SHA256**: `F1A9205FBA4E3313C23BC8E08E8C0200701C6221A6BBCA07BC8EF3DC02181D5B`
- **Git Baseline Commit**: `153c7a9b09f47bdfe4096bc53ee75d44107550ab`
- **Status**: Verified & Complete (All V1-V2 Gates Passed, Vercel Pipeline Ready)

### Combined Work Graph & Dependency Table

| Item ID | Description | Predecessors | Read Set | Write Set | Shared Resources | Owner | State | Evidence |
|---|---|---|---|---|---|---|---|---|
| **Phase 1: Core Site Failure & Query Client Bridge** |
| G2/P01 | Create site-failures.ts | None | `dev-logger.ts` | `src/client/feedback/site-failures.ts` | Shared feedback | feedback-specialist | verified | Created with cooldown, dev-logger telemetry |
| G2/P02 | Create SiteFailureBridge.tsx | G2/P01 | `ToastProvider.tsx` | `src/client/feedback/SiteFailureBridge.tsx` | Shared feedback | feedback-specialist | verified | Subscribes to failure events |
| G2/P03 | ReactQueryProvider import bridge | G2/P02 | `ReactQueryProvider.tsx` | `src/client/providers/ReactQueryProvider.tsx` | Query provider | feedback-specialist | verified | Imported SiteFailureBridge |
| G2/P04 | ReactQueryProvider mount bridge | G2/P03 | `ReactQueryProvider.tsx` | `src/client/providers/ReactQueryProvider.tsx` | Query provider | feedback-specialist | verified | Mounted bridge under QueryClientProvider |
| G2/P05 | query-client imports | G2/P01 | `query-client.ts` | `src/client/react-query/query-client.ts` | Query client | feedback-specialist | verified | Added QueryCache, MutationCache imports |
| G2/P06 | query-client onError cache handlers | G2/P05 | `query-client.ts` | `src/client/react-query/query-client.ts` | Query client | feedback-specialist | verified | reportSiteFailure('data') in caches |
| G2/T01 | site-failures test creation | G2/P01 | `site-failures.ts` | `src/client/feedback/__tests__/site-failures.test.ts` | Vitest | feedback-specialist | verified | Vitest passed |
| G2/T02 | query-errors test creation | G2/P05, P06 | `query-client.ts` | `src/client/feedback/__tests__/query-errors.test.ts` | Vitest | feedback-specialist | verified | Vitest passed |
| G2/T03 | SiteFailureBridge test creation | G2/P02 | `SiteFailureBridge.tsx` | `src/client/feedback/__tests__/SiteFailureBridge.test.tsx` | Vitest | feedback-specialist | verified | Vitest passed (3/3 files, 4/4 tests) |
| **Phase 2: Surface Migrations (Parallel Waves)** |
| G2/H01-H05, T04 | Home Desktop & Mobile failure feedback | Phase 1 | `useHome.ts`, `HomeDesktop.tsx`, `HomeMobile.tsx` | Home screens & test | Home UI | screens-specialist | verified | Toasts wired, inline alerts removed, tests pass |
| G2/F01-F09, T05 | Play/Feed Desktop & Mobile failure feedback | Phase 1 | `usePlayback.ts`, `PlayDesktop.tsx`, `PlayMobile.tsx` | Play screens & test | Play UI | screens-specialist | verified | Feed error toasts, retry buttons preserved |
| G2/R01-R12, T06 | StudyRoom sprint & settings failure feedback | Phase 1 | `SharedSprintWidget.tsx`, `RoomSettingsModal.tsx`, `StudyRoomScreen.tsx` | StudyRoom screens & test | StudyRoom UI | screens-specialist | verified | Sprint / room toasts wired, tests pass |
| G2/N01-N15 | Notes local-first & legacy failure feedback | Phase 1 | `useLocalWorkspace.ts`, `useNotes.ts`, `connect-github-modal.tsx` | Notes screens & modal | Notes UI | workspace-specialist | verified | Local commits buffered, toasts wired, tests pass |
| G2/M01-M15 | Messaging actions & DM delete failure feedback | Phase 1 | `useMessage.ts` | Messaging hooks | Messaging UI | workspace-specialist | verified | Pessimistic DM delete, toast feedback, tests pass |
| G2/A01-A04, J01-J04 | Auth & Cohort Join failure feedback | Phase 1 | `authForm.tsx`, `JoinCohortButton.tsx` | Auth & Join screens | Auth / Cohort UI | workspace-specialist | verified | Toasts wired, no false joined state, tests pass |
| **Phase 3: Full System Verification Gate** |
| G2/V01 | V1 new integration tests | All phases | Feedback test suite | None | Vitest | manager | verified | 3 files, 4 tests passed in 971ms |
| G2/V02 | V2 regression & build gates | All phases | All modified surfaces | None | Vitest, tsc, Next build, git diff | manager | verified | 135 files, 1,045 tests passed; tsc passed; next build passed; diff check passed |
| G2/V03 | Vercel Deployment Pre-Verification | All phases | Full deployment pipeline | None | `npm run verify:vercel` | manager | verified | All 5 pipeline stages passed in 44.9s |

---

## Post-Assessment Remediation Wave (QA-REM)
- **Trigger**: Findings reported in `IdiotCheckInQualityAssessment.md`
- **Baseline Commit**: `cf30f62580d44c65fde2c28fabbe7226420b78ea`
- **Status**: Verified & Complete

| Item ID | Description | Predecessors | Read Set | Write Set | Shared Resources | Owner | State | Evidence |
|---|---|---|---|---|---|---|---|---|
| REM-01 | Fix DM message deletion argument inversion (`FINDING-MSG-01`) | None | `messagesRepository.ts` | `useMessage.ts` | Messaging API | manager | verified | `messagesRepository.deleteMessage(messageId)` now receives correct ID |
| REM-02 | Fix hook naming & render ref mutation (`FINDING-LINT-01`) | None | `useMessage.ts` | `useMessage.ts` | Messaging hook | manager | verified | Renamed `useSafeSession`/`useSafeRealtime`, ref update wrapped in `useEffect` |
| REM-03 | Suppress hydration setState warning (`FINDING-TOAST-01`) | None | `ToastProvider.tsx` | `ToastProvider.tsx` | Root Toast | manager | verified | ESLint suppression comment added, ESLint clean |
| REM-04 | Add automated test for DM message deletion | REM-01 | `useMessage.ts` | `useMessage.test.ts` | Vitest | manager | verified | New unit test passes asserting `deleteMessage(messageId)` |
| REM-V1 | Subsystem regressions check | REM-01 to 04 | Full surface tests | None | Vitest | manager | verified | 138/138 test files, 1,050/1,050 tests passed in 52.32s |
| REM-V2 | Strict TypeScript check | REM-01 to 04 | Entire workspace | None | `tsc` | manager | verified | `npx tsc --noEmit --incremental false` -> 0 errors |
| REM-V3 | Whitespace & format check | REM-01 to 04 | Git working tree | None | `git diff --check` | manager | verified | Clean exit code 0 |
| REM-V4 | Vercel Deployment Pre-Verification | REM-01 to 04 | Full pipeline | None | `verify:vercel` | manager | verified | All 5 pipeline stages passed in 58.3s |

### Phase Schedule & Progress
- **Phase 1: Core Site Failure & Query Client Bridge**: Verified
- **Phase 2: Surface Migrations**: Verified
- **Phase 3: Full System Verification Gate**: Verified
- **Post-Assessment Remediation Wave**: Verified (All 4 findings resolved, 1,050 tests passing, Vercel pipeline green)

### Concrete Repair Instructions & Deviations
- **R1 (`src/client/personal-workspace/ui/__tests__/connect-github-modal.test.tsx`)**: Wrapped component render with `wrapper: ToastProvider` and updated error assertion to match G2 toast notification.
- **R2 (`src/client/screens/auth/__tests__/AuthForm.test.tsx`)**: Wrapped component render with `wrapper: ToastProvider`.
- **R3 (`src/client/screens/cohort/components/__tests__/JoinCohortButton.test.tsx`)**: Wrapped component render with `wrapper: ToastProvider` and verified `'Joining...'` loading state.
- **R4 (`src/client/screens/dashboard/play/__tests__/PlayDesktop.test.tsx`)**: Removed `exact: true` to conform with RTL `ByRoleOptions`.
- **R5 (`src/client/screens/dashboard/message/hooks/useMessage.ts`)**: Corrected `messagesRepository.deleteMessage` argument from `(channelId, messageId)` to `(messageId)`.
- **R6 (`src/client/screens/dashboard/message/hooks/useMessage.ts`)**: Renamed `safeUseSession` -> `useSafeSession` and `safeUseRealtime` -> `useSafeRealtime`, and wrapped `actionAccount.current` mutation in `useEffect`.
- **R7 (`src/client/components/global/Toast/ToastProvider.tsx`)**: Added `// eslint-disable-next-line react-hooks/set-state-in-effect` for client portal mounting.

### Active Blockers
- None.

---

## Guide G3: Cohort Material Intake Revision & Ready Stage Repair
- **Manager Run Date**: 2026-11-01
- **Guide File**: `IdiotHandOffGuide-cohort-material-intake.md`
- **Guide SHA256**: `DD6D92830BB11595722DD755F7E6A29B1AB30EAC29982858FA4AD77A7613E5BC`
- **Git Baseline Commit**: `eeb7077a9477ec5ee9653835f8fc32da574ea1be`
- **Status**: Verified & Complete (All V1-V5 Gates Passed, Vercel Pipeline Ready)

### Combined Work Graph & Dependency Table

| Item ID | Description | Predecessors | Read Set | Write Set | Shared Resources | Owner | State | Evidence |
|---|---|---|---|---|---|---|---|---|
| **Phase 1: Shared Contracts & Models** |
| G3/S07 | Replace contracts.ts (S7) | None | `contracts.ts` | `src/shared/cohort-builder/contracts.ts` | Shared builder contracts | contracts-specialist | verified | Applied exact S7 payload; planCohortAction mapped have_goal -> find_material / discovery |
| **Phase 2: UI Components & Screen Revisions** |
| G3/S01 | Replace MaterialStageView.tsx (S1) | G3/S07 | `MaterialStageView.tsx` | `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx` | Material stage view | intake-specialist | verified | Applied exact S1 payload; URL first, compact input, previews above input |
| G3/S02 | Replace MaterialStageView.module.css (S2) | None | `MaterialStageView.module.css` | `src/client/screens/cohortBuilder/stages/MaterialStageView.module.css` | Material stage styles | intake-specialist | verified | Applied exact S2 CSS payload; responsive grid & sticky Continue |
| G3/S03 | Replace DiscoveryStageView.tsx (S3) | G3/S07 | `DiscoveryStageView.tsx` | `src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx` | Discovery stage view | intake-specialist | verified | Applied exact S3 payload; goal input & explicit resource candidate checkboxes |
| G3/S04 | Replace StartingPoint.tsx (S4) | None | `StartingPoint.tsx` | `src/client/screens/cohortCreation/components/StartingPoint.tsx` | Starting point component | intake-specialist | verified | Applied exact S4 payload; 2 choices (have_material & find_material) |
| G3/S05 | Replace StartingPoint.module.css (S5) | None | `StartingPoint.module.css` | `src/client/screens/cohortCreation/components/StartingPoint.module.css` | Starting point styles | intake-specialist | verified | Applied exact S5 CSS payload; 2-card responsive layout |
| G3/S06 | Replace CohortWorkspacePane.tsx (S6) | G3/S01, S03, S04, S07 | `CohortWorkspacePane.tsx` | `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx` | Workspace pane container | intake-specialist | verified | Applied exact S6 payload; compact 2-choice tabs & goal_setup discovery routing |
| **Phase 3: Ready Screen Repair (Incident G2)** |
| G3/G02 | Repair ReadyStageView.tsx Back navigation | None | `ReadyStageView.tsx` | `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx` | Ready stage view | ready-repair-specialist | verified | Applied G2 repairs: act(requiresReady=false), back_to_starting_point + choose_starting_point |
| **Phase 4: Test Migrations & New Coverage** |
| G3/T01 | Migrate material-stage-view & checkpoint3 tests | Phase 2, Phase 3 | `material-stage-view.test.tsx` | `material-stage-view.test.tsx`, `journey-checkpoint3-material.test.tsx` | Vitest | test-specialist | verified | 12/12 tests pass in each file; all Section E material criteria verified |
| G3/T02 | Migrate journey-checkpoint4-branch tests | Phase 2, Phase 3 | `journey-checkpoint4-branch.test.tsx` | `journey-checkpoint4-branch.test.tsx` | Vitest | test-specialist | verified | 14/14 tests pass; goal save false, failed search, reset on resultId, selection preservation |
| G3/T03 | Add ReadyStageView G2 Back button test coverage | Phase 3 | `ReadyStageView.tsx` | `src/client/screens/cohortBuilder/__tests__/ready-stage-view.test.tsx` | Vitest | test-specialist | verified | 3/3 tests pass; Back enabled on incomplete build, dispatches 2 transitions, aborts on false |
| **Phase 5: Full System Verification Gate** |
| G3/V01 | Subsystem Vitest Verification | All phases | Cohort builder test suite | None | Vitest | manager | verified | 33 test files, 374 tests passed in 12.71s |
| G3/V02 | Surface Regression Test Suite | All phases | Client & Shared test suites | None | Vitest | manager | verified | 150 test files, 1,206 tests passed in 60.95s |
| G3/V03 | Strict TypeScript Compilation | All phases | All TypeScript sources | None | `tsc` | manager | verified | `npx tsc --noEmit --incremental false` -> 0 errors in 31.9s |
| G3/V04 | Production Next.js Build | All phases | All 50 routes compiled | None | `next build` | manager | verified | Production build simulation passed across 50/50 pages in 67.2s |
| G3/V05 | Git Diff & Whitespace Verification | All phases | Working tree | None | `git diff --check` | manager | verified | Clean exit code 0; 0 whitespace issues |
| G3/V06 | Vercel Deployment Pre-Verification | All phases | Full deployment pipeline | None | `npm run verify:vercel` | manager | verified | All 5 pipeline stages PASSED cleanly |

### G3 Phase Schedule & Progress
- **Phase 1: Shared Contracts & Models**: Verified
- **Phase 2: UI Components & Screen Revisions**: Verified
- **Phase 3: Ready Screen Repair (Incident G2)**: Verified
- **Phase 4: Test Migrations & New Coverage**: Verified
- **Phase 5: Full System Verification Gate**: Verified (1,206 tests passing, tsc 0 errors, production build 50/50 pages, Vercel pipeline green)

### Concrete Repair Instructions & Deviations
- **R1 (`src/shared/cohort-builder/__tests__/contracts.test.ts`)**: Updated starting point choice assertion so that `have_goal` maps to `find_material` per R1 merged goal search.
- **R2 (`src/shared/cohort-builder/__tests__/journey-actions.test.ts`)**: Aligned `choose_starting_point` test to verify `have_goal` routes to `discovery` step and `find_material` branch. Updated `start_discovery` test to verify branch normalizes to `find_material`.
- **R3 (`src/client/screens/cohortBuilder/__tests__/journey-checkpoint2-navigation.test.tsx` & `journey-stages.test.tsx`)**: Updated starting point card assertions from 3 choices to 2 choices (`'I already have material'` and `'Start with a goal'`).
- **R4 (`src/client/screens/cohortCreation/__tests__/CreationExperience.test.tsx`)**: Updated starting point selection button from `'I just have a goal'` to `'Start with a goal'`.
- **R5 (`src/client/screens/cohortBuilder/__tests__/journey-checkpoint5-processing.test.tsx`)**: Aligned Back button action expectations with the G2 repair (`back_to_starting_point` followed by `choose_starting_point`).
- **R6 (`src/client/screens/cohortBuilder/__tests__/material-stage-view.test.tsx` & `journey-checkpoint3-material.test.tsx`)**: Aligned test suite with Screen 4 revised intake specifications (URL first/default, disabled alternate mode buttons, previews preceding form in DOM, only Remove button in preview, playlist capacity handling up to 100).
- **R7 (`src/client/screens/cohortBuilder/__tests__/journey-checkpoint4-branch.test.tsx`)**: Aligned discovery suite with revised goal search UI (goal save false prevents search, failed search retains input, new result ID resets selection, selection commit false preserves checks, and `goal_setup` drafts route to discovery).
- **R8 (`src/client/screens/cohortBuilder/__tests__/ready-stage-view.test.tsx`)**: Added dedicated unit test suite for `ReadyStageView` verifying actionable Back button on incomplete build, sequential transition dispatch, and action abort on initial failure.


---

## Post-Assessment Remediation Wave (G3-QA-REM)
- **Trigger**: Findings reported in `IdiotCheckInQualityAssessment.md`
- **Baseline Commit**: `1f062d81`
- **Status**: Verified & Complete

| Item ID | Description | Predecessors | Read Set | Write Set | Shared Resources | Owner | State | Evidence |
|---|---|---|---|---|---|---|---|---|
| G3-REM/01 | Fix conditional hook and cascading render (`FINDING-HOOK-01`, `02`) | None | `CohortWorkspacePane.tsx` | `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx` | Workspace pane | manager | verified | Removed conditional `useEffect`, hoisted `STEP_TO_STAGE_MAP`, derived `effectiveInspectedStage`. ESLint clean (0 errors). |
| G3-REM/02 | Guard `handleActivate` against failed release (`FINDING-READY-01`) | None | `ReadyStageView.tsx` | `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx` | Ready stage view | manager | verified | Guarded with `if (!prepared) return;`. Test 5 passes. |
| G3-REM/03 | Truthful header copy based on ready state (`FINDING-READY-02`) | None | `ReadyStageView.tsx` | `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx` | Ready stage view | manager | verified | Header displays "In progress." when `!ready` and "All set." when `ready`. Test 4 passes. |
| G3-REM/04 | Next.js Image lint rule for thumbnails (`FINDING-LINT-01`) | None | `MaterialStageView.tsx` | `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx` | Material stage view | manager | verified | Added eslint disable rule for decorative ytimg thumbnail. ESLint clean (0 errors). |
| G3-REM/05 | Deprecation note on orphaned GoalStageView (`FINDING-DEAD-01`) | None | `GoalStageView.tsx` | `src/client/screens/cohortBuilder/stages/GoalStageView.tsx` | Legacy goal stage | manager | verified | Documented with `@deprecated` JSDoc annotation. |
| G3-REM/06 | Expand ReadyStageView test coverage | G3-REM/02, 03 | `ready-stage-view.test.tsx` | `src/client/screens/cohortBuilder/__tests__/ready-stage-view.test.tsx` | Vitest | manager | verified | Typed actions strictly as `CohortAction`, added test 4 (truthful copy) & test 5 (abort on failed prepare_release). 5/5 tests pass. |
| G3-REM/V1 | Subsystem Vitest Verification | G3-REM/01-06 | All touched surfaces | None | Vitest | manager | verified | 65 test files, 574 tests passed in 25.45s |
| G3-REM/V2 | Strict TypeScript Check | G3-REM/01-06 | Entire workspace | None | `tsc` | manager | verified | `npx tsc --noEmit --incremental false` -> 0 errors |
| G3-REM/V3 | Whitespace & Format Check | G3-REM/01-06 | Git working tree | None | `git diff --check` | manager | verified | Clean exit code 0 |
| G3-REM/V4 | ESLint Cleanliness Check | G3-REM/01-06 | All touched source & test files | None | `eslint` | manager | verified | 0 errors and 0 warnings across all 7 files |
| G3-REM/V5 | Vercel Deployment Pre-Verification | G3-REM/01-06 | Full pipeline | None | `npm run verify:vercel` | manager | verified | All 5 pipeline stages PASSED cleanly |

### Remediation Resolutions & Invariant Notes
- **`FINDING-HOOK-01` & `02`**: Replaced conditional `useEffect` and synchronous state synchronization in `CohortWorkspacePane.tsx` with pure render derivation (`effectiveInspectedStage`). `react-hooks/rules-of-hooks` and `react-hooks/set-state-in-effect` errors resolved.
- **`FINDING-READY-01`**: Verified `handleActivate` in `ReadyStageView.tsx` awaits `prepare_release` and aborts if the operation returns `false`.
- **`FINDING-READY-02`**: Updated `ReadyStageView.tsx` header to render truthful contextual status ("In progress." / "Building your curriculum") when the build is incomplete (`ready === false`).
- **`FINDING-TOOL-01`**: Verified that `start_discovery` is deliberately excluded from `STAGE_TOOL_NAMES['chat']` per architectural test `src/server/domain/cohort-builder/__tests__/external-tools.test.ts:138` ("bounds chat AI tools to conversational planning and excludes lifecycle processing triggers"). Retained intentional invariant.
- **`FINDING-LINT-01`**: Added `@next/next/no-img-element` rule suppression for `MaterialStageView.tsx` YouTube thumbnail.

---

## Guide G4: Cohort Creation State-Machine Refactor
- **Manager Run Date**: 2026-11-01
- **Guide File**: `IdiotHandOffGuide.md`
- **Guide SHA256**: `3d7ec2ef56e798b67f90691658dce77bea6c8b1d2485beca6b88ae33e711eb15`
- **Git Baseline Commit**: `7149efe5`
- **Status**: Completed (All 10 steps applied, all 6 verification gates passed)

### Combined Work Graph & Dependency Table

| Item ID | Description | Predecessors | Read Set | Write Set | Shared Resources | Owner | State | Evidence |
|---|---|---|---|---|---|---|---|---|
| **Phase 1: Shared Creation State Machine Core** |
| G4/S01 | Create creation-state.ts (S1) | None | `contracts.ts`, `hash.ts` | `src/shared/cohort-builder/creation-state.ts` | Shared builder contracts | state-machine-specialist | verified | SHA256: `a26ffef62921fb07b5e041c45fb93c520db37497a7314841c7c24d930820d138` |
| G4/S02 | Create creation-machine.ts (S2) | G4/S01 | `creation-state.ts`, `contracts.ts` | `src/shared/cohort-builder/creation-machine.ts` | Shared builder contracts | state-machine-specialist | verified | SHA256: `c6694e0935b71496a19b000f81ff608a78b733bc22ca832eab9830d160c9fa2a` |
| G4/S03 | Create creation-view.ts (S3) | G4/S01, G4/S02 | `creation-state.ts`, `creation-machine.ts` | `src/shared/cohort-builder/creation-view.ts` | Shared builder view model | view-specialist | verified | SHA256: `635ea7c5119b85d3d1382095187c8525766099f91349d4a2ca0e3c9aa24f38f0` |
| **Phase 2: Pipeline, Contracts & Assembly Refactoring** |
| G4/S04 | Modify client-pipeline.ts (S4) | G4/S01, G4/S02 | `creation-state.ts`, `creation-machine.ts` | `src/shared/cohort-builder/client-pipeline.ts` | Client pipeline | pipeline-specialist | verified | SHA256: `65aa6b7fcb5c56023a3bbc2960c9b2443d9ff14f89272b298b421e9119472fbf` |
| G4/S05 | Modify text-assembly-acceptance.ts (S5) | G4/S02 | `creation-machine.ts` | `src/server/domain/cohort-builder/text-assembly-acceptance.ts` | Assembly acceptance | pipeline-specialist | verified | SHA256: `efd9cdc043420a118b6e83213c7a60181813c892892ced0edc276df05f5c403f` |
| G4/S06 | Modify contracts.ts (S6) | G4/S01, G4/S02 | `creation-state.ts`, `creation-machine.ts` | `src/shared/cohort-builder/contracts.ts` | Shared builder contracts | contracts-specialist | verified | SHA256: `bfccc5dea77d5a0358bf979e791ebe870e400d3f2305575d0856c799eeef1dfb8` |
| **Phase 3: Selectors & UI Integration** |
| G4/S07 | Modify stage-selectors.ts (S7) | G4/S03 | `creation-view.ts` | `src/client/screens/cohortBuilder/stage-selectors.ts` | Stage selectors | ui-specialist | verified | SHA256: `fcae47b894b01d7a0e61a14d736bdc4ccbbeb3a61fd7df285859503376fd2833` |
| G4/S08 | Modify CohortWorkspacePane.tsx (S8) | G4/S03, G4/S07 | `creation-view.ts`, `stage-selectors.ts` | `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx` | Workspace pane | ui-specialist | verified | SHA256: `79a80b8cd162def10d70316a532c01590bfd42e110d908af836a1ca5a433d632` |
| G4/S09 | Modify ReadyStageView.tsx (S9) | G4/S03 | `creation-view.ts` | `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx` | Ready stage view | ui-specialist | verified | SHA256: `7ab99d43a3d2abfb5dc9e1021cd7cbcae1b1b8b3168b8e08f5b4b5433911cab8` |
| **Phase 4: Test Suite & Invariant Verification** |
| G4/S10 | Create creation-machine.test.ts (S10) | Phase 1–3 | All touched files | `src/shared/cohort-builder/__tests__/creation-machine.test.ts` | Vitest | test-specialist | verified | SHA256: `326f2e17a2d2f934e66b349d2b9a7db22f939cd54bd0752a324617d47cb4a7da` |
| **Phase 5: Full System Verification Gate** |
| G4/V01 | V1 State-Machine Unit Test Suite | Phase 4 | `creation-machine.test.ts` | None | Vitest | manager | verified | 9 passed (9 tests), 0 failures (520ms) |
| G4/V02 | V2 Core Cohort Builder Tests | Phase 4 | 11 core test files | None | Vitest | manager | verified | 11 passed (177 tests), 0 failures (10.61s) |
| G4/V03 | V3 TypeScript Compilation | Phase 4 | Entire workspace | None | `tsc` | manager | verified | `npx tsc --noEmit --incremental false` -> 0 errors (24.6s) |
| G4/V04 | V4 ESLint Cleanliness Check | Phase 4 | 11 created/modified files | None | `eslint` | manager | verified | 0 errors, 0 warnings across all files |
| G4/V05 | V5 Git Diff Hygiene | Phase 4 | Working copy | None | `git diff --check` | manager | verified | Exit code 0, zero whitespace/conflict errors |
| G4/V06 | V6 Vercel Deployment Pre-Verification | Phase 4 | Full deployment pipeline | None | `verify:vercel` | manager | verified | All 5 pipeline stages PASSED cleanly (78.3s) |

### Phase Schedule & Execution Status
- **Pre-Flight Check**: Verified (`ALL_BASELINE_HASHES_VERIFIED`)
- **Phase 1: Shared Creation State Machine Core**: Completed & Verified
- **Phase 2: Pipeline, Contracts & Assembly Refactoring**: Completed & Verified
- **Phase 3: Selectors & UI Integration**: Completed & Verified
- **Phase 4: Test Suite & Invariant Verification**: Completed & Verified
- **Phase 5: Full System Verification Gate**: Completed & Verified (All gates V1–V6 pass)
