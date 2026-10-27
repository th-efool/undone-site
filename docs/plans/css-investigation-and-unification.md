# CSS investigation and unification plan

Date: 27 October 2026. Status: investigation and proposed plan only; implementation is not applied.

Execution companion: [multiphase plan with parallel subagent assignments](css-unification/README.md). It expands and supersedes section 6's high-level sequence with task ownership, dependencies, and verification gates.

## 1. Conclusion

The repeated visual failures have concrete causes in the styling architecture. The global stylesheet is linked and active. Its reset, typography, and forms rules are unlayered, while Tailwind v4 utilities are layered. Normal unlayered declarations outrank normal layered declarations, even when the utility selector looks more specific. Components therefore request padding, background colors, and small headings that the browser does not apply.

That is compounded by three competing theme mechanisms, global marketing-sized typography, broad form defaults, inconsistent token vocabularies, and missing CSS Module class definitions. Fixing individual dialogs alone will leave the same failure mode available to every new utility-styled component.

There is no evidence from this investigation that an agent message or prompt is the primary cause. The browser reproduces the failures deterministically from the current CSS. This does not constitute an audit of every design skill or historic generation prompt.

**Recommendation:** keep CSS Modules as the main component styling system, give global CSS a narrow and explicit responsibility, establish one theme/token contract, and migrate by shared primitive and route. Do not replace the app with a new styling framework or rename everything in one pass.

## 2. Scope and evidence quality

Inspected the root CSS loading chain, all shared style files, Notes desktop/share/sync components, theme ownership, shared Button/Typography/TextBar patterns, and Notes editor CSS entry points. A source inventory covered `src/`; package/vendor styles were sampled separately.

| Source inventory | Count |
| --- | ---: |
| CSS files under `src/` | 300 |
| CSS Module files | 290 |
| CSS lines, including comments/blank lines | 51,317 |
| Textual `!important` occurrences | 459 |
| CSS files containing `!important` | 54 |
| TSX files, including tests/archived source | 627 |
| TSX files containing `dark:` | 2 |
| TSX files containing inline `style={...}` | 115 |

These are inventory counts, not 459 independently verified bugs or 115 inappropriate inline styles. Dynamic geometry and editor variables are legitimate inline-style uses.

Browser measurements were made on local `/notes`. Authentication was unavailable in that browser: Notes API requests returned 401, and a feed request returned 503. Those errors are separate from the reproduced CSS defects. The full authenticated workflow and every route were not visually audited.

Three files already had working-tree edits before this investigation: `vault.ts`, `connect-github-modal.tsx`, and `WorkspaceSyncControl.tsx`. Those edits were preserved. The current connection dialog differs from the screenshot, so the report distinguishes shared causes from exact screenshot-era markup.

Temporary corrective edits demonstrated the cascade hypothesis, then were reverted when the request was clarified. Temporary tests were also removed. No application repair is included in this deliverable.

## 3. What actually loads

```text
src/app/layout.tsx
  imports src/app/globals.css
    imports Tailwind v4 via postcss.config.mjs
    scans ../ through @source
    imports styles/tokens.css
    imports styles/reset.css
    imports styles/typography.css
    imports styles/forms.css
    imports styles/layout.css
    imports styles/buttons.css
    imports styles/accessibility.css
    defines additional app/global rules
    imports styles/print.css

route/component TSX
  imports colocated *.module.css

NotesWorkspace -> dynamic CanvasEditorWrapper / KanbanEditorWrapper
  -> @undone/notes-board
  -> Excalidraw/kanban CSS and package overrides
```

Sources: `src/app/layout.tsx`, `src/app/globals.css`, `postcss.config.mjs`, `src/client/screens/dashboard/notes/components/NotesWorkspace.tsx`, `packages/notes-board/src/NotesCanvas/NotesCanvas.tsx`, and `packages/notes-board/src/NotesKanban/NotesKanban.tsx`.

The compiled stylesheet contains both the app's `[data-theme="dark"]` rules and Tailwind's separate OS dark-mode media queries. Utilities such as padding are present: the main problem is precedence, not a missing Tailwind installation or missing root import.

The late print import and duplicate font-loading paths should be normalized, but this investigation did not prove that print CSS fails to load.

## 4. Confirmed failures

### A. Global defaults override component utility intent — high priority

`src/app/globals.css:7` imports reset/typography/forms without a layer. `styles/reset.css` applies `margin: 0; padding: 0` to every element and `background: none; border: 0` to every button. `styles/typography.css` assigns sizes and colors directly to headings and paragraphs. `styles/forms.css` assigns appearance, dimensions, colors, and padding to all inputs/selects.

Tailwind's utility layer loses to these normal unlayered declarations. Adding more utility classes or changing their order in `className` cannot solve that precedence rule.

| Browser probe on `/notes` | Current result | Temporary layered-default experiment |
| --- | --- | --- |
| Panel with `p-6` | 0px padding | 24px padding |
| Heading with `text-sm` | 48px | 16px, the repository's existing `--text-sm` value |
| Button with `px-4 py-2 bg-zinc-900` | 0px padding; transparent background | 8px 16px padding; zinc background |
| Default checkbox | about 36px wide; 16px horizontal padding | about 18.4px wide after explicitly clearing checkbox padding |

This explains the cramped connection form, oversized text, inconsistent buttons, and why a newly generated component can look broken despite apparently sensible classes.

The experimental fixes are reverted. These measurements establish cause, not a shipped solution.

### B. Theme ownership is split — high priority

1. `src/client/config/routeThemeConfig.ts` declares `/notes`, `/play`, `/explore`, `/message`, `/create-cohort`, and `/studyroom` dark.
2. `DashboardShell.tsx:78` writes `data-theme` on a nested shell `div`.
3. `src/client/hooks/useTheme.ts` independently reads local storage, defaults to light, and writes `data-theme` on `document.documentElement`.
4. Tailwind's `dark:` variant currently compiles to `prefers-color-scheme: dark`, not the shell attribute.

Consequences:

- A dark route can contain a white utility-styled dialog when the OS is light.
- Global input tokens can be dark while a surrounding `bg-white dark:...` panel remains white.
- Body portals escape a nested route theme. Examples requiring inspection include CommandPalette, PublicationSuccess, LeaveRoomDialog, and the home cohort card portal. Their actual appearance depends on their own CSS; the scope escape is confirmed, universal visible breakage is not.
- Hooks in creation/landing screens can change the document theme independently of the route shell.
- `tokens.css` sets `color-scheme: light` on `:root` but does not declare the corresponding dark color scheme in its dark scope.

Binding Tailwind to a data attribute is necessary but insufficient. Theme ownership and portals must be resolved together. A simple ancestor-based dark selector also needs care if nested light surfaces are allowed inside dark roots.

### C. Semantic HTML is being used as a global visual preset — high priority

`styles/typography.css` makes every `h2` a section title. `tokens.css:205` defines that role as `clamp(2.25rem, 5vw, 3rem)`. A bare dialog `h2` therefore becomes a marketing-sized title.

The Share dialog at `NotesComponents.tsx:308` is exactly such a heading. This is not only a Tailwind problem: this CSS Module-based dialog never specifies a title class/size at all.

Paragraph rules also assign their own color, font size, and line height. That prevents small contextual text from simply inheriting its component's intended warning/error/help appearance.

Existing `components/ui/Typography/Heading.module.css` already provides explicit display typography. The migration should use explicit roles for visual scale and keep HTML heading levels semantic.

### D. Form defaults leak between control types — high priority

`styles/forms.css` styles all `input` elements as padded text fields. Later checkbox/radio rules change width and height but never clear inherited horizontal padding. Border-box sizing cannot fit an 18px control around 32px of padding plus borders; the measured width expands to 36px.

The file contains two checkbox/radio styling groups, global label/fieldset layouts, input focus suppression escape hatches, and mobile rules applied broadly to inputs. That is a large implicit contract for every component to override correctly.

`data-bare-input` and `data-textbar-input` rules use `!important`, including `outline: none`. Do not remove these blindly: composite fields must retain an accessible visible focus treatment on their owning shell.

### E. Class names are referenced without definitions — confirmed local example

`NotesComponents.tsx` imports `../Notes.module.css` but references six names absent from that module:

- `canvasSwitchTitle` — line 74
- `chevronOpen` and `chevron` — line 106
- `canvasMenuItem` — line 129
- `canvasMenuItemTitle` — line 135
- `checkIcon` — line 138

These can silently produce missing styles or `undefined` in interpolated class strings. This is an actual linking/contract defect at the CSS Module export level, even though the module itself is imported correctly. The full application has not yet been checked for every missing module key.

### F. Token vocabulary has drifted — confirmed examples, broader audit needed

`tokens.css` defines `--text-xs: 0.875rem`, `--text-sm: 1rem`, and `--text-base: 1rem`. Tailwind consumes the same `--text-*` namespace. Thus fixing the cascade does not restore conventional utility sizes: `text-sm` still resolves to 16px here. This may be intentional historically, but it is an undocumented coupling that surprises new code.

Examples of inconsistent token names:

- `NotesSaveStatus.module.css:53` uses `--radius-full` without fallback; the app defines `--radius-pill` instead. No definition of `--radius-full` was found in `src/` or the Notes package source.
- Mobile Home uses `--font-size-sm` and `--font-size-2xl` with literal fallbacks while the main scale is `--text-*`.
- Sidebar components use `--color-surface-elevated` with white fallbacks, while another surface uses the same name with a dark fallback. No definition was found in the searched application/package source.
- TextBar uses component-specific variables and several literal light colors rather than consistently consuming shared semantic surface tokens.

Not every variable missing from raw CSS is broken. Next/font supplies variables at runtime; Tailwind supplies built-in variables; inline styles supply dynamic properties. The migration must classify ownership rather than mechanically replacing every unknown variable.

### G. Some utility class names generate no CSS

The current connection modal uses `animate-in fade-in`; the sync control uses `slide-in-from-bottom-2`. Processing the real `globals.css` with the installed PostCSS/Tailwind pipeline generated none of those selectors. They are not built-in utilities available in this configuration.

This is a separate class-to-style contract failure. It affects the intended animation, not the principal padding/title defects. Do not add an animation dependency just to preserve copied class names; use an existing motion mechanism or a small named animation where warranted.

### H. Fonts have overlapping loading paths

`src/app/layout.tsx` loads Manrope and other fonts through `next/font`; `globals.css` also imports Google Fonts; `styles/buttons.css` contains font-face definitions for Manrope/Caveat despite its filename. The canonical `--font-sans` points to the literal Manrope family through `--font-manrope`, not directly to the generated Next/font Manrope variable.

This is confirmed configuration duplication and ownership confusion. Exact network duplication and layout-shift impact were not measured. Consolidate only after mapping which families are actually used and which files exist.

### I. Escalating overrides and vendor boundaries complicate changes

- Global scrollbars are hidden with `!important`, overriding the scrollbar styling defined in `forms.css`.
- Dashboard shell CSS forces dark backgrounds with `!important`; Notes also has many literal black/dark values and local overrides.
- The app and Notes package have separate, non-identical Slider CSS implementations using the same `agy-` naming family.
- Notes dynamically loads editor/vendor CSS. Most inspected overrides are scoped to editor classes; a `body.sqhq-is-dragging *` rule is intentionally document-wide while dragging. No evidence establishes editor CSS as the primary cause of the supplied dialogs.

Do not purge all `!important`: reduced-motion, forced-colors, print, and vendor workarounds require separate judgment. Likewise, inline styles for measured geometry should remain supported.

### J. Share dialog defects independent of the global architecture

`NotesComponents.tsx:308` contains literal mojibake around the title; related shortcut labels in the same file are corrupted. A font change cannot repair corrupted string bytes.

`Notes.module.css:645` gives the dialog a fixed 420px width, with no viewport constraint. `shareLine` uses flex while both input/select inherit `width: 100%`; the input also has `flex: 1`, producing the squeezed email field. All three action buttons receive the same primary treatment from `.modal button`.

The markup is a plain scrim/div rather than an established dialog primitive: it lacks a dialog role/name contract and a focus-management mechanism in that component. The plan must address responsive layout, labels, focus, Escape handling, and action hierarchy together.

## 5. Proposed CSS contract

### Ownership

| Concern | Owner | Rule |
| --- | --- | --- |
| Palette, semantic colors, spacing/type roles | Shared tokens | One canonical definition and explicit light/dark values |
| Reset | Base layer | Box sizing and neutral defaults; no product visual design |
| Body defaults | Base layer | Font, text, background, sensible inherited behavior |
| Button, field, dialog, popover visual system | Shared UI components + CSS Modules | Explicit variants and states |
| Feature layout | Feature CSS Modules | Colocated; consume shared tokens/primitives |
| Utility styles | Tailwind utilities | Supported, intentional overrides; no assumed plugin classes |
| Editor/vendor adaptation | Dedicated scoped adapter stylesheet | No unrelated page selectors |
| Dynamic geometry/progress | Inline custom properties | Documented component-owned variables |
| Print/accessibility exceptions | Explicit reviewed rules | Preserve user preference behavior |

Do not mix competing CSS Module and utility declarations for the same property without documenting the override contract.

### Class naming

Use existing CSS Modules, not global BEM everywhere. The module filename supplies the namespace:

```text
ShareNoteDialog.tsx
ShareNoteDialog.module.css
  .dialog
  .header
  .title
  .description
  .sharingFields
  .emailField
  .permissionField
  .actions
  .errorMessage
```

- Name classes after the element's role, not a particular color, random suffix, or temporary visual fix.
- Reserve `.root`, `.title`, `.content`, etc. for local modules; those names are safe because CSS Modules scope them.
- Express reusable variants through component props and state through `data-state`, `aria-expanded`, `aria-invalid`, or named local modifiers. Avoid unrelated booleans that produce conflicting styles.
- Reserve an `ud-` prefix for deliberately public global integration classes, such as `.ud-editor-host`; do not expose generic global `.modal`, `.button`, or `.card` APIs.
- Prefer React/module references over `[class*="..."]` styling. Current app-mode selectors matching class substrings should be reviewed for explicit interaction hooks.
- Introduce a module-export verification step so referenced class keys cannot silently disappear. Account for bracket access, conditional keys, composition, and explicit global selectors before making it blocking.
- Keep vendor-owned class names inside adapter files rather than renaming third-party internals.

### Tokens and Tailwind mapping

Adopt a clearly owned application namespace, for example `--ud-color-surface`, `--ud-color-text`, `--ud-color-border`, `--ud-font-body`, and `--ud-type-dialog-title`. Map approved Tailwind semantic aliases to these variables. Keep raw palette values separate from semantic roles.

Example proposed bridge:

```css
@theme inline {
  --color-surface: var(--ud-color-surface);
  --color-content: var(--ud-color-text);
  --font-sans: var(--ud-font-body);
}
```

Retain compatibility aliases during migration; remove them only when a usage inventory reaches zero. Do not globally change `--text-sm` from 16px to 14px without reviewing all consumers. Choose distinct display/editorial and application type roles so dialogs cannot inherit hero typography.

### Cascade layers

Target one explicit order:

```css
@layer theme, base, vendor, components, utilities, overrides;
```

Put neutral reset/element defaults in base, vendor CSS in a managed vendor layer where supported, and component styles in components. Utilities can then intentionally override component defaults. Reserve overrides for documented integrations, not routine development.

**Migration constraint:** existing CSS Modules are unlayered too. Moving only some components into a layer while leaving broad legacy rules outside layers can make precedence worse. First move the dangerous global defaults into base; then migrate component/vendor groups with browser checks. Track and eliminate unexplained unlayered styling by the end. Important declarations reverse layer priority, so audit them separately rather than assuming normal layer ordering applies.

### Theme contract

Preserve the current route theme choices initially. Establish one effective-theme resolver and one provider. Route policy and saved preference must have explicit precedence; separate components must not independently mutate the document theme.

Apply the effective theme where both the page and its overlays receive it. Either maintain the document-level effective theme for the active route or provide a consistently themed portal host. If nested opposite-theme regions are supported, specify their behavior explicitly and test it; otherwise avoid introducing them.

Tie Tailwind dark behavior and native `color-scheme` to that same resolved theme. Verify initial load, client navigation, reload, and body portals—not merely the sidebar background.

## 6. Ordered implementation plan

### Phase 0 — Baseline and migration ledger

Deliverables: authoritative CSS entry-point inventory, theme/portal map, token ownership table, missing-class report, and baseline captures.

Capture `/notes` (share/connect/offline/error/connected states), home, explore, messaging, play, studyroom, creation, and landing at desktop and mobile widths. Include narrow 320px, typical 390px, and desktop widths, keyboard focus, long titles, validation errors, and viewport-height stress cases. Include vendor editors before and after navigation.

Compare current working-tree UI with the screenshot-era implementation separately. Store deterministic fixtures without real credentials or private notes. Treat authentication-dependent coverage as an explicit requirement, not an assumed pass.

Exit: every global stylesheet has an owner/import path; initial route/state matrix and known failures are recorded.

### Phase 1 — Repair global precedence without redesign

Files: `globals.css`, `styles/reset.css`, `styles/typography.css`, `styles/forms.css`, `styles/layout.css`, relevant regression tests.

- Declare layer order and put broad defaults in base.
- Make global headings and paragraphs neutral enough for components to control their visual roles; migrate currently dependent marketing text to explicit typography roles first or in the same change.
- Separate text fields from checkbox/radio/range/file controls; remove duplicated control blocks after reconciling behavior.
- Preserve composite input focus behavior and accessibility exceptions.
- Resolve conflicting scrollbar ownership explicitly rather than retaining two opposite global policies.

Exit: padding, typography, backgrounds, focus, and checkbox probes match their intended computed styles; baseline routes show no unexplained changes. Do not bundle a new palette or font scale into this step.

### Phase 2 — Unify theme and fonts

Files: `routeThemeConfig.ts`, `DashboardShell.tsx`, `useTheme.ts`, `layout.tsx`, `tokens.css`, portal consumers, and global font imports.

- Implement one effective-theme ownership path with documented route/preference precedence.
- Make portal content inherit the correct active theme.
- Bind Tailwind dark mode and native color scheme to the same source.
- Choose one loading path per font family, reusing Next/font where appropriate; remove redundant loading only after checking consumers.

Exit: dark route + light OS and light route + dark OS both work, including portals and reload/navigation. No theme change is caused by mounting an unrelated component.

### Phase 3 — Consolidate tokens and reusable UI

Start with existing Button, Heading/Text, Tooltip, TextBar, and Radix Dialog usage. Inspect their APIs before introducing new wrappers. Fill genuine gaps: a consistently themed dialog/popover surface and form-field contract are likely candidates.

- Add canonical semantic tokens and compatibility aliases.
- Define application heading/body/caption roles separately from marketing display roles.
- Standardize primary/secondary/destructive action treatment, field errors/help, disabled states, focus rings, elevation, radius, and overlay stacking.
- Ensure icons and icon-only controls have consistent sizes and accessible names.

Exit: shared primitive states have a small visual/behavioral fixture set; migrated components stop inventing local copies of these decisions.

### Phase 4 — Notes as the first complete migration slice

Files: `NotesComponents.tsx`, `Notes.module.css`, `NotesDesktop.tsx`, mobile Notes equivalents, `connect-github-modal.tsx`, `sync-status-badge.tsx`, `WorkspaceSyncControl.tsx`, and `NotesSaveStatus.module.css`.

- Give Share its own appropriately named component/module and established dialog behavior.
- Repair corrupted literals, missing module keys, the email/permission layout, viewport sizing, and button hierarchy.
- Move connection/sync presentation onto shared primitives/tokens while preserving existing sync, encryption, recovery, and connection behavior.
- Remove unsupported utility animation classes or replace them with an existing supported animation.
- Audit Canvas/Kanban boundary styles, dynamic CSS loading, and transitions between editors.
- Split the 1,491-line Notes stylesheet only along actual component ownership boundaries; do not arbitrarily split by line count.

Exit: all three supplied screenshot scenarios have verified corrected equivalents, plus keyboard/mobile/error coverage. No credential or persistence changes are required for this CSS migration.

### Phase 5 — Route-by-route adoption

Proceed through shared shell/navigation, home/explore, messaging, studyroom, creation/cohort builder, and playback/editor integrations. Migrate landing/editorial styles as their own visual context. Use actual usage and dependency counts to refine the order.

For each route: inventory dependencies, migrate tokens/classes/primitives, verify responsive and interaction states, remove only proven dead styles, and record remaining exceptions. Keep each route change reviewable and independently reversible.

Large files needing ownership review include `CohortBuilder.module.css` (2,761 lines), `Hero.module.css` (1,769), `UpcomingEvents.module.css` (1,190), and `Play.module.css` (952). Size alone is not proof that splitting improves them.

### Phase 6 — Prevent recurrence

- Check missing CSS Module exports in CI.
- Check application-owned token references with explicit runtime/vendor allowlists.
- Verify emitted utilities used in critical fixtures; do not assume any copied class name exists.
- Add browser computed-style regression cases for cascade/theme/control sizing and visual snapshots for key primitives/routes.
- Restrict new unlayered global selectors, undocumented `!important`, and literal palette values outside approved token/vendor contexts. Start with a baseline so existing debt does not block every unrelated change.
- Scan suspicious mojibake for review; never auto-rewrite legitimate multilingual text.
- Write a concise styling contract and add it to `MEMORY/README.md` only when the new architecture actually ships.

Exit: a new component using the documented patterns cannot silently lose its padding, theme, class exports, or token definitions without a failing check.

## 7. Risks, verification, and completion definition

Changing the cascade deliberately activates utility declarations that have previously been suppressed. That is a cross-route visual change, even if the patch is small. Screens designed around the broken cascade can move. A big-bang rewrite would hide those regressions among cosmetic changes.

Keep infrastructure fixes separate from visual redesign and from backend changes. Roll back by phase/route if a gate fails; avoid restoring a broken global rule as a permanent local workaround.

Required verification:

- Browser computed styles, not only JSDOM/unit tests: spacing, font sizes, colors, borders, dimensions, and light/dark resolution.
- Shared component behavior: focus trapping/restoration, Escape, accessible names, disabled/loading, validation, and clipboard failure handling where applicable.
- Responsive behavior: no clipped dialogs, collapsed form fields, or hidden essential actions at narrow widths/short heights and browser zoom.
- Preference behavior: keyboard focus, reduced motion, forced colors, contrast, and native controls.
- Route navigation and CSS chunk order: direct load and client navigation, including dynamic editors and overlays.
- Existing feature tests remain green; authenticated Notes connection/sync tests must use fixtures or a controlled test environment.

Completion means the agreed route/state matrix is verified, the three screenshots' failure modes are resolved, every shared CSS mechanism has a documented owner, and enforceable naming/token/cascade checks are in place. It does not mean forcing the landing page, canvas editor, and application dashboard to have identical visual density.

## 8. What remains unverified

No complete authenticated visual audit, production build/deployment check, exhaustive dead-selector analysis, all-route token resolution audit, or font network/performance trace was performed. The global inventory and the specific missing-class examples are not a complete list of every styling defect.

The temporary experiment passed 32 focused tests and the browser cascade probes, but those changes/tests were reverted. That result supports the diagnosis only. The application remains in its pre-investigation styling state, with pre-existing user edits preserved.
