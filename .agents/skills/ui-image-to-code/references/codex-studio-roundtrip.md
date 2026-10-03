# Codex–Studio round-trip workflow

Use this contract when users repeatedly edit UI in Studio, return to Codex, and expect both sides to continue from the latest safe state.

Before this loop starts, run `python <skill>/scripts/finalize_ui_to_studio.py <target-project>`. The resulting `.ui-job/studio-installation.json` must match the current source-generation marker and prove that Studio is editing the real generated production DOM with a non-empty stable identity registry. Do not enter the roundtrip loop from a template-only Studio, starter page, screenshot layer, or browser-local draft.

## 1. Truth model

- Treat production source as the shipping truth.
- Treat `.ui-studio/ui-document.json` as the shared editing and handoff truth.
- Treat `ui-studio-overrides.css` as a generated live-preview patch, never as the final component source. Studio may update this single allowlisted file immediately after a safe parameter save; Codex still owns absorption into canonical HTML/React/Vue source.
- Treat browser memory and `localStorage` as recoverable drafts only.
- Never claim Codex has received a Studio edit until the project document was written successfully.
- Never let Studio silently overwrite source that changed after its loaded base revision.

## 2. Project files

Create only these declared targets:

```text
.ui-studio/
├── ui-document.json
├── sync-state.json
├── source-map.json
├── identity-registry.json
├── handoff.json
├── evidence.json
├── operations.jsonl
├── references/
│   └── <reference-id>.png
└── history/
    └── revision-000042.json
```

- `ui-document.json`: versioned nodes, tokens, components, breakpoints, content edits, sanitized icons, and overrides.
- `sync-state.json`: revision, source hash, applied revision, writer, state, and timestamps.
- `source-map.json`: stable node IDs mapped to approved repository files and symbols. Do not accept paths from browser input.
- `identity-registry.json`: regenerated source identity index, declaration locations, duplicate IDs, and operation targets that no longer resolve.
- `handoff.json`: concise pending-change summary for Codex.
- `evidence.json`: current screenshot-analysis runs and per-node confidence evidence, mirrored from UI Document V4.
- `operations.jsonl`: append-only semantic handoff batches such as `analysis.confirm`, `property.change`, and `replace.asset`.
- `references/`: validated editor-only PNG evidence written through the constrained local bridge.
- `history/`: bounded recoverable snapshots. Keep the newest 20 by default.

Recommended sync envelope:

```json
{
  "protocolVersion": 1,
  "documentRevision": 43,
  "appliedRevision": 42,
  "previewRevision": 43,
  "previewStatus": "applied",
  "baseSourceHash": "sha256:...",
  "currentSourceHash": "sha256:...",
  "state": "pending-codex",
  "lastWriter": "studio",
  "updatedAt": "2026-08-12T14:30:00Z"
}
```

Allowed states:

- `clean`: document revision is applied and source hash matches.
- `studio-draft`: local browser edits exist but are not in project files.
- `pending-codex`: Studio saved a new project revision that Codex has not applied.
- `source-ahead`: Codex changed source and Studio has not reloaded the new base.
- `conflict`: both sides changed since the same base revision.
- `invalid`: schema, mapping, sanitizer, or source validation failed.

## 3. Constrained local bridge

The browser cannot be the authority for arbitrary filesystem writes. Provide a local development bridge with a strict allowlist.

Required operations:

```text
GET  /__ui_sync/status
GET  /__ui_sync/document
GET  /__ui_sync/history
PUT  /__ui_sync/document
PUT  /__ui_sync/reference/:id
POST /__ui_sync/handoff
POST /__ui_sync/reload-source
POST /__ui_sync/rollback
```

Rules:

- Bind to loopback only.
- Write only the declared `.ui-studio` targets.
- Restrict reference uploads to valid PNG data under `.ui-studio/references/`; reject arbitrary paths and oversized images.
- Require `expectedRevision` on every write.
- Validate the full document schema and sanitized SVG content before writing.
- Write to a temporary sibling file, flush, then atomically replace the target.
- Reject arbitrary paths, executable content, unknown future schema versions, and stale revisions.
- Return `409 conflict` with current revision and changed property paths when revisions diverge.
- Do not let the bridge directly rewrite arbitrary React/Vue/source files. For validated geometry and visual properties, it may atomically regenerate only the declared `ui-studio-overrides.css` preview patch after verifying stable IDs and the source hash. Text, SVG, structure, logic, routing, and component-source changes remain pending for Codex.
- Exclude generated preview patches from the canonical source hash. Track them with `previewRevision`, while `appliedRevision` continues to mean the revision absorbed into formal source.

If the bridge is unavailable, export `ui-document.json` and `handoff.json` as a manual fallback. Download-only mode is degraded and must be labeled clearly.

## 4. Studio behavior

Provide one visible sync control with these statuses:

- `本地未保存`
- `已保存到项目 · r43`
- `等待 Codex 应用`
- `Codex 有新版`
- `冲突 2 项`

Required actions:

- `保存到项目`: debounce ordinary edits, then write the next expected document revision.
- `交给 Codex`: save first, write `handoff.json`, and copy a short takeover prompt.
- `拉取 Codex 最新版`: load the new project document/source base after checking local drafts.
- `查看差异`: group differences by component and property, not raw JSON lines.
- `解决冲突`: choose Studio, Codex, or manual value for each conflicting property.

Autosave may write after 800–1500 ms of inactivity, but must use optimistic revision checks. Keep undo history in memory; coalesce project history snapshots by completed interaction rather than every pointer move.

After a successful safe-parameter save, run these actions as one visible transaction:

1. Persist revision `rN`, semantic operations, history, and evidence.
2. Validate stable IDs and regenerate `ui-studio-overrides.css` atomically.
3. Mark `previewRevision: rN`, so refreshing the actual page shows the latest size, position, proportion, color, radius, typography style, and effect values.
4. Create/update `handoff.json` for the same `rN` with status `preview-applied-waiting-codex`.
5. Keep `appliedRevision` unchanged until Codex absorbs the revision into canonical source and passes checks.

If target identity, source hash, stylesheet linkage, or schema validation fails, preserve the saved revision but do not update the preview patch. Show the blocking reason and keep the previous live revision recoverable.

Studio startup sequence:

1. Read sync status.
2. Compare project revision, local draft revision, and source hash.
3. Load clean latest state automatically.
4. If local draft and source both changed, enter conflict state before rendering editable controls.
5. Never discard a draft without an explicit choice or recoverable snapshot.

## 5. Codex behavior

For any UI task in a Studio-enabled project, run `npm run sync:context` before editing. It produces the persisted latest-UI context Codex must consume. Then follow this preflight:

1. Confirm `persistedOnly: true`; if the user reports newer unsaved browser changes, ask them to click `保存到项目` first.
2. Require identity status `valid`: no duplicate `data-ui-id` and no unresolved operation target IDs.
3. Read the latest revision, applied revision, source hashes, pending batches, and semantic operations from the generated context.
4. If state is `pending-codex`, summarize changes by stable node ID and property.
5. Apply changes through `source-map.json` to production source.
6. Run schema, identity, source, browser, and responsive checks.
7. Update `appliedRevision`, source hash, state, and a bounded history snapshot.
8. Regenerate the Studio-facing document when Codex changes source structure, IDs, tokens, or content.
9. Make Studio reload the new source baseline before the next visual edit cycle.

Codex must not assume browser `localStorage` is current or readable. If project state is clean and the user says they edited Studio, ask them to click `保存到项目` or use the degraded JSON export.

Every editable visible object keeps a stable `data-ui-id`. Revisions identify *when* the document changed; semantic-operation `targetIds` identify *what* changed; source hashes identify *which source baseline* the edit was made against. Do not infer object identity from coordinates, text content, DOM order, or layer names.

Recommended takeover prompt copied by Studio:

```text
使用 $ui-image-to-code 接管 Studio 最新修改。先读取 .ui-studio/sync-state.json 和 handoff.json，应用 pending revision，验证后更新同步状态；不要覆盖未合并的 Codex 源码改动。
```

## 6. Merge and conflict rules

Use stable node ID plus property path as the merge key, for example:

```text
sidebar.nav.home.label.content.text
sidebar.nav.home.icon.assets.svg.body
controls.reference.style.borderRadius
```

Perform a three-way merge against the shared base revision:

- Auto-merge when Studio and Codex changed different node/property paths.
- Auto-merge identical values.
- Mark a conflict when both changed the same property differently.
- Treat deletion, ID rename, parent change, and component detachment as structural conflicts.
- Do not merge geometry by adding deltas unless the document explicitly records delta semantics.
- Preserve both values and the base value in conflict records.

For a source-hash conflict whose pending delta contains only visual overrides, run `npm run sync:resolve-safe` after `sync:context` and `sync:changes`. The guard must require a current applied preview, resolvable stable IDs, and no newly pending text, icon, or structural edits. It records the accepted source hash as the new merge base but keeps the Studio revision pending until `npm run sync:apply`. Never use this command to bypass a rejected complex merge.

Generated override declarations are authoritative project parameters. They must win the cascade against host component selectors, and a browser computed-style check must confirm saved width, height, position, typography, and effects. When the generator changes while the UI document is already clean, run `npm run sync:refresh-generated`; this rebuilds only declared generated assets and must not advance the document revision or change the canonical source hash.

## 7. End-to-end user loop

### Studio to Codex

1. Edit in Studio.
2. Observe `本地未保存`.
3. Save the project revision. Safe visual parameters immediately update the actual page through the generated preview patch, while the same revision enters the Codex queue.
4. Return to Codex and send the copied takeover prompt, or say `同步 Studio 最新修改`.
5. Codex absorbs the generated patch into maintainable source, tests it, advances `appliedRevision`, and marks the revision clean without a visual jump.

### Codex to Studio

1. Ask Codex to modify UI source.
2. Codex finishes source changes, regenerates the UI document, and marks `source-ahead` or clean latest revision.
3. Studio detects the revision by polling or server-sent events.
4. Click `拉取 Codex 最新版`; clean sessions may reload automatically.
5. Continue editing from the new base.

No model turn is triggered merely because a browser file changed. The user must send a message, or a separately authorized automation must wake the Codex task. Do not promise automatic Codex awareness without that trigger.

### Real project preview and recovery

- `项目预览` opens the actual project entry page, without Studio overlays or editor-only CSS. It represents the latest revision already applied to source, not an unsaved browser draft.
- When `previewRevision` is newer than `appliedRevision`, the actual project may already show the safe parameter patch. Label this explicitly as “actual page updated · waiting for Codex”; never call it fully merged source.
- When Studio is dirty or `pending-codex`, explain that the preview still shows the applied source and offer save/apply guidance.
- Revision restore is append-only: restoring an earlier snapshot creates a new pending revision. Never delete or rewrite the intervening history.
- A restored revision must pass the same identity, source-hash, browser, and responsive checks before it becomes clean.

## 8. Acceptance tests

Verify at minimum:

1. A Studio text edit survives browser restart and is visible to Codex from project files.
2. Codex applies a pending revision to production source and marks it clean.
3. A Codex source edit appears in Studio without losing stable IDs.
4. Non-overlapping simultaneous edits merge automatically.
5. Same-property edits produce a visible conflict and preserve both values.
6. A stale `expectedRevision` write returns 409 and does not overwrite files.
7. Invalid SVG, arbitrary paths, and unknown schema versions are rejected.
8. Exported production UI runs without Studio, sync state, or local storage.
9. `npm run sync:context` reports the latest saved revision and pending semantic operations.
10. Duplicate `data-ui-id` values or missing operation targets block automatic application.
11. Real project preview opens the production entry and contains no Studio editing chrome.
12. Restoring an older snapshot creates a new revision and remains undoable through history.
13. A safe geometry save advances `previewRevision` and updates a refreshed actual page without advancing `appliedRevision`.
14. Missing IDs, duplicate IDs, or a missing preview stylesheet link block live application without losing the saved revision.
15. A visual-only source conflict can be safely rebased and applied without losing the concurrent source edit; text, icon, and structural conflicts remain blocked.
16. Generated width and height win over more-specific host selectors in browser computed styles, and refreshing generated assets leaves the revision and source hash unchanged.
