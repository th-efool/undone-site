# Top-right failures and on-site diagnostics — handoff

## A. Execution contract

READY for the scoped creation-flow integrations and site-wide toast/debug infrastructure. Not a claim that every unrelated legacy screen has been migrated. Root D:/ThisPC/Documents/SideQuestHQ/undone-site; PowerShell; npm; Node >=24 <25. Baseline master c9dc3a5438d60050963405b116585e4a3b89adb4, clean status observed. Preserve subsequent work. No new dependency, migration, log database, console interception or global fetch monkey patch.

Authoring only: do not treat this document as executed code. Check baseline first, apply numbered payloads in order, run verification, then report actual outcomes. Missing/nonunique anchors block dependent edits. For partial application skip only exact already-applied replacements. Match after normalizing CRLF/LF; preserve line endings. Full replacements require the stated raw-byte SHA256 (Get-FileHash -Algorithm SHA256 path). New targets must be absent or identical. Never reset unrelated changes. Deployment retains the session's existing authorization requirements; no public release/data mutation is part of test acceptance.

### Observed facts

ToastProvider is not mounted by root layout; Toast CSS fixes each item at bottom-center, so multiple items overlap. useToast silently no-ops without provider. Existing logger already supports levels, local buffer and window.__UNDONE_LOGGER__; browser controls cannot change or read arbitrary Vercel process logs. Server run rows already exist and can provide durable owner-scoped diagnostics without adding logging storage.

### Chosen behavior and rollback contract

Errors from landing submit, intake, chat send/stop, new assistant run failures and release become top-right dismissible notifications. At most three; duplicate visible messages coalesce. Error notifications stay until dismissed; informational/success messages expire from original creation time. No focus theft, no page layout shift, no full reload. Narrow screens use available width with safe-area spacing.

Restore the editable UI and release busy state on failure; retain text, attachments, selected mode and retry identity. Existing handlers already retain these and clear busy flags in finally; preserve that code. Never restore an old whole-workspace snapshot or erase committed attachment/tool actions. Timeout/network failure is unknown outcome: say could not confirm, reconcile using existing idempotent retry/SSE state, never claim nothing saved. Failed Stop does not pretend cancellation succeeded. Failed assistant runs retain saved transcript/changes and emit only on a newly observed failure, not on reopening history. Field-level validation, readiness blockers, stale selection explanations, failed-source retry controls and fatal render boundaries remain where they are: they describe current state rather than transient action feedback.

Browser DEBUG increases future captured browser instrumentation only; it cannot recover past logs or increase server verbosity. Server UNDONE_LOG_LEVEL is private deployment configuration. On-site diagnostics exposes only the current owner's latest 20 run IDs, statuses, timestamps and safe error categories. It never exports prompts, transcripts, raw exceptions, SQL or other users' logs. Existing browser console logger APIs remain local diagnostics. Raw server log streaming/admin access is outside this scope.

## B. Requirements map

| Requirement | Steps | Checks |
|---|---|---|
| Root-mounted top-right accessible notifications | S1–S6 | V1,V3 |
| Creation errors stop displacing page content | S7–S18 | V2,V3 |
| Drafts/busy/partial commits remain correct | unchanged handler invariants plus S7–S18 | V3 |
| Debug controls on undone.one without Vercel for own run status | S19–S23 | V2,V3 |
| Owner isolation/no sensitive server payload | S19 | V2,V3 |

No blanket promise of site-wide error migration: unrelated payment/auth/messaging screens require their own rollback semantics. They can use the root toast API after this change; do not delete all role=alert elements with a search/replace.

## C. File-change manifest

- Replace `src/client/components/global/Toast/ToastProvider.tsx`: S1.
- Replace `src/client/components/global/Toast/Toast.module.css`: S2.
- Modify `src/client/components/global/Toast/Toast.tsx`: S3.
- Modify `src/app/layout.tsx`: S4, S5, S6.
- Create `src/client/hooks/useFailureToast.ts`: S7.
- Modify `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx`: S80, S9, S10, S11.
- Modify `src/client/screens/cohortBuilder/ChatPane.tsx`: S81, S12, S13, S14.
- Modify `src/client/screens/cohortBuilder/CohortIntakeScreen.tsx`: S82, S15, S16.
- Modify `src/client/screens/cohortBuilder/components/ReleasePanel.tsx`: S83, S17, S18.
- Create `src/app/api/cohort-builder/workspaces/[workspaceId]/diagnostics/route.ts`: S19.
- Replace `src/client/providers/DevLoggerInit.tsx`: S20.
- Create `src/client/providers/Diagnostics.module.css`: S21.
- Modify `src/shared/lib/dev-logger.ts`: S22, S23.

- Replace `src/client/screens/cohortBuilder/__tests__/intake-screen.test.tsx`: T1.
- Replace `src/client/components/global/LearningPromptBar/__tests__/LearningPromptBar.test.tsx`: T2.
- Create `src/client/components/global/Toast/__tests__/ToastProvider.test.tsx`: T3.
- Create `src/app/api/cohort-builder/workspaces/[workspaceId]/diagnostics/__tests__/route.test.ts`: T4.
No dependency/lockfile/schema changes. Build may regenerate package dist and Prisma client; inspect incidental diffs.

## D. Ordered payloads

### S1 — `src/client/components/global/Toast/ToastProvider.tsx`

Replace whole file; raw-byte SHA256 `86bc89ee9e94ac5d9e33116eb714128baa0a9b4564cce3d521477db3e85d4d06`.

```tsx
'use client';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toast } from './Toast';
import styles from './Toast.module.css';
export interface ToastItem { id: string; type: 'success' | 'error' | 'info'; message: string; duration?: number; expiresAt?: number }
interface ToastContextValue { toasts: ToastItem[]; addToast: (toast: Omit<ToastItem, 'id'>) => void }
export const ToastContext = createContext<ToastContextValue | undefined>(undefined);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  useEffect(() => setMounted(true), []);
  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const duration = toast.duration ?? (toast.type === 'error' ? 0 : 5000);
    const item = { ...toast, duration, id: crypto.randomUUID(), expiresAt: duration > 0 ? Date.now() + duration : undefined };
    setToasts(current => [...current.filter(t => t.type !== item.type || t.message !== item.message), item].slice(-3));
  }, []);
  const remove = useCallback((id: string) => setToasts(current => current.filter(t => t.id !== id)), []);
  useEffect(() => {
    const timers = toasts.filter(t => t.expiresAt !== undefined).map(t => setTimeout(() => remove(t.id), Math.max(0, t.expiresAt! - Date.now())));
    return () => timers.forEach(clearTimeout);
  }, [toasts, remove]);
  const value = useMemo(() => ({ toasts, addToast }), [toasts, addToast]);
  return <ToastContext.Provider value={value}>{children}{mounted && createPortal(
    <aside className={styles.portal} aria-label="Notifications">{toasts.map(item => <Toast key={item.id} item={item} onClose={() => remove(item.id)} />)}</aside>, document.body
  )}</ToastContext.Provider>;
}
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S2 — `src/client/components/global/Toast/Toast.module.css`

Replace whole file; raw-byte SHA256 `1193eef4d01844cb544c3151d72bad0207ead07586117a13aa02fb565313e93d`.

```css
.portal { position: fixed; top: max(16px, env(safe-area-inset-top)); right: max(16px, env(safe-area-inset-right)); width: min(380px, calc(100vw - 32px)); display: grid; gap: 10px; z-index: 10000; pointer-events: none; }
.toast { display: flex; align-items: flex-start; gap: 10px; padding: 14px; border-radius: 12px; background: #242424; color: #fafafa; border: 1px solid #454545; box-shadow: 0 8px 28px #0003; font-size: 14px; line-height: 1.5; pointer-events: auto; }
.type-error { border-left: 3px solid #f87171; }
.type-success { border-left: 3px solid #4ade80; }
.type-info { border-left: 3px solid #93c5fd; }
.icon { flex-shrink: 0; padding-top: 2px; }
.message { flex: 1; min-width: 0; overflow-wrap: anywhere; white-space: normal; }
.closeButton { flex-shrink: 0; border: 0; background: transparent; color: inherit; min-width: 32px; min-height: 32px; font-size: 22px; cursor: pointer; }
.closeButton:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
@media (max-width: 600px) { .closeButton { min-width: 44px; min-height: 44px; } }
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S3 — `src/client/components/global/Toast/Toast.tsx`

Replace exactly once.

Original:

```text
      role="status"
      aria-live="polite"
```

Replacement:

```text
      role={item.type === 'error' ? 'alert' : 'status'}
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S4 — `src/app/layout.tsx`

Replace exactly once.

Original:

```text
import { DevLoggerInit } from '@/src/client/providers/DevLoggerInit';
```

Replacement:

```text
import { DevLoggerInit } from '@/src/client/providers/DevLoggerInit';
import { ToastProvider } from '@/src/client/components/global/Toast/ToastProvider';
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S5 — `src/app/layout.tsx`

Replace exactly once.

Original:

```text
          <DevLoggerInit />
```

Replacement:

```text
          <ToastProvider>
          <DevLoggerInit />
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S6 — `src/app/layout.tsx`

Replace exactly once.

Original:

```text
        </SessionProvider>
```

Replacement:

```text
          </ToastProvider>
        </SessionProvider>
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S7 — `src/client/hooks/useFailureToast.ts`

Create complete file; target must not exist unless identical.

```typescript
'use client';
import { useContext, useEffect, useRef } from 'react';
import { ToastContext } from '@/src/client/components/global/Toast/ToastProvider';
import { devLogger } from '@/src/shared/lib/dev-logger';
/** Error state owns retries; this hook only presents a safe message, once per transition. */
export function useFailureToast(error: string | null | undefined, message: string, component: string) {
  const context = useContext(ToastContext);
  const last = useRef<string | null>(null);
  const add = context?.addToast;
  useEffect(() => {
    if (!error) { last.current = null; return; }
    if (last.current === error || !add) return;
    last.current = error;
    devLogger.error(component, 'operation_failed');
    devLogger.debug(component, 'failure_notification', { category: 'action', recoverable: true });
    add({ type: 'error', message, duration: 0 });
  }, [error, message, component, add]);
}
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S80 — `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx`

Replace exactly once.

Original:

```text
'use client';
```

Replacement:

```text
'use client';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S81 — `src/client/screens/cohortBuilder/ChatPane.tsx`

Replace exactly once.

Original:

```text
'use client';
```

Replacement:

```text
'use client';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S82 — `src/client/screens/cohortBuilder/CohortIntakeScreen.tsx`

Replace exactly once.

Original:

```text
'use client';
```

Replacement:

```text
'use client';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S83 — `src/client/screens/cohortBuilder/components/ReleasePanel.tsx`

Replace exactly once.

Original:

```text
'use client';
```

Replacement:

```text
'use client';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S9 — `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx`

Replace exactly once.

Original:

```text
    const displayedError = intakeError || latestComposerError;
```

Replacement:

```text
    const displayedError = intakeError || latestComposerError;
    useFailureToast(displayedError, 'Could not complete your request. Your input is kept. Review attachments or retry.', 'LearningPromptBar');
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S10 — `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx`

Replace exactly once.

Original:

```text
        {displayedError && (
          <div className={styles.intakeErrorBanner} role="alert">
            <AlertCircle size={18} className={styles.intakeErrorIcon} aria-hidden="true" />
            <span className={styles.intakeErrorText}>{displayedError}</span>
            <button
              type="button"
              className={styles.intakeErrorDismiss}
              onClick={() => setIntakeError('')}
              aria-label="Dismiss error"
            >
              <X size={15} />
            </button>
          </div>
        )}

```

Replacement:

```text

```

Postcondition: supplied payload is present; preserve all unrelated code.

### S11 — `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx`

Replace exactly once.

Original:

```text
  AlertCircle,

```

Replacement:

```text

```

Postcondition: supplied payload is present; preserve all unrelated code.

### S12 — `src/client/screens/cohortBuilder/ChatPane.tsx`

Replace exactly once.

Original:

```text
  const [sendError, setSendError] = useState('');
```

Replacement:

```text
  const [sendError, setSendError] = useState('');
  useFailureToast(sendError, 'Could not send. Your draft is kept; retry when ready.', 'ChatSend');
  useFailureToast(cancelError, 'Could not confirm Stop. Check the current run before retrying.', 'ChatStop');
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S13 — `src/client/screens/cohortBuilder/ChatPane.tsx`

Replace exactly once.

Original:

```text
        {activity.turns.some(turn => turn.status === 'failed' || turn.status === 'canceled') && (
          <p className={styles.chatAlertRow}>Stopped or failed turns remain saved. Send a follow-up to retry the intended change.</p>
        )}

        {sendError && <p role="alert">{sendError}</p>}
        {cancelError && (
          <div className={styles.chatAlertRow} role="alert">
            <span>{cancelError}</span>
          </div>
        )}

```

Replacement:

```text

```

Postcondition: supplied payload is present; preserve all unrelated code.

### S14 — `src/client/screens/cohortBuilder/ChatPane.tsx`

Replace exactly once.

Original:

```text
  const activity = useAssistantActivity();
```

Replacement:

```text
  const activity = useAssistantActivity();
  const previousRuns = useRef(new Map<string, string>());
  const [runFailure, setRunFailure] = useState('');
  useFailureToast(runFailure, 'The assistant could not finish. Saved changes remain; send a follow-up to continue.', 'AssistantRun');
  useEffect(() => {
    for (const turn of activity.turns) {
      if (!turn.runId) continue;
      const previous = previousRuns.current.get(turn.runId);
      if (previous && previous !== 'failed' && turn.status === 'failed') setRunFailure(turn.runId);
      previousRuns.current.set(turn.runId, turn.status);
    }
  }, [activity.turns]);
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S15 — `src/client/screens/cohortBuilder/CohortIntakeScreen.tsx`

Replace exactly once.

Original:

```text
  const [error, setError] = useState('');
```

Replacement:

```text
  const [error, setError] = useState('');
  useFailureToast(error, 'Could not confirm creation. Your saved input is kept; use Retry to check again.', 'CohortIntake');
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S16 — `src/client/screens/cohortBuilder/CohortIntakeScreen.tsx`

Replace exactly once.

Original:

```text
                  <div className={styles.noticeError} role="alert" style={{ marginBottom: '20px' }}>
                    <p>Could not save: {error}. Your input is retained; retry when available.</p>
                  </div>
```

Replacement:

```text

```

Postcondition: supplied payload is present; preserve all unrelated code.

### S17 — `src/client/screens/cohortBuilder/components/ReleasePanel.tsx`

Replace exactly once.

Original:

```text
  const [releaseError, setReleaseError] = useState<string | null>(null);
```

Replacement:

```text
  const [releaseError, setReleaseError] = useState<string | null>(null);
  useFailureToast(releaseError, 'Could not confirm release. Your draft and settings are kept. Check its status before retrying.', 'Release');
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S18 — `src/client/screens/cohortBuilder/components/ReleasePanel.tsx`

Replace exactly once.

Original:

```text
      {releaseError && (
        <div className={styles.blockersContainer} role="alert">
          <h4 className={styles.blockersTitle}>
            <AlertCircle size={15} />
            Release Error
          </h4>
          <p className={styles.releaseErrorText}>{releaseError}</p>
        </div>
      )}

```

Replacement:

```text

```

Postcondition: supplied payload is present; preserve all unrelated code.

### S19 — `src/app/api/cohort-builder/workspaces/[workspaceId]/diagnostics/route.ts`

Create complete file; target must not exist unless identical.

```typescript
import { z } from 'zod';
import { getCreationOwner } from '@/src/server/infrastructure/auth/getCreationOwner';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(_request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const headers = { 'Cache-Control': 'private, no-store' };
  const ownerId = await getCreationOwner();
  if (!ownerId || !z.uuid().safeParse(workspaceId).success) return Response.json({ code: 'NOT_FOUND' }, { status: 404, headers });
  try {
    const runs = await prisma.$queryRaw<Array<{ id: string; status: string; createdAt: Date; updatedAt: Date; category: string | null }>>`
      SELECT r.id, r.status, r."createdAt", r."updatedAt",
        CASE WHEN r.error IS NULL THEN NULL
          WHEN r.error ILIKE '%high demand%' OR r.error ILIKE '%503%' THEN 'PROVIDER_BUSY'
          WHEN r.error ILIKE '%timeout%' OR r.error ILIKE '%abort%' THEN 'TIMEOUT_OR_CANCEL'
          ELSE 'RUN_FAILED' END AS category
      FROM interaction_runs r JOIN interaction_workspaces w ON w.id=r."workspaceId"
      WHERE w.id=${workspaceId} AND w."ownerId"=${ownerId}
      ORDER BY r."createdAt" DESC LIMIT 20`;
    const owned = await prisma.interactionWorkspace.findFirst({ where: { id: workspaceId, ownerId }, select: { id: true } });
    if (!owned) return Response.json({ code: 'NOT_FOUND' }, { status: 404, headers });
    return Response.json({ runs }, { headers });
  } catch {
    return Response.json({ code: 'DIAGNOSTICS_UNAVAILABLE' }, { status: 503, headers });
  }
}
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S20 — `src/client/providers/DevLoggerInit.tsx`

Replace whole file; raw-byte SHA256 `acde33fcd207e98ede2d7fe2dad39e719f2271f4dd62d58f7fa6b34efe00bde1`.

```tsx
'use client';
import { useEffect, useState } from 'react';
import { devLogger, type UndoneLogLevel, type StoredLogEntry } from '@/src/shared/lib/dev-logger';
import styles from './Diagnostics.module.css';
const levels: UndoneLogLevel[] = ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG'];
export function DevLoggerInit() {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<UndoneLogLevel>('INFO');
  const [logs, setLogs] = useState<StoredLogEntry[]>([]);
  const [runs, setRuns] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const enabled = new URLSearchParams(location.search).get('debug') === '1';
    setOpen(enabled);
    if (enabled) { devLogger.setLevel('DEBUG'); setLevel('DEBUG'); }
    devLogger.info('Browser', 'client_initialized');
  }, []);
  useEffect(() => {
    if (!open) return;
    const tick = () => setLogs(devLogger.getRecentLogs({ limit: 100 }));
    tick(); const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [open]);
  async function refreshRuns() {
    const workspaceId = location.pathname.match(/^\/quest\/build\/([a-f0-9-]{36})$/i)?.[1];
    if (!workspaceId) { setRuns('Open a workspace to inspect its runs.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/cohort-builder/workspaces/' + workspaceId + '/diagnostics', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Run diagnostics unavailable (' + response.status + ').');
      setRuns(JSON.stringify(await response.json(), null, 2));
    } catch (error) { setRuns(error instanceof Error ? error.message : 'Diagnostics unavailable.'); }
    finally { setBusy(false); }
  }
  if (!open) return null;
  return <section className={styles.panel} aria-label="Diagnostics">
    <header><strong>Diagnostics</strong><button type="button" onClick={() => setOpen(false)}>Close</button></header>
    <p>Browser logging level; server runs below are saved status summaries, not live process logs.</p>
    <label>Capture level <select value={level} onChange={event => { const value = event.target.value as UndoneLogLevel; setLevel(value); devLogger.setLevel(value); }}>
      {levels.map(value => <option key={value}>{value}</option>)}
    </select></label>
    <button type="button" onClick={() => { devLogger.disable(); setOpen(false); }}>Disable debugging</button>
    <button type="button" onClick={() => { devLogger.clear(); setLogs([]); }}>Clear browser buffer</button>
    <button type="button" disabled={busy} onClick={() => void refreshRuns()}>Refresh owned workspace runs</button>
    <pre>{runs}</pre>
    <p>Last 100 browser events; extra data omitted. Full local details remain available through window.__UNDONE_LOGGER__ in your console.</p>
    <pre>{logs.map(log => log.timestamp + ' ' + log.level + ' [' + log.tag + '] ' + log.message.slice(0, 500)).join('\n')}</pre>
  </section>;
}
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S21 — `src/client/providers/Diagnostics.module.css`

Create complete file; target must not exist unless identical.

```css
.panel { position: fixed; bottom: max(16px, env(safe-area-inset-bottom)); right: 16px; width: min(640px, calc(100vw - 32px)); max-height: 55vh; overflow: auto; z-index: 9999; padding: 16px; border: 1px solid #555; border-radius: 12px; background: #181818; color: #fafafa; font: 13px/1.5 monospace; }
.panel header { display: flex; justify-content: space-between; gap: 12px; }
.panel button, .panel select { min-height: 36px; padding: 6px 10px; margin: 4px; background: #333; color: #fff; border: 1px solid #777; border-radius: 5px; }
.panel pre { white-space: pre-wrap; overflow-wrap: anywhere; }
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S22 — `src/shared/lib/dev-logger.ts`

Replace exactly once.

Original:

```text
    this.currentLevel = level;
```

Replacement:

```text
    if (!(level in LEVEL_MAP)) return;
    this.currentLevel = level;
```

Postcondition: supplied payload is present; preserve all unrelated code.

### S23 — `src/shared/lib/dev-logger.ts`

Replace exactly once.

Original:

```text
        const storedLevel = (localStorage.getItem('UNDONE_LOG_LEVEL') as UndoneLogLevel) || 'DEBUG';
```

Replacement:

```text
        const stored = localStorage.getItem('UNDONE_LOG_LEVEL');
        const storedLevel = stored && stored in LEVEL_MAP ? stored as UndoneLogLevel : 'DEBUG';
```

Postcondition: supplied payload is present; preserve all unrelated code.

### T1 — src/client/screens/cohortBuilder/__tests__/intake-screen.test.tsx

Replace whole file; verify SHA256 `65863973e9ea6bf5a161d60b1b446a428df73d6bd96d26868b77102e6e631c16`.

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render as testingRender, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

import { ToastProvider } from '@/src/client/components/global/Toast/ToastProvider';
const render = (ui: React.ReactNode) => testingRender(<ToastProvider>{ui}</ToastProvider>);
import { CohortIntakeScreen } from '../CohortIntakeScreen';
import { saveIntakeDraft } from '../intake-draft';

const draft = {
  requestId: '54103d7b-2709-4dd6-bb18-522f96b97241',
  prompt: 'Learn distributed systems',
  mode: 'search' as const,
};

let assignMock = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
  assignMock = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      href: 'http://localhost:3000/',
      assign: assignMock,
    },
    writable: true,
  });
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

it('submits valid intake and assigns location on success', async () => {
  saveIntakeDraft(draft, 'owner-1');
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ workspaceId: 'ws-12345' }),
  });
  global.fetch = fetchMock;

  render(<CohortIntakeScreen ownerId="owner-1" enabled={true} />);

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/cohort-builder/intake',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, expectedOwnerId: 'owner-1' }),
      })
    );
    expect(assignMock).toHaveBeenCalledWith('/quest/build/ws-12345');
  });
});

it('retains failed intake without sending the user to the legacy creator', async () => {
  saveIntakeDraft(draft, 'owner-1');
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ code: 'DURABLE_DRIVER_REQUIRED' }),
  });

  render(<CohortIntakeScreen ownerId="owner-1" enabled={true} />);

  await waitFor(() => {
    expect(screen.getByRole('alert').textContent).toContain('Could not confirm creation. Your saved input is kept; use Retry to check again.');
    expect(screen.queryByRole('link', { name: /existing creator/i })).toBeNull();
  });
});

it('displays error and does NOT offer legacy alternative when draft has source text', async () => {
  const draftWithSource = {
    ...draft,
    source: {
      label: 'Pasted text',
      text: 'Specialized source text research notes',
    },
  };
  saveIntakeDraft(draftWithSource, 'owner-1');
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ code: 'DURABLE_DRIVER_REQUIRED' }),
  });

  render(<CohortIntakeScreen ownerId="owner-1" enabled={true} />);

  await waitFor(() => {
    expect(screen.getByRole('alert').textContent).toContain('Could not confirm creation. Your saved input is kept; use Retry to check again.');
    expect(screen.getByText(/Retained text: Pasted text/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /continue with existing creator/i })).toBeNull();
  });
});

it('displays disabled notice and preserved prompt without a legacy detour', () => {
  saveIntakeDraft(draft, 'owner-1');

  render(<CohortIntakeScreen ownerId="owner-1" enabled={false} />);

  expect(
    screen.getByText('New builder intake is unavailable. Existing workspaces remain accessible.')
  ).toBeTruthy();
  expect(screen.getAllByText('Learn distributed systems').some(el => el.closest('blockquote'))).toBe(true);
  expect(screen.queryByRole('link', { name: /existing creator/i })).toBeNull();
  expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Return to landing' }).getAttribute('href')).toBe('/#explore');
});

it('retains and displays pasted text label and character count, explains incompatibility, and does NOT offer legacy link when intake is disabled with source text', () => {
  const draftWithSource = {
    ...draft,
    source: {
      label: 'Pasted text',
      text: 'Detailed source text to preserve',
    },
  };
  saveIntakeDraft(draftWithSource, 'owner-1');

  render(<CohortIntakeScreen ownerId="owner-1" enabled={false} />);

  expect(
    screen.getByText('New builder intake is unavailable. Existing workspaces remain accessible.')
  ).toBeTruthy();
  expect(screen.getAllByText('Learn distributed systems').some(el => el.closest('blockquote'))).toBe(true);
  expect(screen.getByText(/Retained text: Pasted text/)).toBeTruthy();
  expect(
    screen.getByText('Your input is retained for the new builder. Please retry when creation is available.')
  ).toBeTruthy();
  expect(screen.queryByRole('link', { name: /continue with existing creator/i })).toBeNull();
  expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Return to landing' }).getAttribute('href')).toBe('/#explore');
});

it('clears draft when discard is clicked in enabled state', async () => {
  saveIntakeDraft(draft, 'owner-1');
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ code: 'DURABLE_DRIVER_REQUIRED' }),
  });

  render(<CohortIntakeScreen ownerId="owner-1" enabled={true} />);

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

  expect(screen.getByRole('textbox', { name: 'What do you want to learn about?' })).toBeTruthy();
  expect(sessionStorage.getItem('undone:cohort-intake')).toBeNull();
});

it('clears draft when discard is clicked in disabled state', () => {
  saveIntakeDraft(draft, 'owner-1');

  render(<CohortIntakeScreen ownerId="owner-1" enabled={false} />);

  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

  expect(screen.getByText(/No pending input/)).toBeTruthy();
  expect(sessionStorage.getItem('undone:cohort-intake')).toBeNull();
});

// Use the production notification boundary without changing any draft assertions.

```

### T2 — src/client/components/global/LearningPromptBar/__tests__/LearningPromptBar.test.tsx

Replace whole file; verify SHA256 `4fc82aa4b1a3318042e0a45f6a6ff0bad1ba6280087d27a2b185028f265ca641`.

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

import { ToastProvider } from '@/src/client/components/global/Toast/ToastProvider';
const render = (ui: React.ReactNode) => testingRender(<ToastProvider>{ui}</ToastProvider>);
import { render as testingRender, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import ReactDOMServer from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'test-user-123' } }, status: 'authenticated' }),
}));

import { LearningPromptBar } from '../LearningPromptBar';
import { readIntakeDraft, saveIntakeDraft } from '@/src/client/screens/cohortBuilder/intake-draft';

describe('LearningPromptBar Component (Unit B)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    pushMock.mockReset();
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders one Add link button, no Plus trigger, and no raw-text tabs', () => {
    render(<LearningPromptBar />);

    expect(screen.getByRole('button', { name: /Add link/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add sources/i })).toBeNull();
    expect(screen.queryByLabelText(/Add sources/i)).toBeNull();
    expect(screen.getByRole('button', { name: /Upload reference material/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Plan/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Begin journey/i })).toBeTruthy();

    // Expand links
    fireEvent.click(screen.getByRole('button', { name: /Add link/i }));
    expect(screen.getByRole('region', { name: 'Attached links' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Paste raw text/i })).toBeNull();
  });

  it('toggling Plan mode on and off performs zero network fetches', () => {
    render(<LearningPromptBar />);
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Distributed Systems Paxos' } });

    const planBtn = screen.getByRole('button', { name: /Plan/i });
    expect(planBtn.getAttribute('aria-pressed')).toBe('false');

    // Toggle on
    fireEvent.click(planBtn);
    expect(planBtn.getAttribute('aria-pressed')).toBe('true');
    expect(fetchMock).not.toHaveBeenCalled();

    // Toggle off
    fireEvent.click(planBtn);
    expect(planBtn.getAttribute('aria-pressed')).toBe('false');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('default primary submit sends search mode once, while primary after Plan sends plan mode once', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ workspaceId: 'ws-search-1' }),
    });

    const { unmount } = render(<LearningPromptBar />);
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Learning Rust' } });

    // Submit with search
    fireEvent.click(screen.getByRole('button', { name: /Begin journey/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const searchCallBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(searchCallBody.mode).toBe('search');
    expect(searchCallBody.prompt).toBe('Learning Rust');

    unmount();
    fetchMock.mockClear();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ workspaceId: 'ws-plan-1' }),
    });

    render(<LearningPromptBar />);
    const input2 = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input2, { target: { value: 'Learning Compilers' } });

    // Toggle plan mode
    fireEvent.click(screen.getByRole('button', { name: /Plan/i }));
    fireEvent.click(screen.getByRole('button', { name: /Start planning/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const planCallBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(planCallBody.mode).toBe('plan');
    expect(planCallBody.prompt).toBe('Learning Compilers');
  });

  it('prevents double synchronous submit before rerender', async () => {
    fetchMock.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({
      ok: true,
      json: async () => ({ workspaceId: 'ws-slow-1' }),
    }), 50)));

    render(<LearningPromptBar />);
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Concurrent click test' } });

    const beginBtn = screen.getByRole('button', { name: /Begin journey/i });
    // Click twice synchronously
    fireEvent.click(beginBtn);
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it('Shift+Enter remains explicit plan submission', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ workspaceId: 'ws-shift-enter' }),
    });

    render(<LearningPromptBar />);
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Keyboard Shortcut Plan' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.mode).toBe('plan');
    expect(callBody.prompt).toBe('Keyboard Shortcut Plan');
  });

  it('Enter inside link rows does not submit intake and close/reopen retains links', () => {
    render(<LearningPromptBar />);

    // Open links
    fireEvent.click(screen.getByRole('button', { name: /Add link/i }));
    const urlInput = screen.getByLabelText('Add link URL');
    fireEvent.change(urlInput, { target: { value: 'https://example.com/doc' } });
    fireEvent.keyDown(urlInput, { key: 'Enter' });

    // Intake fetch was NOT called
    expect(fetchMock).not.toHaveBeenCalled();

    // Link is added in DOM
    expect(screen.getByText('example.com/doc')).toBeTruthy();

    // Close links
    fireEvent.click(screen.getByLabelText('Close link input'));
    expect(screen.queryByRole('region', { name: 'Attached links' })).toBeNull();

    // Reopen links -> link remains attached
    fireEvent.click(screen.getByRole('button', { name: /Add link/i }));
    expect(screen.getByText('example.com/doc')).toBeTruthy();
  });

  it('timeout re-enables retry with identical requestId, while changing prompt changes requestId', async () => {
    // 1. Timeout attempt
    fetchMock.mockRejectedValueOnce(new DOMException('The operation timed out', 'TimeoutError'));

    render(<LearningPromptBar />);
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Retry identity test' } });

    const beginBtn = screen.getByRole('button', { name: /Begin journey/i });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(screen.getByText('Could not complete your request. Your input is kept. Review attachments or retry.')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstReqId = JSON.parse(fetchMock.mock.calls[0][1].body).requestId;
    expect(firstReqId).toBeTruthy();

    // 2. Retry click with same prompt fails again or returns 500
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    fireEvent.click(beginBtn);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    const secondReqId = JSON.parse(fetchMock.mock.calls[1][1].body).requestId;
    expect(secondReqId).toBe(firstReqId);
    expect(readIntakeDraft('test-user-123')?.requestId).toBe(firstReqId);

    // 3. Change prompt -> requestId changes
    fireEvent.change(input, { target: { value: 'Brand new prompt inquiry' } });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workspaceId: 'ws-new-prompt' }),
    });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    const thirdReqId = JSON.parse(fetchMock.mock.calls[2][1].body).requestId;
    expect(thirdReqId).not.toBe(firstReqId);
    expect(readIntakeDraft('test-user-123')?.requestId).toBe(thirdReqId);
  });

  it('request identity matches storage across retries, remounts, and payload variations', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));
    const getIntakeCalls = () => fetchMock.mock.calls.filter((call) => call[0] === '/api/cohort-builder/intake');

    // 1. Initial submission
    const { unmount, rerender } = render(<LearningPromptBar />);
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Identical payload goal' } });

    const beginBtn = screen.getByRole('button', { name: /Begin journey/i });
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(getIntakeCalls()).toHaveLength(1);
    });
    const req1 = JSON.parse(getIntakeCalls()[0][1].body).requestId;
    expect(readIntakeDraft('test-user-123')?.requestId).toBe(req1);

    // 2. Rerender between retries
    rerender(<LearningPromptBar />);
    fireEvent.click(beginBtn);

    await waitFor(() => {
      expect(getIntakeCalls()).toHaveLength(2);
    });
    const req2 = JSON.parse(getIntakeCalls()[1][1].body).requestId;
    expect(req2).toBe(req1);
    expect(readIntakeDraft('test-user-123')?.requestId).toBe(req1);

    // 3. Unmount and remount identical draft
    unmount();
    const { unmount: unmount2 } = render(<LearningPromptBar />);
    await waitFor(() => {
      const el = screen.getByLabelText('What do you want to learn about?') as HTMLTextAreaElement;
      expect(el.value).toBe('Identical payload goal');
    });
    fireEvent.click(screen.getByRole('button', { name: /Begin journey/i }));

    await waitFor(() => {
      expect(getIntakeCalls()).toHaveLength(3);
    });
    const req3 = JSON.parse(getIntakeCalls()[2][1].body).requestId;
    expect(req3).toBe(req1);
    expect(readIntakeDraft('test-user-123')?.requestId).toBe(req1);

    // 4. Same prompt but changed mode -> new requestId
    fireEvent.click(screen.getByRole('button', { name: /^Plan$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Start planning/i }));

    await waitFor(() => {
      expect(getIntakeCalls()).toHaveLength(4);
    });
    const req4 = JSON.parse(getIntakeCalls()[3][1].body).requestId;
    expect(req4).not.toBe(req1);
    expect(readIntakeDraft('test-user-123')?.requestId).toBe(req4);

    // 5. Change prompt text on mounted input -> new requestId
    const mountedInput = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(mountedInput, { target: { value: 'A completely different learning direction' } });
    fireEvent.click(screen.getByRole('button', { name: /Start planning/i }));
    await waitFor(() => {
      expect(getIntakeCalls()).toHaveLength(5);
    });
    const req5 = JSON.parse(getIntakeCalls()[4][1].body).requestId;
    expect(req5).not.toBe(req4);
    expect(readIntakeDraft('test-user-123')?.requestId).toBe(req5);

    unmount2();
  });

  it('renders legacy attached text with preview and remove button', () => {
    saveIntakeDraft(
      {
        requestId: '00000000-0000-4000-8000-000000000001',
        prompt: 'Legacy test',
        mode: 'search',
        source: { label: 'Pasted text', text: 'Old legacy notes about algorithms' },
      },
      'test-user-123'
    );

    render(<LearningPromptBar />);
    expect(screen.getByText('Previously attached text')).toBeTruthy();
    expect(screen.getByText('Old legacy notes about algorithms')).toBeTruthy();

    const removeBtn = screen.getByRole('button', { name: 'Remove previously attached text' });
    fireEvent.click(removeBtn);

    expect(screen.queryByText('Previously attached text')).toBeNull();
  });

  it('413 retains draft and displays friendly error', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => ({ code: 'INPUT_TOO_LARGE' }),
    });

    render(<LearningPromptBar />);
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'Large draft test' } });

    fireEvent.click(screen.getByRole('button', { name: /Begin journey/i }));

    await waitFor(() => {
      expect(screen.getByText(/exceeds the 3.5MB server limit/i)).toBeTruthy();
    });

    const draft = readIntakeDraft('test-user-123');
    expect(draft).not.toBeNull();
    expect(draft?.prompt).toBe('Large draft test');
  });

  it('restores ready source in StrictMode and preserves user removal across rerenders', async () => {
    saveIntakeDraft({
      requestId: '00000000-0000-4000-8000-000000000002',
      prompt: 'Persisted StrictMode Goal',
      mode: 'plan',
      sources: [{
        id: 'persisted-link-1',
        version: 1,
        label: 'https://example.com/strict',
        text: 'Strict mode guide text',
        locations: [{ start: 0, end: 23 }],
        checksum: 'a'.repeat(64),
        state: 'ready',
      }],
    }, 'test-user-123');

    const { rerender } = render(
      <React.StrictMode>
        <LearningPromptBar />
      </React.StrictMode>
    );

    // Initial post-hydration restore displays link and plan button
    await waitFor(() => {
      expect(screen.getByText('example.com/strict')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /^Plan$/i }).getAttribute('aria-pressed')).toBe('true');

    // Type into prompt
    const input = screen.getByLabelText('What do you want to learn about?');
    fireEvent.change(input, { target: { value: 'User edited prompt' } });

    // Toggle Plan off
    fireEvent.click(screen.getByRole('button', { name: /^Plan$/i }));
    expect(screen.getByRole('button', { name: /^Plan$/i }).getAttribute('aria-pressed')).toBe('false');

    // Rerender with same props
    rerender(
      <React.StrictMode>
        <LearningPromptBar />
      </React.StrictMode>
    );
    expect((input as HTMLTextAreaElement).value).toBe('User edited prompt');
    expect(screen.getByRole('button', { name: /^Plan$/i }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText('example.com/strict')).toBeTruthy();

    // Remove source and rerender
    const removeBtn = screen.getByLabelText(/Remove link/i);
    fireEvent.click(removeBtn);
    expect(screen.queryByText('example.com/strict')).toBeNull();

    rerender(
      <React.StrictMode>
        <LearningPromptBar />
      </React.StrictMode>
    );
    expect(screen.queryByText('example.com/strict')).toBeNull();
  });

  it('controlled value remains parent-owned without firing onChange on mount', async () => {
    saveIntakeDraft({
      requestId: '00000000-0000-4000-8000-000000000003',
      prompt: 'Draft stored prompt',
      mode: 'search',
    }, 'test-user-123');

    const onChange = vi.fn();
    render(<LearningPromptBar value="Controlled Prompt Value" onChange={onChange} />);

    await waitFor(() => {
      const input = screen.getByLabelText('What do you want to learn about?');
      expect((input as HTMLTextAreaElement).value).toBe('Controlled Prompt Value');
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('survives throwing storage without crashing and renders usable empty composer', () => {
    const originalGetItem = window.sessionStorage.getItem;
    window.sessionStorage.getItem = () => { throw new Error('Storage disabled'); };

    try {
      render(<LearningPromptBar />);
      expect(screen.getByLabelText('What do you want to learn about?')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Begin journey/i })).toBeTruthy();
    } finally {
      window.sessionStorage.getItem = originalGetItem;
    }
  });

  it('hydrates server-rendered HTML cleanly without mismatch errors when client storage has draft', async () => {
    // 1. Obtain server HTML before seeding browser storage
    const serverHtml = ReactDOMServer.renderToString(<LearningPromptBar />);

    // 2. Seed draft in browser storage
    saveIntakeDraft({
      requestId: '00000000-0000-4000-8000-000000000004',
      prompt: 'Hydration goal from storage',
      mode: 'plan',
      source: { label: 'Pasted text', text: 'Hydration legacy text' },
      sources: [{
        id: 'hydrate-src-1',
        version: 1,
        label: 'https://example.com/hydrate',
        text: 'Hydrate source text',
        locations: [{ start: 0, end: 19 }],
        checksum: 'b'.repeat(64),
        state: 'ready',
      }],
    }, 'test-user-123');

    const recoverableErrors: unknown[] = [];
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      const msg = args.join(' ');
      if (msg.includes('Hydration') || msg.includes('hydrat')) {
        recoverableErrors.push(msg);
      }
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = serverHtml;

    let root: ReturnType<typeof hydrateRoot> | null = null;
    await act(async () => {
      root = hydrateRoot(container, <LearningPromptBar />, {
        onRecoverableError: (err) => {
          recoverableErrors.push(err);
        },
      });
    });

    try {
      // Must have zero hydration errors
      expect(recoverableErrors).toHaveLength(0);

      // Post-hydration effect populates restored UI
      await waitFor(() => {
        expect(screen.getByText('Hydration legacy text')).toBeTruthy();
      });
      expect(screen.getByText('example.com/hydrate')).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Plan$/i }).getAttribute('aria-pressed')).toBe('true');
    } finally {
      consoleErrorSpy.mockRestore();
      if (root) {
        await act(async () => {
          root?.unmount();
        });
      }
      container.remove();
    }
  });
});

// Use the production notification boundary without changing any draft assertions.

```

### T3 — src/client/components/global/Toast/__tests__/ToastProvider.test.tsx

Create; target must be absent or identical.

```tsx
// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ToastProvider } from '../ToastProvider';
import { useToast } from '@/src/client/hooks/useToast';
import { useFailureToast } from '@/src/client/hooks/useFailureToast';
function Controls() { const toast = useToast(); return <><button onClick={() => toast.info('First', 1000)}>First</button><button onClick={() => toast.info('Second', 2000)}>Second</button><button onClick={() => toast.error('Failed')}>Fail</button></>; }
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('expires from original creation time and keeps errors dismissible', () => {
  vi.useFakeTimers(); render(<ToastProvider><Controls /></ToastProvider>);
  fireEvent.click(screen.getByText('First'));
  act(() => vi.advanceTimersByTime(500)); fireEvent.click(screen.getByText('Second'));
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status').textContent).toContain('Second');
  fireEvent.click(screen.getByText('Fail')); fireEvent.click(screen.getByText('Fail'));
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  act(() => vi.advanceTimersByTime(10000));
  expect(screen.getByRole('alert').textContent).toContain('Failed');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(screen.queryByRole('alert')).toBeNull();
});
function Failure({ error }: { error: string }) { useFailureToast(error, 'Safe failure text', 'Test'); return <input aria-label="Draft" defaultValue="Keep me" />; }
it('deduplicates renders without losing input or leaking raw error', () => {
  const view = render(<ToastProvider><Failure error="SECRET_RAW_ERROR" /></ToastProvider>);
  fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Still here' } });
  view.rerender(<ToastProvider><Failure error="SECRET_RAW_ERROR" /></ToastProvider>);
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.queryByText('SECRET_RAW_ERROR')).toBeNull();
  expect((screen.getByLabelText('Draft') as HTMLInputElement).value).toBe('Still here');
});

```

### T4 — src/app/api/cohort-builder/workspaces/[workspaceId]/diagnostics/__tests__/route.test.ts

Create; target must be absent or identical.

```typescript
import { beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ owner: vi.fn(), query: vi.fn(), find: vi.fn() }));
vi.mock('@/src/server/infrastructure/auth/getCreationOwner', () => ({ getCreationOwner: fake.owner }));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({ prisma: { $queryRaw: fake.query, interactionWorkspace: { findFirst: fake.find } } }));
import { GET } from '../route';
const id = '54103d7b-2709-4dd6-bb18-522f96b97241';
const request = () => GET(new Request('https://undone.one/api/test'), { params: Promise.resolve({ workspaceId: id }) });
beforeEach(() => { vi.resetAllMocks(); fake.owner.mockResolvedValue('owner-one'); fake.find.mockResolvedValue({ id }); fake.query.mockResolvedValue([{ id: 'run-one', status: 'failed', category: 'PROVIDER_BUSY' }]); });
it('requires authentication before querying runs', async () => { fake.owner.mockResolvedValue(null); expect((await request()).status).toBe(404); expect(fake.query).not.toHaveBeenCalled(); });
it('rejects a foreign workspace and includes ownership in SQL parameters', async () => { fake.find.mockResolvedValue(null); const response = await request(); expect(response.status).toBe(404); expect(fake.query.mock.calls[0].slice(1)).toEqual([id, 'owner-one']); expect(await response.text()).not.toContain('run-one'); });
it('returns safe owner-scoped diagnostics without caching', async () => { const response = await request(); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(await response.json()).toEqual({ runs: [{ id: 'run-one', status: 'failed', category: 'PROVIDER_BUSY' }] }); });
it('returns a safe service failure', async () => { fake.query.mockRejectedValue(new Error('database password secret')); const response = await request(); expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret'); });

```

## E. Verification and failure handling

All commands PowerShell at repository root. Proposed code has been syntax-parsed, not typechecked or run. Do not represent historical tests as tests of this change.

### V1 — toast browser checks

Start npm run dev. Trigger two independent errors, then one success. Confirm top-right position at 1440px and 375px, max three, wrap long message, keyboard dismiss, no focus movement/layout shift, error persists, success expires without extending older timers. Navigate within app while toast open: provider persists. Rendering SSR/hydration must produce no portal mismatch. Repeated identical visible errors coalesce. Verify other existing useToast consumers now work, including success/info.

### V2 — static and existing suites

Run individually:

```powershell
npx vitest run src/client/components/global/Toast/__tests__/ToastProvider.test.tsx "src/app/api/cohort-builder/workspaces/[workspaceId]/diagnostics/__tests__/route.test.ts"
npx tsc --noEmit --incremental false
npx vitest run src/shared/lib/__tests__/dev-logger.test.ts src/client/components/global/LearningPromptBar/__tests__ src/client/screens/cohortBuilder/__tests__
npm run build
git diff --check
```

Expected zero new type/build failures. T1/T2 migrate the known inline-error assertions through the real provider while retaining original retry/draft checks. T3/T4 add notification and API authorization regressions. Do not label the task complete based on manual checks alone.

### V3 — failure injection and debugging acceptance

Use local authenticated fixture and intercept network replies in browser tooling, not production user data:

- Landing intake 400/413/500 and timeout: no embedded action-error banner; text, mode, attachments retained; button reenabled; toast appears. Retry retains request ID. Invalid attachment still indicates its own state.
- Intake auto-submit failure: retry/discard controls remain; no raw server error displayed. Retry works with saved request identity.
- Chat attachment partial success followed by failure: saved attachments remain saved, message draft remains, retry does not duplicate source commits. Failed message send and failed Stop show separate safe notifications.
- Run running->failed produces one notification. Historic failed run on initial load produces none. Canceled run produces no error toast. Follow-up still possible. Saved tool edits are not rolled back.
- Release rejection/transport timeout retains selected mode, clears busy, keeps server receipt authoritative. Server-success/client-disconnect must not unpublish or create duplicate cohorts on retry. Readiness blocker controls remain.
- Open /quest/build/OWNED_ID?debug=1. Change level DEBUG; generate failure; see browser operation_failed and debug event. INFO no longer captures future DEBUG entries. Invalid stored level cannot break logger. Disable closes panel and removes stored debug setting; remove ?debug=1 before next reload to stay disabled.
- Refresh owned runs shows safe persisted status summaries. Foreign workspace ID and logged-out requests return404. Raw provider error/prompt/session fields absent; no-store headers present. DB failure gives safe503. T4 covers mocked auth/DB behavior; also verify real session ownership locally.
- Closing panel stops its one-second browser-buffer refresh. Run diagnostics fetch is manual, disabled while pending, bounded10s. Normal page visits without debug=1 have no panel/polling.

### Recovery

No database mutations/migrations added. Preserve baseline diff; reverse only this guide's changed blocks/files if rollback required. Never revert committed user operations or reset the workspace. No console/fetch monkey-patching to undo. Disable browser capture via existing logger API; remove debug=1 URL to avoid reopening panel.

## F. Completion report contract

Report applied IDs, changed files, actual check commands/results, all failure-injection outcomes, skipped checks and remaining gaps. Completion requires automated regression tests, scoped UI checks and authorization checks passing. Author inspected source and validated unique sequential anchors and TypeScript syntax only; no implementation or runtime tests performed. This is not proof of whole-site rollback coverage or complete server-log visibility.

<!-- END OF HANDOFF -->
