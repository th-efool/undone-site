# Theme and Cascade Contract (Phase 1 Frozen Specification)

Status: Frozen contract for Phase 1.
Date: 27 October 2026.
Owners: Lead (Integration, Architecture, Theme Precedence, Cascade Layers).

---

## 1. Cascade Layer Architecture

### 1.1 Layer Declaration Order
The global cascade is governed by an explicit `@layer` declaration at the top of the root stylesheet (`src/app/globals.css`):

```css
@layer theme, base, vendor, components, utilities, overrides;
```

This strict declaration guarantees that normal declarations in downstream layers outrank upstream layers, and that utilities intentionally outrank base and component declarations without requiring `!important`.

### 1.2 Responsibilities by Layer

| Layer | Purpose | Allowed Rules & Selectors | Forbidden Rules |
| :--- | :--- | :--- | :--- |
| **`theme`** | Design tokens, color schemes, theme variants | `:root`, `[data-theme="dark"]`, CSS variable definitions, `@theme inline`, `@variant dark` | Direct visual element styling (padding, margin, font-size on elements) |
| **`base`** | Universal reset & neutral browser normalization | Box-sizing, margin/padding resets on `*`, font inheritance, neutral native control baseline | Product visual designs, 48px headings, marketing typography, text-input padding on checkboxes |
| **`vendor`** | Third-party stylesheets and package adapters | `@undone/notes-board`, Excalidraw, Radix, vendor chunks | Unscoped global selectors affecting app components outside vendor roots |
| **`components`** | Reusable UI and CSS Modules | Shared primitives (`Button`, `Dialog`, `TextBar`), colocated `*.module.css` | Unlayered global selectors, broad tag selectors (`button`, `input`) |
| **`utilities`** | Intentional functional utility overrides | Tailwind v4 utilities (`p-6`, `flex`, `text-sm`, `bg-zinc-900`, `gap-2`) | Broad element selectors; implicit compound overrides |
| **`overrides`** | Documented accessibility & platform exceptions | `@media (prefers-reduced-motion)`, `@media (forced-colors)`, `@media print`, drag-lock helpers | Routine development overrides, unreviewed `!important` escalations |

### 1.3 Anti-Escalation & Specificity Invariants
1. **No Specificity Arms Race**: Feature CSS Modules and route components MUST NOT use `!important` or high-specificity hacks (e.g. `body div.modal button.btn`) to override base resets or global forms. If a base rule creates an unwanted style, that base rule must be neutralized in the `base` layer.
2. **Utilities are Intentional Overrides**: When a component specifies `className="p-6"`, the `utilities` layer outranks the `base` reset and component default padding.
3. **Legacy Unlayered Tracking**: Any existing CSS file that has not yet been assigned to a layer during Phases 2–6 is tracked in `.tmp/css-unification/unlayered-legacy-inventory.json`. Normal unlayered declarations outrank layered declarations in CSS; therefore, neutralizing global defaults into `@layer base` in Phase 2 removes the conflict immediately.

---

## 2. Theme Precedence and Propagation Contract

### 2.1 Precedence Hierarchy
Theme resolution follows a strict three-tier precedence:

```
[1. Route Theme Policy] (Highest Priority - Forced Route Theme)
         │ (if route is not explicitly mapped in ROUTE_THEME_CONFIG)
         ▼
[2. User Saved Preference] (localStorage: 'undone_theme' -> 'dark' | 'light')
         │ (if no preference is stored in localStorage)
         ▼
[3. System Preference] (window.matchMedia('(prefers-color-scheme: dark)') -> 'dark' | 'light')
```

### 2.2 Route Theme Policy (Deterministic Routes)
As codified in `src/client/config/routeThemeConfig.ts`:
- The following routes are strictly **Dark Mode** surfaces:
  - `/notes`
  - `/play`
  - `/explore`
  - `/message`
  - `/create-cohort`
  - `/studyroom`
- When navigating to any of these routes, the effective theme MUST resolve to `'dark'` unconditionally, ignoring OS light preference and global default preference.
- All child routes, nested views, and overlays within these routes inherit `'dark'`.

### 2.3 Single Source of Truth for DOM Propagation
1. **Document Root Ownership**:
   - The effective theme is written exclusively to the root element:
     ```html
     <html data-theme="dark" style="color-scheme: dark;">
     ```
   - `document.documentElement.setAttribute('data-theme', effectiveTheme);`
   - `document.documentElement.style.colorScheme = effectiveTheme;`
2. **DashboardShell Contract**:
   - `DashboardShell` MUST NOT maintain an independent conflicting theme state. It reads the unified route/preference resolver and reflects the effective theme on `data-theme`.
3. **Portal Theming Contract**:
   - Radix Dialogs, Tooltips, Popovers, and CommandPalette render into the DOM body outside the route DOM subtree.
   - Because `data-theme` and `color-scheme` are set on `<html>`, all body-level portals naturally inherit the effective theme.
   - For additional encapsulation against third-party styles, portals use a dedicated wrapper:
     ```html
     <div id="ud-portal-root" data-theme="[effectiveTheme]">
     ```

### 2.4 Tailwind v4 Dark Variant Binding
In `src/app/globals.css`, Tailwind v4's dark variant is explicitly bound to `data-theme="dark"`, overriding the default OS media-query behavior:

```css
@variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

This guarantees that:
- A user on Light OS visiting `/notes` receives dark styling for all `dark:...` utility classes.
- A user on Dark OS visiting a light route does not see unintended inverted dark utilities.

### 2.5 Nested Theme Boundary Contract
If an isolated component or card within a dark route requires a light surface (or vice versa):
1. The container element must explicitly set `data-theme="light"` and `style="color-scheme: light;"`.
2. The container must explicitly bind surface and text tokens:
   ```css
   background-color: var(--ud-color-surface);
   color: var(--ud-color-text-primary);
   ```
3. Ancestor selectors like `[data-theme="dark"] .nested` must not bleed dark colors into an explicitly light child without checking the boundary.

---

## 3. Typography Separation Contract

### 3.1 Application UI vs. Editorial/Marketing Display
Global element selectors (`h1`, `h2`, `h3`, `p`) in `src/app/styles/typography.css` must NOT impose marketing/hero visual designs on application components:

- **Editorial / Marketing Roles**:
  - Hero headers, landing page sections, blog titles.
  - Handled via explicit classes or `<Heading variant="display-lg">`, `<Heading variant="section">`.
- **Application UI Roles**:
  - Dialog titles, popover headers, form labels, card headings, breadcrumbs.
  - Bound to `--ud-font-size-ui-*` and semantic roles (`--ud-type-dialog-title: 1.25rem`, `--ud-type-card-title: 1rem`).
  - An `<h2>` inside a modal dialog must NOT inherit `clamp(2.25rem, 5vw, 3rem)`. In the `base` layer, bare heading tags retain semantic hierarchy with neutral, proportional sizes; components specify their exact UI title role via local CSS Modules.

---

## 4. Public Integration Prefix & Module Isolation Contract

1. **Global Integration Classes**:
   - All shared global integration hooks use the `ud-` prefix:
     - `#ud-portal-root`: The global modal/popover container.
     - `.ud-editor-host`: Bounded container for embedded canvas/kanban editors.
     - `.ud-focus-visible`: Standardized focus ring indicator.
   - Generic global classes like `.modal`, `.button`, `.card`, `.title` are strictly prohibited in global stylesheets.
2. **CSS Module Scoping**:
   - Component presentation belongs exclusively in colocated `*.module.css` files.
   - Class names within modules represent semantic element roles: `.dialog`, `.header`, `.title`, `.description`, `.actions`, `.closeButton`.
   - Modifiers represent states: `[data-state="open"]`, `[aria-invalid="true"]`, `.isPending`, `.hasError`.

---

## 5. Verification Checklist for Gate P1 Integration

- [x] Layer declaration order explicitly defined: `theme, base, vendor, components, utilities, overrides`.
- [x] Route theme precedence and resolver hierarchy frozen.
- [x] Document root and portal host ownership unified.
- [x] Tailwind v4 dark variant explicitly mapped to `[data-theme="dark"]`.
- [x] Application UI typography cleanly separated from marketing display typography.
- [x] Public integration namespace isolated to `ud-` prefix.
