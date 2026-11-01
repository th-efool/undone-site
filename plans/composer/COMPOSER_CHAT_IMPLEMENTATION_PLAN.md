# Composer and chat remediation — executor handoff

**Priority correction after read-only incident investigation:** see the appended “Verified incident addendum.” The screenshot run failed in 8.657s due to action.type leaking into presentation; a colliding activity ETag can retain Thinking. Implement those two small fixes first. Units D/E below are deferred independent improvements, NOT prerequisites or proven root causes for this incident. The copied addendum also exists at the user's requested `plans/composer-chat-execution.md` path.

Date: 2026-10-31. Status: specification only; application code has not been changed. This expands the current composer/chat section of PLAN.md, not its unrelated historical Feed/Home work.

## 1. Scope, dependencies, and sequence

Deliver one coherent change: a restrained composer, a mode-only Plan toggle, short suggestions above the chat input, Undone assistant branding, accurate run status, bounded execution, and progressive assistant text. Preserve durable workspace actions, ownership, journal replay, draft retention, source extraction, and cancellation fences.

Read AGENTS.md, MEMORY/README.md, MEMORY/composer-and-client-extraction.md, MEMORY/cohort-builder-processing.md, and MEMORY/css-styling.md. Inspect git status in both root and packages/interaction-builder; preserve unrelated changes. Do not implement other sections of PLAN.md. No deployment, production data edits, paid load tests, dependency upgrades, or new third-party libraries are required by this handoff.

Installed dependencies used: React 19.2.4, Next 16.2.11, ai 7.0.133 at root, @ai-sdk/google 4.0.92, Prisma/Postgres, Vitest 4.1.11, Testing Library, existing workflow runtime, and local interaction-builder. Verify resolved package versions locally rather than installing different versions. Use Node 24 per the root engines field. Root exports consume interaction-builder/dist; rebuilding that package is mandatory after its source changes.

| Unit | Files / change | Depends on |
|---|---|---|
| A | Activity ETag regression and fix | none; first latency fix |
| B | Homepage Plan, attachment UI, request identity | none |
| C | Chat suggestions, logo, footer | none |
| D | Timing and worker lifecycle/cancellation | A |
| E | Progressive text through existing journal/activity channel | A, D |
| F | Integration, visual checks, package rebuild, memory | A–E |

Do A–C before broad runtime refactoring. Keep each unit reviewable. Do not claim that all reported latency has one cause: queue wait, model execution, and stale presentation are different measurements.

## 2. A — Fix the confirmed activity ETag collision

File: `src/app/api/cohort-builder/workspaces/[workspaceId]/activity/route.ts`.

Current code base64-encodes `messageId:runId:status` and truncates to 32 characters. A UUID is long enough that these characters contain only the message ID. For the same message, queued/running/completed all produce the same ETag. This was reproduced locally with Node. The hook keeps its old turns on a 304, so the UI can keep displaying Thinking after the run changes state. This does not prove the provider itself took minutes.

Add:

```ts
import { createHash } from 'node:crypto';

export const runtime = 'nodejs';
```

Replace the two ETag construction statements with:

```ts
const payload = { turns };
const etag = `W/"${createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex')}"`;
```

Use `payload` in the final Response.json. When unit E adds progress, put it in `payload` BEFORE computing this hash. Never truncate the input before hashing. Preserve private/no-store and conditional 304 behavior.

Create `src/app/api/cohort-builder/workspaces/[workspaceId]/activity/__tests__/route.test.ts`. Mock auth and Prisma, import the actual GET, and use a valid fixed UUID. First GET running -> capture ETag. Second GET with that ETag and completed data -> must return 200 and a different ETag. Third GET with unchanged completed data and latest ETag -> 304. Repeat for queued -> running, a later array element changing, and null runId -> admitted runId. Assert unauthorized and non-owner requests return 404 without exposing turn content. Do not replace this with a test of a standalone hash helper.

## 3. B — Homepage composer

### B1. Plan must not submit

File: `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx`.

Replace the Plan onClick body with exactly:

```tsx
onClick={() => {
  setSelectedMode(current => current === 'plan' ? 'search' : 'plan');
  inputRef.current?.focus();
}}
```

Keep `aria-pressed`, the mode-dependent primary label, and primary `handleSubmit(selectedMode, e)`. Keep Shift+Enter as the existing explicit plan-submit shortcut. Do not call handleSubmit from mode selection, even when the query is nonempty. `isBusy` remains submission or active extraction, not selectedMode.

Add an in-flight ref to prevent two synchronous submit events before React rerenders. Set it immediately before intake work; reset on recoverable failure. On successful navigation keep submitting true until unmount. Do not disable typing merely because Plan is selected.

### B2. One Add link action, no settings drawer

Same file:

- Remove Plus and FileText imports if no remaining use; use `Link as LinkIcon` from lucide-react.
- Remove `sourceTab` state and every `setSourceTab` call.
- Delete the plus button entirely. Replace Add sources with one `Add link` button using LinkIcon, `aria-expanded={showSource}`, and `aria-controls="learning-prompt-links"` (use React useId if multiple bars can coexist).
- Keep Upload and templates. No raw-text tab or raw-text textarea. Do not delete legacy sourceText persistence/schema compatibility yet.
- Move the source region into the existing TextBar bottomBar fragment, after the toolbar. This uses the existing ReactNode slot and needs no shared TextBar API change. Remove the old region below TextBar.
- Inline region markup:

```tsx
{showSource && (
  <div id={linksRegionId} className={styles.inlineLinks}
    role="region" aria-label="Attached links">
    <div className={styles.inlineLinksHeader}>
      <span>Links</span>
      <button type="button" onClick={() => setShowSource(false)}
        aria-label="Close link input"><X size={14} /></button>
    </div>
    <LinkRows links={composerAttachments.links}
      onAddLink={composerAttachments.addLink}
      onRemoveLink={composerAttachments.removeLink}
      disabled={submitting} />
  </div>
)}
```

Keep a compact attachment count on the Add link trigger when collapsed. Closing the editor must not delete links. Use `onKeyDown` that stops propagation for Enter inside LinkRows so the new nested placement cannot submit TextBar while adding a URL. LinkRows already calls preventDefault; explicitly test the form boundary too.

If `sourceText.trim()` exists from a legacy draft, render a small `details` block labelled `Previously attached text`, a plain-text preview using React text children, and a Remove button calling setSourceText(''). Show this whether or not links are expanded. Preserve its payload until explicitly removed. No dangerouslySetInnerHTML. This avoids silently submitting hidden old material.

### B3. One deliberate focus treatment

`LearningPromptBar.module.css`: delete unused drawer/tab/raw-text selectors after searching for remaining references. Add:

```css
.inlineLinks {
  width: 100%;
  min-width: 0;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--ud-color-border-subtle);
}
.inlineLinksHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--ud-color-text-muted);
  font-size: 12px;
}
```

Delete `.sourceTextWrapper:focus-within` and its outer panel decoration. Do not add a replacement enclosing halo.

`Composer/LinkRows.tsx`: add `data-bare-input` to the URL input to opt out of global forms and accessibility rings. `LinkRows.module.css`: explicitly restore the input's height, padding, surface, border, radius, font, and color under `.urlInput[data-bare-input]`, since bare input defaults reset these. Use a solid neutral border, not dashed. Replace its focus rule with:

```css
.urlInput[data-bare-input]:focus,
.urlInput[data-bare-input]:focus-visible {
  outline: none;
  border: 1px solid var(--ud-color-brand);
  box-shadow: none;
}
```

Use selector specificity sufficient to beat existing bare-input resets; verify computed styles. Do not change global accessibility.css to hide everyone else's focus. The composer shell may retain its neutral shadow; it must not add a second accent ring around a focused link.

### B4. Bound intake requests and preserve retry identity

Current draftPayload creates a new requestId on every click. Add refs:

```ts
const submitInFlight = useRef(false);
const intakeAttempt = useRef<{
  fingerprint: string;
  requestId: string;
} | null>(null);
```

Build payload content without requestId, including prompt, mode, sources, and legacy source; fingerprint with JSON.stringify. Reuse intakeAttempt.requestId for identical content and owner, regenerate when content or owner changes. Include ownerId in the fingerprint; never place it in authority fields other than the existing expectedOwnerId. Persist the same requestId in saveIntakeDraft. On reload recover a matching saved draft's requestId, comparing its content after omitting timestamps/ownership metadata.

Use `signal: AbortSignal.timeout(15_000)` on the intake fetch. Treat timeout/network failure as an ambiguous result: show `Could not confirm your request. Retry to continue.` and release busy state, keeping the attempt identity and draft. Do not immediately navigate to a fallback that could create another workspace. Retry goes to the same endpoint with the same identity. Keep explicit auth redirect handling and existing 400/413/409 error handling. Clear the attempt only after successful workspace navigation or materially changed input. Do not clear attachments on uncertain outcomes.

### B tests

Update `LearningPromptBar/__tests__/LearningPromptBar.test.tsx`: replace old tests expecting Plan to submit and tabs to exist. Mock session as authenticated with a stable user ID and fetch returning a deferred promise. Reset pushMock/fetch/storage between cases.

Required assertions: Plan on/off performs zero fetches; primary after Plan sends mode plan once; default primary sends search once; double click before rerender sends once; Shift+Enter remains explicit plan submission; one Add link button; no Add sources/Plus/raw-text tabs; Enter in URL input does not submit intake; close/reopen retains links; extraction still gates Send; timeout re-enables retry with identical requestId; changed prompt changes requestId; legacy text visible and removable; 413 retains the draft. Update landing `CentralInterfaceSourceAndError.test.tsx` expectations too.

## 4. C — Chat presentation

### C1. Suggestions with short labels and contextual payloads

Create `src/client/screens/cohortBuilder/chat-suggestions.ts`:

```ts
export type ChatSuggestion = { id: string; label: string; prompt: string };

export function planningSuggestions(input: {
  goal?: string;
  firstLessonTitle?: string;
  asksAboutBackground: boolean;
}): ChatSuggestion[] {
  const goal = input.goal?.trim();
  return [
    input.firstLessonTitle
      ? { id: 'objectives', label: 'Refine objectives',
          prompt: `Refine the objectives for ${input.firstLessonTitle}` }
      : { id: 'syllabus', label: goal ? 'Draft a syllabus' : 'Choose a goal',
          prompt: goal ? `Draft a deep-dive syllabus for ${goal}`
            : 'Help me choose a learning goal' },
    input.asksAboutBackground || !goal
      ? { id: 'background', label: 'Assess my background',
          prompt: `Help me assess my current background${goal ? ` for ${goal}` : ''}` }
      : { id: 'projects', label: 'Add projects',
          prompt: `Add hands-on projects for ${goal}` },
    { id: 'pace', label: 'Set my pace',
      prompt: 'Help me choose a realistic daily study pace. Ask about my available time first.' },
  ];
}
```

In ChatPane use this for chat/review. Convert other stage arrays to the same `{id,label,prompt}` contract, retaining their action meaning. Limit every branch to `.slice(0, 3)`. Keep short existing phrases such as Show more advanced ones as prompts, but use visible labels Advanced options, Practical options, Create my own. Other stage labels: Set daily time / Set experience; Add a playlist / Find materials / Start with a goal; View progress / Review chunks / Cancel processing; Open experience / Review cohort / Next steps; Open cohort. Never put full lesson titles or goals in visible labels.

Add a region immediately BEFORE the composer form:

```tsx
{showSuggestions && suggestions.length > 0 && (
  <div className={styles.suggestions} role="group" aria-label="Suggested next steps">
    {suggestions.slice(0, 3).map(s => (
      <button key={s.id} type="button"
        onClick={() => void handleSend(s.prompt)}>
        {s.label}
      </button>
    ))}
  </div>
)}
```

Derive showSuggestions from `!sending`, no pending/queued/running activity, no attachment extraction, and no unmatched latest user message. The last condition avoids a flash before the first activity GET. Compare transcript order: the latest message is user means hide; an empty transcript may show initial suggestions; failed/canceled latest turns may instead expose retry feedback. Do not change activeTurn to include pending without checking Stop: pending has no runId. Keep a separate boolean for suppression.

Delete the old below-form suggestions block and entire routine saved-status span. If the connection prop becomes unused, remove its destructured binding/default and keep the optional prop contract for callers; retain meaningful failure/reconnect feedback separately, without a permanent footer.

Replace suggestions CSS (including existing hover translation/shadow) with:

```css
.suggestions {
  display: flex;
  flex-flow: row nowrap;
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
  max-width: 720px;
  min-width: 0;
  margin: 0 auto 10px;
  padding: 3px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}
.suggestions button {
  flex: 0 0 auto;
  white-space: nowrap;
  border: 1px solid var(--ud-color-border-subtle);
  border-radius: var(--ud-radius-pill);
  background: transparent;
  color: var(--ud-color-text-secondary);
  padding: 7px 12px;
  font-size: 13px;
  line-height: 1.3;
  box-shadow: none;
  cursor: pointer;
}
.suggestions button:hover {
  background: var(--ud-color-surface-hover);
  transform: none;
  box-shadow: none;
}
```

Do not hide the scrollbar via inaccessible clipping. Verify parent flex children have min-width:0 if required. Remove `.saved` only after checking references.

### C2. Actual Undone assistant mark

Remove Sparkles import from ChatPane. Replace both assistant avatar instances with:

```tsx
<img src="/undone-logo.svg" alt="" aria-hidden="true"
  width={20} height={20} className={styles.assistantMark} />
```

```css
.assistantMark { display: block; width: 20px; height: 20px; object-fit: contain; flex: 0 0 auto; }
```

Give each assistant message an accessible speaker label in its existing container, not an auth navigation link. Reuse the SVG asset directly; global Logo wraps it in a link to /auth and is unsuitable here. Use the same mark for completed and active responses. Rename sparkle-specific wrapper classes if no other consumers use them.

### C tests

Update `ChatPaneTurnAndInteractive.test.tsx`: old long-label assertions become short-label assertions; clicking Add projects still sends the full goal-aware prompt; Set my pace does not arbitrarily choose 45 minutes; at most three buttons in Suggested next steps; group precedes textarea in DOM order; no group on pending/queued/running or unmatched initial user message; group returns after completion; saved strings absent for every connection value; both completed and active assistant avatars reference /undone-logo.svg. Preserve Markdown and entity-selection tests. Pure helper tests cover no goal, existing lesson, and background question.

## 5. D — Worker lifecycle, deadlines, cancellation, and measurement

### D1. Dispatch promise ownership

`src/server/interaction-dispatch.runtime.ts`: replace `after(() => { void runWorker(); })` with `after(runWorker)`. Replace silent catch inside runWorker with a structured error log. Avoid starting both a local opportunistic worker and durable workflow on Vercel: compute `const durableHost = process.env.VERCEL === '1' && process.env.INTERACTION_TEXT_DRIVER === 'durable';`, schedule the local callback only when `!durableHost`, and preserve the existing durable reservation/start/release path when durableHost. Do not await an entire worker loop in the HTTP handler.

Outside request context, the development fallback may remain detached with logged rejection; production must use the durable path or separately supervised worker. Add a test proving a registered after callback returns a pending worker promise until the worker resolves. Existing workflow-dispatch tests must explicitly stub DATABASE_URL and next/server.after so tests cannot launch real workers.

### D2. Cancellation contract through the package

`packages/interaction-builder/src/runtime/runner.ts`:

- Add `signal?: AbortSignal` to InteractionModelTurnInput.
- Pass `signal: opts.signal` into executeTurn.
- Check `opts.signal?.throwIfAborted()` after executeTurn and immediately before appendMessage.
- Preserve tool journal and final bindAssistantLease fence. A client abort check is not a substitute for transaction-level fencing.

`packages/interaction-builder/src/adapters/ai/index.ts`:

```ts
const abortSignal = input.signal
  ? AbortSignal.any([input.signal, ac.signal])
  : ac.signal;
```

Pass abortSignal to BOTH generateText and streamText. Add `maxRetries: 0` and `maxOutputTokens: 2000` for this interactive adapter, with optional adapter options if other package consumers need to retain defaults. Prefer host-configured values over changing every consumer. Do not cap curriculum generation adapters with these chat settings. Preserve fatal tool error precedence.

`src/server/interaction-worker.ts`: create a per-run AbortController and combined signal from shutdown, per-run cancel, and `AbortSignal.timeout(60_000)`. Pass combined signal to runAssistantTurn. A 60s deadline is an initial product bound, not a measured guarantee; failure should be retryable, not another silent multi-minute wait.

Use an awaited, non-overlapping lease-check loop every 1s while a run is active. Read getRun({runId,workspaceId}); abort if missing, canceled, not running, token changed, or deadline expired. Heartbeat every existing 15s; if heartbeat returns false, abort immediately. Stop loop in finally and clear its timers. Do not allow an unhandled async interval rejection. SQL action/message fences remain authoritative for the race between the last check and a mutation. Do not turn an already canceled run into failed/completed; check the transition method result.

Review existing claim/fail behavior for expired leases. Test cancellation and timeout against real repository methods using the project's SQL fixture harness, not only in-memory booleans.

### D3. Timing and first response policy

Log stage durations and IDs only: intake accepted, dispatch reserved/started, run claimed with queueWaitMs, provider start, first text with timeToFirstTextMs, tool start/end duration, final message committed, client final receipt. Use performance.now for within-process durations and persisted createdAt for queue wait; do not subtract unrelated machine performance clocks. Do not log prompt/source text, tokens, or secrets.

`context.ts`: replace the unconditional directive to immediately update set_intent and edit_presentation with: `Reuse existing intent and presentation when already accurate. Do not call metadata tools merely to restate the initial topic. For an underspecified learning topic, ask one concise question or offer a short outline before substantial authoring. For an explicit request to draft a curriculum, perform the requested work and report progress.` Keep user-requested mutations action-first; do not impose a clarification loop on every explicit build request.

Measure default search and Plan separately: intake search schedules journey jobs; Plan schedules the conversational assistant. Fixing Plan must not silently change default search semantics.

## 6. E — Progressive text, concrete transport decision

Use provider streaming with bounded cumulative snapshots through the EXISTING activity polling channel. This is progressive delivery (initially up to 2s transport delay), not per-token SSE. It avoids inventing a new event protocol, table, or second persistent connection. Existing workspace SSE continues to deliver final messages/actions. Do not claim this is token-by-token network streaming. If measurements later demand subsecond delivery, that is a separate event-protocol change; do not half-implement one here.

### E1. Provider callback and run journal

Extend AiSdkAdapterOptions.onChunk to `(text: string) => void | Promise<void>`; in the streaming branch `await options.onChunk(chunk)`. Configure streaming in createInteractionModelAdapter through an optional execution argument containing onChunk and signal-related settings, passed for the production adapter. Preserve the fixture path's default behavior; add streaming fixtures for new tests.

Worker owns a cumulative text buffer scoped to one lease attempt. On first text, immediately persist a progress snapshot. Subsequent writes occur no more frequently than 250ms and only when text changes. Serialize writes by awaiting callback work. Since the renderer receives cumulative snapshots, it REPLACES text; never appends an entire snapshot. Bound retained text to the adapter's output limit and additionally cap progress payload to 32KiB UTF-8 without cutting surrogate pairs. A real overflow aborts with a clear error; do not silently truncate the final answer.

Use existing ordinal-zero model_call journal result for temporary progress, not a schema migration. Add a HOST-ONLY writer `src/server/infrastructure/db/postgres/assistant-progress.ts` with signature:

```ts
export type AssistantProgress = {
  attemptId: string;
  text: string;
  updatedAt: string;
};
export async function writeAssistantProgress(input: {
  workspaceId: string;
  runId: string;
  leaseToken: string;
  progress: AssistantProgress;
}): Promise<void>;
```

Exact transaction algorithm: lock interaction_runs row FOR UPDATE by runId AND workspaceId; require running status, matching leaseToken, unexpired leaseUntil, and valid deadline if present; otherwise throw FENCE_EXPIRED. Find interactionStep by runId_ordinal ordinal 0; require model_call and started state; update only result to `{ progress }`. Do not change step state, ordinal, tool metadata, workspace revision, or sequence. Never create a step here: runner records ordinal zero before calling the adapter. Hold the run row lock until write commits so cancel/reclaim cannot race past the fence. Existing recordStep only checks token, so do not reuse it unmodified as the progress writer.

Use a fresh opaque UUID attemptId for each claimed execution (not the leaseToken). Reset buffer on replay. Emit an empty progress snapshot before provider generation after ordinal-zero start, or exclude prior attempt data by recording the active attempt ID in the initial ordinal-zero result. Add optional `onModelStart?: () => Promise<void>` to AssistantRunOptions, invoked immediately after recording started and before executeTurn; worker uses it to establish the attempt. This prevents old interrupted text being displayed during retry.

Flush outstanding progress before executeTurn resolves. The runner's final completed result replaces temporary `{progress}` with its existing final text/steps/usage. No timers may write after final completion. On failure/cancel, stop writes, preserve normal failure handling, and ensure client does not present partial output as a completed answer.

### E2. Activity payload and final reconciliation

Extend the activity route response to:

```ts
type ActivityResponse = {
  turns: Array<{ messageId: string; runId: string | null; status: string }>;
  progress: null | {
    runId: string;
    attemptId: string;
    text: string;
    updatedAt: string;
  };
};
```

After verifying ownership, read the newest running turn's ordinal-zero started model_call and parse its result.progress with Zod (UUID attemptId, string text capped to 32KiB bytes, ISO updatedAt). Check current run status/token lifetime in the same read; exclude canceled/failed/stale attempts. Never return tools' raw inputs/results. Use null when no valid progress exists. Include progress in the FULL hashed payload from unit A. For this endpoint remove the process-local owner cache and recheck workspace ownership each request because it now returns generated private content; return 404 consistently for inaccessible workspaces.

`useAssistantActivity.ts`: add progress state and return it. Reset turns, progress, ETag, and unavailable on workspace changes; abort old requests and do not accept their result after navigation. On 304 retain current state/delay. On 200 replace progress with body.progress ?? null. Keep 2s active polling initially and 20s idle; do not reset the hook on every workspace sequence change just to accelerate streaming. Retain sequence dependency only if required for admission wake-up and test churn. Add a `refresh()` callback or a local version increment for send/cancel to wake an idle poll immediately.

ChatPane renders provisional progress for the matching active run in the assistant bubble, with Undone mark. Keep Stop accessible. Render plain text while streaming to avoid incomplete Markdown churn, then existing ChatMarkdown for the final committed message. Show Queued when queued, Thinking before first text, and no competing Thinking bubble once text exists. Use polite status announcements without announcing every character.

Final messages include runId in the repository contract. Suppress provisional text when a final assistant message with that runId exists. Do not clear visible provisional text merely because activity says completed before the workspace message arrives: hold it marked finishing until the final message arrives; trigger the existing message/workspace resync path if SSE has disconnected. Inspect client store resync API and wire the existing path; do not invent a new send to fetch results. On failed/canceled hide the active spinner and show partial text only with an explicit Interrupted label. Clear the held state on workspace change and on a new attemptId. No duplicate final bubble.

### E3. Required progressive-delivery tests

- Delayed fake provider emits first text, then blocks completion: journal snapshot and client text become visible before completion. Use MockLanguageModelV4 doStream fixture with the INSTALLED SDK's stream-part types, not hand-written outdated event shapes.
- Callback writes are serialized, first text immediate, subsequent writes throttled, terminal completion cannot be overwritten by a delayed flush.
- Foreign workspace writer, wrong lease, expired lease, canceled run, completed step all reject. Test actual transaction locking for cancel vs write using the existing PostgreSQL harness.
- Same run/new attempt resets text; cumulative snapshots replace rather than duplicate; final SSE before activity and activity before final SSE both render one response.
- Disconnect/reconnect, workspace switch during fetch, 304 with unchanged text, 200 with changed text, terminal state without text, timeout, and tool failure all settle predictably.
- Stop aborts provider within the 1s lease-check window in deterministic tests; canceled actions/final messages remain fenced even before that poll.

## 7. Test files, commands, and release gates

Extend existing tests rather than preserving assertions of broken behavior:

- `src/client/components/global/LearningPromptBar/__tests__/LearningPromptBar.test.tsx`
- `src/client/screens/landing/Hero/components/__tests__/CentralInterfaceSourceAndError.test.tsx`
- `src/client/screens/cohortBuilder/__tests__/ChatPaneTurnAndInteractive.test.tsx`
- `src/client/screens/cohortBuilder/__tests__/useAssistantActivity.test.ts`
- `src/server/domain/cohort-builder/__tests__/workflow-dispatch.test.ts`
- `packages/interaction-builder/__tests__/runner.test.ts`

Add activity route, chat-suggestions, assistant-progress writer, and adapter streaming/abort tests beside their modules or in existing __tests__ directories. Use fake timers for deadlines/throttles; restore timers/env/fetch in afterEach. Do not call real providers in unit tests. UI screenshots and production timing are separate evidence, not assertions to fake in unit tests.

Run from root (PowerShell commands separately, no chained success assumptions):

```powershell
npm run build:interaction:force
npx vitest run src/client/components/global/LearningPromptBar/__tests__ src/client/components/global/Composer src/client/screens/landing/Hero/components/__tests__/CentralInterfaceSourceAndError.test.tsx
npx vitest run src/client/screens/cohortBuilder/__tests__
npx vitest run src/server/domain/cohort-builder/__tests__/workflow-dispatch.test.ts
npm --prefix packages/interaction-builder test
npx tsc --noEmit --incremental false
npm run interaction:worker:check
npm run build
```

Run newly added route/writer/adapter test files explicitly as well. Root vitest config is vitest.config.mts. If bracket paths are troublesome on PowerShell, quote the literal string passed to Vitest. Run ESLint on touched TS/TSX files; distinguish baseline failures from introduced failures. Root build:interaction is conditional and can leave stale dist, so it is NOT a substitute for build:interaction:force. Inspect git/submodule status and include package source changes in the handoff according to the repo's existing package ownership; do not commit generated artifacts blindly.

Visual matrix: 375px, 768px, and 1440px; light and dark supported themes; mouse and keyboard. Assert exactly one accent focus indicator on URL entry; short single-row chips above input; horizontal scrolling without page overflow; no bottom saved footer; actual Undone mark; no jump of the composer when suggestions are hidden; textarea stays usable while a response runs. Check 200% zoom and reduced motion. Use the repository's existing browser tooling; no new browser dependency required.

Timing fixture acceptance: local interaction feedback within the next render; first scripted text delivered by the next active poll (2s plus request latency); terminal status changes invalidate ETag immediately; no fake AI content; provider execution aborted by 60s bound and stale writes rejected. For a real authenticated run record intake, queue, first text, and total separately for warm/cold paths. Do not promise a production p95 based on one sample or claim the model is instantaneous. Paid/provider-backed verification requires the executor's existing authorization, not an assumption from this plan.

## 8. Handoff completion and rollback

Executor final report must list changes by unit, exact tests run/results, visual screenshots, measured stage timings (or explicitly unmeasured), and any failed gates. Update MEMORY/composer-and-client-extraction.md with the final UI contracts and progressive-delivery path; update processing memory only where runtime contracts changed. Do not store logs or secrets there.

No database schema migration or new package is required by this design. Rollback units independently: UI rollback does not alter saved data; disabling progressive callbacks restores final-only replies while preserving A and D; do not roll back the ETag fix simply because streaming fails. Keep deadlines, lease fences, and ownership checks intact. Completion requires both first-text delivery and final durable reconciliation tests, not only a streaming provider call.

---

# Verified incident addendum

# Composer/chat execution — verified incident and priority repair

Investigated 2026-10-31 against the affected workspace's persisted database records, using read-only transactions. No production state was changed and no model request was made. This incident repair supersedes the latency hypotheses/order in [the detailed handoff](../COMPOSER_CHAT_IMPLEMENTATION_PLAN.md). The UI work in that document remains applicable.

## What actually happened

Affected screenshot workspace: `064df82e-5fca-4b61-a6c7-6801df1b917e`.
Run: `6898be69-7ebd-4f87-86f9-05b2b49c2cb4`.

The backend did NOT spend 5–10 minutes generating this response. It failed in **8.657 seconds after message acceptance**. There is exactly one user message and no persisted assistant reply for this run.

Durable event timeline (database-side elapsed arithmetic, same event clock):

| Elapsed after message acceptance | Persisted event |
|---|---|
| 0.000 s | message.accepted |
| 0.180 s | run.changed: queued |
| 5.079 s | run.changed: running |
| 8.076 s | workspace.committed: set_intent succeeded |
| 8.657 s | run.changed: failed |

Queue-to-running was 4.899s. Running-to-terminal-failure was 3.578s. Model-call journal start-to-failure was 3.224s (includes tool work; not a pure provider latency). Do not mix JavaScript Date renderings across timestamp-with/without-timezone columns: the initial query exposed a 5h30m representation difference. The intervals above were calculated in SQL from interaction_events.createdAt, avoiding that error. No absolute timestamp/timezone inference is required for the diagnosis.

Journal evidence:

- ordinal 0 model_call: failed.
- ordinal 1 set_intent: completed; recorded input keys `["intent"]`.
- ordinal 2 edit_presentation: failed; recorded input keys `["title", "description"]`.
- Persisted error: Zod `unrecognized_keys`, keys `["type"]`, path `["presentation"]`.
- Run ended failed, lease cleared, no assistant message appended.

This explains the apparently contradictory suggestions: the AI successfully changed the intent around 8s, and the browser builds suggestions synchronously from that saved intent. Then the next tool crashed. Suggestions are not a completed conversational response, but in THIS incident their updated wording could reflect successful partial AI work. The earlier blanket explanation that suggestions require no AI should be read with this distinction.

## Root cause 1 — application injects action discriminator into presentation

File: `src/shared/cohort-builder/contracts.ts`, `planCohortAction`, edit_presentation branch.

Current code:

```ts
const { title, description, coverImage, ...presentation } = action;
```

The rest object still contains `type: 'edit_presentation'`. The next line spreads it into `next.presentation`. The workspace schema defines presentation as a strict object without a type field, so subsequent repository validation rejects the state and rolls back that tool's transaction. The prior set_intent transaction remains committed. The AI did not send an invalid presentation.type field: the journal confirms title/description only. The host injected it.

Reproduced locally against the real contracts module with a valid title-only action:

```json
{"presentation":{"type":"edit_presentation"},"valid":false,"issues":[{"code":"unrecognized_keys","keys":["type"],"path":["presentation"],"message":"Unrecognized key: \"type\""}]}
```

Removing only presentation.type from the in-memory result made the same schema validation pass. No database writes were used for this reproduction.

### Exact minimal patch

```diff
- const { title, description, coverImage, ...presentation } = action;
+ const { type: actionType, title, description, coverImage, ...presentation } = action;
+ void actionType;
```

Keep all other semantics (title/description at workspace level, coverImage null removal, existing presentation fields, release invalidation). Do not loosen the strict schema, suppress all tool errors, retry malformed state repeatedly, or change models to mask this deterministic bug.

### Regression test

Extend `src/shared/cohort-builder/__tests__/contracts.test.ts`; its existing test only checks a subset with toMatchObject and therefore misses invalid extra state. Within the existing describe, reuse base() and context:

```ts
it('presentation edits produce a schema-valid snapshot without action metadata', () => {
  const result = planCohortAction(base(), {
    type: 'edit_presentation',
    title: 'Data science',
    description: 'A deep study path',
    subtitle: 'From foundations to projects',
  }, context);
  expect(result.nextState.presentation).not.toHaveProperty('type');
  expect(() => cohortWorkspaceSchema.parse(result.nextState)).not.toThrow();
  expect(result.nextState.title).toBe('Data science');
  expect(result.nextState.description).toBe('A deep study path');
  expect(result.nextState.presentation?.subtitle).toBe('From foundations to projects');
});
```

Also validate nextState for title-only, description-only, all presentation fields, clearing coverImage, retaining seasonTitles, and a subsequent second action on the returned state. Add a tool-to-repository integration fixture: scripted set_intent then edit_presentation then assistant text must complete with two successful commits and one assistant message. Validate the actual next state inside the fake persistence boundary if a real SQL fixture is unavailable; do not stub domain.plan or return success unconditionally.

## Root cause 2 — terminal failure can be hidden indefinitely by activity ETag

File: `src/app/api/cohort-builder/workspaces/[workspaceId]/activity/route.ts`.

The endpoint builds an ETag by base64 encoding concatenated messageId/runId/status strings then taking only 32 characters. Those characters encode only the start of the first message ID. Changing queued -> running -> failed does not change the ETag. `useAssistantActivity.ts` keeps the prior turns on 304, and ChatPane shows Thinking for a cached queued/running turn. No final assistant message arrives to break the illusion because the run actually failed.

The ETag collision was reproduced. The hook's 304 retention was verified in source. Browser network history from the original incident was not retained, so the exact historical 304 sequence is inferred rather than captured. The failed backend run itself is proven by persisted records. This distinction does not weaken the deterministic ETag defect or its required repair.

### Exact patch

Import `createHash` from `node:crypto`; keep Node runtime. Replace the truncated base64 ETag with a hash of the full response:

```ts
const payload = { turns };
const etag = `W/"${createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex')}"`;
```

Retain conditional GET and private/no-store. Return payload in Response.json. Do not disable caching globally or increase polling frequency to solve an identity collision.

### Regression test

Exercise the real route GET with mocked Prisma/auth and one fixed valid message ID/run ID. First response running -> capture ETag. Second response failed using If-None-Match from first -> require HTTP 200, new ETag, and failed body. Third unchanged failed response with new ETag -> 304. Also test queued -> running -> completed, pending -> queued, and changes outside the first row. Hook integration: first running, next failed must remove Thinking and enable actionable error/retry UI within the existing 2s active polling interval. An unchanged 304 must still retain current state.

## Failure presentation and retry

ChatPane already has a generic failed/canceled message, but stale activity prevents it appearing. Verify it becomes visible after the ETag repair. Use a concise message such as `Your request failed. Please retry.` Do not expose raw validation JSON to the learner. Add retry of the original intent as a NEW explicit message/run after the code is fixed; do not auto-loop the already failed run or replay previously committed set_intent blindly. Preserve the user's existing workspace and successful partial intent update. No production data repair is needed for this incident.

## Execution priority — small repair first

1. Add failing snapshot-schema and route-status regression tests.
2. Exclude the action discriminator from presentation and hash the complete activity payload.
3. Verify the two-tool scripted run completes, final assistant text persists, and terminal errors no longer show Thinking.
4. Apply the requested composer/suggestion/logo UI work from the detailed handoff.
5. Run a newly authorized real prompt after deployment and measure its queue/start/first text/final timings separately. Remaining normal latency can be investigated from that evidence.

**Provider streaming, progress snapshots, journal transport extensions, model changes, and worker rewrites are NOT prerequisites to repairing this observed incident.** Treat detailed-handoff units D/E as deferred independent improvements, not root-cause fixes. Do not add their complexity to the minimal incident repair merely because they appeared in the earlier hypothesis-based plan. The roughly 5s queue/start delay is a separate optimization target and does not explain minutes of Thinking here.

Run focused tests:

```powershell
npx vitest run src/shared/cohort-builder/__tests__/contracts.test.ts
npx vitest run 'src/app/api/cohort-builder/workspaces/[workspaceId]/activity/__tests__/route.test.ts'
npx vitest run src/client/screens/cohortBuilder/__tests__/useAssistantActivity.test.ts src/client/screens/cohortBuilder/__tests__/ChatPaneTurnAndInteractive.test.tsx
npx tsc --noEmit --incremental false
```

The route test file is to be created per the handoff. Add the actual tool-to-repository test path to the executed test report. Until implementation is performed, report these as required tests, not passed tests. Investigation has run the real contract reproduction and read-only database queries only.

## File distribution

The requested `plans/` directory is ignored by `.gitignore`. This file exists for the requested local handoff, but would not automatically travel in a normal commit. The same incident addendum is linked from PLAN.md and included in the tracked-path `COMPOSER_CHAT_IMPLEMENTATION_PLAN.md`; hand that file to a remote executor too. No automatic Git staging or deployment is authorized by this documentation update.

