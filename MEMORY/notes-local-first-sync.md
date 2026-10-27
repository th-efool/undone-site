# Notes Local-First & GitHub Sync Validation

## Authoritative contracts & evidence
- Pre-plan validation evidence: [plans/local-first-github-sync-validation/](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/plans/local-first-github-sync-validation/)
  - `inventory.md` (E1): Legacy path inventory, unscoped localStorage keys, 10MB image stripping risk, missing GET canvas route.
  - `auth-host-assets.md` (E2): GitHub App OAuth PKCE in Next.js BFF, AES-GCM-256 PostgreSQL token storage, 3.0MB direct raw binary limit (4.5MB Vercel envelope with base64 expansion).
  - `vertical-slice.md` (E3): 9/9 passing concurrency and failure injection scenarios.
  - `contracts.md` (E4): Frozen schemas, CAS ref update rules, generational outbox ACKs, content-addressable asset deduplication.
  - `release-gates.md` (E5): Distinct R1 (offline edit), R1 Target (offline reopen), R2 (cross-device recovery + multi-device sync), R3 (checkpoints).
  - `handoff.md` (E6): FULL BUILD READY verdict.
- Schema definitions: `plans/local-first-github-sync-validation/schemas/*.json` (notebook, note, asset, manifest, bundle).

## Validation code paths
- Test fixtures: `src/client/screens/dashboard/notes/validation/fixtures.ts`
- IndexedDB engine prototype: `src/client/screens/dashboard/notes/validation/indexeddb-prototype.ts`
- Sync coordinator & mock provider: `src/client/screens/dashboard/notes/validation/vertical-slice-harness.ts`
- Tests: `src/client/screens/dashboard/notes/validation/__tests__/` (30/30 tests passing).

## Known legacy boundaries
- `canvas.repository.ts` uses unscoped `sidequesthq.canvas.${noteId}` keys; migration reader must isolate by `userId`.
- Legacy automatic image trimming (>10MB largest-first strip) is strictly banned in local-first engine.
- MongoDB canvas endpoint `/api/workspace/canvas` lacks GET retrieval and is superseded by IndexedDB primary storage.
