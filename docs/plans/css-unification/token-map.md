# Canonical Token Map & Compatibility Alias Specification

**Phase and Task ID:** Phase 1, Task 1.2 (Token Architecture and Mapping)  
**Date:** 27 October 2026  
**Status:** Frozen specification for Phase 1  
**Upstream Gate:** P0 completed inventories in [`docs/plans/css-investigation-and-unification.md`](../css-investigation-and-unification.md)  
**Downstream Dependencies:** Phase 2 (Global Cascade Precedence), Phase 3 (Token & Theme Unification), Phase 4 (Primitives & Notes Pilot)  
**Authoritative Scope:** Single source of truth for canonical tokens, legacy compatibility aliases, missing token resolutions, theme parity, and Tailwind v4 bridging.

---

## 1. Executive Summary & Architecture Principles

### 1.1 Core Problems Solved
1. **Unowned & Inconsistent Namespaces:** Legacy variables were split across `--color-*`, `--text-*`, `--font-*`, `--space-*`, `--radius-*`, and raw color names without namespace boundaries, leading to name collisions with Tailwind v4 internals.
2. **Missing Token References:** Investigation discovered unbacked tokens in active components (e.g., `--radius-full` in `NotesSaveStatus.module.css:53`, `--color-surface-elevated` in Sidebar and CreateCohort, `--color-gray-500` / `--color-green-500` in notes status).
3. **Broken Theme Parity:** In `tokens.css`, `:root` defined 32 semantic color tokens while `[data-theme="dark"]` defined only 15. Crucial tokens like `--color-background-elevated`, status background tints, and border focus rings lacked dark definitions, causing high-contrast glare or white flashes on dark surfaces.
4. **Tailwind v4 Scale Clashes:** Tailwind v4 expects `--text-sm` to equal `14px` (`0.875rem`). Undone's design system explicitly defines `--text-sm: 1rem` (`16px`) and `--text-xs: 0.875rem` (`14px`). Naive token replacement alters typography metrics across all existing UI.

### 1.2 Five Binding Architecture Invariants
1. **Canonical Application Namespace (`--ud-*`):**  
   All canonical tokens are prefixed with `--ud-` (e.g., `--ud-color-surface`, `--ud-color-text-primary`, `--ud-space-4`, `--ud-radius-md`, `--ud-font-sans`, `--ud-type-dialog-title`).
2. **One-Way Compatibility Alias Pattern (Strictly Non-Cyclic):**  
   Every existing legacy token remains functional as a one-way alias pointing to its canonical counterpart:
   ```css
   :root {
     --ud-color-surface: #ffffff;
     --color-surface: var(--ud-color-surface); /* Legacy alias -> Canonical */
   }
   [data-theme="dark"] {
     --ud-color-surface: #000000;
     /* --color-surface automatically resolves to #000000 without duplication */
   }
   ```
   **Cyclic invariant:** Canonical `--ud-*` tokens MUST NEVER reference legacy tokens. Legacy aliases ONLY point to `--ud-*`.
3. **Zero Numeric Scale Alteration:**  
   `--text-sm` resolves strictly to `1rem` (`16px`). `--text-xs` resolves strictly to `0.875rem` (`14px`). Introducing aliases and Tailwind v4 mapping MUST NOT mutate existing computed pixel dimensions.
4. **Total Theme Parity:**  
   Every semantic token defined in `:root` has an explicit, contrast-audited value in `[data-theme="dark"]`. The dark theme scope explicitly sets `color-scheme: dark;` to synchronize native controls, scrollbars, and system dialogs.
5. **Phase 7 Retirement Gate:**  
   Legacy aliases are permanent through Phases 1–6 to guarantee zero regressions. Deprecation and retirement occurs in Phase 7 only after AST/grep audit confirms zero remaining usages.

---

## 2. Missing Token Resolution Specification

The investigation identified several critical missing tokens across production modules. These are resolved definitively as follows:

| Missing / Broken Token | Found In Consumer | Root Cause | Canonical Resolution | Light Value | Dark Value |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `--radius-full` | `NotesSaveStatus.module.css:53` | Unbacked legacy token; `tokens.css` only had `--radius-pill` | `--ud-radius-pill` (Alias: `--radius-full`) | `999px` | `999px` |
| `--color-surface-elevated` | `SidebarItem.module.css:48`, `ProfilePill.module.css:53`, `SourceCard.module.css:158` | Used with hardcoded fallbacks (`#ffffff` vs `#18181b`); never defined in `tokens.css` | `--ud-color-surface-elevated` (Alias: `--color-surface-elevated`) | `#ffffff` | `#18181b` |
| `--color-surface-hover` | `SourceCard.module.css:162` | Unbacked hover token | `--ud-color-surface-hover` (Alias: `--color-surface-hover`) | `#f4f4f5` (var(--gray-100)) | `#27272a` (var(--gray-800)) |
| `--color-amber-500` | `NotesSaveStatus.module.css:15,23` | Undone uses orange palette; amber was referenced without definition | `--ud-color-primitive-orange-500` (Alias: `--color-amber-500`) | `#f59e0b` | `#f59e0b` |
| `--color-gray-500` | `NotesSaveStatus.module.css:37`, `Notes.module.css` | Token was named `--gray-500` in `tokens.css`; component prefixed with `--color-` | `--ud-color-primitive-gray-500` (Alias: `--color-gray-500`) | `#71717a` | `#71717a` |
| `--color-green-500` | `NotesSaveStatus.module.css:43` | Named `--green-500` in `tokens.css`; component prefixed with `--color-` | `--ud-color-primitive-green-500` (Alias: `--color-green-500`) | `#22c55e` | `#22c55e` |
| `--color-red-500` | `NotesSaveStatus.module.css:50` | Named `--red-500` in `tokens.css`; component prefixed with `--color-` | `--ud-color-primitive-red-500` (Alias: `--color-red-500`) | `#ef4444` | `#ef4444` |
| `--color-red-50` | `NotesSaveStatus.module.css:51` | Named `--red-50` in `tokens.css`; component prefixed with `--color-` | `--ud-color-primitive-red-50` (Alias: `--color-red-50`) | `#fef2f2` | `rgba(239, 68, 68, 0.15)` |
| `--font-size-sm` | `HomeMobile.module.css:26` | Component used `--font-size-*` with `14px` fallback instead of `--text-xs` | `--ud-font-size-xs` (Alias: `--font-size-sm`) | `0.875rem` (14px) | `0.875rem` (14px) |
| `--font-size-lg` | `HomeMobile.module.css:56` | Component used `--font-size-*` with `18px` fallback instead of `--text-lg` | `--ud-font-size-lg` (Alias: `--font-size-lg`) | `1.125rem` (18px) | `1.125rem` (18px) |
| `--font-size-2xl` | `HomeMobile.module.css:19` | Component used `--font-size-*` with `24px` fallback instead of `--text-2xl` | `--ud-font-size-2xl` (Alias: `--font-size-2xl`) | `1.5rem` (24px) | `1.5rem` (24px) |
| `--color-border-soft` | `Card.module.css:8` | Unbacked subtle border token | `--ud-color-border-subtle` (Alias: `--color-border-soft`) | `#f4f4f5` (var(--gray-100)) | `#18181b` (var(--gray-900)) |

---

## 3. Authoritative Token Mapping Catalog

### 3.1 Primitive Colors

Primitive tokens provide the raw palette stops. They remain invariant across light/dark themes, but are namespaced under `--ud-color-primitive-*`.

| Primitive Category | Legacy Token Name | Current Value | Canonical `--ud-*` Name | Semantic Description | Legacy Alias Retirement Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Indigo (Brand Base)** | `--indigo-50` | `#eef2ff` | `--ud-color-primitive-indigo-50` | Indigo 50 | Phase 7 |
| | `--indigo-100` | `#e0e7ff` | `--ud-color-primitive-indigo-100` | Indigo 100 | Phase 7 |
| | `--indigo-200` | `#c7d2fe` | `--ud-color-primitive-indigo-200` | Indigo 200 | Phase 7 |
| | `--indigo-300` | `#a5b4fc` | `--ud-color-primitive-indigo-300` | Indigo 300 | Phase 7 |
| | `--indigo-400` | `#818cf8` | `--ud-color-primitive-indigo-400` | Indigo 400 | Phase 7 |
| | `--indigo-500` | `#4f46e5` | `--ud-color-primitive-indigo-500` | Indigo 500 (Primary Brand) | Phase 7 |
| | `--indigo-600` | `#4338ca` | `--ud-color-primitive-indigo-600` | Indigo 600 | Phase 7 |
| | `--indigo-700` | `#3730a3` | `--ud-color-primitive-indigo-700` | Indigo 700 | Phase 7 |
| | `--indigo-800` | `#312e81` | `--ud-color-primitive-indigo-800` | Indigo 800 | Phase 7 |
| | `--indigo-900` | `#1e1b4b` | `--ud-color-primitive-indigo-900` | Indigo 900 | Phase 7 |
| | `--indigo-950` | `#140f3d` | `--ud-color-primitive-indigo-950` | Indigo 950 | Phase 7 |
| **Orange (Accent Base)** | `--orange-50` | `#fffbeb` | `--ud-color-primitive-orange-50` | Orange 50 | Phase 7 |
| | `--orange-100` | `#fef3c7` | `--ud-color-primitive-orange-100` | Orange 100 | Phase 7 |
| | `--orange-200` | `#fde68a` | `--ud-color-primitive-orange-200` | Orange 200 | Phase 7 |
| | `--orange-300` | `#fcd34d` | `--ud-color-primitive-orange-300` | Orange 300 | Phase 7 |
| | `--orange-400` | `#fbbf24` | `--ud-color-primitive-orange-400` | Orange 400 | Phase 7 |
| | `--orange-500` | `#f59e0b` | `--ud-color-primitive-orange-500` | Orange 500 (Primary Accent) | Phase 7 |
| | `--orange-600` | `#d97706` | `--ud-color-primitive-orange-600` | Orange 600 | Phase 7 |
| | `--orange-700` | `#b45309` | `--ud-color-primitive-orange-700` | Orange 700 | Phase 7 |
| | `--orange-800` | `#92400e` | `--ud-color-primitive-orange-800` | Orange 800 | Phase 7 |
| | `--orange-900` | `#78350f` | `--ud-color-primitive-orange-900` | Orange 900 | Phase 7 |
| | `--orange-950` | `#451a03` | `--ud-color-primitive-orange-950` | Orange 950 | Phase 7 |
| **Cream (Warm Neutral)** | `--cream-50` | `#fffefc` | `--ud-color-primitive-cream-50` | Warm Paper 50 | Phase 7 |
| | `--cream-100` | `#faf7f2` | `--ud-color-primitive-cream-100` | Warm Paper 100 | Phase 7 |
| | `--cream-200` | `#f5f1ea` | `--ud-color-primitive-cream-200` | Warm Paper 200 | Phase 7 |
| | `--cream-300` | `#ede7dd` | `--ud-color-primitive-cream-300` | Warm Paper 300 | Phase 7 |
| | `--cream-400` | `#ddd3c5` | `--ud-color-primitive-cream-400` | Warm Paper 400 | Phase 7 |
| | `--cream-500` | `#cbbba6` | `--ud-color-primitive-cream-500` | Warm Paper 500 | Phase 7 |
| **Gray (Cool Neutral)** | `--gray-50` | `#fafafa` | `--ud-color-primitive-gray-50` | Gray 50 | Phase 7 |
| | `--gray-100` | `#f4f4f5` | `--ud-color-primitive-gray-100` | Gray 100 | Phase 7 |
| | `--gray-200` | `#e4e4e7` | `--ud-color-primitive-gray-200` | Gray 200 | Phase 7 |
| | `--gray-300` | `#d4d4d8` | `--ud-color-primitive-gray-300` | Gray 300 | Phase 7 |
| | `--gray-400` | `#a1a1aa` | `--ud-color-primitive-gray-400` | Gray 400 | Phase 7 |
| | `--gray-500` | `#71717a` | `--ud-color-primitive-gray-500` | Gray 500 | Phase 7 |
| | `--gray-600` | `#52525b` | `--ud-color-primitive-gray-600` | Gray 600 | Phase 7 |
| | `--gray-700` | `#3f3f46` | `--ud-color-primitive-gray-700` | Gray 700 | Phase 7 |
| | `--gray-800` | `#27272a` | `--ud-color-primitive-gray-800` | Gray 800 | Phase 7 |
| | `--gray-900` | `#1f2937` | `--ud-color-primitive-gray-900` | Gray 900 | Phase 7 |
| | `--gray-950` | `#09090b` | `--ud-color-primitive-gray-950` | Gray 950 | Phase 7 |
| **Semantic Primitives** | `--green-50` | `#f0fdf4` | `--ud-color-primitive-green-50` | Green 50 | Phase 7 |
| | `--green-100` | `#dcfce7` | `--ud-color-primitive-green-100` | Green 100 | Phase 7 |
| | `--green-500` | `#22c55e` | `--ud-color-primitive-green-500` | Green 500 | Phase 7 |
| | `--green-700` | `#15803d` | `--ud-color-primitive-green-700` | Green 700 | Phase 7 |
| | `--red-50` | `#fef2f2` | `--ud-color-primitive-red-50` | Red 50 | Phase 7 |
| | `--red-100` | `#fee2e2` | `--ud-color-primitive-red-100` | Red 100 | Phase 7 |
| | `--red-500` | `#ef4444` | `--ud-color-primitive-red-500` | Red 500 | Phase 7 |
| | `--red-700` | `#b91c1c` | `--ud-color-primitive-red-700` | Red 700 | Phase 7 |
| | `--blue-50` | `#eff6ff` | `--ud-color-primitive-blue-50` | Blue 50 | Phase 7 |
| | `--blue-100` | `#dbeafe` | `--ud-color-primitive-blue-100` | Blue 100 | Phase 7 |
| | `--blue-500` | `#3b82f6` | `--ud-color-primitive-blue-500` | Blue 500 | Phase 7 |
| | `--blue-700` | `#1d4ed8` | `--ud-color-primitive-blue-700` | Blue 700 | Phase 7 |

---

### 3.2 Semantic Colors (With Strict Theme Parity)

Every token below is guaranteed to have explicit, contrast-verified values in both `:root` and `[data-theme="dark"]`.

| Semantic Category | Legacy Token Name | Canonical `--ud-*` Name | Light Value (`:root`) | Dark Value (`[data-theme="dark"]`) | Role & Consumer Scope | Legacy Alias Retirement Gate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Brand** | `--color-brand` | `--ud-color-brand` | `#4f46e5` (`var(--indigo-500)`) | `#4f46e5` (`#6366f1` safe) | Primary interactive actions, CTAs | Phase 7 |
| | `--color-brand-hover` | `--ud-color-brand-hover` | `#3730a3` (`var(--indigo-700)`) | `#818cf8` (`var(--indigo-400)`) | Brand action hover state | Phase 7 |
| | `--color-brand-soft` | `--ud-color-brand-soft` | `#e0e7ff` (`var(--indigo-100)`) | `rgba(79, 70, 229, 0.2)` | Brand pill / badge background | Phase 7 |
| | `--color-brand-subtle` | `--ud-color-brand-subtle` | `#eef2ff` (`var(--indigo-50)`) | `rgba(79, 70, 229, 0.1)` | Brand row / item selection | Phase 7 |
| | `--color-brand-rgb` | `--ud-color-brand-rgb` | `79 70 229` | `79 70 229` | Dynamic alpha channels & focus rings | Phase 7 |
| **Accent** | `--color-accent` | `--ud-color-accent` | `#f59e0b` (`var(--orange-500)`) | `#f59e0b` | Secondary highlights, streaks, badges | Phase 7 |
| | `--color-accent-hover` | `--ud-color-accent-hover` | `#d97706` (`var(--orange-600)`) | `#fbbf24` (`var(--orange-400)`) | Accent action hover state | Phase 7 |
| | `--color-accent-soft` | `--ud-color-accent-soft` | `#fef3c7` (`var(--orange-100)`) | `rgba(245, 158, 11, 0.2)` | Accent pill / highlight background | Phase 7 |
| | `--color-accent-subtle` | `--ud-color-accent-subtle` | `#fffbeb` (`var(--orange-50)`) | `rgba(245, 158, 11, 0.1)` | Accent subtle tint | Phase 7 |
| | `--color-accent-rgb` | `--ud-color-accent-rgb` | `245 158 11` | `245 158 11` | Accent dynamic alpha channels | Phase 7 |
| **Surfaces** | `--color-background` | `--ud-color-background` | `#ffffff` | `#000000` | Viewport & page root background | Phase 7 |
| | `--color-background-elevated` | `--ud-color-background-elevated`| `#ffffff` | `#18181b` | Main container elevated canvas | Phase 7 |
| | `--color-surface` | `--ud-color-surface` | `#ffffff` | `#000000` | Card, panel, dialog surface base | Phase 7 |
| | `--color-surface-rgb` | `--ud-color-surface-rgb` | `255 255 255` | `0 0 0` | Glass & shadow background alpha | Phase 7 |
| | `--color-surface-secondary` | `--ud-color-surface-secondary` | `#fafafa` (`var(--gray-50)`) | `#09090b` | Sidebar, input background, secondary card | Phase 7 |
| | `--color-surface-tertiary` | `--ud-color-surface-tertiary` | `#f4f4f5` (`var(--gray-100)`) | `#18181b` | Inset well, pill background, header tab | Phase 7 |
| | `--color-surface-elevated` *(Resolved)* | `--ud-color-surface-elevated` | `#ffffff` | `#18181b` | Floating popovers, dropdowns, active pills | Phase 7 |
| | `--color-surface-hover` *(Resolved)* | `--ud-color-surface-hover` | `#f4f4f5` (`var(--gray-100)`) | `#27272a` | Hovered list items, button ghost hover | Phase 7 |
| **Typography / Text** | `--color-text` / `--color-text-primary` | `--ud-color-text-primary` | `#1f2937` (`var(--gray-900)`) | `#ffffff` | High-emphasis body, titles, headings | Phase 7 |
| | `--color-text-secondary` | `--ud-color-text-secondary` | `#52525b` (`var(--gray-600)`) | `#a1a1aa` | Secondary body, metadata, captions | Phase 7 |
| | `--color-text-muted` | `--ud-color-text-muted` | `#71717a` (`var(--gray-500)`) | `#71717a` | Placeholder text, timestamps, icons | Phase 7 |
| | `--color-text-disabled` | `--ud-color-text-disabled` | `#d4d4d8` (`var(--gray-300)`) | `#52525b` | Disabled controls, inactive toggles | Phase 7 |
| | `--color-text-inverse` | `--ud-color-text-inverse` | `#ffffff` | `#000000` | Inverted surfaces, filled buttons | Phase 7 |
| **Borders** | `--color-border` | `--ud-color-border` | `#e4e4e7` (`var(--gray-200)`) | `#27272a` | Default dividing lines, card borders | Phase 7 |
| | `--color-border-hover` | `--ud-color-border-hover` | `#d4d4d8` (`var(--gray-300)`) | `#3f3f46` | Interactive border hover state | Phase 7 |
| | `--color-border-focus` | `--ud-color-border-focus` | `#818cf8` (`var(--indigo-400)`)| `#4f46e5` (`var(--indigo-500)`)| Focused input / card outline ring | Phase 7 |
| | `--color-border-subtle` *(Resolved)* | `--ud-color-border-subtle` | `#f4f4f5` (`var(--gray-100)`) | `#18181b` | Barely-visible separators, nested list items| Phase 7 |
| **Feedback / Status** | `--color-success` | `--ud-color-success` | `#22c55e` (`var(--green-500)`)| `#22c55e` | Success status, saved checkmarks | Phase 7 |
| | `--color-success-bg` | `--ud-color-success-bg` | `#f0fdf4` (`var(--green-50)`) | `rgba(34, 197, 94, 0.15)` | Success banner / badge background | Phase 7 |
| | `--color-warning` | `--ud-color-warning` | `#f59e0b` (`var(--orange-500)`)| `#f59e0b` | Warning banner, pending sync state | Phase 7 |
| | `--color-warning-bg` | `--ud-color-warning-bg` | `#fffbeb` (`var(--orange-50)`) | `rgba(245, 158, 11, 0.15)` | Warning banner background | Phase 7 |
| | `--color-error` | `--ud-color-error` | `#ef4444` (`var(--red-500)`) | `#ef4444` | Form errors, destructive buttons | Phase 7 |
| | `--color-error-bg` | `--ud-color-error-bg` | `#fef2f2` (`var(--red-50)`) | `rgba(239, 68, 68, 0.15)` | Form error container background | Phase 7 |
| | `--color-info` | `--ud-color-info` | `#3b82f6` (`var(--blue-500)`) | `#3b82f6` | Informational callouts | Phase 7 |
| | `--color-info-bg` | `--ud-color-info-bg` | `#eff6ff` (`var(--blue-50)`) | `rgba(59, 130, 246, 0.15)` | Informational banner background | Phase 7 |
| **Glass Surfaces** | `--glass-light` | `--ud-glass-light` | `rgb(255 255 255 / 0.72)` | `rgba(0, 0, 0, 0.72)` | Translucent navbar, floating docks | Phase 7 |
| | `--glass-medium` | `--ud-glass-medium` | `rgb(255 255 255 / 0.82)` | `rgba(0, 0, 0, 0.82)` | Translucent modal scrim, dialog backdrop | Phase 7 |
| | `--glass-dark` | `--ud-glass-dark` | `rgb(31 41 55 / 0.55)` | `rgba(15, 23, 42, 0.75)` | Dark floating toolbars | Phase 7 |
| | `--glass-border` | `--ud-glass-border` | `rgb(255 255 255 / 0.35)` | `rgba(255, 255, 255, 0.12)`| Translucent border around frosted cards | Phase 7 |

---

### 3.3 Typography Tokens

#### 3.3.1 Font Families
| Font Role | Legacy Token Name | Canonical `--ud-*` Name | Resolved Value | Font Source / Fallback Chain | Legacy Alias Retirement Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sans / Body** | `--font-sans` | `--ud-font-sans` | `var(--font-manrope, 'Manrope', system-ui, -apple-system, sans-serif)` | Next/font `manrope.variable` or local font | Phase 7 |
| **Display / Headings** | `--font-display` | `--ud-font-display` | `var(--font-manrope, 'Manrope', system-ui, -apple-system, sans-serif)` | Shared with sans for modern clean titles | Phase 7 |
| **Monospace** | `--font-mono` | `--ud-font-mono` | `'JetBrains Mono', 'SF Mono', Consolas, monospace` | System / Dev monospace stack | Phase 7 |
| **Handwriting Script** | `--font-accent-script`| `--ud-font-script` | `var(--font-caveat-next, 'Caveat', cursive)` | Next/font `caveat.variable` | Phase 7 |
| **Editorial Serif** | `--font-lora` | `--ud-font-serif-editorial`| `var(--font-lora, 'Lora', Georgia, serif)` | Next/font `lora.variable` (Home & Landing) | Phase 7 |
| **Display Serif** | `--font-playfair` | `--ud-font-serif-display` | `var(--font-playfair-display, 'Playfair Display', serif)` | Next/font `playfairDisplay.variable` | Phase 7 |

#### 3.3.2 Font Sizes & Preserved Scale Contract
> [!IMPORTANT]
> **Scale Protection Invariant:** `--text-sm` is explicitly `1rem` (`16px`). `--text-xs` is explicitly `0.875rem` (`14px`). These MUST NOT be swapped for standard Tailwind values during alias introduction!

| Scale Step | Legacy Token Name | Canonical `--ud-*` Name | Resolved Rem | Pixel Value | Typical Application Use | Legacy Alias Retirement Gate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **XS** | `--text-xs` | `--ud-font-size-xs` | `0.875rem` | **14px** | Captions, timestamps, badges, small buttons | Phase 7 |
| **SM** | `--text-sm` | `--ud-font-size-sm` | `1rem` | **16px** | Standard body text, inputs, navigation links | Phase 7 |
| **BASE** | `--text-base` | `--ud-font-size-base` | `1rem` | **16px** | Standard paragraph text | Phase 7 |
| **LG** | `--text-lg` | `--ud-font-size-lg` | `1.125rem` | **18px** | Lead text, large cards, subheadings | Phase 7 |
| **XL** | `--text-xl` | `--ud-font-size-xl` | `1.25rem` | **20px** | Modal dialog headers, section lead titles | Phase 7 |
| **2XL** | `--text-2xl` | `--ud-font-size-2xl` | `1.5rem` | **24px** | Card titles, small page titles | Phase 7 |
| **3XL** | `--text-3xl` | `--ud-font-size-3xl` | `1.875rem` | **30px** | Major view section titles | Phase 7 |
| **4XL** | `--text-4xl` | `--ud-font-size-4xl` | `2.25rem` | **36px** | Prominent headers, marketing callouts | Phase 7 |
| **5XL** | `--text-5xl` | `--ud-font-size-5xl` | `3rem` | **48px** | Hero headers, display stat figures | Phase 7 |
| **6XL** | `--text-6xl` | `--ud-font-size-6xl` | `3.75rem` | **60px** | Landing display large | Phase 7 |
| **7XL** | `--text-7xl` | `--ud-font-size-7xl` | `4.5rem` | **72px** | Landing display XL | Phase 7 |

#### 3.3.3 Application UI Roles vs. Editorial & Marketing Display Roles
This contract prevents modal dialog titles from inheriting `48px` clamp sizes from bare `h2` elements.

| Semantic Role Type | Canonical Role Token | Value Definition | Role Purpose & Consumer Target |
| :--- | :--- | :--- | :--- |
| **App Dialog Title** | `--ud-type-dialog-title` | `font-size: 1.25rem; font-weight: 600; line-height: 1.25;` | Modal headers, Share dialogs, confirmation dialogs |
| **App Dialog Description** | `--ud-type-dialog-desc` | `font-size: 0.875rem; font-weight: 400; line-height: 1.5; color: var(--ud-color-text-secondary);` | Contextual instructions in modals |
| **App Card Title** | `--ud-type-card-title` | `font-size: 1rem; font-weight: 600; line-height: 1.25;` | Dashboard cards, cohort cards |
| **App Form Label** | `--ud-type-form-label` | `font-size: 0.875rem; font-weight: 500; line-height: 1.4;` | Form inputs, checkboxes, toggles |
| **App Form Helper / Error**| `--ud-type-form-helper` | `font-size: 0.75rem; font-weight: 400; line-height: 1.4;` | Input error messages, field hint text |
| **App Button Text** | `--ud-type-button` | `font-size: 1rem; font-weight: 600; letter-spacing: 0.03em;` | Standard interactive buttons |
| **App Badge Text** | `--ud-type-badge` | `font-size: 0.875rem; font-weight: 600; letter-spacing: 0.03em;` | Status tags, count indicators |
| **Marketing Hero Title** | `--ud-type-hero-title` | `clamp(3.5rem, 8vw, 4.5rem); font-weight: 800; line-height: 1.0;` | Landing page hero headings only |
| **Marketing Section Title** | `--ud-type-section-title` | `clamp(2.25rem, 5vw, 3rem); font-weight: 700; line-height: 1.1;` | Marketing landing section dividers |

---

### 3.4 Spacing Scale

The spacing scale is linear and predictable, based on a 4px/8px grid system.

| Step | Legacy Token | Canonical `--ud-*` Name | Rem Value | Pixel Value | Typical Application Use | Legacy Alias Retirement Gate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 0 | `--space-0` | `--ud-space-0` | `0` | `0px` | Explicit reset | Phase 7 |
| 0.5 | `--space-0_5` | `--ud-space-0-5` (Alias: `--space-0_5`) | `0.125rem` | `2px` | Hairline gaps, micro offsets | Phase 7 |
| 1 | `--space-1` | `--ud-space-1` | `0.25rem` | `4px` | Icon margin, badge padding | Phase 7 |
| 2 | `--space-2` | `--ud-space-2` | `0.5rem` | `8px` | Gap between icon & text, tag padding | Phase 7 |
| 3 | `--space-3` | `--ud-space-3` | `0.75rem` | `12px` | Compact button padding, card padding | Phase 7 |
| 4 | `--space-4` | `--ud-space-4` | `1rem` | `16px` | Standard button padding, form field padding | Phase 7 |
| 5 | `--space-5` | `--ud-space-5` | `1.25rem` | `20px` | Dialog inset, card padding | Phase 7 |
| 6 | `--space-6` | `--ud-space-6` | `1.5rem` | `24px` | Standard dialog padding (`p-6`), section gap | Phase 7 |
| 8 | `--space-8` | `--ud-space-8` | `2rem` | `32px` | Large container gutters | Phase 7 |
| 10 | `--space-10` | `--ud-space-10` | `2.5rem` | `40px` | Header heights, major block gaps | Phase 7 |
| 12 | `--space-12` | `--ud-space-12` | `3rem` | `48px` | Section dividers | Phase 7 |
| 16 | `--space-16` | `--ud-space-16` | `4rem` | `64px` | Page section margins | Phase 7 |
| 20 | `--space-20` | `--ud-space-20` | `5rem` | `80px` | Marketing hero padding | Phase 7 |
| 24 | `--space-24` | `--ud-space-24` | `6rem` | `96px` | Full page section separation | Phase 7 |
| 32 | `--space-32` | `--ud-space-32` | `8rem` | `128px` | Landing page major breaks | Phase 7 |
| 40 | `--space-40` | `--ud-space-40` | `10rem` | `160px` | Editorial spacing | Phase 7 |
| 48 | `--space-48` | `--ud-space-48` | `12rem` | `192px` | Editorial spacing | Phase 7 |
| 56 | `--space-56` | `--ud-space-56` | `14rem` | `224px` | Editorial spacing | Phase 7 |
| 64 | `--space-64` | `--ud-space-64` | `16rem` | `256px` | Editorial spacing | Phase 7 |
| **Mobile** | `--mobile-page-padding` | `--ud-space-mobile-page` | `var(--ud-space-4)` | `16px` | Mobile screen gutter padding | Phase 7 |
| | `--mobile-section-gap` | `--ud-space-mobile-section` | `var(--ud-space-4)` | `16px` | Mobile vertical section stack gap | Phase 7 |
| | `--mobile-card-padding` | `--ud-space-mobile-card` | `var(--ud-space-3)` | `12px` | Compact mobile card interior padding | Phase 7 |

---

### 3.5 Border Radius Tokens

| Radius Step | Legacy Token Name | Canonical `--ud-*` Name | Resolved Value | Semantic Role & Mapping | Legacy Alias Retirement Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **None** | `--radius-none` | `--ud-radius-none` | `0` | Hard edges | Phase 7 |
| **XS** | `--radius-xs` | `--ud-radius-xs` | `0.25rem` (4px) | Checkboxes, tiny tag corners | Phase 7 |
| **SM** | `--radius-sm` | `--ud-radius-sm` | `0.5rem` (8px) | Tooltips, code blocks | Phase 7 |
| **MD** | `--radius-md` | `--ud-radius-md` | `0.75rem` (12px) | Standard form inputs (`--radius-input`) | Phase 7 |
| **LG** | `--radius-lg` | `--ud-radius-lg` | `1rem` (16px) | Standard buttons (`--radius-button`) | Phase 7 |
| **XL** | `--radius-xl` | `--ud-radius-xl` | `1.5rem` (24px) | Cards (`--radius-card`) | Phase 7 |
| **2XL** | `--radius-2xl` | `--ud-radius-2xl` | `2rem` (32px) | Modals / Dialogs (`--radius-modal`) | Phase 7 |
| **3XL** | `--radius-3xl` | `--ud-radius-3xl` | `2.5rem` (40px) | Large hero containers | Phase 7 |
| **Pill** | `--radius-pill` | `--ud-radius-pill` | `999px` | Badges, full pills, status tags | Phase 7 |
| **Full** *(Resolved)* | `--radius-full` | `--ud-radius-pill` | `999px` | Fix for `NotesSaveStatus.module.css:53` | Phase 7 |
| **Circle** | `--radius-circle` | `--ud-radius-circle` | `9999px` | Avatars, round icon buttons | Phase 7 |

---

### 3.6 Elevation & Shadows

| Shadow Token | Legacy Token Name | Canonical `--ud-*` Name | Resolved Value | Semantic Role | Legacy Alias Retirement Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **XS** | `--shadow-xs` | `--ud-shadow-xs` | `0 1px 2px rgb(0 0 0 / 0.04)` | Subtle button border shadow | Phase 7 |
| **SM** | `--shadow-sm` | `--ud-shadow-sm` | `0 2px 4px rgb(0 0 0 / 0.05)` | Low elevation cards, list items | Phase 7 |
| **MD** | `--shadow-md` | `--ud-shadow-md` | `0 8px 24px rgb(0 0 0 / 0.08)` | Default card elevation (`--shadow-card`) | Phase 7 |
| **LG** | `--shadow-lg` | `--ud-shadow-lg` | `0 16px 40px rgb(0 0 0 / 0.1)` | Floating popovers, dropdowns (`--shadow-dropdown`)| Phase 7 |
| **XL** | `--shadow-xl` | `--ud-shadow-xl` | `0 28px 64px rgb(0 0 0 / 0.14)` | Hovered floating cards | Phase 7 |
| **2XL** | `--shadow-2xl` | `--ud-shadow-2xl` | `0 40px 90px rgb(0 0 0 / 0.18)` | Modal dialogs (`--shadow-modal`) | Phase 7 |
| **Brand Glow** | `--shadow-primary` | `--ud-shadow-brand` | `0 20px 60px rgb(var(--ud-color-brand-rgb) / 0.18)` | Primary action glow | Phase 7 |
| **Brand Glow LG**| `--shadow-primary-lg` | `--ud-shadow-brand-lg`| `0 28px 80px rgb(var(--ud-color-brand-rgb) / 0.24)` | Hero CTA glow | Phase 7 |
| **Accent Glow** | `--shadow-momentum` | `--ud-shadow-accent` | `0 20px 60px rgb(var(--ud-color-accent-rgb) / 0.2)` | Streak & progress card glow | Phase 7 |

---

### 3.7 Motion Tokens

| Motion Step | Legacy Token Name | Canonical `--ud-*` Name | Resolved Value | Semantic Usage | Legacy Alias Retirement Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Fast Duration** | `--duration-fast` | `--ud-duration-fast` | `150ms` | Hover states, button clicks, micro-interactions | Phase 7 |
| **Base Duration** | `--duration-base` | `--ud-duration-base` | `250ms` | Dropdown opening, tooltip appearance | Phase 7 |
| **Slow Duration** | `--duration-slow` | `--ud-duration-slow` | `350ms` | Modal dialog enter/exit, sheet slide | Phase 7 |
| **Slower Duration**| `--duration-slower` | `--ud-duration-slower` | `500ms` | Page transitions, complex layout shifts | Phase 7 |
| **Standard Ease** | `--ease-standard` | `--ud-ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Default UI motion curve | Phase 7 |
| **In Ease** | `--ease-in` | `--ud-ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exit animations | Phase 7 |
| **Out Ease** | `--ease-out` | `--ud-ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Entrance animations | Phase 7 |
| **Bounce Ease** | `--ease-bounce` | `--ud-ease-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Delightful springs & pill snaps | Phase 7 |
| **Color Transition**| `--transition-colors` | `--ud-transition-colors` | `color 150ms ease, background-color 150ms ease, border-color 150ms ease` | Standard interactive color transitions | Phase 7 |

---

### 3.8 Z-Index Hierarchy

| Layer Step | Legacy Token Name | Canonical `--ud-*` Name | Numeric Value | Purpose & Ownership | Legacy Alias Retirement Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hide** | `--z-hide` | `--ud-z-hide` | `-1` | Hidden beneath background | Phase 7 |
| **Base** | `--z-base` | `--ud-z-base` | `0` | Normal document flow | Phase 7 |
| **Content** | `--z-content` | `--ud-z-content` | `10` | Elevated cards, relative positioning | Phase 7 |
| **Dropdown** | `--z-dropdown` | `--ud-z-dropdown` | `100` | Select dropdown menus, autocomplete | Phase 7 |
| **Sticky** | `--z-sticky` | `--ud-z-sticky` | `200` | Sticky navigation bars, column headers | Phase 7 |
| **Fixed** | `--z-fixed` | `--ud-z-fixed` | `300` | Bottom mobile nav, floating CTA bars | Phase 7 |
| **Overlay** | `--z-overlay` | `--ud-z-overlay` | `400` | Modal backdrops, drawer scrims | Phase 7 |
| **Modal / Dialog** | `--z-modal` | `--ud-z-dialog` | `500` | Radix Dialog content, Share note modal | Phase 7 |
| **Popover** | `--z-popover` | `--ud-z-popover` | `600` | Popovers rendered outside dialog | Phase 7 |
| **Toast** | `--z-toast` | `--ud-z-toast` | `700` | Toast notifications, alerts | Phase 7 |
| **Tooltip** | `--z-tooltip` | `--ud-z-tooltip` | `800` | Radix Tooltips (must clear modals) | Phase 7 |
| **Max** | `--z-max` | `--ud-z-max` | `9999` | Critical dev tools, drag previews | Phase 7 |

---

### 3.9 Layout & Dimensions

| Layout Dimension | Legacy Token Name | Canonical `--ud-*` Name | Resolved Value | Semantic Role | Legacy Alias Retirement Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Touch Target Min** | `--touch-target-min` | `--ud-touch-target-min` | `44px` | Minimum accessible tap target height/width | Phase 7 |
| **Bottom Nav Height** | `--bottom-nav-height` | `--ud-height-bottom-nav` | `56px` | Mobile bottom navigation bar height | Phase 7 |
| **Safe Area Bottom** | `--safe-area-bottom` | `--ud-safe-area-bottom` | `env(safe-area-inset-bottom, 0px)` | Mobile device chin inset | Phase 7 |
| **Safe Area Top** | `--safe-area-top` | `--ud-safe-area-top` | `env(safe-area-inset-top, 0px)` | Mobile device notch / island inset | Phase 7 |
| **Container XS** | `--container-xs` | `--ud-container-xs` | `36rem` (576px) | Compact form containers | Phase 7 |
| **Container SM** | `--container-sm` | `--ud-container-sm` | `42rem` (672px) | Single column reading view | Phase 7 |
| **Container MD** | `--container-md` | `--ud-container-md` | `48rem` (768px) | Tablet / narrow dashboard | Phase 7 |
| **Container LG** | `--container-lg` | `--ud-container-lg` | `64rem` (1024px) | Standard desktop content container | Phase 7 |
| **Container XL** | `--container-xl` | `--ud-container-xl` | `72rem` (1152px) | Wide dashboard workspace | Phase 7 |
| **Container 2XL** | `--container-2xl` | `--ud-container-2xl` | `80rem` (1280px) | Full workspace layout | Phase 7 |
| **Container Full** | `--container-full` | `--ud-container-full` | `90rem` (1440px) | Maximum viewport constrainer | Phase 7 |

---

## 4. Tailwind v4 `@theme inline` Bridge Specification

To ensure Tailwind utility classes (`bg-surface`, `text-text-primary`, `font-sans`, `p-6`) resolve seamlessly to the canonical `--ud-*` tokens without redefining scales or conflicting with CSS Modules, `src/app/styles/tokens.css` will export the following `@theme inline` block:

```css
@theme inline {
  /* Surfaces and Backgrounds */
  --color-background: var(--ud-color-background);
  --color-background-elevated: var(--ud-color-background-elevated);
  --color-surface: var(--ud-color-surface);
  --color-surface-secondary: var(--ud-color-surface-secondary);
  --color-surface-tertiary: var(--ud-color-surface-tertiary);
  --color-surface-elevated: var(--ud-color-surface-elevated);

  /* Brand and Accent */
  --color-brand: var(--ud-color-brand);
  --color-brand-hover: var(--ud-color-brand-hover);
  --color-brand-soft: var(--ud-color-brand-soft);
  --color-brand-subtle: var(--ud-color-brand-subtle);
  --color-accent: var(--ud-color-accent);
  --color-accent-hover: var(--ud-color-accent-hover);
  --color-accent-soft: var(--ud-color-accent-soft);
  --color-accent-subtle: var(--ud-color-accent-subtle);

  /* Typography / Content Colors */
  --color-text: var(--ud-color-text-primary);
  --color-text-primary: var(--ud-color-text-primary);
  --color-text-secondary: var(--ud-color-text-secondary);
  --color-text-muted: var(--ud-color-text-muted);
  --color-text-disabled: var(--ud-color-text-disabled);
  --color-text-inverse: var(--ud-color-text-inverse);

  /* Borders */
  --color-border: var(--ud-color-border);
  --color-border-hover: var(--ud-color-border-hover);
  --color-border-focus: var(--ud-color-border-focus);
  --color-border-subtle: var(--ud-color-border-subtle);

  /* Feedback Colors */
  --color-success: var(--ud-color-success);
  --color-warning: var(--ud-color-warning);
  --color-error: var(--ud-color-error);
  --color-info: var(--ud-color-info);

  /* Typography Font Families */
  --font-sans: var(--ud-font-sans);
  --font-display: var(--ud-font-display);
  --font-mono: var(--ud-font-mono);
  --font-script: var(--ud-font-script);
  --font-serif-editorial: var(--ud-font-serif-editorial);
  --font-serif-display: var(--ud-font-serif-display);

  /* Radius Aliases */
  --radius-button: var(--ud-radius-button);
  --radius-input: var(--ud-radius-input);
  --radius-card: var(--ud-radius-card);
  --radius-dialog: var(--ud-radius-dialog);
  --radius-pill: var(--ud-radius-pill);
}
```

---

## 5. Runtime, Font & Vendor Exceptions Classification

Not all CSS variables are global design system tokens. The following explicit inventory categorizes runtime, third-party, and feature-scoped variables that must NOT be renamed or deleted:

### 5.1 Next.js Font Generated Variables
Injected at runtime onto `<html className="...">` in `src/app/layout.tsx`:
- `--font-geist-sans`: Next.js font loader for Geist Sans.
- `--font-geist-mono`: Next.js font loader for Geist Mono.
- `--font-manrope-next`: Next.js font loader for Manrope.
- `--font-caveat-next`: Next.js font loader for Caveat.
- `--font-dancing-script-next`: Next.js font loader for Dancing Script.
- `--font-lora`: Next.js font loader for Lora (italic).
- `--font-playfair-display`: Next.js font loader for Playfair Display.

**Resolution Policy:** Canonical `--ud-font-*` families reference these runtime variables with standard system font fallbacks:
```css
--ud-font-sans: var(--font-manrope-next, var(--font-manrope, 'Manrope', system-ui, sans-serif));
--ud-font-script: var(--font-caveat-next, 'Caveat', cursive);
--ud-font-serif-editorial: var(--font-lora, 'Lora', Georgia, serif);
--ud-font-serif-display: var(--font-playfair-display, 'Playfair Display', serif);
```

### 5.2 Dynamic Component Geometry (Inline Styles)
Variables passed dynamically via React `style={{ ... }}` for real-time physics and canvas measurements:
- `--slider-progress`: Passed by `SliderProgressEngine.tsx` for playback scrubber percentages.
- `--fill-percent`: Passed by `SoundRemixModal.module.css` for ambient audio volume levels.
- `--indicator-width`, `--indicator-x`: Passed by `Navbar.tsx` for sliding indicator bar geometry.
- `--floating-scene-width`: Passed by `heroFloatingContentIcons.module.css`.

**Resolution Policy:** Keep as valid component-scoped dynamic properties. Do not alter.

### 5.3 Feature-Scoped Design Subsystems
Certain isolated features have domain-specific semantic palettes:
- **Messaging (`src/client/screens/dashboard/message/**`):**  
  `--message-brand`, `--message-brand-soft`, `--message-text-primary`, `--message-text-secondary`, `--message-text-muted`, `--message-bg`, `--message-bg-secondary`, `--message-bg-elevated`, `--message-border`, `--message-border-strong`, `--message-radius-card`, `--message-radius-control`.
- **Cohort Creation / Builder (`src/client/screens/cohortBuilder/**`):**  
  `--creation-surface`, `--creation-line`, `--creation-heading`, `--creation-muted`, `--creation-border`, `--creation-text`, `--creation-blue-soft`, `--tone`.
- **Publication Success (`PublicationSuccess.module.css`):**  
  `--success-paper`, `--success-ink`, `--success-muted`, `--success-line`.

**Resolution Policy:** These variables are scoped to their respective feature CSS Modules. During Phase 6 route migrations, their root definitions will be mapped to consume underlying `--ud-*` foundations without breaking feature encapsulation.

---

## 6. One-Way Alias Implementation & Zero-Cycles Guarantee

### 6.1 The One-Way Alias Structure
In `src/app/styles/tokens.css`, the implementation follows this exact structure:

```css
:root {
  color-scheme: light;
  accent-color: var(--ud-color-brand);

  /* 1. CANONICAL TOKENS (--ud-*) */
  --ud-color-primitive-indigo-500: #4f46e5;
  --ud-color-brand: var(--ud-color-primitive-indigo-500);
  --ud-color-background: #ffffff;
  --ud-color-surface: #ffffff;
  --ud-color-surface-elevated: #ffffff;
  --ud-color-text-primary: #1f2937;
  --ud-space-4: 1rem;
  --ud-radius-pill: 999px;
  --ud-font-size-sm: 1rem;
  --ud-font-size-xs: 0.875rem;

  /* 2. LEGACY COMPATIBILITY ALIASES (One-Way: Legacy -> Canonical) */
  --color-brand: var(--ud-color-brand);
  --color-background: var(--ud-color-background);
  --color-surface: var(--ud-color-surface);
  --color-surface-elevated: var(--ud-color-surface-elevated);
  --color-text-primary: var(--ud-color-text-primary);
  --color-text: var(--ud-color-text-primary);
  --space-4: var(--ud-space-4);
  --radius-pill: var(--ud-radius-pill);
  --radius-full: var(--ud-radius-pill); /* Resolved missing */
  --text-sm: var(--ud-font-size-sm);
  --text-xs: var(--ud-font-size-xs);
  --font-size-sm: var(--ud-font-size-xs); /* Resolved missing */
}

[data-theme="dark"] {
  color-scheme: dark;

  /* 3. CANONICAL DARK OVERRIDES ONLY */
  --ud-color-background: #000000;
  --ud-color-surface: #000000;
  --ud-color-surface-elevated: #18181b;
  --ud-color-text-primary: #ffffff;
  --ud-color-border: #27272a;
  --ud-color-border-hover: #3f3f46;
  --ud-color-brand-subtle: rgba(79, 70, 229, 0.1);
  --ud-color-brand-soft: rgba(79, 70, 229, 0.2);
  --ud-color-success-bg: rgba(34, 197, 94, 0.15);
  --ud-color-error-bg: rgba(239, 68, 68, 0.15);
  --ud-glass-light: rgba(0, 0, 0, 0.72);
  --ud-glass-medium: rgba(0, 0, 0, 0.82);

  /* NOTE: Legacy aliases automatically evaluate to dark values because
     they reference var(--ud-*) which is re-scoped here. No alias duplication needed! */
}
```

### 6.2 Proof of Non-Cyclic Operation
1. The dependency graph forms a strict Directed Acyclic Graph (DAG):
   ```
   [Legacy Consumer] ──> [Legacy Alias] ──> [Canonical --ud-*] ──> [Primitive / Literal Hex]
   ```
2. No `--ud-*` token references a legacy variable name.
3. Transitive evaluations terminate in at most 2 hops:
   `var(--color-surface)` -> `var(--ud-color-surface)` -> `#ffffff` (light) or `#000000` (dark).

---

## 7. Migration Timeline & Phase 7 Retirement Gate

### 7.1 Lifecycle of a Token
```
[Phase 1]: Formalize Token Map (This Document)
     │
[Phase 2]: Global Precedence Fix (Base layer defaults neutralized)
     │
[Phase 3]: Implement `--ud-*` Canonical Definitions + Legacy Aliases in `tokens.css`
     │
[Phase 4]: Notes Pilot Migration (Migrate Notes components to `--ud-*`)
     │
[Phase 5]: Shared UI Primitive Migration (Button, Dialog, Heading, TextBar to `--ud-*`)
     │
[Phase 6]: Route Waves (Migrate Home, Explore, Cohort, Playback to `--ud-*`)
     │
[Phase 7]: Retirement Gate: Run static audit check. Remove legacy aliases once usage = 0.
```

### 7.2 Retirement Verification Gate (Phase 7 Exit Criteria)
Before any legacy compatibility alias is removed from `tokens.css`:
1. **Automated Search Audit:** Run `node scripts/audit-legacy-tokens.js` across all `src/**/*.module.css` and `src/**/*.tsx`.
2. **Zero Usages:** The script must report `0` active occurrences of the legacy token.
3. **Regression Suite:** Run the Playwright/Cypress end-to-end suite across all light/dark route states.
4. **Approval:** Lead signs off on decommissioning the alias from `src/app/styles/tokens.css`.
