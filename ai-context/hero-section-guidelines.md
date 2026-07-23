# Hero Section Guidelines

Use this as the pattern for generating new landing-page sections from `src/client/components/screens/landing/01-hero`.

## Component composition

The hero is composed by `Hero.tsx` as one section wrapper plus five focused child components:

1. `Hero.tsx`
   - Imports the shared `Section` layout component.
   - Passes `hero` and `background="transparent"` so the section can own a full-bleed visual treatment.
   - Applies `Hero.module.css` `.hero` for the section frame.
   - Renders children in visual stack order: floating icons, background scene, navbar, main copy, social-proof ticker.

2. `heroScene.tsx`
   - Client component because it uses `useRef` and `useEffect` to slow the video playback rate.
   - Owns the background video and all large lighting/grade overlays.
   - Every scene layer is `aria-hidden` because it is decorative.

3. `heroFloatingContentIcons.tsx`
   - Client component because it renders positioned decorative content streams.
   - Stores icon metadata as data (`src`, `x`, `y`, `rotate`) rather than hardcoded repeated JSX.
   - Builds SVG ribbon paths from percentage-based points, then renders icon cards over the same coordinate system.
   - Uses `pointer-events: none` because this layer should not block hero interactions.

4. `heroNavbar.tsx`
   - Owns only hero-specific navigation and authentication links.
   - Keeps link data in an array and maps it into `next/link` elements.
   - Uses `next/image` for the logo asset and sets `priority` because it appears above the fold.

5. `heroContent.tsx`
   - Owns headline, eyebrow, description, CTA buttons, and handwritten note.
   - Uses semantic text elements (`h1`, `p`) and regular buttons for actions.
   - Keeps copy and CTA layout separate from global section/background concerns.

6. `heroTicker.tsx`
   - Owns bottom social proof: avatar stack, learner count, and rating.
   - Uses a small data array for repeated avatars.
   - Keeps avatar images decorative with empty `alt` text.

## Layering rules

- The parent section must be `position: relative` and `overflow: hidden`.
- Background/video layers should be absolute and sit at the bottom of the stack.
- Decorative icon streams use a low z-index above the scene but below copy.
- Main copy and ticker use higher z-index values so they remain readable and clickable.
- Navbar uses the highest z-index because it must stay available over every decorative layer.
- Decorative layers should use `pointer-events: none` unless they are intentionally interactive.

## CSS module rules

- Use one CSS module per component when the component has meaningful styling.
- Put section-wide frame and shared scene layers in the root section CSS module (`Hero.module.css`).
- Put component-local selectors in that component's CSS module (`heroContent.module.css`, `heroNavbar.module.css`, etc.).
- Keep class names descriptive by role: `.content`, `.title`, `.actions`, `.ticker`, `.background`, `.video`.
- Prefer CSS custom properties and existing design tokens for font weights, tracking, z-index, and reusable values.
- Use fixed art-direction values only where the visual composition depends on the background asset.
- Use `clamp()`, `min()`, and `max()` for responsive sizing before adding many breakpoint overrides.
- Breakpoints should progressively simplify: reduce spacing, wrap actions, hide non-essential decorative layers, then stack content on mobile.
- Keep hover transitions short and targeted; avoid animating layout-heavy properties where a transform works.
- Decorative effects should be built with gradients, filters, blend modes, and pseudo-scene layers rather than extra DOM when possible.

## New section generation pattern

When generating another landing section:

1. Create a numbered section folder, for example `07-new-section/`.
2. Add `NewSection.tsx`, `NewSection.module.css`, and `index.ts`.
3. Split complex visual pieces into small sibling components only when they own distinct behavior or styling.
4. Make the root component responsible for composition, not detailed content styling.
5. Keep repeated content in arrays and map it to JSX.
6. Keep decorative assets empty-alt or `aria-hidden`; keep meaningful content semantic.
7. Export only the public section component from `index.ts`.
8. Match the CSS-module pattern: root frame first, component blocks next, interactions, then responsive media queries from large to small.
