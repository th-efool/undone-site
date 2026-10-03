# Versioned UI document

Use one structured document as the bridge between screenshot analysis, the professional editor, and generated source. Adapt field names to the host project, but preserve the semantics.

```json
{
  "version": 4,
  "documentId": "product-page",
  "source": {
    "references": [{ "id": "desktop", "name": "desktop.png", "path": "/.ui-studio/references/desktop.png", "width": 1440, "height": 1024 }]
  },
  "tokens": {
    "color": { "surface.default": "#ffffff", "text.primary": "#111827" },
    "space": { "2": 8, "3": 12, "4": 16 },
    "radius": { "md": 8 },
    "type": {}
  },
  "components": {
    "card": {
      "mainNodeId": "component.card",
      "variants": { "size": ["sm", "md"], "state": ["default", "hover"] },
      "slots": ["media", "content"]
    }
  },
  "assets": {
    "icons": {
      "sidebar.nav.home.icon": {
        "name": "mdi:home",
        "format": "Iconify JSON",
        "viewBox": "0 0 24 24",
        "body": "<path fill=\"currentColor\" d=\"...\"/>"
      }
    }
  },
  "breakpoints": {
    "desktop": { "minWidth": 1200 },
    "tablet": { "minWidth": 768, "maxWidth": 1199 },
    "mobile": { "maxWidth": 767 }
  },
  "nodes": [
    {
      "id": "hero.title",
      "name": "Hero title",
      "type": "text",
      "parentId": "hero",
      "layout": {
        "mode": "flow",
        "sizing": { "width": "fill", "height": "hug" },
        "constraints": { "horizontal": "stretch", "vertical": "top" }
      },
      "style": { "color": "{color.text.primary}" },
      "content": { "text": "Example" },
      "component": null,
      "overrides": { "mobile": {} },
      "evidence": { "confidence": "observed", "referenceId": "desktop" }
    }
  ],
  "evidence": {
    "activeRunId": "run-desktop",
    "runs": [{ "id": "run-desktop", "referenceId": "desktop", "candidateCount": 1, "acceptedCount": 1 }],
    "items": { "hero.title": { "referenceId": "desktop", "runId": "run-desktop", "confidence": 0.94, "source": "pixel-structure" } }
  },
  "manualQueue": [],
  "operations": [],
  "overrides": {},
  "iconReplacements": {},
  "structuralEdits": {
    "insertions": [{
      "id": "component.card.copy1",
      "sourceId": "component.card",
      "parentId": "content",
      "afterId": "component.card",
      "idMap": {
        "component.card": "component.card.copy1",
        "component.card.title": "component.card.title.copy1"
      },
      "name": "Card copy"
    }]
  },
  "layerMetadata": {
    "component.card.copy1": { "name": "Featured card" }
  }
}
```

## Requirements

- Keep stable IDs across analysis, editor sessions, generated components, screenshots, and mismatch reports.
- Store hierarchy explicitly. Do not infer parents from coordinate overlap after every edit.
- Represent layout as flow/flex/grid/free with fixed/hug/fill/min/max semantics.
- Store breakpoint overrides separately from base values.
- Bind reusable values to tokens while preserving a raw fallback.
- Distinguish component main definitions, instances, variants, slots, and instance overrides.
- Store sanitized icon replacements by stable atomic SVG layer ID. Preserve source name, format, viewBox, and safe SVG body; never store executable SVG content or remote resource URLs.
- Attach observed/strong-inference/assumption confidence to important generated decisions.
- Version migrations; reject unknown future versions rather than corrupting data.
- Store reference images only under a constrained same-origin evidence directory; never accept a browser-supplied arbitrary path.
- Record every recognition batch in `evidence.runs`, and keep node evidence keyed by stable node ID.
- Append semantic operations such as `analysis.confirm`, `property.change`, and `replace.asset`; do not use raw JSON diffs as the only handoff.
- Persist true duplicates as constrained structural insertions with a unique root ID, explicit source/parent/order anchors, and a complete descendant ID map. Replay them before application code binds interactions, include them in undo/redo and clean export, and reject duplicate or unsafe IDs.
- Store stacking overrides as validated numeric `zIndex` plus an allowed CSS `position` value (`static`, `relative`, `absolute`, `fixed`, or `sticky`). Alt-drag duplication must persist its structural insertion and geometry in one semantic history entry so undo never leaves a stray clone behind.
- Keep editor-only semantic layer names in `layerMetadata`; renaming a layer must not silently rewrite visible text content or change its stable ID.

## Source mapping

Maintain a narrow mapping from node/component IDs to production files and symbols. Never store arbitrary filesystem paths supplied by the browser.

Example:

```json
{
  "hero.title": { "file": "src/features/home/Hero.tsx", "symbol": "HeroTitle" },
  "component.card": { "file": "src/components/Card.tsx", "symbol": "Card" }
}
```

Use the mapping to generate constrained patches. If a safe round trip is not possible, export the document plus a patch for Codex to inspect and apply.

## Production boundary

Production code may consume tokens or an intentional UI configuration file, but it must not require editor history, rulers, selection data, reference images, confidence annotations, or diff artifacts.
