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


# Component Library

## Layout

### Container
**Path:** `src/client/components/global/layout/Container.tsx`

**Purpose:** Width-constrained wrapper.

#### Props
- `size` — Max width preset.
- `as` — Rendered element/component.
- Standard `div` HTML props.

#### Variants
None

#### Sizes
- `xs`
- `sm`
- `md`
- `lg`
- `xl`
- `2xl`
- `reading`
- `hero`
- `wide`
- `full`

---

### Stack
**Path:** `src/client/components/global/layout/Stack.tsx`

**Purpose:** Vertical flex layout with configurable gap and alignment.

#### Props
- `as` — Rendered element/component.
- `gap` — Vertical spacing token.
- `align` — CSS `align-items`.
- Standard `div` HTML props.

#### Variants
None

#### Sizes
None

---

### Cluster
**Path:** `src/client/components/global/layout/Cluster.tsx`

**Purpose:** Horizontal/wrapping flex layout.

#### Props
- `as` — Rendered element/component.
- `gap` — Spacing token.
- `justify` — CSS `justify-content` preset.
- `align` — CSS `align-items` preset.
- `wrap` — Enable/disable flex wrapping.
- Standard `div` HTML props.

#### Variants
None

#### Sizes
None

---

### Section
**Path:** `src/client/components/global/layout/Section.tsx`

**Purpose:** Page section wrapper with spacing and background options.

#### Props
- `as` — Rendered element/component.
- `spacing` — Vertical padding preset.
- `background` — Background style preset.
- `hero` — Full-height centered hero mode.
- Standard `section` HTML props.

#### Variants
- `transparent`
- `surface`
- `subtle`
- `brand`
- `momentum`
- `gradient`
- `glass`

#### Sizes
- `none`
- `xs`
- `sm`
- `md`
- `lg`
- `xl`

---

### Surface
**Path:** `src/client/components/global/layout/Surface.tsx`

**Purpose:** Card/panel surface wrapper.

#### Props
- `as` — Rendered element/component.
- `variant` — Visual surface style.
- `radius` — Border radius preset.
- `padding` — Inner spacing preset.
- Standard `div` HTML props.

#### Variants
- `default`
- `subtle`
- `outlined`
- `elevated`
- `glass`
- `brand`

#### Sizes
None

---

### SectionHeader
**Path:** `src/client/components/global/layout/SectionHeader.tsx`

**Purpose:** Reusable section heading block with optional eyebrow, description, and actions.

#### Props
- `eyebrow` — Optional badge content.
- `title` — Required heading content.
- `description` — Optional lead text.
- `actions` — Optional action node.
- `align` — Text/layout alignment.
- `maxWidth` — Maximum width CSS value.
- Standard `div` HTML props (excluding native `title`).

#### Variants
None

#### Sizes
None

---

# UI Components

## Button
**Path:** `src/client/components/ui/Button/Button.tsx`

**Purpose:** Reusable button component.

#### Props
- `variant` — Visual style.
- `size` — Button size.
- `loading` — Disabled loading state with spinner.
- `fullWidth` — Block/full-width mode.
- `iconOnly` — Icon-only styling.
- `as` — Rendered element/component.
- Standard `button` HTML props.

#### Variants
- `primary`
- `secondary`
- `ghost`
- `outline`
- `momentum`
- `danger`

#### Sizes
- `xs`
- `sm`
- `md`
- `lg`
- `xl`

---

## Badge
**Path:** `src/client/components/ui/Badge/Badge.tsx`

**Purpose:** Inline status/category label.

#### Props
- `variant` — Color style.
- `size` — Badge size.
- Standard `span` HTML props.

#### Variants
- `brand`
- `momentum`
- `success`
- `warning`
- `danger`
- `neutral`

#### Sizes
- `sm`
- `md`
- `lg`

---

## Divider
**Path:** `src/client/components/ui/Divider/Divider.tsx`

**Purpose:** Horizontal or vertical rule.

#### Props
- `vertical` — Render vertical divider.
- `inset` — Inset horizontal width.
- Standard `hr` HTML props.

#### Variants
None

#### Sizes
None

---

## Heading
**Path:** `src/client/components/ui/Typography/Heading.tsx`

**Purpose:** Typography heading with level-based styles.

#### Props
- `level` — Heading level/style scale.
- `as` — Rendered element override.
- Standard HTML element props.

#### Variants
None

#### Sizes
- `1`
- `2`
- `3`
- `4`
- `5`
- `6`

---

## Text
**Path:** `src/client/components/ui/Typography/Text.tsx`

**Purpose:** Typography text component.

#### Props
- `variant` — Text style.
- `as` — Rendered element/component.
- Standard paragraph HTML props.

#### Variants
- `body`
- `lead`
- `small`
- `muted`

#### Sizes
None

---

# Global Components

## Logo
**Path:** `src/client/components/global/Logo/Logo.tsx`

**Purpose:** Linked SideQuestHQ logo/wordmark.

#### Props
- `href` — Link destination.
- `compact` — Hide tagline.
- `iconOnly` — Hide text.
- `className` — Logo wrapper class.
- `priority` — Declared prop; image currently always receives priority.

#### Variants
- `compact`
- `icon-only`

#### Sizes
None

---

## Navbar
**Path:** `src/client/components/global/Navbar/Navbar.tsx`

**Purpose:** Landing/global header with navigation links and CTA.

#### Props
- `links` — Navigation link array (`{ label, href }`).
- `sticky` — Sticky header class toggle.
- `transparent` — Transparent header class toggle.
- `ctaLabel` — CTA button text.
- `ctaHref` — CTA link destination.
- `className` — Header class.

#### Variants
- `sticky`
- `transparent`

#### Sizes
None

---

## Footer
**Path:** `src/client/components/global/Footer/Footer.tsx`

**Purpose:** Global footer with logo, navigation, social links, and legal links.

#### Props
- `description` — Footer description text.
- `navigation` — Navigation link array (`{ label, href }`).
- `social` — Social link array (`{ label, href }`).

#### Variants
None

#### Sizes
None

---

# Landing Screen Components

## Hero
**Path:** `src/client/components/screens/landing/01-hero/Hero.tsx`

**Purpose:** Landing hero section shell.

#### Props
None

#### Variants
None

#### Sizes
None

---

## Ikigai
**Path:** `src/client/components/screens/landing/02-ikigai/Ikigai.tsx`

**Purpose:** Landing Ikigai section shell.

#### Props
None

#### Variants
None

#### Sizes
None

---

## Problem
**Path:** `src/client/components/screens/landing/03-problem/Problem.tsx`

**Purpose:** Landing problem section shell.

#### Props
None

#### Variants
None

#### Sizes
None

---

## Community
**Path:** `src/client/components/screens/landing/04-community/Community.tsx`

**Purpose:** Landing community section shell.

#### Props
None

#### Variants
None

#### Sizes
None

---

## Features
**Path:** `src/client/components/screens/landing/05-Features/Features.tsx`

**Purpose:** Landing features section shell.

#### Props
None

#### Variants
None

#### Sizes
None

---

## Landing Footer
**Path:** `src/client/components/screens/landing/06-footer/Footer.tsx`

**Purpose:** Landing footer section shell.

#### Props
None

#### Variants
None

#### Sizes
None
