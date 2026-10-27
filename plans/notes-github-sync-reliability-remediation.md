# Notes ↔ GitHub Reliability Investigation and Remediation Plan

**Repository:** `th-efool/undone-site`  
**Investigated:** 2026-10-27  
**Scope:** GitHub App reconnect/return flow, notes-to-local-workspace change propagation, and CAS/conflict recovery.  
**Status:** Investigation based on current default-branch source. This document is a remediation plan, not a claim that the code has already passed a patch/test cycle.

## Executive finding

The problems are addressable in the current architecture, but the current implementation does **not** justify a zero-conflict or zero-data-loss guarantee. The system already has useful primitives—IndexedDB, an outbox, compare-and-swap (CAS) publication, and a remote manifest—but there are gaps between those primitives and the production path.

A literal guarantee that conflicts can never occur is impossible when multiple tabs/devices can write the same remote branch concurrently. The achievable guarantee is stronger and more useful: **never silently lose a committed user edit; detect concurrent writes; preserve both versions durably; retry/reconcile automatically; and surface an actionable error only when recovery cannot safely proceed.** Conflicts should be an internal recovery condition, not a user-maintained Git merge problem.

## Source inspection: concrete findings

### 1. Reconnecting GitHub when the App is already installed

Relevant files:
- `src/client/screens/dashboard/notes/components/WorkspaceSyncControl.tsx`
- `src/app/api/personal-workspace/github/app/install/route.ts`
- `src/app/api/personal-workspace/github/app/callback/route.ts`
- `src/app/api/personal-workspace/github/app/config.ts`

Observed behavior:
- The UI always opens `/api/personal-workspace/github/app/install`, which redirects to GitHub's `/apps/undone-notes/installations/new` page when App credentials are present.
- That path assumes GitHub will return to the application's callback. An already-existing installation can instead route the user into GitHub's configuration/update experience; the app must not assume the new-installation callback will always run.
- The callback accepts a missing `state` or missing state cookie: validation runs only under `if (state && stateCookie)`. That weakens CSRF/replay guarantees and makes installation callback outcomes harder to reason about.
- The client listener is registered after `window.open`. This is usually okay, but callback timing, popup closure, fallback navigation, and a stale status response need explicit handling.
- The success callback's repository selection is heuristic (`undone-notes`, then any repo containing `undone`, then the first repo). It can bind a different repository than the user intended.
- The installation token is short-lived (roughly one hour). The current callback stores it in the vault cookie as though it were durable. An installation token must be renewed server-side from the installation ID; it must not be treated as a long-lived credential.

Remediation:
1. Persist the GitHub App installation ID and selected repository binding against the authenticated Undone user on the server.
2. On Connect, first inspect the user's existing binding and validate that the installation still exists and grants access to the selected repository. Reuse it when valid; do not send the user through installation creation on every click.
3. If the installation exists but access needs changing, offer an explicit “Manage repository access” path to GitHub's installation configuration page. Explain that GitHub may require the user to save/confirm changes before returning.
4. Configure and verify the GitHub App Setup URL / callback behavior for both fresh installs and updates. Treat an absent callback as a recoverable UI state, not a successful connection.
5. Make callback state mandatory, user-bound, expiring, and single-use. Reject missing state/cookie, mismatches, expired state, and replay; clear the cookie on every terminal callback path.
6. Persist installation ID and repository ID/name, not an expiring installation token as the durable identity. Mint a fresh installation token server-side when needed, with per-installation caching/expiry and serialized refresh.
7. Bind only the repository explicitly selected by the user. If the installation grants access to multiple repositories and there is no explicit selection, ask the user rather than guessing.
8. Make popup messages origin-checked and flow-correlated; clean up message listeners and close timers on success, error, popup close, and component unmount. After success, fetch authoritative connection status before showing “Connected.”

Acceptance tests:
- First-time installation.
- Already-installed App, same GitHub account.
- Already-installed App, different GitHub account/organization.
- Existing installation with changed repository selection.
- User cancels or closes the GitHub screen.
- Callback missing/invalid/replayed state.
- Callback succeeds but popup message is lost.
- Installation token expires while the app remains open.
- No flow asks the user to uninstall/reinstall the App or create a new GitHub account.

### 2. Edits not reaching GitHub until a reload

Relevant files:
- `src/client/screens/dashboard/notes/components/WorkspaceSyncControl.tsx`
- `src/client/personal-workspace/sync/coordinator.ts`
- `src/client/personal-workspace/local/repository.ts`
- `src/client/personal-workspace/local/facade.ts`
- Notes editor/save adapters and their tests.

Observed behavior:
- The sync coordinator reads the durable outbox, then publishes a snapshot assembled from repository reads. That is correct only if every editor mutation reaches the same repository/outbox before the coordinator snapshots it.
- The UI has a second state path through `notesRepository`. `handleSyncNow` explicitly copies `notesRepository.getInitialState(...)` into the local workspace before syncing. This indicates two sources/projections of note state that can diverge.
- The initial startup path seeds IndexedDB only when it has zero notes. Existing IndexedDB content can therefore remain stale if the editor's active state is updated elsewhere without a matching atomic local save/outbox entry.
- The component's facade subscription triggers sync, but that is not sufficient if a note editor does not commit every accepted edit through the facade/repository or if state projections are not refreshed until remount/reload.
- The coordinator's 20–30 second periodic sync is a fallback, not a correctness mechanism. It cannot compensate for edits that never enter the outbox.

Remediation:
1. Define one write path for all note types: editor mutation → atomic IndexedDB entity write + outbox entry → repository mutation event → sync scheduler. No editor should write only to a React/localStorage projection.
2. Inventory every create/update/delete path for Markdown, canvas/Excalidraw, Kanban, notebooks, assets, and schedules. Verify each successful user-visible save produces exactly one durable outbox mutation (or a documented coalesced mutation) before showing “saved.”
3. Keep editor buffers distinct from committed notes, but flush a buffer transactionally before manual sync, navigation, and background publication. Do not depend on a page reload to trigger serialization.
4. Subscribe to cross-tab mutation notifications and re-read the durable outbox on notification. Use Web Locks or the existing lock coordinator to prevent overlapping snapshot/publication jobs within a browser profile.
5. After local commits, schedule a debounced immediate sync; retain periodic retry for resilience. Use online events and backoff for network/API failures.
6. Capture the outbox entry IDs/generation and the exact snapshot generation used for each publish. Acknowledge only the captured batch after verifying the remote ref points to the published commit. Never clear newer edits.
7. Remove any sync operation that republishes a stale `notesRepository.getInitialState()` snapshot over the local-first repository. Manual Sync must drain the durable outbox, not re-seed from a potentially stale projection.
8. Add telemetry for local save success, outbox depth, publish attempt, remote commit SHA, acknowledged generations, and failure reason. Do not log tokens or note content.

Acceptance tests:
- Type/edit and wait: remote commit appears without reload.
- Create, edit, rename, delete, reorder, and change notebook assignment for each supported note type.
- Edit while offline, close/reopen, reconnect, and verify eventual remote state.
- Edit while a publish is in flight; verify the newer edit remains pending and is subsequently published.
- Edit from two tabs and two devices.
- Simulate API timeout, rate limit, 401/403, and lost response after remote ref update.
- Verify the UI distinguishes “saved locally” from “synced to GitHub.”

### 3. `Sync conflict: 0 branched conflict copies created`

Relevant file:
- `src/client/personal-workspace/sync/coordinator.ts`, especially `handleCasConflict`.

Observed behavior:
- The code detects a CAS conflict and loops over remote notes whose IDs occur in the pending local note mutations.
- It attempts to save a generated conflict copy through optional repository methods, but it does not check the returned `{ ok: boolean }` result.
- It increments `conflictsCreated` even when no compatible save method exists or the save operation returns `ok: false`. Therefore the counter is not evidence that a copy was durably persisted.
- Conflict records are written in a separate best-effort transaction whose errors are swallowed. The note copy and conflict metadata are not atomic.
- If the server reports a CAS failure but no overlapping note ID is found, the method still sets status to `conflict` and returns the misleading “0 copies created” error.
- The method advances `lastRemoteCommitSha` but does not perform a complete, atomic reconciliation of remote notebooks, notes, assets, schedules, and deletions into local state before retrying.
- Conflict detection based only on pending note IDs does not fully model create/delete races, notebook changes, asset dependencies, or concurrent snapshot changes.
- The server publication endpoint builds a full snapshot manifest from the request but creates the Git tree over the current base tree. The intended snapshot/manifest semantics and stale-path deletion semantics need to be made explicit and tested.

Remediation:
1. Replace “count conflicts then report” with a reconciliation result that separates: CAS retry required, conflicting entities found, copies durably created, remote state merged, and retry outcome.
2. Treat a failed or unavailable local save as a hard recovery failure. Do not increment the conflict-copy count unless the local transaction confirms persistence.
3. Write conflict copy, conflict metadata, and required asset references in one IndexedDB transaction. Use deterministic conflict IDs/operation IDs so retries are idempotent and cannot create duplicate copies.
4. Preserve both versions by comparing the common base snapshot to local and remote versions, rather than treating every remotely observed note with a pending mutation as a true overlap. For a same-entity overlap, preserve the local and remote versions explicitly. For disjoint edits, merge automatically.
5. Reconcile all entity types and deletions. Never overwrite a local edit with a remote snapshot. Never advance the durable sync checkpoint until the reconciled local state and conflict records are committed.
6. On CAS rejection, fetch the latest remote head and snapshot, reconcile, re-read the current local outbox, and retry with bounded exponential backoff and a fresh expected head. The server must reject stale ref updates; client-side checks alone are insufficient.
7. Make publish idempotent for dropped responses: if the remote ref already equals the candidate commit, treat the publication as committed and acknowledge only the captured outbox batch.
8. Ensure manifest and tree are a consistent snapshot. Define deletion/tombstone behavior and remove obsolete note files from the tree when the manifest says they are deleted, or explicitly define the manifest as authoritative and enforce that during restore.
9. If automatic reconciliation cannot safely finish, retain the outbox and all local versions, set a recoverable sync error, and retry. Never claim “0 conflicts” means no data was lost; never silently discard or acknowledge unresolved work.

Acceptance tests:
- CAS conflict with disjoint note creation on two devices.
- Same note edited on two devices from the same base.
- Local edit vs remote delete; local delete vs remote edit.
- Concurrent notebook rename/reassignment.
- Canvas edit with referenced image assets on both devices.
- Conflict-copy save returns `ok: false`; transaction throws; conflict metadata write fails.
- Repeated retry of the same conflict produces one durable copy, not duplicates.
- Two or more consecutive CAS races, followed by successful convergence.
- Lost response after successful remote ref update.
- A third clean device restores the final state and verifies payload hashes.
- Every failure leaves local outbox entries and recoverable data intact.

## Phased implementation plan

### Phase 0 — Freeze invariants and add regression fixtures
- Add fixture snapshots for a common base, local branch, and remote branch.
- Define data invariants: no acknowledged mutation without verified remote publication; no conflict count without durable copy; no checkpoint advancement before reconciliation; no remote merge that overwrites a newer local mutation.
- Add fault-injection seams for storage writes, GitHub API responses, popup close, and lost responses.
- Record baseline targeted test results before changing production logic.

**Exit gate:** Existing behavior is reproducible in automated tests, including the “0 copies” case.

### Phase 1 — Make the GitHub connection flow idempotent
- Persist installation ID and repository binding server-side.
- Reuse an existing valid installation; direct users to configuration only when permissions/repository selection must change.
- Require and consume state exactly once.
- Handle callback return, cancellation, popup close, and lost postMessage without false success.
- Implement short-lived installation token minting/renewal from the stored installation ID.
- Add callback and reconnect integration tests.

**Exit gate:** Reconnecting never requires uninstall/reinstall or a new GitHub account, and connection status is authoritative after every flow.

### Phase 2 — Enforce one durable note write path
- Trace and patch all editor adapters to commit through the local repository's atomic save methods.
- Ensure editor buffers flush before publication and relevant lifecycle transitions.
- Remove stale snapshot re-seeding from manual sync.
- Wire mutation events to debounced sync, cross-tab notification, and retry.
- Add per-note-type tests proving no-reload synchronization.

**Exit gate:** Every accepted edit is either durably queued locally or visibly rejected; reload is never required to make a saved edit syncable.

### Phase 3 — Replace best-effort conflict handling
- Implement base/local/remote reconciliation and explicit tombstones/deletion semantics.
- Make conflict-copy + metadata + dependent assets atomic and idempotent.
- Validate save results and preserve the outbox on any failure.
- Re-fetch remote head, reconcile, and retry CAS publication with bounded backoff.
- Make publish/retry idempotent for ambiguous network outcomes.
- Enforce snapshot/manifest consistency on publish and restore.

**Exit gate:** No injected failure can silently lose a committed local edit; conflicts converge automatically or remain durably recoverable without requiring the user to manually resolve Git.

### Phase 4 — Adversarial integration and multi-device verification
- Run unit tests, route tests, editor integration tests, and browser-level tests.
- Run two-writer and three-device scenarios with concurrent same-note and disjoint-note edits.
- Inject offline periods, rate limits, expired/revoked credentials, tab closure, storage failures, API timeouts, and response loss.
- Verify final restored payloads and referenced assets with SHA-256.
- Run typecheck, lint, and production build; inspect regressions in notes/editor behavior.

**Exit gate:** All correctness invariants pass under repeated fault injection. Any unverified test remains explicitly listed; do not describe the system as production-safe until this gate passes.

### Phase 5 — Controlled rollout and observability
- Ship behind a feature flag or staged rollout.
- Monitor pending outbox age/depth, sync retry counts, CAS conflict frequency, conflict-copy transaction failures, token renewal failures, and restore hash failures.
- Add a recovery/export action that remains available even if GitHub is disconnected.
- Keep local data and outbox untouched on all auth or sync errors.

**Exit gate:** Real-world telemetry shows reliable convergence and no silent data loss before broad rollout.

## Non-negotiable correctness invariants

1. **Local durability first:** a successful save means the entity and its outbox operation committed atomically.
2. **No blind overwrite:** a stale writer cannot move the remote branch ref forward over a newer head.
3. **No false acknowledgement:** only the exact mutation batch represented by a verified remote commit may be acknowledged.
4. **No phantom conflict copies:** counters/status reflect persisted records, not attempted writes.
5. **No destructive reconciliation:** all local and remote edits survive until a merge is proven safe.
6. **Idempotent retries:** retries after timeouts or duplicate events do not duplicate notes, conflict copies, or acknowledgements.
7. **Manifest consistency:** restored state corresponds to one coherent committed snapshot.
8. **No user-side Git repair:** routine concurrency is reconciled in the application; if recovery cannot complete, the system preserves data and retries rather than asking the user to resolve Git internals.
9. **Honest status:** “Saved locally” and “Synced” are distinct states.
10. **No absolute zero-conflict claim:** concurrent writers can race by definition. The goal is zero silent data loss and zero user-managed merge conflicts, enforced by protocol and tests.

## Recommended order

Implement in this order: **Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5.** Do not start by merely suppressing the “0 branched copies” message or adding more polling. Those changes hide symptoms without fixing durability, reconciliation, or the existing-installation flow.
