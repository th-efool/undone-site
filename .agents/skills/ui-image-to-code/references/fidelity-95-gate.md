# 95/5 fidelity gate

Use this gate when the user asks Codex to complete roughly 95% and leave a small manual adjustment pass.

## Meaning of 95%

Treat 95% as a weighted completion score for supplied screens, states, and nearby responsive widths. It is not a promise that a raster screenshot reveals hidden behavior, proprietary fonts, original assets, or unshown breakpoints.

Do not report 95% unless the total is at least 95/100 and no critical cap applies.

## Weighted score

| Area | Points | Full-credit evidence |
| --- | ---: | --- |
| Major geometry and layout | 25 | Frames, regions, proportions, alignment, spacing, and scroll behavior match at target viewports. |
| Typography | 15 | Font/fallback, size, weight, line height, wrapping, truncation, and baselines match. |
| Content and assets | 10 | All legible text, icons, imagery roles, and repeated data are present. |
| Color and effects | 10 | Surfaces, fills, borders, radii, shadows, opacity, and states match. |
| Responsive behavior | 15 | Target and adjacent widths work without overflow; evidence-based reflow and breakpoint overrides are verified. |
| Interactions and states | 10 | Visible controls and required hover/focus/selected/loading/empty/error states work. |
| Code quality and accessibility | 10 | Source is componentized, semantic, keyboard-usable, buildable, and uses project conventions. |
| Editable handoff | 5 | Professional Studio opens, identifies layers, and exports source that survives outside the editor. |

## Critical caps

Cap the score at 94 when any condition holds:

- The reference image or large screenshot slices are used as the page implementation.
- A major visible region, supplied screen, or required state is missing.
- Production build, target route, or primary interaction is broken.
- The target viewport was not rendered and compared.
- Studio edits exist only in browser local storage or a screenshot and cannot reach source.
- Exported code requires editor chrome or the reference image to render.
- Severe overflow, clipping, inaccessible controls, or console errors remain.

## Convergence loop

1. Capture the implementation at every supplied viewport.
2. Open Studio **Compare**, load the reference and the clean browser-render screenshot at exactly matching dimensions, then run the bundled visual comparison. The workspace provides overlay, side-by-side, heatmap, blink, and a ranked mismatch queue. For headless/report-only workflows, `scripts/score_visual_fidelity.py` remains available.
3. Inspect overlay/heatmap and record the five largest mismatches.
4. Fix in order: frame geometry, typography/wrapping, component geometry, assets/content, color/effects.
5. Re-run build checks, responsive checks, and screenshot comparison.
6. Update the weighted score with evidence.
7. Continue until at least 95, a critical source is missing, or three passes produce no meaningful improvement.

The script score is diagnostic. Antialiasing, font rasterization, OS rendering, dynamic content, and screenshots with browser/OS chrome can distort pixel metrics.

The Studio gate keeps these concepts separate:

- Pixel similarity, edge similarity, changed-pixel ratio, and mean color error are diagnostic evidence only.
- The visual comparison may suggest the first four visual categories, but a user or validating agent must still confirm them.
- Responsive behavior, interaction states, code quality, and editability require their own evidence and remain unrated until checked.
- The final gate is unavailable until all eight weighted categories are rated.
- Any selected critical failure caps a complete score at 94, even when the numeric inputs would otherwise exceed 95.
- **Engine self-test (same image)** must return 100% pixel and edge similarity, but must remain labeled as self-test and must never count as proof that the implementation matches the reference.

## Human 5% queue

Hand off a short, actionable queue rather than “minor differences remain.” Each item must include:

- Viewport and state.
- Layer/component ID.
- Property to adjust.
- Current and target estimate.
- Confidence and reason automation stopped.

Prefer five high-impact items or fewer. Do not offload known build errors, missing major sections, or broken interactions as manual polish.

## Completion evidence

Provide source/archive links first, then:

- Run command and route.
- Build/typecheck/test/lint results.
- Target viewport captures and diagnostic score.
- Weighted score table.
- Studio export/reopen verification.
- Human 5% queue, or `none`.
