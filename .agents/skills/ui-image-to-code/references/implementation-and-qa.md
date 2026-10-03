# Implementation and visual QA

## Framework selection

Prefer extending the current project. When starting from nothing, minimize setup risk:

- Use React + TypeScript when a local Node toolchain and dependency installation are available.
- Use the user's requested component library only when it is already installed or explicitly requested.
- Use plain CSS, CSS modules, or the existing styling system. Do not add Tailwind solely to recreate one page.
- Fall back to standalone HTML/CSS/JavaScript when a zero-install deliverable is more reliable.

For a projectless Studio scaffold, the bundled dependency-free starter is only a verified host page. Replace its example content with the reconstructed UI, but keep local `index.html`, `styles.css`, `app.js`, and stable `data-ui-id` nodes unless the target framework provides equivalent same-origin entry points.

Do not replace routing, state management, build tooling, or design tokens merely for convenience.

## Layout translation

- Translate major regions into grid or flex layout.
- Use `max-width`, intrinsic sizing, `minmax()`, `clamp()`, and wrapping where the evidence suggests fluid behavior.
- Use absolute positioning only inside bounded components for overlays, badges, floating art, or intentionally layered elements.
- Preserve content order and DOM semantics even when CSS changes the visual arrangement.
- Centralize repeated measurements and colors as tokens.

## Interaction completion

Implement enough behavior for the visible UI to be usable:

- Navigation and tabs update the selected view or route.
- Forms support labels, keyboard focus, validation feedback, and submission behavior appropriate to the task.
- Menus, modals, drawers, and accordions open, close, and return focus sensibly.
- Data-heavy mockups use structured sample data rather than duplicated markup.

If the reference shows only a static state and backend behavior is out of scope, implement a deterministic local interaction and disclose the boundary.

## Visual comparison loop

1. Render at exactly the reference viewport when known. Match device scale only if the capture tooling supports it reliably.
2. Compare the page frame first: canvas, outer gutters, container width, header/sidebar size, columns, and section heights.
3. Compare typographic metrics: font loading, sizes, weights, line heights, wrapping, and baselines.
4. Compare component geometry: control heights, internal padding, gaps, radii, borders, and alignment.
5. Compare color, shadows, icons, images, and decoration.
6. Check interactive states and keyboard navigation.
7. Capture again after corrections.

Use side-by-side inspection for semantic differences. Use an overlay or pixel-difference image when the reference and output are the same dimensions. A numeric image-difference score is diagnostic, not proof of quality; antialiasing and font rendering can change it.

## Required verification

Run the checks already defined by the repository, prioritizing:

1. Production build or compile.
2. Typecheck.
3. Relevant automated tests.
4. Lint.
5. Browser render with no new console errors.
6. Screenshot capture at each in-scope viewport.

Do not install unrelated dependencies to improve a score. If a check cannot run, report the command and the blocking reason.

## Completion rubric

A result is ready when:

- It starts with a documented command and the target route renders.
- Major geometry and typography match the evidence without using the reference as a page-sized image.
- Repeated structures are maintainable components.
- Relevant controls work with pointer and keyboard.
- Nearby widths do not overflow or collapse unexpectedly.
- Build and applicable checks pass.
- At least one reference-versus-render correction pass is complete.
- Remaining differences and assumptions are explicit.

Do not label the result production-ready if it still contains broken controls, clipped content, missing critical assets, build errors, or unverified visual claims.
