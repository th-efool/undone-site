# SideQuest HQ — Complete Responsive & Mobile-Native Plan

> **Goal**: Make every page fully responsive for Android/phone users. Transform the desktop web app into something that **feels like a native mobile app** with bottom navigation, touch-friendly targets, forced-landscape video player, and every micro-detail polished.

---

## Table of Contents

1. [Current State Audit](#1--current-state-audit)
2. [Breakpoint & Strategy](#2--breakpoint--strategy)
3. [Foundation: Tokens & Global CSS](#3--foundation-tokens--global-css)
4. [Navigation: Sidebar → Bottom Tab Bar](#4--navigation-sidebar--bottom-tab-bar)
5. [Dashboard Shell Layout](#5--dashboard-shell-layout)
6. [Play Screen — Forced Landscape + Hidden Nav](#6--play-screen--forced-landscape--hidden-nav)
7. [Auth Screen](#7--auth-screen)
8. [Home Screen](#8--home-screen)
9. [Explore Screen](#9--explore-screen)
10. [Cohort Detail Screen](#10--cohort-detail-screen)
11. [Create Cohort Wizard](#11--create-cohort-wizard)
12. [Notes Screen](#12--notes-screen)
13. [Messages Screen](#13--messages-screen)
14. [Landing Page](#14--landing-page)
15. [Shared UI Components](#15--shared-ui-components)
16. [Global Typography & Touch Targets](#16--global-typography--touch-targets)
17. [Global Form Elements](#17--global-form-elements)
18. [Safe Area & Android Config](#18--safe-area--android-config)
19. [Scroll & Overscroll Behaviour](#19--scroll--overscroll-behaviour)
20. [Animations & Performance](#20--animations--performance)
21. [Edge Cases & Gotchas](#21--edge-cases--gotchas)
22. [Testing Checklist](#22--testing-checklist)
23. [File Change Summary](#23--file-change-summary)
24. [Execution Order](#24--execution-order)

---

## 1 · Current State Audit

### Architecture
- **Framework**: Next.js 16 with App Router, Tailwind CSS v4, static export for Capacitor
- **Font**: Geist (sans + mono) via `next/font/google`
- **Design tokens**: Light theme, cream/indigo/orange palette in `tokens.css` (CSS variables)
- **Component styling**: CSS Modules (`.module.css`) — **~175+ CSS module files**
- **State**: Redux Toolkit + React Query
- **Navigation**: Left sidebar (`Sidebar.tsx` → `sidebar.data.ts`) with 5 items: Play, Home, Messages, Explore, Notes
- **Capacitor**: Already configured for Android builds

### What Already Exists for Mobile
- **Sidebar already becomes bottom nav at 768px!** — `Sidebar.module.css` has `@media (max-width: 768px)` that moves sidebar to bottom, `height: 60px`, `flex-direction: row`, hides logo
- **DashboardShell** has `@media (max-width: 768px)` with `flex-direction: column`, `padding-bottom: 68px`
- **Auth screen** hides showcase at `≤ 1100px`
- **Footer** has mobile breakpoints at `768px` and `1100px`
- **Navbar** hides nav links at `768px`
- `globals.css` already imports Tailwind and has `safe-area-inset-left/right` handling
- **Some cohort tabs** have breakpoints at `1100px`, `900px`, `680px`, `560px`
- **Home screen** has breakpoint at `980px`
- `viewport` config has `viewportFit: 'cover'`

### What's MISSING / Broken on Mobile
1. **Play screen** — Full-screen video player designed for desktop. Uses absolute positioning, 36px offsets from edges. On mobile: overlapping controls, unusable layout, video too small, toolbar clips off screen.
2. **Notes screen** — Two-pane `grid-template-columns: 300px 1fr` with absolutely positioned canvas, format bar, zoom controls. On mobile: canvas overflows, toolbar clips, notes panel too narrow.
3. **Messages screen** — Three-column layout (LeftSidebar + Center + CommunityChat/DM). On mobile: columns compress and overflow.
4. **Home screen** — `padding: 16px 42px` only adjusts at 980px. Cards and search bar need more mobile refinement.
5. **Explore screen** — `padding: 16px 42px 56px`, 500px search bar. Similar issues.
6. **Create Cohort wizard** — Multi-step wizard with complex UI (curriculum board, inspector panels, bulk bars). Needs major mobile adaptation.
7. **Cohort detail pages** — Hero, navigation, tabs (overview, questline, archives, events, hall of fame) — some tabs have partial breakpoints but many sub-components don't.
8. **SidebarItem** — 52×52px items are fine for desktop sidebar, but in bottom nav they need labels and different sizing.
9. **Global SearchBar** — Max-width 560px, but not optimized for mobile input ergonomics.
10. **Typography** — Desktop-tuned sizes throughout; no mobile scale.
11. **Horizontal Scroller arrows** — 48px positioned at -24px offset; clips on mobile screens.
12. **Touch targets** — Many interactive elements are under 44px minimum.

---

## 2 · Breakpoint & Strategy

### Primary breakpoint: `768px`
- Already used by Sidebar, DashboardShell, Footer, Navbar
- Covers all Android phones in portrait (max ~430px) and small tablets

### Secondary breakpoints (already in use):
- `1100px` — Auth showcase, cohort tabs, Notes grid, Footer links
- `980px` — Home screen padding
- `900px` — Cohort overview/questline layouts
- `680px` — Cohort hero/navigation
- `560px` — Hall of Fame fine-tuning

### Strategy:
- **Don't change existing breakpoints** — they already work for tablet/desktop transitions
- **Add `@media (max-width: 768px)` rules** to every component that doesn't have them
- **Add `@media (max-width: 480px)` rules** for very narrow phone screens where needed
- For Play screen: add `@media (max-width: 768px) and (orientation: landscape)` for forced-landscape mode

---

## 3 · Foundation: Tokens & Global CSS

### File: `src/app/styles/tokens.css` — Add to `:root`

```css
/* ── Mobile / Bottom Nav ──────────────────────────────── */
--bottom-nav-height: 60px;                  /* matches existing Sidebar mobile height */
--safe-area-bottom: env(safe-area-inset-bottom, 0px);
--safe-area-top: env(safe-area-inset-top, 0px);
--touch-target-min: 44px;

/* ── Mobile spacing ───────────────────────────────────── */
--mobile-page-padding: var(--space-4);      /* 16px */
--mobile-section-gap: var(--space-4);       /* 16px */
--mobile-card-padding: var(--space-3);      /* 12px */
```

> [!NOTE]
> Not adding mobile typography tokens because the existing type scale with `clamp()` values (e.g., `clamp(var(--text-5xl), 7vw, var(--display-md))`) already handles fluid sizing. We'll add targeted overrides per-component.

### File: `src/app/globals.css` — Add

```css
/* ── Mobile touch & overscroll ────────────────────────── */
* {
  -webkit-tap-highlight-color: transparent;
}

html, body {
  overscroll-behavior: none;   /* prevent pull-to-refresh in Capacitor */
}

@media (max-width: 768px) {
  html, body {
    overflow-x: hidden;        /* prevent accidental horizontal scroll */
  }
}
```

---

## 4 · Navigation: Sidebar → Bottom Tab Bar

### Current state
The Sidebar already transforms into a bottom bar at 768px! Here's what it does:
- Moves to `position: fixed; bottom: 0`
- Becomes horizontal flex row
- Height: 60px
- Hides logo
- Items become centered icons

### What's MISSING from the current bottom nav:

| Issue | Fix |
|---|---|
| **No labels under icons** | Add text labels below each icon for native app feel |
| **No active indicator dot** | Add accent-coloured pill/dot under active icon |
| **No safe-area-bottom padding** | Add `padding-bottom: env(safe-area-inset-bottom)` to the bar |
| **Items are 52×52 with no label** | Restructure to icon + small label column layout |
| **No tap feedback** | Add `:active` scale transform |
| **Shows on /play** | Should hide on the Play page |
| **Keyboard hides it?** | Should hide when virtual keyboard is open |

### File: `src/client/components/global/Sidebar/Sidebar.module.css` — Mobile additions

```css
@media (max-width: 768px) {
  .sidebar {
    /* EXISTING: already position: fixed, bottom: 0, height: 60px, etc. */
    /* ADD: */
    height: calc(60px + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
}
```

### File: `src/client/components/global/Sidebar/SidebarItem.tsx` — Add labels

The `SidebarItem` currently renders only an icon. On mobile, it needs a label:

```tsx
// Add a label <span> that's hidden on desktop, shown on mobile
<Link href={href} aria-label={label} className={...}>
  <Icon size={22} strokeWidth={2} />
  <span className={styles.label}>{label}</span>   // NEW
</Link>
```

### File: `src/client/components/global/Sidebar/SidebarItem.module.css` — Add

```css
.label {
  display: none;  /* hidden on desktop */
}

@media (max-width: 768px) {
  .item {
    flex-direction: column;
    width: auto;
    height: auto;
    min-width: var(--touch-target-min);
    min-height: var(--touch-target-min);
    padding: var(--space-1) var(--space-2);
    gap: 2px;
  }

  .item svg {
    width: 20px;
    height: 20px;
  }

  .label {
    display: block;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: inherit;
  }

  .active {
    background: var(--color-brand-soft);
  }

  /* Tap feedback */
  .item:active {
    transform: scale(0.92);
    transition: transform 100ms ease;
  }
}
```

### Play Page — Hide Bottom Nav

In `Sidebar.tsx`, detect the `/play` route and hide on mobile:

```tsx
'use client';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const pathname = usePathname();
  const isPlayPage = pathname === '/play';

  return (
    <aside className={clsx(styles.sidebar, isPlayPage && styles.hiddenOnMobile)}>
      ...
    </aside>
  );
}
```

```css
@media (max-width: 768px) {
  .hiddenOnMobile {
    display: none !important;
  }
}
```

### Keyboard Detection

Use `visualViewport` API to hide nav when keyboard opens:

```tsx
// In Sidebar.tsx
useEffect(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  const handler = () => {
    const keyboardOpen = vv.height < window.innerHeight * 0.75;
    sidebarRef.current?.classList.toggle(styles.keyboardHidden, keyboardOpen);
  };
  vv.addEventListener('resize', handler);
  return () => vv.removeEventListener('resize', handler);
}, []);
```

```css
@media (max-width: 768px) {
  .keyboardHidden {
    transform: translateY(100%);
    transition: transform var(--duration-fast) var(--ease-standard);
  }
}
```

---

## 5 · Dashboard Shell Layout

### File: `src/client/components/global/DashboardShell/DashboardShell.module.css`

**Current mobile styles:**
```css
@media (max-width: 768px) {
  .shell { flex-direction: column; }
  .sidebar { flex: 0 0 auto; }
  .content {
    padding-left: 0;
    padding-bottom: 68px;
  }
}
```

**Additions:**
```css
@media (max-width: 768px) {
  .content {
    padding-bottom: calc(var(--bottom-nav-height) + var(--safe-area-bottom));
    width: 100%;
    min-height: calc(100vh - var(--bottom-nav-height));
    -webkit-overflow-scrolling: touch;
  }
}
```

### Play Page Exception
When on `/play`, the content area should take full screen (no bottom padding since nav is hidden). This is handled by the Play component itself going `position: fixed; inset: 0`.

---

## 6 · Play Screen — Forced Landscape + Hidden Nav

This is the most complex and critical change.

### Current Architecture
- `Play.tsx` — Full-screen video player with:
  - `PlayerSurface` (YouTube embed container)
  - `LessonCard` (top-left overlay)
  - `PlayerToolbar` (right side — bookmark, speed, capture, scribe)
  - `LearningTimeline` (bottom scrubber)
  - `PlaybackControls` (bottom — play/pause, skip, volume, next/prev)
  - Idle auto-hide (4s timeout)
  - Wheel/keyboard navigation for lesson feed
- CSS: `height: calc(100vh - 16px)`, everything positioned `absolute` with `36px` offsets

### Mobile Requirements
1. **Bottom nav is completely hidden** (handled in Section 4)
2. **Force landscape orientation** in Capacitor WebView
3. **Portrait fallback** must still work (stacked layout)
4. **Controls must be touch-friendly** (44px+ tap targets)
5. **Toolbar items must reflow** for small screens

### 6.1 · Forcing Landscape

In `Play.tsx`:
```tsx
useEffect(() => {
  const lockOrientation = async () => {
    try {
      await screen.orientation.lock('landscape');
    } catch {
      // Fallback: works in portrait too
    }
  };

  if (window.innerWidth <= 768) {
    lockOrientation();
    document.body.style.overflow = 'hidden'; // prevent scroll
  }

  return () => {
    screen.orientation.unlock?.();
    document.body.style.overflow = '';
  };
}, []);
```

> [!WARNING]
> `screen.orientation.lock()` requires fullscreen in browsers but works natively in Capacitor WebView. The try/catch handles gracefully.

### 6.2 · Mobile Play Layout

**File: `src/client/components/screens/dashboard/play/Play.module.css`**

```css
@media (max-width: 768px) {
  .play {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    padding: 0;
    position: fixed;
    inset: 0;
    z-index: 1000;  /* above everything including bottom nav */
  }

  /* LessonCard — move to top-left, smaller */
  .lessonCard {
    top: 12px;
    left: 12px;
    max-width: 55%;
  }

  /* Toolbar — move from right to bottom-right, horizontal */
  .toolbar {
    top: auto;
    right: 12px;
    bottom: 80px;
    transform: none;
  }

  /* Timeline — full width, smaller offsets */
  .timeline {
    left: 12px;
    right: 12px;
    bottom: 56px;
  }

  /* Controls — compact, full width */
  .controls {
    left: 12px;
    right: 12px;
    bottom: 8px;
  }

  /* Queue drawer — full width bottom sheet */
  .queueDrawer {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-height: 50vh;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }

  /* Notes panel — full width bottom sheet */
  .notesPanel {
    top: auto;
    right: 0;
    left: 0;
    bottom: 0;
    width: 100%;
    max-height: 50vh;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }
}
```

### 6.3 · PlayerSurface Mobile
**File: `src/client/components/screens/dashboard/play/components/PlayerSurface/PlayerSurface.module.css`**

The player surface needs to fill the full viewport on mobile:
```css
@media (max-width: 768px) {
  .surface {
    border-radius: 0;    /* remove desktop border radius */
    height: 100vh;
    height: 100dvh;
  }
}
```

### 6.4 · PlaybackControls Mobile
**File: `src/client/components/screens/dashboard/play/components/PlaybackControls/PlaybackControls.module.css`**

```css
@media (max-width: 768px) {
  /* Make all control buttons touch-friendly */
  .controlBtn {
    min-width: var(--touch-target-min);
    min-height: var(--touch-target-min);
  }

  /* Compact the layout */
  .controls {
    gap: var(--space-2);
    padding: var(--space-2);
  }
}
```

### 6.5 · PlayerToolbar Mobile
**File: `src/client/components/screens/dashboard/play/components/PlayerToolbar/PlayerToolbar.module.css`**

```css
@media (max-width: 768px) {
  .toolbar {
    flex-direction: row;    /* horizontal on mobile */
    gap: var(--space-2);
  }

  .toolbarBtn {
    min-width: var(--touch-target-min);
    min-height: var(--touch-target-min);
  }
}
```

### 6.6 · LessonCard Mobile
**File: `src/client/components/screens/dashboard/play/components/LessonCard/LessonCard.module.css`**

```css
@media (max-width: 768px) {
  .card {
    max-width: 200px;
    padding: var(--space-2) var(--space-3);
  }

  .title {
    font-size: var(--text-sm);
    -webkit-line-clamp: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
```

### 6.7 · LearningTimeline Mobile
**File: `src/client/components/screens/dashboard/play/components/LearningTimeline/LearningTimeline.module.css`**

```css
@media (max-width: 768px) {
  .timeline {
    height: 4px;  /* slightly thicker for touch */
  }

  /* Make scrubber thumb larger for touch */
  .thumb {
    width: 16px;
    height: 16px;
  }
}
```

### 6.8 · Pause/Play Overlay
The inline-styled pause overlay in `Play.tsx` (80x80px circle with Play icon) needs to be smaller on mobile:

```tsx
// Change to responsive sizing
width: window.innerWidth <= 768 ? 60 : 80,
height: window.innerWidth <= 768 ? 60 : 80,
```

Better: Extract to a CSS-styled component instead of inline styles.

### Micro-details
| Detail | Decision |
|---|---|
| **Swipe gestures** | Wheel handler already exists; add touch swipe for next/prev lesson |
| **Video tap to play/pause** | Already handled by click overlay |
| **Double-tap to seek** | Stretch goal — detect double-tap on left/right halves |
| **Volume control** | Keep as-is; system volume is primary on mobile |
| **Speed button** | Already cycles speeds; keep accessible in toolbar |
| **Back navigation** | Android hardware back should exit play (handled by CapacitorBridge's back button listener) |

---

## 7 · Auth Screen

### Current Architecture
- `Auth.tsx` — Grid: `minmax(0, 1fr) 520px`
  - Left: `AuthShowcase` (community grid, floating phone, featured content, highlights)
  - Right: `AuthForm` (header, OAuth providers, inputs, buttons, legal, stats, footer)
- At `≤ 1100px`: Showcase is hidden, panel centers

### What's Missing at 768px
The showcase is already hidden, but the form panel needs mobile refinement.

### File: `src/client/components/screens/auth/authForm/authForm.module.css`

```css
@media (max-width: 768px) {
  .form {
    padding: 20px 16px;
    border-radius: 0;  /* full screen, no rounded corners */
    min-height: 100vh;
    min-height: 100dvh;
  }

  .title {
    font-size: clamp(1.8rem, 6vw, 2.5rem);
  }

  .description {
    font-size: var(--text-base);
  }

  .login {
    font-size: var(--text-sm);
  }

  .oauth {
    margin-top: 16px;
  }

  .footer {
    padding-top: 16px;
  }
}
```

### File: `src/client/components/screens/auth/authForm/authButton.module.css`

```css
@media (max-width: 768px) {
  .button {
    min-height: var(--touch-target-min);
    width: 100%;
    font-size: var(--text-base);
  }
}
```

### File: `src/client/components/screens/auth/authForm/authInput.module.css`

```css
@media (max-width: 768px) {
  .input {
    min-height: var(--touch-target-min);
    font-size: 16px !important;  /* prevent iOS auto-zoom */
  }

  .eyeBtn {
    min-width: var(--touch-target-min);
    min-height: var(--touch-target-min);
  }
}
```

### File: `src/client/components/screens/auth/authForm/authProviders.module.css`

```css
@media (max-width: 768px) {
  .providers {
    flex-direction: column;  /* stack OAuth buttons vertically */
    gap: var(--space-2);
  }

  .providerBtn {
    min-height: var(--touch-target-min);
    width: 100%;
  }
}
```

### File: `src/client/components/screens/auth/authForm/authStats.module.css`

```css
@media (max-width: 768px) {
  .stats {
    grid-template-columns: 1fr;  /* stack stats vertically */
    gap: var(--space-2);
  }
}
```

---

## 8 · Home Screen

### Current Architecture
- `Home.tsx` — SearchBar + HomeHero + SummaryCards + ActiveCohorts + ContinueLater + RecentlyCompleted
- Already has `@media (max-width: 980px)` for padding change

### File: `src/client/components/screens/dashboard/home/Home.module.css`

```css
@media (max-width: 768px) {
  .home {
    padding: 12px 16px 24px;
    gap: 16px;
  }

  .searchBar {
    width: 100%;
    margin-bottom: 0;
    order: -1;  /* move search to top */
  }
}
```

### Sub-components to modify:

#### HomeHero
```css
@media (max-width: 768px) {
  .hero { padding: var(--space-4); }
  .heading { font-size: clamp(1.4rem, 5vw, 2rem); }
}
```

#### SummaryCards
```css
@media (max-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);  /* 2-column on mobile */
    gap: var(--space-3);
  }
  .card { padding: var(--space-3); }
}

@media (max-width: 380px) {
  .grid {
    grid-template-columns: 1fr;  /* 1-column on very narrow */
  }
}
```

#### ActiveCohorts / ActiveCohortRow
```css
@media (max-width: 768px) {
  .cohortRow {
    flex-direction: column;
    gap: var(--space-2);
  }
  .actions {
    width: 100%;
    justify-content: flex-end;
  }
}
```

#### ContinueLater / ContinueLaterCard
```css
@media (max-width: 768px) {
  .cardGrid {
    grid-template-columns: 1fr;
  }
  .card { padding: var(--mobile-card-padding); }
}
```

#### RecentlyCompleted / CompletedCourseCard
```css
@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
```

---

## 9 · Explore Screen

### Current Architecture
- `Explore.tsx` — SearchBar + ExploreHero + PeopleFinishing + BrowseTopics + TrendingSideQuests + RecentlyPublished
- Padding: `16px 42px 56px`, SearchBar: 500px

### File: `src/client/components/screens/dashboard/explore/Explore.module.css`

```css
@media (max-width: 768px) {
  .explore {
    padding: 12px 16px 24px;
    gap: 16px;
  }

  .searchBar {
    width: 100%;
    margin-bottom: 0;
  }
}
```

### Sub-components:

#### ExploreHero
```css
@media (max-width: 768px) {
  .hero { padding: var(--space-4); }
  .heading { font-size: clamp(1.6rem, 5vw, 2.2rem); }
  .subheading { font-size: var(--text-base); }
}
```

#### BrowseTopics / TopicChip
```css
@media (max-width: 768px) {
  .topics {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: var(--space-2);
  }
  .topics::-webkit-scrollbar { display: none; }
  .chip {
    flex-shrink: 0;
    min-height: var(--touch-target-min);
  }
}
```

#### TrendingSideQuests / SideQuestCard
```css
@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .card {
    padding: var(--mobile-card-padding);
  }
}
```

#### PeopleFinishing / TrendingCourseCard
```css
@media (max-width: 768px) {
  /* Horizontal scroll instead of grid */
  .grid {
    display: flex;
    overflow-x: auto;
    gap: var(--space-3);
    scrollbar-width: none;
    padding-bottom: var(--space-2);
  }
  .grid::-webkit-scrollbar { display: none; }
  .card {
    flex-shrink: 0;
    width: 260px;
  }
}
```

#### RecentlyPublished / ArticleCard
```css
@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
```

#### SectionHeader (Explore version)
```css
@media (max-width: 768px) {
  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
  .title { font-size: var(--text-xl); }
}
```

---

## 10 · Cohort Detail Screen

### Current Architecture
- `Cohort.tsx` wraps `CohortLayout` → CohortHero + CohortNavigation + Tab Content
- Has partial breakpoints in Hero (1180px, 680px), Layout (900px), Navigation (680px)

### CohortHero
```css
@media (max-width: 768px) {
  .hero {
    padding: var(--space-4);
    border-radius: 0;
  }
  .title { font-size: clamp(1.3rem, 5vw, 1.8rem); }
  .statsGrid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-2);
  }
  .actions {
    flex-direction: column;
    width: 100%;
  }
  .actionBtn {
    width: 100%;
    min-height: var(--touch-target-min);
  }
}
```

### CohortNavigation
```css
@media (max-width: 768px) {
  .nav {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    white-space: nowrap;
    gap: 0;
  }
  .nav::-webkit-scrollbar { display: none; }
  .navItem {
    flex-shrink: 0;
    min-height: var(--touch-target-min);
    padding: var(--space-2) var(--space-4);
  }
}
```

### CohortLayout
```css
@media (max-width: 768px) {
  .layout {
    grid-template-columns: 1fr;  /* single column, no sidebar */
  }
  .sidebar { display: none; }  /* hide ProgressSidebar on mobile */
}
```

### Tab pages (Overview, Questline, Archives, Events, Hall of Fame)
Each tab needs `@media (max-width: 768px)` to:
- Stack multi-column layouts to single column
- Make cards full-width
- Adjust padding to `var(--mobile-page-padding)`
- Make interactive elements ≥ 44px
- Make horizontal scrollers touch-friendly

> [!IMPORTANT]
> There are **29 cohort-related CSS module files**. Each needs auditing. Many already have breakpoints at 1100px/900px but need additional 768px rules.

---

## 11 · Create Cohort Wizard

### Current Architecture
- Multi-step wizard: Identity → Topic → Sources → Curriculum → Details → Launch
- Complex sub-components: CurriculumBoard, CurriculumStep, Inspector, BulkBar, etc.
- **27 CSS module files** for this feature alone

### Strategy
On mobile, the wizard should become a **single-column vertical flow**:

```css
@media (max-width: 768px) {
  /* Wizard stepper — horizontal scroll */
  .stepper {
    overflow-x: auto;
    flex-wrap: nowrap;
  }

  /* Each step page — full width */
  .stepContent {
    padding: var(--mobile-page-padding);
  }

  /* Curriculum board — single column */
  .board {
    grid-template-columns: 1fr;
  }

  /* Inspector panel — bottom sheet overlay instead of side panel */
  .inspector {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 60vh;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    z-index: var(--z-modal);
  }

  /* Curriculum step items — stack vertically */
  .stepItem {
    flex-direction: column;
    gap: var(--space-2);
  }

  /* Footer wizard navigation — sticky bottom */
  .wizardFooter {
    position: sticky;
    bottom: 0;
    padding: var(--space-3) var(--space-4);
  }

  .wizardFooter button {
    min-height: var(--touch-target-min);
    flex: 1;
  }

  /* Import workspace — full width */
  .importArea {
    padding: var(--space-4);
  }

  /* Learner preview — hide device frame, show mobile viewport */
  .previewFrame {
    width: 100%;
    height: auto;
  }
}
```

> [!WARNING]
> The Create Cohort wizard is extremely complex. We should aim for **functional on mobile** rather than pixel-perfect. The core flow (name → description → add sources → arrange curriculum → launch) must work. Advanced features like drag-and-drop curriculum reordering may need simplified alternatives (up/down buttons) on mobile.

---

## 12 · Notes Screen

### Current Architecture
- Two-pane: Left panel (300px grid) + Workspace (canvas with absolute positioning)
- Panel has: header, toolbar (4-col grid), search, notebook list, filter nav
- Workspace has: topbar, canvas search, format toolbar, canvas area, bottom tools, zoom controls
- At 1100px: grid shrinks to 290px, canvas insets adjust

### Mobile Strategy: Full-screen single-pane navigation

On mobile (≤ 768px), switch between three views:
1. **Notebook list** — full-screen list of notebooks and notes
2. **Note editor** — full-screen editor with back button
3. **Presentation mode** — already works full-screen

### File: `src/client/components/screens/dashboard/notes/Notes.module.css`

```css
@media (max-width: 768px) {
  .notes {
    grid-template-columns: 1fr;
    height: calc(100vh - var(--bottom-nav-height));
    height: calc(100dvh - var(--bottom-nav-height));
  }

  /* Panel takes full screen when visible */
  .panel {
    width: 100%;
    border-right: none;
    position: absolute;
    inset: 0;
    z-index: 10;
    overflow-y: auto;
  }

  .panel[data-hidden] {
    display: none;
  }

  /* Workspace takes full screen */
  .workspace {
    position: relative;
    overflow: auto;
  }

  .workspace[data-hidden] {
    display: none;
  }

  /* Toolbar — 2x2 grid instead of 4-col */
  .toolbar {
    grid-template-columns: repeat(2, 1fr);
  }

  /* Canvas — fill available space, no absolute positioning */
  .canvas {
    position: relative;
    inset: auto;
    margin: var(--space-3);
    padding: var(--space-4);
    min-height: 300px;
  }

  /* Format toolbar — horizontal scroll */
  .format {
    position: relative;
    top: auto;
    left: auto;
    overflow-x: auto;
    width: 100%;
    border-radius: 0;
  }

  /* Canvas search — full width */
  .canvasSearch {
    position: relative;
    top: auto;
    left: auto;
    width: 100%;
    margin: var(--space-2) 0;
  }

  /* Bottom tools — full width, smaller */
  .bottomTools {
    position: relative;
    bottom: auto;
    left: auto;
    transform: none;
    width: 100%;
    justify-content: center;
  }

  /* Zoom — hide or simplify on mobile */
  .zoom {
    display: none;
  }

  /* Topbar — add back button area */
  .topbar {
    height: auto;
    flex-wrap: wrap;
    padding: var(--space-3);
  }

  .actions {
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .actions button {
    min-height: 38px;
    padding: 0 12px;
  }
}
```

### Notes.tsx — Mobile view switching

```tsx
// Add state management for mobile view
const [mobileView, setMobileView] = useState<'panel' | 'workspace'>('panel');
const isMobile = useIsMobile();  // new hook

// When selecting a note, switch to workspace on mobile
const handleSelectNote = (id: string) => {
  notes.actions.selectNote(id);
  if (isMobile) setMobileView('workspace');
};

// Back button in workspace returns to panel
const handleBack = () => {
  setMobileView('panel');
};
```

---

## 13 · Messages Screen

### Current Architecture
The Messages screen is the most complex — it has multiple sub-views:
- `Message.tsx` — Container
- **LeftSidebar**: ConversationList with filters, search, conversation items
- **Center**: SearchHeader, LiveNow, RecentMessages, LiveCard
- **CommunityChat**: ChannelTabs, CommunityHeader, MessageTimeline, MessageComposer, CommunitySidebar, etc.
- **DMConversation**: DMHeader, DMBubble, DMComposer, AboutCard, DMProfileSidebar

### Mobile Strategy
- **Default view**: Conversation list (LeftSidebar full-screen)
- **Tap conversation**: Full-screen chat (CommunityChat or DMConversation)
- **Back button**: Returns to conversation list
- **Community sidebar / profile sidebar**: Hidden or bottom sheet

### File: `src/client/components/screens/dashboard/message/Message.module.css`

```css
@media (max-width: 768px) {
  .message {
    grid-template-columns: 1fr;  /* single column */
    height: calc(100vh - var(--bottom-nav-height));
    height: calc(100dvh - var(--bottom-nav-height));
  }
}
```

### LeftSidebar
```css
@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    height: 100%;
    border-right: none;
  }
  .sidebar[data-hidden] { display: none; }

  .conversationItem {
    min-height: var(--touch-target-min);
    padding: var(--space-3);
  }
}
```

### CommunityChat
```css
@media (max-width: 768px) {
  .chat {
    width: 100%;
    height: 100%;
  }
  .chat[data-hidden] { display: none; }

  /* Hide community sidebar on mobile */
  .communitySidebar { display: none; }

  /* Composer — larger, sticky bottom */
  .composer {
    position: sticky;
    bottom: 0;
    padding: var(--space-2) var(--space-3);
  }
  .composerInput {
    min-height: var(--touch-target-min);
    font-size: 16px;
  }
  .sendBtn {
    min-width: var(--touch-target-min);
    min-height: var(--touch-target-min);
  }

  /* Message bubbles — more compact */
  .bubble {
    max-width: 85%;
  }

  /* Channel tabs — horizontal scroll */
  .tabs {
    overflow-x: auto;
    flex-wrap: nowrap;
    scrollbar-width: none;
  }
}
```

### DMConversation
```css
@media (max-width: 768px) {
  .dm {
    width: 100%;
    height: 100%;
  }
  .dm[data-hidden] { display: none; }
  .profileSidebar { display: none; }
}
```

### Message.tsx — Mobile view switching

Similar to Notes:
```tsx
const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
```

---

## 14 · Landing Page

### Current Architecture
- `Hero` section with video background, navbar, floating icons, content, ticker
- `Ikigai` section with timeline, feature section, progress section
- `Footer` section

### Hero Section
The hero already uses `clamp()` for typography and is fairly responsive. Key fixes:

```css
/* heroNavbar.module.css */
@media (max-width: 768px) {
  .navbar {
    padding: var(--space-3) var(--space-4);
  }
  /* Already hides nav links via Navbar component */
}

/* heroContent.module.css */
@media (max-width: 768px) {
  .content {
    padding: var(--space-4);
    text-align: center;
  }
  .ctaButtons {
    flex-direction: column;
    width: 100%;
  }
  .ctaButton {
    width: 100%;
    min-height: var(--touch-target-min);
  }
}

/* heroFloatingContentIcons.module.css */
@media (max-width: 768px) {
  .icons {
    display: none;  /* floating icons clutter mobile */
  }
}

/* heroTicker.module.css */
@media (max-width: 768px) {
  .ticker {
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
}
```

### Ikigai Section
```css
/* ikigaiTimeline.module.css */
@media (max-width: 768px) {
  .timeline {
    padding: var(--space-4);
  }
  .momentCards {
    flex-direction: column;
  }
}

/* FeatureSection.module.css */
@media (max-width: 768px) {
  .feature {
    grid-template-columns: 1fr;
  }
  .screenshot {
    max-width: 100%;
    order: -1;  /* image first on mobile */
  }
}

/* ProgressSection.module.css */
@media (max-width: 768px) {
  .calendars {
    flex-direction: column;
    gap: var(--space-3);
  }
}
```

---

## 15 · Shared UI Components

### Badge Component
```css
/* Badge.module.css — no changes needed, already inline-flex */
```

### Button Component
```css
/* Button.module.css */
@media (max-width: 768px) {
  .root {
    min-height: var(--touch-target-min);
  }
  .block {
    width: 100%;
  }
}
```

### Typography Components (Heading, Text)
```css
/* No changes needed — they use token-based sizing which already works */
```

### HorizontalScroller
```css
/* HorizontalScroller.module.css */
@media (max-width: 768px) {
  .arrow {
    display: none;  /* hide arrow buttons on mobile, use swipe instead */
  }
}
```

### SearchBar
```css
/* SearchBar.module.css */
@media (max-width: 768px) {
  .searchBar {
    max-width: 100%;
  }
  .inputShell {
    height: var(--touch-target-min);
  }
  .shortcut {
    display: none;  /* hide ⌘K shortcut on mobile */
  }
}
```

### PillInput
```css
/* PillInput.module.css */
@media (max-width: 768px) {
  .shell {
    min-height: var(--touch-target-min);
  }
  .field {
    font-size: 16px;  /* prevent auto-zoom */
  }
}
```

### ProviderBadge
```css
/* No changes needed — already compact */
```

### Logo
```css
/* Logo.module.css */
@media (max-width: 768px) {
  .logoFrame {
    width: 44px;
    height: 44px;
    border-radius: 14px;
  }
  .title { font-size: var(--text-base); }
  .tagline { display: none; }
}
```

---

## 16 · Global Typography & Touch Targets

### File: `src/app/styles/typography.css`

```css
@media (max-width: 768px) {
  h1 { font-size: clamp(var(--text-3xl), 7vw, var(--text-5xl)); }
  h2 { font-size: clamp(var(--text-2xl), 5vw, var(--text-4xl)); }
  h3 { font-size: clamp(var(--text-xl), 4vw, var(--text-2xl)); }
  h4 { font-size: var(--text-xl); }
  h5 { font-size: var(--text-lg); }
  h6 { font-size: var(--text-base); }

  p { font-size: var(--text-sm); }
}
```

### File: `src/app/styles/accessibility.css`

```css
@media (max-width: 768px) {
  /* Disable text selection on interactive elements */
  nav, button, [role="button"], a {
    user-select: none;
    -webkit-user-select: none;
  }

  /* Disable long-press callout */
  nav a, button {
    -webkit-touch-callout: none;
  }
}
```

---

## 17 · Global Form Elements

### File: `src/app/styles/forms.css`

```css
@media (max-width: 768px) {
  input,
  select {
    height: var(--touch-target-min);  /* bump from 2.75rem to 44px */
    font-size: 16px;                  /* prevent iOS auto-zoom */
  }

  textarea {
    min-height: 6rem;
    font-size: 16px;
  }

  fieldset {
    gap: var(--space-3);
  }

  /* Scrollbars — thinner on mobile */
  ::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
}
```

---

## 18 · Safe Area & Android Config

### Already handled:
- `globals.css` has `env(safe-area-inset-left/right)` padding
- `viewport` config has `viewportFit: 'cover'`
- `themeColor: '#FAF7F2'` (cream background)

### Additional needed:

#### File: `src/app/globals.css`
```css
@supports (padding: max(0px)) {
  body {
    /* EXISTING: padding-left/right for safe areas */
    /* ADD: */
    padding-top: env(safe-area-inset-top, 0px);
  }
}
```

#### Android `styles.xml`
Verify these are set for edge-to-edge display:
```xml
<style name="AppTheme" parent="Theme.AppCompat.NoActionBar">
  <item name="android:statusBarColor">@android:color/transparent</item>
  <item name="android:navigationBarColor">@android:color/transparent</item>
  <item name="android:windowDrawsSystemBarBackgrounds">true</item>
</style>
```

---

## 19 · Scroll & Overscroll Behaviour

Already added in Section 3 (globals.css):
```css
html, body { overscroll-behavior: none; }
```

Additional per-component:
```css
/* For any container with internal scrolling on mobile */
@media (max-width: 768px) {
  .scrollable {
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }

  /* Body lock when sheets/modals are open */
  body.sheet-open {
    overflow: hidden;
    position: fixed;
    width: 100%;
  }
}
```

---

## 20 · Animations & Performance

```css
@media (max-width: 768px) {
  /* Promote fixed/transformed elements to GPU layer */
  .sidebar,
  .bottomSheet {
    will-change: transform;
  }

  /* Simplify card transitions (remove box-shadow, keep transform) */
  .card:hover {
    transform: none;     /* disable hover on touch */
    box-shadow: none;
  }
  .card:active {
    transform: scale(0.98);
    transition: transform 100ms ease;
  }
}
```

---

## 21 · Edge Cases & Gotchas

### 21.1 · Font Size 16px for Inputs
- iOS Safari auto-zooms on input focus if font-size < 16px
- All mobile inputs must be `font-size: 16px`
- Already handled in global forms.css mobile rules

### 21.2 · 100vh vs 100dvh
- `100vh` on Android Chrome includes the URL bar
- `100dvh` adjusts dynamically — already used in some places
- Ensure all full-height containers use `100dvh` with `100vh` fallback

### 21.3 · Tailwind CSS v4 Interaction
- The project uses Tailwind v4 (imported via `@import 'tailwindcss'`)
- Some components might use Tailwind utility classes
- CSS Module rules will override Tailwind defaults due to specificity
- The body uses Tailwind classes: `min-h-screen bg-background text-text font-sans antialiased`

### 21.4 · CapacitorBridge Back Button
- Already handles Android back button: `canGoBack ? window.history.back() : App.exitApp()`
- On Play page, back should exit landscape and navigate back
- This should work naturally since orientation unlock is in the cleanup function

### 21.5 · Static Export Compatibility
- `output: 'export'` for mobile builds means no SSR
- `useIsMobile` hook must handle SSR (initial state = false) — but in export mode, always runs client-side
- Still safe to use `typeof window !== 'undefined'` checks

### 21.6 · Horizontal Overflow
- Multiple components have fixed widths that can cause horizontal scroll
- Global `overflow-x: hidden` on html/body catches these
- But the root cause should be fixed in each component

### 21.7 · Keyboard on Messages/Notes
- When composer/editor is focused, the virtual keyboard pushes up content
- The bottom nav should hide (handled by visualViewport detection)
- The composer should remain visible above the keyboard
- Android's default `resize` viewport behavior handles this, but `position: fixed` elements may need adjustment

### 21.8 · Play Screen Wheel Events on Mobile
- The Play component uses `onWheel` for lesson navigation
- On mobile, this won't fire — need touch swipe detection
- Add `touchstart`/`touchend` handlers for vertical swipe to change lessons

### 21.9 · Context Menus & Long Press
- Links and images trigger native context menu on long press
- On interactive elements (nav, buttons, cards), disable with:
  ```css
  -webkit-touch-callout: none;
  user-select: none;
  ```
- Keep enabled on content areas (notes body, messages)

### 21.10 · Print Styles
- Already handled — hides nav, aside, footer on print
- No mobile-specific print changes needed

### 21.11 · CohortNavigation Sticky Positioning
- `CohortNavigation` is sticky — on mobile with bottom nav, ensure it doesn't conflict
- Should stick below the status bar, not overlap with it

### 21.12 · Landscape on Non-Play Pages
- Users might rotate to landscape on other pages
- Bottom nav stays at bottom, content scrolls normally
- 60px nav height on a ~360px landscape viewport is 16% — acceptable

### 21.13 · Large Form on Create Cohort
- The curriculum board with drag-and-drop is desktop-centric
- On mobile: disable drag, provide up/down buttons for reordering
- The inspector panel becomes a bottom sheet

### 21.14 · YouTube Embeds in Play
- The `PlayerSurface` contains YouTube iframes
- YouTube's own mobile controls work well — don't interfere
- `allowFullScreen` attribute lets users use YouTube's native fullscreen if needed

---

## 22 · Testing Checklist

### Devices
- [ ] Android phone 360px (Pixel 7) — portrait & landscape
- [ ] Android phone 412px (Samsung S24) — portrait & landscape
- [ ] Capacitor WebView (Android emulator & real device)
- [ ] Chrome DevTools mobile emulation (iPhone SE, Pixel 5, Galaxy S8)
- [ ] Desktop browser (regression — nothing should change above 768px)
- [ ] iPad Mini / tablet (verify intermediate breakpoints still work)

### Per-Page Checks
- [ ] **Landing**: Hero stacks properly, floating icons hidden, CTAs full-width, footer links stack
- [ ] **Auth**: Form full-screen, inputs 44px+ height, OAuth buttons stack, 16px font on inputs
- [ ] **Home**: Cards stack, search full-width, hero compact, summary cards 2-col, cohort rows stack
- [ ] **Explore**: Search full-width, topic chips scroll horizontally, cards stack, trending scrolls
- [ ] **Cohort Detail**: Hero compact, nav scrolls horizontally, sidebar hidden, actions full-width
- [ ] **Create Cohort**: Wizard steps scroll, curriculum single-column, inspector as bottom sheet
- [ ] **Play (portrait)**: Full-screen, controls touch-friendly, queue/notes as bottom sheets
- [ ] **Play (landscape)**: Fills viewport, auto-hide UI works, timeline/controls accessible
- [ ] **Notes**: Panel/workspace switching works, back button returns to panel, toolbar scrollable
- [ ] **Messages**: List/chat switching works, back button returns to list, composer above keyboard
- [ ] **Loading**: Spinner centered, no overflow

### Global Checks
- [ ] Bottom nav shows on all dashboard pages except /play
- [ ] Bottom nav has icon labels on mobile
- [ ] Bottom nav hides when keyboard is open
- [ ] Bottom nav has safe-area-bottom padding
- [ ] No horizontal scrollbar on any page
- [ ] All tap targets ≥ 44px
- [ ] Text is readable without zooming (no input zoom on focus)
- [ ] Overscroll/pull-to-refresh is disabled
- [ ] Transitions are smooth (no jank on low-end devices)
- [ ] Android back button/gesture works on all pages
- [ ] Safe area insets are respected (notch, gesture bar)
- [ ] Scroll positions don't persist incorrectly between page navigations

---

## 23 · File Change Summary

### New Files
| File | Purpose |
|---|---|
| `src/client/hooks/useIsMobile.ts` | Hook for mobile breakpoint detection (768px) |

### Modified Files — Core

| File | Changes |
|---|---|
| `src/app/styles/tokens.css` | Add mobile tokens (bottom-nav-height, safe-area, touch-target) |
| `src/app/globals.css` | Add tap-highlight removal, overscroll containment, overflow-x hidden, safe-area top padding |
| `src/app/styles/typography.css` | Add `@media (max-width: 768px)` heading/body size overrides |
| `src/app/styles/forms.css` | Add mobile input height (44px), font-size (16px), scrollbar adjustments |
| `src/app/styles/accessibility.css` | Add mobile user-select, touch-callout rules |

### Modified Files — Navigation & Shell

| File | Changes |
|---|---|
| `src/client/components/global/Sidebar/Sidebar.tsx` | Add play-page detection to hide on mobile, keyboard detection |
| `src/client/components/global/Sidebar/Sidebar.module.css` | Enhance mobile bottom nav: safe-area, backdrop-filter, keyboard-hidden |
| `src/client/components/global/Sidebar/SidebarItem.tsx` | Add label text |
| `src/client/components/global/Sidebar/SidebarItem.module.css` | Add mobile styles: column layout, labels, tap feedback |
| `src/client/components/global/DashboardShell/DashboardShell.module.css` | Enhance mobile padding-bottom with safe-area calc |

### Modified Files — Screens

| File | Changes |
|---|---|
| `src/client/components/screens/auth/Auth.module.css` | Already handles ≤1100px; no change needed |
| `src/client/components/screens/auth/authForm/authForm.module.css` | Add 768px: full-screen, no border-radius, compact |
| `src/client/components/screens/auth/authForm/authButton.module.css` | Add 768px: touch targets, full width |
| `src/client/components/screens/auth/authForm/authInput.module.css` | Add 768px: touch targets, 16px font |
| `src/client/components/screens/auth/authForm/authProviders.module.css` | Add 768px: stack vertically |
| `src/client/components/screens/auth/authForm/authStats.module.css` | Add 768px: single column |
| `src/client/components/screens/dashboard/home/Home.module.css` | Enhance mobile padding, search placement |
| `src/client/components/screens/dashboard/home/components/*/...module.css` | Add 768px rules per sub-component (~9 files) |
| `src/client/components/screens/dashboard/explore/Explore.module.css` | Add 768px mobile layout |
| `src/client/components/screens/dashboard/explore/components/*/...module.css` | Add 768px rules per sub-component (~12 files) |
| `src/client/components/screens/dashboard/play/Play.tsx` | Add orientation lock, touch swipe for lessons |
| `src/client/components/screens/dashboard/play/Play.module.css` | Add 768px: full-screen, repositioned controls, bottom sheets |
| `src/client/components/screens/dashboard/play/components/*/...module.css` | Add 768px rules (~7 files) |
| `src/client/components/screens/dashboard/notes/Notes.tsx` | Add `useIsMobile`, mobile view switching |
| `src/client/components/screens/dashboard/notes/Notes.module.css` | Add 768px: single-pane, repositioned canvas/tools |
| `src/client/components/screens/dashboard/message/Message.tsx` | Add `useIsMobile`, mobile view switching |
| `src/client/components/screens/dashboard/message/Message.module.css` | Add 768px: single column |
| `src/client/components/screens/dashboard/message/components/*/...module.css` | Add 768px rules (~50+ files) |
| `src/client/components/screens/dashboard/createCohort/...module.css` | Add 768px rules (~27 files) |
| `src/client/components/screens/cohort/...module.css` | Add/enhance 768px rules (~29 files) |

### Modified Files — Shared Components

| File | Changes |
|---|---|
| `src/client/components/global/SearchBar/SearchBar.module.css` | Add 768px: full-width, hide shortcut |
| `src/client/components/global/PillInput.module.css` | Add 768px: min-height, 16px font |
| `src/client/components/global/HorizontalScroller/HorizontalScroller.module.css` | Add 768px: hide arrows |
| `src/client/components/global/Logo/Logo.module.css` | Add 768px: smaller frame, hide tagline |
| `src/client/components/ui/Button/Button.module.css` | Add 768px: min-height touch target |
| `src/client/components/screens/landing/01-hero/...module.css` | Add 768px rules (~5 files) |
| `src/client/components/screens/landing/02-ikigai/...module.css` | Add 768px rules (~4 files) |

### Total estimated files modified: **~100-130 CSS module files + ~5 TSX files**

---

## 24 · Execution Order

> [!IMPORTANT]
> This is critical — dependencies must be resolved in order.

### Phase 1: Foundation (no visual changes yet)
1. `tokens.css` — Add mobile tokens
2. `globals.css` — Add global mobile rules
3. `typography.css` — Add mobile type scale
4. `forms.css` — Add mobile input rules
5. `accessibility.css` — Add touch rules
6. `useIsMobile.ts` — Create hook

### Phase 2: Navigation & Shell (most impactful change)
7. `SidebarItem.tsx` + `SidebarItem.module.css` — Add labels, mobile styles
8. `Sidebar.tsx` + `Sidebar.module.css` — Play page hide, keyboard hide, safe area
9. `DashboardShell.module.css` — Enhance mobile padding

### Phase 3: Simple pages (low complexity, build confidence)
10. Auth screen CSS files (~6 files)
11. Home screen CSS files (~10 files)
12. Explore screen CSS files (~12 files)

### Phase 4: Medium complexity pages
13. Cohort detail pages (~29 files) — many already have partial breakpoints
14. Create Cohort wizard (~27 files)

### Phase 5: Complex pane-switching pages
15. Notes screen — CSS + TSX changes
16. Messages screen — CSS + TSX changes (most files)

### Phase 6: Play screen (most complex, test last)
17. Play.tsx — orientation lock, touch swipe
18. Play.module.css + all sub-component CSS files (~8 files)

### Phase 7: Remaining
19. Landing page (~9 CSS files)
20. Shared UI components (Button, SearchBar, PillInput, HorizontalScroller, Logo)

### Phase 8: Polish
21. Cross-page testing on real Android device
22. Fix any overflow, spacing, or interaction issues
23. Performance audit (check for jank on low-end devices)
