# Notes — Holes, Bugs & Architectural Issues

> Everything wrong with the current Notes backend, organized by severity.

---

## 🔴 CRITICAL — Data Integrity & Correctness

### 1. Schema Mismatch: Client Model ≠ MongoDB Schema
The TypeScript types in `notes.models.ts` (client) don't match `UserWorkspace.ts` (server).

| Field | Client (`NoteDocument`) | MongoDB (`INote`) |
|---|---|---|
| `publicLink` | `boolean` | `string \| undefined` |
| `contentType` | `'canvas' \| 'kanban'` | `'canvas' \| 'kanban' \| 'markdown'` |
| `linkedConceptIds` | `string[]` | ❌ doesn't exist |
| `linkedResourceIds` | `string[]` | ❌ doesn't exist |
| `learningPathId` | `string \| null` | ❌ doesn't exist |
| `revision` | `number \| null` | ❌ doesn't exist |
| `content` | ❌ not in client type | `string` (exists in DB) |
| `createdAt` | `string` (required) | ❌ not in INote schema |

**What this means:** Notes being saved have phantom fields (`linkedConceptIds`, etc.) that Mongoose may or may not strip. The actual note `content` field exists in MongoDB but doesn't appear in the client model — the client is creating notes with no content field.

### 2. No Input Validation on PATCH
```ts
// route.ts line 50-51
const body = await request.json();
await WorkspaceRepository.saveNotesState(user.id, body);
```
Any JSON reaches MongoDB. A client sending `{ notebooks: null, notes: "hello", tasks: 42 }` would corrupt the document. No Zod, no schema check, no type guard.

### 3. The `content` Field Is Missing
`INote` in Mongoose has a `content: string` field (line 29 of `UserWorkspace.ts`). `NoteDocument` in the client model has no `content` field. Notes are being created in the browser with no content, and there's no UI to populate it. The field exists in schema but is never used.

### 4. Client-Generated IDs, No Uniqueness Guarantee
IDs are created as:
```ts
const id = (p: string) => `${p}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
```
`Math.random()` is not cryptographically unique. If two tabs are open and both create a notebook at the same millisecond, you get a collision. MongoDB has no uniqueness constraint on subdocument `id` fields.

### 5. `selectedNotebookId` / `selectedNoteId` — Never Persisted
`getNotesState()` always returns:
```ts
selectedNotebookId: null,
selectedNoteId: null,
```
These are local UI state that never save to DB. Fine in isolation — but `saveNotesState` receives `state` which INCLUDES these fields (from the client's full state). They get sent up, then `$set` only saves `notebooks/notes/tasks`. The selection is silently discarded. No data loss, but wasted bandwidth on every save.

---

## 🟠 HIGH — Performance & Reliability

### 6. Whole-Document Overwrite on Every Keystroke
Every state change (including typing a character) triggers:
```
PATCH /api/workspace/notes → $set { notebooks: [...ALL], notes: [...ALL], tasks: [...ALL] }
```
If you have 200 notes and 20 notebooks, you're serializing and shipping ALL of that on every single change. No debouncing, no diffing, no dirty tracking.

### 7. Double Save on Page Load
The save `useEffect` has no mount guard. On initial load:
1. `notesRepository.load()` → GET → `setState(data)`
2. `[state]` effect fires → `notesRepository.save(state)` → PATCH

Every page open writes data right back to the DB. It's the same data (so no corruption), but it's a wasted write on every single page load.

### 8. Three Uncoordinated Canvas Save Paths
On every Excalidraw scene change:
- Path A: `saveImmediate()` → sync localStorage backup
- Path B: `setSaveTrigger()` → `useCanvasPersistence` debounced 1500ms → localStorage primary
- Path C: `saveToDb()` → debounced 1000ms → POST to API → MongoDB

Path C fires first (1000ms). Path B fires second (1500ms). They're not coordinated. If localStorage and MongoDB diverge (crash between 1000ms and 1500ms marks), the source of truth is ambiguous. Canvas `load()` only reads localStorage — MongoDB canvas data is never read back by the client.

### 9. MongoDB: One Document, No Document-Level Limits
A user with 500 notes, each containing large `kanbanCards: any[]` data, could have a document approaching MongoDB's 16MB limit. There's no guard against this. If you hit 16MB, the `updateOne` fails silently (unhandled in the repo — the API returns 500).

### 10. `connectToMongoDB()` Called Per-Method, Not Per-Request
Every repository method starts with `await connectToMongoDB()`. This is fine (it returns cached conn fast), but it means 7 `await connectToMongoDB()` calls if you call 7 repo methods in a request. It's low overhead but architecturally messy — connection management is scattered.

---

## 🟡 MEDIUM — Structural / Design Issues

### 11. `window.confirm()` Inside State Update Functions
```ts
deleteNotebook: (notebookId: string) =>
  update((s) => {
    if (!confirm('Delete this notebook and its notes?')) return s; // ← 🚫
    ...
  })
```
`window.confirm()` is a blocking browser dialog called inside a React state updater. This works but it's terrible: (1) blocks the main thread, (2) can't be tested, (3) can't be styled, (4) React 18 concurrent mode can call state updaters multiple times which would trigger multiple confirm dialogs.

### 12. Default State Hardcoded in Route Handler
```ts
// route.ts lines 12-36
if (!state) {
  return NextResponse.json({
    notebooks: [{ id: 'nb-diary', title: 'SideQuestHQ diary', ... }],
    ...
  });
}
```
Business logic (what the default workspace looks like) is in the API route handler. Should be in a service or config. If you ever want to change the default notebook, you have to find it buried in a route.

### 13. `WorkspaceRepository` Has Too Many Responsibilities
It handles: workspace creation, canvas save, notes list, recent views, settings, notes state get, notes state save. These are conceptually distinct features crammed into one class. There's no separation between canvas repo, notes repo, and workspace repo.

### 14. No Service Layer — Repository Called Directly from Route
```ts
// route.ts
await WorkspaceRepository.saveNotesState(user.id, body);
```
There's no service/use-case layer. Business logic that should live in a service (e.g., "what happens when you create a new user's first workspace?") is split between the route handler and the repo.

### 15. `getOrCreateWorkspace` Is Never Called on Notes Load
`getNotesState()` does:
```ts
const workspace = await UserWorkspace.findOne({ userId }).lean();
if (!workspace) return null;
```
If the workspace doesn't exist, it returns `null` and the route returns a hardcoded default. `getOrCreateWorkspace` (which would actually create it) is unused in the notes flow. A new user's workspace is created lazily by `saveNotesState`'s `{ upsert: true }` — but only after their first save, not on first load.

### 16. `tasks` Array Is a Dead Feature
`ITask[]` exists in the schema and is fetched/saved with notes. There's no UI for tasks visible in the components, no hooks to create/edit tasks, and no API endpoints for them. It's persisted but nothing writes to it from the notes module.

### 17. MongoDB Canvas Data Never Read Back
`POST /api/workspace/canvas` saves canvas to MongoDB's `canvases[]`. But `canvasRepository.load()` reads **only from localStorage**. The MongoDB copy is a backup that's never restored from. If a user clears their browser localStorage, their canvas data is gone even though a copy exists in MongoDB.

### 18. `aiMemory` Field Is Completely Unused
`aiMemory: Record<string, any>` on `IUserWorkspace` — exists in schema, never written to, never read. Dead weight in every document.

---

## 🔵 LOW — Minor Issues

### 19. Notebook Sort/Filter Never Persisted
`notebookSort: 'manual'`, `noteSort: 'manual'`, `filter: 'all'` are always returned as literals from `getNotesState()`. User's sort preference resets on every page refresh.

### 20. `tasks` Sent in Every Notes State PATCH
`saveNotesState` always sets `tasks`. Even if tasks were empty and unchanged, they're serialized and sent with every notes mutation.

### 21. No Error Recovery in `saveNotesState`
If the MongoDB write fails, `notesRepository.save()` throws, `useNotes`' `useEffect` catches nothing (it uses `void notesRepository.save(state)` — fire and forget). The user sees no error. Their changes are lost silently on failure.

### 22. Static Class with No Interface
`WorkspaceRepository` is a static class. There's no interface (`IWorkspaceRepository`) it implements. Can't be mocked for testing, can't be swapped for a different implementation.

---

## Quick Reference: File → Problem Map

| File | Problems |
|---|---|
| `route.ts` (notes) | No validation (#2), hardcoded defaults (#12), double-save (#7) |
| `workspace.repo.ts` | Too many responsibilities (#13), no interface (#22), dead `getOrCreateWorkspace` (#15) |
| `UserWorkspace.ts` | One-doc-per-user (#CRITICAL), dead fields (#16, #18), schema mismatch (#1) |
| `useNotes.ts` | Full-blob save on every change (#6), `confirm()` in state (#11), no error recovery (#21) |
| `notes.repository.ts` | No debounce, no retry, silent failure (#21) |
| `notes.models.ts` | Schema mismatch with backend (#1), missing `content` (#3) |
| `canvas.repository.ts` | Three save paths (#8), localStorage-only reads (#17) |
| `useCanvasScene.ts` | Uncoordinated saves (#8) |
