# Evidence Artifact E4: Frozen Local-First & GitHub Sync Contracts

**Stage:** V5 Contract Freeze  
**Date:** 2026-10-27  
**Status:** FROZEN FOR BUILD PHASE  
**Schema Version:** `1.0.0`

---

## 1. Executive Summary & Design Invariants

This document establishes the authoritative, evidence-backed contracts for the local-first durability and GitHub synchronization engine of Undone. These contracts reflect the empirical findings from:
- **E1 (`inventory.md`):** Current storage paths, unscoped localStorage keys, 10MB image trimming risks, and black hole endpoints.
- **E2 (`auth-host-assets.md`):** Elimination of PATs, Next.js BFF GitHub App OAuth PKCE, 3.0MB direct raw asset envelope on Vercel serverless (+33.33% base64 expansion), and 4-step Git Data API.
- **E3 (`vertical-slice.md`):** Passing validation of all 9 concurrency and failure injection scenarios.

---

## 2. Invariant Decision & Mechanism Evaluation Table

For every protocol mechanism evaluated during pre-plan validation, this table records the invariant served, the test proving need, the chosen implementation, the rejected alternative, and the condition under which extension is considered.

| Mechanism | Invariant Served | Test Demonstrating Need | Chosen Implementation | Simpler Rejected Alternative | Deferred Extension Trigger |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Monotonic Outbox Generation** | In-flight publication never clobbers concurrent edits made while uploading | V4 Scenario 7 (`vertical-slice.test.ts`) | Integer generation tag assigned at transaction commit; outbox ack removes entries `<= ackGeneration` | Monotonic timestamp comparison (rejected: prone to NTP drift and sub-millisecond clock jitter) | Multi-branch concurrent publishing (deferred to post-R3) |
| **Compare-and-Swap (CAS) Ref Update** | Prevent silent remote overwrite when peers publish concurrently | V4 Scenario 4 (`vertical-slice.test.ts`) | Git Data API `PATCH /git/refs/heads/<branch>` with parent commit check (`force: false`); returns HTTP 422 Non-Fast-Forward on divergence | Blind force push or polling before commit (rejected: race window exists between poll and push) | None; CAS is mandatory for all sync |
| **Non-Destructive Conflict Forking** | Zero data loss on concurrent edits to the same note ID | V4 Scenario 5 (`vertical-slice.test.ts`) | On detecting diverged remote content for note ID, preserve local version and create explicit conflict note with title `[Conflict] <title>` and new ID | Last-Write-Wins (LWW) via clock timestamp (rejected: causes unrecoverable data loss) | 3-way visual AST diff/merge UI (deferred to R3) |
| **Content-Addressable Asset Deduplication** | Asset integrity and tamper detection; prevent corrupt restore | V4 Scenario 8 (`vertical-slice.test.ts`) | SHA-256 hash computed on decoded raw binary bytes; stored at `undone/assets/<sha256>.<ext>`; validated before committing on restore | Filename / URI string matching (rejected: fails to detect corrupt or truncated uploads) | Chunked range requests for multi-gigabyte video (deferred: notes assets are bounded to <= 5MB) |
| **Post-Commit Response Loss Recovery** | Idempotent publication; prevent duplicate commits on network drop | V4 Scenario 6 (`vertical-slice.test.ts`) | Retain candidate commit SHA in local state; on retry/timeout, verify if candidate commit matches remote HEAD ref; if so, acknowledge outbox directly | Blind retry (rejected: creates dangling redundant empty commits and dirty history) | Distributed transaction two-phase commit (rejected: GitHub API does not support 2PC) |
| **Account-Scoped Database Naming** | Prevent cross-account data leaks on shared browsers | V3 Scenario 1 (`indexeddb-prototype.test.ts`) | IndexedDB database named `workspace_${userId}`; rejects empty or unauthenticated user ID | Global single database with user foreign keys (rejected: susceptible to key collision or leak bugs) | Multi-workspace switching within single account (deferred to R2) |
| **Web Locks Leader Election** | Prevent multi-tab concurrent write corruption in IndexedDB | V3 Scenario 5 (`indexeddb-prototype.test.ts`) | `navigator.locks.request` with BroadcastChannel event notification; fallback to single-writer queue with timeout | Uncoordinated multi-tab writes (rejected: produces interleaved partial writes) | SharedWorker coordination (deferred if Safari iOS lacks Web Locks in legacy versions) |
| **Separate Checkpoint History Payloads** | Fast boot and lean manifest synchronization | Architecture review | Checkpoint blobs are **explicitly excluded** from v1 manifest and branch HEAD; sync publishes current state snapshot only | Embedding full git revision history in manifest (rejected: causes exponential manifest bloat) | Time-travel restore / Git tag checkout UI (deferred to R3) |

---

## 3. Schema Definitions & Serialization Rules

Authoritative JSON Schema definitions are published under `plans/local-first-github-sync-validation/schemas/`:
- `notebook.json`: [schemas/notebook.json](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/plans/local-first-github-sync-validation/schemas/notebook.json)
- `note.json`: [schemas/note.json](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/plans/local-first-github-sync-validation/schemas/note.json)
- `asset.json`: [schemas/asset.json](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/plans/local-first-github-sync-validation/schemas/asset.json)
- `manifest.json`: [schemas/manifest.json](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/plans/local-first-github-sync-validation/schemas/manifest.json)
- `bundle.json`: [schemas/bundle.json](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/plans/local-first-github-sync-validation/schemas/bundle.json)

### Remote Git Repository Layout
```
undone/
├── manifest.json              # Versioned snapshot manifest (WorkspaceManifest)
├── notebooks/
│   └── <notebookId>.json      # ValidationNotebook serialized as canonical JSON
├── notes/
│   └── <noteId>.json          # ValidationCanvasNote or ValidationKanbanNote JSON
└── assets/
    └── <sha256>.<ext>         # Raw content-addressable binary asset blob
```

### Manifest Format (`undone/manifest.json`)
```typescript
export interface WorkspaceManifest {
  manifestVersion: 1;
  workspaceId: string;
  notebooks: Array<{
    id: string;
    path: string;       // e.g. "undone/notebooks/nb-synthetic-01.json"
    hash: string;       // SHA-256 of canonical JSON payload
  }>;
  notes: Array<{
    id: string;
    path: string;       // e.g. "undone/notes/note-canvas-01.json"
    hash: string;       // SHA-256 of canonical JSON payload
    contentType: 'canvas' | 'kanban' | 'markdown';
  }>;
  canvases: Array<{
    noteId: string;
    path: string;
    hash: string;
  }>;
  assets: Array<{
    id: string;
    path: string;       // e.g. "undone/assets/<sha256>.png"
    sha256: string;     // SHA-256 of raw decoded binary bytes
    gitSha: string;     // Git object SHA-1 ("blob <len>\0<bytes>")
    mimeType: string;   // e.g. "image/png"
  }>;
}
```

---

## 4. Host Envelopes & Measured Physical Limits

| Limit Boundary | Maximum Value | Enforcing Layer | Rationale / Evidence |
| :--- | :--- | :--- | :--- |
| **Individual Raw Asset** | **3.0 MiB** (direct) / **5.0 MiB** (chunked) | Client Validator / BFF | Vercel Serverless has a 4.5 MiB hard request limit. With base64 (+33.33%) expansion, a 3.0 MiB raw binary reaches ~4.0 MiB serialized JSON. Assets > 3.0 MiB must be uploaded via multi-part chunks. |
| **Single Publication Group** | **15.0 MiB** total | Sync Coordinator | Maximum total size of newly staged assets per single Git commit. Groups exceeding 15 MiB serialize asset uploads into batched blob uploads before creating tree. |
| **Local IndexedDB Database** | **500 MiB** quota threshold | Browser Storage API | When browser storage exceeds 500 MiB or returns quota error, user is prompted to clean unreferenced assets or export bundle. Rollback is atomic. |
| **Max Concurrent Blobs** | **4 concurrent requests** | BFF Transport | Prevents triggering GitHub REST API secondary rate limits (`403 Secondary Rate Limit Exceeded`). |
| **Commit Message Format** | `undone(sync): update workspace [epoch: <epoch>]` | Sync Coordinator | Deterministic commit message enabling parsing of synchronization epoch and automated audit trails. |

---

## 5. Account, Identity & Repository Binding Rules

1. **Private Visibility Mandatory:**
   - Undone synchronization **strictly prohibits** public GitHub repositories.
   - The coordinator validates repository visibility during preview and aborts binding if `repository.private !== true`.
2. **Deterministic Binding Epoch:**
   - Every active repository binding maintains a monotonically increasing `bindingEpoch: number`.
   - Disconnecting or unbinding immediately increments the epoch, rendering any delayed, in-flight callbacks or asynchronous write operations obsolete.
3. **Account Isolation:**
   - IndexedDB databases are strictly partitioned by authenticated user ID (`workspace_${userId}`).
   - Switching accounts or logging out resets in-memory coordination states and severs the active database connection.
4. **No Plaintext Secrets:**
   - GitHub OAuth access tokens and refresh tokens are stored exclusively in PostgreSQL encrypted via AES-GCM-256 with keys derived via HKDF (`auth-host-assets.md`).
   - Zero tokens or authorization credentials exist in `localStorage`, `sessionStorage`, or client-side IndexedDB.

---

## 6. Migration & Reverse-Mapping Rules (Addressing E1 Findings)

The inventory in E1 uncovered three major architectural risks in the legacy notes system. The following rules govern production migration:

1. **Resolution of Unscoped `localStorage` Keys:**
   - The legacy `canvas.repository.ts` stores data under global keys `sidequesthq.canvas.${noteId}` and `sidequesthq.canvas.backup.${noteId}` without user scoping.
   - **Migration Rule:** The migration reader must read legacy keys only once upon explicit user migration, associate them with the authenticated `userId`, commit them into `workspace_${userId}` in IndexedDB, and mark them as migrated.
2. **Elimination of Destructive 10MB Image Trimming:**
   - Legacy `canvas.repository.ts` automatically strips embedded images from largest to smallest if serialized scene exceeds 10MB, and the emergency backup strips 100% of images on quota errors.
   - **Migration Rule:** The local-first engine **strictly bans** image trimming. If a canvas note exceeds storage limits, it is flagged with a storage warning and persisted atomically with assets intact or rolls back completely. Under no circumstances are images deleted to fit a quota.
3. **Resolution of Server Canvas Retrieval Black Hole:**
   - Legacy `/api/workspace/canvas/route.ts` has a `POST` handler but no `GET` handler, and MongoDB `WorkspaceRepository` has `saveCanvas` but no `getCanvas`.
   - **Migration Rule:** The local-first architecture eliminates MongoDB canvas storage as the source of truth. IndexedDB is the primary local store; GitHub is the remote backup/sync store. The legacy MongoDB endpoint is deprecated and retired.

---

## 7. Versioning & Future Extension Policy (R3 Deferrals)

1. **Checkpoint Payloads Excluded:**
   - Release R1 and R2 synchronize only the current workspace state snapshot. Checkpoint payloads (time-travel revisions, historical diff trees, named milestones) are explicitly excluded from the v1 schema.
   - R3 introduces versioned checkpoint manifests (`undone/checkpoints/<timestamp>.json`) as an additive, backward-compatible extension. Old clients will ignore unknown directories in the Git tree.
2. **Schema Compatibility Gate:**
   - The root manifest declares `manifestVersion: 1`. Future schema increments must provide deterministic forward-only migration transformers.
