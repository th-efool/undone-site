# Website-wide failure feedback — follow-on implementation handoff

## A. Execution contract

READY for the exact scoped rollout below after the predecessor passes all gates. Root D:/ThisPC/Documents/SideQuestHQ/undone-site; PowerShell; npm; Node >=24 <25. Verified final baseline: master HEAD 153c7a9b09f47bdfe4096bc53ee75d44107550ab. The predecessor was committed while this handoff was being authored. Final git status shows only this new handoff file; preserve any later edits. All replacement anchors were revalidated against the current files after the predecessor commit.

Dependency: IdiotHandOffGuide-error-notifications-diagnostics.md must be fully implemented, typechecked, built and tested first. Its manager ledger currently reports 6 focused tests plus 252 subsystem tests, typecheck and build passing; those are predecessor results reported by its executor, not tests of this new guide. Browser/failure-injection acceptance is still required before treating the predecessor as perfect. Required postconditions: one root ToastProvider wrapping ReactQueryProvider; stable addToast callback; persistent errors, max3 stack and top-right portal; useFailureToast exported with (error,message,component); browser DevLogger diagnostics and owner-scoped cohort diagnostics working. Do not reapply, replace or weaken predecessor changes. Other than these explicit interfaces, the predecessor changes none of this guide's target files, so exact anchors below remain applicable. Stop if the actual final predecessor differs.

Check baseline/status; apply steps in order; run verification; report changed files, real checks and any skipped cases. For partial application skip only where the complete replacement exists once and original is absent. On mismatch stop dependent work and report the path/anchor. Normalize CRLF/LF for matching, preserve original line endings. New targets must not exist unless identical. No secrets, new dependency, migration or data deletion. Use current configured environment for builds; never print .env values. No deploy/publication action is authorized merely by reading this file.

### Recovery rules and scope

Website-wide means shared notifications for the actual current surfaces: Home, Explore, feed/player (/play), Notes (both engines), messaging, study rooms, cohort join and auth. Existing creation flows stay under predecessor behavior. Static pages (terms/policy/marketing) have no data mutations; archived pages are not production routes.

This is notification and scoped recovery, not a generic page reset. Failed read keeps cached content; failed mutation retains draft and unlocks controls; Notes sync failure preserves local commits/outbox/editor buffers; messaging send failure keeps its retryable failed bubble and original request ID; joining/auth/access-denied states stay meaningful. Home's existing guarded rollback is retained. DM deletion becomes pessimistic so failed deletion does not make a message disappear. Confirmed partial server commits are never erased. Network timeout is unknown outcome: re-check canonical state before destructive retry. No window reload, blanket snapshot rollback, console interception, fetch monkey patch or polling every API.

Browser logs and this action reporting work on every route and appear in the predecessor's panel with ?debug=1. Only bounded public failure codes are added to logs; never add credentials, note/message text, query strings or raw backend errors. Server model run diagnostics remain cohort-only. This rollout does NOT expose arbitrary backend process logs for other features. Initial unavailable/forbidden views, validation errors, local-save/remote-sync badges, conflicts and retry controls are retained because they describe persistent state.

## B. Requirements / coverage map

| Area | Implementation | Expected recovery | Checks |
|---|---|---|---|
| Global query failures (Home/Explore/Cohort viewers) | P1–P6 | terminal failure after existing retry, retain cache | T1,T2,V2,V3 |
| Home mutation feedback | H1–H5 | existing account-generation rollback and local choice storage | V2,V3 |
| Feed /play desktop + mobile | F1–F8 | preserve current lesson, rollback failed progress, keep Retry | V2,V3 |
| Notes local-first + legacy | N1–N12 | preserve editor buffers and outbox, keep sync/conflict/recovery controls | V2,V3 |
| Messaging send/retry/edit/reaction + DM delete | M1–M15 | failed bubble retry; deletion only after server success | V2,V3 |
| Studyroom actions/settings/load more | R1–R12 | canonical updates only after success; pagination retains rooms | V2,V3 |
| Auth and cohort join | A1–A4,J1–J4 | retain form, pending cleared, no false joined state | V2,V3 |

Coverage boundary: no generic change is made to every console.error or role=alert. Unimplemented messaging attachment features, old legacy creation routes, image decode fallbacks, browser autoplay restrictions, permissions and offline status remain their existing feature contracts. Realtime typing/read-watermark and background polling failures do not produce repetitive user notifications. M11–M15 extend coverage to pin/mute and new-conversation actions. Preferences become visible after confirmation; repeated clicks for the same pending preference are ignored.

## C. File-change manifest

- Create `src/client/feedback/site-failures.ts`: P1.
- Create `src/client/feedback/SiteFailureBridge.tsx`: P2.
- Modify `src/client/providers/ReactQueryProvider.tsx`: P3, P4.
- Modify `src/client/react-query/query-client.ts`: P5, P6.
- Modify `src/client/screens/dashboard/home/hooks/useHome.ts`: H1, H2, H3.
- Modify `src/client/screens/dashboard/home/HomeDesktop.tsx`: H4.
- Modify `src/client/mobile/screens/Home/HomeMobile.tsx`: H5.
- Modify `src/client/personal-workspace/hooks/useLocalWorkspace.ts`: N1, N2, N3, N4, N5.
- Modify `src/client/screens/dashboard/notes/hooks/useNotes.ts`: N12, N6, N7, N8.
- Modify `src/client/personal-workspace/ui/connect-github-modal.tsx`: N9, N10, N11.
- Modify `src/client/screens/dashboard/play/hooks/usePlayback.ts`: F1, F2, F3.
- Modify `src/client/screens/dashboard/play/PlayDesktop.tsx`: F4, F4a, F4b, F6, F7.
- Modify `src/client/mobile/screens/Play/PlayMobile.tsx`: F5, F5a, F5b, F8.
- Modify `src/client/screens/dashboard/studyroom/room/components/SharedSprintWidget.tsx`: R1, R2, R3, R4.
- Modify `src/client/screens/dashboard/studyroom/components/RoomSettingsModal.tsx`: R5, R6, R7, R8.
- Modify `src/client/screens/dashboard/studyroom/StudyRoomScreen.tsx`: R9, R10, R11, R12.
- Modify `src/client/screens/auth/authForm/authForm.tsx`: A1, A2, A3, A4.
- Modify `src/client/screens/cohort/components/JoinCohortButton.tsx`: J1, J2, J3, J4.
- Modify `src/client/screens/dashboard/message/hooks/useMessage.ts`: M11, M12, M13, M14, M15, M1, M2, M3, M4, M5, M6, M7, M8, M9, M10.

- Create `src/client/feedback/__tests__/site-failures.test.ts`: T1.
- Create `src/client/feedback/__tests__/query-errors.test.ts`: T2.
- Create `src/client/feedback/__tests__/SiteFailureBridge.test.tsx`: T3.
- Replace `src/client/mobile/screens/Home/__tests__/HomeMobile.test.tsx`: T4.
- Replace `src/client/screens/dashboard/play/__tests__/PlayDesktop.test.tsx`: T5.
- Modify `src/client/personal-workspace/ui/connect-github-modal.tsx`: N13–N15.
- Modify `src/client/mobile/screens/Play/PlayMobile.tsx`: F9.
- Replace `src/client/screens/dashboard/studyroom/__tests__/SharedSprintWidget.test.tsx`: T6.
No package/lockfile/migration changes. Build may regenerate existing submodule dist/Prisma outputs; inspect incidental diffs.

## D. Ordered payloads

### P1 — `src/client/feedback/site-failures.ts`

Create complete file, target absent or identical.

```typescript
import { devLogger } from '@/src/shared/lib/dev-logger';
export const failureMessages = {
  "data": "Could not refresh this view. Previously loaded content remains available.",
  "home": "Could not save that home change. Check the current state before retrying.",
  "feed": "Could not load more lessons. Your current lesson is kept.",
  "completion": "Could not confirm progress was saved. Retry saving when ready.",
  "notesLocal": "Could not save changes on this device. Keep this tab open and export a recovery copy.",
  "notesSync": "Cloud sync needs attention. Keep your local work and review the sync controls.",
  "message": "Could not complete that messaging action. Your saved messages remain available.",
  "room": "Could not confirm that room action. Check its current state before retrying.",
  "auth": "Sign-in is unavailable. Your form is kept; please retry.",
  "join": "Could not confirm membership. Check the cohort before retrying.",
  "github": "Could not complete the repository connection. Your notes remain on this device."
} as const;
export type FailureCode = keyof typeof failureMessages;
export type SiteFailure = { code: FailureCode; message: string };
const listeners = new Set<(failure: SiteFailure) => void>();
const recent = new Map<FailureCode, number>();
const pending: SiteFailure[] = [];
/** Notification only: callers retain their operation's commit/rollback rules. */
export function reportSiteFailure(code: FailureCode) {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - (recent.get(code) ?? -Infinity) < 8000) return;
  recent.set(code, now);
  const failure = { code, message: failureMessages[code] };
  devLogger.error('SiteFailure', 'operation_failed', { code });
  devLogger.debug('SiteFailure', 'failure_context', { code, online: navigator.onLine });
  if (listeners.size) listeners.forEach(listener => listener(failure));
  else { pending.push(failure); if (pending.length > 3) pending.shift(); }
}
export function subscribeSiteFailures(listener: (failure: SiteFailure) => void) {
  listeners.add(listener);
  pending.splice(0).forEach(listener);
  return () => { listeners.delete(listener); };
}
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### P2 — `src/client/feedback/SiteFailureBridge.tsx`

Create complete file, target absent or identical.

```tsx
'use client';
import { useContext, useEffect } from 'react';
import { ToastContext } from '@/src/client/components/global/Toast/ToastProvider';
import { subscribeSiteFailures } from './site-failures';
export function SiteFailureBridge() {
  const context = useContext(ToastContext);
  const add = context?.addToast;
  useEffect(() => {
    if (!add) return;
    return subscribeSiteFailures(failure => add({ type: 'error', message: failure.message, duration: 0 }));
  }, [add]);
  return null;
}
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### P3 — `src/client/providers/ReactQueryProvider.tsx`

Replace exactly once:

Original:

```text
import React from 'react';
```

Replacement:

```text
import React from 'react';
import { SiteFailureBridge } from '@/src/client/feedback/SiteFailureBridge';
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### P4 — `src/client/providers/ReactQueryProvider.tsx`

Replace exactly once:

Original:

```text
return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
```

Replacement:

```text
return <QueryClientProvider client={queryClient}><SiteFailureBridge />{children}</QueryClientProvider>;
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### P5 — `src/client/react-query/query-client.ts`

Replace exactly once:

Original:

```text
import { QueryClient } from '@tanstack/react-query';
```

Replacement:

```text
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { reportSiteFailure } from '@/src/client/feedback/site-failures';
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### P6 — `src/client/react-query/query-client.ts`

Replace exactly once:

Original:

```text
    defaultOptions: {
```

Replacement:

```text
    queryCache: new QueryCache({ onError: () => reportSiteFailure('data') }),
    mutationCache: new MutationCache({ onError: () => reportSiteFailure('data') }),
    defaultOptions: {
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### H1 — `src/client/screens/dashboard/home/hooks/useHome.ts`

Replace exactly once:

Original:

```text
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
```

Replacement:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### H2 — `src/client/screens/dashboard/home/hooks/useHome.ts`

Replace exactly once:

Original:

```text
        await operation();
      } finally {
```

Replacement:

```text
        await operation();
      } catch (error) {
        if (userGenerationRef.current === currentGen && prevUserIdRef.current === currentUid) reportSiteFailure('home');
        throw error;
      } finally {
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### H3 — `src/client/screens/dashboard/home/hooks/useHome.ts`

Replace exactly once:

Original:

```text
import { useFailureToast } from '@/src/client/hooks/useFailureToast';

```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### H4 — `src/client/screens/dashboard/home/HomeDesktop.tsx`

Replace exactly once:

Original:

```text
          {home.syncError && <p role="alert">{home.syncError}</p>}
```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### H5 — `src/client/mobile/screens/Home/HomeMobile.tsx`

Replace exactly once:

Original:

```text
      {home.syncError && (
        <p role="alert" className={styles.errorAlert}>
          {home.syncError}
        </p>
      )}
```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### N1 — `src/client/personal-workspace/hooks/useLocalWorkspace.ts`

Replace exactly once:

Original:

```text
import { useCallback, useEffect, useRef, useState } from 'react';
```

Replacement:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
import { useCallback, useEffect, useRef, useState } from 'react';
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### N2 — `src/client/personal-workspace/hooks/useLocalWorkspace.ts`

Replace exactly once:

Original:

```text
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(userId));
```

Replacement:

```text
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(userId));
  useFailureToast(syncSummary.status === 'error' ? 'sync-error' : null, 'Cloud sync needs attention. Local edits are retained; use the sync controls.', 'NotesSync');
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### N3 — `src/client/personal-workspace/hooks/useLocalWorkspace.ts`

Replace exactly once:

Original:

```text
        setIsLoading(false);
      });
```

Replacement:

```text
        reportSiteFailure('notesLocal');
        setIsLoading(false);
      });
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### N4 — `src/client/personal-workspace/hooks/useLocalWorkspace.ts`

Replace exactly once:

Original:

```text
      return facadeRef.current.apply(command);
```

Replacement:

```text
      try {
        const receipt = await facadeRef.current.apply(command);
        if (!receipt.ok) reportSiteFailure('notesLocal');
        return receipt;
      } catch (error) { reportSiteFailure('notesLocal'); throw error; }
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### N5 — `src/client/personal-workspace/hooks/useLocalWorkspace.ts`

Replace exactly once:

Original:

```text
      return facadeRef.current.saveCanvasScene(noteId, scene);
```

Replacement:

```text
      try {
        const receipt = await facadeRef.current.saveCanvasScene(noteId, scene);
        if (!receipt.ok) reportSiteFailure('notesLocal');
        return receipt;
      } catch (error) { reportSiteFailure('notesLocal'); throw error; }
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### N6 — `src/client/screens/dashboard/notes/hooks/useNotes.ts`

Replace exactly once:

Original:

```text
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

Replacement:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### N7 — `src/client/screens/dashboard/notes/hooks/useNotes.ts`

Replace exactly once:

Original:

```text
  const [syncStatus, setSyncStatus] = useState<NotesSyncStatus>('saved');
```

Replacement:

```text
  const [syncStatus, setSyncStatus] = useState<NotesSyncStatus>('saved');
  useFailureToast(syncStatus === 'error' ? 'notes-save' : null, 'Could not save these notes. Keep this tab open and retain your edits.', 'NotesSave');
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### N8 — `src/client/screens/dashboard/notes/hooks/useNotes.ts`

Replace exactly once:

Original:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';

```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### N9 — `src/client/personal-workspace/ui/connect-github-modal.tsx`

Replace exactly once:

Original:

```text
import React, { useState, useEffect, useCallback } from 'react';
```

Replacement:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
import React, { useState, useEffect, useCallback } from 'react';
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### N10 — `src/client/personal-workspace/ui/connect-github-modal.tsx`

Replace exactly once:

Original:

```text
  const [error, setError] = useState<string | null>(null);
```

Replacement:

```text
  const [error, setError] = useState<string | null>(null);
  useFailureToast(error, 'Could not complete the repository connection. Your notes remain on this device.', 'NotesConnection');
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### N11 — `src/client/personal-workspace/ui/connect-github-modal.tsx`

Replace exactly once:

Original:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';

```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### F1 — `src/client/screens/dashboard/play/hooks/usePlayback.ts`

Replace exactly once:

Original:

```text
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

Replacement:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### F2 — `src/client/screens/dashboard/play/hooks/usePlayback.ts`

Replace exactly once:

Original:

```text
  const [completionError, setCompletionError] = useState<string | null>(null);
```

Replacement:

```text
  const [completionError, setCompletionError] = useState<string | null>(null);
  useFailureToast(completionError, 'Could not confirm progress was saved. Retry saving when ready.', 'FeedCompletion');
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### F3 — `src/client/screens/dashboard/play/hooks/usePlayback.ts`

Replace exactly once:

Original:

```text
        console.error('Prefetch error:', error);
```

Replacement:

```text
        reportSiteFailure('feed');
        console.error('Prefetch error:', error);
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### F4 — `src/client/screens/dashboard/play/PlayDesktop.tsx`

Replace exactly once:

Original:

```text
import React, { useCallback, useEffect, useRef, useState } from 'react';
```

Replacement:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
import React, { useCallback, useEffect, useRef, useState } from 'react';
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### F4a — `src/client/screens/dashboard/play/PlayDesktop.tsx`

Replace exactly once:

Original:

```text
  const [fullscreenFeedback, setFullscreenFeedback] = useState<string | null>(null);
```

Replacement:

```text
  const [fullscreenFeedback, setFullscreenFeedback] = useState<string | null>(null);
  useFailureToast(fullscreenFeedback, 'Fullscreen was blocked by your browser. Playback remains available here.', 'Fullscreen');
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### F4b — `src/client/screens/dashboard/play/PlayDesktop.tsx`

Replace exactly once:

Original:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';

```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### F5 — `src/client/mobile/screens/Play/PlayMobile.tsx`

Replace exactly once:

Original:

```text
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

Replacement:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### F5a — `src/client/mobile/screens/Play/PlayMobile.tsx`

Replace exactly once:

Original:

```text
  const [fullscreenFeedback, setFullscreenFeedback] = useState<string | null>(null);
```

Replacement:

```text
  const [fullscreenFeedback, setFullscreenFeedback] = useState<string | null>(null);
  useFailureToast(fullscreenFeedback, 'Fullscreen was blocked by your browser. Playback remains available here.', 'Fullscreen');
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### F5b — `src/client/mobile/screens/Play/PlayMobile.tsx`

Replace exactly once:

Original:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';

```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### F6 — `src/client/screens/dashboard/play/PlayDesktop.tsx`

Replace exactly once:

Original:

```text
      {(fullscreenFeedback || playback.completionError) && (
        <div className={styles.feedbackToast} role="alert">
          <AlertCircle size={16} />
          <span>{fullscreenFeedback || playback.completionError}</span>
```

Replacement:

```text
      {playback.completionError && (
        <div className={styles.feedbackToast}>
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### F7 — `src/client/screens/dashboard/play/PlayDesktop.tsx`

Replace exactly once:

Original:

```text
import { AlertCircle } from 'lucide-react';

```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### F8 — `src/client/mobile/screens/Play/PlayMobile.tsx`

Replace exactly once:

Original:

```text
      {(fullscreenFeedback || playback.completionError) && (
        <div className={styles.feedbackToast} role="alert">
          <AlertCircle size={15} />
          <span>{fullscreenFeedback || playback.completionError}</span>
        </div>
      )}
```

Replacement:

```text
      {playback.completionError && <button type="button" disabled={playback.completionPending} onClick={() => void playback.completeActiveChunk()}>Retry saving progress</button>}
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### R1 — `src/client/screens/dashboard/studyroom/room/components/SharedSprintWidget.tsx`

Replace exactly once:

Original:

```text
import React, { useState } from 'react';
```

Replacement:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
import React, { useState } from 'react';
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### R2 — `src/client/screens/dashboard/studyroom/room/components/SharedSprintWidget.tsx`

Replace exactly once:

Original:

```text
  const [selectedDuration, setSelectedDuration] = useState<number>(25);
```

Replacement:

```text
  const [selectedDuration, setSelectedDuration] = useState<number>(25);
  useFailureToast(actionError, 'Could not confirm the sprint action. Check its current state before retrying.', 'RoomSprint');
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### R3 — `src/client/screens/dashboard/studyroom/room/components/SharedSprintWidget.tsx`

Replace exactly once:

Original:

```text
      {actionError && (
        <div className={styles.errorBanner} role="alert">
          {actionError}
        </div>
      )}
```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### R4 — `src/client/screens/dashboard/studyroom/room/components/SharedSprintWidget.tsx`

Replace exactly once:

Original:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';

```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### R5 — `src/client/screens/dashboard/studyroom/components/RoomSettingsModal.tsx`

Replace exactly once:

Original:

```text
import React, { useState, useEffect, useCallback } from 'react';
```

Replacement:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
import React, { useState, useEffect, useCallback } from 'react';
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### R6 — `src/client/screens/dashboard/studyroom/components/RoomSettingsModal.tsx`

Replace exactly once:

Original:

```text
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
```

Replacement:

```text
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const actionFailure = errorMessage && errorMessage !== 'Room title cannot be empty.' ? errorMessage : null;
  useFailureToast(actionFailure, 'Could not confirm the room change. Your form is kept; check the current room state.', 'RoomSettings');
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### R7 — `src/client/screens/dashboard/studyroom/components/RoomSettingsModal.tsx`

Replace exactly once:

Original:

```text
{errorMessage && <div className={styles.errorBanner}>{errorMessage}</div>}
```

Replacement:

```text
{errorMessage && !actionFailure && <div className={styles.errorBanner}>{errorMessage}</div>}
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### R8 — `src/client/screens/dashboard/studyroom/components/RoomSettingsModal.tsx`

Replace exactly once:

Original:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';

```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### R9 — `src/client/screens/dashboard/studyroom/StudyRoomScreen.tsx`

Replace exactly once:

Original:

```text
import React, { useState, useEffect } from 'react';
```

Replacement:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
import React, { useState, useEffect } from 'react';
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### R10 — `src/client/screens/dashboard/studyroom/StudyRoomScreen.tsx`

Replace exactly once:

Original:

```text
      setErrorMessage(err instanceof Error ? err.message : 'Unable to fetch more study rooms.');
```

Replacement:

```text
      reportSiteFailure('room');
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### R11 — `src/client/screens/dashboard/studyroom/StudyRoomScreen.tsx`

Replace exactly once:

Original:

```text
    } catch (err: unknown) {
      setIsError(true);
      reportSiteFailure('room');
```

Replacement:

```text
    } catch {
      reportSiteFailure('room');
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### R12 — `src/client/screens/dashboard/studyroom/StudyRoomScreen.tsx`

Replace exactly once:

Original:

```text
import { useFailureToast } from '@/src/client/hooks/useFailureToast';

```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### A1 — `src/client/screens/auth/authForm/authForm.tsx`

Replace exactly once:

Original:

```text
import { useRef, useState } from 'react';
```

Replacement:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
import { useRef, useState } from 'react';
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### A2 — `src/client/screens/auth/authForm/authForm.tsx`

Replace exactly once:

Original:

```text
  const [error, setError] = useState<string | null>(null);
```

Replacement:

```text
  const [error, setError] = useState<string | null>(null);
  const actionFailure = error && /unavailable|network error/i.test(error) ? error : null;
  useFailureToast(actionFailure, 'Sign-in is unavailable. Your form is kept; please retry.', 'Auth');
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### A3 — `src/client/screens/auth/authForm/authForm.tsx`

Replace exactly once:

Original:

```text
{error && <p role="alert"
```

Replacement:

```text
{error && !actionFailure && <p role="alert"
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### A4 — `src/client/screens/auth/authForm/authForm.tsx`

Replace exactly once:

Original:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';

```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### J1 — `src/client/screens/cohort/components/JoinCohortButton.tsx`

Replace exactly once:

Original:

```text
import React, { useState } from 'react';
```

Replacement:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
import React, { useState } from 'react';
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### J2 — `src/client/screens/cohort/components/JoinCohortButton.tsx`

Replace exactly once:

Original:

```text
  const [error, setError] = useState<string | null>(null);
```

Replacement:

```text
  const [error, setError] = useState<string | null>(null);
  useFailureToast(error, 'Could not confirm membership. Check the cohort before retrying.', 'CohortJoin');
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### J3 — `src/client/screens/cohort/components/JoinCohortButton.tsx`

Replace exactly once:

Original:

```text
      {error && <p role="alert">{error}</p>}
```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### J4 — `src/client/screens/cohort/components/JoinCohortButton.tsx`

Replace exactly once:

Original:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';

```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### M1 — `src/client/screens/dashboard/message/hooks/useMessage.ts`

Replace exactly once:

Original:

```text
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

Replacement:

```text
import { reportSiteFailure } from '@/src/client/feedback/site-failures';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### M2 — `src/client/screens/dashboard/message/hooks/useMessage.ts`

Replace exactly once:

Original:

```text
import { useFailureToast } from '@/src/client/hooks/useFailureToast';

```

Replacement:

```text

```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### M3 — `src/client/screens/dashboard/message/hooks/useMessage.ts`

Replace exactly once:

Original:

```text
        console.error('Failed to send message:', err);
```

Replacement:

```text
        reportSiteFailure('message');
        console.error('Failed to send message:', err);
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### M4 — `src/client/screens/dashboard/message/hooks/useMessage.ts`

Replace exactly once:

Original:

```text
        console.error('Failed to retry message:', err);
```

Replacement:

```text
        reportSiteFailure('message');
        console.error('Failed to retry message:', err);
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### M5 — `src/client/screens/dashboard/message/hooks/useMessage.ts`

Replace exactly once:

Original:

```text
        console.error('Failed to toggle reaction:', err);
```

Replacement:

```text
        reportSiteFailure('message');
        console.error('Failed to toggle reaction:', err);
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### M6 — `src/client/screens/dashboard/message/hooks/useMessage.ts`

Replace exactly once:

Original:

```text
        console.error('Failed to edit message:', err);
```

Replacement:

```text
        reportSiteFailure('message');
        console.error('Failed to edit message:', err);
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### M7 — `src/client/screens/dashboard/message/hooks/useMessage.ts`

Replace exactly once:

Original:

```text
        console.error('Failed to delete message:', err);
```

Replacement:

```text
        reportSiteFailure('message');
        console.error('Failed to delete message:', err);
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### M8 — `src/client/screens/dashboard/message/hooks/useMessage.ts`

Replace exactly once:

Original:

```text
        console.error('Failed to send DM message:', err);
```

Replacement:

```text
        reportSiteFailure('message');
        console.error('Failed to send DM message:', err);
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### M9 — `src/client/screens/dashboard/message/hooks/useMessage.ts`

Replace exactly once:

Original:

```text
        console.error('Failed to retry DM message:', err);
```

Replacement:

```text
        reportSiteFailure('message');
        console.error('Failed to retry DM message:', err);
```

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### M10 — `src/client/screens/dashboard/message/hooks/useMessage.ts`

Replace exactly once:

Original:

```text
  const deleteDMMessage = useCallback(
    (dmId: string, messageId: string) => {
      const conv = conversationsList.find((c) => c.id === dmId);
      const channelId = conv?.channelId;
      if (channelId) {
        setMessagesByChannel((prev) => ({
          ...prev,
          [channelId]: (prev[channelId] ?? []).filter((m) => m.id !== messageId),
        }));
        messagesRepository.deleteMessage(channelId, messageId).catch((err) => {
          console.error('Failed to delete DM message on server:', err);
        });
      }
    },
    [conversationsList]
  );


```

Replacement:

```text
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

Postcondition: complete replacement exists; retain surrounding implementation and failure semantics.

### M11 — src/client/screens/dashboard/message/hooks/useMessage.ts

Replace exactly once.

Original:

```text
  const currentUserId = session?.user?.id ?? null;
```

Replacement:

```text
  const currentUserId = session?.user?.id ?? null;
  const actionAccount = useRef(currentUserId);
  actionAccount.current = currentUserId;
  const pendingPreferences = useRef(new Set<string>());
```

### M12 — src/client/screens/dashboard/message/hooks/useMessage.ts

Replace exactly once.

Original:

```text
  const togglePinConversation = useCallback(
    (id: string) => {
      let nextPinned = false;
      setPinnedConversations((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          nextPinned = false;
        } else {
          next.add(id);
          nextPinned = true;
        }
        return next;
      });

      let channelId: string | null = null;
      const conv = conversationsList.find((c) => c.id === id);
      if (conv?.channelId) {
        channelId = conv.channelId;
      } else {
        const comm = communities.find((c) => c.cohortId === id);
        channelId = comm?.channels[0]?.id ?? null;
      }

      if (channelId) {
        messagesRepository.updateChannelPreferences(channelId, { isPinned: nextPinned }).catch((err) => {
          console.warn('Failed to persist pin preference:', err);
        });
      }
    },
    [conversationsList, communities]
  );

  const muteConversation = useCallback(
    (id: string, hours: number) => {
      const mutedUntilMs = Date.now() + hours * 60 * 60 * 1000;
      const mutedUntilIso = new Date(mutedUntilMs).toISOString();
      setMutedConversations((prev) => ({
        ...prev,
        [id]: mutedUntilMs,
      }));

      let channelId: string | null = null;
      const conv = conversationsList.find((c) => c.id === id);
      if (conv?.channelId) {
        channelId = conv.channelId;
      } else {
        const comm = communities.find((c) => c.cohortId === id);
        channelId = comm?.channels[0]?.id ?? null;
      }

      if (channelId) {
        messagesRepository.updateChannelPreferences(channelId, { mutedUntil: mutedUntilIso }).catch((err) => {
          console.warn('Failed to persist mute preference:', err);
        });
      }
    },
    [conversationsList, communities]
  );


```

Replacement:

```text
  const togglePinConversation = useCallback(
    (id: string) => {
      const key = 'pin:' + id;
      if (pendingPreferences.current.has(key)) return;
      const channelId = conversationsList.find(item => item.id === id)?.channelId ?? communities.find(item => item.cohortId === id)?.channels[0]?.id;
      if (!channelId) { reportSiteFailure('message'); return; }
      const owner = currentUserId;
      const nextPinned = !pinnedConversations.has(id);
      pendingPreferences.current.add(key);
      void messagesRepository.updateChannelPreferences(channelId, { isPinned: nextPinned }).then(() => {
        if (actionAccount.current !== owner) return;
        setPinnedConversations(previous => {
          const next = new Set(previous);
          if (nextPinned) next.add(id); else next.delete(id);
          return next;
        });
      }).catch(() => { if (actionAccount.current === owner) reportSiteFailure('message'); })
        .finally(() => pendingPreferences.current.delete(key));
    }, [conversationsList, communities, pinnedConversations, currentUserId]
  );

  const muteConversation = useCallback(
    (id: string, hours: number) => {
      const key = 'mute:' + id;
      if (pendingPreferences.current.has(key)) return;
      const channelId = conversationsList.find(item => item.id === id)?.channelId ?? communities.find(item => item.cohortId === id)?.channels[0]?.id;
      if (!channelId) { reportSiteFailure('message'); return; }
      const owner = currentUserId;
      const mutedUntilMs = Date.now() + hours * 60 * 60 * 1000;
      pendingPreferences.current.add(key);
      void messagesRepository.updateChannelPreferences(channelId, { mutedUntil: new Date(mutedUntilMs).toISOString() }).then(() => {
        if (actionAccount.current === owner) setMutedConversations(previous => ({ ...previous, [id]: mutedUntilMs }));
      }).catch(() => { if (actionAccount.current === owner) reportSiteFailure('message'); })
        .finally(() => pendingPreferences.current.delete(key));
    }, [conversationsList, communities, currentUserId]
  );


```

### M13 — src/client/screens/dashboard/message/hooks/useMessage.ts

Replace exactly once.

Original:

```text
      const result = await messagesRepository.createDirectConversation(recipientId);
```

Replacement:

```text
      const result = await messagesRepository.createDirectConversation(recipientId).catch(error => { reportSiteFailure('message'); throw error; });
```

### M14 — src/client/screens/dashboard/message/hooks/useMessage.ts

Replace exactly once.

Original:

```text
      const result = await messagesRepository.createGroupConversation(title, participantIds);
```

Replacement:

```text
      const result = await messagesRepository.createGroupConversation(title, participantIds).catch(error => { reportSiteFailure('message'); throw error; });
```

### M15 — src/client/screens/dashboard/message/hooks/useMessage.ts

Replace exactly once.

Original:

```text
      await messagesRepository.leaveGroupConversation(conversationId);
```

Replacement:

```text
      await messagesRepository.leaveGroupConversation(conversationId).catch(error => { reportSiteFailure('message'); throw error; });
```

### N12 — src/client/screens/dashboard/notes/hooks/useNotes.ts

Replace exactly once.

Original:

```text
      setSyncStatus('saved');
    });
    return () => {
```

Replacement:

```text
      setSyncStatus('saved');
    }).catch(() => { if (active) setSyncStatus('error'); });
    return () => {
```

### T1 — `src/client/feedback/__tests__/site-failures.test.ts`

Create complete file; target must be absent or identical.

```typescript
// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.resetModules(); vi.useRealTimers(); });
it('buffers safely, deduplicates storms and permits a later failure', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
  const { reportSiteFailure, subscribeSiteFailures } = await import('../site-failures');
  reportSiteFailure('home');
  const listener = vi.fn(); const stop = subscribeSiteFailures(listener);
  expect(listener).toHaveBeenCalledTimes(1);
  reportSiteFailure('home'); expect(listener).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(8001); reportSiteFailure('home'); expect(listener).toHaveBeenCalledTimes(2);
  expect(Object.keys(listener.mock.calls[0][0]).sort()).toEqual(['code', 'message']);
  stop(); reportSiteFailure('feed'); expect(listener).toHaveBeenCalledTimes(2);
});
it('captures the same bounded public code in DEBUG without user content', async () => {
  const { devLogger } = await import('@/src/shared/lib/dev-logger');
  devLogger.enable('DEBUG'); devLogger.clear();
  const { reportSiteFailure } = await import('../site-failures'); reportSiteFailure('notesLocal');
  const logs = devLogger.getRecentLogs({ tag: 'SiteFailure' });
  expect(logs.some(log => log.message === 'operation_failed')).toBe(true);
  expect(logs.some(log => log.message === 'failure_context')).toBe(true);
});

```

### T2 — `src/client/feedback/__tests__/query-errors.test.ts`

Create complete file; target must be absent or identical.

```typescript
// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => vi.resetModules());
it('emits terminal query failures without losing a cached result', async () => {
  const { getQueryClient } = await import('@/src/client/react-query/query-client');
  const { subscribeSiteFailures } = await import('../site-failures');
  const client = getQueryClient(); client.clear(); const receive = vi.fn(); const stop = subscribeSiteFailures(receive);
  client.setQueryData(['explore'], { items: ['existing'] });
  await expect(client.fetchQuery({ queryKey: ['explore'], staleTime: 0, retry: false, queryFn: async () => { throw new Error('PRIVATE_SERVER_DETAIL'); } })).rejects.toThrow('PRIVATE_SERVER_DETAIL');
  expect(client.getQueryData(['explore'])).toEqual({ items: ['existing'] });
  expect(receive.mock.calls.some(call => call[0].code === 'data')).toBe(true);
  expect(JSON.stringify(receive.mock.calls)).not.toContain('PRIVATE_SERVER_DETAIL');
  stop(); client.clear();
});

```

### T3 — `src/client/feedback/__tests__/SiteFailureBridge.test.tsx`

Create complete file; target must be absent or identical.

```tsx
// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, act } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { SiteFailureBridge } from '../SiteFailureBridge';
import { reportSiteFailure, failureMessages } from '../site-failures';
import { ToastProvider } from '@/src/client/components/global/Toast/ToastProvider';
afterEach(cleanup);
it('uses the shared provider and leaves the editable page intact', () => {
  render(<ToastProvider><SiteFailureBridge /><input aria-label="Draft" defaultValue="Keep this" /></ToastProvider>);
  act(() => reportSiteFailure('message'));
  expect(screen.getByRole('alert').textContent).toContain(failureMessages.message);
  expect((screen.getByLabelText('Draft') as HTMLInputElement).value).toBe('Keep this');
});

```

### T4 — `src/client/mobile/screens/Home/__tests__/HomeMobile.test.tsx`

Replace whole file after checking raw-byte SHA256 `fcd125e1ceb4f93d44606c6af6dd40473e877cd985f3ba1ed1881eb12d6ca14d` with Get-FileHash -Algorithm SHA256.

```tsx
/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeMobile } from '../HomeMobile';
import type { UseHomeResult } from '@/src/client/screens/dashboard/home/hooks/useHome';
import type { ActiveCohort, PausedCohort } from '@/src/client/screens/dashboard/home/models';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <span data-testid="mock-img" data-src={props.src} />,
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
vi.mock('@/src/client/screens/dashboard/home/components/ChannelHub/ChannelHub', () => ({
  ChannelHub: () => <div data-testid="channel-hub">Channel Hub</div>,
}));

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mockActiveCohort: ActiveCohort = {
  id: 'active-1',
  cohortId: 'active-1',
  rank: 1,
  title: 'Active Systems Quest',
  provider: 'MIT',
  thumbnail: '/mit.jpg',
  minutesToday: 10,
  dailyGoalMinutes: 30,
  progressPercent: 50,
  schedule: { days: ['Mon', 'Wed'], label: 'Mon, Wed' },
};

const mockPausedCohort: PausedCohort = {
  id: 'paused-1',
  cohortId: 'paused-1',
  rank: 2,
  title: 'Paused Deep Learning',
  provider: 'DeepLearning.AI',
  thumbnail: '/dl.jpg',
  minutesToday: 0,
  dailyGoalMinutes: 20,
  progressPercent: 20,
  pausedUntil: new Date(Date.now() + 86400000 * 7).toISOString(),
  resumeLabel: 'Resume',
  schedule: { days: ['Fri'], label: 'Fri' },
};

function createMockHomeResult(overrides: Partial<UseHomeResult> = {}): UseHomeResult {
  return {
    loading: false,
    isSyncing: false,
    mutationPending: false,
    syncError: null,
    isAuthenticated: true,
    hero: { title: 'Welcome Back', subtitle: 'Ready to learn?' },
    searchPlaceholder: 'Search cohorts…',
    sections: {
      activeCohorts: { title: 'Subscribed Cohorts' },
      recentlyCompleted: { title: 'Completed Cohorts' },
    },
    summaries: [],
    activeCohorts: [mockActiveCohort],
    continueLater: [mockPausedCohort],
    recentlyCompleted: [],
    actions: {
      pauseActiveCohort: vi.fn(),
      resumePausedCohort: vi.fn(),
      saveLearningSettings: vi.fn(),
      removeSubscribedCohort: vi.fn(),
    },
    ...overrides,
  } as unknown as UseHomeResult;
}

describe('HomeMobile', () => {
  it('renders both active and paused cohorts, showing Resume button for desktop-paused cohort', () => {
    const model = createMockHomeResult();
    render(<HomeMobile model={model} />);

    expect(screen.getByText('Active Systems Quest')).toBeTruthy();
    expect(screen.getByText('Paused Deep Learning')).toBeTruthy();

    const resumeBtn = screen.getByRole('button', { name: 'Resume Paused Deep Learning' });
    expect(resumeBtn).toBeTruthy();
    fireEvent.click(resumeBtn);
    expect(model.actions.resumePausedCohort).toHaveBeenCalledWith('paused-1');
  });

  it('provides an accessible search input that filters both active and paused cohorts', () => {
    const model = createMockHomeResult();
    render(<HomeMobile model={model} />);

    const searchInput = screen.getByLabelText('Search cohorts');
    expect(searchInput).toBeTruthy();

    // Filter to paused cohort
    fireEvent.change(searchInput, { target: { value: 'deep learning' } });
    expect(screen.queryByText('Active Systems Quest')).toBeNull();
    expect(screen.getByText('Paused Deep Learning')).toBeTruthy();

    // Filter to active cohort
    fireEvent.change(searchInput, { target: { value: 'systems' } });
    expect(screen.getByText('Active Systems Quest')).toBeTruthy();
    expect(screen.queryByText('Paused Deep Learning')).toBeNull();
  });

  it('displays "No matching cohorts found." when search matches nothing, distinct from empty subscriptions', () => {
    const model = createMockHomeResult();
    render(<HomeMobile model={model} />);

    const searchInput = screen.getByLabelText('Search cohorts');
    fireEvent.change(searchInput, { target: { value: 'nonexistent query xyz' } });

    expect(screen.getByText('No matching cohorts found.')).toBeTruthy();
    expect(screen.queryByText('Discover cohorts')).toBeNull();
  });

  it('displays "Discover cohorts" link when user has no subscribed cohorts and no search query', () => {
    const model = createMockHomeResult({ activeCohorts: [], continueLater: [] });
    render(<HomeMobile model={model} />);

    expect(screen.getByText('Discover cohorts')).toBeTruthy();
  });

  it('renders ChannelHub component', () => {
    const model = createMockHomeResult();
    render(<HomeMobile model={model} />);

    expect(screen.getByTestId('channel-hub')).toBeTruthy();
  });

  it('does not embed action errors in the mobile page', () => {
    const model = createMockHomeResult({ syncError: 'Network failure syncing changes' });
    render(<HomeMobile model={model} />);
    expect(screen.queryByText('Network failure syncing changes')).toBeNull();
  });
  it('renders RecentlyCompleted when completed items exist and toggles open/close', () => {
    const model = createMockHomeResult({
      recentlyCompleted: [
        {
          id: 'comp-1',
          title: 'Finished Quest',
          thumbnail: '/finished.jpg',
          completedLabel: 'Completed Oct 2026',
          progressPercent: 100,
        },
      ],
    });
    render(<HomeMobile model={model} />);

    // Initially collapsed
    expect(screen.getByText('Completed Cohorts')).toBeTruthy();
    expect(screen.queryByText('Finished Quest')).toBeNull();

    // Expand
    fireEvent.click(screen.getByRole('button', { name: 'Expand completed cohorts' }));
    expect(screen.getByText('Finished Quest')).toBeTruthy();

    // Collapse
    fireEvent.click(screen.getByRole('button', { name: 'Collapse completed cohorts' }));
    expect(screen.queryByText('Finished Quest')).toBeNull();
  });

  it('forwards mutationPending to disable interactive actions during sync', () => {
    const model = createMockHomeResult({ mutationPending: true });
    render(<HomeMobile model={model} />);

    const pauseBtn = screen.getByRole('button', { name: 'Pause Active Systems Quest' }) as HTMLButtonElement;
    expect(pauseBtn.disabled).toBe(true);
  });
});

```

### T5 — `src/client/screens/dashboard/play/__tests__/PlayDesktop.test.tsx`

Replace whole file after checking raw-byte SHA256 `cf9190033bb1f058ca09ea5d03a66a1d188edd549cbdf0c7b1175106d14fb92f` with Get-FileHash -Algorithm SHA256.

```tsx
/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PlayDesktop } from '../PlayDesktop';
import type { UsePlaybackResult } from '../hooks/usePlayback';
import type { FeedItem } from '@/src/shared/feed/feedEngine.types';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const createMockPlayback = (overrides?: Partial<UsePlaybackResult>): UsePlaybackResult => {
  return {
    activeItem: {
      chunkId: 'chunk-1',
      lessonId: 'lesson-1',
      lessonTitle: 'The Ultimate AI Foundations Masterclass',
      chunkTitle: 'Introduction to Neural Attention',
      lessonType: 'video',
      lessonVideoId: 'dQw4w9WgXcQ',
      chunkIndex: 1,
      totalChunks: 10,
      cohortProvider: 'YouTube',
      channelId: 'default',
    } as unknown as FeedItem,
    feedLoading: false,
    isRefreshing: false,
    feedError: false,
    feedItems: [
      {
        chunkId: 'chunk-1',
        lessonId: 'lesson-1',
        lessonTitle: 'The Ultimate AI Foundations Masterclass',
        chunkTitle: 'Introduction to Neural Attention',
        lessonType: 'video',
        lessonVideoId: 'dQw4w9WgXcQ',
      } as unknown as FeedItem,
      {
        chunkId: 'chunk-2',
        lessonId: 'lesson-1',
        lessonTitle: 'The Ultimate AI Foundations Masterclass',
        chunkTitle: 'Feed Forward Layers',
        lessonType: 'video',
        lessonVideoId: 'dQw4w9WgXcQ',
      } as unknown as FeedItem,
    ],
    currentIndex: 0,
    lesson: {
      platform: 'youtube',
      title: 'The Ultimate AI Foundations Masterclass',
      subtitle: '',
      cohortTitle: '',
      cohortId: '',
      seasonOrder: 1,
      seasonNumber: 1,
      currentChunk: 1,
      totalChunks: 10,
      currentVideo: 1,
      totalVideos: 5,
      startTime: '00:00',
      endTime: '04:00',
      currentTime: '01:23',
      totalDuration: '04:00',
      videoId: 'dQw4w9WgXcQ',
    },
    timelineMarkers: [],
    timelineProgress: 35,
    hasNext: true,
    hasPrevious: false,
    isPlaying: true,
    volume: 80,
    muted: false,
    playbackSpeed: 1.0,
    bookmarked: false,
    activeTool: null,
    notesText: '',
    dailyGoalPercent: 50,
    stats: { cohortsCovered: 1, chunksRemaining: 9, estimatedMinutes: 30 },
    playerContainerRef: { current: null },
    setCurrentIndex: vi.fn(),
    goToIndex: vi.fn(),
    nextChunk: vi.fn(),
    previousChunk: vi.fn(),
    togglePlayback: vi.fn(),
    seekToPercent: vi.fn(),
    skipSeconds: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    setPlaybackSpeed: vi.fn(),
    toggleBookmark: vi.fn(),
    completeActiveChunk: vi.fn().mockResolvedValue(undefined),
    completionPending: false,
    completionError: null,
    saveNotes: vi.fn(),
    setActiveTool: vi.fn(),
    ytApiReady: true,
    ytApiError: null,
    mediaError: null,
    setMediaError: vi.fn(),
    registerVideoElement: vi.fn(),
    videoRef: { current: null },
    isPlayerReady: true,
    itemStatuses: ['not-started', 'not-started'],
    isChunkCompleted: vi.fn().mockReturnValue(false),
    activeChannel: 'default',
    setActiveChannel: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    fetchChannelFeed: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
};

describe('PlayDesktop visual redesign composition', () => {
  it('renders loading status in stage without shimmer and preserves player shell when feedLoading is true', () => {
    const playback = createMockPlayback({ feedLoading: true });
    const { container } = render(<PlayDesktop playback={playback} />);

    // Stage shows status loader
    expect(screen.getByRole('status', { name: /loading lessons/i })).toBeDefined();

    // Player shell is preserved
    expect(screen.getByRole('banner', { name: /playback header/i })).toBeDefined();

    // Zero shimmer elements
    expect(container.querySelectorAll('[class*="shimmer"]').length).toBe(0);
  });

  it('renders error notice and retry button when feedError occurs', () => {
    const onRetry = vi.fn();
    const playback = createMockPlayback({
      feedError: true,
      fetchChannelFeed: onRetry,
    });
    render(<PlayDesktop playback={playback} />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByRole('heading', { name: /lessons could not be loaded/i })).toBeDefined();

    const reloadBtn = screen.getByRole('button', { name: /reload lessons/i });
    fireEvent.click(reloadBtn);
    expect(onRetry).toHaveBeenCalledWith('default', 0);
  });

  it('renders the header metadata: title, provider, chunk range, and S1:E1 circular progress block', () => {
    const playback = createMockPlayback();
    render(<PlayDesktop playback={playback} />);

    // Lesson title
    expect(screen.getByText('The Ultimate AI Foundations Masterclass')).toBeDefined();
    // Provider badge
    expect(screen.getByText('YouTube')).toBeDefined();
    // Chunk info
    expect(screen.getByText('Chunk 1 of 10')).toBeDefined();
    // Chunk relative duration
    expect(screen.getByText('00:00 - 04:00')).toBeDefined();
    // Episode text
    expect(screen.getByText('S1:E1')).toBeDefined();
    expect(screen.getByText('Episode 1 of 5')).toBeDefined();
  });

  it('renders the floating learning tools rail with deferred placeholders and working bookmark', () => {
    const toggleBookmark = vi.fn();
    const playback = createMockPlayback({
      bookmarked: false,
      toggleBookmark,
    });
    render(<PlayDesktop playback={playback} />);

    const toolsRail = screen.getByRole('complementary', { name: /learning tools rail/i });
    expect(toolsRail).toBeDefined();

    // Verify Camera placeholder is disabled with accessible explanation
    const cameraBtn = screen.getByRole('button', { name: /capture screen or visual snapshot/i });
    expect(cameraBtn.getAttribute('aria-disabled')).toBe('true');
    expect(cameraBtn.hasAttribute('disabled')).toBe(true);

    // Verify Annotate placeholder is disabled
    const annotateBtn = screen.getByRole('button', { name: /annotate lesson/i });
    expect(annotateBtn.getAttribute('aria-disabled')).toBe('true');
    expect(annotateBtn.hasAttribute('disabled')).toBe(true);

    // Verify Mic placeholder is disabled
    const micBtn = screen.getByRole('button', { name: /record voice note/i });
    expect(micBtn.getAttribute('aria-disabled')).toBe('true');
    expect(micBtn.hasAttribute('disabled')).toBe(true);

    // Verify Bookmark button is active and functional
    const bookmarkBtn = screen.getByRole('button', { name: /bookmark this chunk/i });
    fireEvent.click(bookmarkBtn);
    expect(toggleBookmark).toHaveBeenCalledTimes(1);
  });

  it('renders detached bottom controls dock with functioning playback controls', () => {
    const completeActiveChunk = vi.fn();
    const nextChunk = vi.fn();
    const toggleMute = vi.fn();

    const playback = createMockPlayback({
      completeActiveChunk,
      nextChunk,
      toggleMute,
      hasNext: true,
    });

    render(<PlayDesktop playback={playback} />);

    const dock = screen.getByRole('toolbar', { name: /playback controls dock/i });
    expect(dock).toBeDefined();

    // Complete chunk button
    const completeBtn = screen.getByRole('button', { name: /mark chunk as complete/i });
    fireEvent.click(completeBtn);
    expect(completeActiveChunk).toHaveBeenCalledTimes(1);

    // Next chunk button
    const nextBtn = screen.getByRole('button', { name: /next chunk/i });
    fireEvent.click(nextBtn);
    expect(nextChunk).toHaveBeenCalledTimes(1);

    // Volume mute button
    const muteBtn = screen.getByRole('button', { name: /mute/i });
    fireEvent.click(muteBtn);
    expect(toggleMute).toHaveBeenCalledTimes(1);

    // Speed selector button
    const speedBtn = screen.getByRole('button', { name: /playback speed: 1x/i });
    fireEvent.click(speedBtn);
    // Menu opens with speed options
    const speed15 = screen.getByRole('menuitem', { name: '1.5x' });
    fireEvent.click(speed15);
    expect(playback.setPlaybackSpeed).toHaveBeenCalledWith(1.5);
  });

  it('renders deferred report button with disabled state and placeholder tooltip', () => {
    const playback = createMockPlayback();
    render(<PlayDesktop playback={playback} />);

    const reportBtn = screen.getByRole('button', { name: /report an issue with this chunk/i });
    expect(reportBtn).toBeDefined();
    expect(reportBtn.hasAttribute('disabled')).toBe(true);
    expect(reportBtn.getAttribute('aria-disabled')).toBe('true');
    expect(reportBtn.getAttribute('title')).toBe('Reporting coming later');
  });

  it('opens ShortcutsDialog via ? shortcut and dismisses on Escape', () => {
    const playback = createMockPlayback();
    render(<PlayDesktop playback={playback} />);

    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).toBeNull();

    // Trigger ? shortcut
    fireEvent.keyDown(window, { key: '?' });

    const dialog = screen.getByRole('dialog', { name: /keyboard shortcuts/i });
    expect(dialog).toBeDefined();

    // Dismiss via Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).toBeNull();
  });

  it('opens ShortcutsDialog via bottom dock keyboard button', () => {
    const playback = createMockPlayback();
    render(<PlayDesktop playback={playback} />);

    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).toBeNull();

    // Trigger dock keyboard button
    const dockKeyboardBtn = screen.getByRole('button', { name: /keyboard shortcuts/i });
    fireEvent.click(dockKeyboardBtn);

    const dialog = screen.getByRole('dialog', { name: /keyboard shortcuts/i });
    expect(dialog).toBeDefined();

    // Dismiss via Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).toBeNull();
  });

  it('disables speed menu for reading items', () => {
    const playback = createMockPlayback({
      activeItem: {
        chunkId: 'chunk-read-1',
        lessonId: 'lesson-1',
        lessonTitle: 'System Design Principles',
        lessonType: 'article',
        content: { text: 'Reading content', contentOrigin: 'ai', limitations: [] },
      } as unknown as FeedItem,
    });

    render(<PlayDesktop playback={playback} />);

    const speedBtn = screen.getByRole('button', { name: /playback speed unavailable for this lesson/i });
    expect(speedBtn).toBeDefined();
    expect(speedBtn.hasAttribute('disabled')).toBe(true);
    expect(speedBtn.getAttribute('aria-disabled')).toBe('true');
  });

  it('renders honest provider labels for reading and direct video sources without defaulting to YouTube', () => {
    // 1. Reading source
    const readingPlayback = createMockPlayback({
      activeItem: {
        chunkId: 'chunk-read-1',
        lessonId: 'lesson-1',
        lessonTitle: 'System Design Principles',
        lessonType: 'article',
        cohortProvider: 'OpenAI Reading',
        content: { text: 'Reading text', contentOrigin: 'ai', limitations: [] },
      } as unknown as FeedItem,
    });

    const { unmount } = render(<PlayDesktop playback={readingPlayback} />);
    expect(screen.getByText('OpenAI Reading')).toBeDefined();
    expect(screen.queryByText('YouTube')).toBeNull();
    unmount();

    // 2. Direct video source
    const directVideoPlayback = createMockPlayback({
      activeItem: {
        chunkId: 'chunk-video-1',
        lessonId: 'lesson-2',
        lessonTitle: 'Direct Video Lesson',
        lessonType: 'video',
        lessonVideoUrl: 'https://cdn.example.com/video.mp4',
      } as unknown as FeedItem,
    });

    render(<PlayDesktop playback={directVideoPlayback} />);
    expect(screen.getByText('Video')).toBeDefined();
    expect(screen.queryByText('YouTube')).toBeNull();
  });

  it('renders completion error toast with retry button when completion fails', () => {
    const completeActiveChunk = vi.fn().mockResolvedValue(undefined);
    const playback = createMockPlayback({
      completionError: 'Network timeout recording progress',
      completeActiveChunk,
    });

    render(<PlayDesktop playback={playback} />);

    expect(screen.queryByText('Network timeout recording progress')).toBeNull();

    // Explicit retry remains available without an inline technical error banner.
    const toastRetryBtn = screen.getByRole('button', { name: 'Retry', exact: true });
    fireEvent.click(toastRetryBtn);
    expect(completeActiveChunk).toHaveBeenCalledTimes(1);

    // 2. Dock retry button
    const dockRetryBtn = screen.getByRole('button', { name: /retry chunk completion/i });
    fireEvent.click(dockRetryBtn);
    expect(completeActiveChunk).toHaveBeenCalledTimes(2);
  });

  it('navigates timeline scrubber with Arrow, Home, and End keys', () => {
    const skipSeconds = vi.fn();
    const seekToPercent = vi.fn();

    const playback = createMockPlayback({
      skipSeconds,
      seekToPercent,
      timelineProgress: 50,
    });

    render(<PlayDesktop playback={playback} />);

    const scrubber = screen.getByRole('slider', { name: /timeline seek scrubber/i });
    expect(scrubber).toBeDefined();

    // Arrow Right seeks +10s
    fireEvent.keyDown(scrubber, { key: 'ArrowRight' });
    expect(skipSeconds).toHaveBeenCalledWith(10);

    // Arrow Left seeks -10s
    fireEvent.keyDown(scrubber, { key: 'ArrowLeft' });
    expect(skipSeconds).toHaveBeenCalledWith(-10);

    // Home seeks to 0%
    fireEvent.keyDown(scrubber, { key: 'Home' });
    expect(seekToPercent).toHaveBeenCalledWith(0);

    // End seeks to 100%
    fireEvent.keyDown(scrubber, { key: 'End' });
    expect(seekToPercent).toHaveBeenCalledWith(100);
  });

  it('toggles ChannelSelector radial menu with c key and dismisses on Escape', () => {
    const playback = createMockPlayback();
    render(<PlayDesktop playback={playback} />);

    expect(screen.queryByRole('menu', { name: /channel switcher/i })).toBeNull();

    // 1. Press 'c' to open
    fireEvent.keyDown(window, { key: 'c' });
    expect(screen.getByRole('menu', { name: /channel switcher/i })).toBeDefined();

    // 2. Press 'Escape' to dismiss
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: /channel switcher/i })).toBeNull();
  });

  it('renders polite empty state with refresh action when activeItem is null or undefined', () => {
    const fetchChannelFeed = vi.fn().mockResolvedValue(undefined);
    const playback = createMockPlayback({
      activeItem: undefined,
      fetchChannelFeed,
    });

    render(<PlayDesktop playback={playback} />);

    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeDefined();
    expect(screen.getByText('All Caught Up')).toBeDefined();
    expect(
      screen.getByText("You're caught up with this selection. Choose another channel or return home.")
    ).toBeDefined();

    const refreshBtn = screen.getByRole('button', { name: /refresh channel/i });
    fireEvent.click(refreshBtn);
    expect(fetchChannelFeed).toHaveBeenCalledWith('default', 0);

    const homeLink = screen.getByRole('link', { name: /back home/i });
    expect(homeLink.getAttribute('href')).toBe('/home');
  });
});

```

### N13 — `src/client/personal-workspace/ui/connect-github-modal.tsx`

Replace exactly once.

Original:

```text
            {/* Error Banner if any */}
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs"
                data-testid="error-banner"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <p className="flex-1 leading-relaxed">{error}</p>
              </div>
            ) : null}
```

Replacement:

```text

```

### N14 — `src/client/personal-workspace/ui/connect-github-modal.tsx`

Replace exactly once.

Original:

```text
            {/* Error Banner */}
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs"
                data-testid="error-banner"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <p className="flex-1 leading-relaxed">{error}</p>
              </div>
            ) : null}
```

Replacement:

```text

```

### N15 — `src/client/personal-workspace/ui/connect-github-modal.tsx`

Replace exactly once.

Original:

```text
  AlertCircle,

```

Replacement:

```text

```

### F9 — `src/client/mobile/screens/Play/PlayMobile.tsx`

Replace exactly once.

Original:

```text
  AlertCircle,

```

Replacement:

```text

```

### T6 — `src/client/screens/dashboard/studyroom/__tests__/SharedSprintWidget.test.tsx`

Replace whole file, raw-byte SHA256 `0d67c93e6f1e75cfa146da4b8898e9222b08828a43f35dc472dfcb47cb50d165`.

```tsx
/** @vitest-environment jsdom */
import React from 'react';
import { ToastProvider } from '@/src/client/components/global/Toast/ToastProvider';
const render = (ui: React.ReactNode) => testingRender(<ToastProvider>{ui}</ToastProvider>);
import { render as testingRender, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SharedSprintWidget from '../room/components/SharedSprintWidget';
import type { UseRoomSprintReturn } from '../hooks/useRoomSprint';

describe('SharedSprintWidget component', () => {
  const createMockHook = (overrides?: Partial<UseRoomSprintReturn>): UseRoomSprintReturn => ({
    sprint: null,
    isLoading: false,
    error: null,
    actionError: null,
    remainingSeconds: 0,
    isJoined: false,
    canControl: false,
    startSprint: vi.fn(),
    pauseSprint: vi.fn(),
    resumeSprint: vi.fn(),
    stopSprint: vi.fn(),
    joinSprint: vi.fn(),
    leaveSprint: vi.fn(),
    refreshSprint: vi.fn(),
    ...overrides,
  });

  it('renders idle state for regular participant without controls', () => {
    const mockHook = createMockHook({ canControl: false });
    render(<SharedSprintWidget sprintHook={mockHook} />);

    expect(screen.getByText('Group Sprint')).toBeDefined();
    expect(screen.getByText('Idle')).toBeDefined();
    expect(
      screen.getByText('No group sprint in progress. Hosts can start a sprint.')
    ).toBeDefined();
    expect(screen.queryByText('Start Group Sprint')).toBeNull();
  });

  it('renders start sprint controls for room controller in idle state', () => {
    const startSprintMock = vi.fn();
    const mockHook = createMockHook({ canControl: true, startSprint: startSprintMock });
    render(<SharedSprintWidget sprintHook={mockHook} />);

    expect(screen.getByRole('combobox', { name: /sprint duration/i })).toBeDefined();
    const startBtn = screen.getByRole('button', { name: /start group sprint/i });
    expect(startBtn).toBeDefined();

    fireEvent.click(startBtn);
    expect(startSprintMock).toHaveBeenCalledWith(25);
  });

  it('renders active sprint state with countdown, members, and controller controls', () => {
    const pauseSprintMock = vi.fn();
    const stopSprintMock = vi.fn();
    const leaveSprintMock = vi.fn();

    const mockHook = createMockHook({
      canControl: true,
      isJoined: true,
      remainingSeconds: 1420,
      sprint: {
        id: 'sprint-1',
        studyRoomId: 'room-1',
        creatorId: 'user-1',
        title: 'Math Marathon',
        targetDurationSeconds: 1500,
        elapsedSeconds: 80,
        remainingSeconds: 1420,
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        deadline: new Date(Date.now() + 1420000).toISOString(),
        pausedAt: null,
        endedAt: null,
        version: 1,
        revision: 2,
        participantCount: 3,
        participants: [],
      },
      pauseSprint: pauseSprintMock,
      stopSprint: stopSprintMock,
      leaveSprint: leaveSprintMock,
    });

    render(<SharedSprintWidget sprintHook={mockHook} />);

    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.getByText('23:40')).toBeDefined();
    expect(screen.getByText('Math Marathon')).toBeDefined();
    expect(screen.getByText('3 members')).toBeDefined();

    // Joined button
    const joinedBtn = screen.getByRole('button', { name: /joined/i });
    expect(joinedBtn).toBeDefined();
    fireEvent.click(joinedBtn);
    expect(leaveSprintMock).toHaveBeenCalled();

    // Pause button
    const pauseBtn = screen.getByRole('button', { name: /pause group sprint/i });
    fireEvent.click(pauseBtn);
    expect(pauseSprintMock).toHaveBeenCalled();

    // Stop button
    const stopBtn = screen.getByRole('button', { name: /stop group sprint/i });
    fireEvent.click(stopBtn);
    expect(stopSprintMock).toHaveBeenCalled();
  });

  it('renders join sprint button when participant is not yet joined', () => {
    const joinSprintMock = vi.fn();
    const mockHook = createMockHook({
      canControl: false,
      isJoined: false,
      remainingSeconds: 900,
      sprint: {
        id: 'sprint-1',
        studyRoomId: 'room-1',
        creatorId: 'user-1',
        title: null,
        targetDurationSeconds: 1500,
        elapsedSeconds: 600,
        remainingSeconds: 900,
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        deadline: new Date(Date.now() + 900000).toISOString(),
        pausedAt: null,
        endedAt: null,
        version: 1,
        revision: 1,
        participantCount: 1,
        participants: [],
      },
      joinSprint: joinSprintMock,
    });

    render(<SharedSprintWidget sprintHook={mockHook} />);

    const joinBtn = screen.getByRole('button', { name: /join sprint/i });
    expect(joinBtn).toBeDefined();
    fireEvent.click(joinBtn);
    expect(joinSprintMock).toHaveBeenCalled();
  });

  it('renders error banner when actionError is present', () => {
    const mockHook = createMockHook({
      actionError: 'Sprint revision conflict; please refresh sprint status',
    });

    render(<SharedSprintWidget sprintHook={mockHook} />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain('Could not confirm the sprint action. Check its current state before retrying.');
  });
});

```

## E. Verification and failure handling

### V0 — prerequisite gate

Working directory root; PowerShell. Run each command separately:

```powershell
git status --short
git rev-parse HEAD
node --version
npx vitest run src/client/components/global/Toast/__tests__ src/shared/lib/__tests__/dev-logger.test.ts
```

Require predecessor completion report, its local/browser tests and owner-isolation checks. Verify root ToastProvider wraps ReactQueryProvider. Preserve the committed predecessor and any later work. If its browser acceptance is incomplete, finish that before applying this follow-on; do not revert it or apply guides concurrently to overlapping files.

### V1 — new integration regression tests

```powershell
npx vitest run src/client/feedback/__tests__
```

Pass conditions: toast delivery through global bridge, bounded safe telemetry, cooldown prevents polling storms, later failures can be reported, cached content survives query failure, editable draft remains. New tests are included above; do not replace their assertions with implementation snapshots.

### V2 — existing regression and build gates

```powershell
npx vitest run src/client/screens/dashboard/home src/client/mobile/screens/Home src/client/screens/dashboard/explore src/client/screens/dashboard/play src/client/mobile/screens/Play src/client/screens/dashboard/message src/client/screens/dashboard/studyroom src/client/screens/auth src/client/screens/cohort src/client/personal-workspace
npx tsc --noEmit --incremental false
npm run build
git diff --check
```

Run individually; expect exit 0. Run eslint on only changed .ts/.tsx paths from this manifest; distinguish baseline warnings from new issues. T4/T5/T6 replace known obsolete embedded-banner assertions while preserving the rest of their tests. Stop and report any other assertion mismatch; do not remove unrelated checks. Build uses installed packages/submodules and normal repository environment; no test needs printing secrets. Do not run DB purge/seed scripts. Account-scoped sync tests must stay enabled.

### V3 — required failure injection by feature

Start npm run dev and use its printed localhost URL. Use authenticated local fixtures, two accounts and fresh browser sessions. For HTTP failures use browser request interception; for IndexedDB quota use storage failure injection. Test both 1440px desktop and 375px mobile. The same root toast stack must appear above content without layout movement, draft loss or focus theft.

| Case | Injected failure / action | Required state after failure |
|---|---|---|
| Home | pause/resume/settings/remove returns500; then timeout | failed optimistic state restores via existing guarded snapshot; local choices match; button unlocks; toast; different-account response cannot mutate new account |
| Explore | terminal refresh failure with existing data | existing cards/filter remain; no fabricated empty success; global toast once per cooldown; no hidden retry-policy changes |
| Cohort viewer | terminal query error; join403/500/timeout | cached page retained; join not falsely successful; pending ends; toast; permissions view retained |
| Feed /play | next-batch read failure, progress-save failure | current lesson/time stays; progress rollback unchanged; explicit Retry remains; retry with canonical chunk; no duplicate completion credit |
| Fullscreen | browser denies request | player remains usable inline; global toast; no content reset |
| Notes local | apply/saveCanvas returns failed receipt or throws | editor buffer stays available; no false saved badge; notification; no destructive rollback to an old editor snapshot |
| Notes sync | remote offline/error/conflict | local commit and pending outbox retained; sync status/reconnect/recovery/conflict UI remains; do not label it local-save failure |
| Legacy Notes | repository.load reject and save error | no unhandled load rejection; existing local editor retained; safe notification; existing Undo remains functional |
| Messaging send/retry | POST fails after optimistic append | failed bubble and original clientRequestId retained; retry uses same payload; no blanked conversation |
| Messaging DM delete | DELETE fails or is delayed | message remains until success; notification on failure; late old-account response ignored |
| Messaging pin/mute | update fails; doubleclick while pending | visible preference not changed until confirmed; same-key request guarded; other preferences still usable |
| Messaging create/leave | API rejects | no navigation/removal before success; error reported and propagated to existing dialog owner |
| Room sprint/settings | action fails/conflicts | canonical sprint/room remains; typed form values stay; field-level empty-title message stays inline; generic operation failure global |
| Studyroom pagination | load-more failure | existing room cards stay visible and interactive; cursor unchanged; pending clears; do not switch whole list to error state |
| Auth | unavailable/network rejects | values retained in memory, pending cleared, no password logging; invalid-input/credential guidance remains attached to form |
| GitHub connection | rejected connect/disconnect | local Notes retained, connection controls usable; existing validation/recovery guidance retained |

For each record action, request, observed state and retry result. Unknown network outcomes are not proof of rollback on server; refresh/reconcile before repeating irreversible actions. Never publish a public cohort or delete real user notes/messages to demonstrate a toast.

### V4 — on-site diagnostics

Open each tested route with ?debug=1 after predecessor. Set DEBUG; trigger one action failure; verify SiteFailure operation_failed/failure_context contain only public code and online state. Ensure no message/note/password/token/raw URL/prompt in new events. INFO suppresses future DEBUG; turning debug off stops the predecessor panel's polling. Browser failure codes work everywhere; backend model-run summary remains intentionally owner-scoped to creation workspaces. Cross-user querying of server diagnostics must still return404. This task adds no server-wide log endpoint.

### Recovery

Retain a patch of guide-applied changes. Reverse only these replacements/new files on rollback, preserve the predecessor and concurrent edits. No DB migration rollback exists. Never revert local Notes databases/outbox or committed workspace revisions as a UI recovery mechanism. Unknown errors require exact failing step/command output; do not improvise a second global error catcher.

## F. Completion report

Report applied IDs, changed files, actual test/build results, failures and skipped checks. Author verified 72 exact sequential replacement anchors and TypeScript syntax for 25 virtual final files, including six test payloads, without applying source changes. No runtime correctness has been established. Do not mark website-wide completion until all named recovery actions are covered and checked.

<!-- END OF HANDOFF -->
