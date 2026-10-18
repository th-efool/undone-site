# Implementation Plan - Across Session (State Continuity & Storage) Assurance

## 1. Overview
The goal of this task is to ensure robust, comprehensive cross-session state continuity and persistence for the dashboard.
Specifically:
1. **ChannelHub user choices**:
   - Depth, rigor, scaffolding (pedagogical sliders)
   - Weekly goal, learning allocation, reminder window (daily preferences)
   - Selected channel
   - isExpanded
   Must persist with typed helpers, safe fallbacks, and unified namespacing in `homeStorageAdapter.ts`.
2. **HomeDesktop section states**:
   - `isPausedOpen`
   - `isCompletedOpen`
   - `searchQuery`
   Must persist in localStorage and restore seamlessly across page reloads.
3. **LearningPromptBar state**:
   - Prompt query and pasted source text must survive accidental navigation, page reloads, and auth redirects via both `sessionStorage` and `localStorage` fallbacks.
4. **URL Query Param Synchronization**:
   - Support deep linking to channels via `?channel=deep_dive` (or any channel) and search queries via `?q=...`.
   - Two-way synchronization: deep links hydrate state on mount, user interactions update URL without full-page reloads using `replaceState`, and `popstate` restores state on back/forward navigation.

---

## 2. File-by-File Changes

### A. `src/client/repositories/homeStorageAdapter.ts`
- Add unified interfaces and constants for:
  - `ChannelPreferences` (depth, rigor, scaffolding, weeklyGoal, learningAllocation, reminderWindow)
  - `ChannelId`
  - Keys with prefix `sidequest_` for all dashboard states:
    - `sidequest_active_channel`
    - `sidequest_channel_prefs`
    - `sidequest_pref_depth`, `sidequest_pref_rigor`, `sidequest_pref_scaffolding`
    - `sidequest_pref_weekly_goal`, `sidequest_pref_learning_allocation`, `sidequest_pref_reminder_window`
    - `sidequest_finetune_expanded`
    - `sidequest_paused_open`
    - `sidequest_completed_open`
    - `sidequest_home_search_query`
- Add storage helper methods:
  - `getChannelPreferences()`, `saveChannelPreferences()`
  - `getSelectedChannel()`, `saveSelectedChannel()`
  - `getChannelHubExpanded()`, `saveChannelHubExpanded()`
  - `getStoredPausedOpen()`, `savePausedOpen()`
  - `getStoredCompletedOpen()`, `saveCompletedOpen()`
  - `getStoredSearchQuery()`, `saveSearchQuery()`
  - Guard all storage access with safe try/catch blocks and mobile Capacitor Preferences fallback where applicable.

### B. `src/client/screens/dashboard/home/components/ChannelHub/ChannelHub.tsx`
- Refactor state initialization to use `homeStorageAdapter`.
- Add URL query param synchronization for `?channel=...`:
  - On mount, check if `?channel=...` is in `window.location.search`. If valid, prioritize it and sync.
  - When user selects channel, update `selectedChannel`, save via `homeStorageAdapter`, and update URL query param via `window.history.replaceState`.
  - Add `popstate` event listener to react to back/forward browser navigation.
- Ensure all sliders (`depth`, `rigor`, `scaffolding`), preferences (`weeklyGoal`, `learningAllocation`, `reminderWindow`), and `isExpanded` persist and restore cleanly.

### C. `src/client/screens/dashboard/home/HomeDesktop.tsx`
- Initialize `isCompletedOpen` from `homeStorageAdapter.getStoredCompletedOpen()`.
- Persist `isCompletedOpen` when toggled.
- Initialize `searchQuery` (`query`) from URL param `?q=...` first, then fallback to `homeStorageAdapter.getStoredSearchQuery()`.
- Persist `searchQuery` when changed, and synchronize with URL param `?q=...` via `window.history.replaceState`.
- Add `popstate` event listener for URL search query changes.
- Add SearchBar UI component with clear button, filter display, and debounce so users can intuitively search, clear, and filter their cohorts.

### D. `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx`
- Add draft auto-persistence for `query`, `sourceText`, and `showSource`:
  - Save to `sessionStorage` and `localStorage` on change (`sidequest_prompt_query_draft`, `sidequest_prompt_source_draft`, `sidequest_prompt_source_visible`).
  - On mount, restore `query` from URL `?q=...`, then session/local storage, then intake draft.
  - On mount, restore `sourceText` and `showSource` from session/local storage, then intake draft.
  - Add `beforeunload` listener to ensure in-flight keystrokes are flushed.
  - On unauthenticated submit redirecting to `/auth?returnTo=...`, ensure both `query` and `sourceText` are safely committed to persistent storage.
  - On successful intake creation/redirect, clean up temporary drafts.

### E. `src/client/repositories/homeRepository.ts` & `src/client/screens/dashboard/home/hooks/useHome.ts`
- Ensure stored choices fallback properly handles custom user cohorts that may not be in default seeds.
- Preserve user's local reordering and paused statuses across sessions.

---

## 3. Verification & Testing
- Write a dedicated automated test suite using `npx tsx` verifying:
  - All storage operations in `homeStorageAdapter` (save, load, invalid JSON, corrupted data, default fallbacks).
  - ChannelHub preference serialization, restoration, and validation.
  - Deep linking query param parsing and serialization.
  - LearningPromptBar draft preservation across simulated reloads and navigation.
