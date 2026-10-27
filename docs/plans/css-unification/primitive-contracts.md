# Shared Component Contracts (Phase 1, Task 1.3)

- **Date:** 27 October 2026
- **Status:** Proposed contract frozen for implementation in Phase 4 and Phase 5.
- **Upstream Gate:** Phase 0 completed inventories and confirmed defect analyses in [`docs/plans/css-investigation-and-unification.md`](../css-investigation-and-unification.md).
- **Scope & Ownership:** Defines authoritative component APIs, prop/state contracts, accessibility specifications, and consumer CSS override rules for shared primitives: `Button`, `Typography` (`Heading`, `Text`), `Tooltip`, `TextBar`, `Dialog`, `Popover`, and `Field` (`TextField`, `SelectField`, `CheckboxField`, `RadioField`).

---

## 1. Architectural Principles & Frozen Contracts

These shared primitive contracts are governed by six immutable design and cascade rules:

1. **CSS Modules Own Component Presentation:**
   All shared primitives are styled via colocated CSS Modules using role-based local class names (e.g. `.root`, `.dialog`, `.header`, `.title`, `.actions`, `.field`, `.input`, `.label`, `.error`). Primitives must never emit generic global classes.
2. **Explicit Global Integration Classes Use `ud-` Prefix:**
   Public portal hosts or integration boundaries use strictly namespaced identifiers (e.g. `.ud-dialog-portal`, `.ud-popover-portal`, `.ud-tooltip-portal`). Generic global selectors such as `.modal`, `.button`, or `.card` are strictly prohibited.
3. **Strict Separation of Typography Roles:**
   Application UI typography roles (e.g. modal title `--ud-type-dialog-title`, control label, body UI, table header, caption) are fundamentally separated from marketing/editorial display roles (`--font-hero-size`, `--font-section-title-size`). A semantic `<h2>` inside an application dialog must use the UI title role and **never** inherit the 48px marketing display style.
4. **Minimal Shared API (Anti-Bloat):**
   Avoid speculative abstraction. Every prop, variant, and state must directly serve existing routes and the Notes pilot:
   - `Button`: Variants `primary`, `secondary`, `ghost`, `destructive` + sizes `sm`, `md`, `lg` + loading/disabled/fullWidth states.
   - `Dialog` / `Modal`: Accessible wrapper over `@radix-ui/react-dialog` with theme-inherited portals, title/description slots, responsive viewport bounds, and structured action bar hierarchy.
   - `Popover`: Accessible overlay over `@radix-ui/react-popover` with collision detection, portal theming, and boundary containment.
   - `Field` (`TextField`, `SelectField`, `CheckboxField`, `RadioField`): Explicit control primitives with isolated geometry, clear focus ring, error/hint bindings, and total immunity to global `forms.css` cross-pollution.
   - `Typography`: `Heading` with explicit semantic level and display vs. UI role; `Text` with body, caption, hint, error, and code roles.
5. **Rigorous Accessibility Contracts (WCAG 2.1 AA):**
   Every overlay requires an accessible name (`Dialog.Title`), optional description (`Dialog.Description`), focus trapping and restoration, Escape key dismissal, and viewport-safe scrolling. Form controls must have programmatic label association, `aria-invalid`, and `aria-describedby` bindings.
6. **Explicit Consumer Override Boundary:**
   Callers may only customize layout placement (margins, grid-area, self-alignment, container width). Overriding internal component padding, borders, focus rings, or heading scales via consumer `className` is prohibited. Specificity hacks and `!important` escalations in consumer stylesheets are banned.

---

## 2. Caller Inventories & Subsystem Usage Mapping

### 2.1 Button Caller Inventory

Existing implementation: [`src/client/components/ui/Button/Button.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/components/ui/Button/Button.tsx) and [`Button.module.css`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/components/ui/Button/Button.module.css).

| Caller File | Current Usage / Props | Target Primitive API | Migration Strategy |
| :--- | :--- | :--- | :--- |
| `src/client/components/global/Navbar/Navbar.tsx:97` | `<Button variant="ghost">` | `<Button variant="ghost" size="md">` | Direct match; retain variant. |
| `src/client/components/global/Navbar/Navbar.tsx:99` | `<Button as={Link} href={ctaHref}>` | `<Button as={Link} href={ctaHref} variant="primary" size="md">` | Polymorphic `as={Link}` contract preserved. |
| `src/client/screens/dashboard/createCohort/components/DetailsStep/DetailsStep.tsx:340,407,474` | `<Button type="button" variant="secondary" size="sm" onClick={handleAdd}>` | `<Button type="button" variant="secondary" size="sm">` | Direct match. |
| `src/client/screens/dashboard/createCohort/components/IdentityStep/IdentityStep.tsx:225,256` | `<Button type="button" variant="secondary" size="sm">` | `<Button type="button" variant="secondary" size="sm">` | Direct match. |
| `src/client/screens/dashboard/createCohort/components/ImportWorkspace/ImportWorkspace.tsx:272,276` | `<Button variant="primary" size="sm">`, `<Button variant="secondary" size="sm">` | `<Button variant="primary" size="sm">`, `<Button variant="secondary" size="sm">` | Direct match. |
| `src/client/screens/dashboard/createCohort/components/SourcesStep/SourcesStep.tsx:144,156` | `<Button variant="outline" size="sm">` | `<Button variant="outline" size="sm">` | Retain `outline` as compatibility alias mapping to `secondary` with outline modifier. |
| `src/client/screens/dashboard/createCohort/components/WizardFooter/WizardFooter.tsx:59,72` | `<Button variant="secondary" size="md">`, `<Button variant={primaryVariant} size="md">` | `<Button variant={primaryVariant} size="md">` | `danger` in `primaryVariant` maps to `destructive` via alias. |
| `src/client/screens/dashboard/notes/components/NotesComponents.tsx:332-346` (ShareModal) | 3 raw unclassed `<button>` elements styled by `.modal button` | `<Button variant="primary" size="sm">`, `<Button variant="secondary" size="sm">`, `<Button variant="ghost" size="sm">` | Eliminate `.modal button` global cascade; establish visual action hierarchy. |
| `src/client/personal-workspace/ui/connect-github-modal.tsx:476,622,633` | Raw `<button>` with 25 Tailwind utility classes, inline spinner `<Loader2>` | `<Button variant="primary" size="md" fullWidth loading={...}>`, `<Button variant="secondary" size="sm">`, `<Button variant="primary" size="sm" loading={...}>` | Remove brittle inline Tailwind utility cascades; adopt Button primitive. |
| `src/client/screens/dashboard/notes/components/WorkspaceSyncControl.tsx:228,240` | Raw `<button>` with custom status borders and pulse dot | Specialized trigger buttons retaining domain badges, or `<Button variant="secondary" size="sm">` | Retain domain state badges while standardizing height and focus ring tokens. |

---

### 2.2 Typography (`Heading` & `Text`) Caller Inventory

Existing implementation: [`src/client/components/ui/Typography/Heading.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/components/ui/Typography/Heading.tsx) and [`Text.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/components/ui/Typography/Text.tsx).

| Caller File | Current Usage / HTML | Current Problem | Target Primitive API |
| :--- | :--- | :--- | :--- |
| `src/client/components/global/layout/SectionHeader.tsx:27` | `<Heading level={2}>`, `<Text variant="lead">` | Relies on display heading tokens | `<Heading level={2} role="display">`, `<Text variant="lead">` |
| `src/client/screens/dashboard/createCohort/components/SourcesStep/SourcesStep.tsx:136` | `<Heading level={3}>`, `<Text variant="body">` | Heading size clamp | `<Heading level={3} role="display">`, `<Text variant="body">` |
| `src/client/screens/dashboard/createCohort/CreateCohortDesktop.tsx:56` | `<Text variant="body">` | Text primary color | `<Text variant="body">` |
| `src/client/screens/dashboard/createCohort/components/LaunchStep/LaunchStep.tsx:44` | `<Text variant="body">` | Text secondary color | `<Text variant="body">` |
| `src/client/screens/dashboard/notes/components/NotesComponents.tsx:308` (ShareModal) | Bare `<h2>Share â€œ{note.title}â€ </h2>` | Inherits 48px clamp from `styles/typography.css:53` + mojibake | `<Dialog.Title>` rendering `<h2>` with `role="ui-title"` (`--ud-type-dialog-title`: 1.125rem / 18px font-semibold) |
| `src/client/personal-workspace/ui/connect-github-modal.tsx:294` | `<h2 id="connect-github-title" className="text-base font-semibold">` | Unlayered `typography.css` outranks Tailwind `text-base` | `<Dialog.Title>` rendering `<h2>` with `role="ui-title"` |
| `src/client/personal-workspace/ui/connect-github-modal.tsx:535,575` | `<p id="repo-error" className="text-xs text-rose-600">` | Unlayered `p` styles conflict with error text | `<Text role="error" size="sm">` |
| `src/client/screens/dashboard/play/components/ShortcutsDialog/ShortcutsDialog.tsx:99` | `<h2 id="shortcuts-dialog-title" className={styles.title}>` | Local module override needed to combat `typography.css` | `<Dialog.Title>` |

---

### 2.3 Tooltip Caller Inventory

Existing implementation: [`src/client/components/ui/Tooltip/Tooltip.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/components/ui/Tooltip/Tooltip.tsx) and [`Tooltip.module.css`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/components/ui/Tooltip/Tooltip.module.css).

18 active callers across the repository:
1. `src/client/components/global/SearchBar/SearchBar.tsx:109` (Keyboard shortcut tip)
2. `src/client/components/global/Sidebar/SidebarItem.tsx:78` (Collapsed sidebar item label)
3. `src/client/components/global/StudyRooms/StudyRooms.tsx:82` (Active room occupancy tooltip)
4. `src/client/screens/dashboard/explore/ExploreDesktop.tsx:142` (Topic filters)
5. `src/client/screens/dashboard/explore/components/BrowseTopics/TopicChip.tsx:45` (Chip descriptions)
6. `src/client/screens/dashboard/explore/components/RecentlyPublished/RecentlyPublished.tsx:91` (Timestamp details)
7. `src/client/screens/dashboard/explore/components/TrendingSideQuests/TrendingSideQuests.tsx:112` (Metric details)
8. `src/client/screens/dashboard/home/components/ActiveCohortRow/ActiveCohortRow.tsx:154` (Cohort progress info)
9. `src/client/screens/dashboard/message/components/CommunityChat/components/CommunityHeader/CommunityHeader.tsx:64` (Channel details)
10. `src/client/screens/dashboard/message/components/DMConversation/components/DMHeader/DMHeader.tsx:58` (Direct message details)
11. `src/client/screens/dashboard/message/components/LeftSidebar/SidebarHeader/SidebarHeader.tsx:72` (Compose shortcut)
12. `src/client/screens/dashboard/message/components/MessageComposer/MessageComposer.tsx:185` (Attachment action)
13. `src/client/screens/dashboard/notes/components/NotesComponents.tsx:112` (Canvas tool button hints)
14. `src/client/screens/dashboard/notes/components/NotesWorkspace.tsx:215` (Workspace status tip)
15. `src/client/screens/dashboard/play/components/PlaybackControls/PlaybackControls.tsx:88` (Seek bar timestamp tip)
16. `src/client/screens/dashboard/play/components/PlaybackControls/VolumeControl.tsx:62` (Volume slider tip)
17. `src/client/screens/dashboard/play/components/PlayerToolbar/PlayerToolbar.tsx:95` (Action tooltips)
18. `src/client/screens/dashboard/play/components/PlayerToolbar/components/BookmarkButton.tsx:42` (Bookmark shortcut hint)

**Confirmed Gap:** `Tooltip.tsx:37` mounts `<TooltipPrimitive.Portal>` directly into `document.body` without theme propagation or portal class names. Dark-route tooltips on light OS can render incorrect surface tokens.

---

### 2.4 TextBar Caller Inventory

Existing implementation: [`src/client/components/ui/TextBar/TextBar.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/components/ui/TextBar/TextBar.tsx) and [`TextBar.module.css`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/components/ui/TextBar/TextBar.module.css).

- Primary caller: `src/client/components/global/LearningPromptBar/LearningPromptBar.tsx:120`.
- Target consumers: Notes inline search/filter input, Chat message composer, and Cohort prompt intakes.
- **Confirmed Gap:** Relies on hardcoded escape hatches `data-bare-input="true"` and `data-textbar-input="true"` with `!important` in `styles/forms.css:53` to prevent unlayered padding corruption. Once `forms.css` is layered in Phase 2, TextBar will consume canonical token variables `--ud-color-surface`, `--ud-color-border`, and `--ud-color-text`.

---

### 2.5 Dialog and Popover Inventory (Existing vs Hand-Rolled)

| Component / Screen | Existing Pattern | Accessibility & Focus State | Defect / Failure Mode |
| :--- | :--- | :--- | :--- |
| `LeaveRoomDialog.tsx` | Radix Dialog (`@radix-ui/react-dialog`) + CSS Module | Proper `Dialog.Root`, `Overlay`, `Content`, `Title`, `Description`, custom auto-focus | Good model, but duplicates overlay CSS and lacks theme-aware portal integration. |
| `CommandPalette.tsx` | Radix Dialog + cmdk | Proper `Dialog.Content`, `role="dialog"` | Body portal escapes route theme; white dialog on dark route when OS is light. |
| `PublicationSuccess.tsx` | Radix Dialog + CSS Module | Accessible Radix structure | Custom isolated styling; lacks unified action button hierarchy. |
| `NotesComponents.tsx:294` (`ShareModal`) | Hand-rolled `<div className={styles.scrim}><div className={styles.modal}>` | **Zero ARIA:** No `role="dialog"`, no `aria-labelledby`, no focus trap, no Escape handler | **Screenshot 1 Failure:** 48px heading, squeezed email field, 36px checkbox, identical primary buttons. |
| `connect-github-modal.tsx:281` | Hand-rolled `<div role="dialog" aria-modal="true">` | Custom click-outside, `aria-labelledby`, manual escape | **Screenshot 2 Failure:** 25 utility classes suppressed by `forms.css`, broken public repo checkbox, unsupported animations. |
| `ShortcutsDialog.tsx:93` | Hand-rolled `<div role="dialog" aria-modal="true">` | Manual 40-line `keydown` focus-trap implementation | Homegrown focus-trap code that duplicates Radix capabilities. |
| `sync-status-badge.tsx:367` | Hand-rolled `<div id={popoverId} role="dialog">` | Manual click-outside `useEffect`, absolute positioning | **Screenshot 3 Failure:** Unbounded absolute layout colliding with viewport edge, missing collision detection, unsupported animation. |

---

## 3. Minimal Shared Primitive API Specifications

### 3.1 Button Primitive Contract

```typescript
export type ButtonVariant = 
  | 'primary'      // Brand gradient or primary solid fill, inverted text
  | 'secondary'    // Surface background, border, primary text
  | 'ghost'        // Transparent background, hover tint, brand/secondary text
  | 'destructive'  // Error fill or border, error text / inverted text
  // Deprecated compatibility aliases (strictly mapped during migration):
  | 'danger'       // Aliased to 'destructive'
  | 'outline'      // Aliased to 'secondary'
  | 'momentum';    // Aliased to 'primary'

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xs' | 'xl'; // xs/xl are legacy aliases

export interface ButtonOwnProps<T extends React.ElementType = 'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  iconOnly?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  as?: T;
}

export type ButtonProps<T extends React.ElementType = 'button'> = ButtonOwnProps<T> &
  Omit<React.ComponentPropsWithoutRef<T>, keyof ButtonOwnProps<T>>;
```

#### Prop & State Behavior
- `loading`: Sets `aria-busy="true"`, suppresses click events (`pointer-events: none`), renders an accessible inline `<span className={styles.spinner} aria-hidden="true" />`, preserves button width to avoid layout shift, and keeps text accessible to screen readers.
- `disabled`: When `as="button"`, applies the HTML `disabled` attribute; otherwise sets `aria-disabled="true"`. Lowers opacity to `0.5`, sets `cursor: not-allowed`, removes hover transforms/shadows.
- `size` metrics:
  - `sm`: Height `2rem` (32px), padding-inline `var(--ud-space-3)` (12px), font-size `var(--ud-text-xs)` (12px).
  - `md`: Height `2.5rem` (40px), padding-inline `var(--ud-space-4)` (16px), font-size `var(--ud-text-sm)` (14px).
  - `lg`: Height `2.875rem` (46px), padding-inline `var(--ud-space-5)` (20px), font-size `var(--ud-text-base)` (16px).
  - Minimum touch target on touch viewports (`@media (pointer: coarse)`): `min-height: 44px`.

#### CSS Module Anatomy (`Button.module.css`)
```css
.root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ud-space-2);
  border-radius: var(--ud-radius-button);
  font-family: var(--ud-font-body);
  font-weight: var(--ud-font-medium);
  line-height: 1;
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
}

.root:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--ud-color-surface), 0 0 0 4px var(--ud-color-focus-ring);
}
```

---

### 3.2 Dialog Primitive Contract (Composite)

The `Dialog` primitive wraps `@radix-ui/react-dialog` to enforce accessible names, descriptions, focus containment, and theme-inherited portals.

```typescript
export interface DialogRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';
// sm: 400px (Share modal, Confirm)
// md: 520px (Connect GitHub, Settings)
// lg: 680px (Shortcuts, Cohort preview)
// xl: 840px (Curriculum builder, Full review)

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: DialogSize;
  children: React.ReactNode;
  className?: string;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  onPointerDownOutside?: (event: CustomEvent) => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  showCloseButton?: boolean;
}

export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
  className?: string;
}

export interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
  className?: string;
}

export interface DialogActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  align?: 'end' | 'start' | 'between';
  className?: string;
}
```

#### Anatomy & Composition
```tsx
<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
  <Dialog.Portal theme={currentTheme}>
    <Dialog.Overlay />
    <Dialog.Content size="md">
      <Dialog.Header>
        <Dialog.Title>Connect GitHub</Dialog.Title>
        <Dialog.Description>Manage versioned synchronization</Dialog.Description>
      </Dialog.Header>
      
      <Dialog.Body>
        {/* Form fields / interactive content */}
      </Dialog.Body>
      
      <Dialog.Actions align="end">
        <Button variant="secondary" onClick={() => setIsOpen(false)}>Close</Button>
        <Button variant="primary" type="submit">Save Changes</Button>
      </Dialog.Actions>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

#### Responsive Viewport & Bounds Contract (`Dialog.module.css`)
```css
.portal {
  /* integration class: .ud-dialog-portal */
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: var(--ud-z-overlay, 100);
  background-color: var(--ud-color-scrim, rgba(0, 0, 0, 0.7));
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: udFadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

.content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: var(--ud-z-dialog, 101);
  
  width: calc(100vw - 2rem);
  max-height: calc(100dvh - 3rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  
  background-color: var(--ud-color-surface-elevated);
  color: var(--ud-color-text-primary);
  border: 1px solid var(--ud-color-border);
  border-radius: var(--ud-radius-dialog, 1rem);
  box-shadow: var(--ud-shadow-dialog);
  padding: var(--ud-space-6);
  
  display: flex;
  flex-direction: column;
  gap: var(--ud-space-4);
  animation: udScaleIn 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Width Tiers */
.sm { max-width: 420px; }
.md { max-width: 520px; }
.lg { max-width: 680px; }
.xl { max-width: 840px; }

/* Responsive adjustments for narrow/short viewports */
@media (max-width: 640px) {
  .content {
    width: calc(100vw - 1rem);
    padding: var(--ud-space-4);
    gap: var(--ud-space-3);
  }
}
@media (max-height: 500px) {
  .content {
    top: 0;
    left: 50%;
    transform: translate(-50%, 0);
    max-height: 100dvh;
    border-radius: 0;
  }
}

.title {
  margin: 0;
  font-family: var(--ud-font-body);
  font-size: var(--ud-type-dialog-title, 1.125rem); /* 18px */
  font-weight: var(--ud-font-semibold, 600);
  line-height: 1.35;
  color: var(--ud-color-text-primary);
  letter-spacing: -0.01em;
}

.description {
  margin: 0;
  font-size: var(--ud-text-sm, 0.875rem);
  line-height: 1.5;
  color: var(--ud-color-text-secondary);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--ud-space-3);
  padding-top: var(--ud-space-3);
  border-top: 1px solid var(--ud-color-border-subtle);
}
.actions[data-align="end"] { justify-content: flex-end; }
.actions[data-align="start"] { justify-content: flex-start; }
.actions[data-align="between"] { justify-content: space-between; }
```

---

### 3.3 Popover Primitive Contract (Composite)

The `Popover` primitive wraps `@radix-ui/react-popover` (verified present at v1.1.6) to provide robust anchor calculation, collision detection, and outside-click dismissal.

```typescript
export interface PopoverRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
  children: React.ReactNode;
}

export interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
  collisionPadding?: number;
  className?: string;
  children: React.ReactNode;
}
```

#### Popover Rules & Tokens (`Popover.module.css`)
- Must never overflow viewport edges: `collisionPadding: 12` ensures at least 12px margin from screen boundaries.
- Rendered via `<PopoverPrimitive.Portal>` styled with `.ud-popover-portal`, carrying the active route theme.
- Fixed maximum width: `max-width: min(340px, calc(100vw - 24px))`.
- Focus restoration: Returning focus to trigger on close is automatic via Radix Popover.
- Supported Animations: `slideDownAndFade` (top), `slideUpAndFade` (bottom), `slideLeftAndFade` (right), `slideRightAndFade` (left). Banned classes: `slide-in-from-bottom-2` (unsupported utility).

---

### 3.4 Field / Control Primitives (`TextField`, `SelectField`, `CheckboxField`, `RadioField`)

To permanently eliminate unlayered `forms.css` bleeding between control types, controls are exported as dedicated primitives:

```typescript
export interface FieldBaseProps {
  id?: string;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export interface TextFieldProps extends FieldBaseProps,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'id'> {
  leftAdornment?: React.ReactNode;
  rightAdornment?: React.ReactNode;
  mono?: boolean;
}

export interface SelectFieldProps extends FieldBaseProps,
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  options?: Array<{ label: string; value: string }>;
}

export interface CheckboxFieldProps extends Omit<FieldBaseProps, 'hint'>,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  description?: React.ReactNode;
}
```

#### Geometry Guarantee (`Field.module.css`)
```css
/* Isolated Text Field */
.textFieldWrapper {
  display: flex;
  flex-direction: column;
  gap: var(--ud-space-1-5);
  width: 100%;
}

.inputRoot {
  display: flex;
  align-items: center;
  position: relative;
  width: 100%;
  height: 2.5rem; /* 40px */
  background-color: var(--ud-color-surface);
  border: 1px solid var(--ud-color-border);
  border-radius: var(--ud-radius-input, 0.5rem);
  padding-inline: var(--ud-space-3);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.inputRoot:focus-within {
  border-color: var(--ud-color-focus-border);
  box-shadow: 0 0 0 3px var(--ud-color-focus-ring);
}

.inputRoot[data-invalid="true"] {
  border-color: var(--ud-color-error);
}

.inputField {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  outline: none;
  font-family: var(--ud-font-body);
  font-size: var(--ud-text-sm);
  color: var(--ud-color-text-primary);
}

.inputField[data-mono="true"] {
  font-family: var(--ud-font-mono);
}

/* Guaranteed Checkbox Geometry */
.checkboxContainer {
  display: inline-flex;
  align-items: flex-start;
  gap: var(--ud-space-2-5);
  cursor: pointer;
  user-select: none;
}

.checkboxInput {
  /* Hard reset overriding unlayered forms.css */
  width: 1.125rem !important;  /* 18px */
  height: 1.125rem !important; /* 18px */
  min-width: 1.125rem !important;
  min-height: 1.125rem !important;
  max-width: 1.125rem !important;
  max-height: 1.125rem !important;
  padding: 0 !important;
  margin: 0.125rem 0 0 0 !important;
  border: 1px solid var(--ud-color-border-input) !important;
  border-radius: var(--ud-radius-sm, 0.25rem) !important;
  appearance: auto;
  accent-color: var(--ud-color-brand);
  cursor: pointer;
}

.checkboxInput:focus-visible {
  outline: 2px solid var(--ud-color-focus-ring);
  outline-offset: 2px;
}
```

---

### 3.5 Typography Primitive Contract (`Heading` & `Text`)

```typescript
export type HeadingRole = 'display' | 'ui-title' | 'section-title' | 'card-title';

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  role?: HeadingRole;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div' | 'span';
}

export type TextRole = 'body' | 'lead' | 'caption' | 'error' | 'hint' | 'code';
export type TextSize = 'xs' | 'sm' | 'md' | 'lg';

export interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  role?: TextRole;
  size?: TextSize;
  as?: React.ElementType;
}
```

#### Role Decoupling Contract
- When `role="display"`: Consumes marketing tokens (`--ud-font-hero-size`, `--ud-font-display`).
- When `role="ui-title"`: Consumes application UI tokens (`--ud-type-dialog-title` = 1.125rem / 18px, font-family `--ud-font-body`). A dialog `h2` styled with `role="ui-title"` is guaranteed to render at 18px regardless of global `typography.css`.
- When `Text role="error"`: Color is locked to `--ud-color-error`, font-size defaults to `--ud-text-xs` (12px), line-height `1.4`.

---

### 3.6 Tooltip Refined Contract

```typescript
export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
  className?: string;
}
```
- Content wrapped in `<TooltipPrimitive.Portal className="ud-tooltip-portal">`.
- Colors consume `--ud-color-surface-tooltip`, `--ud-color-text-tooltip`, `--ud-color-border-tooltip`.
- Default delay: 150ms. Screen reader users receive content via standard ARIA description attributes attached by Radix.

---

### 3.7 TextBar Refined Contract

- Shell maintains `:focus-within` container highlight.
- Embedded input / textarea applies `data-bare-input="true"` and `className={styles.input}`.
- Clear button has mandatory `aria-label="Clear text"`.
- Viewport-responsive auto-expanding rows capped at `maxRows` (mobile: 4, tablet: 6, desktop: 8).

---

## 4. Accessibility Contracts (WCAG 2.1 AA)

| Component | ARIA Role & Attributes | Keyboard Navigation | Focus Management | Touch Target |
| :--- | :--- | :--- | :--- | :--- |
| `Button` | `role="button"` (implicit for `<button>`), `aria-busy="true"` during loading, `aria-disabled="true"` when disabled. | `Enter` / `Space` triggers click. | Visual focus ring on `:focus-visible` (2px offset, 2px ring). Never suppress outline without alternative. | `min-height: 44px` on coarse pointers (`@media (pointer: coarse)`). |
| `Dialog` | `role="dialog"`, `aria-modal="true"`, `aria-labelledby="{dialog-id}-title"`, `aria-describedby="{dialog-id}-description"`. | `Escape` closes dialog. `Tab` / `Shift+Tab` trapped within dialog boundary. | On open: auto-focus first focusable element (or `initialFocusRef`). On close: restores focus to triggering element. | Close button `min-height: 44px` touch bounding box. |
| `Popover` | `role="dialog"`, `aria-expanded="true\|false"`, `aria-controls="{popover-id}"`, trigger has `aria-haspopup="dialog"`. | `Escape` closes popover. `Tab` navigates through popover actions. | Focus returned to trigger upon outside click or Escape. | Trigger button satisfies `min-height: 36px` desktop / `44px` mobile. |
| `TextField` | Input has `aria-invalid="true"` when error present, `aria-describedby="{id}-hint {id}-error"`. `<label htmlFor={id}>` mandatory. | Standard text navigation (`Left`, `Right`, `Home`, `End`). | `:focus-within` on outer wrapper. Inner input outline suppressed. | Height 40px desktop / 44px mobile touch target. |
| `CheckboxField` | Native `<input type="checkbox">` wrapped in `<label>`. Optional `aria-describedby`. | `Space` toggles state. | High-contrast focus outline around checkbox box. | Full row / label container clickable (`min-height: 44px` interactive area). |
| `Tooltip` | Trigger has `aria-describedby="{tooltip-id}"` managed automatically by Radix. | Displays on keyboard focus of trigger, dismisses on `Escape`. | Tooltip content never takes focus; pointer-events none. | N/A (non-interactive display). |

---

## 5. Consumer CSS Override Boundary & Rules

To stop the recurring cascade failure loop (where broken global styles provoke utility overrides, which provoke `!important`, which provoke broken modules), the following boundary rules are strictly enforced:

### 5.1 What Consumers MAY Override via `className`
1. **Container Layout & Placement:**
   - External margins (`margin`, `mt-*`, `mb-*`, etc.).
   - Grid positioning (`grid-column`, `grid-row`, `col-span-*`).
   - Flex child positioning (`flex-1`, `shrink-0`, `self-center`).
   - Width / Max-width on container elements where `fullWidth` or container width is explicitly supported.

### 5.2 What Consumers MUST NOT Override
1. **Internal Control Geometry:**
   Callers must not override internal control padding, heights, or line-heights (e.g. adding `p-6` to an input or button).
2. **Focus Rings & Accessibility Borders:**
   Callers must not set `outline: none` or remove `box-shadow` focus rings without providing a compliant `--ud-color-focus-ring` token.
3. **Typography Role Inheritance:**
   Callers must not apply raw heading tags (`<h2>`) inside dialogs or cards expecting them to auto-size; they must use `<Dialog.Title>` or `<Heading role="ui-title">`.
4. **Portal Scrim & Stacking:**
   Callers must not manually assign conflicting `z-index` values (`z-50`, `z-[9999]`) to dialog overlays; all overlay z-indices are governed by canonical tokens (`--ud-z-overlay`, `--ud-z-dialog`, `--ud-z-popover`, `--ud-z-tooltip`).

### 5.3 Prohibited Escalation Techniques
- **Banned:** `!important` declarations in consumer CSS Modules or inline styles (except legitimate system preferences such as `@media (prefers-reduced-motion)`).
- **Banned:** High-specificity selectors (e.g. `.modal > div > div > button.primary`, `#app .content button`).
- **Banned:** Copying unverified animation utility classes (e.g. `animate-in`, `fade-in`, `slide-in-from-bottom-2`) without compiling and verifying their presence in the CSS bundle.

---

## 6. Concrete Mapping of the 3 Screenshot Failures

### 6.1 Screenshot 1: Share Note Dialog Failure

- **Current Implementation:** [`src/client/screens/dashboard/notes/components/NotesComponents.tsx:294-349`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/dashboard/notes/components/NotesComponents.tsx#L294-L349) and [`Notes.module.css:645-710`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/dashboard/notes/Notes.module.css).

```text
[Failure 1]: Literal mojibake in title: <h2>Share â€œ{note.title}â€ </h2>
[Failure 2]: Giant 48px heading caused by unlayered styles/typography.css:53 on bare h2
[Failure 3]: Fixed 420px width without viewport bounds, overflowing on small screens
[Failure 4]: Squeezed email input next to permission select (both width: 100%, flex: 1)
[Failure 5]: Checkbox width expanding to 36px due to unlayered forms.css text padding
[Failure 6]: All 3 action buttons styled identically as solid primary by .modal button
[Failure 7]: Zero accessibility (no role="dialog", no aria-modal, no focus trap, no Escape)
```

#### Target Primitive Solution: `ShareNoteDialog.tsx`
```tsx
import React, { useState } from 'react';
import { Dialog, Button, TextField, SelectField, CheckboxField } from '@/src/client/components/ui';
import styles from './ShareNoteDialog.module.css';

export function ShareNoteDialog({ note, open, onClose, onSave }) {
  const [email, setEmail] = useState('');

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content size="sm" className={styles.dialog}>
          <Dialog.Header>
            <Dialog.Title>Share &ldquo;{note.title}&rdquo;</Dialog.Title>
            <Dialog.Description>Manage public access and invite collaborators.</Dialog.Description>
          </Dialog.Header>

          <div className={styles.body}>
            <CheckboxField
              id="share-public-link"
              label="Public link"
              checked={Boolean(note.publicLink && String(note.publicLink) !== 'false')}
              onChange={(e) => onSave({ publicLink: e.target.checked })}
            />

            <div className={styles.shareLine}>
              <TextField
                id="share-email"
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.emailInput}
              />
              <SelectField
                id="share-permission"
                value={note.permission}
                onChange={(e) => onSave({ permission: e.target.value })}
                options={[
                  { label: 'viewer', value: 'viewer' },
                  { label: 'editor', value: 'editor' },
                  { label: 'owner', value: 'owner' },
                ]}
                className={styles.permissionSelect}
              />
            </div>
          </div>

          <Dialog.Actions align="between">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigator.clipboard?.writeText(`${location.origin}/notes/${note.id}`)}
            >
              Copy Link
            </Button>
            <div className={styles.rightActions}>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Done
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!email}
                onClick={() => {
                  if (email) onSave({ shared: true, sharedWith: [...note.sharedWith, email] });
                  setEmail('');
                }}
              >
                Share
              </Button>
            </div>
          </Dialog.Actions>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

#### Stylesheet Solution (`ShareNoteDialog.module.css`)
```css
.dialog {
  /* Inherits size="sm" max-width 420px, responsive calc(100vw - 2rem) */
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--ud-space-4);
  padding-block: var(--ud-space-2);
}

.shareLine {
  display: flex;
  align-items: center;
  gap: var(--ud-space-2);
  width: 100%;
}

.emailInput {
  flex: 1;
  min-width: 0;
}

.permissionSelect {
  width: 105px;
  flex-shrink: 0;
}

.rightActions {
  display: flex;
  align-items: center;
  gap: var(--ud-space-2);
}
```

---

### 6.2 Screenshot 2: Connect GitHub Modal Failure

- **Current Implementation:** [`src/client/personal-workspace/ui/connect-github-modal.tsx:281-650`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/personal-workspace/ui/connect-github-modal.tsx#L281-L650).

```text
[Failure 1]: Input fields visually cramped because unlayered forms.css padding overrides Tailwind utilities
[Failure 2]: Checkbox padding causes 36px wide box, misaligning the public repo warning
[Failure 3]: Body portal / overlay escapes route theme; renders white card on dark route under light OS
[Failure 4]: Buttons use brittle, repetitive 25-class utility lists
[Failure 5]: Unsupported Tailwind utilities: animate-in fade-in generate zero CSS
```

#### Target Primitive Solution: Refactored `ConnectGitHubModal`
1. **Outer Shell:** Replace hand-rolled fixed `div` with `<Dialog.Root>`, `<Dialog.Portal theme={routeTheme}>`, `<Dialog.Overlay>`, and `<Dialog.Content size="md">`.
2. **Title & Header:** Use `<Dialog.Header>` and `<Dialog.Title>Connect GitHub</Dialog.Title>`. Guarantees 18px font size without competing with `typography.css`.
3. **Form Fields:**
   - Repository input: `<TextField id="repo-name" label="Repository Name" mono placeholder="username/undone-notes" ... />`.
   - Token input: `<TextField id="github-token" label="Personal Access Token" type="password" ... />`.
   - Public repo checkbox: `<CheckboxField id="allow-public-repo" label="Allow Public Repository" ... />`.
4. **Action Hierarchy:**
   - 1-Click OAuth button: `<Button variant="primary" size="md" fullWidth loading={isOAuthLoading} leftIcon={<Github />}>`.
   - Close button: `<Button variant="secondary" size="sm" onClick={onClose}>Close</Button>`.
   - Connect submit: `<Button variant="primary" size="sm" type="submit" loading={isLoading}>Connect Repository</Button>`.
   - Disconnect (in connected view): `<Button variant="destructive" size="sm">Disconnect Repository</Button>`.
5. **Animation:** Removed non-existent `animate-in fade-in` classes; primitive automatically utilizes verified `udFadeIn` and `udScaleIn` keyframes.

---

### 6.3 Screenshot 3: Workspace Sync Control Popover Failure

- **Current Implementation:** [`src/client/screens/dashboard/notes/components/WorkspaceSyncControl.tsx`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/screens/dashboard/notes/components/WorkspaceSyncControl.tsx) and [`src/client/personal-workspace/ui/sync-status-badge.tsx:367-450`](file:///d:/ThisPC/Documents/SideQuestHQ/undone-site/src/client/personal-workspace/ui/sync-status-badge.tsx#L367-L450).

```text
[Failure 1]: Ad-hoc absolute div popover overflows viewport boundary on narrow screens
[Failure 2]: Inconsistent theme inheritance; popover surface clashes with dark Notes route
[Failure 3]: Unsupported animation class slide-in-from-bottom-2 generates no CSS
[Failure 4]: 40 lines of boilerplate click-outside and Escape event listeners in component
```

#### Target Primitive Solution: Refactored `SyncStatusBadge` Popover
1. **Trigger & Anchor:** Wrap the status badge trigger in `<Popover.Root open={isOpen} onOpenChange={setIsOpen}>` with `<Popover.Trigger asChild>`.
2. **Content Container:** Render details via `<Popover.Portal theme={activeRouteTheme}>` and `<Popover.Content side="bottom" align="end" sideOffset={6} collisionPadding={12}>`.
3. **Collision Avoidance:** Radix Popover dynamically flips to `side="top"` or adjusts `align="start"` if near viewport edges, completely eliminating offscreen clipping.
4. **Clean Hierarchy:**
   - Header with status icon and dismiss `<Popover.Close>`.
   - Sync metrics and last synced timestamp formatted cleanly.
   - Action buttons: `<Button variant="destructive" size="xs">Export Backup</Button>`, `<Button variant="secondary" size="xs">Reconnect</Button>`.
5. **Zero Boilerplate:** Remove manual `handleClickOutside` and `handleKeyDown` event listeners; Radix Popover manages focus return and outside dismissal natively.

---

## 7. Migration Ledger & Implementation Roadmap (Phases 4–5)

| Step | Target Primitive | Target File / Location | Dependencies & Gates |
| :--- | :--- | :--- | :--- |
| **4.1** | `Button` | `src/client/components/ui/Button/` | Harmonize variants (`primary`, `secondary`, `ghost`, `destructive`), aliases (`danger`, `outline`), and focus ring tokens. |
| **4.2** | `Field` Family | `src/client/components/ui/Field/` (`TextField`, `SelectField`, `CheckboxField`, `RadioField`) | Layer-isolated control geometry; verify 18px checkbox geometry test. |
| **4.3** | `Dialog` Primitive | `src/client/components/ui/Dialog/` | Wrap `@radix-ui/react-dialog` with theme-aware portal and responsive size tiers. |
| **4.4** | `Popover` Primitive | `src/client/components/ui/Popover/` | Wrap `@radix-ui/react-popover` with collision boundary and portal theme inheritance. |
| **4.5** | `Typography` Primitives | `src/client/components/ui/Typography/` (`Heading`, `Text`) | Formalize `role="ui-title"` vs `role="display"`; lock error/hint text roles. |
| **5.1** | Share Dialog Extraction | `src/client/screens/dashboard/notes/components/ShareNoteDialog.tsx` | Extract from `NotesComponents.tsx`, apply `Dialog` + `Field` + `Button`, fix UTF-8 mojibake. |
| **5.2** | Connect Modal Migration | `src/client/personal-workspace/ui/connect-github-modal.tsx` | Adopt `Dialog` + `Field` + `Button`; preserve existing OAuth, PAT, and database vault logic. |
| **5.3** | Sync Popover Migration | `src/client/personal-workspace/ui/sync-status-badge.tsx` | Adopt `Popover` primitive; remove ad-hoc `useEffect` listeners and dead animation utilities. |

---

## 8. Verification & Gate Check Requirements

### 8.1 Automated Unit & Integration Tests
1. **Button Matrix Test:** Test all combinations of variant (`primary`, `secondary`, `ghost`, `destructive`, `danger`, `outline`), size (`sm`, `md`, `lg`), `loading` (spinner visible, `aria-busy="true"`), and `disabled` (`aria-disabled="true"`).
2. **Dialog Accessibility Test:** Verify rendered dialog has `role="dialog"`, `aria-modal="true"`, `aria-labelledby` referencing `Dialog.Title`, and traps focus. Verify `Escape` triggers `onClose`.
3. **Checkbox Geometry Test:** Measure computed width/height in browser; assert exactly 18px x 18px with 0px internal padding.
4. **Typography Role Test:** Assert `<Heading role="ui-title">` computes to 18px (`--ud-type-dialog-title`) and does **not** inherit 48px from global `typography.css`.
5. **Popover Collision Test:** Mount trigger near viewport right edge (e.g. `x: 375px`); assert popover content shifts left or aligns safely within viewport.

### 8.2 Browser Cascade & Snapshot Assertions
- Authenticated and unauthenticated Notes route renders the 3 target components with zero unlayered style leaks.
- Contrast ratio between text and surface tokens exceeds 4.5:1 in both light and dark themes.
- No horizontal scrollbars triggered on 320px viewport width.
- No `!important` escalation present in newly introduced component modules.
