# UI generation spec

The UI generation spec is the deterministic bridge between screenshot measurement and source code. Generate it from a validated `ready` evidence map:

```text
python <skill>/scripts/compile_ui_spec.py artifacts/ui-evidence/<reference-id>.json
```

Default output:

```text
artifacts/ui-spec/<reference-id>.json
```

## What it contains

- The persisted reference and observed viewport.
- Stable source IDs and required `data-ui-id` values.
- Parent/child relationships and deterministic generation order.
- Original pixel bounds and normalized source-space bounds.
- Geometry-inferred row, column, grid, or free-layout hints.
- Responsive edge and center hints relative to the parent.
- Existing content, asset, style, and interaction evidence when supplied.
- Missing text, icon, image, unknown-type, and assumption warnings.
- A production-source contract that forbids screenshot flattening and full-page absolute tracing.

## Fact versus implementation guidance

`boundsPx`, reference dimensions, node types, confidence, and evidence sources remain screenshot facts or explicitly labelled assumptions from the evidence map.

`layoutHint`, `responsive`, and `generationOrder` are compiled implementation guidance. Use them to choose Flexbox, Grid, intrinsic sizing, constraints, and component boundaries. They do not authorize inventing unobserved screens, copy, assets, states, or interactions.

## Source-generation rules

1. Read this spec before writing page components.
2. Generate real semantic DOM and reusable components.
3. Emit the exact `dataUiId` value as `data-ui-id` for every mapped visible node.
4. Match `boundsPx` at the observed viewport before applying stylistic polish.
5. Keep text, icon, control, and container nodes independently editable.
6. Resolve warning items with project assets, OCR review, or an explicit assumption.
7. Use absolute positioning only for genuine overlays and anchored decoration.
8. Verify the browser render at identical dimensions and then hand remaining small differences to Studio.

The compiler is deterministic and may be rerun after evidence correction. Do not hand-edit generated layout hints when the underlying measurement is wrong; correct the evidence map and compile again.
