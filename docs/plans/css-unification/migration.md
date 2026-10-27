# Component and route migration: phases 4–6

Prerequisite: [foundations](foundations.md) gates P0–P3 pass. Use the [execution model](README.md), frozen contracts, and shared [verification gates](verification.md).

## Phase 4 — Consolidate reusable UI

**Purpose:** migrate features onto a coherent existing component system rather than copying fresh CSS into each screen.

### Parallel assignments

| Owner | Exclusive component scope | Deliverable |
| --- | --- | --- |
| A | Button and field/TextBar/control family | Consistent actions, input geometry, focus/error/disabled states |
| B | Dialog/popover primitives and their fixture tests | Themed, accessible overlays with bounded layout and clear API |
| C | Typography and status presentation primitives | Explicit application/display roles, readable help/status text |
| Lead | Shared exports, central fixture index, token/API changes | Stable integration contract and reviewed state gallery |

Exact directory ownership is assigned after P0 discovery. Reuse installed Radix and existing house components. Do not build a new primitive where the existing one can satisfy the contract with a small change.

### Steps

4.1 Lead identifies the smallest set of reusable components needed by the Notes pilot and remaining routes. Freeze prop/state names and allowed class/style overrides.

4.2 A standardizes action variants and field/control states without changing business behavior. Audit public APIs and every affected caller; maintain compatibility where changing all callers in this phase is unnecessary.

4.3 B implements overlay behavior and surface presentation: accessible name, focus containment/restoration, Escape, close action, sensible scrolling, width/height bounds, stacking, theme inheritance, and body-scroll behavior. Use existing behavior primitives rather than a second homegrown focus trap.

4.4 C separates application dialog/title/body/caption roles from landing/display roles. Preserve semantic heading levels. Resolve inherited help/error colors without broad descendant selectors that override nested components.

4.5 Each agent adds or updates focused behavioral and visual fixtures for its changed contract. Coordinate input/button usage within overlay fixtures through already frozen APIs; B does not edit A's files.

4.6 Lead integrates exports and the combined fixture gallery, reviews all shared consumer breakages, and runs the primitive gate. Publish concrete usage examples for the upcoming route agents.

**Gate P4:** primary/secondary/destructive actions, text/select/checkbox/radio controls, dialog/popover, title/body/help/error text, loading/disabled states, and focus behavior work in both themes and narrow/short viewports. No route migration depends on an undefined variant or token.

## Phase 5 — Migrate Notes as a complete pilot

**Purpose:** fix the user's examples and prove the architecture in a real subsystem before scaling it.

### Ownership setup — sequential first

5.1 Lead records current Notes/sync working-tree changes and maps desktop/mobile/editor callers. Read `MEMORY/notes-local-first-sync.md`. Backend credentials, OAuth, sync coordinator, IndexedDB, recovery semantics, permissions, and data models remain outside CSS changes.

5.2 Lead assigns `Notes.module.css`, `NotesDesktop.tsx`, shared Notes export/integration files, and any common fixture to exactly one owner. Prefer lead ownership of these chokepoints. Give agents dedicated new/existing component modules; they submit required shared-file changes as requests. Do not let three agents split the same 1,491-line stylesheet concurrently.

### Parallel assignments

| Owner | Exclusive scope | Work |
| --- | --- | --- |
| A | Share component/module, switcher-related component changes, dedicated tests | Correct encoding, class references, form layout, action hierarchy, dialog behavior |
| B | `connect-github-modal.tsx`, `sync-status-badge.tsx`, `WorkspaceSyncControl.tsx`, dedicated presentation tests/modules | Reuse shared primitives/tokens; preserve in-progress functionality; remove unsupported style classes |
| C | Mobile Notes modules and editor-adapter styles/tests, excluding shared Notes integration | Responsive controls, Canvas/Kanban isolation, dynamic CSS and route transitions |
| Lead | `Notes.module.css`, Notes shell/integration, `NotesSaveStatus` token alignment | Integrate requests, control shared style extraction, cross-component review |

### Implementation steps

5.3 A extracts Share only if needed to establish clear ownership; uses the established dialog primitive. Correct the corrupted quotation/shortcut literals, six missing module references, bounded permission field, flexible email field, and viewport-aware dimensions. Define local role-based classes; avoid relying on global `h2` or `.modal button` styling.

5.4 B migrates presentation while preserving existing connection/recovery handlers and state behavior. Separate disconnected/connected/error/loading appearances. Replace nonexistent animation utilities with an already supported mechanism only where animation is useful. No real OAuth or repository writes during presentation checks.

5.5 C verifies mobile layouts and editor boundaries. Keep vendor class names intact, scope adapters to owned editor roots, and test editor-open/editor-closed and Canvas-to-Kanban transitions. Audit slider duplication before deciding whether shared packaging is worth changing; do not create a package refactor solely for cosmetic similarity.

5.6 Lead integrates agent requests, removes only extracted/proven-unused Notes styles, fixes canonical token references in status UI, and reviews interactions across the whole Notes surface.

5.7 One browser owner captures the three target scenarios plus long titles, validation errors, loading, keyboard, narrow/short viewport, and opposite OS/app themes. Run existing Notes/sync tests relevant to touched components; use isolated authenticated checks for behavior that fixtures cannot prove.

5.8 Lead updates the migration ledger and graph, reviews before/after evidence, and records any vendor exceptions. Do not proceed to route waves if the architecture still requires new global overrides to make Notes work.

**Gate P5:** Share has correct text, usable fields and action hierarchy; connection dialog has proper spacing/theme and reachable actions; sync popover is readable and contained. Focus/Escape/labels/mobile checks pass. No persistence, permissions, sync, recovery, or credential behavior changes are introduced. Required authenticated coverage is passed or explicitly held pending; the full pilot is not called verified while that remains unknown.

## Phase 6 — Migrate the remaining routes in waves

**Purpose:** eliminate systemic drift across the app while keeping each change reviewable.

### Wave 6.0 — Shared shell/navigation first

6.0.1 Lead assigns shell, sidebar, mobile nav, command palette, and shared global components from the inventory to non-overlapping owners. Reserve root theme/layer files for the lead.

6.0.2 A migrates desktop navigation; B migrates mobile navigation; C reviews overlay/navigation/focus regressions and prepares browser tests. Reassign files if the graph reveals shared component ownership that prevents independent edits.

6.0.3 Lead integrates shell changes and checks every route's common frame, portal behavior, route transitions, and active/hover/focus states. Publish a stable shell contract before launching feature waves.

### Wave 6.1 — Independent application surfaces

| Agent | Proposed route ownership | Required memory/context |
| --- | --- | --- |
| A | Home and Explore, desktop/mobile | `home-dashboard.md`; shared card/filter/navigation callers |
| B | Messaging, desktop/mobile | `messaging-and-centrifugo.md`; message composer and realtime states |
| C | Studyroom discovery and room UI | `study-rooms.md`; timer/audio/environment/overlay behavior |

The lead owns shared widgets such as UpcomingEvents if consumed by multiple groups. A route directory is not proof of independence; verify the dependency graph before handing out writes.

### Wave 6.2 — Specialized surfaces

| Agent | Proposed route ownership | Required memory/context |
| --- | --- | --- |
| A | Creation/cohort builder and related mobile views | `cohort-builder-processing.md`; processing/review/editor states |
| B | Playback and player controls, desktop/mobile | `play-playback.md`; overlays, fullscreen, progress/drag controls |
| C | Landing/editorial surfaces | Explicit display typography, font roles, preference behavior |

Resolve cross-wave shared dependencies before starting. Keep playback/editor dynamic geometry and necessary vendor styles rather than replacing them with static tokens.

### Steps repeated for every route task

6.x.1 Query the graph; inspect current files and map shared consumers. Confirm the active layer, theme, tokens, and primitive contracts have not changed since assignment.

6.x.2 List local missing classes, undefined application tokens, duplicated primitives, unsupported utilities, broad selectors, and undocumented overrides. Distinguish confirmed defects from intentional route-specific presentation.

6.x.3 Migrate to canonical tokens and house primitives. Name module classes by UI role. Introduce no new shared token/API without a lead-owned contract update and an integration barrier.

6.x.4 Migrate the route's layer boundary as one deliberate work package, documenting remaining unlayered/vendor dependencies. Do not slip a layer change into an unrelated color/name cleanup.

6.x.5 Remove dead styles only when static references, dynamic/composed references, and runtime states have been checked. Do not split large files arbitrarily; split along stable component ownership when it reduces duplicated responsibility.

6.x.6 Run focused tests and provide before/after screenshots or computed evidence for changed states. The lead integrates the wave, then the browser owner runs shared shell plus already migrated route smoke checks against the stable combined state.

6.x.7 Record resolved items, residual exceptions, alias consumers, and evidence. Proceed to the next wave only after review; fix any new common issue once in the shared owner rather than copying workarounds into routes.

**Gate per wave:** no unexplained differences in the agreed route matrix; no newly missing classes/tokens; behavioral checks remain green; known prior broken states are corrected rather than preserved as the visual baseline. Each migrated route has named owners for remaining vendor/legacy exceptions.

### Wave 6.3 — Remaining-scope reconciliation

6.3.1 Compare the original entry-point inventory against migrated files. Assign active routes omitted from the named waves based on actual ownership; do not assume the example route list is exhaustive.

6.3.2 Classify archived, unused, generated, and externally owned files. Keep them out of active-UI completeness claims only with recorded justification.

6.3.3 Lead retires compatibility aliases only when all active, dynamic, package, and fixture consumers have migrated; preserve reviewed external contracts. Re-run affected checks after removal.

**Gate P6:** every active application styling entry point is migrated or has an explicitly justified retained contract. No unresolved core migration task is disguised as an exception. Shared APIs and tokens are ready for strict enforcement.
