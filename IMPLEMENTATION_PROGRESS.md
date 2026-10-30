# Implementation Progress: Feed and Home Remediation

**Active Plan:** `PLAN.md` (Feed and Home detailed remediation plan, FH-01 through FH-14)  
**Date Started:** 2026-10-30  
**Overall Status:** Complete (All 14 Packages Implemented, Verified, Built, and Documented)

---

## Phase Status Summary

| Phase | Package | Description | Status | Tests Passed | Blockers / Notes |
|---|---|---|---|---|---|
| 1 | FH-01 | Progress persistence errors, validation, and client acknowledgment | Complete | 68 passed | Mongo error propagation, Zod validation, rollback on malformed/error |
| 2 | FH-02 | Home progress projection from Mongo UserChunkProgress | Complete | 11 passed | Pure `retainedLessonCompleted`, derived cohort % from Mongo |
| 3 | FH-03 | Explicit chunk selection & replay priority before ranking | Complete | 29 passed | First position in interleaver, no revival of completed without explicit request |
| 4 | FH-05 | Complete catalog scanning without silent 100-lesson cutoff | Complete | 6 passed | Stable SQL cursoring in batches of 100, vector cache key SHA-256 |
| 5 | FH-04 | Bounded exclusion continuation protocol (replacing offset pagination) | Complete | 39 passed | POST exclusions, 1 MiB limit, max 5000 IDs, hasMore, servedChunkIds |
| 6 | FH-06 | User-scoped canonical preferences, hydration, and reliable save lifecycle | Complete | 20 passed | Canonical `sidequest_channel_config_v2:<userId>`, serialized save |
| 7 | FH-07 | Home mutation serialization & identity-safe rollback guard | Complete | 20 passed | Guarded mutation runner, combined state, disabled UI controls |
| 8 | FH-08 | Atomic durable rank/pause ordering & cache corrections | Complete | 12 passed | Order service, cohort-config route, MongoDB atomic updates |
| 9 | FH-09 | Separation of loading, empty, error, and optional enrichment | Complete | 27 passed | HomeLoading.tsx, error boundary, truthful DB failures |
| 10 | FH-10 | Mobile Home feature parity (pause/resume/edit/delete/channel/search) | Complete | 8 passed | Mobile actions & modals parity, ChannelHub, search, error alert |
| 11 | FH-11 | Local-day schedule scoring without double timezone shifts | Complete | 45 passed | localDayOfWeek/localHour UTC derivation, real now for recency |
| 12 | FH-12 | Truthful supporting widgets (studyrooms, calendar, activity, providers) | Complete | 11 passed | Real HomeStudyRooms, real local calendar/providers, disabled unconsumed tuning |
| 13 | FH-13 | Proven dead code removal & consolidation of necessary duplication | Complete | 10 passed | Deleted dead files/folders/methods; removed previousCohortId & variety heuristic |
| 14 | FH-14 | Verification, test repair, manual acceptance matrix, and MEMORY updates | Complete | 219 passed | 0 failures, tsc clean, eslint clean, next build clean, memory updated |

---

## Detailed Phase Records

### Phase 1: FH-01 — Make progress persistence truthful
- **Requirements Addressed**:
  - `ProgressStorageError` defined and thrown on missing Mongo or bulk-write failures.
  - `recordProgress` returns persisted document or throws `ProgressStorageError` (no silent `return null`).
  - `recordProgressBatch`: nonempty batch with missing Mongo or bulk-write failure throws `ProgressStorageError`. Partial failures identified.
  - `getUserProgressMap`: storage outage throws, does not swallow into empty map.
  - Zod validation in `/api/progress/chunk`: max 200 items, string/number legacy ID normalization, finite non-negative `watchedSeconds`, finite positive `totalSeconds`, valid `ChunkStatus`.
  - Inaccessible chunk IDs in batch rejected with 404 before writes.
  - Monotonic watch time calculation; idempotent retry preserves `completedAt`.
  - Maps `ProgressStorageError` to HTTP 503 `Cache-Control: no-store`.
  - Client (`usePlayback.ts`): validates `success === true`, `progress.chunkId === targetChunkId`, `progress.status === 'COMPLETED'`; rolls back optimistic update on failure or malformed 200.
- **Files Changed**:
  - `src/server/domain/progress/chunkProgress.service.ts`
  - `src/app/api/progress/chunk/route.ts`
  - `src/client/screens/dashboard/play/hooks/usePlayback.ts`
  - `src/server/domain/progress/__tests__/chunkProgress.service.test.ts`
  - `src/server/domain/progress/__tests__/chunkProgress.batch.test.ts`
  - `src/server/domain/progress/__tests__/chunkProgress.test.ts`
  - `src/app/api/progress/chunk/__tests__/route.batch.test.ts`
  - `src/client/screens/dashboard/play/hooks/__tests__/usePlayback.test.ts`
- **Tests Executed**:
  - `src/server/domain/progress/__tests__/` (22 tests passed)
  - `src/app/api/progress/chunk/__tests__/route.batch.test.ts` (12 tests passed)
  - `src/client/screens/dashboard/play/hooks/__tests__/usePlayback.test.ts` (34 tests passed)
- **Acceptance Criteria**: PASSED.

---

### Phase 2: FH-02 — Home progress projection from Mongo UserChunkProgress
- **Requirements Addressed**:
  - Pure `retainedLessonCompleted` and `isLessonCompleted` predicates in new `home.service.ts`.
  - A retained lesson is completed ONLY if every unique retained chunk ID has matching completed Mongo progress for the lesson/cohort.
  - Malformed retained chunk IDs marked incomplete.
  - Legacy lessons without chunks fall back to SQL `LessonProgress`.
  - `loadHomeForUser` loads cohorts, configs, and batch chunk progress without swallowing errors into 0% or using the stale process-local aggregate cache.
  - `src/app/(dashboard)/home/page.tsx` delegates to `loadHomeForUser`.
- **Files Changed**:
  - `src/server/domain/home/home.service.ts` (new)
  - `src/server/domain/home/__tests__/home.service.test.ts` (new)
  - `src/app/(dashboard)/home/page.tsx`
  - `src/client/screens/dashboard/home/models/home.ts`
- **Tests Executed**:
  - `src/server/domain/home/__tests__/home.service.test.ts` (11 tests passed)
- **Acceptance Criteria**: PASSED.

---

### Phase 3: FH-03 — Honor explicit chunk selection before ranking
- **Requirements Addressed**:
  - In `feedEngine.ts`, explicit `requestedChunkId` found before frontier/completion gating.
  - Added to candidates even if completed or non-frontier.
  - Removed revival fallback (`candidateChunks.length > 0 ? candidateChunks : allChunks`). Empty feed returned when nothing eligible.
  - Scored requested chunk structurally placed at position 0 in final interleaving.
- **Files Changed**:
  - `src/shared/feed/feedEngine.ts`
  - `src/shared/feed/__tests__/feedEngine.test.ts`
  - `src/app/api/feed/__tests__/route.integration.test.ts` (new)
- **Tests Executed**:
  - `src/shared/feed/__tests__/feedEngine.test.ts` (6 tests passed)
  - `src/app/api/feed/__tests__/route.integration.test.ts` (3 tests passed)
  - `src/app/api/feed/__tests__/route.test.ts` (20 tests passed)
- **Acceptance Criteria**: PASSED.

---

### Phase 4: FH-05 — Complete catalog scanning without 100-lesson blindspot
- **Requirements Addressed**:
  - Created `src/server/domain/feed/feedCatalog.ts`: scans lessons in cursor batches of 100 (`take: 100`, `orderBy: { id: 'asc' }`, cursor `{ id }`, `skip: 1`).
  - Preserves `accessibleCohortWhere(userId)` and publication filters on every batch.
  - Detects cursor loops / non-advancement.
  - Generates SHA-256 vector cache key from sorted chunk IDs.
  - Removed obsolete catalog cache from `route.ts`.
- **Files Changed**:
  - `src/server/domain/feed/feedCatalog.ts` (new)
  - `src/server/domain/feed/__tests__/feedCatalog.test.ts` (new)
  - `src/app/api/feed/route.ts`
- **Tests Executed**:
  - `src/server/domain/feed/__tests__/feedCatalog.test.ts` (6 tests passed)
- **Acceptance Criteria**: PASSED.

---

### Phase 5: FH-04 — Bounded exclusion continuation protocol
- **Requirements Addressed**:
  - `feedRequestSchema` and `FeedRequest` / `FeedResponse` types in `src/shared/feed/feedRequest.ts`.
  - Max 1 MiB body limit, max 5000 exclusion IDs.
  - GET `pageIndex > 0` returns 400 with `FEED_CONTINUATION_REQUIRED`.
  - POST executes exclusion filtering after frontier gating and returns `hasMore`.
  - Client `usePlayback.ts`:
    - Cache prefix bumped to `sidequest_feed_cache_v2:`.
    - Replaced `pageIndex` with `servedChunkIds: string[]`.
    - `prefetchDefaultFeed` uses POST with exclusion protocol.
    - `fetchChannelFeed` sends POST `/api/feed` with `excludeChunkIds` on continuation.
    - `completeActiveChunk` preserves `servedChunkIds`, clears `exhausted: false` on successful write, and triggers continuation when queue < 3 items.
    - Synchronized selection change cache invalidation.
- **Files Changed**:
  - `src/shared/feed/feedRequest.ts` (new)
  - `src/shared/feed/feedEngine.types.ts`
  - `src/shared/feed/feedEngine.ts`
  - `src/app/api/feed/route.ts`
  - `src/client/screens/dashboard/play/hooks/usePlayback.ts`
  - `src/app/api/feed/__tests__/route.pagination.test.ts`
  - `src/app/api/feed/__tests__/route.test.ts`
  - `src/client/screens/dashboard/play/hooks/__tests__/usePlayback.test.ts`
- **Tests Executed**:
  - `src/app/api/feed/__tests__/route.pagination.test.ts` (5 tests passed)
  - `src/app/api/feed/__tests__/route.test.ts` (20 tests passed)
  - `src/client/screens/dashboard/play/hooks/__tests__/usePlayback.test.ts` (23 tests passed)
  - Full TypeScript compilation: `npx tsc --noEmit` exited 0.
- **Acceptance Criteria**: PASSED.

---

### Phase 6: FH-06 — User-scoped canonical preferences, hydration, and reliable save lifecycle
- **Requirements Addressed**:
  - Defined pure `ChannelId`, `ChannelPreferences`, `StoredChannelConfig` in `src/shared/feed/channelPreferences.ts`.
  - Canonical user-scoped key: `sidequest_channel_config_v2:<userId-or-anon>`.
  - Storage adapter merges updates into existing `prefs` instead of overwriting, with legacy import for anon.
  - Save coordinator serializes saves with 500ms debounce, pending snapshot coalescing, and unmount flush via `fetch(..., { keepalive: true })`.
  - Added save status observer (`Saving...`, `Saved`, `Changes not saved` + `Retry`).
  - Added user cleanup on signout via `homeStorageAdapter.clearUserChoices(userId)`.
  - `/api/user/channel-config` route validates PUT with bounded count (max 50), 0..1 values, recognized enums with 400; generic error bodies.
  - Feed and Play read from canonical document via `homeStorageAdapter`.
  - `ChannelHub` pure state handlers and unmount flush.
- **Files Changed**:
  - `src/shared/feed/channelPreferences.ts` (new)
  - `src/client/repositories/homeStorageAdapter.ts`
  - `src/app/api/user/channel-config/route.ts`
  - `src/app/api/user/channel-config/__tests__/route.test.ts` (new)
  - `src/client/repositories/__tests__/homeStorageAdapter.test.ts` (new)
  - `src/client/screens/dashboard/home/components/ChannelHub/ChannelHub.tsx`
  - `src/client/screens/dashboard/home/components/ChannelHub/__tests__/ChannelHub.test.tsx` (new)
  - `src/client/repositories/feedRepository.ts`
  - `src/client/screens/dashboard/play/hooks/usePlayback.ts`
  - `src/client/components/global/Sidebar/ProfilePill.tsx`
- **Tests Executed**:
  - `src/app/api/user/channel-config/__tests__/route.test.ts` (10 tests passed)
  - `src/client/repositories/__tests__/homeStorageAdapter.test.ts` (6 tests passed)
  - `src/client/screens/dashboard/home/components/ChannelHub/__tests__/ChannelHub.test.tsx` (4 tests passed)
  - Full TypeScript compilation: `npx tsc --noEmit` exited 0.
- **Acceptance Criteria**: PASSED.

---

### Phase 7: FH-07 — Home mutation serialization & identity-safe rollback guard
- **Requirements Addressed**:
  - Implemented synchronous guard `mutationPendingRef` in `useHome.ts` to prevent race conditions during Home mutations.
  - Reject concurrent mutations in the same tick immediately with `'A change is still saving. Please wait.'`.
  - Consolidated `activeCohorts` and `continueLater` into atomic single state `cohortsState` to avoid impossible intermediate states.
  - Guarded prop hydration: server prop updates are ignored while a mutation is in flight; successful mutations trigger `router.refresh()`.
  - Guarded identity switching: user generation tracking prevents stale requests from writing old choices under a newly switched or logged-out account.
  - Added `disabled` prop to `SubscribedCohortCard` and passed `mutationPending` through `ActiveCohorts` from `useHome.isSyncing`.
  - Accessible status (`role="status"`, `Saving changes…`) displayed when mutation is pending while preserving card navigation link usability.
- **Files Changed**:
  - `src/client/screens/dashboard/home/hooks/useHome.ts`
  - `src/client/screens/dashboard/home/components/ActiveCohorts/ActiveCohorts.tsx`
  - `src/client/screens/dashboard/home/components/ActiveCohorts/SubscribedCohortCard.tsx`
  - `src/client/screens/dashboard/home/HomeDesktop.tsx`
  - `src/client/screens/dashboard/home/hooks/__tests__/useHome.test.ts`
  - `src/client/screens/dashboard/home/components/ActiveCohorts/__tests__/SubscribedCohortCard.test.tsx`
- **Tests Executed**:
  - `src/client/screens/dashboard/home/hooks/__tests__/useHome.test.ts` (13 tests passed)
  - `src/client/screens/dashboard/home/components/ActiveCohorts/__tests__/SubscribedCohortCard.test.tsx` (7 tests passed)
  - Full TypeScript compilation: `npx tsc --noEmit` exited 0.
- **Acceptance Criteria**: PASSED.

---

### Phase 8: FH-08 — Atomic durable rank/pause ordering & cache corrections
- **Requirements Addressed**:
  - Implemented `src/server/domain/home/cohortOrder.service.ts`:
    - Pure `normalizeCohortId`: strips exact `${userId}_` prefix without stripping valid IDs with underscores.
    - `getUserAuthorizedCohortIds`: queries Postgres for enrolled and created cohorts.
    - Pure `computeStateChangeOrdering`: calculates deterministic active/paused ordering and contiguous 1-based ranks (active 1..N, paused N+1..N+M), immediately treats expired pauses as active.
    - `executeCohortStateChange`: executes in Mongo session transaction, bulkWrites ranks and pause fields, invalidates cache upon commit.
  - Extended `/api/user/cohort-config` route:
    - Added discriminated `operation: 'pause' | 'resume'` handling.
    - Batch reorder: enforces max 200, checks uniqueness, finite ranks, authorized visible IDs, returns `count: 0` without write on empty, avoids double-counting matches, invalidates cache.
    - Preserves single settings update compatibility with cache invalidation.
  - Updated Feed and Home:
    - Feed: uses `normalizeCohortId` and validated positive rank fallback: `cfg.rank > 0 ? cfg.rank : (idx + 1)`.
    - Home: uses `normalizeCohortId`, sorts both active and continueLater deterministically.
- **Files Changed**:
  - `src/server/domain/home/cohortOrder.service.ts` (new)
  - `src/server/domain/home/__tests__/cohortOrder.service.test.ts` (new)
  - `src/app/api/user/cohort-config/route.ts`
  - `src/app/api/user/cohort-config/route.test.ts`
  - `src/app/api/feed/route.ts`
  - `src/server/domain/home/home.service.ts`
  - `src/server/database/mongo/models/UserCohortConfig.ts`
  - `src/client/screens/dashboard/home/hooks/useHome.ts`
  - `src/client/screens/dashboard/home/hooks/__tests__/useHome.test.ts`
- **Tests Executed**:
  - `src/app/api/user/cohort-config/route.test.ts` (8 tests passed)
  - `src/server/domain/home/__tests__/cohortOrder.service.test.ts` (4 tests passed)
  - All 9 Home/Feed test suites (77 tests passed)
  - Full TypeScript compilation: `npx tsc --noEmit` exited 0.
- **Acceptance Criteria**: PASSED.

---

### Phase 9: FH-09 — Separation of loading, empty, error, and optional enrichment
- **Requirements Addressed**:
  - Replaced `<Home />` loading fallback with presentational `HomeLoading.tsx` with `role="status"` and layout skeleton placeholders without invoking `useHome` or persisting to storage.
  - Removed `DEFAULT_COHORTS` and fabricated progress from `homeRepository.ts`. Missing data returns empty arrays `[]`.
  - Added `src/app/(dashboard)/home/error.tsx` boundary with generic error message and working retry trigger (does not expose raw DB errors).
  - Removed `process.env.NODE_ENV === 'test'` bypass from `src/app/(dashboard)/home/page.tsx`.
  - In `/api/feed`:
    - Split required personalized reads (user progress, user cohort configs, user channel prefs) from optional vector enrichment. Any failure in required reads returns HTTP 503 `Cache-Control: no-store`.
    - Optional vector enrichment failure logs once and falls back gracefully to deterministic delivery vectors without failing the feed.
    - Separated `hiddenCohortIds` and `pausedCohortIds`. General feed excludes both; explicit chunk revisit replays the requested chunk.
- **Files Changed**:
  - `src/client/screens/dashboard/home/HomeLoading.tsx` (new)
  - `src/app/(dashboard)/home/loading.tsx`
  - `src/app/(dashboard)/home/page.tsx`
  - `src/app/(dashboard)/home/error.tsx` (new)
  - `src/client/repositories/homeRepository.ts`
  - `src/app/api/feed/route.ts`
  - `src/app/(dashboard)/home/__tests__/homeLoading.test.tsx`
  - `src/app/api/feed/__tests__/route.test.ts`
- **Tests Executed**:
  - `src/app/(dashboard)/home/__tests__/homeLoading.test.tsx` (4 tests passed)
  - `src/app/api/feed/__tests__/route.test.ts` (23 tests passed)
  - Full TypeScript compilation: `npx tsc --noEmit` exited 0.
- **Acceptance Criteria**: PASSED.

---

### Phase 10: FH-10 — Mobile Home feature parity
- **Requirements Addressed**:
  - Maintained mobile layout and search, integrated pure `getSubscribedCohorts` helper to display combined active-first and paused-last subscriptions matching desktop.
  - Reused `ActiveCohorts`, `SubscribedCohortCard`, and `useHome` actions (pause, resume, save learning settings, remove) rather than duplicating persistence logic.
  - Paused cards display Resume and pause options with accessible interactions.
  - Mounted `ChannelHub` in mobile view.
  - Added accessible `aria-label="Search cohorts"` to search input; filtering applies across active and paused cohorts, displaying `No matching cohorts found.` distinct from empty subscription state.
  - Routed links via `getCohortHref`.
  - Added `RecentlyCompleted` with accordion toggle when completed items exist.
  - Forwarded `mutationPending` to disable card actions during sync.
  - Displayed `syncError` via role="alert" error alert.
- **Files Changed**:
  - `src/client/mobile/screens/Home/HomeMobile.tsx`
  - `src/client/mobile/screens/Home/HomeMobile.module.css`
  - `src/client/mobile/screens/Home/__tests__/HomeMobile.test.tsx` (new)
  - `src/client/screens/dashboard/home/utils/cohortManagement.ts`
  - `src/client/screens/dashboard/home/utils/index.ts`
  - `src/client/screens/dashboard/home/HomeDesktop.tsx`
- **Tests Executed**:
  - `src/client/mobile/screens/Home/__tests__/HomeMobile.test.tsx` (8 tests passed)
  - Full TypeScript compilation: `npx tsc --noEmit` exited 0.
- **Acceptance Criteria**: PASSED.

---

### Phase 11: FH-11 — Make schedule scoring use the learner's local day
- **Requirements Addressed**:
  - `usePlayback.ts` sets `timezoneOffset` to `new Date().getTimezoneOffset()` on every request (not cached indefinitely across DST).
  - Offset validated `-840..840` in GET and POST requests.
  - Eliminated double timezone shift: in `/api/feed/route.ts`, `realNow` is passed as `currentTime` so elapsed recency calculations (`now - lastActiveAt`) are exact wall-clock durations without timezone distortion.
  - Derived `localDayOfWeek` and `localHour` from shifted Date (`Date.now() - timezoneOffset * 60_000`) using UTC getters (`getUTCDay()`, `getUTCHours()`).
  - Added optional `localDayOfWeek` and `localHour` to `FeedEngineInput` and `calculateChunkScore`; added `localHour` to `ChunkScoringContext` and `getTimeOfDaySlot`.
  - Fallback semantics preserved for callers/tests that omit explicit local primitives.
  - Pause-until timestamps remain ISO instants and are not shifted again.
- **Files Changed**:
  - `src/shared/feed/feedEngine.types.ts`
  - `src/shared/curriculum/pedagogicalVector.types.ts`
  - `src/shared/curriculum/pedagogicalVector.engine.ts`
  - `src/shared/feed/feedScoring.ts`
  - `src/shared/feed/feedEngine.ts`
  - `src/app/api/feed/route.ts`
  - `src/shared/feed/__tests__/feedScoring.timezone.test.ts` (new)
  - `src/app/api/feed/__tests__/route.test.ts`
  - `src/app/api/feed/__tests__/route.integration.test.ts`
- **Tests Executed**:
  - `src/shared/feed/__tests__/feedScoring.timezone.test.ts` (4 tests passed)
  - `src/shared/feed/__tests__/feedEngine.test.ts` (6 tests passed)
  - `src/shared/curriculum/__tests__/pedagogicalVector.test.ts` (4 tests passed)
  - `src/app/api/feed/__tests__/route.test.ts` (23 tests passed)
  - `src/app/api/feed/__tests__/route.pagination.test.ts` (5 tests passed)
  - `src/app/api/feed/__tests__/route.integration.test.ts` (3 tests passed)
  - Full TypeScript compilation: `npx tsc --noEmit` exited 0.
- **Acceptance Criteria**: PASSED.

---

### Phase 12: FH-12 — Replace misleading supporting UI with truthful behavior
- **Requirements Addressed**:
  - `HomeStreakWidget.tsx`:
    - Removed hardcoded default `todayMinutes=18`, `streakDays=12`, and mock completed-week activity.
    - Activity data is optional. When absent, renders neutral learning encouragement and text `Activity statistics are not available yet`; omits chart, numerical streak, and progress ratio.
    - Removed `12 days strong!` from encouragements.
    - Zero values correctly validated with `??` (`safeTodayMinutes = todayMinutes ?? 0`, `safeStreakDays = streakDays ?? 0`).
  - `HomeStudyRooms.tsx`:
    - Created dedicated, truthful `HomeStudyRooms.tsx` fetching `/api/studyroom?format=v2&tab=discover&limit=4`.
    - Removed `messageMock` import from `HomeDesktop.tsx`.
    - Real room slugs link to `/studyroom/<slug>`. Truthful `onlineCount` displayed; no fake participants or arbitrary multipliers.
    - Empty state renders `No studyrooms available` with `Browse studyrooms` link to `/studyroom`.
    - Error state renders `Could not load studyrooms.` with working `Retry` button.
    - Section labeled honestly as `Studyrooms` rather than `Active studyrooms`.
  - `UpcomingEvents.tsx`:
    - Initialized `activeDate`, `selectedDay`, and `currentDay` from local `now`, eliminating hardcoded August 6, 2026.
    - Local midnight timer dynamically advances currentDay without forcing user back if they browsed to another month; re-syncs on `visibilitychange`.
    - Removed dead `INITIAL_EVENTS` fixture.
    - Default provider is `Sidequest Native` (visible as `Undone tasks`). Third-party integrations (Google, Outlook, Apple) are disabled with `Coming later` badges and do not imply connection.
    - Replaced hardcoded `Thu, Aug 6, 2026` in `formattedSelectedDate` with dynamic local date string.
  - `ChannelHub.tsx`:
    - Rendered unconsumed daily preferences (weekly goal, learning allocation, reminder window) disabled with concise `Coming later` badge.
    - Working channel sliders remain enabled and functional.
- **Files Changed**:
  - `src/client/screens/dashboard/home/components/HomeStreakWidget/HomeStreakWidget.tsx`
  - `src/client/screens/dashboard/home/components/HomeStreakWidget/HomeStreakWidget.module.css`
  - `src/client/screens/dashboard/home/components/HomeStreakWidget/__tests__/HomeStreakWidget.test.tsx` (new)
  - `src/client/screens/dashboard/home/components/HomeStudyRooms/HomeStudyRooms.tsx` (new)
  - `src/client/screens/dashboard/home/components/HomeStudyRooms/HomeStudyRooms.module.css` (new)
  - `src/client/screens/dashboard/home/components/HomeStudyRooms/index.ts` (new)
  - `src/client/screens/dashboard/home/components/HomeStudyRooms/__tests__/HomeStudyRooms.test.tsx` (new)
  - `src/client/screens/dashboard/home/HomeDesktop.tsx`
  - `src/client/components/global/UpcomingEvents/UpcomingEvents.tsx`
  - `src/client/components/global/UpcomingEvents/UpcomingEvents.module.css`
  - `src/client/components/global/UpcomingEvents/__tests__/UpcomingEvents.test.tsx` (new)
  - `src/client/screens/dashboard/home/components/ChannelHub/ChannelHub.tsx`
  - `src/client/screens/dashboard/home/components/ChannelHub/ChannelHub.module.css`
  - `src/client/screens/dashboard/home/components/ChannelHub/__tests__/ChannelHub.test.tsx`
- **Tests Executed**:
  - `src/client/screens/dashboard/home/components/HomeStreakWidget/__tests__/HomeStreakWidget.test.tsx` (3 tests passed)
  - `src/client/screens/dashboard/home/components/HomeStudyRooms/__tests__/HomeStudyRooms.test.tsx` (4 tests passed)
  - `src/client/components/global/UpcomingEvents/__tests__/UpcomingEvents.test.tsx` (3 tests passed)
  - `src/client/screens/dashboard/home/components/ChannelHub/__tests__/ChannelHub.test.tsx` (4 tests passed)
  - Full Home suite: 9 test files, 49 tests passed.
  - Full TypeScript compilation: `npx tsc --noEmit` exited 0.
- **Acceptance Criteria**: PASSED.

---

### Phase 13: FH-13 — Proven dead code removal and consolidation
- **Requirements Addressed**:
  - Deleted obsolete modules and dead folders verified to have zero live usages or external imports:
    - `src/client/repositories/feedRepository.ts`
    - `src/client/screens/dashboard/home/components/ActiveCohortRow/`
    - `src/client/screens/dashboard/home/components/ActiveCohorts/InspectorPanel.tsx` & `.module.css`
    - `src/client/screens/dashboard/home/components/HomeSummaryBar/`
    - `src/client/screens/dashboard/home/components/ContinueLater/` & `ContinueLaterCard/`
  - Cleaned `HomeHeroProps` in `HomeHero.tsx` down to active props (`userName?: string;`).
  - Removed unused legacy mutators from `useHome.ts`: `moveCohort`, `saveDailyGoal`, `saveSchedule`, `saveOrderStyle`, `saveFrequency`.
  - Consolidated channel preferences and key schema in `src/shared/feed/channelPreferences.ts`.
  - Consolidated subscribed-cohort ordering helper in `getSubscribedCohorts` for desktop and mobile parity.
  - Consolidated feed request schema and validation in `src/shared/feed/feedRequest.ts`.
  - Consolidated cohort ID normalization in `src/server/domain/home/cohortOrder.service.ts` `normalizeCohortId`.
  - Removed constant `previousCohortId = null` from `src/shared/feed/feedEngine.ts` and deleted redundant `variety` heuristic scoring from `src/shared/feed/feedScoring.ts`, re-normalizing weights to sum to 1.00.
  - Updated all caller tests in `src/shared/feed/__tests__/feedScoring.timezone.test.ts`.
  - Verified zero dead imports/callers via git grep.
- **Files Changed**:
  - `src/client/repositories/feedRepository.ts` (deleted)
  - `src/client/screens/dashboard/home/components/ActiveCohortRow/` (deleted)
  - `src/client/screens/dashboard/home/components/ActiveCohorts/InspectorPanel.tsx` (deleted)
  - `src/client/screens/dashboard/home/components/ActiveCohorts/InspectorPanel.module.css` (deleted)
  - `src/client/screens/dashboard/home/components/HomeSummaryBar/` (deleted)
  - `src/client/screens/dashboard/home/components/ContinueLater/` (deleted)
  - `src/client/screens/dashboard/home/components/ContinueLaterCard/` (deleted)
  - `src/client/screens/dashboard/home/components/HomeHero/HomeHero.tsx`
  - `src/client/screens/dashboard/home/hooks/useHome.ts`
  - `src/shared/feed/feedScoring.ts`
  - `src/shared/feed/feedEngine.ts`
  - `src/shared/feed/__tests__/feedScoring.timezone.test.ts`
- **Tests Executed**:
  - `src/shared/feed/__tests__/feedScoring.timezone.test.ts` (4 tests passed)
  - `src/shared/feed/__tests__/feedEngine.test.ts` (6 tests passed)
  - Full TypeScript compilation: `npx tsc --noEmit` exited 0.
- **Acceptance Criteria**: PASSED.

---

### Phase 14: FH-14 — Verification, test repair, manual acceptance matrix, and MEMORY updates
- **Requirements Addressed**:
  - Full automated regression test suite executed across all touched domains:
    - Suite 1 (Feed, Progress, Playback, Home, Mobile, User API, Channel Config): 22 files, 177 tests passed.
    - Suite 2 (Home Domain, Feed Catalog, Delivery Feed): 4 files, 29 tests passed.
    - Suite 3 (Upcoming Events, Home Storage Adapter, Pedagogical Vector): 3 files, 13 tests passed.
    - Total: 29 test files, 219 tests executed, 219 passed, 0 failures.
  - Full TypeScript compilation: `npx tsc --noEmit --incremental false` exited 0 with zero errors.
  - Scoped ESLint verification across touched modules and domain files exited 0 with clean output and no warnings/errors.
  - Production build: `npm run build` completed successfully, compiling all 50 static pages and dynamic Next.js routes.
  - Operational memory documentation updated in `MEMORY/`:
    - `MEMORY/home-dashboard.md`: Canonical Mongo chunk progress projection, presentational loading shell, mutation guard, durable session order transactions, mobile parity, truthful widgets.
    - `MEMORY/cache-boundaries.md`: Removed obsolete Home/catalog caching claims; documented required-vs-optional Feed reads, POST `Cache-Control: no-store`, exclusion continuation, SHA-256 vector cache key.
    - `MEMORY/play-playback.md`: Bounded POST exclusion continuation protocol, exact selection priority at index 0, completion persistence verification, `sidequest_feed_cache_v2:` cache key.
  - Manual Acceptance Matrix reviewed and verified 17/17 scenarios passed.
  - Done checklist in `PLAN.md` fully marked complete (FH-01 through FH-14).
- **Files Changed**:
  - `MEMORY/home-dashboard.md`
  - `MEMORY/cache-boundaries.md`
  - `MEMORY/play-playback.md`
  - `PLAN.md`
  - `IMPLEMENTATION_PROGRESS.md`
- **Verification Commands Executed & Results**:
  - `npx vitest run ...`: 219 passed, 0 failed.
  - `npx tsc --noEmit --incremental false`: Exit code 0.
  - `npx eslint ...`: Exit code 0.
  - `npm run build`: Exit code 0.
- **Acceptance Criteria**: PASSED.
