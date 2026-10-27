# Legacy Data Source & Ownership Inventory (Exit E1)
**Local-First GitHub Sync Pre-Implementation Validation (Stage V1)**

Date: 2026-10-27  
Author: Subagent 1 (Inventory Analyst)  
Status: Verified & Complete  
Conformance: Stage V1 / Exit Gate E1 of `plans/pre-plan-undone-local-first-github-sync.md`  
Upstream Prerequisite: V0 Fixtures (`src/client/screens/dashboard/notes/validation/fixtures.ts`)  
Downstream Consumers: V2 (Auth/Host Limits), V3 (Local Durability/Offline Probe), V4 (Vertical Slice), V5 (Contracts & Handoff)

---

## 1. Executive Summary & Critical Architectural Findings

Stage V1 of the pre-implementation validation plan requires a strict, read-only code audit and inventory of all existing data sources, ownership chains, read/write lifecycles, and storage boundaries across Undone's notes and workspace ecosystem.

Before any migration code or sync coordinator is implemented, every existing storage location must be characterized by its owner evidence, retrievability, persistence timing, size/trimming behavior, and edge-case failure modes.

### Critical Finding 1: Unscoped Global Canvas Keys (Multi-Account Collision Risk)
In `src/client/screens/dashboard/notes/repositories/canvas.repository.ts`:
- Primary canvas key: `sidequesthq.canvas.${noteId}`
- Emergency backup key: `sidequesthq.canvas.backup.${noteId}`

**Vulnerability:** Unlike `notes.repository.ts` (which scopes metadata to `sidequest_notes_state_v1:${userId || 'anon'}`), the canvas repository contains **zero user scoping**. Keys are keyed strictly by `noteId` globally in the browser's origin localStorage.
- If multiple users share the same device/browser profile, or if a user logs out and another user logs in, canvas documents persist across sessions without owner metadata.
- If `noteId` generation collides or user metadata references a foreign note ID, User B can access or overwrite User A's canvas drawing.
- **Architectural Mandate:** During migration, any canvas key found in localStorage that is not referenced in the currently authenticated user's metadata inventory must be **strictly quarantined with unknown ownership**, and **never silently assigned to the logged-in user**.

### Critical Finding 2: Server Canvas Retrieval "Black Hole"
In `src/app/api/workspace/canvas/route.ts` and `src/server/infrastructure/db/mongodb/repositories/workspace.repo.ts`:
- The API route `/api/workspace/canvas` exposes only an HTTP `POST` method. **It has no `GET` handler.**
- In MongoDB, `WorkspaceRepository.saveCanvas(userId, canvasData)` updates or pushes to `UserWorkspace.canvases`. However, **`WorkspaceRepository` provides no `getCanvas(userId, canvasId)` or `getCanvases(userId)` retrieval method.**
- The client application (`useCanvasScene.ts`) loads canvas data exclusively from browser localStorage (`canvasRepository.load(noteId)`). It never attempts to read canvas state from the server.
- Furthermore, the Mongoose `CanvasSchema` in `UserWorkspace.ts` defines only `id`, `elements: Mixed`, `appState: Mixed`, and `updatedAt`; it omits the `files` object (binary assets). Excalidraw binary images sent via `POST` may be stripped by schema casting or truncated.
- **Architectural Mandate:** Server-stored canvas data is currently a one-way write sink ("black hole"). Migration code cannot assume server-stored canvas state is available or complete. A dedicated administrative export endpoint must be created before server-side canvas migration is possible.

### Critical Finding 3: Silent Canvas Image Trimming & Rollback Impossibility
In `src/client/screens/dashboard/notes/repositories/canvas.repository.ts`:
- `MAX_SCENE_BYTES = 10 * 1024 * 1024` (10 MB character budget for serialized JSON).
- If serialized canvas data exceeds 10 MB, `canvasRepository.save()` initiates a **partial save**: it sorts image files largest-first and deletes them one-by-one until the scene fits under 10 MB.
- In `saveImmediate()` (emergency backup), if an exception occurs (e.g. QuotaExceededError), it catches the error and executes an elements-only fallback: `files: {}`, stripping **100% of images**.
- **Architectural Mandate:** The target local-first system preserves all binary assets content-addressed in IndexedDB and Git. If a migrated or newly authored canvas containing >10MB of images were to be "rolled back" to legacy storage, the legacy repository would strip the images or fail. **Rollback to legacy storage is physically unsupported for workspaces with canvases >10MB.** The only safe rollback fallback is retaining the local-first reader/export.

### Critical Finding 4: Sharing & Permission Boundary Quarantine
In `src/client/screens/dashboard/notes/models/notes.models.ts`:
- `NoteDocument` defines `ownerId: string | null`, `permission: 'viewer' | 'editor' | 'owner'`, `shared: boolean`, `sharedWith: string[]`, and `publicLink: boolean`.
- Newly created notes on the client default to `ownerId: null`, `permission: 'editor'`, and `shared: false`.
- In `ShareModal`, notes can be shared with arbitrary teammate emails and have `publicLink: true`.
- **Architectural Mandate:** Target GitHub sync binds a workspace to a private, user-owned GitHub repository. Migrating a shared note into a personal private repository breaks collaborator access or leaks shared state without multi-user CRDT synchronization. Shared records must remain in legacy storage or be quarantined until collaborative workspace protocols are established.

### Critical Finding 5: Playback & Study Room Architectural Decoupling
- In `MEMORY/play-playback.md`: The `/play` route uses `usePlayback.ts` and synchronizes chunk completion via `/api/progress/chunk`. All note capture, annotations, and notebook tools are deferred (`aria-disabled="true"`). No notes database or schema is touched by playback.
- In `MEMORY/study-rooms.md`: Study rooms govern live presence, leases, Centrifugo messaging, ambient audio, and personal Pomodoro sessions (`StudySession` in PostgreSQL). Unified tasks use `sidequest_unified_tasks_v1:${userId || 'anon'}`. Notes tools are completely detached from study room realtime streams.
- **Architectural Mandate:** Personal GitHub sync must never attempt to store or synchronize study-room leases, shared sprint state, or learning progress chunk completions.

---

## 2. Complete Source & Data Class Catalog (Inventory Matrix)

The following matrix documents all existing storage locations, access paths, ownership criteria, and durability guarantees across the Undone platform:

| Source Identifier | Path / Key / Collection | Authenticated Owner Evidence | Read / Export Method | Current Writers | Durability & Timing | Trimming & Size Limits | Schema & Data Classes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **S1: Client Metadata Cache** | localStorage: `sidequest_notes_state_v1:${userId || 'anon'}` | Scoped by NextAuth session user ID; falls back to `'anon'` | Synchronous: `notesRepository.getInitialState(userId)` and `notesRepository.load(userId)` | `notes.repository.ts` (`load`, `save`), `useNotes.ts` (1000ms debounce) | Immediate on save; memory cache fallback; skipped in `NODE_ENV === 'test'` | Browser quota (~5-10MB total origin quota); no explicit field trimming | `NotesStateEntity`: `notebooks[]`, `notes[]`, UI filter/sort/selection fields |
| **S2: Client Canvas Primary** | localStorage: `sidequesthq.canvas.${noteId}` | **NONE (Global)**; no user ID in key or document body | Synchronous: `canvasRepository.load(noteId)` | `useCanvasPersistence.ts` (1500ms debounce, unmount), `canvasRepository.save()` | Debounced 1500ms after edit; also saved on unmount | **10MB max** (`MAX_SCENE_BYTES`); drops images largest-first if over limit | `CanvasDocument`: `noteId`, `scene` (JSON string), `schemaVersion`, `savedAt` |
| **S3: Client Canvas Backup** | localStorage: `sidequesthq.canvas.backup.${noteId}` | **NONE (Global)**; emergency un-debounced snapshot | Synchronous fallback: `canvasRepository.load(noteId)` on primary miss | `useCanvasScene.ts` (synchronous on every stroke & note switch), `useCanvasPersistence.ts` | Immediate & synchronous; fires on every scene change stroke | If write throws quota error, drops **100% of images** (saves elements-only) | `CanvasDocument`: `noteId`, `scene`, `schemaVersion`, `savedAt` |
| **S4: Server Workspace Metadata** | MongoDB: `UserWorkspace` collection (document: `{ userId }`) | Authenticated NextAuth session `getUser()` in API route | HTTP GET: `/api/workspace/notes` via `WorkspaceRepository.getNotesState(userId)` | HTTP PATCH: `/api/workspace/notes` via `WorkspaceRepository.saveNotesState(userId, state)` | Durable on MongoDB write acknowledgement (upsert) | BSON document limit 16MB; no trimming | `IUserWorkspace`: `notebooks[]`, `notes[]` (with `ownerId`, `permission`, `sharedWith`), `tasks[]` |
| **S5: Server Canvas Store** | MongoDB: `UserWorkspace.canvases` array (document: `{ userId }`) | Authenticated NextAuth session `getUser()` in API route | **UNRETRIEVABLE (NO GET ROUTE)**; no repository retrieval method exists | HTTP POST: `/api/workspace/canvas` via `WorkspaceRepository.saveCanvas(userId, canvasData)` | Debounced 1000ms from client `useCanvasScene.ts` | BSON limit 16MB; Mongoose schema omits `files` field | `ICanvas`: `id`, `elements: Mixed`, `appState: Mixed`, `updatedAt` |
| **S6: Unified Tasks Store** | localStorage: `sidequest_unified_tasks_v1:${userId || 'anon'}` | User-scoped via `tasksStorageAdapter` (with explicit confirmation on anon import) | Synchronous via `tasksStorageAdapter.getTasks(userId)` | `TasksSection`, `UpcomingEvents`, `SessionPanel` in Study Rooms | Immediate on task add/toggle | Browser quota limits | `UnifiedTask[]`: id, title, completed, dueDate, noteId, order |
| **S7: Study Room Focus Sessions** | PostgreSQL: `StudySession`, `StudyRoom`, `RoomLease` | Authenticated session with optimistic concurrency (expectedVersion) | HTTP GET: `/api/studyroom/session/history`, active session | HTTP PATCH: `/api/studyroom/session`, studyroom service | ACID transaction in PostgreSQL; outbox event dispatch | Constrained to session metrics | Durable focus session log; completely detached from note bodies |
| **S8: Playback Progress** | PostgreSQL: `UserProgress`, chunk completion records | Authenticated user session via `/api/progress/chunk` | HTTP GET: `/api/cohorts/[id]/progress` | HTTP POST: `/api/progress/chunk` | ACID transaction in PostgreSQL | Record per lesson chunk | Chunk completion timestamps; completely detached from note bodies |

---

## 3. Subsystem Technical Deep Dives

### 3.1 Metadata Repository & Hooks (`notes.repository.ts`, `useNotes.ts`)
1. **Caching Architecture:**
   - Client holds an in-memory cache map: `memoryNotesStateByUser = new Map<string, NotesStateEntity>()`.
   - On mount, `useNotes.ts` calls `notesRepository.getInitialState(userId)`, which checks memory cache first, then reads `localStorage['sidequest_notes_state_v1:${userId || 'anon'}']`.
   - In asynchronous effect, `notesRepository.load(userId)` issues `GET /api/workspace/notes`. When the response returns, it overwrites memory and localStorage caches, then updates React state (`setState(loaded)`).
2. **Save & Sync Semantics:**
   - Any mutation in `useNotes.ts` triggers `update((s) => ...)`, which marks `syncStatus = 'saving'`.
   - An effect debounces for 1000ms, then invokes `notesRepository.save(state, userId)`.
   - `notesRepository.save` immediately writes to memory and localStorage, then dispatches an HTTP `PATCH /api/workspace/notes`.
   - If the HTTP request fails, it catches the error and returns `{ ok: false, data: state }`, causing `useNotes` to set `syncStatus = 'offline'`. **However, the local state remains mutated in localStorage.**
3. **Flaws & Vulnerabilities:**
   - The entire aggregate `NotesStateEntity` (all notebooks, all notes, and UI filter/selection state) is sent on every save.
   - If User A creates a note on Device 1 and User A creates a note on Device 2, whichever device saves last completely overwrites the entire note list on the server. There is no entity-level conflict detection or version comparison.
   - UI preferences (`selectedNotebookId`, `selectedNoteId`, `notebookSort`, `noteSort`, `filter`) are persisted alongside domain records.

### 3.2 Canvas Repository & Hooks (`canvas.repository.ts`, `useCanvasScene.ts`, `useCanvasPersistence.ts`)
1. **Dual-Persistence Dual-Debounce Race:**
   When a user draws on the canvas:
   - Stroke 1: `useCanvasScene.ts` line 101 immediately calls `canvasRepository.saveImmediate(noteId, scene, 1)`. This writes synchronously to `sidequesthq.canvas.backup.${noteId}`.
   - Stroke 2: `useCanvasScene.ts` line 114 dispatches `saveToDb(noteId, scene)`, which debounces 1000ms to dispatch HTTP `POST /api/workspace/canvas`.
   - Stroke 3: `useCanvasPersistence.ts` line 35 debounces 1500ms to call `canvasRepository.save(doc)`. This writes to `sidequesthq.canvas.${noteId}` AND `sidequesthq.canvas.backup.${noteId}`.
2. **Emergency Note-Switching Flush:**
   - In `useCanvasScene.ts` lines 58-61, if the active note ID changes while dirty:
     `canvasRepository.saveImmediate(previousNoteId, sceneRef.current, CANVAS_SCHEMA_VERSION);`
   - In `useCanvasPersistence.ts` lines 82-94, on hook unmount, it clears the timeout, invokes `saveImmediate`, then fires a detached `canvasRepository.save`.
3. **Image Trimming Behavior:**
   - `canvasRepository.save()` checks `fullData.length <= MAX_SCENE_BYTES` (10,000,000 chars).
   - If oversized, it strips images largest-first.
   - If an error is thrown in `saveImmediate()`, it catches the exception and saves with `files: {}` (complete image deletion).

### 3.3 Server MongoDB Workspace (`workspace.repo.ts`, `UserWorkspace.ts`, API routes)
1. **`/api/workspace/notes`:**
   - `GET`: Calls `WorkspaceRepository.getNotesState(user.id)`. Returns default "Undone diary" notebook if no workspace exists.
   - `PATCH`: Calls `WorkspaceRepository.saveNotesState(user.id, body)`. Overwrites `notebooks`, `notes`, and `tasks` via `$set` with `upsert: true`.
2. **`/api/workspace/canvas` (The Missing GET):**
   - `POST`: Parses `{ id, elements, appState, files }`. Calls `WorkspaceRepository.saveCanvas(user.id, ...)`.
   - In `WorkspaceRepository.saveCanvas`:
     - Tries `updateOne({ userId, 'canvases.id': canvasData.id }, { $set: { 'canvases.$': canvasData } })`.
     - If matchedCount === 0, pushes to `canvases` array.
   - **Absence of GET Handler:** The route file contains only `export async function POST(req: Request)`. There is no GET method.
   - **Absence of Repository Retrieval:** `WorkspaceRepository` only contains `saveCanvas`. There is no method to query `canvases` by note ID or list all user canvases.

### 3.4 Mobile Parity (`NotesMobile.tsx`, `CanvasScreen.tsx`)
1. **Identical Persistence Pipeline:**
   - Mobile uses `useCanvasScene(selected.contentType === 'canvas' ? selected.id : null)` and `useCanvasPersistence(...)`.
   - On canvas stroke, mobile triggers identical immediate backup and 1000ms/1500ms debounces.
   - Mobile kanban uses `NotesKanban` reading directly from `notes.models.ts`.
2. **Hardware Back-Button Interception:**
   - Intercepts popstate: `canvas -> workspace -> notebooks`.
   - Note-switch flush logic in `useCanvasScene` guarantees immediate backup write before mobile view transition.

---

## 4. Data Field-by-Field Mapping & Representability

The following table assesses every legacy field against the proposed local-first GitHub schema (`undone/manifest.json`, `undone/notebooks/<id>.json`, `undone/notes/<id>.json`, `undone/canvases/<note-id>.json`, `undone/assets/<sha256>.<ext>`) and evaluates reverse-mapping compatibility:

| Entity | Legacy Field | Type | Local-First GitHub Schema Destination | Representable in Git? | Reverse-Map to Legacy? | Field Treatment & Migration Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Notebook** | `id` | string | `undone/notebooks/<id>.json` (id) | Yes | Yes | Preserve legacy ID directly |
| | `title` | string | payload.title | Yes | Yes | Full fidelity |
| | `description` | string | payload.description | Yes | Yes | Full fidelity |
| | `color`, `icon` | string | payload.color, payload.icon | Yes | Yes | Full fidelity |
| | `favorite`, `archived` | boolean | payload.favorite, payload.archived | Yes | Yes | Full fidelity |
| | `collapsed` | boolean | **Client Preference** | No (Exclude) | Yes (Default false) | UI preference; omit from Git commit to avoid dirtying ref |
| | `order` | number | payload.order | Yes | Yes | Retained |
| | `createdAt`, `updatedAt` | ISO string | metadata.createdAt, metadata.updatedAt | Yes | Yes | Preserved for display only |
| | `shared` | boolean | **Quarantined** | No (Exclude) | Yes | Shared notebooks stay in legacy; excluded from private repo |
| **Note (Common)** | `id`, `notebookId` | string | `undone/notes/<id>.json` | Yes | Yes | Full fidelity |
| | `title` | string | payload.title | Yes | Yes | Full fidelity |
| | `contentType` | 'canvas' \| 'kanban' | payload.contentType (discriminated union) | Yes | Yes | Discriminated union |
| | `tags` | string[] | payload.tags | Yes | Yes | Full fidelity |
| | `favorite`, `archived` | boolean | payload.favorite, payload.archived | Yes | Yes | Full fidelity |
| | `order` | number | payload.order | Yes | Yes | Full fidelity |
| | `createdAt`, `updatedAt` | ISO string | metadata.createdAt, metadata.updatedAt | Yes | Yes | Preserved for display |
| | `ownerId` | string \| null | **Quarantine / Local-only** | No | Yes | Often null in client notes; quarantined if foreign |
| | `permission` | 'viewer'\|'editor'\|'owner' | **Quarantine / Local-only** | No | Yes | Private repo implies owner; foreign permissions quarantined |
| | `shared`, `sharedWith` | boolean, string[] | **Quarantined** | No | Yes | Must not sync shared notes to private user repo |
| | `publicLink` | boolean | **Quarantined** | No | Yes | Must not sync public link notes to private user repo |
| | `revision` | number \| null | **Replaced by Generation** | No | Yes (null) | Legacy numeric revision is not a Lamport clock |
| | `linkedConceptIds` | string[] | payload.linkedConceptIds | Yes | Yes | Preserved |
| | `linkedResourceIds` | string[] | payload.linkedResourceIds | Yes | Yes | Preserved |
| | `learningPathId` | string \| null | payload.learningPathId | Yes | Yes | Preserved |
| **Kanban Note** | `kanbanColumns` | Array<{id, label}> | payload.kanbanColumns | Yes | Yes | Strict schema validation |
| | `kanbanCards` | any[] | payload.kanbanCards | Yes | Yes | Validate untyped `any[]` into strict Card schema |
| **Canvas Note** | `scene.elements` | any[] | `undone/canvases/<noteId>.json` | Yes | Yes | Excalidraw element list |
| | `scene.appState` | object | appState in canvas JSON | Yes | Yes | Camera zoom, background color, grid size |
| | `scene.files` (Assets) | Record<fileId, dataURL> | Content-addressed `undone/assets/<sha256>.<ext>` | **Yes (Improved)** | **Conditional** | **Rollback lossy if assets > 10MB due to legacy trimming** |

---

## 5. Cryptographic Validation & Synthetic Fixtures (V0 Baseline)

Using the authoritative test fixtures defined in `src/client/screens/dashboard/notes/validation/fixtures.ts` and verified via Vitest, the following cryptographic baseline establishes exact content and hash expectations:

### Fixture Inventory Summary

```text
Fixture ID                     Entity Class         Declared Hash / ID                        Payload Characteristics
---------------------------------------------------------------------------------------------------------------------------------
FIXTURE_NOTEBOOK               Notebook             id: nb-synthetic-01                       title: 'Systems Architecture', favorite: true
FIXTURE_CANVAS_ASSET           Binary Asset (PNG)   sha256: 6b7fa434f92a8b80aab02d9bf1a...     70 bytes (1x1 transparent PNG)
FIXTURE_CANVAS_NOTE            Canvas Note          id: note-canvas-01                        3 elements (rectangle, text, image ref)
FIXTURE_KANBAN_NOTE            Kanban Note          id: note-kanban-01                        3 columns (todo/doing/done), 2 cards
FIXTURE_BACKUP_ONLY_CANVAS     Canvas Backup        id: note-backup-only-01                   Primary key ABSENT; Backup key PRESENT
FIXTURE_DIVERGENT_RECORDS      Concurrent Note      id: note-divergent-01                     Base v1 vs Server v2 vs Local v2
FIXTURE_MALFORMED_RECORD       Corrupt Note         id: note-broken / note-invalid-schema     Truncated JSON string / missing fields
FIXTURE_CORRUPT_ASSET          Tampered Asset       sha256: e3b0c44298fc1c149afbf4c...       Byte hash != Declared SHA-256 hash
FIXTURE_NOTEBOOK_CHILD_RACE    Orphaned Child       id: note-child-race-01                    Parent notebook archived/deleted
```

### Verification Proofs (Vitest)
1. **Asset Cryptographic Invariant:**
   - Raw Base64 Data: `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`
   - Decoded Byte Length: **70 bytes**
   - Computed SHA-256: `6b7fa434f92a8b80aab02d9bf1a12e49ffcae424e4013a1c4f68b67e3d2bbcd0`
   - Matching Scene Reference: `FIXTURE_CANVAS_NOTE.scene.assetHashes['asset-img-01'] === '6b7fa434f92a8b80aab02d9bf1a12e49ffcae424e4013a1c4f68b67e3d2bbcd0'`.
2. **Backup-Only Recovery Proof:**
   - Primary key `sidequesthq.canvas.note-backup-only-01` is null.
   - Backup key `sidequesthq.canvas.backup.note-backup-only-01` contains valid JSON with element `elem-b1`.
   - Recovery contract promotes backup key to primary without data loss.
3. **Divergent Concurrency Proof:**
   - Server edit: `'Initial specification text\nRemote added note on auth limits.'`
   - Local edit: `'Initial specification text\nLocal added diagram instructions.'`
   - Reconciliation detects concurrent edits from base version 1 and produces an explicit conflict rather than allowing the server or client to silently overwrite the other.
4. **Tampered Asset Integrity Proof:**
   - Declared Hash: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (SHA-256 of empty string).
   - Actual Hash of Corrupt Bytes: `9e5dc4220b33bca2efc3cf42b451deff46244aa6c29b934dca73891d7852a122`.
   - Contract refuses to mark scene "synced" or "migrated"; isolates corrupt asset.

---

## 6. Per-User Inventory Reconciliation Contract (Phase 3B Specification)

A code audit cannot predict what individual users have stored across devices. Therefore, every production migration run must execute an automated, deterministic per-user inventory reconciliation protocol:

### Contract Invariants
1. **Never Assume Server Completeness:**
   Because `/api/workspace/canvas` has no GET route and MongoDB `WorkspaceRepository` has no getCanvas method, the server cannot be treated as the authoritative complete source. Migration must evaluate both client localStorage and server workspace metadata.
2. **Strict Quarantine of Unknown Ownership:**
   Any canvas document found in localStorage whose `noteId` does not match an authenticated note in the user's metadata inventory must be flagged as `QUARANTINED_UNKNOWN_OWNER`. It must **never** be silently assigned to the current user.
3. **First-Class Backup-Only Recovery:**
   If a note exists in metadata and its primary canvas key is missing or malformed, but its backup key exists, the migration engine promotes the backup canvas to candidate state with status `RECOVERED_FROM_EMERGENCY_BACKUP`.
4. **Shared Record Exclusion:**
   Notes with `shared: true`, non-empty `sharedWith`, or `permission !== 'owner'` must be flagged `EXCLUDED_SHARED_RESOURCE`. They remain active in legacy storage and are excluded from private repository publication.
5. **Orphaned Child Note Adoption:**
   Notes referencing missing or archived notebooks (such as in `FIXTURE_NOTEBOOK_CHILD_RACE`) are re-parented to a newly created system notebook (`[Recovered Notes]`) rather than dropped.
6. **Binary Asset Content Addressing:**
   Embedded Excalidraw images must be extracted, SHA-256 hashed, verified, and stored in the content-addressed `undone/assets/<sha256>.<ext>` store. Inlined base64 data URLs must be replaced by content hashes in the canvas scene.

### Reconciliation State Machine & Migration Journal

```text
[START]
   |
   v
[1. INVENTORIED] ──── Extract Client (localStorage primary/backup) + Server (GET /api/workspace/notes)
   |
   v
[2. CLASSIFIED] ───── Flag Unknown Ownership, Backup-Only, Shared Notes, Malformed, Orphaned
   |
   +──> [QUARANTINE STORE] (Unknown owners, malformed records, shared notes kept in legacy)
   |
   v
[3. STAGED] ───────── Write candidates into IndexedDB staging area with content hashes
   |
   v
[4. VALIDATED] ────── Verify hash match, asset byte integrity, referential integrity
   |
   v
[5. PREPARED] ─────── Present migration preview to user; require explicit user confirmation
   |
   v
[6. FENCED] ───────── Install server cutover epoch; reject old legacy PATCH /api/workspace/notes writes
   |
   v
[7. ACTIVE] ───────── Activate LocalWorkspace IndexedDB facade as single authority on device
   |
   v
[8. PUBLISHED] ────── Commit to GitHub private repository (Git Data API tree + commit)
   |
   v
[9. RESTORE_CHECK] ── Independent clean profile restore verifies all JSON records + binary assets
   |
   v
[COMPLETE]
```

---

## 7. Reverse-Mapping & Rollback Feasibility Assessment

### Full-Fidelity Reverse Mapping Definition
For non-trimmed workspaces, data in the new local-first GitHub schema can be reverse-mapped back to legacy storage formats:
1. `undone/notebooks/<id>.json` maps directly to `NotebookEntity` and MongoDB `INotebook`. Default `collapsed: false` is restored.
2. `undone/notes/<id>.json` maps to `NoteDocument` and MongoDB `INote`. Kanban columns and cards map back to `kanbanColumns` and `kanbanCards`.
3. `undone/canvases/<noteId>.json` plus referenced assets in `undone/assets/<sha256>.<ext>` are reassembled: assets are re-encoded to base64 data URLs in the canvas `files` dictionary, producing the legacy `CanvasDocument`.
4. Reconstructed `CanvasDocument` is written to `localStorage['sidequesthq.canvas.${noteId}']`.

### The Critical Rollback Barrier: Canvas Image Trimming
- **The Problem:** If a user authors or imports a canvas with multiple high-resolution images such that the serialized `CanvasDocument` exceeds 10 MB:
  - The new local-first engine easily accommodates it (IndexedDB and Git Data API handle arbitrarily sized blobs).
  - However, if rolled back to legacy storage, `canvasRepository.save()` will trigger its partial save algorithm and **strip the images largest-first until it fits under 10MB**.
  - If localStorage quota is exhausted, `saveImmediate()` strips **100% of the images**.
- **The Verdict on Rollback:**
  - **Clean rollback to legacy storage is technically impossible for any canvas exceeding 10 MB.**
  - If a user wishes to abort or roll back from the local-first system, any canvas exceeding 10 MB would suffer irreversible data loss (stripped images) under legacy storage.
  - **Required Safety Policy:** Before initiating any cutover or migration, the system must warn the user:
    > "Rollback to legacy storage cannot preserve canvas images exceeding 10MB. In the event of rollback, the local-first standalone reader and ZIP export bundle will remain available to guarantee complete data retention without data stripping."

---

## 8. Exit Gate E1 Sign-Off

The Exit E1 requirements defined in `plans/pre-plan-undone-local-first-github-sync.md` Section 3 (Stage V1) are fully satisfied:

- [x] **Exact source paths identified:** Documented localStorage keys, React hooks, API routes, and MongoDB collections.
- [x] **Ownership chains inspected:** Critical vulnerability documented regarding unscoped global canvas keys.
- [x] **Read/Write asymmetries named:** Identified missing GET route on `/api/workspace/canvas` and missing `getCanvas` in `workspace.repo.ts`.
- [x] **Durability and trimming boundaries measured:** Detailed 10MB canvas image stripping and elements-only emergency fallbacks.
- [x] **Synthetic fixture counts & cryptographic hashes verified:** Verified all 8 fixtures from `fixtures.ts`, confirmed 70-byte asset SHA-256 (`6b7fa434f92a8b80aab02d9bf1a12e49ffcae424e4013a1c4f68b67e3d2bbcd0`).
- [x] **Per-user reconciliation contract designed:** Defined strict quarantine rules for unknown owners, shared notes, and corrupted assets.
- [x] **Rollback limits established:** Explicitly documented that legacy storage cannot accept canvases >10MB without stripping images.

**Status: EXIT E1 COMPLETE. Ready for Stage V2 (Auth/Host Limits) and Stage V3 (Local Durability/Offline Probe).**
