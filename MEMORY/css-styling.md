# Unified CSS Architecture & Design Token Contract

## Authoritative Files & Layout
- Global Stylesheet Entry: [`src/app/globals.css`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/globals.css)
- Canonical Design Tokens: [`src/app/styles/tokens.css`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/styles/tokens.css)
- CSS Reset & Base Constraints: [`src/app/styles/reset.css`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/styles/reset.css)
- Form Controls Baseline: [`src/app/styles/forms.css`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/styles/forms.css)
- Typography Scale & Primitives: [`src/app/styles/typography.css`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/styles/typography.css)
- Layout Grid & Containers: [`src/app/styles/layout.css`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/styles/layout.css)
- Button Base Layer: [`src/app/styles/buttons.css`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/styles/buttons.css)
- Accessibility & Motion Overrides: [`src/app/styles/accessibility.css`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/app/styles/accessibility.css)
- UI Primitives Library: [`src/client/components/ui/`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/components/ui/)
- Route Theme Configuration: [`src/client/config/routeThemeConfig.ts`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/config/routeThemeConfig.ts)

## Cascade Layer Hierarchy
Layer ordering is declared strictly at the top of `globals.css`:
```css
@layer theme, base, vendor, components, utilities, overrides;
```
1. `theme`: Token definitions (`tokens.css` layer(theme)) and Tailwind `@theme inline`.
2. `base`: Global element resets (`reset.css`), typography elements (`typography.css`), form controls (`forms.css`), and layout constraints (`layout.css`). All base rules are strictly enclosed in `@layer base` to allow Tailwind utilities (`p-6`, `bg-zinc-900`) to win over element resets without `!important`.
3. `vendor`: Third-party vendor styling (e.g. Radix, Lucide, CodeMirror, Excalidraw).
4. `components`: Shared composite components and primitive styles (`buttons.css`, UI primitives).
5. `utilities`: Tailwind v4 generated utility classes (`@import 'tailwindcss';`).
6. `overrides`: High-precedence accessibility, `prefers-reduced-motion`, high contrast, and print stylesheets.

## Canonical Design Tokens (`--ud-*`)
All design tokens reside in `src/app/styles/tokens.css` with canonical `--ud-*` namespaces:
- **Primitives:** `--ud-color-primitive-indigo-*`, `--ud-color-primitive-orange-*`, `--ud-color-primitive-cream-*`, `--ud-color-primitive-gray-*`, `--ud-color-primitive-green-*`, `--ud-color-primitive-red-*`, `--ud-color-primitive-blue-*`.
- **Semantic Colors:** `--ud-color-brand`, `--ud-color-brand-subtle`, `--ud-color-background`, `--ud-color-surface`, `--ud-color-surface-elevated`, `--ud-color-surface-hover`, `--ud-color-border-subtle`, `--ud-color-text-primary`, `--ud-color-text-secondary`, `--ud-color-text-muted`, `--ud-color-text-error`.
- **Spacing:** `--ud-space-1` (0.25rem) through `--ud-space-24` (6rem).
- **Radii:** `--ud-radius-none`, `--ud-radius-sm`, `--ud-radius-md`, `--ud-radius-lg`, `--ud-radius-xl`, `--ud-radius-2xl`, `--ud-radius-pill` (`999px`).
- **Typography Scale:** `--ud-font-size-xs` (0.875rem / 14px), `--ud-font-size-sm` (1rem / 16px preserved scale), `--ud-font-size-base` (1.125rem), `--ud-font-size-lg`, `--ud-font-size-xl`, `--ud-font-size-2xl`, `--ud-font-size-3xl`, `--ud-font-size-4xl`.
- **Shadows:** `--ud-shadow-xs`, `--ud-shadow-sm`, `--ud-shadow-md`, `--ud-shadow-lg`, `--ud-shadow-xl`, `--ud-shadow-2xl`.
- **Z-Index:** `--ud-z-base` (0), `--ud-z-dropdown` (1000), `--ud-z-sticky` (1100), `--ud-z-overlay` (1300), `--ud-z-modal` (1400), `--ud-z-popover` (1500), `--ud-z-toast` (1600), `--ud-z-tooltip` (1700).

### Legacy Alias Compatibility Contract
Legacy variable names (e.g. `--color-surface-elevated`, `--radius-full`, `--gray-500`, `--text-sm`) point to canonical tokens via one-way non-cyclic aliases:
`--radius-full: var(--ud-radius-pill);`
Never create reverse aliases or circular dependencies.

## Shared UI Primitives (`src/client/components/ui/`)
- `Button`: Polymorphic (`as="button" | "a"`), supports `primary`, `secondary`, `ghost`, `destructive` (with legacy `danger` alias). Slots `leftIcon`, `rightIcon`, and `loading` spinner with `aria-busy`.
- `Heading`: Heading level 1-6 with `uiRole="ui-title"` for calm modal headers (`1.25rem` / `20px`), `uiRole="display"` for marketing titles, and standard section/card roles.
- `Text`: Variants `body`, `lead`, `error` (`role="alert"`), `hint`, and `caption`.
- `Dialog`: Composite Radix Dialog (`Dialog.Root`, `Content`, `Header`, `Title`, `Description`, `Body`, `Actions`, `Close`) wrapped in `.ud-dialog-portal` ensuring proper theme inheritance.
- `Popover`: Composite Radix Popover (`Popover.Root`, `Trigger`, `Content`, `Arrow`, `Close`) wrapped in `.ud-popover-portal`.
- `Field`: Accessible form controls (`TextField`, `SelectField`, `CheckboxField`, `RadioField`) binding `label`, `hint`, and `error` via `id`, `htmlFor`, and `aria-describedby`.

## Theme Precedence & Portal Encapsulation
1. Route theme overrides are configured in `routeThemeConfig.ts`. Dark routes (e.g. `/notes`, `/cohort/play`) define dark mode surfaces.
2. Radix Dialog and Popover portals rendered into `document.body` MUST be wrapped in `.ud-dialog-portal` or `.ud-popover-portal` or inherit theme attributes so they do not fall back to light mode on dark routes.
3. Checkboxes have isolated dimensions (`width: 1.125rem; height: 1.125rem; padding: 0; shrink-0;`) to prevent text-input line-height and padding bleeding.

## Phantom Tailwind Utility Ban
Tailwind CSS v4 replaces old Tailwind v3 plugins. Phantom classes that emit 0 CSS rules in Tailwind v4 are strictly forbidden:
- Banned: `animate-in`, `fade-in`, `slide-in-from-bottom-*`, `slide-in-from-top-*`.
- Preferred: Native CSS transitions (`transition-opacity duration-200`) or `@keyframes` transitions defined in CSS modules.

## Pruned Dead Selectors (Lean Mean Refactor)
- `Hero.module.css`: Removed dead input card/prompt toolbar classes extracted to `LearningPromptBar`, unreferenced pencil flourishes, and dark mode overrides (-518 lines).
- `CohortBuilder.module.css`: Removed dead turn status controls, connection badges, legacy 2-pane switching, duplicate `.dot` override, unreferenced curriculum cards, and obsolete review elements (-696 lines).
- `Notes.module.css`: Removed dead legacy viewer, search bar duplicates, obsolete workspace tree, space header, and tasks panel (-566 lines), while strictly preserving `.titleInputTop:focus-visible` and `.canvasSwitchControl:focus-within` guarded by cascade regression tests.

## Testing & Verification Commands
- Style & Token Unit Suites: `npx vitest run src/app/styles/__tests__/` (7 files, 98 tests).
- UI Primitives & Components Suite: `npx vitest run src/client/components/ui/__tests__/` (16 tests).
- Route & Shell Integration Suites: `npx vitest run src/app/styles/ src/client/components/ui/ src/client/components/global/ src/client/personal-workspace/ui/ src/client/screens/dashboard/` (81 files, 625 tests passing).
- Production Build: `npm run build` (Prisma code generation, webpack compile, static page generation).
