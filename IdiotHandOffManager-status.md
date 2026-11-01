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

### Phase Schedule & Progress
- **Phase 1: Core Site Failure & Query Client Bridge**: Verified
- **Phase 2: Surface Migrations**: Verified (Worker 1: Home, Play, StudyRoom; Worker 2: Notes, Messaging, Auth/Join)
- **Phase 3: Full System Verification Gate**: Verified (1,045 tests passed, TypeScript clean, Next.js build clean, Vercel pipeline clean)

### Concrete Repair Instructions & Deviations
- **R1 (`src/client/personal-workspace/ui/__tests__/connect-github-modal.test.tsx`)**: In RTL, wrapped component render with `wrapper: ToastProvider` and updated error assertion to match G2 toast notification (`'Could not complete the repository connection. Your notes remain on this device.'`).
- **R2 (`src/client/screens/auth/__tests__/AuthForm.test.tsx`)**: In RTL, wrapped component render with `wrapper: ToastProvider` so toast notifications rendered by `useFailureToast` are accessible to `screen.getByRole('alert')`.
- **R3 (`src/client/screens/cohort/components/__tests__/JoinCohortButton.test.tsx`)**: In RTL, wrapped component render with `wrapper: ToastProvider`, updated error toast text assertion, and verified `'Joining...'` loading state (`disabled={true}`) to enforce "no false joined state".
- **R4 (`src/client/screens/dashboard/play/__tests__/PlayDesktop.test.tsx`)**: Fixed TS compilation issue where `exact: true` was passed to `screen.getByRole('button', { name: 'Retry' })`. Removed `exact: true` to conform with RTL `ByRoleOptions`.

### Active Blockers
- None.
