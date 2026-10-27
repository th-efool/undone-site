# Personal Workspace: Local-First Durability & GitHub Sync

## Authoritative Contracts & Evidence
- Pre-plan validation evidence: [plans/local-first-github-sync-validation/](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/plans/local-first-github-sync-validation/)
  - `inventory.md` (E1): Legacy path inventory, unscoped localStorage keys, 10MB image stripping risk, missing GET canvas route.
  - `auth-host-assets.md` (E2): GitHub App OAuth PKCE in Next.js BFF, AES-256-GCM token storage, 3.0MB direct raw binary limit (4.5MB Vercel envelope with base64 expansion).
  - `vertical-slice.md` (E3): 9/9 passing concurrency and failure injection scenarios.
  - `contracts.md` (E4): Frozen schemas, CAS ref update rules, generational outbox ACKs, content-addressable asset deduplication.
  - `release-gates.md` (E5): Distinct R1 (offline edit), R1 Target (offline reopen), R2 (cross-device recovery + multi-device sync), R3 (checkpoints).
  - `handoff.md` (E6): FULL BUILD READY verdict.
- Production Plan: [plans/undone-local-first-github-sync.md](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/plans/undone-local-first-github-sync.md)
- Schema definitions: `plans/local-first-github-sync-validation/schemas/*.json` (notebook, note, asset, manifest, bundle).

## Production Subsystem Layout
- **Shared Domain Contracts (`src/shared/personal-workspace/`):**
  - `contracts.ts`: Authoritative TypeScript interfaces and Zod validation schemas for Notebooks, Notes (Canvas/Kanban/Markdown discriminated union), Assets, Outbox, Manifest, and Recovery Bundles.
  - `serialization.ts`: Deterministic canonical JSON serialization (`canonicalJsonStringify`), SHA-256 cryptographic hashing (`computeSha256`), and constant-time string equality (`secureTimingSafeEqual`).
  - `errors.ts`: Standardized error hierarchy (`WorkspaceError`, `ValidationError`, `CryptoError`, `StorageQuotaError`, `ConflictError`).
- **Local Storage Engine (`src/client/personal-workspace/local/`):**
  - `database.ts`: Transactional IndexedDB engine (`workspace_${userId}`) with multi-store transactional rollback across 7 object stores (`notebooks`, `notes`, `assets`, `outbox`, `editor_buffers`, `conflicts`, `metadata`) and `TabLockCoordinator` (Web Locks API + BroadcastChannel fallback).
  - `repository.ts`: High-level atomic repository methods (`saveNotebookAtomic`, `saveCanvasNoteAtomic`, `saveKanbanNoteAtomic`), monotonic outbox generations, and failure recovery.
  - `facade.ts`: `LocalWorkspace` unified client facade with in-memory state projection and multi-tab sync.
  - `recovery.ts`: Offline JSON recovery bundle export and import with SHA-256 checksum verification.
- **Client Sync Coordinator & UI (`src/client/personal-workspace/`):**
  - `sync/coordinator.ts`: Background synchronizer orchestrating local outbox drain, remote pull, CAS 422 conflict branching, and online/offline event handling.
  - `hooks/useLocalWorkspace.ts`: React 19 hook providing reactive state (`notebooks`, `notes`, `activeNote`, `syncSummary`, `commands`).
  - `ui/sync-status-badge.tsx`: Accessible visual badge representing 11 sync states (`saved_locally`, `syncing`, `synced`, `conflict`, `offline`, etc.).
  - `ui/connect-github-modal.tsx`: GitHub App connection dialog with PAT/OAuth token entry, repository picker, and encrypted token transmission.
- **Server Infrastructure & Security (`src/server/infrastructure/github/personal-workspace/`):**
  - `crypto.ts`: AES-256-GCM symmetric encryption with HKDF key derivation using `WORKSPACE_ENCRYPTION_SECRET` and `userId` salt.
  - `client.ts`: GitHub REST Git Data API client interacting with low-level Git objects (blobs, trees, commits, refs) and Contents API for empty repository bootstrap.
- **Server BFF Routes (`src/app/api/personal-workspace/github/`):**
  - `status/route.ts`: Remote connection and HEAD commit status inspection.
  - `connect/route.ts`: Credential encryption and vault cookie assignment.
  - `disconnect/route.ts`: Session vault clearing.
  - `publish/route.ts`: 4-step Git Data API push with Compare-And-Swap (CAS) 422 conflict detection.
  - `pull/route.ts`: Remote snapshot manifest and object hydration.
  - `oauth/authorize/route.ts`: 1-Click OAuth authorization initiation with encrypted state nonce cookie.
  - `oauth/callback/route.ts`: OAuth code exchange, auto-creation of private repository (`undone-notes`), and postMessage HTML response.
  - `oauth/config.ts`: OAuth client credentials resolution, redirect URI helper, and HTML templates.
  - `vault.ts`: HTTP-only encrypted cookie parser, PostgreSQL database bridge (`prisma.account`), and environment fallback.

## Testing & Verification
- Unit & Integration Test Suites: 12 files, 180 tests passing (`npx vitest run src/shared/personal-workspace src/client/personal-workspace src/server/infrastructure/github/personal-workspace src/app/api/personal-workspace`).
- Live GitHub Sync Runner: `scripts/test-live-github-sync.ts` verified against live repository `suyanamoly/undone-notestest`.
  - Live commit link: https://github.com/suyanamoly/undone-notestest/commit/c2fa6c08891760640b8f3f3d86e354d18c4bc865
  - Cross-device restore verified with 100% SHA-256 payload parity.

## GitHub App reconnect and credential lifecycle (Phase 1)
- `src/app/api/personal-workspace/github/app/install/route.ts` starts GitHub App user OAuth first; `app/oauth/callback/route.ts` identifies the regular GitHub account and reuses an installation it can access, avoiding repeated install attempts.
- New installation return uses `app/callback/route.ts`, which requires a fresh user-bound encrypted state and verifies the callback `installation_id` against `GET /user/installations` for that authorized GitHub account before minting a token.
- `personal_workspace_github_connections` stores non-secret installation/repository/account IDs in PostgreSQL. Do not persist installation access tokens there. `vault.ts` mints short-lived tokens on demand; the in-process token cache avoids minting on every API call.
- GitHub App registration must list `/api/personal-workspace/github/app/oauth/callback` as an OAuth callback URL and `/api/personal-workspace/github/app/callback` as its Setup URL with Redirect on update enabled. Keep Request user authorization on installation disabled because the app uses its own preceding OAuth step.
- Apply `prisma/personal-workspace-github-connection.sql` to deployed PostgreSQL before enabling the new build; `prisma generate` updates the client locally.

## Notes sync repair implementation (Phase 2)
- `PersonalWorkspaceDatabase.runTransaction` serializes transactions per engine instance; `clear()` uses the same atomic transaction path. Do not call `runTransaction` from inside its callback (would wait on the current queue slot).
- `NotesRepository.save` now awaits every local workspace receipt before calling the legacy notes API. It reports local persistence failure separately from a remote API failure; pending outbox data wins over a stale API snapshot during reload.
- Canvas IndexedDB commits scene, extracted assets, and outbox together. Canvas Mongo/API writes are compatibility mirrors issued only after that local commit; a failed local commit leaves the canvas dirty/error and cannot be converted into localStorage success.
- Canvas debounce cleanup flushes committed local persistence on note switch/unmount, and stale saves do not clear a newer dirty generation. Browser unload remains guarded by the unsaved-changes prompt and best-effort recovery buffer.
- Phase 2 transaction serialization is per `PersonalWorkspaceDatabase` instance. Cross-tab same-record conflict handling and continuous pull/reconciliation remain Phase 3+ work.

## Continuous pull and live view reconciliation (Phase 3)
- Pull consumes the server's top-level `{ commitSha, manifest, notebooks, notes, assets, schedules }` response. The status endpoint only reports connection/repository details and must not be treated as a remote head-SHA source.
- Every sync cycle pulls and validates a complete manifest-backed snapshot, including empty-outbox cycles. Apply is one IndexedDB transaction, preserves entities with pending/in-flight mutations, and advances `githubRemoteCommitSha` only with that verified snapshot; publish acknowledgement deletes only exact batch IDs and records its confirmed commit SHA atomically.
- Remote snapshot application raises a separate repository event so `LocalWorkspace` refreshes mounted views without making the pull look like a local edit. Local save-success events schedule a debounced sync; online, focus, visibility, and periodic triggers provide catch-up.
- Transient sync failures retry with bounded exponential delays. Authorization failures surface reconnect-required. Exact cross-device semantic conflict policy and preventing all divergent Git writes remain Phase 4 work; this protocol does not claim zero conflict probability.

## Race recovery and lossless publication (Phase 4)
- `publish/route.ts` requires the client’s explicit expected remote commit, verifies current branch HEAD before creating Git objects, and rechecks the expectation through `GitHubGitDataClient.updateRef({ expectedSha })`. The final GitHub ref PATCH remains non-force; 422 is a retryable stale-head signal.
- Coordinator retries a stale head by pulling and applying the verified snapshot, then rebuilding the publication against the new SHA, with at most three immediate attempts before retaining the outbox and scheduling retry.
- On remote apply, compare each dirty record with the previous verified per-record hash. If local and remote both diverged from the same base, atomically store base/local/remote payloads in IndexedDB `conflicts`; dirty local state remains active, including deletion-vs-edit and notebook/note/asset/schedule records. These automatic recovery records do not show as user-action conflicts.
- If a publish response is lost after the ref moves, the next pull compares each queued mutation’s final state to the verified remote snapshot and acknowledges only the exact matching outbox IDs. No acknowledgement occurs on a mismatch.
- The GitHub App path does not create merge commits or force-update refs. Serverless multi-instance serialization is not implemented; non-force ref updates and expected-head checks remain the concurrency boundary.

## Migration, recovery and payload guards (Phase 5 implementation)
- `PersonalWorkspaceRepository.getMigrationInventory()` reads one verified IndexedDB snapshot, validates every referenced canvas/kanban asset, and returns per-record hashes, counts and byte totals without mutating the outbox.
- GitHub connection preflight inventories local IndexedDB, user-scoped legacy note cache, unscoped legacy canvas primary/backup keys, legacy Mongo/API notes, and the selected repository before starting the coordinator. It requires explicit merge confirmation, refuses another Undone account's manifest, blocks ambiguous/missing legacy canvases, and blocks legacy/local shared records so personal sync cannot silently copy them.
- Legacy Mongo notes merge by stable ID with local records taking precedence. Same-ID divergent legacy versions are retained as automatic recovery records; a receipt records source counts/hash and the resulting local inventory. The original Mongo and browser sources are not deleted.
- Publish validates each asset and all note references before creating Git objects; pull rejects missing/corrupt manifest assets and any note whose required asset is absent. A canvas is not considered synchronized from a snapshot with incomplete assets.
- One publish request is capped at 4 MiB JSON to remain below the deployed serverless request-body ceiling. Oversized workspaces retain their local outbox and receive an actionable error; payload splitting is not implemented.
- The current app shell has no service worker. Offline edits work only after the app/workspace is already open and provisioned; offline reload/reopen is not supported or promised. IndexedDB may be evicted, so use the built-in recovery export. No legacy cleanup or automatic rollback to Mongo is permitted until restore and reverse-import have been demonstrated.
