# Final scoped composer repair — execute this document only

Status: PLAN ONLY, 2026-10-31. Supersedes restoration/retry instructions in earlier plans. Preserve the already-correct presentation discriminator and activity SHA-256 fixes. Do not implement deferred streaming, worker redesign, new storage abstractions, dependencies, or unrelated UI changes.

## Objective and change budget

Remove render-time browser reads, restore once after hydration, make attachment restoration idempotent, and keep retry identity consistent across memory and storage. Prefer deletion: LearningPromptBar's four large initializers and repeated restoration effect should be replaced by one short effect. Production changes should be net-negative across the touched files if possible. Do not sacrifice correctness to a numeric line target; report net production lines separately from tests. No new production file is needed.

Read MEMORY/composer-and-client-extraction.md and inspect current diffs first. Preserve others' edits. Do not normalize whole files or refactor unrelated code to satisfy lint. Do not change production router handling just to accommodate a test missing its router mock.

## 1. LearningPromptBar.tsx: deterministic initialization

Replace browser-reading initializers with these declarations, retaining the other existing state:

```tsx
const [internalQuery, setInternalQuery] = useState('');
const [showSource, setShowSource] = useState(false);
const [sourceText, setSourceText] = useState('');
const [selectedMode, setSelectedMode] = useState<'search' | 'plan'>('search');
const [draftRestored, setDraftRestored] = useState(false);
const restored = useRef(false);
```

Keep controlled query derivation unchanged. No localStorage, sessionStorage, window.location, or readIntakeDraft calls in render or useState initializers. A `'use client'` declaration does not disable server prerendering.

After useComposerAttachments, extract its stable method:

```ts
const { restoreSources } = composerAttachments;
```

DELETE the current effect depending on `[composerAttachments, session?.user?.id]`, including all writes to intakeAttempt inside it. Do not memoize the entire hook return object to disguise the cycle. Use this one restoration effect instead:

```tsx
useEffect(() => {
  if (restored.current) return;
  restored.current = true;

  const read = (key: string) => {
    try { return sessionStorage.getItem(key) || localStorage.getItem(key); }
    catch { return null; }
  };
  const params = new URLSearchParams(window.location.search);
  let draft: ReturnType<typeof readIntakeDraft> = null;
  try { draft = readIntakeDraft(session?.user?.id ?? null); } catch {}
  const text = read('sidequest_prompt_source_draft') || draft?.source?.text || '';
  const prompt = params.get('q') || read('sidequest_prompt_query_draft') ||
    read('undone:landing-query') || draft?.prompt || '';
  const urlMode = params.get('mode');

  if (controlledValue === undefined) setInternalQuery(prompt);
  setSourceText(text);
  setSelectedMode(urlMode === 'plan' || urlMode === 'search'
    ? urlMode : draft?.mode ?? 'search');
  setShowSource(Boolean(text || draft?.sources?.length ||
    read('sidequest_prompt_source_visible') === 'true'));
  if (draft?.sources?.length) restoreSources(draft.sources);
  setDraftRestored(true);
}, [controlledValue, restoreSources, session?.user?.id]);
```

The ref intentionally makes restoration mount-only, including StrictMode's effect replay. Dependency changes must never overwrite edits, reopen removed attachments, or reset request identity. Existing draft/account storage policy is preserved; this patch does not claim to introduce account-isolated storage. Do not add account-change restoration without a separate design for edited drafts.

If eslint's set-state-in-effect rule rejects the explicit browser-storage synchronization, add ONE immediately scoped suppression with the explanation `Hydrate browser-only persisted draft after matching server/client initial render.` Do not move the read back into render, add arbitrary timers, or globally disable lint. Exhaustive dependency checks stay enabled.

Both persistence effects (debounce and beforeunload) must start with:

```ts
if (!draftRestored) return;
```

Add draftRestored to their dependencies. Include `!draftRestored` in isBusy and handleSubmit's early guard. This prevents the initial empty render overwriting storage or submitting before restoration. Do not disable the input itself. On the next render restored data becomes interactive.

## 2. useComposerAttachments.ts: idempotence at the actual mutation

Inside restoreSources, before iterating, create:

```ts
const knownIds = new Set([
  ...filesRef.current.map(item => item.id),
  ...linksRef.current.map(item => item.id),
]);
```

At the start of each source iteration:

```ts
if (!s.text || knownIds.has(s.id)) continue;
knownIds.add(s.id);
```

Replace the existing `if (!s.text) continue`. Retain the existing byte-budget and classification logic. Keep state writes conditional on nonempty newFiles/newLinks. Do not reserve bytes or set state for duplicate IDs. This covers duplicate IDs in one batch and repeated calls, including StrictMode. Do not persist a permanent global dedup set: removing an item should still allow an explicit future import.

Do NOT add another guard that compares serialized source arrays on every render. The component controls when restoration happens; the hook ensures repeated restoration cannot duplicate records.

## 3. Retry identity: eliminate the competing storage policy

Inspection found another inconsistency: saveIntakeDraft currently rewrites requestId when prompt/raw source match, ignoring mode and attached sources. LearningPromptBar now fingerprints all those fields. The two policies can therefore store an OLD ID while sending a NEW ID. Fix this with one identity authority, not another retry layer.

In `src/client/screens/cohortBuilder/intake-draft.ts`, DELETE the first try/catch block in saveIntakeDraft that reads a prior draft and assigns `validated.requestId`. The caller's validated requestId must be stored unchanged. Keep schema validation, owner/timestamp wrapper, quota fallback, and read expiry behavior.

In LearningPromptBar.handleSubmit, keep current contentPayload/fingerprint and in-flight ref. When intakeAttempt is null, read the saved draft once using the current ownerId and compute its candidate fingerprint with the SAME property order/content shape as contentPayload:

```ts
if (!intakeAttempt.current) {
  let saved: ReturnType<typeof readIntakeDraft> = null;
  try { saved = readIntakeDraft(ownerId); } catch {}
  if (saved) {
    const savedContent = {
      ownerId,
      prompt: saved.prompt,
      mode: saved.mode,
      ...(saved.sources?.length ? { sources: saved.sources } : {}),
      ...(saved.source ? { source: saved.source } : {}),
    };
    if (JSON.stringify(savedContent) === fingerprint) {
      intakeAttempt.current = { fingerprint, requestId: saved.requestId };
    }
  }
}
```

Place this immediately after fingerprint computation and before existing reuse/new UUID selection. Keep later selection unchanged. Do not reset intakeAttempt during render or effects. Mode, sources, prompt, legacy source, and current owner remain part of the fingerprint. New requests get new IDs; ambiguous retry of identical payload retains ID. Storage must contain exactly the ID sent to the server.

Search all saveIntakeDraft callers/tests; any caller needing repeat identity must explicitly reuse its existing saved draft requestId, not depend on undocumented mutation by the persistence helper. Update obsolete tests to reflect this contract. Do not mutate submitted payloads to force a match. Quota fallback that omits sources is not an identical payload and must not reuse the old ID on reload.

## 4. Tests that must fail before the repair and pass after

Extend existing test files. New tests are justified because these are lifecycle/data-integrity regressions; do not add tests mirroring JSX strings only.

### A. Attachment hook: direct mutation behavior

Use renderHook with the REAL useComposerAttachments. Restore one valid, already-extracted source twice in the same act, then once in a separate act. Expect exactly one row and one ready source. Restore `[source, source]` as a batch and expect one. Remove it and expect zero. Restore it explicitly and expect one. Include a source near the 3MB limit to ensure duplicate restoration does not consume its budget again. Do not mock restoreSources.

### B. Component restoration lifecycle

Seed saveIntakeDraft with a real ready source before mounting LearningPromptBar in StrictMode. Expect one attached row. Type into the prompt, toggle Plan, rerender with the same props, simulate a session loading->authenticated rerender, and expect one row and retained typed text/mode. Remove the source and rerender; it must remain removed. Existing tests without attached sources do not cover the original loop.

Restore one legacy sourceText draft and verify a single preview, no raw-text editor, removable. Controlled value must remain parent-owned, with no onChange called merely to restore an internal draft. Mock storage reads to throw and ensure mount resolves to a usable empty composer without crashing.

### C. Real hydration (not just client render)

Use ReactDOMServer.renderToString plus react-dom/client.hydrateRoot. Obtain server HTML before seeding browser storage. Then seed a draft with plan mode, legacy source text, and one attached source. Hydrate the SAME component inside act with an `onRecoverableError` spy. Wait for restored controls. Assert no recoverable hydration errors, one attachment, expected Plan state, visible legacy preview, and retained stored prompt after advancing the 200ms debounce. Always unmount the hydration root in cleanup. Also capture React hydration mismatch console errors because not every mismatch calls onRecoverableError. Do not mock the actual component or restore method.

Use identical session/router mocks on server and client to isolate restoration. A plain jsdom render is NOT a hydration test. The render-time read regression must cause the pre-fix test to fail. Keep timer use consistent: use real timers for hydration and fake timers only for the isolated persistence timing assertion if needed.

### D. Request identity and storage agreement

For each actual fetch, parse request body and readIntakeDraft(currentOwner). Assert identical requestId. Cover: timeout then retry; rerender between retries; unmount/remount then retry identical draft; same prompt but changed mode; same prompt with added/removed source; changed raw source; quota fallback that drops sources. Changed payload gets a fresh ID; identical retry keeps its ID. Use deferred/rejected fetch mocks, never paid network calls.

In intake-draft tests prove saveIntakeDraft preserves the supplied ID even when a prior draft has the same prompt but another mode/source. Preserve owner mismatch, expiry, corruption, and quota tests.

## 5. Verification and stop conditions

Run baseline/new tests before edits and record expected failures. A test that hangs from the old render loop should be bounded with the hook-level case and an isolated process timeout; do not let it exhaust memory. After patch:

```powershell
npx vitest run src/client/components/global/LearningPromptBar/__tests__ src/client/components/global/Composer
npx vitest run src/client/screens/landing/Hero/components/__tests__
npx vitest run src/client/screens/cohortBuilder/__tests__
npx vitest run src/shared/cohort-builder/__tests__/contracts.test.ts 'src/app/api/cohort-builder/workspaces/[workspaceId]/activity/__tests__/route.test.ts'
npx tsc --noEmit --incremental false
```

Locate and run intake-draft's existing test file explicitly too. Run ESLint on touched production/test files and a production build. Do not repair unrelated baseline failures by adding try/catch to production routing. Visually inspect reload with a saved source, removing it, Plan selection, URL Enter, and retry after a failed intake. Verify no hydration warnings, duplicate rows, or unexpected submissions.

Update the relevant MEMORY paragraph with mount-only post-hydration restoration and caller-owned request identity. No architecture essay. Do not change models, APIs, schema strictness, activity polling, or worker infrastructure.

Completion report: exact files touched; net production lines; regression results including hydration; baseline failures if any; manual checks actually performed. Do not claim zero errors or all goals fulfilled from TypeScript/ESLint alone. Acceptance is specifically: valid domain snapshots, changing terminal-state ETags, stable hydration, bounded restoration, removable attachments, and matching sent/persisted retry IDs.
