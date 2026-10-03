# Screenshot-to-UI orchestration

## Contents

1. Roles and ownership
2. Required artifacts
3. Companion-skill routing
4. Execution gates
5. Human adjustment loop
6. Completion evidence

## Roles and ownership

`ui-image-to-code` owns the job from URL or image intake through verified source and Studio handoff. Other skills are bounded specialists, not competing coordinators. For a URL intake, Codex owns the exploration plan; the browser is the primary actuator, screenshot surface, and action observer. QingLu video is an optional motion and destination-evidence supplement.

On every resumed task, run `python <skill>/scripts/ui_job_status.py <target-project>` before choosing work. Continue from the reported stage instead of repeating intake.

- **Evidence analyst:** measures the screenshot, separates facts from inference, and writes the position map.
- **Spec compiler:** converts validated evidence into a deterministic tree, geometry, layout, responsive, and quality contract.
- **UI builder:** converts the compiled spec into semantic responsive source with stable IDs.
- **Design specialist:** improves composition, hierarchy, assets, or micro-interactions without changing observed facts.
- **Parity reviewer:** compares reference and clean browser output at identical dimensions.
- **Studio:** lets the user correct the remaining small position, size, proportion, text, icon, and spacing differences directly.

## Required artifacts

Create these in the target project as applicable:

```text
artifacts/ui-capture/<run-id>/capture-manifest.json
artifacts/ui-capture/<run-id>/screenshots/
artifacts/ui-capture/<run-id>/recordings/
artifacts/ui-capture/<run-id>/actions/
artifacts/ui-capture/<run-id>/motion/
artifacts/ui-capture/<run-id>/reports/
artifacts/ui-evidence/<reference-id>.json
artifacts/ui-spec/<reference-id>.json
artifacts/ui-spec/<run-id>.interaction.json
.ui-studio/ui-document.json
.ui-studio/operations.jsonl
.ui-job/studio-installation.json
<production source files>
artifacts/ui-parity/<viewport>/reference.png
artifacts/ui-parity/<viewport>/render.png
```

The evidence map is the measured pre-code geometry contract. The compiled UI spec is the deterministic visual source-generation contract. The compiled interaction spec binds stable triggers to observed destinations and optional evidenced motion. The UI document is the editable handoff. Production source remains the shipping truth.

For a website URL, initialize the capture run first:

```text
python <skill>/scripts/prepare_website_capture.py <url> <target-project>
```

Follow [codex-website-capture.md](codex-website-capture.md), let Codex safely traverse visible UI states, then require passing `validate_website_capture.py` and `compile_interaction_spec.py` results. Record an action edge for every relevant button-to-menu, route, workspace, dialog, toggle, download, or external destination. Each approved settled state becomes a screenshot evidence job. A video without a state graph, action edges, viewport provenance, and coverage report is not generation-ready evidence.

Initialize every screenshot job with:

```text
python <skill>/scripts/prepare_ui_job.py <screenshot> <target-project> --viewport <width>x<height>
```

This persists temporary clipboard images inside the project and creates a `draft` evidence map. Do not generate source while it remains draft.

## Companion-skill routing

Use a companion only when it is available and its trigger matches the task.

| Companion skill | Use it for | Do not let it do |
| --- | --- | --- |
| `qinglu-ui-parity` | Authorized screenshots, recordings, interaction evidence, parity traceability | Invent unobserved states or replace source with image slices |
| `frontend-skill` | Strong composition, design-system hierarchy, responsive frontend implementation | Redesign a strict replica before geometry parity is established |
| `emil-design-eng` | Press feedback, transitions, drawers, tooltips, drag feel, reduced-motion polish | Add decorative motion to frequent editor commands or alter layout evidence |
| `imagegen` | Missing raster illustrations, photos, textures, and bitmap assets | Generate code, UI structure, icons that should remain SVG, or screenshot-backed pages |
| Product/domain skills | Domain-specific workflows or content explicitly in scope | Override the evidence map or host-project conventions |

If a companion is unavailable, continue with the core workflow. Never block accurate source generation solely because an optional polish skill is missing.

## Execution gates

### Gate A — evidence ready

Require:

- For URL intake, a valid capture manifest with at least one approved settled state and an explicit recorder status. Optional video must not block static capture.
- Each relevant safe action has a trigger, destination, evidence level, source evidence, and matching from/to state.
- Menu, workspace, dialog, and route destinations have stable `menu.*`, `workspace.*`, `dialog.*`, and `route.*` identities.
- A passing `compile_interaction_spec.py` result for URL intake.
- Source dimensions and intended viewport.
- A page/root region.
- Major regions with source-space bounds.
- Explicit parent relationships.
- Separate text, icon, control, and container candidates.
- Confidence and evidence sources.
- A passing `validate_evidence_map.py` result.
- Evidence-map status `ready`, with at least one mapped non-page node.

### Gate B — generation spec ready

Require:

- A passing `compile_ui_spec.py` result.
- A parent tree and deterministic generation order.
- Pixel and normalized bounds for every mapped node.
- Layout and responsive hints explicitly labelled as compiled guidance.
- Missing text, icon, image, unknown-type, and assumption warnings surfaced for review.

### Gate C — first source ready

Require:

- Real source code, not a flattened screenshot.
- Stable `data-ui-id` mapping for editable visible objects.
- Major geometry consistent with the evidence map.
- Responsive behavior that preserves the observed viewport.
- A runnable route.

### Gate D — browser correction ready

Require:

- Reference and render captured at matching dimensions.
- At least one correction pass.
- Geometry reviewed before typography and decoration.
- No new browser console errors.

### Gate E — Studio handoff ready

Require:

- `finalize_ui_to_studio.py` passed against the current source-generation marker.
- `.ui-job/studio-installation.json` proves that the real generated source was preserved and imported through the live production DOM.
- UI Document V4, source map, clean sync state, handoff state, and a non-empty unique identity registry exist in project files.
- Every generated stable identity is present in the Studio registry; an editor template, starter page, screenshot layer, or empty document is a failure.
- Real DOM selection and layer correspondence.
- Drag, resize, numeric edit, undo/redo, save, and clean preview.
- Small edits stored as semantic operations, not chat instructions.
- Export or apply path that survives clearing browser local storage.

## Human adjustment loop

1. Codex generates and validates the first runnable UI.
2. Codex runs `python <skill>/scripts/finalize_ui_to_studio.py <target-project>` and opens Studio with the actual generated production UI, not a template or screenshot.
3. The user drags, resizes, changes proportions, text, fonts, icons, or spacing.
4. Studio saves one revision with named operations such as `geometry.move`, `geometry.resize`, `content.change`, or `replace.asset`.
5. Preview and source export consume the saved revision immediately where supported.
6. On a later Codex turn, Codex reads pending project state before editing. The user does not need to explain the changes again.

Do not promise that a browser edit wakes Codex automatically. It becomes automatically discoverable on the next Codex turn because it is stored in project files.

## Completion evidence

Report the evidence-map path, compiled UI-spec path, generated source entry point, run command, Studio URL, checks, reference viewport, browser captures, and any unresolved high-impact assumptions. Never call the task complete when only the screenshot, evidence map, compiled spec, or editor draft exists.
