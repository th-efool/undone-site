# Evidence Artifact E3: Vertical Slice & Concurrency Failure Injection Report

**Stage:** V4 Vertical Slice Validation  
**Date:** 2026-10-27  
**Test Suite:** `src/client/screens/dashboard/notes/validation/__tests__/vertical-slice.test.ts`  
**Related Test Suites:** `fixtures.test.ts`, `indexeddb-prototype.test.ts`  
**Status:** PASSING (30/30 tests total, 9/9 vertical slice scenarios)

---

## 1. Test Environment & Tested Revision

| Property | Value |
| :--- | :--- |
| **Commit Baseline** | `2fef855c` (`feat(validation): implement V1 inventory, V2 auth/host assessment, V3 local durability prototype`) |
| **Operating System** | Windows 11 Pro (10.0.26100) |
| **Node.js Runtime** | Node v20.x |
| **Test Runner** | Vitest v4.1.11 |
| **Assertion Library** | Chai / Vitest Expect |
| **Execution Duration** | 34ms (vertical slice), 607ms (full 30-test suite) |

---

## 2. Architecture of the Vertical Slice Harness

The vertical slice validation is implemented in `src/client/screens/dashboard/notes/validation/vertical-slice-harness.ts` and evaluated by `src/client/screens/dashboard/notes/validation/__tests__/vertical-slice.test.ts`.

It exercises the end-to-end lifecycle between the local storage engine (`LocalWorkspaceRepository`) and a simulated GitHub Git Data API provider (`GitDataProviderHarness`):

```
+-----------------------------------------------------------------------------------+
|                           LocalFirstSyncCoordinator                               |
|                                                                                   |
|  [LocalWorkspaceRepository]                              [GitDataProviderHarness] |
|   ├── Transactional IndexedDB (Memory)                    ├── POST /git/blobs     |
|   ├── Atomic Outbox (Generational ACKs)                  ├── POST /git/trees     |
|   ├── In-Memory Editor Buffer Ring                        ├── POST /git/commits   |
|   └── TabLockCoordinator (Web Locks / BC)                 └── PATCH /git/refs     |
+-----------------------------------------------------------------------------------+
```

### Key Protocol Invariants Enforced
1. **Never Block Local Writing:** Mutations always commit to local storage and outbox atomically first. Network state never blocks user editing.
2. **Generational Outbox ACKs:** Outbox mutations are tagged with monotonically increasing generation numbers. In-flight publication only acknowledges up to the generation captured when publication started. New edits (`v2`) made while `v1` is in flight are strictly preserved.
3. **Compare-and-Swap (CAS) Remote Commits:** Every Git commit published specifies its known base parent commit (`lastSyncedCommitSha`). If a racing writer advances the remote branch ref, GitHub rejects the ref update with HTTP 422 (`non-fast-forward`). The local client detects this, reconciles from the new remote head, non-destructively preserves diverged notes via explicit `[Conflict]` copies, and re-publishes cleanly without clock arbitration.
4. **Content-Addressable Asset Integrity:** All binary assets are verified by SHA-256 both locally and upon remote restore before committing to the target workspace. Corrupted or missing blobs halt restore with an explicit error.
5. **Drop-Response Self-Healing:** If a dropped connection occurs immediately after the Git provider updates the branch ref, the client recovers on retry by matching candidate commit SHA against the remote branch HEAD, preventing duplicate commits.

---

## 3. Detailed Results for All 9 Validation Scenarios

### Scenario 1: Authorize, Select Repository, Preview, and Confirm Bind (with Cancel Safety)
- **Objective:** Verify user can preview repository selection, reject insecure public repositories, safely cancel without side effects, or confirm binding with an epoch counter.
- **Inputs:**
  - Case 1a: User cancels confirmation modal (`confirm = false`).
  - Case 1b: User attempts to bind a public repository (`isPrivate = false`).
  - Case 1c: User confirms private repository (`isPrivate = true, confirm = true`).
- **Observed Behavior:**
  - Case 1a returned `bound: false`, binding remained `null`.
  - Case 1b returned `bound: false`, error stated: `"Undone requires private repository visibility"`.
  - Case 1c established binding `status: 'ACTIVE'`, `bindingEpoch: 1`.
- **Verdict:** PASS

### Scenario 2: Save Locally + Atomic Outbox + Atomic Scene/Asset Publication Commit
- **Objective:** Verify local write durability, atomic outbox creation, single Git commit publication containing scene JSON and referenced binary image assets, and subsequent outbox acknowledgment.
- **Inputs:** Synthetic Notebook + Excalidraw Canvas Note referencing 70B synthetic PNG image asset (`SYNTHETIC_ASSET_HASH`).
- **Observed Behavior:**
  - Note and asset committed atomically to local IndexedDB stores (`notes`, `assets`, `outbox`).
  - `publishOutbox()` created blobs for note, asset, and manifest.
  - Remote tree created with `undone/assets/<hash>.png`, `undone/notes/<id>.json`, `undone/manifest.json`.
  - Remote branch `refs/heads/main` advanced to new commit.
  - Local outbox cleared cleanly.
  - Final sync status: `'synced'`.
- **Verdict:** PASS

### Scenario 3: Close/Reopen Profile A and Clean Profile B Restore
- **Objective:** Verify that a completely clean, empty device/profile (Profile B) can bind the repository, read the remote manifest, verify asset hashes, and restore identical state.
- **Inputs:** Profile A publishes state from Scenario 2; Profile B initializes with empty IndexedDB.
- **Observed Behavior:**
  - Profile B executed `restoreFromRemote()`.
  - Restored 1 notebook, 1 note, 1 image asset.
  - SHA-256 of restored asset matched `SYNTHETIC_ASSET_HASH`.
  - Decoded base64 bytes matched original fixture exactly.
- **Verdict:** PASS

### Scenario 4: Racing Independent Edits from Head H on Two Profiles
- **Objective:** Verify two independent profiles making edits from baseline H. Profile A advances remote ref to H'. Profile B's publication attempt is rejected with 422 Non-Fast-Forward. Profile B reconciles divergence and re-publishes. Profile C verifies both independent notes survive.
- **Inputs:**
  - Baseline commit H.
  - Profile A creates `note-from-A`.
  - Profile B creates `note-from-B`.
- **Observed Behavior:**
  - Profile A publishes first; remote ref advances to H'.
  - Profile B publishes with parent [H]; Git provider detects non-fast-forward CAS violation and rejects with 422.
  - Profile B invokes `reconcileRemoteDivergence()`, pulls `note-from-A` into local store, updates `lastSyncedCommitSha = H'`.
  - Profile B re-publishes with parent [H']; publication succeeds.
  - Clean Profile C restores repository: both `note-from-A` and `note-from-B` are present.
- **Verdict:** PASS

### Scenario 5: Concurrent Edit on Same Note Generates Explicit Conflict Copy
- **Objective:** Verify two profiles concurrently editing the same note ID. Profile A edits title to `'Title Edited By Profile A'`. Profile B edits title to `'Title Concurrently Edited By Profile B'`. System must preserve both without timestamp arbitration.
- **Inputs:** Shared note ID `FIXTURE_CANVAS_NOTE.id`.
- **Observed Behavior:**
  - Profile A publishes first.
  - Profile B detects divergence during reconciliation.
  - Profile B creates non-destructive conflict copy: `[Conflict] Title Concurrently Edited By Profile B` with new ID `${note.id}-conflict-${timestamp}`.
  - Profile B's local store contains 2 notes: the updated note and the conflict copy.
  - Profile B publishes; both versions converge to remote.
- **Verdict:** PASS

### Scenario 6: Recover from Lost Response After Provider Successfully Updates Ref
- **Objective:** Simulate a dropped network connection / timeout occurring immediately after the Git provider has updated the remote branch reference, but before the HTTP 200 response reaches the client.
- **Failure Injected:** `faults.dropResponseAfterRefUpdate = true` in `GitDataProviderHarness`.
- **Observed Behavior:**
  - `updateRef` advances remote branch to candidate commit SHA, then throws `ETIMEDOUT`.
  - Catch block in `LocalFirstSyncCoordinator` inspects remote branch ref.
  - Remote branch ref matches `candidateCommitSha`.
  - Coordinator self-heals: marks publication as successful, acknowledges outbox up to current generation, sets `syncStatus = 'synced'`.
  - Outbox is cleared; duplicate commits prevented.
- **Verdict:** PASS

### Scenario 7: In-Flight Edit v2 Survives and v1 Acknowledgment Does Not Clear v2
- **Objective:** Verify that when mutation v1 is in flight to the network and the user continues typing to produce mutation v2, acknowledging v1 does not clear v2 from outbox.
- **Inputs:**
  - Save notebook (Generation 1).
  - In-flight publication begins.
  - User edits canvas note (Generation 2).
  - Network publication completes for Generation 1; calls `acknowledgeOutboxUpTo(gen1)`.
- **Observed Behavior:**
  - Outbox contained 2 items.
  - After acknowledging up to Generation 1, outbox retains 1 item (Generation 2).
  - `entityId` of surviving item matches `FIXTURE_CANVAS_NOTE.id`.
- **Verdict:** PASS

### Scenario 8: Missing or Corrupt Remote Asset Halts Clean Restore
- **Objective:** Verify content-addressable tamper detection and missing blob resilience during remote workspace restore.
- **Failure Injected:**
  - 8a: Tampered asset payload (bytes altered, hash mismatch).
  - 8b: Deleted asset blob (git blob missing).
- **Observed Behavior:**
  - 8a: `restoreFromRemote` aborted with `Corrupt remote asset hash mismatch: expected <sha256>, got <tampered_sha256>`.
  - 8b: `restoreFromRemote` aborted with `Missing referenced remote asset blob: <sha256>`.
  - In both cases, target workspace was withheld from marking restore clean, and error was flagged.
- **Verdict:** PASS

### Scenario 9: Disconnect Preserves Queued Mutations; Reconnect Converges Without Duplicates
- **Objective:** Verify user can disconnect repository binding, make multiple offline edits, reconnect, and publish all queued mutations cleanly.
- **Inputs:**
  - Disconnect called (`bindingEpoch` incremented, `status = 'DISCONNECTED'`).
  - 2 edits made while disconnected (canvas note + notebook title change).
  - Reconnect called (`status = 'ACTIVE'`).
  - `publishOutbox()` executed.
- **Observed Behavior:**
  - Outbox queued all edits during disconnected state.
  - Reconnect restored active status.
  - `publishOutbox()` committed all queued mutations in a single coherent Git commit.
  - Outbox fully acknowledged (remaining = 0).
  - Final sync status: `'synced'`.
- **Verdict:** PASS

---

## 4. Failure Injection Summary Matrix

| Failure Mode / Edge Case | Injected At | System Reaction | Safety Invariant Verified |
| :--- | :--- | :--- | :--- |
| **User Cancel** | Repository preview modal | Aborts binding; zero remote calls | Cancel safety |
| **Public Visibility** | Preview bind validation | Rejects public repository | Data privacy guarantee |
| **Dropped Wire Response** | Remote Git ref update | Detects commit SHA match at HEAD; auto-acks outbox | Idempotency / No duplicate commits |
| **Racing Remote Ref Update** | Provider ref CAS update | Provider returns HTTP 422 Non-Fast-Forward | CAS integrity |
| **Concurrent Note Collision** | Remote divergence reconcile | Forks non-destructive `[Conflict]` copy | Zero data loss / No clock arbitration |
| **In-Flight Concurrent Edit** | Local outbox acknowledgment | Generational barrier acknowledges `<= gen1`; preserves `gen2` | In-flight write durability |
| **Tampered Asset Bytes** | Remote restore blob check | SHA-256 verification failure; restore halted | Cryptographic tamper detection |
| **Missing Asset Blob** | Remote restore blob lookup | 404 blob lookup failure; restore halted | Workspace integrity gate |
| **Network Disconnect** | Lifecycle binding manager | Epoch invalidation; mutations accumulate in IndexedDB | Offline-first autonomy |

---

## 5. Test Suite Verification Table

All tests executed via `vitest run` on Node v20 / Windows 11:

```
Test Files  3 passed (3)
     Tests  30 passed (30)
  Duration  607ms
```

| Test Suite | Scenario / Test Name | Status | Duration |
| :--- | :--- | :---: | :---: |
| `fixtures.test.ts` | 1. Synthetic Notebook fixture satisfies schema | PASS | 2ms |
| `fixtures.test.ts` | 2. Synthetic Excalidraw Canvas fixture satisfies schema | PASS | 1ms |
| `fixtures.test.ts` | 3. Embedded asset byte length and SHA-256 match exactly | PASS | 1ms |
| `fixtures.test.ts` | 4. Synthetic Kanban fixture satisfies schema | PASS | 1ms |
| `fixtures.test.ts` | 5. Corrupt asset intentionally fails SHA-256 verification | PASS | 1ms |
| `fixtures.test.ts` | 6. Malformed JSON fixture fails validation cleanly | PASS | 1ms |
| `fixtures.test.ts` | 7. Exported synthetic fixtures bundle round-trips cleanly | PASS | 2ms |
| `indexeddb-prototype.test.ts` | 1. Account Isolation & DB Naming | PASS | 15ms |
| `indexeddb-prototype.test.ts` | 2. Atomic Outbox Commits (notebook + outbox) | PASS | 12ms |
| `indexeddb-prototype.test.ts` | 2. Atomic Outbox Commits (canvas + assets + outbox) | PASS | 18ms |
| `indexeddb-prototype.test.ts` | 3. Quota Exceeded & Atomic Rollback (simulated failure) | PASS | 14ms |
| `indexeddb-prototype.test.ts` | 3. Quota Exceeded & Atomic Rollback (byte quota simulation) | PASS | 16ms |
| `indexeddb-prototype.test.ts` | 4. In-Memory Editor Buffer vs Persisted State | PASS | 10ms |
| `indexeddb-prototype.test.ts` | 5. Single-Writer Tab Election & Multi-Tab Broadcast | PASS | 22ms |
| `indexeddb-prototype.test.ts` | 5. Single-Writer Lock Timeout Handling | PASS | 11ms |
| `indexeddb-prototype.test.ts` | 6. Full State Export Bundle Generation | PASS | 15ms |
| `indexeddb-prototype.test.ts` | 6. Clean State Restoration into Empty Database | PASS | 20ms |
| `indexeddb-prototype.test.ts` | 6. Bundle Tampering Checksum Mismatch Detection | PASS | 14ms |
| `indexeddb-prototype.test.ts` | 7. Offline Resilience (outbox persists across restart) | PASS | 12ms |
| `indexeddb-prototype.test.ts` | 7. Offline Resilience (unpersisted buffer discard) | PASS | 9ms |
| `indexeddb-prototype.test.ts` | 7. Offline Resilience (clean wipe on user delete) | PASS | 23ms |
| `vertical-slice.test.ts` | Scenario 1: Authorize, select repository, preview and bind | PASS | 4ms |
| `vertical-slice.test.ts` | Scenario 2: Save locally + atomic outbox + publication commit | PASS | 16ms |
| `vertical-slice.test.ts` | Scenario 3: Close/reopen profile A and clean profile B restore | PASS | 2ms |
| `vertical-slice.test.ts` | Scenario 4: Racing independent edits from head H on two profiles | PASS | 8ms |
| `vertical-slice.test.ts` | Scenario 5: Concurrent edit on same note (conflict copy) | PASS | 2ms |
| `vertical-slice.test.ts` | Scenario 6: Recover from lost response after ref update | PASS | 1ms |
| `vertical-slice.test.ts` | Scenario 7: In-flight edit v2 survives v1 acknowledgement | PASS | 0ms |
| `vertical-slice.test.ts` | Scenario 8: Missing or corrupt remote asset halts restore | PASS | 1ms |
| `vertical-slice.test.ts` | Scenario 9: Disconnect preserves outbox; reconnect converges | PASS | 1ms |
