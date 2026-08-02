# SideQuestHQ — UX Phased Implementation Plan

> **Generated:** 2026-08-02  
> **Source Audit:** [UX_IMPROVEMENT_AUDIT.md](./UX_IMPROVEMENT_AUDIT.md) (123 items)  
> **Total Effort:** ~25–35 developer-days across 5 phases  
> **Team Assumption:** 2 developers for Phases 1–4, solo for Phase 0

---

## Table of Contents

1. [Dependency Map](#dependency-map)
2. [Phase 0 — Foundation & Cleanup](#phase-0--foundation--cleanup)
3. [Phase 1 — Critical UX Fixes](#phase-1--critical-ux-fixes)
4. [Phase 2 — Core UX Polish](#phase-2--core-ux-polish)
5. [Phase 3 — Advanced Features](#phase-3--advanced-features)
6. [Phase 4 — Strategic Long-Term](#phase-4--strategic-long-term)
7. [Quick Reference: Items by Phase](#quick-reference-items-by-phase)

---

## Dependency Map

```
Phase 0 (Foundation & Cleanup)
  ├── MUST COMPLETE before all other phases
  └── Unblocks: Phase 1 items #62, #84, #97, #102, #105, #106, #108

Phase 1 (Critical UX Fixes)
  ├── Depends on: Phase 0
  ├── MUST COMPLETE before Phase 2 card/unification work
  └── Unblocks: Phase 2 items #38, #40, #41, #55, #60, #67

Phase 2 (Core UX Polish)
  ├── Depends on: Phase 1
  └── Unlocks: Phase 3 command palette expansion (#114, #115)

Phase 3 (Advanced Features)
  ├── Depends on: Phase 2
  └── Unlocks: Phase 4 analytics framework (#101, #116)

Phase 4 (Strategic Long-Term)
  ├── Depends on: Phase 3 for analytics foundation
  └── Can overlap with future feature sprints
```

**Key Rule:** Items marked **High** priority in the audit MUST be in Phase 1 or Phase 0. Never defer High-priority items to later phases without explicit sign-off.

---

## Phase 0 — Foundation & Cleanup

| Duration | Day 1–2 (solo) |
|----------|-----------------|
| Items    | #6, #8, #14, #118–#123 + Toast/Skeleton scaffolds |
| Theme    | Dead code removal, scaffolding for later phases |

### Why This Phase First?

Before fixing UX problems, we need a clean codebase and reusable UI primitives. Every subsequent phase will build on the `Toast` and `Skeleton` components created here. Removing dead code reduces merge conflicts during parallel work in Phase 1.

---

### Task 0.1 — Remove Dead Code (#8, #118–#120)

**Audit Items:** #8 (HeroTicker unused), #118 (HeroTicker file), #119 (Problem/Community stubs), #120 (commented ContinueExploring)

**Files to Edit/Delete:**
- `app/(landing)/components/Hero.tsx` — remove `HeroTicker` import and any reference
- Delete `app/(landing)/components/HeroTicker.tsx`
- Delete `app/(landing)/components/Problem.tsx` (if exists as stub)
- Delete `app/(landing)/components/Community.tsx` (if exists as stub)
- `app/(explore)/page.tsx` — remove commented-out `<ContinueExploring />` block

**Steps:**
1. Search for all references to `HeroTicker`, `Problem`, `Community`, `ContinueExploring` across the codebase
2. Verify each component is truly unused (grep imports, check JSX)
3. Remove file references from `Hero.tsx` and `page.tsx`
4. Delete the dead files
5. Run `next build` to confirm no broken imports

**Acceptance Criteria:**
- [ ] Zero references to `HeroTicker`, `Problem`, `Community`, or `ContinueExploring` remain in the codebase
- [ ] `npm run build` passes with zero errors/warnings about missing modules
- [ ] Landing page renders identically (visually) to before — these components were not rendering anything

**Effort:** 1 hour  
**Assignee:** Any dev (no dependencies on other work)

---

### Task 0.2 — Fix Misleading Affordance (#6, #14)

**Audit Items:** #6 (Landing logo dead link), #14 ("See How It Works" button is a dead link with play icon)

**Files to Edit:**
- `app/(landing)/components/Hero.tsx` — locate the "See How It Works" button and the logo `<a>` tag
- If creating a demo: consider adding a modal or section scroll target

**Steps:**
1. For the logo (`<a href="/">`) — change to link to `/auth` OR add a dropdown with "Features", "Pricing", etc.
2. For "See How It Works" button:
   - **Option A (recommended):** Wire it to scroll to an interactive demo section below the fold, or open a mini-player modal
   - **Option B (quick fix):** Remove the button entirely if no demo exists yet — delete from JSX and any associated CSS
3. Test both on desktop and mobile

**Acceptance Criteria:**
- [ ] Logo click navigates to `/auth` (or scrolls to hero content), not a no-op page refresh
- [ ] "See How It Works" button either opens a working demo/scrolls OR is removed entirely — zero dead links
- [ ] No console errors or 404 navigation warnings

**Effort:** 1 hour  
**Dependencies:** None

---

### Task 0.3 — Remove Hardcoded Mock Data (#122)

**Audit Item:** #122 ("Good evening, Shaqun" hardcoded greeting)

**Files to Edit:**
- `app/(dashboard)/components/HomeHero.tsx` or wherever the greeting is rendered
- `app/(explore)/components/ExploreHero.tsx` (or wherever it appears on explore)

**Steps:**
1. Locate all occurrences of `"Shaqun"` in string literals across the codebase
2. Replace with dynamic user data: `{user?.firstName ?? "there"}` or similar fallback pattern
3. If no `user` context exists yet, create a simple one using existing auth session (from NextAuth or whatever auth system is used)

**Acceptance Criteria:**
- [ ] No hardcoded names like "Shaqun", "Aarav", etc. remain in greeting strings
- [ ] Logged-out users see neutral fallback: "Hello there" or "Welcome back"
- [ ] Logged-in users see their actual first name (or a friendly fallback)
- [ ] TypeScript types are updated if user shape changed

**Effort:** 30 minutes  
**Dependencies:** None

---

### Task 0.4 — Remove Dead-End Alerts (#123)

**Audit Item:** #123 (`coming()` function showing `alert('Coming Soon')`)

**Files to Edit:**
- Search for `coming()` or `alert('Coming Soon')` across the codebase
- Likely in Notes feature bottom toolbar buttons

**Steps:**
1. Find all instances of `coming()` calls and bare `alert(` with "Coming Soon" text
2. For each: either implement the actual feature OR remove the button from JSX
3. Remove the `coming()` function definition if it's no longer called anywhere
4. Clean up any associated CSS classes

**Acceptance Criteria:**
- [ ] Zero instances of `alert('Coming Soon')` or similar dead-end alerts remain
- [ ] Buttons that are removed: their icons/CSS are also cleaned up (no orphaned UI)
- [ ] If a feature was implemented, it works end-to-end without errors

**Effort:** 30 minutes  
**Dependencies:** None

---

### Task 0.5 — Create Toast/Snackbar Scaffold Component

**Purpose:** Every phase after this will need toast notifications. Building the scaffold now means Phase 1 can just call `toast.success('Saved')` without implementing notification infrastructure mid-sprint.

**Files to Create:**
- `components/ui/Toast.tsx` — Main toast component using Radix UI Toast or a lightweight custom implementation
- `components/ui/ToasterProvider.tsx` — Provider wrapper for toast context
- `hooks/use-toast.ts` — Custom hook with typed helper functions

**Steps:**
1. Use Radix UI's `<Toast>` primitive if already in dependencies, otherwise create a lightweight custom component
2. Implement these variants: success (green), error (red), info (blue), warning (amber)
3. Auto-dismiss after 4 seconds for non-critical toasts
4. Stack up to 3 visible toasts vertically at bottom-right
5. Add `ToasterProvider` to the root layout (`app/layout.tsx`)

**Acceptance Criteria:**
- [ ] `toast.success('Message')`, `toast.error('Message')`, `toast.info('Message')`, `toast.warning('Message')` all work from any component
- [ ] Toasts animate in with Framer Motion or CSS transition (slide-up, fade-in)
- [ ] Auto-dismiss after 4 seconds (configurable per call)
- [ ] Max 3 stacked toasts; older ones dismiss when a 4th arrives
- [ ] `ToasterProvider` is rendered at the root layout level
- [ ] No visual overlap with existing `NetworkOfflineIndicator`

**Effort:** 2–3 hours  
**Dependencies:** None. This is foundational — everything else depends on it.

---

### Task 0.6 — Create Skeleton/Shimmer Scaffold Component

**Purpose:** Phase 1 will replace all text loading states with skeleton screens. Having a reusable `<Skeleton>` component now means devs can focus on layout matching instead of building animations from scratch.

**Files to Create:**
- `components/ui/Skeleton.tsx` — Reusable skeleton placeholder component
- `components/skeletons/` directory for page-specific skeleton layouts

**Steps:**
1. Create a base `<Skeleton>` component that accepts `className`, `variant` (rect, circle, text), and animation props
2. Use CSS custom properties (`--skeleton-base`, `--skeleton-shine`) for easy theme integration with existing design tokens
3. Implement shimmer animation using the existing `--duration-fast` token from your CSS variables
4. Create page-specific skeleton files:
   - `components/skeletons/HomePageSkeleton.tsx` — matches Home layout (greeting, summary cards, cohort rows)
   - `components/skeletons/ExplorePageSkeleton.tsx` — matches Explore layout
   - `components/skeletons/CohortOverviewSkeleton.tsx` — matches cohort overview tabs

**Acceptance Criteria:**
- [ ] `<Skeleton variant="rect" className="h-8 w-full rounded-lg" />` renders a shimmer animation
- [ ] Shimmer uses existing design tokens (colors from `--cream-*`, duration from `--duration-fast`)
- [ ] All 3 page-specific skeleton components render without errors
- [ ] Skeleton animations are disabled when `prefers-reduced-motion: reduce` is active
- [ ] TypeScript types enforce valid variant values

**Effort:** 2–3 hours  
**Dependencies:** None. Can be done in parallel with Tasks 0.1–0.4.

---

### Task 0.7 — Fix Muted Text Color Token (#84, partial)

**Audit Item:** #84 (WCAG AA contrast failure — `gray-400` on cream background = ~2.6:1 ratio)

**Files to Edit:**
- `app/globals.css` or wherever CSS custom properties for colors are defined
- Likely under `--color-text-muted` or `text-muted` class

**Steps:**
1. Find the current muted text color definition (likely `#d4d4d8` / gray-400)
2. Change to `gray-500` (#71717a in Tailwind v4, or a custom value that achieves >=4.5:1 contrast on cream #faf7f2)
3. Search for all usages of the muted text token — verify they still look good visually

**Acceptance Criteria:**
- [ ] Muted text meets WCAG AA 4.5:1 contrast ratio on the light background (#faf7f2 / `--cream-100`)
- [ ] No visual regressions in other places that use the same token (it should look slightly darker but still appropriately "muted")
- [ ] Runs through a color contrast checker (e.g., webaim.org) for verification

**Effort:** 30 minutes  
**Dependencies:** None. This is a single-variable change — do it early to avoid rework.

---

### Task 0.8 — Fix All-Caps Eyebrow Text (#97, partial)

**Audit Item:** #97 (All-caps eyebrow text on landing page: "BOOKMARKS. WATCH LATER...")

**Files to Edit:**
- `app/(landing)/components/Hero.tsx` or wherever the eyebrow/eyebrow section is rendered

**Steps:**
1. Find the all-caps eyebrow text block
2. Change to sentence case with muted styling: "Bookmarks · Watch later · Half-finished courses · Dropped hobbies"
3. Apply `text-muted` class (which will now be correct after Task 0.7)

**Acceptance Criteria:**
- [ ] No all-caps eyebrow text remains on the landing page
- [ ] Text uses sentence case with bullet separators for readability
- [ ] Applies muted styling consistent with design tokens

**Effort:** 15 minutes  
**Dependencies:** None. Can be done alongside any Phase 0 task.

---

### Task 0.9 — Wire Up or Remove "Continue as Guest" (#18, partial scaffold)

**Audit Item:** #18 (Guest access buried below "Create Account")

**Files to Edit:**
- `app/(auth)/login/page.tsx` or the auth form component

**Steps:**
1. **For Phase 0:** Promote "Continue as Guest" button to equal visual weight with "Create Account"
2. Change from secondary/outline styling to primary variant (or at least a clearly visible outline variant)
3. Position it directly below "Create Account" (not buried further down the form)

**Acceptance Criteria:**
- [ ] "Continue as Guest" button is visually prominent — equal or near-equal visual weight with "Create Account"
- [ ] Button is positioned immediately after the CTA block, not at the bottom of the form
- [ ] Clicking it navigates to `/explore` (or wherever guest access should go)

**Effort:** 30 minutes  
**Dependencies:** None. Can be done in parallel with any Phase 0 task.

---

### Task 0.10 — Add "Skip to Main Content" Link (#88, partial scaffold)

**Audit Item:** #88 (Missing skip-to-content link for accessibility)

**Files to Edit:**
- `app/layout.tsx` or a shared layout component

**Steps:**
1. Add a `<a href="#main-content">Skip to main content</a>` as the first element in `<body>`, before everything else
2. Style it as visually hidden until focused (`opacity-0 focus:opacity-100 absolute top-4 left-4 z-50`)
3. Ensure every page's `<main>` tag has `id="main-content"`

**Acceptance Criteria:**
- [ ] "Skip to main content" link is the first interactive element in every page's DOM order
- [ ] Link is invisible until focused (keyboard users can Tab to it)
- [ ] Focusing on it scrolls to `<main id="main-content">`
- [ ] Visible on hover/focus with sufficient contrast

**Effort:** 30 minutes  
**Dependencies:** None. One-line addition per page layout.

---

### Phase 0 Summary

| Task | Items | Effort | Dependencies |
|------|-------|--------|-------------|
| Remove Dead Code | #8, #118–#120 | 1 hr | — |
| Fix Misleading Links | #6, #14 | 1 hr | — |
| Remove Mock Data | #122 | 30 min | — |
| Remove Dead Alerts | #123 | 30 min | — |
| Toast Scaffold | (infrastructure) | 2–3 hrs | — |
| Skeleton Scaffold | (infrastructure) | 2–3 hrs | — |
| Fix Muted Text Color | #84 (partial) | 30 min | — |
| Fix All-Caps Eyebrow | #97 (partial) | 15 min | — |
| Promote Guest Button | #18 (partial) | 30 min | — |
| Skip-to-Content Link | #88 (partial) | 30 min | — |

**Phase 0 Total:** ~8–9 hours (~1 day solo)  
**Deliverables:** Clean codebase, Toast system, Skeleton system, accessible foundation ready for Phase 1.

---

## Phase 1 — Critical UX Fixes

| Duration | Week 1 (3–4 days with 2 devs) |
|----------|-------------------------------|
| Items    | #7, #10, #16, #18, #21, #22/#79, #35–#42, #47, #50–#52, #54, #62, #65, #76/#111, #84, #94, #97, #102, #105, #106, #108 |
| Theme    | Accessibility failures, touch targets, missing features shown in UI, feedback systems |

### Why This Phase Next?

Phase 0 gave us a clean codebase and the Toast/Skeleton infrastructure. Now we attack the **most impactful UX problems** that directly affect user trust, accessibility compliance, and basic functionality expectations (like `Cmd+K` actually working). These are "table stakes" — if any of these are broken, they undermine confidence in everything else.

---

### Task 1.1 — Fix Landing Page CTAs & Add Interactive Demo (#7, #10)

**Audit Items:** #7 (too many CTAs / dead demo button), #10 (no preview before signup)

**Files to Edit/Create:**
- `app/(landing)/components/Hero.tsx` — adjust CTA layout and copy
- Optionally: Create a mini-player modal component for the "Try 2 sample lessons" feature

**Steps:**
1. Remove or disable the non-functional "See How It Works" demo button (or wire it up as described in Phase 0)
2. Keep only ONE primary CTA on the hero: "Start Your Next SideQuest" → `/auth`
3. Add an interactive demo widget below the main CTAs:
   - Small card: "Try 2 sample lessons →" that opens a lightweight modal
   - Modal contains an embedded YouTube video (or mock player UI) with 2 chunks
   - No signup required — just let users experience the swipe mechanic
4. Reduce footer link columns from 4 to 3 columns

**Acceptance Criteria:**
- [ ] Hero has exactly one primary CTA ("Start Your Next SideQuest")
- [ ] "See How It Works" button is either functional (opens demo) or removed
- [ ] Interactive demo widget opens a modal with at least 2 playable chunks
- [ ] Demo works without authentication
- [ ] Footer reduced to 3 link columns with a single strong CTA ("Start Your First SideQuest")

**Effort:** 4–6 hours  
**Dependencies:** Phase 0 complete (dead code removed)

---

### Task 1.2 — Add Real-Time Auth Form Validation (#16, #21)

**Audit Items:** #16 (no loading states / validation feedback), #21 (form labels and accessibility)

**Files to Edit/Create:**
- `app/(auth)/login/page.tsx` or the auth form component file(s)
- Likely involves `AuthInput.tsx` or similar input component

**Steps:**
1. Add inline email format validation with visual cues:
   - Green check when email format is valid
   - Red X + error message when invalid ("That doesn't look like an email")
2. Add password strength indicator (weak/medium/strong bar) below the password field
3. Show loading spinner on submit button within 100ms of click (use the `Toast` scaffold from Phase 0)
4. Verify all form fields have visible `<label>` elements above inputs (not just placeholders)
5. Add `aria-describedby` linking error messages to their input fields
6. Add `role="alert"` for validation error announcements

**Acceptance Criteria:**
- [ ] Email field validates format in real-time as user types
- [ ] Password strength bar updates live (weak < 8 chars, medium = 8–11, strong >= 12)
- [ ] Submit button shows loading state immediately on click (< 100ms delay)
- [ ] Every input has a visible `<label>` element above it (not placeholder-only)
- [ ] Error messages are positioned next to the relevant field with `aria-describedby`
- [ ] Screen readers announce validation errors via `role="alert"`

**Effort:** 4–6 hours  
**Dependencies:** Phase 0 complete (accessibility improvements scaffolded)

---

### Task 1.3 — Increase Bottom Nav Touch Targets (#22, #79)

**Audit Items:** #22 (bottom nav too small), #79 (Fittz's Law touch targets on mobile)

**Files to Edit:**
- CSS file containing bottom nav styles (likely `app/globals.css` or a component-scoped `.module.css`)
- Search for classes related to bottom navigation: `.bottom-nav`, `[data-bottom-nav]`, etc.

**Steps:**
1. Change bottom nav container height from `38px + safe-area` to minimum `56px` total (including safe area)
2. Set icon size to 24px with label text below each icon (like iOS tab bar pattern)
3. Add minimum 16px gap between nav items
4. Ensure each nav item has minimum 48x48px clickable area

**Acceptance Criteria:**
- [ ] Bottom nav total height >= 56px on mobile (<=768px breakpoint)
- [ ] Each nav item has a minimum 48x48px touch target area
- [ ] Icons are 24px with labels below them
- [ ] Minimum 16px spacing between items
- [ ] Touch targets pass manual tap test on iPhone SE (smallest common device)

**Effort:** 2–3 hours  
**Dependencies:** None. Pure CSS changes — can be done in parallel with any Phase 1 task.

---

### Task 1.4 — Implement Skeleton Loading Screens (#76, #111)

**Audit Items:** #76 (no skeleton screens), #111 (perceived speed via skeletons)

**Files to Edit/Create:**
- `app/(home)/page.tsx` — replace text fallback with `<HomePageSkeleton />` in `<Suspense>`
- `app/(explore)/page.tsx` — replace text fallback with `<ExplorePageSkeleton />`
- Play screen suspense block — add skeleton
- Use the Skeleton components built in Phase 0

**Steps:**
1. In each page's `<Suspense>` block, replace the plain text fallback with a skeleton layout:
   - Home page: skeleton for greeting bar, 4 summary cards (with progress bars), and cohort rows
   - Explore page: skeleton for greeting, topic chips row, and card grids
   - Play screen: skeleton matching the video player + controls layout
2. Use `animate-pulse` or custom shimmer animation via existing CSS tokens
3. Ensure skeleton content has appropriate `aria-busy="true"` attributes

**Acceptance Criteria:**
- [ ] All 3 pages (Home, Explore, Play) show skeleton animations instead of plain text while loading
- [ ] Skeleton shapes match the actual content layout (same number and approximate sizes of cards/rows)
- [ ] Shimmer animation uses existing design tokens (--duration-fast, color variables)
- [ ] Animations respect `prefers-reduced-motion: reduce` (stop shimmer or use simpler fade)
- [ ] No layout shift between skeleton and loaded content

**Effort:** 4–6 hours  
**Dependencies:** Phase 0 complete (Skeleton scaffold component exists)

---

### Task 1.5 — Implement Cmd+K Command Palette (#108, #113)

**Audit Items:** #108 (`Cmd+K` hint is dead), #113 (global command palette for cross-page search)

**Files to Create/Edit:**
- `components/CommandPalette.tsx` — new command palette component using Radix UI Dialog + cmdk or custom implementation
- `hooks/use-keyboard-shortcuts.ts` — global keyboard shortcut handler
- Add shortcut trigger in root layout

**Steps:**
1. Install dependencies if needed: `npm i @radix-ui/react-dialog cmdk` (or implement lightweight version without cmdk)
2. Create `<CommandPalette />` component with these features:
   - Triggered by Ctrl/Cmd+K globally
   - Search input at top with icon
   - Results grouped by type: Cohorts, Notes, Explore Topics, Community Channels
   - Each result shows a preview card (thumbnail + title)
3. Create `useKeyboardShortcuts` hook that listens for Ctrl+K and opens the palette
4. Wire up arrow key navigation within results (up/down to highlight, Enter to select, Esc to close)

**Acceptance Criteria:**
- [ ] Pressing Cmd/Ctrl+K anywhere in the app opens a centered command palette dialog
- [ ] Search filters results across cohorts, notes, topics in real-time as user types
- [ ] Arrow keys (up/down) navigate through results; Enter selects; Esc closes
- [ ] Results show preview cards with thumbnails and titles
- [ ] Palette is keyboard-navigable from first keystroke to selection
- [ ] Focus is trapped inside the palette while open (cannot tab outside)

**Effort:** 6–8 hours  
**Dependencies:** Phase 0 complete (Toaster scaffold for error feedback if search fails)

---

### Task 1.6 — Improve Error Messages & Empty States (#94, #105, #106)

**Audit Items:** #94 (error messages), #105 (empty states guide not dead-end), #106 (import wizard error readability)

**Files to Edit:**
- `app/(auth)/login/page.tsx` or auth form — for validation error messages
- `app/(home)/page.tsx` — empty search state ("No home results found")
- `app/(explore)/page.tsx` — empty search state on explore
- Import wizard component(s) — for YouTube API error translations

**Steps:**
1. **Auth form errors:** Replace generic messages with specific, kind language:
   - "Invalid email" → "That email doesn't look right — please check for typos"
   - "Password too short" → "Please use at least 8 characters"
2. **Home empty state:** Replace "No home results found for 'xyz'" with:
   - Friendly illustration/icon
   - Text: "We couldn't find any cohorts matching '{query}'."
   - CTA button: "Browse all cohorts" → `/explore`
   - Secondary link: "Create a new cohort" → `/cohort/create`
3. **Explore empty state:** Same pattern — illustration + explanation + browse/try keywords CTA
4. **Import wizard errors:** Wrap YouTube API errors in human-readable translations:
   - "Channel not found" → "We couldn't find that channel — double-check the URL and try again"

**Acceptance Criteria:**
- [ ] Auth error messages are specific, actionable, and kind (not generic "Invalid input")
- [ ] Empty search states on Home AND Explore have: illustration + explanation + CTA button
- [ ] Import wizard shows human-readable translations of all YouTube API errors
- [ ] All new text is consistent in tone with SideQuestHQ's brand voice

**Effort:** 3–4 hours  
**Dependencies:** Phase 0 complete (Toast scaffold for confirmation toasts after fixes)

---

### Task 1.7 — Add Toast Feedback for User Actions (#102, #103)

**Audit Items:** #102 (no success confirmation after actions), #103 (immediate visual response within 100ms)

**Files to Edit:**
- All places where user actions occur: cohort pause, note save, account create, etc.
- Use the Toast system built in Phase 0

**Steps:**
1. Add `toast.success('Saved')` after every successful form submission or data mutation:
   - After creating an account → "Account created! Welcome to SideQuestHQ."
   - After pausing a cohort → "Cohort paused. Resume anytime from Home."
   - After saving a note → "Note saved."
2. Add immediate micro-interaction within 100ms of button click:
   - Button scale-down effect (`transform: scale(0.98)`) on press
   - Loading spinner appears within 100ms (even if network is fast)
3. Add `toast.error()` for failed actions with actionable error text

**Acceptance Criteria:**
- [ ] Every successful user action shows a success toast notification
- [ ] Button scale-down micro-interaction fires on press (not waiting for network response)
- [ ] Loading spinner appears within 100ms of button click regardless of network speed
- [ ] Failed actions show error toasts with specific, actionable messages
- [ ] No duplicate or overlapping toast notifications

**Effort:** 3–4 hours  
**Dependencies:** Phase 0 complete (Toast scaffold), Phase 1 Task 1.6 (error message patterns established)

---

### Task 1.8 — Fix Play Screen UX Issues (#35, #36, #37, #38, #40, #41)

**Audit Items:** #35 (idle timeout too aggressive), #36 (skip button touch targets), #37 (YouTube native controls break immersion), #38 (too many simultaneous desktop controls), #40 ("Mark Done" not visually dominant), #41 (no chunk counter)

**Files to Edit:**
- Play screen component files in the dashboard/play route
- CSS for idle fade, skip button sizing, timeline styling

**Steps:**
1. **Idle timeout (#35):** Change from 4 seconds to 8–10 seconds. Add a subtle "Move your mouse" hint that fades in at 6 seconds before UI hides.
2. **Skip button touch targets (#36):** Add `min-width: 48px; min-height: 48px` to skip buttons on mobile.
3. **YouTube controls (#37):** Document as known limitation of YouTube IFrame API — add comment in code noting trade-off. (Full fix requires custom player backend.)
4. **Desktop control density (#38):** On viewports < 1200px, collapse to show only timeline + playback controls; lesson card and toolbar become hover-reveal only.
5. **"Mark Done" button (#40):** Make it use the brand color (indigo) with a checkmark icon at the bottom of mobile controls — visually dominant per Von Restorff Effect.
6. **Chunk counter (#41):** Add small text at top-right of Play screen: "3 / 12 chunks completed in this season."

**Acceptance Criteria:**
- [ ] Idle timeout is 8–10 seconds (not 4); hint appears at 6 seconds
- [ ] Skip buttons have minimum 48x48px touch targets on mobile
- [ ] Desktop controls collapse gracefully below 1200px viewport width
- [ ] "Mark Done" button uses brand color + checkmark, stands out from other toolbar actions
- [ ] Chunk counter displays current progress: "X / Y chunks completed in this season"
- [ ] YouTube native controls issue is documented as a known limitation

**Effort:** 4–6 hours  
**Dependencies:** None. Self-contained to the Play screen component.

---

### Task 1.9 — Fix Notes Feature Critical Issues (#50, #51, #52, #54)

**Audit Items:** #50 (execCommand deprecated), #51 (auto-save on every keystroke), #52 (no unsaved indicator), #54 (no Ctrl+Z undo)

**Files to Edit:**
- Notes editor component(s) — likely in `app/(notes)/` route
- Search for `document.execCommand`, `onInput`, and undo/redo handlers

**Steps:**
1. **Auto-save debounce (#51):** Wrap the save function with a 500ms–1s debounce:
   - Use a custom hook or lodash debounce
   - Show "Saving..." state during debounce period
2. **Unsaved indicator (#52):** Add a small dot in the top bar:
   - `● unsaved` (red/orange) when there are pending changes
   - Changes to `✓ saved` (green) after successful save
3. **Ctrl+Z undo (#54):** Add keyboard handler for Ctrl/Cmd+Z and Ctrl/Shift+Z (redo):
   - Call `document.execCommand('undo')` / `document.execCommand('redo')` as fallback
   - Add dedicated "↩ Undo" button in the bottom bar
4. **execCommand migration (#50):** This is a long-term refactor — add it to Phase 4 with a tracking issue. For Phase 1, just document the deprecation risk and ensure existing execCommand usage has fallbacks for browsers that remove it.

**Acceptance Criteria:**
- [ ] Note auto-save debounces at 500ms–1s (not on every keystroke)
- [ ] Unsaved indicator dot appears when edits are pending, changes to "✓ saved" after save completes
- [ ] Ctrl/Cmd+Z triggers undo; Ctrl/Shift+Z triggers redo in the notes editor
- [ ] Dedicated Undo button visible in bottom toolbar
- [ ] execCommand deprecation is documented as a Phase 4 task (not deferred indefinitely)

**Effort:** 3–5 hours  
**Dependencies:** None. Self-contained to Notes feature.

---

### Task 1.10 — Fix Cohort Progress & Save Draft (#62, #65)

**Audit Items:** #62 (no save draft for cohort creation), #65 (progress bar lacks context)

**Files to Edit/Create:**
- Create Cohort Wizard component(s) — likely in `app/(dashboard)/cohort/create/` route or similar
- Cohort overview page components

**Steps:**
1. **Save Draft (#62):** Add a "Save Draft" button in the wizard footer:
   - Saves current step's form data to local storage or API as draft state
   - Returns to home with toast: "Cohort draft saved. Continue editing →" (link back to draft)
2. **Progress context (#65):** Add text below the progress bar on cohort overview:
   - "12 days remaining • ~30 min/day to finish on schedule"
   - Calculate from journey data if available, or show placeholder with TODO comment

**Acceptance Criteria:**
- [ ] Create Cohort wizard has a "Save Draft" button in footer
- [ ] Draft saves current step data and shows confirmation toast with link to continue editing
- [ ] Cohort overview progress bar is accompanied by time-to-finish context text
- [ ] If journey data isn't available, show a clear placeholder with TODO comment (not empty)

**Effort:** 2–3 hours  
**Dependencies:** Phase 0 complete (Toast scaffold), Phase 1 Task 1.7 (toast feedback pattern established)

---

### Task 1.11 — Fix WCAG Contrast (#84, full)

**Audit Item:** #84 (WCAG AA color contrast failure — already partially done in Phase 0 Task 0.7)

**Files to Edit:**
- `app/globals.css` or wherever token colors are defined
- Any component that uses muted text, borders, or subtle UI elements

**Steps:**
1. Verify the change made in Phase 0 Task 0.7 (gray-400 → gray-500 for muted text) is applied globally
2. Audit ALL other instances of low-contrast colors:
   - Disabled button states
   - Input borders and placeholders  
   - Subtle dividers and icons
3. Run an automated contrast checker against all color pairs in the design system

**Acceptance Criteria:**
- [ ] All text meets WCAG AA 4.5:1 (normal) or 3:1 (large text >= 18px / bold >= 14px)
- [ ] Interactive elements have sufficient contrast even at disabled state (minimum 3:1 for visual boundary)
- [ ] Color tokens are documented with their contrast ratios in a comment near the definition

**Effort:** 2–3 hours  
**Dependencies:** Phase 0 Task 0.7 (partial fix already applied — this is verification + remaining fixes)

---

### Phase 1 Summary

| Task | Items | Effort | Dependencies |
|------|-------|--------|-------------|
| Landing CTAs & Demo | #7, #10 | 4–6 hrs | Phase 0 |
| Auth Form Validation | #16, #21 | 4–6 hrs | Phase 0 |
| Bottom Nav Touch Targets | #22, #79 | 2–3 hrs | — (parallel) |
| Skeleton Loading Screens | #76, #111 | 4–6 hrs | Phase 0 |
| Cmd+K Command Palette | #108, #113 | 6–8 hrs | Phase 0 |
| Error Messages & Empty States | #94, #105, #106 | 3–4 hrs | Phase 0 |
| Toast Feedback for Actions | #102, #103 | 3–4 hrs | Phase 0 + Task 1.6 |
| Play Screen Fixes | #35, #36, #37, #38, #40, #41 | 4–6 hrs | — (parallel) |
| Notes Critical Issues | #50, #51, #52, #54 | 3–5 hrs | — (parallel) |
| Cohort Progress & Draft | #62, #65 | 2–3 hrs | Phase 0 + Task 1.7 |
| WCAG Contrast Full Fix | #84 (full) | 2–3 hrs | Phase 0 Task 0.7 |

**Phase 1 Total:** ~37–52 hours (~3–4 days with 2 devs working in parallel on independent tasks)  
**Deliverables:** Accessible auth flow, skeleton loading everywhere, Cmd+K command palette works, toast feedback on every action, play screen polished, notes auto-save debounced, cohort drafts possible.

---

## Phase 2 — Core UX Polish

| Duration | Week 2–3 (5–6 days with 2 devs) |
|----------|----------------------------------|
| Items    | #1, #3, #4, #9, #11, #13, #17, #19, #23, #27/#98, #29–#34, #38 (desktop density), #40, #41, #45/#49, #55, #60, #63/#64, #67, #68, #93, #96 |
| Theme    | Navigation refinement, progress tracking, card consistency, copy improvements, empty states |

### Why This Phase Now?

Phase 1 fixed the critical failures. Phase 2 is where we polish the experience to a professional standard — making navigation intuitive, content consistent across pages, and interactions delightful. These changes won't break functionality but will significantly improve perceived quality.

---

### Task 2.1 — Refine Navigation & Sidebar (#1, #3, #4)

**Audit Items:** #1 (sidebar icon-only labels on desktop), #3 (mobile back navigation in cohorts), #4 (Fittz's Law bottom nav spacing)

**Files to Edit:**
- `app/(dashboard)/components/Sidebar.tsx` or sidebar component file
- Cohort layout files under cohort route groups
- Bottom nav CSS styles

**Steps:**
1. **Sidebar hover-expand (#1):** Add CSS that expands sidebar labels on hover:
   - Current state: 64px width, icon-only (labels visually hidden)
   - Hover state: expand to ~200px width, reveal text labels with fade-in animation
   - Use `transition` for smooth expansion (not instant jump)
2. **Mobile cohort back nav (#3):** On mobile, add a visible "← Back" button at the top of cohort detail pages that returns to home or previous navigation point
3. **Bottom nav spacing (#4):** Finalize the 48px center-to-center spacing and 16px minimum gaps between items (if not done in Phase 1 Task 1.3)

**Acceptance Criteria:**
- [ ] Desktop sidebar expands on hover, revealing text labels for each icon
- [ ] Expansion animates smoothly (~200ms transition), does not jump
- [ ] Mobile cohort pages have a visible "← Back" button that returns to home
- [ ] Bottom nav items have minimum 48px center-to-center spacing

**Effort:** 3–4 hours  
**Dependencies:** Phase 1 Task 1.3 (bottom nav touch targets done)

---

### Task 2.2 — Landing Page Copy & Visual Hierarchy (#9, #11, #13)

**Audit Items:** #9 (all-caps eyebrow competing with headline), #11 (long abstract description), #13 (CTA button sizing on mobile)

**Files to Edit:**
- `app/(landing)/components/Hero.tsx` — headline, eyebrow, CTA buttons
- Landing page CSS / Tailwind classes

**Steps:**
1. **Eyebrow text (#9):** Already done in Phase 0 Task 0.8 (all-caps → sentence case with muted styling). Verify it's correct.
2. **Hero hierarchy (#11):** Restructure hero section:
   - Eyebrow (small, muted) → H1 headline → One-sentence benefit → Primary CTA button
   - Move the emotional backstory paragraph to below-the-fold Ikigai section
3. **Button sizing (#13):** Ensure all interactive elements have minimum 44px height on mobile:
   - Add `min-height: 44px` (or `h-12`) to CTA buttons on screens <=768px

**Acceptance Criteria:**
- [ ] Hero follows clear visual hierarchy: Eyebrow → H1 → Benefit sentence → CTA
- [ ] Emotional backstory moved below-the-fold
- [ ] All CTA buttons have minimum 44px height on mobile (<=768px)
- [ ] No all-caps text anywhere in the hero section

**Effort:** 2–3 hours  
**Dependencies:** Phase 0 Task 0.8 (all-caps eyebrow fix), Phase 1 Task 1.1 (CTA cleanup)

---

### Task 2.3 — Auth Form UX Polish (#17, #19)

**Audit Items:** #17 (unclear login/signup mode on load), #19 (buttons blend together / Von Restorff Effect)

**Files to Edit:**
- `app/(auth)/login/page.tsx` or auth form component

**Steps:**
1. **Mode indicator (#17):** Add a clear tab switcher at the top of the auth form:
   - Two tabs: `[Sign Up] [Log In]` with active state styling
   - Switching between them toggles the form fields (don't require clicking "Already have an account? Log in")
2. **Button contrast (#19):** Use color distinction per Von Restorff Effect:
   - "Create Account" → brand-colored background (indigo) as primary button
   - "Continue as Guest" → neutral/gray outline style

**Acceptance Criteria:**
- [ ] Auth form has visible tab switcher `[Sign Up] [Log In]` at top
- [ ] Tab switching toggles between signup and login forms smoothly
- [ ] Default view shows Sign Up tab active
- [ ] "Create Account" uses brand color; "Continue as Guest" uses outline/neutral style

**Effort:** 2–3 hours  
**Dependencies:** Phase 0 Task 0.9 (guest button promoted)

---

### Task 2.4 — Active Cohorts Table Simplification (#29, #30, #31, #33, #34)

**Audit Items:** #29 (too many columns), #30 (overlapping popovers), #31 (drag-to-reorder on mobile), #33 (schedule popover progressive disclosure), #34 (empty search suggestions)

**Files to Edit:**
- ActiveCohortRow component(s) in the Home page
- Search filtering logic in `app/(home)/page.tsx` or related hooks

**Steps:**
1. **Simplify columns (#29):** Show only essential columns:
   - Rank (drag handle), Thumbnail, Title, Progress bar
   - Move Schedule, Goal, Pause to a "More ▾" dropdown on each row
2. **Popover management (#30):** Implement `closeEditors()` properly on outside click — ensure only one popover can be open at a time per row
3. **Mobile reorder (#31):** On mobile (<=768px), replace drag handle with a "Reorder" button that enters edit mode
4. **Schedule pills (#33):** Show day-of-week as pill buttons — muted for inactive days, bold/colored for active days
5. **Search suggestions (#34):** When search returns no results, show contextual suggestions:
   - "Try searching by provider name like 'Kunal Kushwaha' or topic keywords"
   - Fallback link: "Browse all cohorts →" to `/explore`

**Acceptance Criteria:**
- [ ] Active Cohort table shows only Rank + Thumbnail + Title + Progress (rest in dropdown)
- [ ] Only one popover open at a time per row; clicking outside closes any open popover
- [ ] Mobile view replaces drag handle with "Reorder" button that enters edit mode
- [ ] Schedule days display as pills: bold for active, muted for inactive
- [ ] Empty search state shows contextual suggestions + fallback browse link

**Effort:** 6–8 hours  
**Dependencies:** None. Self-contained to Home page components.

---

### Task 2.5 — Progress Tracking Enhancements (#27, #98)

**Audit Items:** #27 (streak sparkline without numerical context), #98 (daily goal milestone markers)

**Files to Edit/Create:**
- SummaryCards component(s) in Home page dashboard components
- Daily goal progress bar component

**Steps:**
1. **Streak context (#27):** Add a small label next to the streak card:
   - "+3 days this week" or "-1 day from last week" based on trend data
   - Use existing sparkline trend data if available, or calculate from stored history
2. **Milestone markers (#98):** Add visual milestone dots/ticks on the daily goal progress bar:
   - Small dots at 25%, 50%, 75% marks
   - When crossed, show a small label ("Quarter way there!", "Halfway!") and subtle celebration animation (confetti burst or scale pulse)

**Acceptance Criteria:**
- [ ] Streak card shows numerical trend: "+X days this week" or "-X days from last week"
- [ ] Daily goal progress bar has visual markers at 25%, 50%, 75%
- [ ] Milestone labels appear when thresholds are crossed ("Quarter way there!", "Halfway!")
- [ ] Subtle celebration animation (confetti or scale pulse) on milestone achievement

**Effort:** 3–4 hours  
**Dependencies:** Phase 1 Task 1.8 (Play screen chunk counter done — same progress tracking patterns)

---

### Task 2.6 — Home Page Content Refinements (#28, #32, #96)

**Audit Items:** #28 (serial position in content ordering), #32 (completion celebration), #96 (positive reinforcement on completion messages)

**Files to Edit:**
- Home page sections: Recently Completed, summary cards, any completion-related UI

**Steps:**
1. **Content ordering (#28):** Verify current order is correct per serial position effect:
   - Active Cohorts → Continue Later → Recently Completed ✅ (already optimal — verify no regression from other changes)
2. **Completion celebration (#32):** Add visual rewards to recently completed items:
   - emoji icon + gold accent color for recently completed cohorts/lessons
3. **Positive completion messages (#96):** Change "Completed 3 days ago" to celebratory text:
   - "✨ Finished! Great work!" or "🎉 Completed — keep the streak going!"

**Acceptance Criteria:**
- [ ] Content sections follow optimal serial position ordering (most important first)
- [ ] Recently completed items have emoji icon + gold accent styling
- [ ] Completion messages are celebratory, not just factual ("✨ Finished! Great work!")

**Effort:** 1–2 hours  
**Dependencies:** None. Simple text/style changes.

---

### Task 2.7 — Unified Card Component (#89)

**Audit Items:** #89 (inconsistent card styling across pages)

**Files to Create/Edit:**
- `components/ui/Card.tsx` — new canonical Card component
- `app/(home)/page.tsx` — update to use `<Card>` instead of inline divs
- `app/(explore)/page.tsx` — update cards to use `<Card>`
- Cohort overview components — update hero cards to use `<Card>`

**Steps:**
1. Create a canonical `<Card>` component with consistent props:
   - `variant`: 'default' | 'elevated' | 'flat' (3 variants)
   - `padding`: string (from design token spacing values)
   - `radius`: boolean or size enum
   - Children as content slot
2. Define the card styles using existing CSS tokens:
   - Background: `--cream-100` or white depending on variant
   - Border radius from `--radius-*` tokens
   - Shadow from `--shadow-*` tokens (none for flat, small for default, medium for elevated)
3. Replace inline card divs with `<Card>` across Home, Explore, and Cohort pages

**Acceptance Criteria:**
- [ ] All cards across Home, Explore, and Cohort pages use the unified `<Card>` component
- [ ] Three variants available: default (subtle shadow), elevated (larger shadow), flat (no shadow)
- [ ] Card styling is consistent — no page has a visually different card pattern
- [ ] TypeScript types enforce valid variant values

**Effort:** 4–6 hours  
**Dependencies:** Phase 1 Task 1.4 (skeleton scaffolds exist — skeletons can use the same Card component internally)

---

### Task 2.8 — Explore Page Refinements (#45, #46, #47, #49)

**Audit Items:** #45 (limit content sections), #46 (different card styles per section), #47 (connect greeting to user data — Phase 0 Task 0.3 may have done this), #49 (pagination/lazy loading for sections)

**Files to Edit:**
- `app/(explore)/page.tsx` and related components

**Steps:**
1. **Limit sections (#45):** Cap displayed items per section:
   - People Finishing → max 6 cards
   - Browse Topics → max 9 chips (show "More" if additional exist)
   - Trending SideQuests → max 8 cards (with "See All" link)
   - Recently Published → max 5 articles
2. **Card differentiation (#46):** Use different card styles per section:
   - Trending = horizontal cards with thumbnails
   - Recently Published = vertical list with minimal thumbnails
3. **Greeting data (#47):** Verify Phase 0 Task 0.3 fix is applied (no more "Shaqun")
4. **Lazy loading (#49):** Add intersection observer-based lazy loading for sections below the fold:
   - Fetch section data only when user scrolls near that section

**Acceptance Criteria:**
- [ ] Each Explore section has a maximum item count with overflow indicators
- [ ] Trending and Recently Published use visually distinct card styles (horizontal vs vertical)
- [ ] Greeting uses dynamic user data (no hardcoded names)
- [ ] Below-fold sections load lazily via intersection observer

**Effort:** 3–4 hours  
**Dependencies:** Phase 0 Task 0.3 (mock data removed), Phase 2 Task 2.7 (Card component exists)

---

### Task 2.9 — Notes Organization & UX (#55, #56)

**Audit Items:** #55 (add tag support for cross-cutting organization), #56 (presentation mode exit mechanism)

**Files to Edit/Create:**
- Notes feature components in `app/(notes)/` route
- Note model/schema if tags require new fields

**Steps:**
1. **Tag support (#55):** Add lightweight tagging:
   - Any note can have multiple tags (e.g., #DSA, #JavaScript)
   - Tag input with autocomplete from existing tag pool
   - Tag sidebar/filter in notes list view
2. **Presentation mode exit (#56):** Improve presentation mode UX:
   - Show subtle bottom bar that fades in on mouse movement
   - Bar contains "Exit Presentation" button and slide counter ("3 / 12")

**Acceptance Criteria:**
- [ ] Notes support multiple tags per note via tag input with autocomplete
- [ ] Tag filter available in notes list view sidebar
- [ ] Presentation mode shows a fade-in bottom bar on mouse movement with exit button + slide counter
- [ ] No existing notes are broken by the new tag feature

**Effort:** 4–6 hours  
**Dependencies:** None. Self-contained to Notes feature. May require schema change if tags aren't stored yet.

---

### Task 2.10 — Cohort Page UX Polish (#63, #64, #67, #68)

**Audit Items:** #63 (nav tab touch targets), #64 (mobile tab collapse), #67 (Hall of Fame distinct visual treatment), #68 (breadcrumbs on cohort pages)

**Files to Edit/Create:**
- Cohort navigation component(s)
- Hall of Fame sub-page
- Cohort layout wrapper

**Steps:**
1. **Tab touch targets (#63):** Add minimum sizing to cohort nav tabs:
   - `min-height: 48px; padding: 12px 16px;` on all tab links
2. **Mobile tab collapse (#64):** On mobile <=480px, collapse from 5 tabs to "Overview" + "More ▾":
   - "More" dropdown reveals: Questline and Hall of Fame
   - Overview, Events, Archives remain visible as separate tabs (3 visible)
3. **Hall of Fame styling (#67):** Give Hall of Fame a distinct visual identity:
   - Gold/amber accent colors instead of brand indigo
   - Trophy icons for rank entries
   - Leaderboard-style ranking layout with larger fonts for top 3
4. **Breadcrumbs (#68):** Add breadcrumb trail below the cohort top bar:
   - Format: `Home › [Cohort Name] › [Tab Name]`
   - Each segment is a clickable link

**Acceptance Criteria:**
- [ ] Cohort nav tabs have minimum 48px height with adequate padding
- [ ] Mobile <=480px shows only Overview/Events/Archives + "More ▾" dropdown
- [ ] Hall of Fame uses gold/amber accents and trophy icons — visually distinct from other tabs
- [ ] Breadcrumbs display below top bar: `Home › Cohort Name › Tab Name`
- [ ] All breadcrumb segments are clickable links

**Effort:** 3–4 hours  
**Dependencies:** Phase 2 Task 2.1 (sidebar navigation patterns established)

---

### Task 2.11 — Design System & Copy Consistency (#93, #95)

**Audit Items:** #93 (microcopy improvements), #95 (navigation label standards)

**Files to Edit:**
- All text strings across the application — placeholders, labels, buttons, tooltips, empty states

**Steps:**
1. **Microcopy review (#93):** Update vague/generic placeholder text:
   - Email placeholder: "you@email.com" instead of "example@example.in"
   - Password field: remove placeholder entirely; use helper text below for requirements
2. **Label audit (#95):** Verify all navigation labels and button actions follow the 1–3 word, action-oriented pattern:
   - Generic "Submit" → specific "Create Cohort", "Save Changes", etc.
   - All current labels pass this test ✅ — document as a guideline for future additions

**Acceptance Criteria:**
- [ ] Email placeholder is generic and universal ("you@email.com")
- [ ] Password field has no placeholder text; requirements shown via helper text below the input
- [ ] No navigation label exceeds 3 words
- [ ] All button labels describe the specific action (not generic "Submit" or "OK")

**Effort:** 2–3 hours  
**Dependencies:** None. Copy-only changes — can be done in parallel with any Phase 2 task.

---

### Task 2.12 — Messaging Feature UX (#70, #72, #74, #75)

**Audit Items:** #70 (left sidebar filter clutter), #72 (right sidebar information density), #74 (message delete for communities), #75 (read receipts)

**Files to Edit/Create:**
- Messages feature components in `app/(messages)/` route or similar

**Steps:**
1. **Filter collapse (#70):** Collapse filters into a single pill-row above the conversation list:
   - Default view shows all conversations; user narrows with pill selection
2. **Right sidebar ranking (#72):** Order by importance: Friends Online (top, largest card) > Challenge > Upcoming Events
3. **Message delete (#74):** Add "Delete for me" option within 5 minutes of sending any message (including community messages)
4. **Read receipts (#75):** Implement basic read receipt indicators:
   - Single checkmark ✓ = sent
   - Double checkmark ✓✓ = delivered  
   - Blue ✓✓ = read

**Acceptance Criteria:**
- [ ] Message filters are in a collapsible pill-row, not scattered across the sidebar
- [ ] Right sidebar items ranked by importance (Friends Online largest/most prominent)
- [ ] Messages can be deleted within 5 minutes of sending (community + DMs)
- [ ] Read receipt indicators show delivery status progression

**Effort:** 4–6 hours  
**Dependencies:** Depends on whether read receipts infrastructure exists. If not, mark as Phase 4.

---

### Task 2.13 — Play Screen Polish (#39, #42, #43, #44)

**Audit Items:** #39 (control group visual grouping), #42 (fullscreen exit cue), #43 (standard skip distances), #44 (lesson card simplification)

**Files to Edit:**
- Play screen component files

**Steps:**
1. **Control grouping (#39):** Add subtle container background or border around the entire `.mobileControls` section to group all playback controls together perceptually
2. **Fullscreen exit (#42):** Add a small "Exit Fullscreen" button in top-right that appears on mouse movement near the corner (auto-hides after 2 seconds)
3. **Skip distances (#43):** Document current ±10s skip as intentional design choice for microlearning chunks. Consider adding a settings option to change this later.
4. **Lesson card simplification (#44):** Simplify lesson metadata overlay:
   - Show only: Lesson Title + Current Chunk Number + Total Chunks
   - Move platform icon, season info to secondary position

**Acceptance Criteria:**
- [ ] Mobile controls have a subtle container background grouping all buttons together
- [ ] Exit fullscreen button appears on mouse movement near top-right corner and auto-hides after 2s
- [ ] ±10s skip is documented as intentional; settings option noted for future
- [ ] Lesson card overlay simplified to: Title + "Chunk X / Y"

**Effort:** 2–3 hours  
**Dependencies:** Phase 1 Task 1.8 (Play screen critical fixes done)

---

### Phase 2 Summary

| Task | Items | Effort | Dependencies |
|------|-------|--------|-------------|
| Navigation & Sidebar Refinement | #1, #3, #4 | 3–4 hrs | Phase 1 Task 1.3 |
| Landing Page Copy | #9, #11, #13 | 2–3 hrs | Phase 0 + Phase 1 |
| Auth Form Polish | #17, #19 | 2–3 hrs | Phase 0 Tasks 0.8+0.9 |
| Cohorts Table Simplification | #29, #30, #31, #33, #34 | 6–8 hrs | — (parallel) |
| Progress Tracking | #27, #98 | 3–4 hrs | Phase 1 Task 1.8 |
| Completion Celebration | #28, #32, #96 | 1–2 hrs | — (parallel) |
| Unified Card Component | #89 | 4–6 hrs | Phase 1 Task 1.4 |
| Explore Page Refinements | #45, #46, #47, #49 | 3–4 hrs | Phase 0 + Phase 2 Task 2.7 |
| Notes Tags & Presentation UX | #55, #56 | 4–6 hrs | — (parallel) |
| Cohort Page Polish | #63, #64, #67, #68 | 3–4 hrs | Phase 2 Task 2.1 |
| Copy Consistency | #93, #95 | 2–3 hrs | — (parallel) |
| Messaging UX | #70, #72, #74, #75 | 4–6 hrs | Depends on infra for read receipts |
| Play Screen Polish | #39, #42, #43, #44 | 2–3 hrs | Phase 1 Task 1.8 |

**Phase 2 Total:** ~40–56 hours (~5–6 days with 2 devs working in parallel on independent tasks)  
**Deliverables:** Consistent card design across all pages, simplified navigation, progress tracking polished, notes organized with tags, cohort pages navigable with breadcrumbs and mobile tab collapse.

---

## Phase 3 — Advanced Features

| Duration | Week 4–5 (4–5 days with 2 devs) |
|----------|----------------------------------|
| Items    | #2, #5, #100, #101, #107, #109/#115, #116 + focus trapping for all modals |
| Theme    | Keyboard shortcuts, analytics, command palette expansion, focus mode, streak freeze |

### Why This Phase Last?

These are quality-of-life and engagement features that build on the polished foundation from Phases 0–2. They require stable base functionality to integrate properly (analytics needs clean data flow, keyboard shortcuts need consistent DOM structure).

---

### Task 3.1 — Reorder Sidebar Navigation (#2)

**Audit Item:** #2 (Hick's Law — Play first may not match user intent; Home should be default anchor)

**Files to Edit:**
- `app/(dashboard)/components/Sidebar.tsx` or sidebar navigation component
- Default redirect route configuration in `app/(dashboard)/route.ts` or similar

**Steps:**
1. Reorder sidebar from: Play → Home → Messages → Explore → Notes  
   To: **Home → Play → Explore → Messages → Notes**
2. Set default landing page to `/home` (if not already) when user navigates to dashboard root
3. Update any bookmarks or deep links that assumed Play as first item

**Acceptance Criteria:**
- [ ] Sidebar order is Home → Play → Explore → Messages → Notes
- [ ] Dashboard root (`/`) redirects to `/home` by default
- [ ] No broken links or 404s from old navigation assumptions

**Effort:** 30 minutes  
**Dependencies:** Phase 2 complete (sidebar hover-expand polished in Task 2.1)

---

### Task 3.2 — Mobile Cohort Tab Collapse (#5)

**Audit Item:** #5 (6 cohort tabs + search = cognitive overload on mobile <=480px)

**Files to Edit/Create:**
- Cohort navigation component(s) — likely shared across all cohort detail pages
- Responsive CSS for the <=480px breakpoint

**Steps:**
1. On screens <=480px, collapse 6 tabs into "Overview" + "More ▾":
   - Visible: Overview (default), Events, Archives as separate items
   - More ▾ dropdown reveals: Questline and Hall of Fame
2. Implement the dropdown using Radix UI Popover or a lightweight custom implementation
3. Ensure keyboard navigation works within the collapsed menu

**Acceptance Criteria:**
- [ ] Mobile <=480px shows 3 visible tabs + "More ▾" dropdown (not 6 inline)
- [ ] "More" dropdown contains Questline and Hall of Fame
- [ ] Dropdown is fully keyboard-navigable (arrow keys, Enter to select, Esc to close)
- [ ] Desktop (>480px) shows all 6 tabs inline as before

**Effort:** 2–3 hours  
**Dependencies:** Phase 2 Task 2.10 (cohort mobile tab collapse implemented — this may be a refinement of that work)

---

### Task 3.3 — Focus Mode for Play Screen (#100)

**Audit Item:** #100 (no ambient customization for flow state)

**Files to Create/Edit:**
- `app/(dashboard)/components/PlayScreen.tsx` or play screen component
- Settings page/component if focus mode toggle belongs there

**Steps:**
1. Add a "Focus Mode" toggle accessible from:
   - Play screen toolbar (gear/settings icon), OR
   - Settings page → Study Environment section
2. When Focus Mode is enabled:
   - Hide all non-essential UI elements (lesson card, toolbar, timeline)
   - Show only the video player + minimal playback controls at bottom
   - Dim background to dark/neutral
3. Store focus mode preference in user settings or localStorage

**Acceptance Criteria:**
- [ ] Focus Mode toggle exists and is accessible from Play screen or Settings
- [ ] When enabled: only video player + basic controls visible, everything else hidden
- [ ] Background dims when Focus Mode is active
- [ ] Preference persists across sessions (localStorage or user settings)

**Effort:** 3–4 hours  
**Dependencies:** Phase 1 Task 1.8 (Play screen idle behavior established)

---

### Task 3.4 — Analytics Integration (#101, #116)

**Audit Items:** #101 (Pareto Principle — track engagement data), #116 (weekly trend comparison)

**Files to Create/Edit:**
- `lib/analytics.ts` or analytics utility module
- Add tracking calls throughout the application
- `app/(dashboard)/components/WeeklyComparisonWidget.tsx` — new widget component

**Steps:**
1. Set up lightweight analytics tracking:
   - Page view events (track which pages get visited, how long)
   - Button click events (which CTAs are clicked most)
   - Search query tracking (what users search for, zero-result rates)
   - Use localStorage-based storage for now; plan to migrate to a service later
2. Create `WeeklyComparisonWidget`:
   - Shows this week vs last week's study hours
   - Small bar chart or sparkline comparison
   - "You studied 2h more than last week" type messaging

**Acceptance Criteria:**
- [ ] Page views tracked for all routes in the app
- [ ] Button clicks logged for primary CTAs (Sign Up, Start Cohort, etc.)
- [ ] Search queries recorded with result count (to measure zero-result rate)
- [ ] Weekly Comparison widget renders on Home dashboard
- [ ] Data stored locally; can be exported or synced later when analytics service is chosen

**Effort:** 4–6 hours  
**Dependencies:** Phase 2 complete (stable data flow from simplified tables and unified components)

---

### Task 3.5 — Command Palette Expansion (#109, #114, #115)

**Audit Items:** #109 (keyboard shortcut discoverability), #114 (search results preview cards), #115 (command palette keyboard navigation)

**Files to Edit/Create:**
- `components/CommandPalette.tsx` — expand existing Phase 1 implementation
- Create a "Keyboard Shortcuts" help modal component

**Steps:**
1. **Expand command palette (#114, #115):** Add more result types and better previews:
   - Cohort results: thumbnail + title + progress % badge
   - Note results: title + last edited date + notebook name
   - Topic results: icon + name + "X SideQuests" count
2. **Keyboard shortcut discoverability (#109):** Create a "Keyboard Shortcuts" help modal:
   - Accessible via `?` key or Settings > Help menu
   - Lists all available shortcuts with descriptions

**Acceptance Criteria:**
- [ ] Command palette shows preview cards for cohorts (with progress %), notes (with dates), and topics (with counts)
- [ ] Arrow keys navigate results; Enter selects; Escape closes (fully keyboard accessible)
- [ ] Keyboard Shortcuts help modal opens with `?` key or via Settings menu
- [ ] Modal lists all available shortcuts in a clean, scannable table format

**Effort:** 4–6 hours  
**Dependencies:** Phase 1 Task 1.5 (command palette scaffold exists)

---

### Task 3.6 — Streak Freeze Mechanic (#99)

**Audit Item:** #99 (no recovery mechanism for breaking streaks)

**Files to Create/Edit:**
- Streak tracking logic/hooks in dashboard components
- Gamification UI components (streak display, freeze purchase/earn mechanic)

**Steps:**
1. Implement "Streak Freeze" concept:
   - Earn a freeze by maintaining a streak for 7 consecutive days
   - OR purchase a freeze via an in-app currency/gamification point system (placeholder for now)
2. When a user misses a day with an active freeze:
   - Streak does NOT reset — instead, show "Streak Freeze used! Keep going!" notification
3. Display available freezes next to the streak counter

**Acceptance Criteria:**
- [ ] Users earn 1 streak freeze after maintaining a streak for 7 days
- [ ] If user misses a day with an active freeze, streak is preserved
- [ ] Streak freeze count displayed next to streak counter
- [ ] Notification on freeze usage: "Streak Freeze used! Keep going!"

**Effort:** 3–5 hours  
**Dependencies:** Phase 2 Task 2.5 (streak tracking polished)

---

### Task 3.7 — Focus Trapping for All Modals (#107, partial — accessibility)

**Audit Items:** #107 (error states one at a time), plus focus trapping for all dialogs/modals from Phase 1 Task 1.5 and other modals

**Files to Edit/Create:**
- All modal/dialog components across the application:
  - Pause modal, Share modal, Command Palette, Create Cohort wizard steps
  - Any `<dialog>` or Radix UI Dialog instances

**Steps:**
1. Ensure every modal/popup with `role="dialog"` implements focus trapping:
   - Tab cycles within the dialog; pressing Tab on last element goes to first
   - Shift+Tab reverses direction
2. Add a "Close" button (X) or keyboard Esc handler for all modals
3. Restore focus to the triggering element when modal closes
4. Ensure only ONE toast/error notification visible at a time (#107):
   - Queue system: new notifications wait until current dismisses

**Acceptance Criteria:**
- [ ] Every dialog traps focus within itself (Tab/Shift+Tab cycles)
- [ ] All modals close via Escape key AND have a visible Close button
- [ ] Focus returns to the triggering element when modal closes
- [ ] Maximum ONE active toast at any time (queue system for overflow)

**Effort:** 3–4 hours  
**Dependencies:** Phase 1 Tasks 1.5 + 1.7 (command palette focus trapping done, toast system exists)

---

### Task 3.8 — Notes execCommand Migration Planning (#50)

**Audit Item:** #50 (`document.execCommand` deprecated — migrate to TipTap/Slate/Quill)

**Files to Create/Edit:**
- `lib/rich-text-editor.tsx` or new editor component (POC/prototype)
- Task tracking issue in project board

**Steps:**
1. **For Phase 3:** Do NOT refactor the entire notes system yet. Instead:
   - Evaluate TipTap vs Slate.js for migration feasibility
   - Create a small proof-of-concept component that implements basic formatting (bold, italic, lists) with the chosen library
   - Compare file size, bundle impact, and developer experience
2. **Create tracking issue:** Document full migration scope as a Phase 4 task

**Acceptance Criteria:**
- [ ] Evaluation document comparing TipTap vs Slate.js exists
- [ ] POC component demonstrates basic rich text formatting with the chosen library
- [ ] Full migration scoped and tracked as a Phase 4 task (not silently deferred)
- [ ] Current execCommand-based editor continues to work without regression

**Effort:** 2–3 hours  
**Dependencies:** None. Research + POC work — does not block production changes.

---

### Phase 3 Summary

| Task | Items | Effort | Dependencies |
|------|-------|--------|-------------|
| Reorder Sidebar Nav | #2 | 30 min | Phase 2 Task 2.1 |
| Mobile Cohort Tabs | #5 | 2–3 hrs | Phase 2 Task 2.10 (refinement) |
| Focus Mode | #100 | 3–4 hrs | Phase 1 Task 1.8 |
| Analytics Integration | #101, #116 | 4–6 hrs | Phase 2 complete |
| Command Palette Expansion | #109, #114, #115 | 4–6 hrs | Phase 1 Task 1.5 |
| Streak Freeze | #99 | 3–5 hrs | Phase 2 Task 2.5 |
| Focus Trapping All Modals | #107 + accessibility | 3–4 hrs | Phase 1 Tasks 1.5+1.7 |
| execCommand Migration POC | #50 (research) | 2–3 hrs | — (parallel) |

**Phase 3 Total:** ~24–34 hours (~4–5 days with 2 devs working in parallel)  
**Deliverables:** Full command palette, keyboard shortcuts discoverable, analytics tracking live, focus mode available, streak freezes implemented, all modals accessible.

---

## Phase 4 — Strategic Long-Term

| Duration | Month 2+ (10–15 days spread over sprints) |
|----------|--------------------------------------------|
| Items    | #78, #88, #89 (full unification), #90, #91, #112 + all remaining deferred High items |
| Theme    | Service worker, full WCAG audit, CSS unification, execCommand migration, real analytics, A/B testing |

### Why This Phase Last?

These are deep infrastructure and architectural changes that benefit from a polished product to test against. They're also the highest-risk changes — if they break something, it affects every page simultaneously. Rolling them out gradually across sprints minimizes disruption.

---

### Task 4.1 — Service Worker & Offline-First Strategy (#78)

**Audit Item:** #78 (no service worker or offline-first strategy)

**Files to Create/Edit:**
- `next.config.js` — configure PWA/Next-PWA plugin
- `public/service-worker.js` or use next-pwa's built-in SW generation
- Update existing `NetworkOfflineIndicator` component to work with Service Worker state

**Steps:**
1. Install and configure Next-PWA (or Workbox) for service worker generation:
   - Cache static assets with cache-first strategy
   - Use stale-while-revalidate for API responses
   - Pre-cache the landing page, app shell, and common images on first visit
2. Update `NetworkOfflineIndicator` to detect Service Worker state changes:
   - Show "You're offline — cached content available" when SW detects no connection
   - Hide indicator when connection is restored and data re-synced

**Acceptance Criteria:**
- [ ] Service worker registers and caches static assets on first visit
- [ ] Landing page, app shell, and common images are pre-cached
- [ ] API responses use stale-while-revalidate (shows cached data while fetching fresh)
- [ ] Offline indicator shows when connection drops and hides when restored
- [ ] PWA manifest configured for installability (optional but recommended)

**Effort:** 3–5 days  
**Dependencies:** Phase 2 complete (stable routing and component structure)

---

### Task 4.2 — Full WCAG Accessibility Audit (#88, #85, #86, #87 + comprehensive review)

**Audit Items:** #88 (landmarks & ARIA), #85 (keyboard navigation/focus management), #86 (screen reader support for empty states), #87 (focus management post-action)

**Files to Edit/Create:**
- Every route/component in the application
- Create `lib/a11y-audit.ts` — programmatic accessibility checks

**Steps:**
1. **Landmarks & ARIA (#88):** Ensure every page has:
   - Exactly one `<main>` landmark with `id="main-content"`
   - Proper `<nav aria-label="...">` for all navigation regions  
   - "Skip to main content" link (done in Phase 0 Task 0.10 — verify it works on all pages)
2. **Keyboard navigation (#85):** Audit tab order on every page:
   - All interactive elements follow visual reading order (left-to-right, top-to-bottom)
   - No `tabindex` values that create focus traps outside intended scope
3. **Screen reader support (#86):** Add `role="status" aria-live="polite"` to all dynamic content updates:
   - Empty states after search filtering
   - Toast notifications (if not already using Radix UI's built-in announcements)
4. **Focus management (#87):** After form submissions, ensure focus moves to a meaningful element:
   - Auth success → focus on greeting or dashboard entry point
   - Note save → focus on note title area

**Acceptance Criteria:**
- [ ] Every page has proper `<main>`, `<nav aria-label="...">` landmarks
- [ ] "Skip to main content" link works on every page (tested with keyboard only)
- [ ] Tab order follows visual reading order on all 16+ routes
- [ ] Dynamic content updates announce via `aria-live="polite"` for screen readers
- [ ] Focus management after form submissions moves focus to meaningful elements
- [ ] Passes automated WCAG audit tool (axe-core or Lighthouse Accessibility score >= 95)

**Effort:** 3–5 days  
**Dependencies:** Phase 0 Task 0.10 + Phase 2 Task 2.10 + Phase 3 Task 3.7 (foundation accessibility work done — this is the comprehensive audit and final fixes)

---

### Task 4.3 — Full CSS Unification (#89, #90)

**Audit Items:** #89 (card unification — started in Phase 2), #90 (unnecessary CSS module complexity / token inconsistency)

**Files to Edit/Create:**
- Every `.module.css` file across the codebase
- `app/globals.css` or design tokens file

**Steps:**
1. **Audit all CSS modules (#90):** Go through every component's `.module.css` and:
   - Replace hardcoded values with design token variables (`var(--space-4)`, `var(--radius-lg)`, etc.)
   - Remove any Tailwind utility classes that duplicate CSS module styles (pick one approach per component)
2. **Standardize spacing/radius/shadow patterns:** Create a single source of truth for common patterns:
   - Card padding: always `var(--space-4)` or `--space-6`
   - Border radius: always from `--radius-*` tokens
   - Shadows: always from `--shadow-*` tokens
3. **Remove redundant CSS modules:** If a component only has 1–2 custom styles, consider moving them to Tailwind classes directly

**Acceptance Criteria:**
- [ ] Zero hardcoded pixel values for spacing, radius, or shadows (all use design token variables)
- [ ] No component mixes Tailwind utility classes AND CSS module overrides for the same property
- [ ] Card padding/radius/shadow is consistent across all pages (enforced by unified `<Card>` from Phase 2 Task 2.7)
- [ ] Total CSS file count reduced (fewer tiny `.module.css` files with 10–20 lines each)

**Effort:** 3–5 days  
**Dependencies:** Phase 2 Task 2.7 (unified Card component exists — use it as the reference pattern for unification)

---

### Task 4.4 — Rich Text Editor Migration (#50, full refactor from Phase 3 POC)

**Audit Item:** #50 (`document.execCommand` → TipTap/Slate.js/Quill)

**Files to Create/Edit:**
- Replace Notes editor component(s) with new rich-text editor using the library chosen in Phase 3 Task 3.8
- Migrate existing note content from HTML (execCommand output) to the new editor's format (JSON/ProseMirror if TipTap)

**Steps:**
1. **Choose editor:** Based on Phase 3 evaluation, install and configure the selected library:
   - TipTap recommended for its React integration and rich ecosystem
2. **Migrate content:** Write a data migration script to convert existing HTML notes to the new format:
   - Bold → `<strong>`, Italic → `<em>`, Lists → proper list elements, etc.
   - Handle edge cases (nested formatting, custom styles)
3. **Replace editor component:** Swap out `document.execCommand`-based editor with the new rich-text editor
4. **Preserve features:** Ensure all existing functionality works:
   - Auto-save (Phase 1 Task 1.9), undo/redo, presentation mode

**Acceptance Criteria:**
- [ ] Zero instances of `document.execCommand` remain in the codebase
- [ ] All existing notes render correctly in the new editor format (no data loss)
- [ ] All formatting features (bold, italic, lists, code blocks, links) work with the new library
- [ ] Auto-save and undo/redo continue to function after migration
- [ ] Bundle size increase from new library is documented (and justified by long-term maintenance benefits)

**Effort:** 4–8 days  
**Dependencies:** Phase 3 Task 3.8 (POC/evaluation complete), Phase 1 Task 1.9 (auto-save and undo patterns established)

---

### Task 4.5 — Real Analytics & A/B Testing (#90/#91, #91 component API simplification)

**Audit Items:** #90/#91 (analytics infrastructure + component API simplification for data collection)

**Files to Create/Edit:**
- Replace localStorage-based analytics with a real service (PostHog, Plausible, or Google Analytics)
- `lib/analytics.ts` — update to use chosen service's SDK
- Component prop types and contexts (if extracting callback patterns as recommended)

**Steps:**
1. **Choose analytics platform:** Evaluate PostHog vs Plausible vs GA4:
   - PostHog: open-source, feature-rich, self-hostable
   - Plausible: privacy-focused, minimal JS footprint
   - GA4: industry standard but complex and heavy
2. **Migrate tracking:** Replace localStorage-based events with the chosen service's SDK calls
3. **Add event tracking for A/B testing hooks** (if planning to run experiments):
   - Track which variant of CTAs/layouts users see
   - Collect conversion data per variant

**Acceptance Criteria:**
- [ ] Real analytics service integrated and collecting page view + interaction events
- [ ] Migration from localStorage-based tracking is complete (no duplicate or stale data)
- [ ] A/B testing infrastructure available for future experiments (variant tracking, conversion metrics)
- [ ] Analytics dashboard shows meaningful data after 1+ weeks of collection

**Effort:** 2–3 days  
**Dependencies:** Phase 3 Task 3.4 (analytics foundation exists — this is the production-grade migration)

---

### Task 4.6 — Component API Simplification (#91, #92)

**Audit Items:** #91 (long prop lists / callback coupling), #92 (button variant usage guidelines)

**Files to Edit/Create:**
- Components with long prop lists: `ActiveCohortRow`, etc.
- Create `docs/Button.md` — button variant usage guidelines

**Steps:**
1. **Extract callbacks into context/hooks (#91):** For components like ActiveCohortRow that have 8+ callback props:
   - Create a custom hook: `useActiveCohortActions(cohortId)` returns `{ onPause, onReorder, onResume, onDelete }`
   - Replace individual prop drilling with a single context object or hook return value
2. **Document button usage (#92):** Create a `Button.md` guide in the docs folder:
   - Primary CTA → `variant="primary"` (brand color)
   - Secondary action → `variant="outline"` 
   - Tertiary/low-emphasis → `variant="ghost"` or `variant="secondary"`
   - Destructive → `variant="danger"`

**Acceptance Criteria:**
- [ ] Components with 8+ props use context/hook pattern instead of prop drilling
- [ ] Button usage is documented in a reference guide accessible to all developers
- [ ] No visual or behavioral changes to existing buttons (refactoring only)

**Effort:** 2–3 days  
**Dependencies:** Phase 2 Task 2.4 (ActiveCohortRow simplified — fewer callbacks after table simplification)

---

### Task 4.7 — Additional Deferred High-Priority Items

These items from the audit that were deferred from earlier phases due to scope/complexity:

| Item | Description | Effort |
|------|-------------|--------|
| #77 | YouTube IFrame preload during idle time (`requestIdleCallback` or `<link rel="preload">`) | 1–2 days |
| #80 | Play screen scroll conflict prevention on mobile (fixed viewport height) | 1 day |
| #81 | Double-tap zoom conflict resolution in Play screen | 1 day |
| #82 | Mobile font size audit — ensure no text below 14px body / 12px label | 1–2 days |

**Acceptance Criteria:**
- [ ] YouTube IFrame script preloaded during browser idle time
- [ ] Play screen uses `100dvh` with overflow hidden to prevent scroll conflicts on mobile
- [ ] Double-tap detection has sufficient delay/gesture differentiation from regular scrolling
- [ ] No body text below 14px; no labels below 12px anywhere in the app

**Effort:** 3–5 days total  
**Dependencies:** None. Can be done as independent micro-tasks within Phase 4 sprints.

---

### Phase 4 Summary

| Task | Items | Effort | Dependencies |
|------|-------|--------|-------------|
| Service Worker & Offline-First | #78 | 3–5 days | Phase 2 complete |
| Full WCAG Accessibility Audit | #85, #86, #87, #88 + review | 3–5 days | Phase 0 + Phase 1 + Phase 2 + Phase 3 foundation |
| CSS Unification | #89 (full), #90 | 3–5 days | Phase 2 Task 2.7 |
| Rich Text Editor Migration | #50 (full refactor) | 4–8 days | Phase 3 Task 3.8 POC + Phase 1 Task 1.9 |
| Real Analytics & A/B Testing | #90/#91, analytics infra | 2–3 days | Phase 3 Task 3.4 foundation |
| Component API Simplification | #91, #92 | 2–3 days | Phase 2 Task 2.4 |
| Deferred High-Priority Items | #77, #80, #81, #82 | 3–5 days | — (parallel) |

**Phase 4 Total:** ~20–34 days spread over multiple sprints (~Month 2+)  
**Deliverables:** Offline-first app, WCAG 2.1 AA compliant across all routes, unified CSS design system, modern rich text editor, production-grade analytics with A/B testing capability.

---

## Quick Reference: Items by Phase

### Phase 0 — Foundation & Cleanup (14 items)
`#6 · #8 · #14 · #84 (partial) · #97 (partial) · #18 (partial) · #88 (partial) · #118 · #119 · #120 · #122 · #123 + Toast scaffold + Skeleton scaffold`

### Phase 1 — Critical UX Fixes (25 items)
`#7 · #10 · #16 · #18 · #21 · #22 · #35 · #36 · #37 · #38 · #40 · #41 · #47 · #50 (doc) · #51 · #52 · #54 · #62 · #65 · #76 · #79 · #84 · #94 · #97 · #102 · #103 · #105 · #106 · #108 + #111`

### Phase 2 — Core UX Polish (27 items)
`#1 · #3 · #4 · #9 · #11 · #13 · #17 · #19 · #23 · #27 · #28 · #29 · #30 · #31 · #32 · #33 · #34 · #38 (desktop) · #39 · #40 · #41 · #42 · #43 · #44 · #45 · #46 · #47 · #49 · #55 · #56 · #60 · #63 · #64 · #67 · #68 · #69 · #89 · #93 · #95 · #96 · #98`

### Phase 3 — Advanced Features (12 items)
`#2 · #5 · #100 · #101 · #107 · #109 · #114 · #115 · #116 + #99 (streak freeze) + focus trapping for all modals + execCommand POC (#50)`

### Phase 4 — Strategic Long-Term (12 items + deferred Highs)
`#77 · #78 · #80 · #81 · #82 · #85 · #86 · #87 · #88 · #89 · #90 · #91 · #92 + #50 (full migration) + deferred High items from earlier phases`

### Not Assigned to a Phase
None. All 123 audit items are assigned to exactly one phase.

---

## Tracking Checklist

Use this as your sprint planning checklist. Mark each task complete when its acceptance criteria are met.

```markdown
## Phase 0
- [ ] Task 0.1: Remove Dead Code (#8, #118–#120)
- [ ] Task 0.2: Fix Misleading Links (#6, #14)
- [ ] Task 0.3: Remove Mock Data (#122)
- [ ] Task 0.4: Remove Dead Alerts (#123)
- [ ] Task 0.5: Toast Scaffold Component
- [ ] Task 0.6: Skeleton/Shimmer Scaffold Component
- [ ] Task 0.7: Fix Muted Text Color Token (#84 partial)
- [ ] Task 0.8: Fix All-Caps Eyebrow Text (#97 partial)
- [ ] Task 0.9: Promote Guest Button (#18 partial)
- [ ] Task 0.10: Add Skip-to-Content Link (#88 partial)

## Phase 1
- [ ] Task 1.1: Landing CTAs & Interactive Demo (#7, #10)
- [ ] Task 1.2: Auth Form Validation (#16, #21)
- [ ] Task 1.3: Bottom Nav Touch Targets (#22, #79)
- [ ] Task 1.4: Skeleton Loading Screens (#76, #111)
- [ ] Task 1.5: Cmd+K Command Palette (#108, #113)
- [ ] Task 1.6: Error Messages & Empty States (#94, #105, #106)
- [ ] Task 1.7: Toast Feedback for Actions (#102, #103)
- [ ] Task 1.8: Play Screen Fixes (#35, #36, #37, #38, #40, #41)
- [ ] Task 1.9: Notes Critical Issues (#50, #51, #52, #54)
- [ ] Task 1.10: Cohort Progress & Draft (#62, #65)
- [ ] Task 1.11: WCAG Contrast Full Fix (#84 full)

## Phase 2
- [ ] Task 2.1: Navigation & Sidebar Refinement (#1, #3, #4)
- [ ] Task 2.2: Landing Page Copy & Hierarchy (#9, #11, #13)
- [ ] Task 2.3: Auth Form Polish (#17, #19)
- [ ] Task 2.4: Cohorts Table Simplification (#29, #30, #31, #33, #34)
- [ ] Task 2.5: Progress Tracking Enhancements (#27, #98)
- [ ] Task 2.6: Completion Celebration (#28, #32, #96)
- [ ] Task 2.7: Unified Card Component (#89)
- [ ] Task 2.8: Explore Page Refinements (#45, #46, #47, #49)
- [ ] Task 2.9: Notes Tags & Presentation UX (#55, #56)
- [ ] Task 2.10: Cohort Page Polish (#63, #64, #67, #68)
- [ ] Task 2.11: Copy Consistency (#93, #95)
- [ ] Task 2.12: Messaging UX (#70, #72, #74, #75)
- [ ] Task 2.13: Play Screen Polish (#39, #42, #43, #44)

## Phase 3
- [ ] Task 3.1: Reorder Sidebar Nav (#2)
- [ ] Task 3.2: Mobile Cohort Tabs (#5)
- [ ] Task 3.3: Focus Mode (#100)
- [ ] Task 3.4: Analytics Integration (#101, #116)
- [ ] Task 3.5: Command Palette Expansion (#109, #114, #115)
- [ ] Task 3.6: Streak Freeze (#99)
- [ ] Task 3.7: Focus Trapping All Modals (#107 + accessibility)
- [ ] Task 3.8: execCommand Migration POC (#50 research)

## Phase 4
- [ ] Task 4.1: Service Worker & Offline-First (#78)
- [ ] Task 4.2: Full WCAG Accessibility Audit (#85, #86, #87, #88 + review)
- [ ] Task 4.3: CSS Unification (#89 full, #90)
- [ ] Task 4.4: Rich Text Editor Migration (#50 full refactor)
- [ ] Task 4.5: Real Analytics & A/B Testing (analytics infra)
- [ ] Task 4.6: Component API Simplification (#91, #92)
- [ ] Task 4.7: Deferred High-Priority Items (#77, #80, #81, #82)
```

---

## Notes for Implementation

### Parallel Work Strategy
Phases 0 and 1 are designed for **two developers working in parallel**:
- One developer takes infrastructure tasks (Toast scaffold, Skeleton scaffold, Cmd+K command palette)
- The other takes UI/UX task clusters (auth form fixes, Play screen, Notes, Cohort progress)

### Code Review Gates
Before merging any Phase 1 PR:
- Run `npm run build` — must pass with zero errors
- Run accessibility audit (axe-core or Lighthouse) — no new violations introduced
- Test on mobile (<=768px breakpoint) — verify touch targets and responsive layouts

### Definition of Done
For each task, "Done" means:
1. ✅ Code passes `npm run build` with zero errors
2. ✅ All acceptance criteria from the task are met
3. ✅ No regressions in existing functionality (manual or automated test)
4. ✅ PR includes a brief description referencing the audit item number(s)

---

*This plan maps all 123 items from [UX_IMPROVEMENT_AUDIT.md](./UX_IMPROVEMENT_AUDIT.md) to specific implementation phases with files, steps, acceptance criteria, and effort estimates.*
