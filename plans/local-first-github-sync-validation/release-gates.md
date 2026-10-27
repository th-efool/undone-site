# Evidence Artifact E5: Release Gates & Capability Matrix

**Stage:** V5 Contract Freeze & Release Readiness  
**Date:** 2026-10-27  
**Status:** FROZEN  

---

## 1. Distinct Capability Promises & Phased Release Roadmap

To prevent misrepresenting capability boundaries to users, the local-first engine defines three strictly distinct operational guarantees across releases R1, R2, and R3:

| Capability | Target Release | Scope & Guarantee | Mandatory Prerequisites / Evidence |
| :--- | :---: | :--- | :--- |
| **Offline Editing** | **R1** (Local-First Durability) | An already-opened, provisioned workspace allows full editing (typing, drawing, canvas updates, kanban moves) with zero network connectivity. Edits accumulate safely in IndexedDB outbox. | Verified by V3 Test 2 & V4 Test 9 (`indexeddb-prototype.test.ts`, `vertical-slice.test.ts`). Zero data loss on network loss. |
| **Offline Reopening** | **R1 Target** (App Shell Durability) | Launching the browser or navigating to `/notes` while offline succeeds without a network round-trip. The cached dashboard shell boots from ServiceWorker cache and loads the provisioned local workspace from IndexedDB. | PWA ServiceWorker precaching of dashboard chunks + offline session hydration gate. If shell precache is missing, user interface must gracefully report "Offline - workspace saved locally" rather than a white screen. |
| **Cross-Device Recovery** | **R2** (GitHub Private Sync) | A fresh authorized device or clean browser profile can connect to an existing private GitHub repository, restore all notes, canvases, and content-addressable binary assets, and resume editing. | Verified by V4 Test 3 (`vertical-slice.test.ts`). Cryptographic SHA-256 verification of every restored blob is mandatory. Initial network required. |
| **Multi-Device Concurrent Sync** | **R2** (Continuous Convergence) | Multiple devices making independent edits converge cleanly via CAS Git ref updates. Divergent edits to the same note fork non-destructive conflict copies. | Verified by V4 Tests 4 & 5 (`vertical-slice.test.ts`). CAS 422 detection and non-destructive conflict copy generation. |
| **Time-Travel Checkpoints & History** | **R3** (Revision History) | Visual revision history, point-in-time snapshot rollback, and named milestones using Git tags/trees. | Explicitly deferred to R3. Checkpoints excluded from R1/R2 manifest to keep initial synchronization minimal and fast. |

---

## 2. Browser Compatibility & Fallback Matrix

The local-first sync architecture depends on modern web platform capabilities:

| Platform API | Chromium (Chrome, Edge, Brave) | Firefox (Gecko) | Safari (WebKit macOS) | Safari iOS (Mobile) | Fallback / Mitigation Strategy |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **IndexedDB (Multi-Store Transactions)** | Supported (v4+) | Supported (v16+) | Supported (v14.1+) | Supported (v14.1+) | Core requirement. If IndexedDB unavailable (e.g. strict private browsing in older iOS), read-only mode with memory buffer. |
| **Web Locks API (`navigator.locks`)** | Supported (v69+) | Supported (v96+) | Supported (v15.4+) | Supported (v15.4+) | In browsers lacking Web Locks, fallback to `TabLockCoordinator` internal queue with single-writer election and 5000ms acquisition timeout. |
| **BroadcastChannel API** | Supported (v54+) | Supported (v38+) | Supported (v15.4+) | Supported (v15.4+) | Fallback to `localStorage` `storage` event broadcast for cross-tab notification on legacy WebKit. |
| **Storage Persistence (`persist()`)** | Supported (`navigator.storage.persist`) | Supported | Best-effort (eviction rules apply) | Best-effort (eviction after 7 days without user interaction) | Request persistent storage on initial setup; provide 1-click "Export Recovery Bundle" so users can download local snapshots independently. |
| **Web Crypto API (`SubtleCrypto`)** | Supported (v37+) | Supported (v34+) | Supported (v11+) | Supported (v11+) | Used for SHA-256 asset checksum calculation and bundle integrity verification. Standard across all modern browsers. |

---

## 3. Host Environment & Measured Thresholds

Empirically validated limits on Vercel Serverless Hosting and GitHub REST API:

```
[Client Excalidraw Scene]
        │ (Max 10MB raw JSON)
        ▼
[IndexedDB workspace_<userId>]  ── (500MB local quota safety ceiling)
        │
        ▼ (3.0MB Raw Binary Ceiling)
[Base64 Encoding (+33.33%)]      ── (Reaches ~4.0MB JSON)
        │
        ▼ (Vercel 4.5MB Serverless Hard Limit)
[Next.js BFF /api/sync/github]
        │
        ▼ (4 Concurrent REST requests)
[GitHub Git Data API]            ── (Blobs -> Tree -> Commit -> Ref CAS Update)
```

- **Maximum Direct Single Binary Asset:** **3.0 MiB** (raw unencoded bytes).
- **Chunked Multi-Part Asset Range:** **3.0 MiB to 5.0 MiB** (split into binary segments).
- **Hard Single Asset Ceiling:** **5.0 MiB** (assets exceeding 5.0 MiB are rejected with an explicit validation error; no automatic image compression or silent degradation).
- **BFF Request Timeout:** **15 seconds** (Vercel serverless default function timeout).
- **Concurrent GitHub API Requests:** **4 max** (prevents secondary rate limiting HTTP 403).

---

## 4. Phase Release Qualification Gates

### Release 1 (R1): Local-First Durability Gate
- [x] Account-scoped IndexedDB isolation (`workspace_${userId}`) verified.
- [x] Zero partial writes: Atomic transaction commits note + assets + outbox mutation.
- [x] Monotonic generation outbox tracking verified.
- [x] Simulated failure & quota exceeded produces 100% rollback with zero phantom saves.
- [x] Full state export bundle (`bundle.json`) with cryptographic SHA-256 verification.
- [x] Clean restore from export bundle into fresh local repository verified.
- [ ] Production PWA ServiceWorker precaching for `/notes` shell assets validated.

### Release 2 (R2): GitHub Private Sync Gate
- [x] GitHub App OAuth PKCE architecture specified; Personal Access Tokens (PATs) banned.
- [x] Secure token storage in PostgreSQL with AES-GCM-256 + HKDF key derivation verified.
- [x] Deterministic 4-step Git Data API transport harness implemented and tested.
- [x] 9/9 concurrency and failure injection validation scenarios passing.
- [x] Non-destructive `[Conflict]` copy generation on concurrent note collisions verified.
- [x] Idempotent recovery from dropped responses after remote ref update verified.
- [x] Clean remote workspace restore with cryptographic asset verification passing.
- [ ] End-to-end integration with live GitHub App credentials on staging environment.

### Release 3 (R3): Checkpoints & Advanced Merge Gate
- [ ] Checkpoint revision history schema extension (`undone/checkpoints/<timestamp>.json`).
- [ ] 3-way visual AST Excalidraw canvas diff/merge UI.
- [ ] Historical snapshot restore and named Git tag milestones.
- [ ] Multi-workspace switching within a single account.
