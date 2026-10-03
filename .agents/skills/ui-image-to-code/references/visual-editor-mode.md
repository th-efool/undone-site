# Professional visual editor mode

Build a code-connected design workspace for the final human adjustment pass. Use professional UI-editor conventions while preserving web layout semantics and exportable source.

## Contents

1. Workspace shell
2. Canvas tools
3. Selection and alignment
4. Inspector
5. Auto layout and responsive behavior
6. Components and tokens
7. Icon library JSON/SVG import
8. Comparison and diagnostics
9. Persistence and source export
10. Verification

## Workspace shell

Provide:

- A top bar for file/route, zoom, viewport, theme, undo/redo, preview, save, and source export.
- A narrow tool rail for select, frame, section, text, shape, hand, zoom, and comment tools.
- A left workspace with Layers, Components, and Assets tabs; include search, hierarchy, visibility, lock, and component-instance markers.
- A center infinite-feeling camera workspace with multiple named frames, pan/zoom, horizontal and vertical rulers, guides, grid, clipping, and viewport presets. Keep the page/frame inside a much larger neutral world so it can be dragged to the visual center or any comfortable working position; never clamp the page to the workspace's top-left corner.
- A right sidebar with Design, Prototype, and Inspect tabs. Keep production source inspection available without switching tools.
- Resizable/collapsible panels and a distraction-free preview.
- Allow the left panel, right panel, and top toolbar to collapse independently. Provide focus mode plus a recoverable fullscreen control; never hide every exit control.
- Provide persistent toolbar toggles and canvas-edge reveal/collapse handles for both side panels. Restore the user's prior panel state after focus/fullscreen mode.
- Design canvas-edge panel handles as quiet split-view controls, not naked chevrons or protruding black tabs. Use a side-aware pane glyph plus directional arrow, a roughly 36–40px desktop hit target, restrained translucent material, a clear keyboard focus ring, and delayed contextual tooltip. Place handles below ruler chrome so they do not cover ruler ticks or selection labels. Expose `aria-controls` and `aria-expanded`, reverse the arrow when collapsed, and give the collapsed/reveal state a subtle accent so recovery remains discoverable.
- Keep the canvas free of redundant instructional cards and status copy when the same information already exists in the toolbar, inspector, or contextual tooltip.
- Prefer one continuous command bar divided into clear functional zones: viewport/zoom, selection tools, snap/guides, and save/export. Keep high-frequency or outcome-critical actions visibly larger and directly clickable; place lower-frequency CAD, comparison, resource, reset, focus, and secondary export commands in named popovers. At narrow desktop widths, replace segmented viewport presets with a select and shorten labels without hiding functionality or creating horizontal scrolling.
- Use one parity render profile for the editor iframe and exact project preview. Both must load the real project source at the same CSS viewport width and height; editor-only classes, browser-local overrides, or implicit height compaction must not change production layout. Put responsive behavior in a separately labeled live/device preview that follows the browser window. Never compare an editor frame against a live preview whose CSS viewport or render profile differs.
- Mark the accepted center-canvas engine with a versioned canvas-core contract. Shell redesigns may change toolbar and panel chrome, but must not silently change selection IDs, pan/zoom, rulers, snapping, guides, undo semantics, or clean export.
- When the product has multiple editing domains, place an explicit feature rail before the detailed work tree. A user must be able to enter Screenshot to UI, Structure, Icon, Text, Frame, Compare, or Deliver work without knowing DOM hierarchy. Merge menu navigation and layers into one persistent page-driven Structure tree: shared shell → navigation → menu/page → real layers. Do not duplicate menus in a separate domain. Single-clicking a page/menu row switches only the real center UI while preserving camera and keeping layers collapsed. Double-clicking that row, or clicking its dedicated live-count/disclosure target, expands its real layers inline without replacing the menu tree. Switching other domains must change the left object list, select/reveal a matching center-canvas object, and replace the right inspector's priority section with the relevant tools.
- Structure the left side as a two-pane split view, not three competing navigation systems. The narrow rail is top-level navigation only: use one level of consistent line icons, at least a 44px target, one restrained accent selection state, and a flexible spacer that separates primary editing domains from Compare/Deliver. Put detailed hierarchy in the adjacent context pane rather than nesting it in the rail.
- Give the context pane a stable sequence: concise title and count, search, one compact settings row, tree/list toolbar, scrollable content, and a small selection/status footer. The tree/list must remain the visual focus. Avoid decorative cards, gradients, glows, repeated headings, and instructional copy that competes with editable content.
- In task-specific Icon, Text, and Frame workspaces, replace persistent onboarding cards with one compact task bar, search, and a scrollable object list. Default each row to a human name plus useful context such as actual text, parent menu, or container type. Keep stable IDs and HTML tags behind an explicit developer-info toggle instead of showing implementation metadata to every user.
- Derive consumer-facing layer names from the imported page language and visible semantics. Prefer visible text and accessibility labels, inherit a labeled control's name for atomic icons, and localize only the missing semantic kind. Do not leak `Root`, `Icon`, `Container`, raw tags, or stable IDs into a Chinese/Japanese/Korean layer tree. Recompute names after page swaps and preserve genuinely visible mixed-language brand copy.
- Preserve the last selected object and scroll position separately for each feature workspace. Hovering a list row should softly reveal its real canvas object without changing selection; clicking selects and locates it. Switching feature domains must restore the user's previous working position rather than jumping to the first row every time.
- Do not render whole/section/atomic selection and all/menu/icon/text filtering as two stacked segmented controls. They represent different mental models. Use two explicitly labeled pop-up/select controls (for example `Select: Atomic` and `Show: All layers`) and keep their state synchronized with canvas behavior and tree results.
- Make the left split view drag-resizable with sensible per-breakpoint minimum and maximum widths, keyboard-adjustable through its separator, double-click reset to the responsive default, persistence across reloads, and automatic canvas refit. At narrow widths, compact labels or duplicate commands before allowing horizontal application scrolling.
- Keep typography and row geometry systematic: roughly 12–13px pane titles, 10–11px dense tree text, compact 28–32px outline rows, 44px-or-larger top-level targets, and consistent icon stroke/optical size. Use platform system fonts and keep motion limited to short state transitions and press feedback; respect reduced motion.
- Recognition must use a dedicated evidence canvas outside the versioned production-canvas core. Show the screenshot and candidate overlays in the center, candidates and acceptance in the left workspace, and name/type/confidence/bounds in the right inspector. When available, expose OCR import, layout inference, and same-origin DOM calibration as explicit adapters with visible provenance. Dimension matching may expose DOM calibration but must never run it without explicit provenance and canonical pixel-fingerprint confirmation that the screenshot is the current rendered page. Smart triage may propose accepted/review/excluded states but must not set Human evidence. Save only Human-confirmed accepted candidates after the review queue reaches zero, every accepted node is individually confirmed, the graph passes, and the user confirms the summary; never inject the screenshot into production DOM.
- Compare must also use a dedicated evidence workspace outside the production-canvas core. Require matching-dimension reference and clean browser-render screenshots; provide overlay, side-by-side, heatmap, blink, and ranked mismatch regions. Keep diagnostic pixel metrics visibly separate from the weighted 95% gate, require all eight categories before a pass, and cap critical failures at 94. A same-image self-test validates the diff engine only and must never be presented as implementation fidelity.
- Keep feature-domain lists code-connected: menu entries select semantic menu containers, icon entries select atomic SVG layers, text entries select atomic text nodes, and frame entries select real containers or controls. Do not create decorative pseudo-objects that cannot be exported.
- In icon context, render sprite-based `<use>` icons as resolved standalone previews, then keep the existing sanitized JSON/SVG replacement path. In text context, position content, typography, and license-declared open-font controls before generic box properties. Give Compare and Deliver dedicated inspectors instead of forcing them into a selected-layer property form.

Do not imitate a specific brand or copy proprietary assets. Reuse the interaction grammar of professional design tools.

## Canvas tools

Implement these behaviors before decorative polish:

- Pan using a persistent hand tool, Space + primary-button drag, middle-button drag, primary-button drag on empty workspace, and unmodified wheel/touchpad input. Mouse middle-button drag must stay one-to-one and stop on release; do not add mouse momentum. Zoom around the cursor using Alt+wheel and keyboard shortcuts. Do not steal Ctrl/Cmd+wheel from the browser or element dragging while the select tool is active. While pointer panning is active, suppress wheel zoom until release.
- Separate the viewport camera from production UI geometry. Panning changes only camera scroll/translation and must never write x/y overrides, move the root page, dirty the project, or enter undo history. Persist the manual camera position independently from the versioned UI document; legacy manual-zoom sessions without camera coordinates must open centered.
- Use a large rebaseable workspace (or equivalent virtual camera) with meaningful room on all four sides of the frame. Capture the active pointer so panning continues outside the starting surface. Optional flick panning must be interruptible, capped, short, and disabled under reduced motion; slow precision drags must stop exactly on release.
- Treat mouse wheels and precision touchpads deliberately: normal wheel pans, Shift-wheel pans horizontally, and Alt+wheel performs Studio cursor-centered zoom. Ctrl/Cmd+wheel remains browser-native. Coalesce high-frequency wheel deltas into one camera transaction per animation frame and calculate iframe cursor coordinates from its actual rendered scale, not a cached zoom value.
- During direct camera manipulation, show a small fixed-size HUD with the action, zoom, and frame offset; hide it shortly after release and never let it intercept the pointer. “Locate selection” may animate for at most 180ms with a strong ease-out for spatial continuity, but every pointer/wheel/pan command must cancel it synchronously. Do not animate keyboard camera commands.
- Provide three equivalent recovery paths when the page is lost: a compact top toolbar “return to canvas” action, Ctrl/Cmd+0, and double-click on black empty workspace. Fit and center must use the same camera function so their results cannot drift.
- Keep top and left rulers fixed to the canvas viewport rather than nesting them inside the scrollable page frame. Reposition tick origins from stage offset, scroll, and zoom in the same animation frame as camera movement. Drag from the top ruler to create a horizontal guide and from the left ruler to create a vertical guide; a single visibility command may hide both rulers and guides.
- Split the left shell into a persistent feature rail and a collapsible contextual workspace. Collapsing content must not hide the feature rail. Clicking a feature while collapsed reopens the content and shows that feature's matching tree or tools. Split-view toggles use a compact pane glyph and delayed tooltip, not a large directional tab.
- Provide persistent contain, proportional cover, fit-width, fit-height, actual-size, and manual zoom modes. Recalculate the active automatic mode when the viewport, window, panels, focus mode, or fullscreen state changes.
- Treat a click on empty canvas workspace as deselect-all, but preserve panning when pointer travel exceeds a small movement threshold. Make Escape deselect before it exits focus mode.
- Create/select frames and show their name, dimensions, breakpoint, and clipping behavior.
- Render rulers, draggable guides, optional layout grids, and snap indicators. Keep ruler chrome a fixed readable screen size while tick positions and numeric units follow canvas zoom; choose adaptive tick intervals such as 5/10/25/50/100/200.
- Snap moving and resizing nodes across the whole visible document, not only siblings. Include typography baselines, borders, padding/content edges, sibling/cross-container edges, spacing increments, grid increments, and guides. Keep snapping deliberately weak in dense UIs: acquire explicit guides only inside 3 fixed screen pixels, structure edges inside 4 pixels, and grid points inside 2.5 pixels; use a small 4.5–6px release band. Rank physical distance first, use semantic priority only to break sub-pixel ties, deduplicate coincident targets, and let a clearly nearer target break sticky snapping immediately. Convert those screen radii through the real rendered axis scale so the perceived tolerance stays constant at every zoom.
- Label temporary snap lines with the resolved semantic target (for example guide, content edge, component bottom, text baseline, or grid) so users can diagnose a wrong snap immediately. Allow a modifier to bypass snapping.
- Show temporary horizontal and vertical snap lines and expose an explicit snap-to-intersection action. When both axes snap, emphasize the two axis lines or labels without drawing an additional crosshair over the selected content.
- Let users add horizontal or vertical guides, drag them, hide them, clear them, and delete one guide without affecting production source.
- Show live distance measurements while moving or resizing.
- Support arrow-key nudging, Shift for a larger increment, copy/cut/paste, delete, rename, lock, hide, and true duplication. Delete/Backspace must be an immediate, undoable soft-delete keyed by stable layer ID, with the page root protected and locked layers skipped. Ctrl/Cmd+C must copy a versioned internal layer-adjustment payload; Ctrl/Cmd+V pastes content/geometry/appearance to the selected stable target, while Ctrl/Cmd+Shift+V pastes appearance only. Ctrl/Cmd+J may create a true duplicate only when the UI document and source bridge both persist a constrained structural insertion containing the source ID, new root ID, parent/order anchors, and a complete descendant ID map. The bundled template supports this through `structuralEdits.insertions`; never fall back to an editor-only clone.
- Route the same shortcut dispatcher through both the Studio chrome and the production iframe so a key works immediately after canvas selection. Do not intercept shortcuts while focus is inside an input, textarea, select, or contenteditable target. Support Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Windows Ctrl+Y, Ctrl/Cmd+A for current-level selection, Tab/Shift+Tab layer traversal, Escape deselection, Ctrl/Cmd+0 fit, Ctrl/Cmd+1 actual size, and Ctrl/Cmd +/- zoom. Keep shortcuts discoverable through a compact keyboard reference dialog and contextual status hint.
- Use an overlay layer for selections, handles, measurements, and guides so editor chrome cannot change layout.
- Mount selection and handle overlays inside the canvas surface's own positioned, clipped overlay root. Convert viewport coordinates into canvas-local coordinates before painting the overlay; never append a fixed selection box to the application body where it can cover sidebars or toolbar chrome.
- Treat the iframe/production DOM's measured rendered rectangle as the only geometry truth for selection overlays. Derive horizontal and vertical render scale from the actual iframe `getBoundingClientRect()` and its CSS viewport, then include canvas scrolling when converting into the clipped overlay root. Never position an overlay by multiplying document bounds with a cached zoom value alone. Repaint the overlay on zoom, canvas scroll, iframe scroll, viewport changes, panel resizing, and live DOM geometry changes.
- Coalesce high-frequency pointer samples into at most one visual update per animation frame. During object movement, write only the selected node's direct `translate` and the overlay transform; do not recompute every style, inspector section, layer row, sync badge, and selection bound for every raw pointer event.
- Treat the inspector as a secondary readout during direct manipulation. Update its live geometry at a lower cadence, then perform one authoritative full refresh on pointer-up.
- Keep snap acquisition and snap release as different thresholds. Once an edge, baseline, guide, or grid target is acquired, retain it until the pointer leaves a wider release radius so neighboring targets do not cause visible jitter.
- Start a move only after a small physical-pixel threshold, support Shift axis locking, Ctrl/Cmd temporary snap bypass, pointer capture/coalesced events, Escape cancel, and multi-touch protection. Alt-drag must create a real persisted duplicate before movement rather than merely bypass snapping; all descendant IDs must be regenerated and insertion plus geometry must be one undoable command. Alt retains resize-from-center behavior on resize handles. Commit the entire gesture as one undoable command on release; never generate history entries while the pointer is still down.
- Selected controls such as `input`, `textarea`, and `select` must remain directly draggable in design mode even though they are interactive in preview mode. Route pointer input from a selected descendant to its active selected ancestor, add a transparent inset body-move surface, and keep double-click available for drilling into the next child layer. Capture the pointer on an element in the same document that emitted the event; never transfer pointer capture from an iframe gesture to an outer-document overlay.
- Apply `will-change` only for the duration of the active gesture and clear it on release or cancellation. Use fractional live coordinates and normalize only the persisted result; rounding every pointer sample creates visible stair-stepping at non-integer zoom levels.

## Selection and alignment

- Select from canvas or layer tree and keep both synchronized.
- Provide explicit whole-page, semantic-section, and atomic-layer selection scopes. Section selection should resolve a clicked label or icon to its nearest real menu/card/panel node, while atomic selection drills to the stable leaf node.
- For every visible menu item, create a correspondingly named layer-tree node (for example `Menu · All products`) with independently selectable icon, label, badge, and chevron children. Canvas selection must expand, scroll to, and highlight the matching tree row; canvas hover may softly reveal the matching row.
- Layer filters may overlap: a menu icon is both part of a menu and an icon. Filtering must not destroy hierarchy, IDs, or source mapping.
- Treat a selected parent/group as one editable block whose descendants are visibly marked as included. Moving or proportional corner-scaling the group must transform its child content together. Let users drill into a specific descendant for atomic editing.
- Support collapsible layer groups, recursive Alt-collapse/expand, automatic ancestor expansion when a deep canvas node is selected, group visibility, and inherited group locking.
- Decompose visible primitives into selectable atomic layers. A menu container, its icon, label, badge, and chevron must be distinct layers. Split title/subtitle pairs, stacked text, icon wrappers, icons, numeric values, and button labels instead of exposing only their parent component.
- Keep each atomic layer backed by a real DOM or framework node with a stable ID and source mapping. Do not create editor-only pseudo-layers that cannot be exported.
- Give every layer row explicit atomic visibility and lock controls using one coherent SVG icon system. Use at least a 30 × 30 CSS-pixel hit target, a visible hover/focus/pressed state, `aria-label`, `aria-pressed`, and inherited-lock feedback. Do not use punctuation dots, Emoji, Unicode glyphs, or a combined ambiguous accessory. Keep the two controls revealed for selected, hidden, locked, hovered, and keyboard-focused rows without changing row width or moving the text label.
- Treat project-menu counts as live data, not decorative metadata. Count only stable production layers inside the destination root, update the active count from DOM mutations, preflight inactive pages in an isolated renderer, and distinguish page counts from dynamic action/state entries. Never move the main canvas to obtain a count and never publish a guessed number.
- Support Shift multi-select from both the layer tree and production canvas. A normal click replaces the selection; Shift-click adds or removes one object. Keep a visible primary selection plus quieter secondary selections, show the count in the left footer, and restore single-object inspection as soon as only one object remains.
- Support Shift-drag marquee selection from empty/root canvas space. Render the marquee in the clipped editor overlay, apply a short movement threshold, respect whole/section/atomic selection scope, exclude conflicting ancestor nodes when atomic descendants are selected, and never write production geometry or history merely for selecting.
- Prevent simultaneous selection of an ancestor and its descendant. When Shift-adding a related parent or child, replace the conflicting selection branch so a batch move never transforms the same visual content twice.
- Show one union selection box for multiple items. Hide resize handles in union mode, keep a clear group-move grip, preserve snap-line feedback, and move every unlocked object by the same rendered delta. Locked objects may remain selected as anchors but must be skipped with explicit feedback.
- Replace the single-object property form with a dedicated batch inspector during multi-selection. Show a short removable object list, a locate-all action, six alignment actions, and horizontal/vertical equal-spacing actions. Disable distribution until at least three unlocked objects are selected.
- Align left, horizontal center, right, top, vertical center, and bottom against the selection union. Distribute horizontally/vertically by rendered bounds while preserving the first and last unlocked objects. Commit the entire operation as one undo step.
- Provide keyboard parity for frequent arrangement work: Ctrl/Cmd+Alt+Arrow aligns to an edge, Ctrl/Cmd+Alt+H/V distributes horizontally/vertically, Ctrl/Cmd+[ or ] moves one stacking level, and adding Shift sends the selection fully backward/forward. Persist stacking with stable-ID overrides and include every arrangement command in undo/redo and clean source export.
- Apply arrow-key nudging to the full multi-selection, with Shift for the larger increment. Ctrl/Cmd+Z must restore every affected object together.
- Render the selection overlay and eight handles outside the scaled production iframe/DOM so handles remain readable and all four corners remain reachable at canvas edges. Four corners proportionally scale by default; four edge handles resize one axis. Make each complete selection border a forgiving 20–28px fixed-screen-space resize hit zone: north/south resize height, east/west resize width, border hover/active state reveals a restrained accent line, and corner handles keep higher stacking and hit priority. Add a proximity fallback so a pointer within about 18 screen pixels of a border resolves to resize even if a transparent child surface won the raw event target. This is required so an element remains resizable when zoom or panning moves the opposite handle outside the viewport. Hide border resize zones in multi-selection unless union resizing is implemented. Use Shift to invert aspect locking and Alt to resize from center.
- Use one compact selection-name pill as the explicit move grip. Keep it physically separated from the top resize zone; do not stack a second “move” badge over the same border. When the rendered object becomes small, hide the four midpoint handles while keeping the four corners and all complete edge hit zones active. Reject non-finite geometry snapshots and fall back to a fresh real-DOM measurement so selection labels can never display `NaN × NaN`.
- Treat resize as an explicit `pressed → dragging → committed/canceled` gesture state. The exact edge or handle that receives pointer-down must retain pointer capture until release; do not transfer capture to a neutral parent that loses the native directional cursor. Lock the resolved `ns-resize`, `ew-resize`, or diagonal cursor across the editor for the gesture, keep the active handle visible and accented even if compact-mode rules would normally hide it, and freeze selection-label placement/compact chrome until release. For compact objects, reduce edge insets so west/east and north/south hit zones never collapse to zero. Do not animate functional resize geometry or its active affordance.
- During a move or resize gesture, update the real DOM node first and repaint the overlay from deterministic geometry derived from the immutable pointer-down snapshot. Do not animate a second independent selection-box transform and do not force a DOM read after every geometry write. The north handle must change top and height while anchoring the predicted bottom edge, the south handle must anchor the top edge, west must anchor right, east must anchor left, and corner handles must stabilize both opposite edges. On pointer-up, perform one measured DOM reconciliation so Flex/Grid/normal-flow effects are reflected exactly. The overlay label, inspector values, source override, undo command, and clean preview must all resolve from that same operation.
- When a move or resize pointer enters a fixed 48–64px screen-space zone near a canvas edge, auto-pan the camera toward that edge. Ramp speed quadratically with edge proximity and cap it to preserve precision. Accumulate actual scroll distance into the pointer's document-space delta so the object remains under the pointer instead of lagging behind the moving camera. Run the loop with requestAnimationFrame, stop synchronously on release/cancel or when scrolling reaches a world boundary, persist camera state separately, and keep the whole object gesture as one undoable source operation.
- Keep camera scroll, real-DOM geometry mutation, and overlay painting inside the same animation-frame transaction and in that order. Do not let the canvas scroll listener schedule another delayed overlay repaint while a manipulation transaction owns the frame. Direct-manipulation frames must be layout-read-free: preserve fractional document coordinates, predict both move and resize rectangles from the immutable start snapshot plus resolved pointer delta, and paint that current-frame result immediately. Perform one authoritative rendered-bound measurement and anchor correction only on release. During the gesture, update only X/Y/W/H/scale inputs needed for feedback; defer typography, appearance, tree, sync, and source-panel recomputation until release. Do not add interpolation or spring smoothing to functional selection geometry—the overlay must show current-frame truth.
- Reorder flow children by dragging. Do not silently convert flow content to absolute positioning.
- Show an explicit mode switch when the user wants an item to ignore auto layout/free-position.

## Inspector

Expose applicable properties only. Group them in collapsible sections:

- Use a sticky selection summary with a human object type, editable-layer name, short parent breadcrumb, and one locate action. Put stable node IDs and raw element tags in a collapsed Source/Developer section.
- Order sections by the selected object: Typography before Appearance for text; icon replacement before Appearance for icons; Geometry, Appearance, and Layout first for containers and controls. Keep advanced effects, arrange actions, layout detail, and source mapping collapsed until requested.
- Do not show irrelevant box controls for atomic text or icon layers. Hide background, radius, and padding when they do not apply; use specific labels such as `文字颜色` and `图标颜色` instead of a generic foreground field.
- After an inspector change, provide a brief canvas highlight and a reversible message such as `圆角已更新 · Ctrl+Z 撤销`. Feedback must confirm the affected property without interrupting the edit flow.

- Frame: X, Y, width, height, rotation, clip, min/max size, overflow, z-index.
- Layout: flow/flex/grid/free; direction, wrap, gap, alignment, distribution, order, grow/shrink/basis, grid tracks and spans.
- Spacing: individual padding and margin sides with linked/unlinked editing.
- Constraints: left/right/top/bottom/center/scale and breakpoint behavior.
- Typography: family, weight, size, line height, letter spacing, alignment, wrapping, max lines, and truncation.
- Appearance: fills, gradients, borders per side, corner radii per corner, shadows, blur, blend, opacity, and visibility.
- Component: main component, instance, variants, properties, slots, detach/reset, and documentation.
- Export: asset type, scale, filename, code target, and source mapping.

Allow scrub-to-adjust numeric labels, direct numeric input, unit selection, reset-to-inferred value, and token binding.

For text layers, make content and typography first-class rather than treating text as a generic box. At minimum edit content, family, weight, size, line height, letter spacing, alignment, color, and wrapping. Keep the text layer atomic and export content edits into source, not only CSS or local storage.

Offer a small, license-declared open-font library rather than an unlabeled font dropdown. Prefer SIL OFL fonts with safe CSS fallback stacks, detect whether a font is installed for preview, link to the upstream project, and do not silently bundle large font binaries. Do not label a font “free commercial” without recording its exact license and source.

For frames and boxes, expose rotation, fill, opacity, radii, stroke width/color/style, and shadow parameters as real exported CSS. Setting a non-zero stroke width on a borderless node should create a visible default solid stroke instead of appearing broken.

## Auto layout and responsive behavior

Model web layout instead of a flat coordinate scene:

- Map horizontal/vertical/wrap auto layout to flexbox and grid auto layout to CSS Grid.
- Support fixed, hug-content, fill-container, min/max, and intrinsic sizing.
- Expose gap and padding handles directly on the canvas.
- In normal flow, dragging reorders siblings or changes flow spacing.
- In flex/grid, edit layout properties rather than manufacturing x/y offsets.
- In free/absolute regions, expose x/y, anchors, containing block, and z-index.
- Store breakpoint overrides separately and show which values inherit or override.
- Preview nearby widths and flag overflow, clipping, and unexpected wrapping.

## Components and tokens

- Detect repeated visual structures and propose components before export.
- Preserve a main-component/instance relationship. Editing the main component propagates; editing an instance creates an explicit override.
- Support variants for state, size, emphasis, and theme; support slots for variable child content.
- Keep colors, typography, spacing, radii, shadows, and sizing in semantic tokens.
- Support token aliases and modes such as light/dark or desktop/mobile.
- Map existing repository components and tokens before generating new ones.

## Icon library JSON/SVG import

- Provide a first-class icon importer that targets a selected atomic SVG layer, or resolves the independently mapped SVG child of a selected menu/component group.
- Make the default path understandable without documentation: show a compact three-step state flow (`confirm target` → `paste name` → `inspect and replace`), focus the paste field, include one real example, and keep the primary action disabled until both target and preview are valid. Prefer contextual, task-specific help over a blocking onboarding tour.
- Accept the copied Iconify name form `prefix:name` as the primary input. Also recognize `prefix/name` and `icon-[prefix--name]`, deduplicate matches, and extract valid names from noisy whole-page copied text such as an icon details page. Resolve names through the official Iconify SVG endpoint, then pass the response through the same sanitizer as manually pasted SVG.
- Accept Iconify single-icon JSON (`body`, `width`, `height`, optional `viewBox`), Iconify collection JSON (`prefix`, shared dimensions, and `icons`), JSON containing a complete SVG string, and raw complete SVG markup.
- When a collection is pasted, list its icons by stable `prefix:name`, allow selection without reparsing the whole collection, and show a live SVG preview with name, source format, and resolved viewBox.
- Put feedback beside the preview. During lookup, identify the requested icon; after success, say what action is now available; after failure, explain exactly how to recover (for example, copy the complete SVG). Do not respond to a recognizable icon name with a generic “invalid JSON” error.
- Preserve the target node's stable ID, CSS sizing, currentColor inheritance, layout constraints, and source mapping. Replace only the safe SVG body and viewBox.
- Sanitize untrusted SVG before preview or application. Remove scripts, foreign objects, external images/resources, inline event handlers, JavaScript URLs, and non-local `href` or paint URLs. Keep a narrow allowlist of SVG geometry, grouping, gradients, masks, and presentation attributes.
- Store replacements as structured, versioned document data keyed by atomic layer ID. Include them in undo/redo, draft persistence, JSON export, and generated source/standalone HTML export.
- Capture the source icon before applying replacements and expose an explicit restore-original action. Undo must restore the exact original body and viewBox.
- Clipboard access is a convenience only. Always support normal Ctrl/Cmd+V and show a useful fallback when the browser denies programmatic clipboard reads.

## Comparison and diagnostics

- Keep the reference image outside the production DOM.
- Offer side-by-side, adjustable overlay, blink comparison, and diff heatmap modes.
- Match reference and render at identical dimensions before pixel diagnostics.
- Maintain a mismatch queue grouped by geometry, typography, assets/content, color/effects, and responsive/state behavior.
- Let the user click a mismatch to select the responsible layer.
- Mark inferred values and expose confidence; prioritize low-confidence, high-impact items for the human 5% pass.

## Persistence and source export

Use a versioned document described in [ui-document-schema.md](ui-document-schema.md), but ensure SKILL.md links that file directly before use.

Enter this mode through `finalize_ui_to_studio.py`, not by copying the editor shell alone. The finalizer must bind the current source-generation marker to the real production DOM, UI Document V4, source map, clean sync state, and non-empty stable identity registry in `.ui-job/studio-installation.json`. If that receipt is missing or stale, show the project as not imported and block save/apply claims.

Choose the strongest safe write path the project supports:

1. A constrained development endpoint/plugin that writes only declared UI document, token, and generated-source targets.
2. A source patch or downloadable source archive that Codex applies and verifies.
3. Browser local storage only as draft/autosave, never as final export.

Do not use `eval`, accept arbitrary filesystem paths, or expose unrestricted writes.

The export must:

- Produce normal HTML/CSS/JavaScript or framework components.
- Exclude tool rails, rulers, handles, guides, overlays, reference images, and debug IDs where possible.
- Preserve component reuse, tokens, responsive rules, accessibility, and interactive states.
- Format the files and pass the project's build/typecheck/test/lint commands.
- Reopen from exported source and reproduce the saved edit without reading editor local storage.

## Verification

Test at least:

1. Select nested layers from canvas and tree.
2. Multi-select, align, distribute, and equalize spacing.
3. Resize with and without aspect lock; nudge and bypass snapping.
4. Edit flow/flex/grid properties without breaking responsiveness.
5. Edit a component instance and a token; verify propagation and override behavior.
6. Add a breakpoint override and preview at adjacent widths.
7. Undo/redo after inspector edits, element moves, and all eight resize handles. Commit drag history on pointer-up, pointer-capture loss, and a short idle fallback; verify Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z.
8. Use overlay and diff modes to resolve a mismatch.
9. Export source, open the clean production route, and verify the edit survives with local storage cleared.
10. Confirm the editor is absent from the production bundle.
11. At multiple zoom levels, confirm rulers stay readable, tick positions scale, automatic canvas modes survive panel collapse, and empty-workspace click clears the layer tree, selection overlay, and inspector.
12. At fit, 100%, and a zoom above 120%, drag the black workspace in all four directions, pan from inside the frame with Space and with the middle button, verify normal wheel pans, Shift-wheel pans horizontally, and Alt+wheel zooms without moving the cursor anchor. Hold Alt while middle-button dragging and confirm the page stops exactly on release without flying away. Confirm Ctrl/Cmd+wheel remains browser-native. Interrupt a locate-selection transition with a new drag, reload a manual camera position, and verify that production DOM coordinates, saved revisions, selection alignment, rulers, guides, and undo history are unchanged. The transient camera HUD must disappear after manipulation. Double-clicking empty workspace, Ctrl/Cmd+0, and the top return button must produce the same centered result. Rulers must remain fixed to the viewport while their tick positions follow camera scroll and zoom; drag one guide from each ruler and verify persisted document coordinates.
12. Select one element at 35%, zoom to 83% or higher, scroll both axes, and assert that every overlay edge differs from the transformed DOM edge by less than one device-independent pixel. Drag each edge handle and verify the production DOM and overlay change together before pointer-up; undo must restore both. Repeat above 120% zoom with the opposite handle outside the viewport: drag a visible point on the full north/south/east/west border, verify the intended dimension changes, the opposite rendered edge stays anchored within one pixel, and Ctrl/Cmd+Z restores the entire gesture in one step. Hold the pointer inside every canvas-edge activation zone long enough to trigger auto-pan; verify camera travel, pointer/object continuity, clean release, persisted camera position, and that undo restores only the object geometry.
12. Switch between Icon, Text, and Frame workspaces; verify search, hover-to-reveal, per-feature selected object, scroll restoration, and the developer-info toggle.
13. For text, icon, control, and frame selections, verify the inspector opens only the relevant primary sections, hides inapplicable fields, shows a human breadcrumb, locates the selected object, and keeps Source details collapsed.
14. Select a canvas layer, keep focus inside the iframe, and verify Delete/Backspace hides it in one undoable command; Ctrl/Cmd+Z restores it and Ctrl/Cmd+Shift+Z or Ctrl+Y reapplies it. Verify copy/cut/paste and appearance-only paste use stable target IDs and multi-target count rules. Use Ctrl/Cmd+J to duplicate a nested layer, confirm every descendant receives a new stable ID, then verify undo/redo, project save/reload, generated preview source, and clean export all preserve or remove the same subtree. Verify F2 rename changes only editor metadata, and visibility/lock shortcuts remain undoable. Repeat inside text inputs and contenteditable nodes to confirm native typing, selection, clipboard, and undo are never intercepted.

Capture the clean UI only as verification evidence. Deliver source files first.
