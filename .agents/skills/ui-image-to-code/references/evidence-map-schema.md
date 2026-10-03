# Position evidence map

Use this schema before generating UI source. Coordinates are measured in original screenshot pixels.

```json
{
  "schemaVersion": 1,
  "status": "ready",
  "reference": {
    "id": "desktop-main",
    "name": "reference.png",
    "path": "artifacts/ui-evidence/references/desktop-main.png",
    "width": 1920,
    "height": 919,
    "viewport": { "width": 1920, "height": 919, "status": "observed" }
  },
  "nodes": [
    {
      "id": "page.root",
      "name": "Page",
      "type": "page",
      "parentId": null,
      "bounds": { "x": 0, "y": 0, "width": 1920, "height": 919 },
      "layout": { "mode": "grid", "role": "page-shell" },
      "anchors": ["viewport.left", "viewport.top", "viewport.right", "viewport.bottom"],
      "confidence": { "level": "observed", "score": 1, "sources": ["screenshot"] }
    },
    {
      "id": "sidebar.nav.home.icon",
      "name": "Home icon",
      "type": "icon",
      "parentId": "sidebar.nav.home",
      "bounds": { "x": 28, "y": 112, "width": 16, "height": 16 },
      "layout": { "mode": "flow", "role": "menu-icon" },
      "anchors": ["sidebar.content-left", "sidebar.nav.home.center-y"],
      "confidence": { "level": "strong-inference", "score": 0.9, "sources": ["screenshot", "alignment"] }
    }
  ],
  "tokens": {
    "colors": {},
    "spacing": {},
    "radii": {},
    "typography": {}
  },
  "unresolved": []
}
```

## Requirements

- `schemaVersion` is `1`.
- `status` is `draft` during mapping and must become `ready` before source generation.
- `reference.path` is a project-relative persisted copy, never the user's temporary clipboard path.
- Reference width and height are positive integers.
- Node IDs are unique, stable, and use semantic dot notation.
- For URL jobs, an interactive visual node may include `interactionActionId: "action.*"` to bind geometry to the separately compiled interaction spec. Do not duplicate or reinterpret the destination inside the geometry map.
- Include exactly one or more `page` roots; every non-root `parentId` must resolve.
- Bounds are finite, positive, and remain within the reference dimensions.
- Allowed node types: `page`, `frame`, `section`, `menu`, `text`, `icon`, `image`, `control`, `divider`, `unknown`.
- Allowed confidence levels: `observed`, `strong-inference`, `assumption`.
- Scores range from `0` to `1` and list at least one evidence source.
- Split a visible menu row into a menu/container plus atomic icon, label, badge, and chevron nodes when present.
- Split title/subtitle pairs and stacked text into atomic text nodes.
- Store recognized text as `content.text`. Store icon or image identity in `asset.name`, `asset.libraryId`, `asset.path`, `asset.svg`, `asset.src`, or `asset.referenceCrop` as appropriate.
- Express major alignment using anchors instead of relying only on isolated coordinates.
- Put unresolved or ambiguous decisions in `unresolved`; never silently convert them into observed facts.

Run:

```text
python <skill>/scripts/prepare_ui_job.py <screenshot> <target-project> --viewport 1920x919
python <skill>/scripts/validate_evidence_map.py <map> --allow-draft
python <skill>/scripts/validate_evidence_map.py artifacts/ui-evidence/<reference-id>.json
python <skill>/scripts/compile_ui_spec.py artifacts/ui-evidence/<reference-id>.json
```

The first command preserves the screenshot and creates a draft containing only the page root. Fill the major and atomic nodes, remove blocking unresolved items, and change `status` to `ready`. Validation opens the compile gate. Compilation writes the deterministic `artifacts/ui-spec/<reference-id>.json` contract that Codex must read before generating source.
