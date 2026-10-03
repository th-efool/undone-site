# Latest-project menu scan and Studio drilldown

This protocol is mandatory for every authorized, source-aware Studio job. The user does not need to ask for it.

## Outcome

Before Studio opens an editable layer tree, Codex must discover the current project's real menu and state graph, persist it, replay each safe entry, and bind each entry to the production UI root that Studio will edit.

The left Structure pane is one persistent recursive project tree:

1. Show the latest real project menus as the stable top-level structure.
2. Single-click a menu row to execute its real action and switch the center production UI only.
3. Double-click the row, or click its dedicated layer-count/disclosure target, to expand or collapse that menu's real layers inline.
4. Apply the same contract recursively to nested menus, tabs, tools, dialogs, and other state destinations.
5. Keep the menu row visible while its layers are expanded; never replace the directory with a second layer page and never require a Back mode.

Never place a competing menu picker beside a raw layer tree, and never mix route activation with layer drilldown in one ambiguous click target.

## Authorized source-aware scan

Codex must inspect the latest working tree and the live loopback application, not chat memory or a previous Studio draft. Scan:

- framework route declarations and route modules;
- visible `nav`, `aside`, toolbar, tab, and workspace-entry controls;
- `href`, router targets, `data-view-target`, `data-ui-action`, and actual click handlers;
- localized visible labels and active/current state markers;
- the settled production root for every safe destination;
- state-only destinations such as dialogs, drawers, tabs, and tool workspaces.

Start the current production application on a loopback URL and run:

```bash
python scripts/scan_project_menu.py <target-project> --url http://127.0.0.1:<port>/
```

The scanner uses an isolated Playwright browser, performs only safe visible navigation actions, reads localized visible labels, resolves stable project identities, and measures real production DOM counts. Codex must not hand-author or repair `.ui-job/project-menu.json`; the scanner writes it atomically and preserves the last valid manifest if a later scan fails. The bundled Codex runtime is used when available. Standalone users may install Playwright in the target project or set `UI_SCAN_PLAYWRIGHT` to its `index.mjs`.

Every entry needs a stable ID, localized visible label and language, recursive parent, source order, exactly-one current page, trigger, destination, binding state, page/state root, evidence source, and current source hashes. Re-scan when route/menu source hashes change, when the live application exposes a new menu identity, or after Codex changes routing. `ui_job_status.py` must return `scan-project-menu` before Studio finalization whenever the manifest is missing, invalid, or stale.

The manifest must also persist this exact top-level Studio tree contract so later Codex tasks cannot silently regress to a separate page picker or ambiguous click behavior:

```json
{
  "studioTree": {
    "mode": "persistent-inline",
    "activation": "single-click-switch-ui-only",
    "drilldown": "double-click-or-disclosure",
    "selection": "independent",
    "camera": "preserve",
    "counts": "live-truth",
    "labels": "visible-ui-language",
    "currentPage": "exactly-one"
  }
}
```

Do not mark the scan ready when this contract is absent or differs. Only a page destination may own the current-page marker; action/state rows may show executed, loading, or expanded state but must never become a second current page.

Every bound page also needs a truth-sourced layer count. Count the page root plus its current production descendants carrying stable UI identities. The active page count must refresh from a `MutationObserver` after insert, remove, route, undo, redo, and source-refresh events. Pre-measure inactive pages in an isolated same-origin browser/iframe so scanning never changes the user's canvas camera, selection, history, or active production page. Cache counts by project source identity plus menu identity, invalidate them when the preview source or route hash changes, and replace the cache on the next successful measurement. Never display a fabricated count or leave a bound page permanently at “pending recognition.” State/action entries whose content only exists after interaction must be labeled dynamic until executed, then expose the current settled-state layer count.

Prefer a project-owned persistent route manifest such as `[data-ui-project-menu]` when menus disappear between routes. It may be visually hidden, but its controls must execute the same real application actions as visible menus. Do not invent unavailable screens.

## Source-blind exception

In Mode A or `blind-visual`, never inspect hidden source, route declarations, DOM, or project files. Build the menu graph only from supplied screenshots and explicitly performed visible interactions. Mark unobserved destinations unknown. This exception protects the validity of blind reconstruction tests.

## Studio activation contract

- Single click executes the real bound menu action and switches the center UI; it never expands layers or selects an atomic layer.
- Double-clicking the menu body, or clicking the dedicated live-count/disclosure target, expands or collapses that menu's real layers inline without changing the canvas camera.
- Menu activation, menu expansion, and atomic layer selection are independent state machines. Expanding a menu may activate it when necessary, but selecting or switching it must not force expansion.
- Nested menu entries follow the same recursive interaction contract and remain visible as stable spatial anchors.
- Page destinations expose a stable page root such as `[data-view][data-ui-id]` and a current-view marker.
- Action/state destinations wait for a stable UI and then rebuild layers from the changed production DOM.
- Camera zoom, pan, rulers, and guides do not move during menu-to-layer drilldown.
- Selection, collapsed nodes, and tree scroll are restored per menu identity.
- Loading, unbound, missing, and failed destinations are explicit and recoverable.
- There is no separate directory/layer page and no Back-to-menu control. Collapsing an inline branch never resets the production page.
- Page rows show a measured live count, `scanning`, `dynamic`, `unbound`, or `scan failed`; `pending recognition` is not an acceptable terminal state.
- Background traversal uses an isolated renderer and must not move the editable canvas or produce an undo/source revision.

Validate the saved manifest with `python scripts/validate_project_menu.py <target-project>` before Studio finalization and delivery. Run `python scripts/project_menu_scan_smoke.py` and `python scripts/project_menu_contract_smoke.py` when changing this protocol.
