# Notes → Canvas Migration Plan
## Excalidraw Integration Architecture for SideQuestHQ

> **Status**: Planning — no production code has been modified.  
> **Date**: 2026-08-08  
> **Scope**: Architecture discovery, design decisions, migration strategy, and phased implementation plan.

---

## Table of Contents

1. [Current-State Audit](#1-current-state-audit)
2. [Architectural Diagnosis](#2-architectural-diagnosis)
3. [Recommended Architecture](#3-recommended-architecture)
4. [Data Model](#4-data-model)
5. [Data Flow](#5-data-flow)
6. [Excalidraw Integration Boundary](#6-excalidraw-integration-boundary)
7. [Persistence Strategy](#7-persistence-strategy)
8. [HTML/Legacy Migration Strategy](#8-htmllegacy-migration-strategy)
9. [Asset / File Strategy](#9-asset--file-strategy)
10. [UX Architecture](#10-ux-architecture)
11. [Performance Strategy](#11-performance-strategy)
12. [Security Strategy](#12-security-strategy)
13. [Testing Strategy](#13-testing-strategy)
14. [Implementation Phases](#14-implementation-phases)
15. [Open Questions](#15-open-questions)
16. [Recommended First Implementation Slice](#16-recommended-first-implementation-slice)

---

## 1. Current-State Audit

### 1.1 What Actually Exists

The investigation found the following verified files and structure:

```
src/app/(dashboard)/notes/page.tsx            — Next.js route, dynamic-imports Notes
src/client/components/screens/dashboard/notes/
  Notes.tsx                                   — 541-line monolithic screen component
  Notes.module.css                            — 1033-line CSS module
  index.ts                                    — re-exports { Notes }
  adapters/notes.adapter.ts                   — sorting/filtering pure functions
  hooks/useNotes.ts                           — 334-line hook with all business logic
  models/notes.models.ts                      — NoteEntity, NotebookEntity, NotesStateEntity
  mock/notes.seed.ts                          — rich seed data for local dev
  repositories/notes.repository.ts           — localStorage read/write (20 lines)
  components/NotesComponents.tsx              — 459-line file: CanvasSwitcher, Section,
                                                Empty, IconButton, RenameInput, BookRow,
                                                Notebook, Context, Menu, ShareModal
```

### 1.2 Editor Technology

The current "editor" is a **`contentEditable` `<div>`** (`editorRef`). All formatting goes through the deprecated `document.execCommand()` API (`bold`, `italic`, `insertUnorderedList`, `insertOrderedList`, `formatBlock`, `insertHTML`). There is no Markdown parsing library, no rich-text library (ProseMirror/Tiptap/Quill), and no Excalidraw dependency anywhere in `package.json`.

The word "canvas" in the current UI is purely a CSS class name — `<article className={styles.canvas}>` is a centered white paper rectangle. The dot-grid background, floating toolbar, zoom controls, and CanvasSwitcher are all visual decoration around a plain `contentEditable` div. No actual canvas interaction exists.

### 1.3 Persistence

Persistence is **localStorage only** under the key `sidequesthq.notes.v1`. The entire `NotesStateEntity` (all notebooks, all notes including their HTML bodies) is JSON-serialized and written on every state change:

```ts
useEffect(() => {
  if (state) void notesRepository.save(state);
}, [state]);
```

There is **no debouncing** — every keypress while typing triggers a full serialization and write. There is no backend API for notes. No server routes exist in `src/app/api/` for notes. No server-side domain model exists in `src/server/`.

### 1.4 State Management

Notes uses a **local React `useState`** model (`NotesStateEntity`) entirely in `useNotes.ts`. Redux (`src/client/redux/store.ts`) exists but has an empty reducer — notes are not in Redux. React Query is installed and used by `useHome.ts` but notes do not use it.

### 1.5 Current Note Entity

```ts
type NoteEntity = {
  id: string;
  notebookId: string;
  title: string;
  body: string;          // raw innerHTML from contentEditable
  tags: string[];
  favorite: boolean;
  shared: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  order: number;
  publicLink: boolean;
  permission: 'viewer' | 'editor' | 'owner';
  sharedWith: string[];
};
```

The `body` field is raw browser HTML, not Markdown. Seed content looks like:
```html
<h1>Optimization</h1><p>Optimization connects to...</p><h2>Key ideas</h2><ul><li>Define the mental model in one sentence.</li></ul>
```

### 1.6 Design System

- **Manrope** typeface (`--font-sans`, `--font-manrope`)
- **CSS custom properties** as design tokens in `src/app/styles/tokens.css`
- **CSS Modules** (`.module.css`) for component-scoped styles — no Tailwind in components
- Tailwind v4 installed as a utility foundation, used only in global base styles
- Design tokens cover: color, typography scale, spacing, radius, shadow, motion, z-index, glass

Notes.module.css has some hardcoded hex values not mapped to tokens (e.g., `#f7f4ff`, `#1e1b4b0d`). Pre-existing inconsistency — the plan must not worsen it.

### 1.7 Notable Observations

- "Canvas" terminology already used throughout the UI (`CanvasSwitcher`, `canvasSearch`, `addCanvas`, `styles.canvas`) — cosmetic only; no canvas interaction model exists.
- Presentation mode exists — a crude full-screen HTML renderer using `dangerouslySetInnerHTML`. Already vestigial.
- The zoom controls (`−`, `100%`, `+`) and bottom toolbar (Select, Text box, Duplicate, Link card, Task card, Find, More tools) are all non-functional (`coming()` toast). They are visual stubs anticipating a real canvas model.
- `document.execCommand()` is officially deprecated and may be removed in future browsers.
- No authentication/ownership enforcement — all data is device-local.
- No file attachments, image handling, autosave debouncing, collaboration, or AI integration.
- The app targets Android via Capacitor (`output: 'export'`, Capacitor plugins). Notes has mobile-specific CSS overrides (`[data-platform="app"]` selectors).

---

## 2. Architectural Diagnosis

### 2.1 What is Missing for a Canvas Architecture

| Area | Current state | Gap |
|---|---|---|
| Editor | `contentEditable` + `execCommand` | No infinite canvas, no spatial layout, no drawing |
| Content format | Raw `innerHTML` | No structured scene representation |
| Persistence | localStorage, full-state write on every keystroke | No debouncing, no backend, no versioning |
| State | Monolithic `NotesStateEntity` in `useState` | Mixes domain data with transient UI selection state |
| Assets | None | No image/file handling at all |
| Collaboration | None | No concurrent-edit model |
| Security | None | No server-side validation, no auth for notes |
| Separation | `NoteEntity.body` IS the content | Domain model coupled to presentation format |
| Hooks | `useNotes` does everything | No separation between persistence, domain, and UI concerns |

### 2.2 The Fundamental Structural Problem

`NoteEntity.body: string` simultaneously IS the **domain entity**, the **persistence format**, and the **editor state**. This triple-coupling makes it impossible to swap the editor without rewriting the model.

The correct architecture separates:
- **Domain layer**: `NoteDocument` — who owns this, when it was created, what it's called
- **Canvas layer**: `CanvasScene` — Excalidraw elements and app state, owned by the editor library
- **Persistence layer**: Repository that serializes both layers independently

---

## 3. Recommended Architecture

### 3.1 Guiding Principles

1. **Preserve existing conventions**: CSS Modules + design tokens, screen-local hooks, adapters, models, repositories.
2. **Encapsulate Excalidraw completely**: Nothing outside the canvas adapter should know Excalidraw's types.
3. **Keep domain and presentation separate**: `NoteDocument` does not contain Excalidraw primitives.
4. **No over-engineering**: No real-time collaboration, no cloud-asset CDN, no conflict resolution — yet.
5. **Learner-first UX**: The canvas is invisible infrastructure for thinking, not a system to manage.

### 3.2 Recommended Directory Tree

Every screen (`home/`, `explore/`, `cohort/`) follows: `Screen.tsx`, `Screen.module.css`, `components/`, `hooks/`, `models/`, `adapters/`, `mock/`. Notes already follows this. The new structure extends it cleanly:

```
src/client/components/screens/dashboard/notes/
│
├── Notes.tsx                        [MODIFY] Orchestrator screen (simplified)
├── Notes.module.css                 [MODIFY] Screen-level layout only
├── index.ts                         [unchanged]
│
├── models/
│   ├── notes.models.ts              [MODIFY] Add NoteDocument, remove body field
│   └── canvas.models.ts             [NEW] Canvas boundary types (opaque to outside)
│
├── adapters/
│   ├── notes.adapter.ts             [MODIFY] Update type references to NoteDocument
│   └── canvas.adapter.ts            [NEW] Excalidraw <-> CanvasSceneData translation
│
├── hooks/
│   ├── useNotes.ts                  [MODIFY] Narrow to notebook/note metadata only
│   ├── useCanvasScene.ts            [NEW] Manages active canvas editor state
│   └── useCanvasPersistence.ts      [NEW] Debounced autosave + status tracking
│
├── repositories/
│   ├── notes.repository.ts          [MODIFY] v1->v2 migration, metadata only
│   └── canvas.repository.ts         [NEW] Scene-specific read/write (later: API)
│
├── components/
│   ├── NotesComponents.tsx          [MODIFY] Keep sidebar components, remove editor stubs
│   ├── NotesCanvas/                 [NEW] Canvas host (mounts Excalidraw)
│   │   ├── NotesCanvas.tsx
│   │   └── NotesCanvas.module.css
│   └── NotesSaveStatus/             [NEW] Autosave indicator
│       ├── NotesSaveStatus.tsx
│       └── NotesSaveStatus.module.css
│
└── mock/
    ├── notes.seed.ts                [MODIFY] NoteDocument shape, contentType field
    └── canvas.seed.ts               [NEW] Sample Excalidraw scene JSON for dev
```

### 3.3 What Does NOT Change

- `src/app/(dashboard)/notes/page.tsx` — route metadata is fine
- The `dynamic()` import with `Suspense` — already correct for SSR boundary
- The left panel (notebook/note list) architecture
- Design tokens and CSS Module convention
- `useIsMobile`, `useToast`, global hooks
- `Tooltip`, `Badge`, `Button` UI library

---

## 4. Data Model

### 4.1 Domain / SideQuestHQ Layer

```ts
// models/notes.models.ts (revised)

export type NotesSort =
  'manual' | 'alphabetical' | 'recentlyEdited' | 'recentlyCreated' | 'oldestFirst' | 'newestFirst';
export type NotesFilter = 'all' | 'favorites' | 'recent' | 'shared' | 'archived';
export type Permission = 'viewer' | 'editor' | 'owner';

/**
 * Domain entity: pure SideQuestHQ concerns only.
 * Does NOT contain Excalidraw-specific types.
 * 'body' removed — content lives in CanvasDocument.
 */
export type NoteDocument = {
  id: string;
  notebookId: string;
  title: string;

  // Ownership & permissions
  ownerId: string | null;           // null = local, pre-auth
  permission: Permission;
  sharedWith: string[];
  publicLink: boolean;

  // Metadata
  tags: string[];
  favorite: boolean;
  shared: boolean;
  archived: boolean;
  order: number;

  // Timestamps (ISO 8601)
  createdAt: string;
  updatedAt: string;

  // Content type indicator — allows future hybrid notes
  contentType: 'canvas' | 'legacy-html';

  // Preserved original HTML body for legacy notes (never deleted until user requests)
  legacyBody?: string;

  // Learning context (future-proofing, nullable until API supports it)
  linkedConceptIds: string[];       // future: link to concept graph
  linkedResourceIds: string[];      // future: link to videos/articles/quests
  learningPathId: string | null;    // future: attach to a learning path

  // Versioning (future-proofing, nullable until backend supports it)
  revision: number | null;
};

export type NotebookEntity = {
  id: string;
  title: string;
  description: string;
  color: string;
  favorite: boolean;
  shared: boolean;
  archived: boolean;
  collapsed: boolean;
  createdAt: string;
  updatedAt: string;
  order: number;
};

export type NotesStateEntity = {
  notebooks: NotebookEntity[];
  notes: NoteDocument[];
  selectedNotebookId: string | null;
  selectedNoteId: string | null;
  notebookSort: NotesSort;
  noteSort: NotesSort;
  filter: NotesFilter;
};

export type NotebookListItem = NotebookEntity & {
  noteCount: number;
  visibleNotes: NoteDocument[];
};
```

### 4.2 Canvas / Excalidraw Layer

```ts
// models/canvas.models.ts

/**
 * Opaque serialized scene. Stored as a JSON string so Excalidraw types
 * never leak into the domain model. Only canvas.adapter.ts parses this.
 */
export type SerializedScene = string;

/**
 * SideQuestHQ canvas document — persisted separately from NoteDocument.
 * Note identity (NoteDocument) is SEPARATE from canvas data.
 * This allows the canvas format to evolve independently.
 */
export type CanvasDocument = {
  noteId: string;          // foreign key -> NoteDocument.id
  scene: SerializedScene;  // Excalidraw elements[], appState, files
  schemaVersion: number;   // current: 1 — enables future migrations
  savedAt: string;         // ISO 8601
};

/**
 * The deserialized scene that canvas.adapter.ts works with internally.
 * Typed as 'unknown' externally to prevent Excalidraw type leakage.
 */
export type CanvasSceneData = {
  elements: readonly unknown[];
  appState: {
    viewBackgroundColor: string;
    theme: 'light' | 'dark';
    // Intentionally limited: we do NOT persist viewport scroll/zoom
  };
  files: Record<string, unknown>;
};

export type CanvasStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export type CanvasState = {
  status: CanvasStatus;
  lastSavedAt: string | null;
  isDirty: boolean;
  errorMessage: string | null;
};
```

### 4.3 Domain / Excalidraw Boundary — Explicit

```
┌─────────────────────────────────────────────────────────┐
│  SideQuestHQ Domain                                     │
│  NoteDocument (id, title, owner, timestamps, tags...)    │
│  NotebookEntity                                          │
│  NotesStateEntity                                        │
│  Stored in: notes.repository.ts                         │
└────────────────────────┬────────────────────────────────┘
                         │ noteId (foreign key)
┌────────────────────────▼────────────────────────────────┐
│  Canvas Document Layer                                   │
│  CanvasDocument { noteId, scene: SerializedScene }       │
│  Stored in: canvas.repository.ts                        │
└────────────────────────┬────────────────────────────────┘
                         │ parse/stringify — canvas.adapter.ts ONLY
┌────────────────────────▼────────────────────────────────┐
│  Excalidraw Integration (canvas.adapter.ts)              │
│  ExcalidrawElement[], AppState, BinaryFileData           │
│  Imported from @excalidraw/excalidraw                    │
│  NEVER exported to domain layer                         │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Data Flow

### 5.1 Load Path

```
User selects a note in the panel
        ↓
useNotes()  →  resolves NoteDocument
        ↓
useCanvasScene(noteId)
  canvas.repository.load(noteId)
  → hit:  CanvasDocument { scene: SerializedScene }
  → miss: null (new empty scene)
        ↓
canvas.adapter.deserialize(scene)  →  CanvasSceneData
        ↓
NotesCanvas component
  passes elements + appState as Excalidraw initialData
        ↓
User sees their canvas (instant, from local storage)
```

### 5.2 Save Path (Autosave)

```
User edits the canvas
        ↓
Excalidraw.onChange(elements, appState, files) fires
        ↓
useCanvasScene:
  sceneRef.current = { elements, appState, files }  ← ref, NOT state
  if (!isDirtyRef.current) setIsDirty(true)         ← one re-render
        ↓
useCanvasPersistence: debounce timer (1500ms quiet period)
        ↓
canvas.adapter.serialize(sceneRef.current)
  → SerializedScene (JSON string)
        ↓
canvas.repository.save({ noteId, scene, schemaVersion, savedAt })
  → localStorage.setItem(`sidequesthq.canvas.${noteId}`, ...)
        ↓
notes.repository.patchNote(noteId, { updatedAt: now() })
  → keeps metadata timestamps in sync
        ↓
setStatus('saved'), setLastSavedAt(now)
  → NotesSaveStatus indicator updates (small, non-blocking)
```

### 5.3 Full Layer Diagram

```
┌─ UI Layer ──────────────────────────────────────────────────┐
│  Notes.tsx  →  NotesPanel (sidebar) + NotesCanvas (workspace)│
│  NotesCanvas.tsx  →  <Excalidraw /> (client-only, dynamic)   │
└──────────────┬──────────────────────────────────────────────┘
               │ props / callbacks
┌─ Hook Layer ────────────────────────────────────────────────┐
│  useNotes()             → metadata, CRUD actions            │
│  useCanvasScene(noteId) → CanvasState, initialData, handler │
│  useCanvasPersistence() → debounced save lifecycle          │
└──────────────┬──────────────────────────────────────────────┘
               │ calls
┌─ Adapter Layer ─────────────────────────────────────────────┐
│  notes.adapter.ts   → sort/filter/search (pure)            │
│  canvas.adapter.ts  → serialize/deserialize/migrate        │
└──────────────┬──────────────────────────────────────────────┘
               │ calls
┌─ Repository Layer ──────────────────────────────────────────┐
│  notes.repository.ts   → NoteDocument + NotebookEntity CRUD │
│  canvas.repository.ts  → CanvasDocument load/save by noteId │
└──────────────┬──────────────────────────────────────────────┘
               │ reads/writes
┌─ Storage Layer ─────────────────────────────────────────────┐
│  sidequesthq.notes.v2          → NotesStateEntity (metadata)│
│  sidequesthq.canvas.{noteId}   → CanvasDocument per note    │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Excalidraw Integration Boundary

### 6.1 Package

```json
"@excalidraw/excalidraw": "^0.19.0"
```

Excalidraw requires a browser DOM environment and does not support SSR. It renders to an HTML `<canvas>` element and uses window APIs.

### 6.2 Why the Existing `dynamic()` Import Is Already Correct

`src/app/(dashboard)/notes/page.tsx` already dynamically imports the entire `Notes` component, creating an SSR boundary. `<Excalidraw />` nested inside `NotesCanvas` will automatically be excluded from SSR. An additional `ssr: false` on the `Excalidraw` import is optional but recommended for documentation clarity:

```ts
// NotesCanvas.tsx
const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then(m => m.Excalidraw),
  { ssr: false }
);
```

### 6.3 Capacitor / Mobile Implications

The app builds as a Capacitor Android APK. Excalidraw uses `window.matchMedia`, `ResizeObserver`, `requestAnimationFrame`, and pointer events — all available in Android WebView. Verify:
- Touch/stylus drawing works on real devices
- Pinch-to-zoom does not conflict with Capacitor's viewport management
- `viewportFit: 'cover'` in the root layout does not clip the canvas on notched devices

### 6.4 Excalidraw Enters and Ends At

**Enters**: `components/NotesCanvas/NotesCanvas.tsx` — renders `<Excalidraw />`, wires `onChange`.

**Ends**: `adapters/canvas.adapter.ts` — calls Excalidraw utilities (`serializeAsJSON`, `restoreElements`), converts between Excalidraw types and `CanvasSceneData`.

Everything outside these two files is Excalidraw-agnostic.

### 6.5 Integration Interface Sketch

```ts
// components/NotesCanvas/NotesCanvas.tsx

interface NotesCanvasProps {
  noteId: string;
  initialScene: CanvasSceneData | null;
  onSceneChange: (scene: CanvasSceneData) => void;
  isReadOnly?: boolean;
  canvasStatus: CanvasState;
}

export function NotesCanvas({ noteId, initialScene, onSceneChange, canvasStatus }: NotesCanvasProps) {
  // initialData: canvas.adapter.toExcalidrawInitialData(initialScene)
  // onChange:    canvas.adapter.fromExcalidrawChange(...args) -> onSceneChange
  // UIOptions:   hide built-in save/AI features, pin theme to 'light'
}
```

### 6.6 What Must NOT Leak Out

- `ExcalidrawElement`, `ExcalidrawTextElement`, etc.
- Excalidraw's `AppState` type
- `BinaryFileData`
- `ExcalidrawAPI` ref
- Excalidraw internal constants (`THEME`, `MIME_TYPES`)

---

## 7. Persistence Strategy

### 7.1 Key Insight: Separate Metadata from Scene

| Key pattern | Contents | When written |
|---|---|---|
| `sidequesthq.notes.v2` | NotesStateEntity (notebooks + NoteDocument metadata, NO body/scene) | On notebook/note CRUD |
| `sidequesthq.canvas.{noteId}` | CanvasDocument (serialized scene only) | Debounced, 1500ms after last edit |

### 7.2 Autosave Lifecycle

```
Open note
  canvas.repository.load(noteId)
  → hit:  deserialize → CanvasSceneData → Excalidraw initialData
  → miss: createEmptyScene()
Excalidraw mounts
User draws/types
Excalidraw.onChange (up to 60fps)
  sceneRef.current = data  ← ref only, no re-render
  setIsDirty(true)         ← one re-render per session
debounce timer fires (1500ms)
  canvas.adapter.serialize(sceneRef.current) → SerializedScene
  canvas.repository.save(noteId, scene) → localStorage
  notes.repository.patchNote(noteId, { updatedAt: now() })
  setStatus('saved')
NotesSaveStatus shows checkmark
```

### 7.3 Save Status States

| Status | Meaning | UI |
|---|---|---|
| `'idle'` | No changes yet | Nothing shown |
| `'saving'` | Write in progress | Subtle spinner |
| `'saved'` | Last write succeeded | Checkmark + time |
| `'error'` | Write failed | Error badge + retry |

### 7.4 Failure and Recovery

- **localStorage write failure**: Set status `'error'`, show toast via existing `useToast`. Do NOT discard in-memory scene. Retry with exponential backoff (5s, 10s, 20s, cap 60s).
- **Tab close with unsaved + failed save**: `beforeunload` warning only if `isDirty && status === 'error'`. Silent if last save succeeded.
- **Corrupt persisted scene**: `canvas.repository.load()` catches parse errors, returns `null`. Log corruption. Open empty canvas.
- **Schema version mismatch**: `canvas.adapter.migrateScene(scene, fromVersion, toVersion)` runs before returning to hook.

### 7.5 What NOT to Persist

Exclude from serialized scene:
- `selectedElementIds` — transient selection
- `editingElement`, `draggingElement` — transient editor state
- `scrollX`, `scrollY`, `zoom.value` — viewport position is a UI preference, not content

Excalidraw's `serializeAsJSON()` already excludes most transient state. Verify `appState` contents and whitelist only `viewBackgroundColor` and `theme`.

### 7.6 Backend-Ready Repository Interface

```ts
interface CanvasRepository {
  load(noteId: string): Promise<CanvasDocument | null>;
  save(doc: CanvasDocument): Promise<void>;
}
```

When a backend API exists, swap the implementation — hook and adapter are unchanged.

---

## 8. HTML/Legacy Migration Strategy

### 8.1 What Format Are Existing Notes?

Contrary to the phrase "Markdown notes", the existing `body` field is **raw browser HTML** from `contentEditable + execCommand`:

```html
<h1>Optimization</h1>
<p>Optimization connects to...</p>
<h2>Key ideas</h2>
<ul>
  <li>Define the mental model in one sentence.</li>
</ul>
<p><strong>Next step:</strong> turn this into a small SideQuest exercise.</p>
```

This is NOT standard Markdown. Migration semantics differ from a Markdown → canvas conversion.

### 8.2 Honest Assessment: Automatic Conversion Will Produce a Poor Experience

Excalidraw text elements have fixed spatial positions. Converting a flowed HTML document into positioned Excalidraw elements without a layout engine produces a pile of text boxes overlapping at coordinate (0, 0). This is worse than the current experience. **Do not auto-convert.**

### 8.3 Recommended Strategy: Lazy On-Open Migration with User Choice

**Never delete existing notes. Let the user decide.**

#### Step 1 — `contentType` field

All existing notes get `contentType: 'legacy-html'` when the v1→v2 schema migration runs.

#### Step 2 — When a legacy-html note is opened

Show a migration prompt instead of the canvas:

```
This note was created in the previous format.

[ Open as canvas ]   [ View as text ]   [ Later ]
```

- **Open as canvas**: Run `canvas.adapter.migrateHtmlToCanvas(note.legacyBody)`. Creates a single text element containing the plain text extracted from the HTML. Sets `contentType: 'canvas'`. Preserves original HTML in `legacyBody` field forever.
- **View as text**: Render `note.legacyBody` via a read-only HTML viewer. Note stays `contentType: 'legacy-html'`.
- **Later**: Dismiss, show read-only HTML view for this session.

#### Step 3 — Migration Adapter Behavior

```ts
function migrateHtmlToCanvas(htmlBody: string): CanvasSceneData {
  const plainText = stripHtml(htmlBody);  // remove all HTML tags
  const textElement = createTextElement({
    text: plainText,
    x: 100, y: 100,
    fontSize: 16,
    fontFamily: 1,   // Excalidraw default (Virgil)
    width: 600,
    textAlign: 'left',
  });
  return {
    elements: [textElement],
    appState: { viewBackgroundColor: '#ffffff', theme: 'light' },
    files: {},
  };
}
```

This is honest: the content becomes a canvas starting point, not a perfectly reproduced document.

### 8.4 Backward Compatibility

- `legacy-html` notes are always readable (HTML renderer)
- `legacyBody` preserved indefinitely — never deleted unless user requests it
- `sidequesthq.notes.v1` key preserved alongside `v2` during migration transition period
- Canvas notes can export to PNG/SVG via Excalidraw's native export
- Plain-text export: extract text from all Excalidraw text elements
- Excalidraw format (`.excalidraw` JSON) export for interoperability

---

## 9. Asset / File Strategy

### 9.1 What Excalidraw Supports

Excalidraw can contain embedded images (`ExcalidrawImageElement`) with associated binary file data (`BinaryFileData`) stored as base64 data URIs keyed by file ID hash.

### 9.2 Phase 1: Inline in Scene

Embed images inline inside the serialized scene. `canvas.adapter.serialize()` includes the `files` map as part of `SerializedScene`. Images are stored in localStorage.

**Limits and mitigations**:
- localStorage is typically 5–10MB per origin
- Warn when serialized scene exceeds 500KB
- Compress images to ≤70% JPEG quality before embedding
- Log storage size on every save

> **Critical**: Excalidraw does NOT automatically persist files — you must explicitly capture `files` from `onChange` alongside `elements` and `appState`. The integration must do this.

### 9.3 Future: Object Storage

When a backend exists:
- `canvas.repository.uploadFile(noteId, fileId, data)` → CDN URL
- Replace base64 inline with URL references in the scene
- `canvas.repository.load()` re-hydrates file URLs for Excalidraw's `files` prop
- `canvas.adapter.ts` owns this transformation — nothing else changes

---

## 10. UX Architecture

### 10.1 Philosophy Applied to Notes

SideQuestHQ's canonical principle: *increasing system intelligence should reduce visible complexity.* Applied:

**The learner opens the canvas and thinks. Nothing else should happen.**

- Canvas fills the workspace — no Excalidraw UI chrome leaking into the SideQuestHQ frame
- Autosave is invisible unless something goes wrong
- Canvas loads instantly from local state — no spinner
- No notebook management in the canvas area
- SideQuestHQ topbar provides note-level controls (title, share, archive)
- Excalidraw's own toolbar provides drawing tools

### 10.2 What the Experience Should Feel Like

**Opening a note**: Panel → click note → canvas appears, fully loaded, cursor ready. If the note is new, clean empty canvas with a subtle prompt ("Start drawing, writing, or connecting ideas").

**Using the canvas**: Feels like a **thinking surface**, not a presentation tool or document editor. The existing bottom-tool stubs in the UI (Select, Text box, etc.) are exactly where Excalidraw's real tools will live.

**Saving**: `NotesSaveStatus` in the topbar — small, unobtrusive, shows "Saved" with a checkmark. Errors are a small badge, not a blocking modal.

**On mobile**: Panel/workspace toggle preserved. Canvas takes full screen when open. Excalidraw toolbar at the bottom for thumb accessibility. Verify pinch-to-zoom does not conflict with Capacitor.

### 10.3 What NOT to Build

Do NOT add:
- A notebook picker inside the canvas area
- A visible version history timeline
- A "connect to learning path" button before that feature exists
- A collaboration cursor system
- A page/slide model (canvas is infinite — do not paginate it)
- Any AI sidebar, insight panel, or tag suggestion UI
- Explicit "Save" button

### 10.4 Preserving the Existing UI Shell

The left panel stays. The topbar stays. Only `styles.canvas` (the content area) is replaced by `<NotesCanvas />`. The format toolbar (Bold, Italic, etc.) is retired — Excalidraw's toolbar replaces it. The zoom stub is retired — Excalidraw's native zoom replaces it.

---

## 11. Performance Strategy

### 11.1 Identified Bottlenecks

| Bottleneck | Severity | Cause |
|---|---|---|
| `onChange` fires at frame rate | High | Excalidraw calls up to 60x/sec during interaction |
| Scene serialization cost | Medium | `JSON.stringify` on large element arrays |
| localStorage is synchronous | Medium | Blocks main thread on every write |
| Excalidraw bundle size | High | ~1MB+ minified |
| Image inline in scene | Medium | Base64 inflates JSON significantly |
| Mobile memory | Medium | Large scenes + images on low-RAM Android |

### 11.2 Mitigations

**60fps onChange → use a ref, not state:**

```ts
const sceneRef = useRef<CanvasSceneData | null>(null);
// NEVER setState on this. Only persistence hook reads it.

function handleSceneChange(elements, appState, files) {
  sceneRef.current = { elements, appState: minimalAppState(appState), files };
  if (!isDirtyRef.current) setIsDirty(true); // one re-render per session
}
```

**Debouncing**: 1500ms quiet period. No serialization during active interaction.

**Bundle size**: The existing `dynamic()` import is already lazy. Excalidraw only loads when the user visits `/notes`. No other route is affected.

**Large canvases**: Practical localStorage limit is ~200 elements with no images. Warn at 500KB serialized size. Future: server-side storage for large canvases.

**Image compression**: Enforce ≤70% JPEG quality before embedding. A sketch at 70% is still readable and 3x smaller.

**Initial render**: `initialData` means Excalidraw renders immediately from data — no `onChange` on mount. Load is fast: one deserialize + render.

---

## 12. Security Strategy

### 12.1 Trust Boundaries

**Current**: All data is device-local. No server to attack. Main threat: malicious `.excalidraw` file imported by user.

**Future** (when backend exists): Server-side validation becomes critical for all canvas data.

### 12.2 Address Now

**Malicious imported Excalidraw files** (if import feature is added):
- Validate JSON schema before passing to Excalidraw
- Reject scenes with >10,000 elements (DoS vector)
- Reject `files` entries with non-image MIME types
- Sanitize text element content before any DOM rendering

**XSS via canvas text elements**:
- Excalidraw renders text on an HTML `<canvas>` — traditional XSS is not possible
- If canvas text is ever rendered in DOM context (e.g., search previews), HTML-escape it

**`dangerouslySetInnerHTML` for legacy-html viewer**:
- Only render content the user themselves created (never content from other users)
- When collaboration exists: mandatory server-side HTML sanitization before sharing

**File size limits**:
- Enforce max 2MB serialized scene in `canvas.repository.save()`
- User-friendly error if exceeded

**Asset MIME types** (when upload exists):
- Accept only: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`

---

## 13. Testing Strategy

### 13.1 Unit Tests

**`canvas.adapter.ts`**:
- `serialize(elements, appState, files)` → valid JSON
- `deserialize(scene)` → recovers original elements
- `migrateHtmlToCanvas('<h1>Test</h1><p>Content</p>')` → one text element at valid position
- `deserialize(corruptJson)` → returns null (no crash)
- Schema migration: v0 scene → v1 scene via `migrateScene()`

**`notes.adapter.ts`**:
- All existing sort/filter tests (unchanged)
- `matchesFilter` with `contentType: 'legacy-html'` NoteDocuments
- `filterNotes` search does not attempt to search inside `SerializedScene` JSON blob

**`canvas.repository.ts`**:
- `load(noteId)` when key absent → `null`
- `load(noteId)` when key corrupt → `null` (no throw)
- `load(noteId)` when key valid → `CanvasDocument`
- `save(doc)` → correct key, data round-trips through `load`
- Scene > 2MB → throws `StorageExceededError`

### 13.2 Integration Tests

**Canvas open lifecycle**:
- Create note → open → canvas renders (empty scene)
- Reload → reopen same note → canvas restores previous state
- Open `legacy-html` note → migration prompt appears

**Autosave**:
- Edit scene → wait 1500ms → scene persisted in localStorage
- Rapidly edit for 10s → only 1-2 localStorage writes (debounce working)
- Storage quota exceeded → status `'error'`, in-memory state preserved, retry succeeds

**Legacy HTML migration**:
- Open `legacy-html` note → choose "Open as canvas" → text element visible
- Open `legacy-html` note → choose "View as text" → HTML rendered, not canvas
- Reopen migrated note → canvas loads directly (no prompt)

**Malformed data**:
- Corrupt JSON in canvas key → load → empty canvas (no crash)
- v0 schema → load → migration runs → canvas usable

### 13.3 End-to-End Tests

| Scenario | Steps | Expected |
|---|---|---|
| Create canvas | Open Notes → create notebook → create note | Empty canvas renders |
| Draw and reload | Draw shapes → wait 2s → reload → reopen | Same shapes present |
| Legacy note (canvas) | Open legacy note → "Open as canvas" | Text element in canvas |
| Legacy note (text) | Open legacy note → "View as text" | HTML rendered, readable |
| Title edit | Edit title → reload → reopen | New title persisted |
| Archive note | Archive → check list | Not in active list |

### 13.4 Excalidraw-Specific

- Verify `onChange` does NOT trigger excessive React re-renders (React profiler)
- Verify `initialData` elements appear immediately (no flash of empty canvas)
- Verify `files` from `onChange` are included in serialization (image round-trip)
- Verify Excalidraw unmounts cleanly when switching notes (no event listener leaks)

---

## 14. Implementation Phases

### Phase 0: Schema Migration and Data Separation

**Objective**: Split `body: string` into `NoteDocument` (metadata) + `CanvasDocument` (scene), with zero visible change to the user.

**Files affected**:
- `models/notes.models.ts` — rename `NoteEntity` → `NoteDocument`, add `contentType`, `legacyBody?`, `linkedConceptIds`, `linkedResourceIds`, `learningPathId`, `revision`, `ownerId`
- `models/canvas.models.ts` — [NEW] `CanvasDocument`, `SerializedScene`, `CanvasState`, `CanvasStatus`, `CanvasSceneData`
- `repositories/notes.repository.ts` — update key to `sidequesthq.notes.v2`, v1→v2 migration on load
- `repositories/canvas.repository.ts` — [NEW] per-note canvas storage
- `adapters/notes.adapter.ts` — update type references (`NoteEntity` → `NoteDocument`)
- `hooks/useNotes.ts` — update type references, preserve all existing behavior
- `mock/notes.seed.ts` — update to `NoteDocument` shape (remove `body`, add `contentType: 'legacy-html'`)
- `mock/canvas.seed.ts` — [NEW] sample scene JSON for seed notes

**Dependencies**: None.

**Acceptance criteria**:
- Existing Notes UI still works exactly as before (visual regression = 0)
- `notes.models.ts` has `NoteDocument` with no `body` field
- v1 data migrates to v2 without data loss on first load
- TypeScript compiles with zero errors

**Risks**: Breaking change to model shape — TypeScript will surface all references to `NoteEntity.body`.

---

### Phase 1: canvas.adapter.ts — Serialization Layer

**Objective**: Implement the serialization boundary between SideQuestHQ domain types and Excalidraw types. Use stub types for Excalidraw — do not install the package yet.

**Files affected**:
- `adapters/canvas.adapter.ts` — [NEW]
  - `serialize(scene: CanvasSceneData): SerializedScene`
  - `deserialize(s: SerializedScene): CanvasSceneData | null`
  - `migrateHtmlToCanvas(html: string): CanvasSceneData`
  - `createEmptyScene(): CanvasSceneData`
  - `migrateScene(doc, fromVersion, toVersion): CanvasDocument`

**Dependencies**: Phase 0 complete.

**Acceptance criteria**:
- `serialize(deserialize(x)) === x` for valid inputs
- `deserialize(badJson) === null` (no throw)
- `migrateHtmlToCanvas('<h1>Test</h1>')` produces one text element at a valid position
- Unit tests pass (no DOM required)

---

### Phase 2: Install Excalidraw and Build NotesCanvas Component

**Objective**: Add `@excalidraw/excalidraw` and build the `NotesCanvas` wrapper.

**Files affected**:
- `package.json` — add `@excalidraw/excalidraw`
- `components/NotesCanvas/NotesCanvas.tsx` — [NEW]
- `components/NotesCanvas/NotesCanvas.module.css` — [NEW]
- `adapters/canvas.adapter.ts` — replace stub Excalidraw types with real ones

**Implementation notes**:
- `<Excalidraw />` with `initialData`, `onChange`, `isCollaborating={false}`
- Disable built-in Excalidraw AI features via `UIOptions`
- Pin `theme="light"` (SideQuestHQ is light-only)
- Canvas fills 100% of its container

**Dependencies**: Phase 1 complete, npm install.

**Acceptance criteria**:
- `npm run dev` starts without errors
- `/notes` → blank canvas renders
- Drawing a shape calls `onSceneChange` with valid `CanvasSceneData`
- Switching notes unmounts Excalidraw cleanly (no React errors)

---

### Phase 3: useCanvasScene + useCanvasPersistence Hooks

**Objective**: Wire canvas to storage with autosave, ref-based scene state, and status tracking.

**Files affected**:
- `hooks/useCanvasScene.ts` — [NEW]
  - Loads `CanvasDocument` on `noteId` change
  - Exposes `initialScene`, `handleSceneChange`, `canvasState`
  - Uses `useRef` for scene data (NOT `useState`)
- `hooks/useCanvasPersistence.ts` — [NEW]
  - 1500ms debounced save
  - Exponential backoff retry on failure
  - `beforeunload` warning when `isDirty && status === 'error'`
- `components/NotesSaveStatus/NotesSaveStatus.tsx` — [NEW]

**Dependencies**: Phase 2 complete.

**Acceptance criteria**:
- Draw → wait 2s → refresh → drawing still present
- Rapid drawing → only 1-2 localStorage writes per 1500ms window
- Storage failure → status badge shows error → retry succeeds
- Switching notes → cancels pending debounce, loads new note's scene

---

### Phase 4: Integrate into Notes.tsx, Retire the ContentEditable Editor

**Objective**: Swap the `contentEditable` div for `<NotesCanvas />`. Remove all deprecated editor code.

**Files affected**:
- `Notes.tsx` — MAJOR REVISION
  - Remove: `editorRef`, `cmd()`, `addLink()`, keyboard handler, `execCommand` calls
  - Remove: Format toolbar (Bold, Italic, Underline, etc.)
  - Remove: Broken bottom toolbar stubs (now real Excalidraw tools)
  - Remove: Zoom controls stub (now real Excalidraw zoom)
  - Add: `<NotesCanvas noteId={selected.id} ... />`
  - Add: `<NotesSaveStatus />` in topbar
  - Preserve: All panel/sidebar code unchanged
- `Notes.module.css` — remove format/editor-specific styles, keep layout

**Dependencies**: Phases 0–3 complete.

**Acceptance criteria**:
- `/notes` loads without errors or warnings
- Selecting a note opens a canvas (not an empty `contentEditable`)
- Drawing persists across page reloads
- `document.execCommand` is no longer called anywhere in notes code
- No TypeScript errors

---

### Phase 5: Legacy HTML Migration UX

**Objective**: Show migration prompt for `legacy-html` notes. Give users graceful path to canvas.

**Files affected**:
- `components/NotesLegacyPrompt/` — [NEW] or inline in `Notes.tsx`
- `hooks/useNotes.ts` — add `migrateNote(noteId)` action
- `adapters/canvas.adapter.ts` — `migrateHtmlToCanvas()` (already built in Phase 1)

**Logic**:
- `selectedNote.contentType === 'legacy-html'` → render `NotesLegacyPrompt` instead of `NotesCanvas`
- "Open as canvas" → migrate, set `contentType = 'canvas'`, save `CanvasDocument`, open canvas
- "View as text" → read-only HTML viewer (this session)
- "Later" → dismiss, read-only HTML viewer

**Acceptance criteria**:
- Legacy note shows migration prompt (not blank canvas)
- "Open as canvas" produces text element from HTML content
- "View as text" shows readable HTML
- Original `legacyBody` preserved after migration
- Migrated note reopens as canvas directly (no prompt)

---

### Phase 6: Mobile Hardening and Polish

**Objective**: Verify Capacitor Android experience. Fix touch interaction issues.

**Work items**:
- Test on Android emulator and real device
- Verify pinch-to-zoom works alongside Capacitor gesture handling
- Verify Excalidraw toolbar is thumb-accessible on mobile
- Tune `NotesCanvas.module.css` for correct height in Capacitor (`100dvh - --bottom-nav-height`)
- Verify `prefers-reduced-motion` compliance
- Verify soft keyboard appearance does not break canvas layout

**Dependencies**: Phase 5 complete.

**Acceptance criteria**:
- Canvas loads and finger drawing works on a real Android device
- Pinch-to-zoom does not conflict with browser scroll
- No visual regression on desktop

---

## 15. Open Questions

Only genuinely unresolved questions requiring a product or engineering decision:

**1. Excalidraw theme**: SideQuestHQ is light-only. Pin `theme="light"` now, or plan for future dark mode? *Recommend: pin to light now, revisit when dark mode is added.*

**2. Viewport persistence**: Should scroll position and zoom level be saved when closing a canvas? Arguments for (smooth re-open); against (small complexity, viewport is transient). *Recommend: do not persist viewport in Phase 1.*

**3. Excalidraw built-in AI features**: Excalidraw 0.17+ includes text-to-diagram AI. Should these be disabled? They may conflict with SideQuestHQ's future AI layer and may send user data externally. *Decision needed: recommend disabling via `UIOptions`.*

**4. Presentation mode replacement**: The current "Present note" button is non-functional with a canvas (can't paginate infinite canvas). Remove it, repurpose as "Focus mode" (fullscreen, no topbar), or defer? *Decision needed before Phase 4.*

**5. Note title location**: Currently an inline `<input>` in the workspace. With canvas filling the workspace, where does the title live? *Recommend: topbar, replacing the CanvasSwitcher `<strong>` with an editable field.*

**6. Backend timeline**: The entire persistence plan is designed for localStorage today, swappable to an API later. If a backend is imminent, the `canvas.repository.ts` interface should be co-designed with the anticipated API contract. *Current assumption: no backend for at least 3 phases.*

---

## 16. Recommended First Implementation Slice

### Goal

```
Create canvas → Open Excalidraw → Draw/write → Persist → Reload → Restore exact canvas
```

### What to Include

1. `NoteDocument` model (no `body` field) — Phase 0
2. `CanvasDocument`, `SerializedScene`, `CanvasSceneData` models — Phase 0
3. `canvas.repository.ts`: `load(noteId)`, `save(doc)` — Phase 0
4. `canvas.adapter.ts`: `serialize`, `deserialize`, `createEmptyScene` — Phase 1
5. `@excalidraw/excalidraw` installed — Phase 2
6. `NotesCanvas.tsx`: mounts `<Excalidraw />`, wires `onChange` — Phase 2
7. `useCanvasScene.ts`: load on `noteId` change, `initialScene`, `handleSceneChange` — Phase 3
8. `useCanvasPersistence.ts`: 1500ms debounce, `'saving'`/`'saved'`/`'error'` status — Phase 3
9. `NotesSaveStatus.tsx`: status badge in topbar — Phase 3
10. `Notes.tsx`: replace `contentEditable` div with `<NotesCanvas />` — Phase 4 (partial)

### What to Exclude

- Legacy HTML migration UX (Phase 5)
- Mobile Capacitor testing (Phase 6)
- Image/file embedding
- Error recovery beyond the status badge
- Backend API work
- Sharing, collaboration, AI features

### Acceptance Criteria for First Slice

1. `npm run dev` starts and `/notes` renders without error
2. Select any note → Excalidraw canvas mounts (no gray screen, no errors)
3. Draw a rectangle on the canvas
4. Wait 2 seconds
5. Refresh the browser
6. Reopen the same note → the rectangle is still there
7. `document.execCommand` is no longer called anywhere in notes code
8. TypeScript strict mode compiles without errors
9. `localStorage` contains `sidequesthq.canvas.{noteId}` with parseable JSON

### Why This Slice Proves the Architecture

It validates:
- The adapter boundary (serialize ↔ deserialize round-trips correctly)
- The persistence hook (debounce works, localStorage write succeeds)
- Excalidraw mounts cleanly in Next.js with dynamic import and SSR disabled
- The domain model is decoupled from the editor (no `body` field anywhere)
- The ref-based scene state does not cause excessive re-renders

It defers:
- Everything dependent on authentication or a backend
- Migration complexity
- Mobile testing (requires real hardware)
- Image handling (requires object storage design)

Once this slice is working end-to-end, every subsequent phase builds on a proven foundation.

---

## Appendix: Consistency Check

| Concern | Verified Against | Status |
|---|---|---|
| Directory structure | Matches existing screen convention (home, explore, cohort) | Pass |
| CSS Module + design token convention | No arbitrary palette values in proposed new CSS | Pass |
| `NoteDocument` has no Excalidraw types | `body` removed; `SerializedScene = string` is opaque | Pass |
| `canvas.adapter.ts` is the sole crossing point | No Excalidraw imports in hooks or screen | Pass |
| `useNotes` hook shape matches `useHome` | Both return `{ state, data, actions }` shape | Pass |
| `dynamic()` / SSR boundary correct | Notes page already has it; Excalidraw nested inside | Pass |
| Capacitor compatibility | `window.matchMedia`, `ResizeObserver`, pointer events available in Android WebView | Assumed — verify in Phase 6 |
| No collaboration infrastructure | `isCollaborating={false}` hardcoded in Phase 2 | Pass |
| Philosophy compliance | Autosave silent, no explicit Save button, no management UI in canvas area | Pass |
| Backward compatibility | `legacy-html` notes never deleted; `legacyBody` preserved | Pass |
| localStorage key schema | `v1 → v2` migration on first load; per-note canvas keys | Pass |

---

*End of plan. No production code was modified during this planning exercise.*
