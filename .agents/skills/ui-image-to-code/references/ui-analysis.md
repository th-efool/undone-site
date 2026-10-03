# UI analysis evidence map

Create this map in working notes before implementation. Keep facts and assumptions separate.

## 1. Source inventory

For every image, record:

- Filename or image identifier.
- Pixel dimensions and probable viewport.
- Page, route, modal, breakpoint, or interaction state represented.
- Cropping, browser chrome, device frame, compression, or scaling that could distort measurements.

## 2. Page frame

Identify:

- Canvas/background color or imagery.
- Header, sidebar, main content, footer, overlays, and sticky/fixed regions.
- Container width, outer gutters, columns, gaps, alignment anchors, and vertical rhythm.
- Scroll direction and content likely above or below the crop.

Use relative relationships before guessing exact pixels: equal columns, aligned baselines, repeated gaps, centered max-width container, edge-to-edge band, fixed rail.

## 3. Typography

Record visible hierarchy:

- Font family or closest locally available fallback.
- Display, heading, body, label, caption, and numeric styles.
- Approximate size, weight, line height, letter spacing, color, casing, and alignment.
- Line breaks that materially affect layout.

Do not assert a specific font solely from visual resemblance. Search supplied assets and the repository first.

## 4. Tokens

Extract the smallest coherent set:

- Background, surface, text, muted text, border, primary, accent, success, warning, and error colors.
- Spacing steps seen repeatedly.
- Corner radii, border widths, shadows, and opacity levels.
- Control heights, icon sizes, and common content widths.

Prefer shared tokens over a long list of one-off values.

## 5. Components and content

Inventory repeated or interactive elements:

- Navigation, tabs, breadcrumbs, buttons, fields, filters, cards, tables, lists, badges, dialogs, drawers, toasts, pagination, media, and charts.
- Repeated component variants and selected/active states.
- Exact legible copy, numbers, labels, icons, and image roles.
- Likely component boundaries based on repetition and behavior, not arbitrary rectangles.

## 6. Assets

Classify each visual as:

- Supplied original asset.
- Existing repository asset.
- CSS-renderable shape or effect.
- Standard icon available in the project's icon set.
- Missing illustrative/photo asset requiring a clearly disclosed substitute.

Never use the complete reference image as the implemented page. Avoid screenshot slicing except for a genuinely indivisible media asset and disclose that choice.

## 7. Responsive and state evidence

When multiple references exist, match persistent elements across them and record what resizes, reflows, wraps, collapses, hides, or changes state. When only one exists, label responsive behavior as inferred.

For interactions, record only observable states. Infer conventional behavior when necessary, but do not invent a large workflow from a single static screen.

## 8. Confidence labels

Mark critical decisions:

- `observed`: directly visible or present in repository assets/code.
- `strong inference`: supported by repeated alignment, known component behavior, or another supplied screen.
- `assumption`: plausible but not evidenced.

Surface assumptions in the final handoff only when they affect how the interface works or looks.
