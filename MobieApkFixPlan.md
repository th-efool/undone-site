# Mobile APK Fix Plan (`MobieApkFixPlan.md`)

This document details the exact surgical plan and technical strategy to address all Android AAB/APK build issues for **SideQuestHQ**.

---

## 1. Screen Orientation Control (`/play` vs Rest of App)
- **Requirement**: `/play` screen strictly locked to **landscape mode**. All other screens (`/home`, `/explore`, `/cohort`, `/notes`, etc.) strictly locked to **portrait mode**.
- **Strategy & Implementation**:
  - In `src/client/components/global/CapacitorBridge/CapacitorBridge.tsx`:
    - Listen for `pathname` changes using Next.js `usePathname()`.
    - When `pathname === '/play'` (or starts with `/play`): Invoke `@capacitor/screen-orientation` `ScreenOrientation.lock({ orientation: 'landscape' })`.
    - When `pathname !== '/play'`: Invoke `ScreenOrientation.lock({ orientation: 'portrait' })`.
    - Ensure clean fallback when running outside native Capacitor context.

---

## 2. Fullscreen Mode & Top-Right Exit Button on `/play`
- **Requirement**: Fullscreen immersive mode on `/play` (hiding phone's status bar and bottom navigation bar). A single top-right corner back button for user to exit `/play`.
- **Strategy & Implementation**:
  - **Fullscreen Immersive Mode**:
    - Call `document.documentElement.requestFullscreen()` on mounting `/play` (and Capacitor StatusBar/NavigationBar hide methods).
    - Call `document.exitFullscreen()` when leaving `/play`.
  - **Top-Right Floating Back Button**:
    - In `src/client/components/screens/dashboard/play/Play.tsx`: Render a dedicated `<button className={styles.topRightBackButton}>` containing an `ArrowLeft` or `X` icon.
    - Style: `position: fixed`, `top: max(12px, env(safe-area-inset-top))`, `right: max(16px, env(safe-area-inset-right))`, `z-index: 9999`, semi-transparent glass background with blur.
    - Click Handler: Calls `router.push('/home')` (or `router.back()`), exits fullscreen, and restores portrait orientation.

---

## 3. Touch Scrolling Fix on Phone (`/explore`, `/home`, `/cohort`)
- **Requirement**: Fix vertical touch scrolling which currently fails on phone.
- **Surgeon Diagnosis**:
  1. **HTML5 Drag Interference**: `ActiveCohortRow.tsx` applies `draggable="true"` to the root `<article>` element. On Android WebView, `draggable` intercepts touch-start and touch-move events, preventing native vertical page scrolling over list items.
  2. **CSS Viewport & Scroll Locking**: `globals.css` applies `overscroll-behavior: none` and `overflow-x: hidden` to `html, body` without establishing explicit vertical scroll overflow parameters (`overflow-y: auto`, `-webkit-overflow-scrolling: touch`).
- **Strategy & Implementation**:
  - Remove `draggable="true"` from `<article>` on mobile touch devices. Drag handles will only be enabled on desktop pointing devices.
  - In `globals.css` & `DashboardShell.module.css`: Set `overflow-y: auto`, `-webkit-overflow-scrolling: touch`, `touch-action: manipulation` / `pan-y` on container elements to guarantee smooth 60fps touch scrolling.

---

## 4. Active Cohorts Layout Fix on `/home`
- **Requirement**: Fix layout glitch where schedule text ("Mon W Fri") wraps vertically and overlaps right next to / behind the pause button on phone screens.
- **Surgeon Diagnosis**:
  - In `ActiveCohortRow.module.css`, line 481 contains:
    `.row > .popoverAnchor:first-of-type { display: none !important; }`
  - In CSS, `:first-of-type` selects the first child element matching that tag name (`div`). The 1st `div` inside `.row` is `<div className={styles.course}>` (`.course`).
  - Thus, `.popoverAnchor` (schedule) is the 2nd `div` and WAS NOT matching `:first-of-type`. The schedule button remained visible on mobile and squished "Mon, Wed, Fri" into stacked vertical characters in column 5!
- **Strategy & Implementation**:
  - Add explicit class `.scheduleAnchor` to schedule popover wrapper in `ActiveCohortRow.tsx`.
  - In `ActiveCohortRow.module.css`: Replace `:first-of-type` with `.scheduleAnchor { display: none !important; }`.
  - Re-align mobile grid template columns to 6 compact items: `Grip (24px) | Rank (26px) | Thumbnail (56px) | Course Info (1fr) | Pause Button (38px) | More Button (38px)`.

---

## 5. Minimalist Animated Bottom Navigation Bar
- **Requirement**:
  - **5a**: Remove text labels ("Play", "Home", "Explore", "Notes").
  - **5b**: Reduce vertical height to ~38px (almost half height), very compact padding.
  - **5c**: Smooth animated highlight on active section icon (except Play).
- **Strategy & Implementation**:
  - **5a (Remove Text)**: In `SidebarItem.module.css`, set `.label { display: none !important; }` on mobile viewport.
  - **5b (Compact Height)**:
    - Update `tokens.css`: `--bottom-nav-height: 38px;`.
    - Update `Sidebar.module.css`: `height: calc(38px + env(safe-area-inset-bottom))`. Reduce item padding to `4px`.
  - **5c (Active Animation)**:
    - Create a smooth glowing active capsule background on the active icon item with CSS spring transition (`transition: all 250ms cubic-bezier(0.2, 0.8, 0.2, 1)` and `transform: scale(1.08)`).

---

## 6. High-Impact & Critical Mobile APK Additions
- **Android Physical Back Button Handling on `/play`**:
  - Intercept Capacitor back button listener on `/play` to safely trigger exit to `/home` instead of exiting the entire Android application.
- **Keyboard Overlay Auto-Hide**:
  - Automatically collapse/hide the bottom navigation bar when soft keyboard opens (e.g. typing in search bars).
- **Video Lifecycle Clean Up**:
  - Ensure YouTube player instances are paused and garbage collected cleanly upon leaving `/play`.

---

## Plan Summary & Execution Checklist
- [x] Create `MobieApkFixPlan.md` and `implementation_plan.md`
- [ ] Execute `CapacitorBridge.tsx` orientation & fullscreen changes
- [ ] Execute `Play.tsx` top-right exit button
- [ ] Execute `ActiveCohortRow.tsx` and `ActiveCohortRow.module.css` layout and drag fixes
- [ ] Execute `globals.css` & `DashboardShell.module.css` scroll fixes
- [ ] Execute `Sidebar.module.css` & `SidebarItem.module.css` minimalist animated bottom navbar
- [ ] Verify build via `npm run build` and `npm run lint`
