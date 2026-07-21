# Design System Documentation

---


# Component Styling

Component styles live in component-local CSS Modules and consume CSS variables from the design token system. Design tokens remain the single source of truth for color, spacing, typography, radius, motion, and other shared values. Layout primitives share centralized layout token maps where appropriate. Accessibility is part of the component contract, including semantic HTML, ARIA, and keyboard support.

---

# Design Tokens

## Colors

### Indigo Palette
- `--indigo-50`
- `--indigo-100`
- `--indigo-200`
- `--indigo-300`
- `--indigo-400`
- `--indigo-500`
- `--indigo-600`
- `--indigo-700`
- `--indigo-800`
- `--indigo-900`
- `--indigo-950`

### Orange Palette
- `--orange-50`
- `--orange-100`
- `--orange-200`
- `--orange-300`
- `--orange-400`
- `--orange-500`
- `--orange-600`
- `--orange-700`
- `--orange-800`
- `--orange-900`
- `--orange-950`

### Cream Palette
- `--cream-50`
- `--cream-100`
- `--cream-200`
- `--cream-300`
- `--cream-400`
- `--cream-500`

### Gray Palette
- `--gray-50`
- `--gray-100`
- `--gray-200`
- `--gray-300`
- `--gray-400`
- `--gray-500`
- `--gray-600`
- `--gray-700`
- `--gray-800`
- `--gray-900`
- `--gray-950`

### Green Palette
- `--green-50`
- `--green-100`
- `--green-500`
- `--green-700`

### Red Palette
- `--red-50`
- `--red-100`
- `--red-500`
- `--red-700`

### Blue Palette
- `--blue-50`
- `--blue-100`
- `--blue-500`
- `--blue-700`

### Semantic Brand Colors
- `--color-brand`
- `--color-brand-hover`
- `--color-brand-soft`
- `--color-brand-subtle`
- `--color-brand-rgb`

### Accent Colors
- `--color-accent`
- `--color-accent-hover`
- `--color-accent-soft`
- `--color-accent-subtle`
- `--color-accent-rgb`

### Surface Colors
- `--color-background`
- `--color-background-elevated`
- `--color-surface`
- `--color-surface-rgb`
- `--color-surface-secondary`
- `--color-surface-tertiary`

### Text Colors
- `--color-text`
- `--color-text-primary`
- `--color-text-secondary`
- `--color-text-muted`
- `--color-text-disabled`
- `--color-text-inverse`

### Border Colors
- `--color-border`
- `--color-border-hover`
- `--color-border-focus`

### Status Colors
#### Success
- `--color-success`
- `--color-success-bg`

#### Warning
- `--color-warning`
- `--color-warning-bg`

#### Error
- `--color-error`
- `--color-error-bg`

#### Info
- `--color-info`
- `--color-info-bg`

---

# Typography

## Font Families
- `--font-sans`
- `--font-display`
- `--font-mono`

## Font Weights
- `--font-thin`
- `--font-extralight`
- `--font-light`
- `--font-normal`
- `--font-medium`
- `--font-semibold`
- `--font-bold`
- `--font-extrabold`

## Text Sizes
- `--text-xs`
- `--text-sm`
- `--text-base`
- `--text-lg`
- `--text-xl`
- `--text-2xl`
- `--text-3xl`
- `--text-4xl`
- `--text-5xl`
- `--text-6xl`
- `--text-7xl`

## Display Sizes
- `--display-sm`
- `--display-md`
- `--display-lg`
- `--display-xl`

## Line Heights
- `--leading-none`
- `--leading-tight`
- `--leading-snug`
- `--leading-normal`
- `--leading-relaxed`
- `--leading-loose`

## Letter Spacing
- `--tracking-tighter`
- `--tracking-tight`
- `--tracking-normal`
- `--tracking-wide`
- `--tracking-wider`

## Semantic Typography Tokens

### Hero
- `--font-hero-size`
- `--font-hero-weight`
- `--font-hero-line-height`
- `--font-hero-tracking`

### Section Titles
- `--font-section-title-size`
- `--font-section-title-weight`
- `--font-section-title-line-height`
- `--font-section-title-tracking`

### Card Titles
- `--font-card-title-size`
- `--font-card-title-weight`
- `--font-card-title-line-height`

### Body
- `--font-body-size`
- `--font-body-weight`
- `--font-body-line-height`

### Large Body
- `--font-body-lg-size`
- `--font-body-lg-line-height`

### Small Text
- `--font-small-size`
- `--font-small-line-height`

### Caption
- `--font-caption-size`
- `--font-caption-weight`
- `--font-caption-line-height`

### Buttons
- `--font-button-size`
- `--font-button-weight`
- `--font-button-tracking`

### Navigation
- `--font-nav-size`
- `--font-nav-weight`

### Badges
- `--font-badge-size`
- `--font-badge-weight`
- `--font-badge-tracking`

---

# Spacing

## Spacing Scale
- `--space-0`
- `--space-0_5`
- `--space-1`
- `--space-2`
- `--space-3`
- `--space-4`
- `--space-5`
- `--space-6`
- `--space-8`
- `--space-10`
- `--space-12`
- `--space-16`
- `--space-20`
- `--space-24`
- `--space-32`
- `--space-40`
- `--space-48`
- `--space-56`
- `--space-64`

## Layout Spacing
- `--page-padding`
- `--section-space-xs`
- `--section-space-sm`
- `--section-space-md`
- `--section-space-lg`
- `--section-space-xl`

---

# Containers

- `--container-xs`
- `--container-sm`
- `--container-md`
- `--container-lg`
- `--container-xl`
- `--container-2xl`
- `--container-full`

---

# Border Radius

- `--radius-none`
- `--radius-xs`
- `--radius-sm`
- `--radius-md`
- `--radius-lg`
- `--radius-xl`
- `--radius-2xl`
- `--radius-3xl`
- `--radius-pill`
- `--radius-circle`

## Component Radius
- `--radius-button`
- `--radius-input`
- `--radius-card`
- `--radius-modal`
- `--radius-badge`

---

# Borders

- `--color-border`
- `--color-border-hover`
- `--color-border-focus`
- `--glass-border`

---

# Shadows

## Elevation
- `--shadow-xs`
- `--shadow-sm`
- `--shadow-md`
- `--shadow-lg`
- `--shadow-xl`
- `--shadow-2xl`

## Semantic Shadows
- `--shadow-primary`
- `--shadow-primary-lg`
- `--shadow-momentum`
- `--shadow-card`
- `--shadow-floating`
- `--shadow-dropdown`
- `--shadow-modal`

---

# Motion

## Duration
- `--duration-fast`
- `--duration-base`
- `--duration-slow`
- `--duration-slower`

## Easing
- `--ease-standard`
- `--ease-in`
- `--ease-out`
- `--ease-bounce`

## Transition Helpers
- `--transition-colors`
- `--transition-shadow`
- `--transition-transform`

---

# Blur

- `--blur-xs`
- `--blur-sm`
- `--blur-md`
- `--blur-lg`
- `--blur-xl`
- `--blur-2xl`

---

# Glass Tokens

- `--glass-light`
- `--glass-medium`
- `--glass-dark`
- `--glass-border`

---

# Gradients

- `--gradient-brand`
- `--gradient-brand-soft`
- `--gradient-learning`
- `--gradient-momentum`
- `--gradient-card`
- `--gradient-border`
- `--gradient-hero`
- `--gradient-footer`

---

# Z-Index

- `--z-hide`
- `--z-base`
- `--z-content`
- `--z-dropdown`
- `--z-sticky`
- `--z-fixed`
- `--z-overlay`
- `--z-modal`
- `--z-popover`
- `--z-toast`
- `--z-tooltip`
- `--z-max`

---

# Global Utility Classes

## Layout
### `.container`
Constrains page width and applies horizontal page padding.

### `.container-fluid`
Creates a full-width container.

### `.section`
Applies shared section positioning and vertical spacing.

---

## Glass & Visual Effects

### `.glass`
Applies glass background, border, and backdrop blur.

### `.bg-gradient-brand`
Applies the primary brand gradient.

### `.bg-gradient-learning`
Applies the learning gradient.

### `.bg-gradient-momentum`
Applies the momentum gradient.

### `.shadow-primary`
Applies the primary brand shadow.

### `.shadow-momentum`
Applies the momentum accent shadow.

---

## Typography

### `.text-balance`
Applies balanced text wrapping.

### `.text-pretty`
Applies pretty text wrapping.

---

## Print

### `.no-print`
Hides content during printing.

### `.print-only`
Shows content only when printing.

---

# Button Utility Classes

## Base

### `.btn`
Base button layout, typography, border radius, and transitions.

---

## Sizes

- `.btn-xs`
- `.btn-sm`
- `.btn-md`
- `.btn-lg`
- `.btn-xl`

---

## Variants

- `.btn-primary`
- `.btn-secondary`
- `.btn-ghost`
- `.btn-outline`
- `.btn-momentum`
- `.btn-danger`

---

## Modifiers

- `.btn-block`
- `.btn-icon`
- `.btn-loading`

---

# Component CSS Modules

Component-local `*.module.css` files define component structure and variants while consuming design token CSS variables.

---

# CSS File Reference

## Global Styles

### `src/app/globals.css`
Imports Tailwind and all global stylesheets.

### `src/app/styles/tokens.css`
Defines design tokens and theme mappings.

### `src/app/styles/reset.css`
Global reset and base element normalization.

### `src/app/styles/typography.css`
Body, headings, paragraphs, inline text, and text wrapping utilities.

### `src/app/styles/forms.css`
Global form controls, labels, validation states, autofill, selects, fieldsets, and scrollbars.

### `src/app/styles/layout.css`
Layout primitives, glass utilities, gradient utilities, and shadow utilities.

### `src/app/styles/buttons.css`
Placeholder stylesheet for global button styles.

### `src/app/styles/accessibility.css`
Selection, focus-visible, reduced motion, contrast, forced-colors, and touch-action rules.

### `src/app/styles/print.css`
Print resets and print visibility utilities.

---

## Component Stylesheets

### `src/client/components/ui/Button/Button.css`
Button component classes, variants, sizes, and modifiers.

### `src/client/components/global/Footer/footer.css`
Footer component styles.

### `src/client/components/global/Logo/logo.css`
Logo component styles.

### `src/client/components/global/Navbar/navbar.css`
Navbar component styles and variants.

---

# Naming Conventions

## CSS Variables
- Use **kebab-case** with the `--` prefix.

## Color Tokens
- Primitive palette colors use `--{color}-{scale}`.
- Example: `--indigo-50`, `--gray-900`

## Semantic Colors
- Use the `--color-*` convention.

## RGB Tokens
- Use the `-rgb` suffix.

## Typography
- Semantic font tokens use `--font-{role}-{property}`.
- Text sizes use `--text-*`.
- Display sizes use `--display-*`.
- Line heights use `--leading-*`.
- Letter spacing uses `--tracking-*`.

## Spacing
- Spacing tokens use `--space-*`.
- Fractional spacing uses underscore notation (e.g. `--space-0_5`).

## Containers
- `--container-*`

## Section Spacing
- `--section-space-*`

## Motion
- Durations use `--duration-*`.
- Easings use `--ease-*`.
- Transition shorthands use `--transition-*`.

## Radius
- Radius tokens use `--radius-*`.
- Component aliases include:
    - `--radius-button`
    - `--radius-card`
    - `--radius-input`

## Shadows
- Elevation and semantic aliases use `--shadow-*`.

## Gradients
- Use `--gradient-*`.

## Glass
- Use `--glass-*`.

## Blur
- Use `--blur-*`.

## Z-Index
- Use `--z-*`.

## Utility Classes
Use semantic utility names such as:

- `.container`
- `.section`
- `.glass`
- `.text-balance`

## Background Utilities
Use `.bg-gradient-*`.

## Shadow Utilities
Use `.shadow-*`.

## Component CSS Modules
Use component-local classes backed by shared design tokens.

## Button Classes

### Sizes
- `.btn-xs`
- `.btn-sm`
- `.btn-md`
- `.btn-lg`
- `.btn-xl`

### Variants
- `.btn-primary`
- `.btn-secondary`
- `.btn-ghost`
- `.btn-outline`
- `.btn-momentum`
- `.btn-danger`

### Modifiers
- `.btn-block`
- `.btn-icon`
- `.btn-loading`

## State Styling
Use pseudo-classes and attributes:

- `:hover`
- `:focus`
- `:focus-visible`
- `:disabled`
- `[disabled]`
- `:invalid`

## Component Variants
Represent component variants with component-local CSS Module classes.
