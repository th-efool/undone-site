# Quality Assessment Report: Error Notifications, Diagnostics & Website-Wide Failure Feedback

**Date**: 2026-11-01
**Auditor**: Antigravity (IdiotCheckInQualityAssessment Protocol)
**Git Baseline**: Commit `cf30f62580d44c65fde2c28fabbe7226420b78ea` (`master`, up to date with `origin/master`)
**Scope**: All changes and integrations delivered under Guide G1 (`IdiotHandOffGuide-error-notifications-diagnostics.md`) and Guide G2 (`IditotHandOffGuideNotificationWebsiteWide.md`).

---

## 1. Verdict and Assessed Scope

### Overall Verdict: **CONDITIONAL ACCEPTANCE WITH REMEDIATIONS REQUIRED**

The core architectural objectives across both implementation guides have been successfully established:
1. **Infrastructure Delivered**: The root-mounted notification system (`ToastProvider`), failure hook (`useFailureToast`), event bus (`site-failures.ts`), and TanStack Query error bridge (`SiteFailureBridge.tsx`) are mounted and functional.
2. **Surface Coverage**: 8 major product surfaces (Home, Play/Feed, StudyRoom, Personal Workspace/Notes, Messaging, Auth, Cohort Join, and Creation Workspace) have migrated away from disruptive inline error alert banners while preserving form drafts, local outbox commits, and cached data.
3. **Build & Test Posture**: The regression suite of **135 test files and 1,045 tests passes with 100% success**, full Next.js production build (`npm run build`) succeeded across 50 pages, and the Vercel deployment pre-verification pipeline (`npm run verify:vercel`) passed cleanly.

However, an in-depth audit of real caller paths, state transitions, and ESLint compiler diagnostics reveals **1 High Severity functional defect** in Direct Messaging deletion, along with **3 Medium/Low Severity code hygiene and UX issues** that must be addressed.

### Scope Inventory

| Area | Authoritative Files |
|---|---|
| **Core Toast & Feedback** | `src/client/components/global/Toast/ToastProvider.tsx`<br>`src/client/components/global/Toast/Toast.tsx`<br>`src/client/components/global/Toast/Toast.module.css`<br>`src/client/hooks/useFailureToast.ts`<br>`src/client/feedback/site-failures.ts`<br>`src/client/feedback/SiteFailureBridge.tsx`<br>`src/client/providers/ReactQueryProvider.tsx`<br>`src/client/react-query/query-client.ts` |
| **Diagnostics & Logger** | `src/app/api/cohort-builder/workspaces/[workspaceId]/diagnostics/route.ts`<br>`src/client/providers/DevLoggerInit.tsx`<br>`src/client/providers/Diagnostics.module.css`<br>`src/shared/lib/dev-logger.ts` |
| **Creation Workflows** | `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx`<br>`src/client/screens/cohortBuilder/ChatPane.tsx`<br>`src/client/screens/cohortBuilder/CohortIntakeScreen.tsx`<br>`src/client/screens/cohortBuilder/components/ReleasePanel.tsx` |
| **Media & Live Surfaces** | `src/client/screens/dashboard/home/hooks/useHome.ts`<br>`src/client/screens/dashboard/home/HomeDesktop.tsx`<br>`src/client/mobile/screens/Home/HomeMobile.tsx`<br>`src/client/screens/dashboard/play/hooks/usePlayback.ts`<br>`src/client/screens/dashboard/play/PlayDesktop.tsx`<br>`src/client/mobile/screens/Play/PlayMobile.tsx`<br>`src/client/screens/dashboard/studyroom/room/components/SharedSprintWidget.tsx`<br>`src/client/screens/dashboard/studyroom/components/RoomSettingsModal.tsx`<br>`src/client/screens/dashboard/studyroom/StudyRoomScreen.tsx` |
| **Workspace, Messaging & Auth** | `src/client/personal-workspace/hooks/useLocalWorkspace.ts`<br>`src/client/personal-workspace/ui/connect-github-modal.tsx`<br>`src/client/screens/dashboard/notes/hooks/useNotes.ts`<br>`src/client/screens/dashboard/message/hooks/useMessage.ts`<br>`src/client/screens/auth/authForm/authForm.tsx`<br>`src/client/screens/cohort/components/JoinCohortButton.tsx` |

---

## 2. Requirement and Component Coverage

### Requirement Disposition Matrix

| Req ID | Requirement Summary | Component / Route | Review Type | Result | Evidence / Finding ID |
|---|---|---|---|---|---|
| **G1-REQ-01** | Root `ToastProvider` mounted in `layout.tsx` | `src/app/layout.tsx` | Source, DOM | **Verified** | `ToastProvider` wraps main body & QueryClientProvider |
| **G1-REQ-02** | `useFailureToast` hook for declarative error toasts | `useFailureToast.ts` | Tests, Source | **Verified** | 3 unit tests passed in `ToastProvider.test.tsx` |
| **G1-REQ-03** | Server diagnostics route for workspace runs | `/api/.../diagnostics` | Route, Tests | **Verified** | Owner validation, Zod UUID, raw SQL query tested |
| **G1-REQ-04** | Client DevLogger drawer (?debug=1) | `DevLoggerInit.tsx` | Source, CSS | **Verified** | Query param trigger, level switch, run inspector |
| **G1-REQ-05** | Creation flows migrated to toasts | `LearningPromptBar`, `ChatPane`, `ReleasePanel` | Tests, Source | **Verified** | Form state kept on send/release failure |
| **G2-REQ-01** | Site failure bus with cooldown & telemetry | `site-failures.ts` | Vitest, Source | **Verified** | 8000ms cooldown, queue buffer, dev-logger events |
| **G2-REQ-02** | TanStack Query error bridge | `SiteFailureBridge.tsx`, `query-client.ts` | Vitest, Source | **Verified** | Global QueryCache/MutationCache calls bridge |
| **G2-REQ-03** | Home pull-to-refresh & mutation feedback | `useHome.ts`, `HomeDesktop`, `HomeMobile` | Vitest, Source | **Verified** | Cached feed preserved on reload error |
| **G2-REQ-04** | Play/Feed non-blocking error handling | `usePlayback.ts`, `PlayDesktop`, `PlayMobile` | Vitest, Source | **Verified** | Playback retained, retry button accessible |
| **G2-REQ-05** | StudyRoom sprint & settings toasts | `SharedSprintWidget`, `RoomSettingsModal` | Vitest, Source | **Verified** | Active sprint state maintained during failure |
| **G2-REQ-06** | Notes local-first outbox durability | `useLocalWorkspace.ts`, `connect-github-modal` | Vitest, Source | **Verified** | Local commits retained when remote push fails |
| **G2-REQ-07** | Messaging pessimistic DM deletion | `useMessage.ts` | Source audit | **Finding** | **FINDING-MSG-01**: `channelId` passed as `messageId` |
| **G2-REQ-08** | Auth & Cohort Join failure recovery | `authForm.tsx`, `JoinCohortButton.tsx` | Vitest, Source | **Verified** | Form preserved, no false joined status |

### Accounting for the Six Finding Categories

- **Category A (Pending or half-finished implementation)**: Evaluated. None found. All guide instructions, imports, routes, and hooks are fully connected.
- **Category B (Symptom-only fixes and unresolved root causes)**: Evaluated. Pessimistic deletion was implemented to avoid optimistic ghost deletion, but uncovered a parameter inversion bug in the underlying call (`FINDING-MSG-01`).
- **Category C (Existing defects, breakage, and regressions)**: Evaluated. Found 1 functional regression in DM deletion (`FINDING-MSG-01`).
- **Category D (Quality-standard gaps)**: Evaluated. Found 3 issues: React ref mutation during render (`FINDING-LINT-01`), `setState` in effect for portal hydration (`FINDING-TOAST-01`), and unlabelled desktop retry button (`FINDING-PLAY-01`).
- **Category E (Dead code and unused artifacts)**: Evaluated. Unused imports in `StudyRoomScreen.tsx` and legacy error divs were cleanly pruned during Phase 2.
- **Category F (Duplication and overengineering)**: Evaluated. Centralization of failure text in `failureMessages` prevented duplication across 10+ surface files.

---

## 3. Prioritized Findings

### High Severity

#### `FINDING-MSG-01` — `deleteDMMessage` passes `channelId` instead of `messageId` to `messagesRepository.deleteMessage`
- **Category**: Category C (Existing defect / Functional breakage)
- **Severity**: **High**
- **Affected Requirement**: G2-REQ-07 (Messaging DM Deletion)
- **Source Location**: [src/client/screens/dashboard/message/hooks/useMessage.ts:1268-1278](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/dashboard/message/hooks/useMessage.ts#L1268-L1278)
- **Preconditions**: User has an active Direct Message conversation and triggers "Delete Message".
- **Observed Code**:
  ```ts
  const deleteDMMessage = useCallback(
    (dmId: string, messageId: string) => {
      const channelId = conversationsList.find(conversation => conversation.id === dmId)?.channelId;
      if (!channelId) return;
      const owner = currentUserId;
      void messagesRepository.deleteMessage(channelId, messageId).then(() => {
        if (actionAccount.current !== owner) return;
        setMessagesByChannel(previous => ({ ...previous, [channelId]: (previous[channelId] ?? []).filter(message => message.id !== messageId) }));
      }).catch(() => reportSiteFailure('message'));
    },
    [conversationsList, currentUserId]
  );
  ```
- **Root Cause**:
  `messagesRepository.deleteMessage` has the signature:
  `async deleteMessage(messageId: string, reason?: string): Promise<CanonicalMessagePayload>`
  which calls `fetch(apiUrl('/api/messages/' + messageId), { method: 'DELETE', body: JSON.stringify({ reason }) })`.
  Passing `(channelId, messageId)` results in `DELETE /api/messages/${channelId}` with `{ reason: messageId }`.
- **Expected vs Actual**:
  - *Expected*: `messagesRepository.deleteMessage(messageId)` sends the message ID to the route `/api/messages/[messageId]`.
  - *Actual*: The channel ID is sent as the route param, causing the server to return 404 or fail to find the message. Deletion always fails and reports `reportSiteFailure('message')`.
- **Attribution**: Pre-existing in legacy code, propagated during G2 pessimistic refactor.
- **Remediation**:
  Change line 1272 to:
  ```ts
  void messagesRepository.deleteMessage(messageId).then(() => {
  ```

---

### Medium Severity

#### `FINDING-LINT-01` — `useMessage` updates `actionAccount` ref during render phase and violates hook naming rules
- **Category**: Category D (Quality-standard gap / React Compiler rule violation)
- **Severity**: **Medium**
- **Affected Requirement**: React Hooks rules & React Compiler safety
- **Source Location**: [src/client/screens/dashboard/message/hooks/useMessage.ts:35, 43, 79](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/dashboard/message/hooks/useMessage.ts#L35)
- **Trigger**: Any render of `useMessage()`.
- **Observed Code**:
  ```ts
  // Line 78-79
  const actionAccount = useRef(currentUserId);
  actionAccount.current = currentUserId; // <-- Mutating ref during render
  ```
  ```ts
  // Line 35, 43
  function safeUseSession() { return useSession(); } // <-- Hook name doesn't start with "use"
  function safeUseRealtime() { return useRealtime(); }
  ```
- **Root Cause**: Direct assignment to `ref.current` inside the render function body is flagged by ESLint rule `react-compiler` / `react-hooks/rules-of-hooks` because concurrent mode renders may discard or re-execute render passes.
- **Expected vs Actual**:
  - *Expected*: Ref updates are performed inside `useEffect` or callbacks; hooks start with `use`.
  - *Actual*: ESLint errors `Error: Cannot access refs during render` and `React Hook is called in function safeUseSession that is neither a React function component nor a custom React Hook`.
- **Attribution**: `safeUse...` pre-existing; `actionAccount.current` introduced in G2.
- **Remediation**:
  1. Rename `safeUseSession` to `useSafeSession` and `safeUseRealtime` to `useSafeRealtime`.
  2. Move ref assignment to `useEffect(() => { actionAccount.current = currentUserId; }, [currentUserId]);`.

---

### Low Severity

#### `FINDING-TOAST-01` — `ToastProvider` performs synchronous `setState` in mount effect
- **Category**: Category D (Quality-standard gap / ESLint rule violation)
- **Severity**: **Low**
- **Affected Requirement**: React Hooks performance conventions
- **Source Location**: [src/client/components/global/Toast/ToastProvider.tsx:12](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/components/global/Toast/ToastProvider.tsx#L12)
- **Observed Code**:
  ```ts
  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  useEffect(() => setMounted(true), []);
  ```
- **Root Cause**: Standard SSR hydration portal check triggers ESLint warning `react-hooks/set-state-in-effect`.
- **Impact**: Harmless in production (deliberate SSR hydration barrier for `document.body` portal), but causes ESLint run failure.
- **Remediation**:
  Add `// eslint-disable-next-line react-hooks/set-state-in-effect` or implement with `useSyncExternalStore`.

#### `FINDING-PLAY-01` — Floating completion retry pill in `PlayDesktop` lacks descriptive label
- **Category**: Category D (Quality-standard gap / Accessibility)
- **Severity**: **Low**
- **Affected Requirement**: Accessible interactive elements & non-blocking recovery UX
- **Source Location**: [src/client/screens/dashboard/play/PlayDesktop.tsx:156-178](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/dashboard/play/PlayDesktop.tsx#L156-L178)
- **Observed Code**:
  ```tsx
  {playback.completionError && (
    <div className={styles.feedbackToast}>
      <button
        type="button"
        onClick={() => void playback.completeActiveChunk()}
        ...
      >
        Retry
      </button>
    </div>
  )}
  ```
- **Impact**: While `useFailureToast` fires the top-right notification text, this secondary floating pill appears at the bottom with only the word "Retry" and no label indicating what is being retried.
- **Remediation**:
  Add `aria-label="Retry saving completion progress"` to the button, or render "Could not save progress • Retry".

---

## 4. Checks and Evidence

### Executed Verification Commands

1. **New Feedback Subsystem Unit Tests**:
   - `npx vitest run src/client/feedback/__tests__`
   - *Result*: **3 passed (3 files), 4 passed (4 tests)** in 971ms.
2. **Full Subsystem Regression Test Suite**:
   - `npx vitest run src/client/screens/dashboard/home src/client/mobile/screens/Home src/client/screens/dashboard/explore src/client/screens/dashboard/play src/client/mobile/screens/Play src/client/screens/dashboard/message src/client/screens/dashboard/studyroom src/client/screens/auth src/client/screens/cohort src/client/personal-workspace`
   - *Result*: **135 passed (135 files), 1,045 passed (1,045 tests)** in 43.84s.
3. **TypeScript Strict Type Check**:
   - `npx tsc --noEmit --incremental false`
   - *Result*: **0 errors** (Command exited with code 0).
4. **Next.js Production Build Simulation**:
   - `npm run build`
   - *Result*: Prisma client generated, sub-packages built (`@undone/notes-board`, `interaction-builder`), 50 static/dynamic pages compiled, **0 errors**.
5. **Git Whitespace & Diff Sanity**:
   - `git diff --check`
   - *Result*: Clean (no trailing whitespace or conflict markers).
6. **Vercel Pre-Deployment Pipeline**:
   - `npm run verify:vercel`
   - *Result*: `✔ Checking Git Submodules PASSED`, `✔ Building Internal Packages PASSED`, `✔ Prisma Client Generation PASSED`, `✔ TypeScript Verification PASSED`, `✔ Production Build Simulation PASSED`. Total time: 44.9s.
7. **Static Code Analysis (ESLint)**:
   - `npx eslint src/client/feedback ...`
   - *Result*: Detected `react-hooks/set-state-in-effect` in `ToastProvider.tsx` and ref access violation in `useMessage.ts`.

---

## 5. Unverified Risks and Blocked Investigation

1. **Centrifugo Realtime WebSocket Cluster**:
   - *Risk*: `SiteFailureBridge` and `useMessage` rely on Centrifugo for live reaction and typing broadcasts. While mocked cleanly in Vitest, reconnect behavior under high network jitter on a real mobile device requires live staging environment access.
   - *Next Concrete Check*: Test with Centrifugo container running in local Docker stack with throttled network profile in Chrome DevTools.
2. **GitHub App OAuth Redirect in Production**:
   - *Risk*: `connect-github-modal.tsx` uses `window.open` popup communication (`UNDONE_GITHUB_AUTH_SUCCESS`). Browsers with aggressive popup blockers might force the fallback redirect flow.
   - *Next Concrete Check*: Test OAuth authorization flow on Safari iOS and Firefox with strict popup blocking enabled.

---

## 6. Correction Order and Completion Criteria

### Remediation Steps (in Dependency Order)

1. **Step 1: Fix DM Message Deletion Parameter Inversion (`FINDING-MSG-01`)**
   - In `src/client/screens/dashboard/message/hooks/useMessage.ts`:
     Change `messagesRepository.deleteMessage(channelId, messageId)` to `messagesRepository.deleteMessage(messageId)`.
   - *Regression Verification*: Run `npx vitest run src/client/screens/dashboard/message`.
2. **Step 2: Correct Hook Naming and Ref Mutation in `useMessage` (`FINDING-LINT-01`)**
   - Rename `safeUseSession` -> `useSafeSession`, `safeUseRealtime` -> `useSafeRealtime`.
   - Wrap `actionAccount.current = currentUserId` into `useEffect`.
   - *Regression Verification*: Run `npx eslint src/client/screens/dashboard/message/hooks/useMessage.ts`.
3. **Step 3: Add ESLint Suppression to `ToastProvider` Hydration Effect (`FINDING-TOAST-01`)**
   - Add `// eslint-disable-next-line react-hooks/set-state-in-effect` above `setMounted(true)`.
   - *Regression Verification*: Run `npx eslint src/client/components/global/Toast/ToastProvider.tsx`.
4. **Step 4: Enhance Accessibility of Floating Retry Pill in `PlayDesktop` (`FINDING-PLAY-01`)**
   - Add `aria-label="Retry saving completion progress"` to the button in `PlayDesktop.tsx:160`.
   - *Regression Verification*: Run `npx vitest run src/client/screens/dashboard/play/__tests__/PlayDesktop.test.tsx`.

---

### Conclusion

The codebase demonstrates exceptionally high architectural discipline and test coverage (1,045 tests passing). The findings above represent isolated edge-case fixes that can be cleanly corrected in a single targeted commit without architectural disruption.
