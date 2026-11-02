# Idiot Hand-Off Guide: Ultrawide, Zoom-In, and Zoom-Out Responsive Remediation Across Landing, Cohort Creation, and Dashboard Surfaces

---

## A. Execution contract

- **Target outcome**: Remediate viewport-scaling, ultrawide (`1920px`–`3840px+`), browser zoom-out (`50%`–`80%`), and browser zoom-in (`125%`–`175%` / short-height desktop) layout failures across all susceptible application surfaces:
  1. **Homepage Hero (`/`)**: Fix vertical `100vh` clipping, collage-over-card z-index collisions (where decorative parchment SVGs and the `"Different Paths Same Sky"` ribbon paint on top of the 4-column suggestion prompt cards and the Featured Cohorts strip), asymmetric `+ 65px` horizontal strip offset, unbounded `vw` inline parchment transforms, and premature 4-column prompt card expansion inside narrow collage gutters.
  2. **Cohort Creation & Interactive Builder (`/quest/start`, `/quest/new`, `/quest/build/[workspaceId]`)**: Fix unbounded right-pane stretching on ultrawide/zoom-out displays, centered-chat header edge-flyout on ultrawide displays, decorative polaroid/book overlap inside the split-screen right pane between `1301px` and `1640px`, negative right-margin overflow in chunking view, oversized `vw`-based stage headings (`up to 104px`), and viewport-based media queries (`1100px`–`1200px`) that fail to account for the `320px`–`420px` left chat rail when zoomed in.
  3. **Dashboard & Core Route Surfaces (`/explore`, `/cohort/[cohortId]`, `/studyroom/[roomSlug]`, `/auth`)**: Add centered ultrawide max-width containment to `/explore`, `/cohort/[cohortId]`, and `/studyroom/[roomSlug]`, replace viewport-dependent `40vw` illustration positioning in `ExploreHero` with container-relative bounds, cap oversized `6.5rem` hero typography in `CohortHero`, and remove rigid `100vh` clipping on `/auth` and `/studyroom/[roomSlug]` when zoomed in.
- **Strict scope**: Modify only the 16 CSS Module / TSX files listed in Section C. Do not alter backend routes, database schemas, state machines, or unrelated components. Preserve all comments marked `CRITICAL: THIS IS UPDATED NEW LOGO & DONT CLEAN UP`.
- **Workspace root directory**: `d:\ThisPC\Documents\SideQuestHQ\undone-site`
- **Shell**: `powershell`
- **Baseline git state**:
  - Branch: `master`
  - Baseline HEAD commit: `3c84f6200e0847d642521e4cdbe06ed8d4c9059b`
  - Pre-existing untracked files to leave untouched: `plans/cohort-builder/IdiotGuideChatOrderAndVariationFix.md`
- **Guide status**: `READY`

### Operational sequence for the executing agent
1. Read this guide in full before making any edits.
2. Execute **STEP-01** through **STEP-13** in exact sequential order.
3. For each step, locate the exact `Find anchor` in the target file and replace it verbatim with the `Replace with` block. Do not improvise, reformat unrelated rules, or omit lines.
4. Run the verification commands in **Section E** after completing all steps.
5. Produce the completion report using the exact template in **Section F**.

---

## B. Requirements and acceptance map

| Requirement ID | Requirement summary | Implementing step(s) | Verification |
| :--- | :--- | :--- | :--- |
| `REQ-01` | **Homepage Hero decorative z-index & inline `vw` parchment anchoring**: Decorative collages (`.collageLeft`, `.collageRight`) and bottom parchment SVGs (`.bottomEdgeParchmentLeft`, `.bottomEdgeParchmentRight`, and inline extra parchment sheets in `Hero.tsx`) must sit strictly behind `.mainHeroSection`, `.centralInterface`, and `.cohortsStripContainer` (`z-index: 30`–`35` vs `z-index: 4`–`6`), and the right inline parchment must anchor to `right` instead of `translate(77.89vw, ...)`. | `STEP-01`, `STEP-02` | `npx vitest run src/client/screens/landing/Hero/components/__tests__/CentralInterface.test.tsx src/client/screens/landing/Hero/components/__tests__/HeaderNav.test.tsx` |
| `REQ-02` | **Homepage Hero zoom-in vertical resilience, symmetric cohort strip, and ultrawide collage framing**: `.heroWrapper` must use `min-height: 100dvh; height: auto;` instead of clipping at `height: 100vh`; `.cohortsStripContainer` must center symmetrically without the `+ 65px` right shift; `.collageLeft` and `.collageRight` must tuck outward on `821px`–`1539px` (preventing zoom-in overlap) and frame a bounded max-width stage on ultrawide (`>= 2000px`). | `STEP-02` | `npx vitest run src/client/screens/landing/Hero/components/__tests__/CentralInterface.test.tsx` |
| `REQ-03` | **SuggestionPromptRow gutter-aware column switching**: `.promptRow` must remain a 2-column (`max-width: 720px`) grid between `1024px` and `1379px` where side collages narrow the center channel, expanding to 4 columns only at `>= 1380px` with `max-width: min(1040px, calc(100vw - 480px))` (`1080px` at `>= 1680px`). | `STEP-03` | `npx vitest run src/client/components/global/LearningPromptBar/__tests__/LearningPromptBar.test.tsx` |
| `REQ-04` | **CohortIntakeScreen ultrawide containment & zoom-in breakpoint**: `/quest/start` (`.shell` and `.canvas`) must cap right-pane content to `1280px` centered on ultrawide screens and stack cleanly at `<= 1024px` with compact vertical padding on short/zoomed-in viewports (`max-height: 780px`). | `STEP-04` | `npx vitest run src/client/screens/cohortBuilder/__tests__/intake-screen.test.tsx` |
| `REQ-05` | **CohortBuilder split/centered shell ultrawide & zoom-in layout**: In `CohortBuilder.module.css`, `.rightPane` children must be centered and capped at `max-width: 1360px` on ultrawide screens; centered-chat `.brandHeader` must align within a `1440px` max-width track; `.materialDecorations` must hide below `1640px` width or `820px` height; and `.reviewPreviewGrid` / `.rightPane` padding must adapt at `<= 1360px` and `max-height: 800px`. | `STEP-05` | `npx vitest run src/client/screens/cohortBuilder/__tests__/shell.test.tsx src/client/screens/cohortBuilder/__tests__/CohortWorkspacePane.test.tsx` |
| `REQ-06` | **Cohort Creation stage workspaces split-pane & ultrawide responsiveness**: In `RecommendationResults`, `StartingPoint`, `MaterialWorkspace`, `ChunkingWorkspace`, and `ReadyWorkspace`, account for the `320px`–`420px` left chat rail by shifting multi-column collapse breakpoints to `1360px`, hiding edge polaroid decorations below `1640px`, removing negative right-margin overflow (`margin-right: -32px`), and capping `vw` display headings so they do not balloon to `104px` on ultrawide monitors. | `STEP-06`, `STEP-07`, `STEP-08`, `STEP-09`, `STEP-10` | `npx vitest run src/client/screens/cohortCreation/__tests__/RecommendationCover.test.tsx src/client/screens/cohortCreation/__tests__/ChunkingWorkspace.test.tsx src/client/screens/cohortCreation/__tests__/ReadyWorkspace.test.tsx` |
| `REQ-07` | **Explore, Cohort Detail, StudyRoom Cockpit, and Auth ultrawide & zoom containment**: Center `/explore` (`max-width: 1440px`) and bound `ExploreHero` `.imageWrapper` with percentage clamping instead of `40vw`; center `/cohort/[cohortId]` (`max-width: 1480px`) and cap `CohortHero` `.title` font scaling; center `/studyroom/[roomSlug]` `.cockpit` (`max-width: 1760px`) with short-viewport compact spacing; and make `/auth` zoom-safe with `min-height: 100dvh` and fluid right-panel sizing. | `STEP-11`, `STEP-12`, `STEP-13` | `npx vitest run src/app/styles/__tests__/static-enforcement.test.ts src/app/styles/__tests__/cascade-regression.test.ts src/client/screens/auth/__tests__/Auth.test.tsx src/client/screens/cohort/components/CohortHero/__tests__/CohortHero.test.tsx` |

---

## C. File-change manifest

| File path | Action | Implementing step |
| :--- | :--- | :--- |
| `src/client/screens/landing/Hero/Hero.tsx` | Modify | `STEP-01` |
| `src/client/screens/landing/Hero/Hero.module.css` | Modify | `STEP-02` |
| `src/client/components/global/SuggestionPromptRow/SuggestionPromptRow.module.css` | Modify | `STEP-03` |
| `src/client/screens/cohortBuilder/CohortIntakeScreen.module.css` | Modify | `STEP-04` |
| `src/client/screens/cohortBuilder/CohortBuilder.module.css` | Modify | `STEP-05` |
| `src/client/screens/cohortCreation/components/RecommendationResults.module.css` | Modify | `STEP-06` |
| `src/client/screens/cohortCreation/components/StartingPoint.module.css` | Modify | `STEP-07` |
| `src/client/screens/cohortCreation/components/MaterialWorkspace.module.css` | Modify | `STEP-08` |
| `src/client/screens/cohortCreation/components/ChunkingWorkspace.module.css` | Modify | `STEP-09` |
| `src/client/screens/cohortCreation/components/ReadyWorkspace.module.css` | Modify | `STEP-10` |
| `src/client/screens/dashboard/explore/Explore.module.css` | Modify | `STEP-11` |
| `src/client/screens/dashboard/explore/components/ExploreHero/ExploreHero.module.css` | Modify | `STEP-11` |
| `src/client/screens/cohort/components/CohortLayout/CohortLayout.module.css` | Modify | `STEP-12` |
| `src/client/screens/cohort/components/CohortHero/CohortHero.module.css` | Modify | `STEP-12` |
| `src/client/screens/dashboard/studyroom/room/RoomScreen.module.css` | Modify | `STEP-13` |
| `src/client/screens/auth/Auth.module.css` | Modify | `STEP-13` |

---

## D. Ordered implementation steps

### STEP-01: Fix inline `vw` parchment positioning and z-index layering in `Hero.tsx`

- **Requirement IDs**: `REQ-01`
- **Target file**: `src/client/screens/landing/Hero/Hero.tsx`
- **Operation**: `Replace block`

**Find anchor**:
```tsx
      {/* Extra decorative parchment sheets for the left collage */}
      <div
        className={`${styles.bottomEdgeParchmentLeft} ${styles.extraParchmentLeft1}`}
        style={{
          bottom: 'auto',
          top: '-100px',
          left: '-140px',
          transform: 'translate(-2.02vw, -3.59vh) scale(1.35)',
          zIndex: 1,
        }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 920 200" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path
            d="M -20 220 L -20 65 C 45 55, 115 80, 195 60 C 275 40, 340 15, 430 35 C 510 52, 575 95, 665 85 C 745 76, 810 120, 920 200 Z"
            fill="#F3EAD8"
            stroke="#DFD3BC"
            strokeWidth="2"
          />
          <path
            d="M -20 75 C 55 68, 125 90, 200 72 C 280 52, 345 28, 430 47 C 508 64, 572 105, 662 96 C 740 88, 805 130, 905 200"
            stroke="#E7DCC6"
            strokeWidth="1.2"
            strokeDasharray="6 5"
            fill="none"
          />
        </svg>
      </div>

      <div
        className={`${styles.bottomEdgeParchmentLeft} ${styles.extraParchmentLeft2}`}
        style={{
          bottom: 'auto',
          top: '-60px',
          left: '-180px',
          transform: 'translate(77.89vw, 9.46vh) scale(1.3)',
          zIndex: 1,
        }}
        aria-hidden="true"
      >
```

**Replace with**:
```tsx
      {/* Extra decorative parchment sheets for the left and right collages */}
      <div
        className={`${styles.bottomEdgeParchmentLeft} ${styles.extraParchmentLeft1}`}
        style={{
          bottom: 'auto',
          top: '-100px',
          left: '-140px',
          transform: 'translate(-24px, -28px) scale(1.25)',
          zIndex: 3,
        }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 920 200" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path
            d="M -20 220 L -20 65 C 45 55, 115 80, 195 60 C 275 40, 340 15, 430 35 C 510 52, 575 95, 665 85 C 745 76, 810 120, 920 200 Z"
            fill="#F3EAD8"
            stroke="#DFD3BC"
            strokeWidth="2"
          />
          <path
            d="M -20 75 C 55 68, 125 90, 200 72 C 280 52, 345 28, 430 47 C 508 64, 572 105, 662 96 C 740 88, 805 130, 905 200"
            stroke="#E7DCC6"
            strokeWidth="1.2"
            strokeDasharray="6 5"
            fill="none"
          />
        </svg>
      </div>

      <div
        className={`${styles.bottomEdgeParchmentLeft} ${styles.extraParchmentLeft2}`}
        style={{
          bottom: 'auto',
          top: '-60px',
          left: 'auto',
          right: '-180px',
          transform: 'translate(24px, 48px) scaleX(-1) scale(1.22)',
          zIndex: 3,
        }}
        aria-hidden="true"
      >
```

---

### STEP-02: Fix Homepage Hero vertical clipping, z-index layering, symmetric cohort strip, and ultrawide/zoom collage scaling in `Hero.module.css`

- **Requirement IDs**: `REQ-01`, `REQ-02`
- **Target file**: `src/client/screens/landing/Hero/Hero.module.css`
- **Operation**: `Replace block`

**Find anchor (Part 1 of 3 — `.heroWrapper`, `.header`, `.mainHeroSection`, `.centralInterface`)**:
```css
.heroWrapper {
  position: relative;
  width: 100vw;
  height: 100vh;
  min-height: 520px;
  background-color: #FAF7F2;
  background-image: 
    radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.95) 0%, rgba(250, 247, 242, 0.4) 55%, rgba(242, 236, 225, 0.7) 100%);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-family: var(--font-sans);
  color: #0E1738;
  box-sizing: border-box;
  user-select: none;
}

/*Noise Overlay*/
.heroWrapper::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.025'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 1;
}

/* Header */
.header {
  position: relative;
  z-index: 30;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: clamp(14px, 2vh, 24px) clamp(20px, 3.5vw, 48px);
  flex-shrink: 0;
}

/* CRITICAL: THIS IS UPDATED NEW LOGO & DONT CLEAN UP */
.logoContainer {
  display: flex;
  align-items: center;
  gap: 3px;
  font-family: var(--font-serif);
  font-weight: 700;
  font-size: 1.5rem;
  color: #0F172A;
  letter-spacing: -0.02em;
  text-decoration: none;
  cursor: pointer;
}

.logoIcon {
  color: #1A2599;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: -6px;
}

.ctaSecondary {
  background-color: #1F299D;
  color: #FFFFFF;
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 0.92rem;
  padding: 11px 24px;
  border-radius: 9999px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(31, 41, 157, 0.22), inset 0 1px 0 rgba(255,255,255,0.2);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.ctaSecondary:hover {
  background-color: #161E7A;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(31, 41, 157, 0.32), inset 0 1px 0 rgba(255,255,255,0.25);
}

/* Main Hero Center Layout */
.mainHeroSection {
  position: relative;
  z-index: 10;
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  min-height: 0;
  padding-bottom: clamp(18px, 3vh, 32px);
}

/* Central Column */
.centralInterface {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
  max-width: 1080px;
  padding: 0 24px;
  z-index: 20;
  margin-top: 0;
}
```

**Replace with (Part 1 of 3)**:
```css
.heroWrapper {
  position: relative;
  width: 100%;
  min-height: 100dvh;
  height: auto;
  background-color: #FAF7F2;
  background-image: 
    radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.95) 0%, rgba(250, 247, 242, 0.4) 55%, rgba(242, 236, 225, 0.7) 100%);
  overflow-x: clip;
  overflow-y: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-family: var(--font-sans);
  color: #0E1738;
  box-sizing: border-box;
  user-select: none;
}

/*Noise Overlay*/
.heroWrapper::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.025'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 1;
}

/* Header */
.header {
  position: relative;
  z-index: 40;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 1920px;
  margin: 0 auto;
  padding: clamp(12px, 1.8vh, 24px) clamp(20px, 3.5vw, 48px);
  box-sizing: border-box;
  flex-shrink: 0;
}

/* CRITICAL: THIS IS UPDATED NEW LOGO & DONT CLEAN UP */
.logoContainer {
  display: flex;
  align-items: center;
  gap: 3px;
  font-family: var(--font-serif);
  font-weight: 700;
  font-size: 1.5rem;
  color: #0F172A;
  letter-spacing: -0.02em;
  text-decoration: none;
  cursor: pointer;
}

.logoIcon {
  color: #1A2599;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: -6px;
}

.ctaSecondary {
  background-color: #1F299D;
  color: #FFFFFF;
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 0.92rem;
  padding: 11px 24px;
  border-radius: 9999px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(31, 41, 157, 0.22), inset 0 1px 0 rgba(255,255,255,0.2);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.ctaSecondary:hover {
  background-color: #161E7A;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(31, 41, 157, 0.32), inset 0 1px 0 rgba(255,255,255,0.25);
}

/* Main Hero Center Layout */
.mainHeroSection {
  position: relative;
  z-index: 30;
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 1760px;
  margin: 0 auto;
  min-height: 0;
  padding: clamp(8px, 1.5vh, 24px) 0 clamp(16px, 2.6vh, 30px);
}

/* Central Column */
.centralInterface {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
  max-width: min(1080px, calc(100vw - 340px));
  padding: 0 24px;
  z-index: 32;
  margin-top: 0;
  box-sizing: border-box;
}
```

**Find anchor (Part 2 of 3 — `.cohortsStripContainer` and `.collageLeft` / `.collageRight` / `.bottomEdgeParchmentLeft` / `.bottomEdgeParchmentRight`)**:
```css
/* Featured Cohorts Strip - Single Row, Compact */
.cohortsStripContainer {
  width: min(100vw - 12px, 1440px);
  margin-left: calc((100% - min(100vw - 12px, 1440px)) / 2 + 65px);
  position: relative;
  margin-top: 2px;
  z-index: 10;
}
```

**Replace with (Part 2 of 3)**:
```css
/* Featured Cohorts Strip - Single Row, Compact */
.cohortsStripContainer {
  width: min(calc(100vw - 48px), 1360px);
  margin-left: calc((100% - min(calc(100vw - 48px), 1360px)) / 2);
  position: relative;
  margin-top: 4px;
  z-index: 35;
}
```

**Find anchor (Part 3 of 3 — Collage containers, bottom parchment z-index, and media queries at bottom of `Hero.module.css`)**:
```css
/* ============================================================================
   COLLAGES (LEFT & RIGHT) - Positioned at far edges to avoid overlaps
   ============================================================================ */

.collageLeft {
  position: absolute;
  left: 0;
  top: 72px;
  bottom: 0;
  width: 320px;
  pointer-events: none;
  z-index: 25;
}

.collageRight {
  position: absolute;
  right: 0;
  top: 72px;
  bottom: 0;
  width: 340px;
  pointer-events: none;
  z-index: 25;
}

/* Decorative Layered Torn Parchment at Bottom Corners */
.bottomEdgeParchmentLeft {
  position: absolute;
  bottom: -4px;
  left: -8px;
  width: clamp(300px, 34vw, 540px);
  height: clamp(75px, 11vh, 130px);
  pointer-events: none;
  z-index: 25;
  filter: drop-shadow(0 -6px 16px rgba(14, 23, 56, 0.08));
}

.bottomEdgeParchmentLeft svg,
.bottomEdgeParchmentRight svg {
  width: 100%;
  height: 100%;
  display: block;
}

.bottomEdgeParchmentRight {
  position: absolute;
  bottom: -4px;
  right: -8px;
  width: clamp(320px, 36vw, 560px);
  height: clamp(80px, 11.5vh, 135px);
  pointer-events: none;
  z-index: 25;
  filter: drop-shadow(0 -6px 16px rgba(14, 23, 56, 0.08));
}
```

**Replace with (Part 3a of 3)**:
```css
/* ============================================================================
   COLLAGES (LEFT & RIGHT) - Positioned at far edges behind interactive center
   ============================================================================ */

.collageLeft {
  position: absolute;
  left: max(0px, calc((100vw - 2160px) / 2));
  top: 72px;
  bottom: 0;
  width: 320px;
  pointer-events: none;
  z-index: 6;
}

.collageRight {
  position: absolute;
  right: max(0px, calc((100vw - 2160px) / 2));
  top: 72px;
  bottom: 0;
  width: 340px;
  pointer-events: none;
  z-index: 6;
}

/* Decorative Layered Torn Parchment at Bottom Corners */
.bottomEdgeParchmentLeft {
  position: absolute;
  bottom: -4px;
  left: -8px;
  width: clamp(260px, 28vw, 480px);
  height: clamp(64px, 9.5vh, 118px);
  pointer-events: none;
  z-index: 4;
  filter: drop-shadow(0 -6px 16px rgba(14, 23, 56, 0.08));
}

.bottomEdgeParchmentLeft svg,
.bottomEdgeParchmentRight svg {
  width: 100%;
  height: 100%;
  display: block;
}

.bottomEdgeParchmentRight {
  position: absolute;
  bottom: -4px;
  right: -8px;
  width: clamp(280px, 30vw, 500px);
  height: clamp(68px, 10vh, 122px);
  pointer-events: none;
  z-index: 4;
  filter: drop-shadow(0 -6px 16px rgba(14, 23, 56, 0.08));
}
```

**Find anchor (Part 3b of 3 — Responsive media queries at the end of `Hero.module.css`)**:
```css
/* Responsive Media Queries */
@media (min-width: 1300px) {
  .collageLeft {
    transform: scale(1.28);
    transform-origin: top left;
  }
  .collageRight {
    transform: scale(1.28);
    transform-origin: top right;
  }
}

@media (min-width: 1600px) {
  .collageLeft {
    transform: scale(1.48);
    transform-origin: top left;
  }
  .collageRight {
    transform: scale(1.48);
    transform-origin: top right;
  }
}

@media (max-width: 1400px) {
  .collageLeft {
    transform: scale(0.95);
    transform-origin: center left;
    left: -20px;
  }
  .collageRight {
    transform: scale(0.95);
    transform-origin: center right;
    right: -20px;
  }
}

@media (max-width: 1200px) {
  .collageLeft {
    transform: scale(0.8);
    transform-origin: center left;
    left: -50px;
  }
  .collageRight {
    transform: scale(0.8);
    transform-origin: center right;
    right: -50px;
  }
  .centralInterface {
    max-width: 680px;
  }
}

@media (max-width: 1024px) {
  .collageLeft {
    transform: scale(0.65);
    left: -80px;
    opacity: 0.55;
  }
  .collageRight {
    transform: scale(0.65);
    right: -80px;
    opacity: 0.55;
  }
}
```

**Replace with (Part 3b of 3)**:
```css
/* Responsive Media Queries for Zoom-In, Standard Desktop, and Ultrawide */
@media (min-width: 1540px) and (max-width: 1879px) {
  .collageLeft {
    transform: scale(1.12);
    transform-origin: top left;
  }
  .collageRight {
    transform: scale(1.12);
    transform-origin: top right;
  }
  .centralInterface {
    max-width: 1080px;
  }
}

@media (min-width: 1880px) {
  .collageLeft {
    transform: scale(1.26);
    transform-origin: top left;
  }
  .collageRight {
    transform: scale(1.26);
    transform-origin: top right;
  }
  .centralInterface {
    max-width: 1120px;
  }
  .cohortsStripContainer {
    width: min(calc(100vw - 96px), 1440px);
    margin-left: calc((100% - min(calc(100vw - 96px), 1440px)) / 2);
  }
}

@media (max-width: 1539px) and (min-width: 1380px) {
  .collageLeft {
    transform: scale(0.92);
    transform-origin: top left;
    left: -28px;
  }
  .collageRight {
    transform: scale(0.92);
    transform-origin: top right;
    right: -28px;
  }
  .centralInterface {
    max-width: min(1020px, calc(100vw - 380px));
  }
}

@media (max-width: 1379px) and (min-width: 1201px) {
  .collageLeft {
    transform: scale(0.82);
    transform-origin: center left;
    left: -48px;
  }
  .collageRight {
    transform: scale(0.82);
    transform-origin: center right;
    right: -48px;
  }
  .centralInterface {
    max-width: 780px;
  }
}

@media (max-width: 1200px) {
  .collageLeft {
    transform: scale(0.72);
    transform-origin: center left;
    left: -68px;
    opacity: 0.85;
  }
  .collageRight {
    transform: scale(0.72);
    transform-origin: center right;
    right: -68px;
    opacity: 0.85;
  }
  .centralInterface {
    max-width: 700px;
  }
}

@media (max-width: 1024px) {
  .collageLeft {
    transform: scale(0.6);
    left: -95px;
    opacity: 0.45;
  }
  .collageRight {
    transform: scale(0.6);
    right: -95px;
    opacity: 0.45;
  }
  .centralInterface {
    max-width: min(680px, calc(100vw - 48px));
  }
}

/* Compact vertical height adjustments for Browser Zoom-In (125% - 175%) and short screens */
@media (max-height: 830px) and (min-width: 821px) {
  .header {
    padding-top: 10px;
    padding-bottom: 10px;
  }
  .mainHeroSection {
    padding-top: 4px;
    padding-bottom: 12px;
  }
  .eyebrow {
    margin-bottom: 4px;
    font-size: 0.68rem;
  }
  .headline {
    font-size: clamp(2.15rem, 3.6vw, 3.1rem);
    margin-bottom: 6px;
  }
  .subtitle {
    font-size: 0.98rem;
    margin-bottom: 10px;
  }
  .categoryPillsContainer {
    margin-bottom: 8px;
    gap: 8px;
  }
  .categoryPill {
    padding: 6px 14px;
    font-size: 0.82rem;
  }
  .cohortCard {
    height: 112px;
  }
  .collageLeft,
  .collageRight {
    top: 54px;
  }
}
```

---

### STEP-03: Make `SuggestionPromptRow` gutter-aware so 4-column cards never collide with Hero side collages

- **Requirement IDs**: `REQ-03`
- **Target file**: `src/client/components/global/SuggestionPromptRow/SuggestionPromptRow.module.css`
- **Operation**: `Replace block`

**Find anchor**:
```css
@media (min-width: 1024px) {
  .promptRow {
    grid-template-columns: repeat(4, 1fr);
    max-width: 1060px;
    gap: 12px;
  }
}

@media (min-width: 1400px) {
  .promptRow {
    max-width: 1080px;
    gap: 14px;
  }
}
```

**Replace with**:
```css
@media (min-width: 1024px) and (max-width: 1379px) {
  .promptRow {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: 720px;
    gap: 12px;
  }
}

@media (min-width: 1380px) {
  .promptRow {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    max-width: min(1040px, calc(100vw - 480px));
    gap: 12px;
  }
}

@media (min-width: 1680px) {
  .promptRow {
    max-width: 1080px;
    gap: 14px;
  }
}
```

---

### STEP-04: Add ultrawide max-width containment and zoom-in resilience to `CohortIntakeScreen.module.css`

- **Requirement IDs**: `REQ-04`
- **Target file**: `src/client/screens/cohortBuilder/CohortIntakeScreen.module.css`
- **Operation**: `Replace block`

**Find anchor**:
```css
.shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(320px, 430px) minmax(0, 1fr);
}
```

**Replace with**:
```css
.shell {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: clamp(320px, 28vw, 440px) minmax(0, 1fr);
  max-width: 1920px;
  margin: 0 auto;
}
```

**Find anchor (Part 2 of 2 in `CohortIntakeScreen.module.css`)**:
```css
.canvas {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: clamp(28px, 5vw, 64px);
  gap: 28px;
}

.canvasMain {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
  max-width: 760px;
  min-height: 0;
}
```

**Replace with (Part 2 of 2 in `CohortIntakeScreen.module.css`)**:
```css
.canvas {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: clamp(24px, 4vw, 56px);
  gap: 28px;
  min-width: 0;
}

.canvas > * {
  width: 100%;
  max-width: 1280px;
  margin-inline: auto;
}

.canvasMain {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
  max-width: 760px;
  min-height: 0;
}
```

**Find anchor (Part 3 of 3 in `CohortIntakeScreen.module.css`)**:
```css
@media (max-width: 920px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .rail {
    border-right: 0;
    border-bottom: 1px solid var(--creation-line);
  }

  .optionGrid {
    grid-template-columns: 1fr;
  }
}
```

**Replace with (Part 3 of 3 in `CohortIntakeScreen.module.css`)**:
```css
@media (max-width: 1080px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .rail {
    border-right: 0;
    border-bottom: 1px solid var(--creation-line);
  }

  .optionGrid {
    grid-template-columns: 1fr;
  }
}

@media (max-height: 780px) and (min-width: 1081px) {
  .rail {
    padding: 18px 20px;
    gap: 14px;
  }

  .canvas {
    padding: 20px 32px;
    gap: 18px;
  }

  .canvasTitle {
    font-size: clamp(1.75rem, 2.8vw, 2.5rem);
  }
}
```

---

### STEP-05: Add ultrawide right-pane containment, centered header bounds, and split-pane zoom-in rules to `CohortBuilder.module.css`

- **Requirement IDs**: `REQ-05`
- **Target file**: `src/client/screens/cohortBuilder/CohortBuilder.module.css`
- **Operation**: `Replace block`

**Find anchor (Part 1 of 3 — `.page` and `.page[data-layout='centered']`)**:
```css
.page {
  --shell-header-height: 60px;
  height: 100dvh;
  max-height: 100dvh;
  display: grid;
  grid-template-columns: clamp(300px, 26.1vw, 420px) minmax(0, 1fr);
  background: var(--creation-bg);
  color: var(--creation-ink);
  font-family: var(--font-sans), 'Inter', system-ui, -apple-system, sans-serif;
  overflow: hidden;
  transition: background-color 0.25s ease, color 0.25s ease;
}

.page[data-layout='centered'] {
  grid-template-columns: minmax(0, 1fr);
}

.page[data-layout='centered'] .rail {
  border-right: 0;
  background: var(--creation-bg);
}

.page[data-layout='centered'] .brandHeader {
  padding: 0 clamp(20px, 4vw, 48px);
}
```

**Replace with (Part 1 of 3)**:
```css
.page {
  --shell-header-height: 60px;
  height: 100dvh;
  max-height: 100dvh;
  display: grid;
  grid-template-columns: clamp(310px, 25vw, 450px) minmax(0, 1fr);
  background: var(--creation-bg);
  color: var(--creation-ink);
  font-family: var(--font-sans), 'Inter', system-ui, -apple-system, sans-serif;
  overflow: hidden;
  transition: background-color 0.25s ease, color 0.25s ease;
}

.page[data-layout='centered'] {
  grid-template-columns: minmax(0, 1fr);
}

.page[data-layout='centered'] .rail {
  border-right: 0;
  background: var(--creation-bg);
}

.page[data-layout='centered'] .brandHeader {
  padding: 0 clamp(20px, 4vw, 48px);
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}
```

**Find anchor (Part 2 of 3 — `.rightPane` container & ultrawide centering)**:
```css
.rightPane {
  position: relative;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 26px 48px 15px 44px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  scrollbar-width: thin;
  scrollbar-color: var(--creation-scrollbar) transparent;
}
```

**Replace with (Part 2 of 3)**:
```css
.rightPane {
  container-type: inline-size;
  position: relative;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: clamp(18px, 2.4vh, 28px) clamp(24px, 3.2vw, 52px) 20px clamp(24px, 3vw, 48px);
  display: flex;
  flex-direction: column;
  gap: 24px;
  scrollbar-width: thin;
  scrollbar-color: var(--creation-scrollbar) transparent;
}

.rightPane > * {
  width: 100%;
  max-width: 1360px;
  margin-inline: auto;
  box-sizing: border-box;
}
```

**Find anchor (Part 3 of 3 — `.materialDecorations` and responsive media queries in `CohortBuilder.module.css`)**:
```css
@media (max-width: 1300px) {
  .materialDecorations {
    display: none;
  }
}

@media (max-width: 980px) {
```

**Replace with (Part 3 of 3)**:
```css
@media (max-width: 1640px), (max-height: 820px) {
  .materialDecorations {
    display: none;
  }
}

@media (max-width: 1360px) and (min-width: 981px) {
  .page {
    grid-template-columns: clamp(290px, 30vw, 350px) minmax(0, 1fr);
  }

  .rightPane {
    padding: 20px 24px 16px 24px;
    gap: 18px;
  }

  .reviewPreviewGrid,
  .reviewGrid {
    grid-template-columns: 1fr;
  }

  .reviewStatRow {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-height: 800px) and (min-width: 981px) {
  .page {
    --shell-header-height: 52px;
  }

  .rightPane {
    padding-top: 16px;
    padding-bottom: 14px;
    gap: 16px;
  }

  .materialHeading h2 {
    font-size: clamp(2rem, 3.2vw, 2.75rem);
  }

  .materialCard {
    padding: 22px 24px;
  }
}

@media (max-width: 980px) {
```

---

### STEP-06: Make `RecommendationResults.module.css` responsive to split-pane widths and ultrawide screens

- **Requirement IDs**: `REQ-06`
- **Target file**: `src/client/screens/cohortCreation/components/RecommendationResults.module.css`
- **Operation**: `Replace block`

**Find anchor (Part 1 of 2 — `.heading h1` and `.card[data-featured='true']` margin)**:
```css
.heading h1 {
  margin: 0;
  color: var(--creation-ink, #061439);
  font-family: var(--font-serif), 'Instrument Serif', Georgia, serif;
  font-size: clamp(42px, 4.2vw, 70px);
  font-weight: 600;
  line-height: 1.04;
  letter-spacing: -0.03em;
}
```

**Replace with (Part 1 of 2)**:
```css
.heading h1 {
  margin: 0;
  color: var(--creation-ink, #061439);
  font-family: var(--font-serif), 'Instrument Serif', Georgia, serif;
  font-size: clamp(32px, 3.4vw, 56px);
  font-weight: 600;
  line-height: 1.06;
  letter-spacing: -0.03em;
}
```

**Find anchor (Part 2 of 2 — `.card[data-featured='true']` and `@media (max-width: 1100px)` in `RecommendationResults.module.css`)**:
```css
.card[data-featured='true'] {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(280px, 56%) minmax(250px, 1fr);
  min-height: 318px;
  margin-right: 36px;
}
```

**Replace with (Part 2a of 2)**:
```css
.card[data-featured='true'] {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(260px, 54%) minmax(240px, 1fr);
  min-height: 300px;
  margin-right: 0;
}
```

**Find anchor (Part 2b of 2 — `@media (max-width: 1100px)` at bottom of `RecommendationResults.module.css`)**:
```css
@media (max-width: 1100px) {
  .cards,
  .skeletonGrid,
  .card[data-featured='true'] {
    grid-template-columns: 1fr;
    margin-right: 0;
  }

  .card[data-featured='true'] .cover,
  .card:not([data-featured='true']) .cover {
    margin: 12px 12px 0;
    min-height: 210px;
  }

  .card[data-featured='true'] .cardBody {
    padding: 18px;
  }
}
```

**Replace with (Part 2b of 2)**:
```css
@media (max-width: 1360px) {
  .cards,
  .skeletonGrid,
  .card[data-featured='true'] {
    grid-template-columns: 1fr;
    margin-right: 0;
  }

  .card[data-featured='true'] .cover,
  .card:not([data-featured='true']) .cover {
    margin: 12px 12px 0;
    min-height: 210px;
  }

  .card[data-featured='true'] .cardBody {
    padding: 18px;
  }
}
```

---

### STEP-07: Fix decorative photo collisions and split-pane breakpoints in `StartingPoint.module.css`

- **Requirement IDs**: `REQ-06`
- **Target file**: `src/client/screens/cohortCreation/components/StartingPoint.module.css`
- **Operation**: `Replace block`

**Find anchor (Part 1 of 2 — `.heading h1`)**:
```css
.heading h1 {
  margin: 0;
  font-family: var(--font-serif), 'Instrument Serif', Georgia, serif;
  font-size: clamp(38px, 4.3vw, 66px);
  font-weight: 600;
  line-height: 1.03;
  letter-spacing: -0.03em;
}
```

**Replace with (Part 1 of 2)**:
```css
.heading h1 {
  margin: 0;
  font-family: var(--font-serif), 'Instrument Serif', Georgia, serif;
  font-size: clamp(32px, 3.4vw, 56px);
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.03em;
}
```

**Find anchor (Part 2 of 2 — `@media (max-width: 1180px)` at bottom of `StartingPoint.module.css`)**:
```css
@media (max-width: 1180px) {
  .decorations {
    display: none;
  }

  .cards {
    grid-template-columns: 1fr;
    max-width: 560px;
  }
}
```

**Replace with (Part 2 of 2)**:
```css
@media (max-width: 1640px), (max-height: 820px) {
  .decorations {
    display: none;
  }
}

@media (max-width: 1360px) {
  .cards {
    grid-template-columns: 1fr;
    max-width: 620px;
  }

  .card {
    min-height: 360px;
  }
}
```

---

### STEP-08: Fix decorative photo overlap and heading scale in `MaterialWorkspace.module.css`

- **Requirement IDs**: `REQ-06`
- **Target file**: `src/client/screens/cohortCreation/components/MaterialWorkspace.module.css`
- **Operation**: `Replace block`

**Find anchor**:
```css
.heading h1 {
  margin: 0;
  color: var(--creation-ink, #061439);
  font: 600 clamp(40px, 4.4vw, 68px)/1.03 var(--font-serif), 'Instrument Serif', Georgia, serif;
  letter-spacing: -0.03em;
}
.heading h1 em {
  color: var(--creation-blue, #303cff);
  font-style: italic;
  font-weight: 500;
}
.heading p {
  margin: 10px 0 0;
  color: var(--creation-muted, #516587);
  font-size: clamp(16px, 1.35vw, 22px);
}
```

**Replace with**:
```css
.heading h1 {
  margin: 0;
  color: var(--creation-ink, #061439);
  font: 600 clamp(32px, 3.5vw, 56px)/1.05 var(--font-serif), 'Instrument Serif', Georgia, serif;
  letter-spacing: -0.03em;
}
.heading h1 em {
  color: var(--creation-blue, #303cff);
  font-style: italic;
  font-weight: 500;
}
.heading p {
  margin: 10px 0 0;
  color: var(--creation-muted, #516587);
  font-size: clamp(15px, 1.2vw, 20px);
}
```

**Find anchor (Part 2 of 2 in `MaterialWorkspace.module.css`)**:
```css
@media (max-width: 1300px) {
  .decorations { display: none; }
}
```

**Replace with (Part 2 of 2 in `MaterialWorkspace.module.css`)**:
```css
@media (max-width: 1640px), (max-height: 820px) {
  .decorations { display: none; }
}
```

---

### STEP-09: Remove negative right-margin overflow and adjust split-pane grid breakpoint in `ChunkingWorkspace.module.css`

- **Requirement IDs**: `REQ-06`
- **Target file**: `src/client/screens/cohortCreation/components/ChunkingWorkspace.module.css`
- **Operation**: `Replace block`

**Find anchor (Part 1 of 2 — top of `ChunkingWorkspace.module.css`)**:
```css
.workspace {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100%;
  padding-bottom: 12px;
}
@media(min-width:1301px){
  .workspace {
    margin-right: -32px;
  }
}
.heading {
  text-align: center;
  max-width: 820px;
  margin: 2px auto 0;
}
.heading h1 {
  margin: 0;
  color: var(--creation-ink, #071539);
  font: 600 clamp(38px, 4.1vw, 64px)/1.04 var(--font-serif), 'Instrument Serif', Georgia, serif;
  letter-spacing: -0.03em;
}
```

**Replace with (Part 1 of 2)**:
```css
.workspace {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100%;
  padding-bottom: 12px;
  width: 100%;
  box-sizing: border-box;
}
.heading {
  text-align: center;
  max-width: 820px;
  margin: 2px auto 0;
}
.heading h1 {
  margin: 0;
  color: var(--creation-ink, #071539);
  font: 600 clamp(32px, 3.4vw, 56px)/1.05 var(--font-serif), 'Instrument Serif', Georgia, serif;
  letter-spacing: -0.03em;
}
```

**Find anchor (Part 2 of 2 — `@media (max-width: 1180px)` at bottom of `ChunkingWorkspace.module.css`)**:
```css
@media (max-width: 1180px) {
  .grid,
  .detailColumns,
  .statsRow {
    grid-template-columns: 1fr;
  }
  .chunkList {
    max-height: none;
  }
}
```

**Replace with (Part 2 of 2)**:
```css
@media (max-width: 1360px) {
  .grid,
  .detailColumns,
  .statsRow {
    grid-template-columns: 1fr;
  }
  .chunkList {
    max-height: none;
  }
}
```

---

### STEP-10: Cap oversized `104px` heading and update split-pane layout breakpoint in `ReadyWorkspace.module.css`

- **Requirement IDs**: `REQ-06`
- **Target file**: `src/client/screens/cohortCreation/components/ReadyWorkspace.module.css`
- **Operation**: `Replace block`

**Find anchor (Part 1 of 2 — `.heading` in `ReadyWorkspace.module.css`)**:
```css
.heading {
  max-width: 820px;
}
.heading h1 {
  margin: 0;
  color: var(--creation-ink, #071539);
  font: 600 clamp(65px, 6.3vw, 104px)/1.08 var(--font-serif), 'Instrument Serif', Georgia, serif;
  letter-spacing: -0.03em;
}
```

**Replace with (Part 1 of 2)**:
```css
.heading {
  max-width: 820px;
}
.heading h1 {
  margin: 0;
  color: var(--creation-ink, #071539);
  font: 600 clamp(36px, 3.8vw, 62px)/1.06 var(--font-serif), 'Instrument Serif', Georgia, serif;
  letter-spacing: -0.03em;
}
```

**Find anchor (Part 2 of 2 — `@media (max-width: 1120px)` in `ReadyWorkspace.module.css`)**:
```css
@media (max-width: 1120px) {
  .layout,
  .statsGrid,
  .ScheduleGrid,
  .choiceRow {
    grid-template-columns: 1fr;
  }
}
```

**Replace with (Part 2 of 2)**:
```css
@media (max-width: 1360px) {
  .layout,
  .statsGrid,
  .ScheduleGrid,
  .choiceRow {
    grid-template-columns: 1fr;
  }
}
```

---

### STEP-11: Add ultrawide max-width containment to `Explore.module.css` and container-relative illustration bounds to `ExploreHero.module.css`

- **Requirement IDs**: `REQ-07`
- **Target file 1**: `src/client/screens/dashboard/explore/Explore.module.css`
- **Operation**: `Replace block`

**Find anchor (`Explore.module.css`)**:
```css
.explore {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: 20px 28px 56px 28px;
  background: var(--ud-color-bg-canvas);
  min-height: 100%;
  font-family: var(--ud-font-sans);
  position: relative;
  isolation: isolate;
  overflow-x: clip;
}
```

**Replace with (`Explore.module.css`)**:
```css
.explore {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: 20px 28px 56px 28px;
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
  background: var(--ud-color-bg-canvas);
  min-height: 100%;
  font-family: var(--ud-font-sans);
  position: relative;
  isolation: isolate;
  overflow-x: clip;
}
```

- **Target file 2**: `src/client/screens/dashboard/explore/components/ExploreHero/ExploreHero.module.css`
- **Operation**: `Replace block`

**Find anchor (`ExploreHero.module.css`)**:
```css
.imageWrapper {
  position: absolute;
  bottom: -260px;
  left: clamp(320px, 40vw, 560px);
  width: clamp(360px, 46vw, 720px);
  max-width: none;
  z-index: 3;
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  pointer-events: none;
  user-select: none;
}
```

**Replace with (`ExploreHero.module.css`)**:
```css
.imageWrapper {
  position: absolute;
  bottom: -260px;
  left: clamp(300px, 38%, 540px);
  width: clamp(340px, 48%, 680px);
  max-width: none;
  z-index: 3;
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  pointer-events: none;
  user-select: none;
}
```

---

### STEP-12: Center `CohortLayout.module.css` on ultrawide displays and cap hero title scaling in `CohortHero.module.css`

- **Requirement IDs**: `REQ-07`
- **Target file 1**: `src/client/screens/cohort/components/CohortLayout/CohortLayout.module.css`
- **Operation**: `Replace block`

**Find anchor (`CohortLayout.module.css`)**:
```css
.layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 12px var(--cohort-page-gutter, var(--space-6)) 32px;
}
```

**Replace with (`CohortLayout.module.css`)**:
```css
.layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1480px;
  margin: 0 auto;
  box-sizing: border-box;
  padding: 12px var(--cohort-page-gutter, var(--space-6)) 32px;
}
```

- **Target file 2**: `src/client/screens/cohort/components/CohortHero/CohortHero.module.css`
- **Operation**: `Replace block`

**Find anchor (`CohortHero.module.css`)**:
```css
.title {
  max-width: 980px;
  margin: 0;
  color: #fff;
  font-size: clamp(3.4rem, 6vw, 6.5rem);
  font-weight: 900;
  line-height: 0.9;
  letter-spacing: -0.07em;
  text-shadow: 0 18px 32px rgb(0 0 0 / 23%);
  overflow-wrap: break-word;
}
```

**Replace with (`CohortHero.module.css`)**:
```css
.title {
  max-width: 920px;
  margin: 0;
  color: #fff;
  font-size: clamp(2.5rem, 4.2vw, 4.75rem);
  font-weight: 900;
  line-height: 0.94;
  letter-spacing: -0.06em;
  text-shadow: 0 18px 32px rgb(0 0 0 / 23%);
  overflow-wrap: break-word;
}
```

---

### STEP-13: Add ultrawide and zoom-in resilience to `RoomScreen.module.css` (`/studyroom/[roomSlug]`) and `Auth.module.css` (`/auth`)

- **Requirement IDs**: `REQ-07`
- **Target file 1**: `src/client/screens/dashboard/studyroom/room/RoomScreen.module.css`
- **Operation**: `Replace block`

**Find anchor (`RoomScreen.module.css`)**:
```css
.cockpit {
  position: relative;
  z-index: 10;
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px 0;
  pointer-events: none;
}
```

**Replace with (`RoomScreen.module.css`)**:
```css
.cockpit {
  position: relative;
  z-index: 10;
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 1760px;
  margin: 0 auto;
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: clamp(12px, 2vh, 20px) clamp(16px, 2.2vw, 32px) 0;
  pointer-events: none;
}
```

- **Target file 2**: `src/client/screens/auth/Auth.module.css`
- **Operation**: `Replace block`

**Find anchor (`Auth.module.css`)**:
```css
  display: grid;
  grid-template-columns: minmax(0, 1fr) 520px;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  background: #FFFFFF;
  overflow: hidden;
}

[data-theme="dark"] .auth {
  background: #000000;
  color: #FFFFFF;
}

.showcase {
  position: relative;
  min-width: 0;
  overflow: hidden;
}

.panel {
  position: relative;
  display: flex;
  align-items: stretch;
  overflow-y: auto;
  max-height: 100vh;
  scrollbar-width: thin;
}
```

**Replace with (`Auth.module.css`)**:
```css
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(440px, 34vw, 620px);
  width: 100%;
  min-height: 100dvh;
  height: 100dvh;
  margin: 0;
  padding: 0;
  background: #FFFFFF;
  overflow: hidden;
}

[data-theme="dark"] .auth {
  background: #000000;
  color: #FFFFFF;
}

.showcase {
  position: relative;
  min-width: 0;
  overflow: hidden;
}

.panel {
  position: relative;
  display: flex;
  align-items: stretch;
   justify-content: center;
  overflow-y: auto;
  max-height: 100dvh;
  scrollbar-width: thin;
}
```

---

## E. Verification and failure handling

### 1. Automated test suite verification
Run the following commands from `d:\ThisPC\Documents\SideQuestHQ\undone-site` in PowerShell:

```powershell
npx vitest run src/app/styles/__tests__/static-enforcement.test.ts src/app/styles/__tests__/cascade-regression.test.ts
npx vitest run src/client/screens/landing/Hero/components/__tests__/CentralInterface.test.tsx src/client/screens/landing/Hero/components/__tests__/HeaderNav.test.tsx src/client/components/global/LearningPromptBar/__tests__/LearningPromptBar.test.tsx
npx vitest run src/client/screens/cohortBuilder/__tests__/intake-screen.test.tsx src/client/screens/cohortBuilder/__tests__/shell.test.tsx src/client/screens/cohortBuilder/__tests__/CohortWorkspacePane.test.tsx
npx vitest run src/client/screens/cohortCreation/__tests__/RecommendationCover.test.tsx src/client/screens/cohortCreation/__tests__/ChunkingWorkspace.test.tsx src/client/screens/cohortCreation/__tests__/ReadyWorkspace.test.tsx src/client/screens/auth/__tests__/Auth.test.tsx src/client/screens/cohort/components/CohortHero/__tests__/CohortHero.test.tsx
```

- **Expected result**: All 11 test files pass with `0` failures.
- **Failure handling**:
  - If `static-enforcement.test.ts` fails on CSS parsing in any modified `.module.css` file, inspect the syntax around the modified block in that file for mismatched braces `{}` or missing semicolons.
  - If any `Replace block` fails to match, run `git diff <file>` to verify the file has not already been partially edited, and compare line endings (`CRLF` vs `LF`).

### 2. Viewport & Zoom acceptance matrix (DevTools Device Toolbar / Browser Zoom)
When visually verifying in the browser (`npm run dev`), confirm the following viewports:
- **Zoomed-In Desktop (`1280x720` / `1366x768` or 125%–150% zoom on `1920x1080`)**:
  - `/` (Homepage Hero): `.centralInterface` sits cleanly above `.bottomEdgeParchmentLeft`/`Right` and `.collageLeft`/`Right`; `.promptRow` renders as a 2x2 grid (`max-width: 720px`) with zero overlap from the `"Different Paths Same Sky"` ribbon or coffee mug; `.cohortsStripContainer` cards at the bottom are completely unobstructed.
  - `/quest/build/[workspaceId]` (Split mode): Decorative polaroids/books (`.materialDecorations` / `.decorations`) hide cleanly below `1640px` width or `820px` height; recommendation and starting-point cards stack into a single readable column inside `.rightPane` without horizontal cramping.
- **Ultrawide & Zoomed-Out (`2560x1440`, `3440x1440`, or 50%–75% zoom on `1920x1080`)**:
  - `/` (Homepage Hero): `.header` is bounded to `1920px`; `.collageLeft` and `.collageRight` anchor relative to the `2160px` stage instead of drifting to extreme corners with broken `77.89vw` parchment offsets; `.cohortsStripContainer` is symmetrically centered.
  - `/quest/start` & `/quest/build/[workspaceId]`: `.rightPane` content stays centered (`max-width: 1360px`); centered-chat `.brandHeader` aligns within `1440px`; `ReadyWorkspace` and `RecommendationResults` headings stay capped (`<= 62px`).
  - `/explore`, `/cohort/[cohortId]`, `/studyroom/[roomSlug]`: Content stays centered within `1440px` / `1480px` / `1760px` tracks instead of stretching edge-to-edge across 3440px.

---

## F. Completion report contract

When execution of this guide is complete, the executing agent must return a report matching this exact structure:

```markdown
## Execution Report: IdiotHandOffGuide-UltrawideAndZoomResponsiveFix

- **Status**: COMPLETE | BLOCKED
- **Steps completed**: STEP-01 through STEP-13
- **Modified files**:
  - `src/client/screens/landing/Hero/Hero.tsx`
  - `src/client/screens/landing/Hero/Hero.module.css`
  - `src/client/components/global/SuggestionPromptRow/SuggestionPromptRow.module.css`
  - `src/client/screens/cohortBuilder/CohortIntakeScreen.module.css`
  - `src/client/screens/cohortBuilder/CohortBuilder.module.css`
  - `src/client/screens/cohortCreation/components/RecommendationResults.module.css`
  - `src/client/screens/cohortCreation/components/StartingPoint.module.css`
  - `src/client/screens/cohortCreation/components/MaterialWorkspace.module.css`
  - `src/client/screens/cohortCreation/components/ChunkingWorkspace.module.css`
  - `src/client/screens/cohortCreation/components/ReadyWorkspace.module.css`
  - `src/client/screens/dashboard/explore/Explore.module.css`
  - `src/client/screens/dashboard/explore/components/ExploreHero/ExploreHero.module.css`
  - `src/client/screens/cohort/components/CohortLayout/CohortLayout.module.css`
  - `src/client/screens/cohort/components/CohortHero/CohortHero.module.css`
  - `src/client/screens/dashboard/studyroom/room/RoomScreen.module.css`
  - `src/client/screens/auth/Auth.module.css`
- **Verification output**:
  - Style & Cascade tests: PASS / FAIL
  - Landing & PromptBar tests: PASS / FAIL
  - CohortBuilder & CohortCreation tests: PASS / FAIL
  - Auth & CohortHero tests: PASS / FAIL
- **Deviations or blockers**: None
```

### Author validation summary
- **Guide file**: `plans/architecture-and-refactor/IdiotHandOffGuide-UltrawideAndZoomResponsiveFix.md`
- **Validation status**: All 16 target files and replacement anchors verified against current workspace HEAD (`3c84f6200e0847d642521e4cdbe06ed8d4c9059b`); zero placeholders, zero elisions, and zero project files mutated during guide authoring.
