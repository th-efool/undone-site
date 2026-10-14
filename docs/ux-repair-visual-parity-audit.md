# Visual Parity & Design System Audit: Legacy Creation Flow vs. Cohort Builder

**Target**: SideQuestHQ / Undone UX Repair — Checkpoint 3 Design Parity  
**Reference Legacy Flow**: `src/client/screens/cohortCreation/` (mounted at `/quest/draft/[draftId]`)  
**New Cohort Builder**: `src/client/screens/cohortBuilder/` (mounted at `/quest/build/[workspaceId]`)  
**Audit Mode**: Independent Visual Reviewer Inspection & Design System Alignment  
**Date**: 2026-10-14  

---

## 1. Executive Summary & Design Foundations

The legacy cohort creation flow (`/quest/draft/...`) embodies a distinctive **Warm Editorial / Academic Atelier** design language. It is characterized by:
1. **Warm tactile surfaces**: Natural paper background texture overlay (`/images/hero-collage/real-paper-texture.jpg`), warm tinted creams (`#fbf7f0`, `#fffcf7`), and warm sepia drop shadows (`#53391808`, `#5e43100b`, `#684e1510`).
2. **Generous typographic hierarchy**: High-contrast pairings of classical serif (*Playfair Display* for headlines, quotes, lesson titles, and chat bubbles), clean humanist grotesque (*Manrope* for UI controls), handwritten cursive annotations (*Caveat* via `--font-caveat-next`), and crisp sans display (*Geist Sans* for brand title).
3. **Spacious, relaxed composition**: Ample negative space (40px–48px gutters, generous margin bottoms), smooth rounded card containers (`border-radius: 18px–25px`), pill buttons (`border-radius: 20px–40px`), and continuous baseline step indicators.

In Checkpoint 3, all confirmed visual discrepancies between legacy components (`CreationShell`, `ProcessingSteps`, `StartingPoint`, `MaterialWorkspace`, `ReviewWorkspace`, `ReadyWorkspace`) and the new builder styles in `CohortBuilder.module.css` were resolved.

---

## 2. Token & Foundation Comparison Matrix

| Token / Property | Legacy Implementation (`cohortCreation`) | Cohort Builder Status | Parity Resolution |
| :--- | :--- | :--- | :--- |
| **`--creation-paper`** | `#fbf7f0` (light) / `#171b26` (dark) | `#fbf7f0` / `#171b26` | Matched |
| **`--creation-surface`** | `#fffcf7` (light) / `#202633` (dark) | `#fffcf7` / `#202633` | Matched |
| **`--creation-ink`** | `#08143d` (light) / `#f5eee1` (dark) | `#08143d` / `#f5eee1` | Matched |
| **`--creation-muted`** | `#536788` (light) / `#aebbd1` (dark) | `#536788` / `#aebbd1` | Matched |
| **`--creation-blue`** | `#303cff` (light) / `#9299ff` (dark) | `#303cff` / `#9299ff` | Matched |
| **`--creation-line`** | `#e9e0d5` (light) / `#394252` (dark) | `#e9e0d5` / `#394252` | Matched |
| **Paper Texture** | Fixed full-bleed `::before` overlay with `opacity: .07; mix-blend-mode: multiply;` using `real-paper-texture.jpg` | Fixed `::before` overlay with identical background | Matched |
| **Handwritten Font** | `var(--font-caveat-next), cursive` (registered in `src/app/layout.tsx`) | Fixed: was using invalid `var(--font-caveat)` in `.heroEyebrow`; corrected to `var(--font-caveat-next)` | Fixed & Matched |
| **Shadow Tone** | Warm sepia-tinted shadows: `box-shadow: 2px 0 9px #53391808`, `0 4px 14px #5e43100b`, `0 5px 15px #684e1510` | Updated `.rail` and `.sourceItem` to use warm sepia drop shadows (`#53391808`, `#503d1910`) | Fixed & Matched |

---

## 3. Structural & Component Comparison

### A. Conversation Rail & Brand Header
- **Rail Shell**:
  - Legacy: `grid-template-columns: clamp(300px, 26.1vw, 420px) minmax(0, 1fr); border-radius: 20px; border: 1px solid var(--creation-line); box-shadow: 2px 0 9px #53391808;`
  - Builder: Updated from a border-right sidepane to the legacy floating rounded card (`border-radius: 20px; border: 1px solid var(--creation-line); box-shadow: 2px 0 9px #53391808;`).
- **Brand Header**:
  - Legacy: `padding: 24px 40px 20px 48px; gap: 16px;` with **no bottom dividing border**.
  - Builder: Removed artificial `border-bottom` divider and expanded padding to `24px 36px 20px 40px`.

### B. Chat Pane & Composer
- **Messages & Spacing**:
  - Legacy: `padding: 42px 42px 20px 44px; margin-bottom: 40px;` between messages.
  - Builder: Adjusted padding to `36px 36px 20px 38px; gap: 28px;` and message margin to `28px`.
- **Bubble Typography**:
  - Legacy User Bubble: `font-size: 20px; line-height: 1.28; font-family: var(--font-playfair-display); padding: 9px 20px 15px;`
  - Builder User Bubble: Updated from 18px to 20px (`line-height: 1.28; padding: 9px 20px 15px;`).
  - Legacy Assistant Bubble: `font-size: 21px; line-height: 1.27; font-family: var(--font-playfair-display); margin: 0 0 14px;`
  - Builder Assistant Bubble: Updated from 19px to 21px (`line-height: 1.27; margin: 0 0 14px;`).
- **Hint Card**:
  - Legacy: `padding: 21px 20px; border-radius: 20px; border: 1px solid #f0e2cf;` with `14px` bold title and `13px / 1.55` body.
  - Builder: Aligned padding to `21px 20px;` with matching title and body font scales.
- **Composer**:
  - Legacy: `min-height: 61px; border: 1px solid #d8dcf0; border-radius: 17px; padding: 9px 13px 9px 17px; box-shadow: 0 0 0 1px #dce0f530;`
  - Send button: `width: 41px; height: 41px; border-radius: 11px; background: linear-gradient(150deg, #282eff, #3335d2);`
  - Suggestions buttons: `border-radius: 30px; padding: 8px 20px; font-size: 14px;`
  - Builder: Removed the artificial top border on `.composerArea`, set composer height to `61px`, send button to `41px x 41px`, and suggestions to `14px` pill buttons.

### C. Workspace Pane: Journey Progress Stepper
- **Stepper Geometry & Continuous Track**:
  - Legacy: `31px x 31px` circles (`border-radius: 50%; font-size: 11px;`), each `<li>` with `border-bottom: 2px solid #d7d6d1;` forming a continuous baseline track.
  - Builder: Upgraded step circles from undersized `22px x 22px` to `31px x 31px; border-radius: 50%; font-size: 12px; font-weight: 700;`. Restored continuous track underline `border-bottom: 2px solid #d7d6d1;` with active indicator `border-bottom-color: var(--creation-blue);` and generous `margin: 6px 0 36px;`.

### D. Sources List & Cards
- **Card Geometry & Typography**:
  - Legacy: `border: 1px solid var(--creation-border, #e6ded1); border-radius: 18px; padding: 22px; box-shadow: 0 4px 12px #503d1910;` with Playfair headings.
  - Builder: Updated `.sourceItem` to `border-radius: 18px; padding: 18px 22px; box-shadow: 0 4px 12px #503d1910;` with `17px / 1.3` Playfair Display titles.

### E. Evidence Drawer & Ref Buttons
- **Border Conventions**:
  - Legacy strictly reserved dashed borders for file upload drop targets.
  - Builder: Changed `.chatRefBtn` from dashed to solid subtle pill border (`1px solid color-mix(in srgb, var(--creation-blue) 30%, transparent)`). Changed `.evidenceDrawer` top border from dashed to `1px solid var(--creation-line)`.

### F. Release & Learner Delivery Panel
- **Color Palette & Pill Buttons**:
  - Legacy: `min-height: 52px; padding: 13px 28px; border-radius: 40px; background: linear-gradient(125deg, #1c2859, #07143d, #1c2859); box-shadow: 0 7px 18px #303cff20;`
  - Builder: Replaced generic off-palette Tailwind emerald (`#059669`) with brand electric blue pill (`border-radius: 40px; min-height: 48px;`). Upgraded `.releaseBtn` to `min-height: 52px; border-radius: 40px; padding: 13px 28px;` with legacy midnight blue gradient and glow shadow. Softened blocker/warning alert containers to warm terracotta styling (`#d8956e66`).

---

## 4. Architectural Boundaries Intentionally Preserved

The visual parity review focused strictly on aesthetics, typography, tokens, geometry, and layout. The following v2 architectural foundations were intentionally preserved without regression:
1. **Canonical State & SSE**: v2 continues to use canonical persisted state (`CohortWorkspace`), durable worker jobs, outbox events, and SSE subscriptions. None of the legacy v1 regex chat routing, ad-hoc state machines, or legacy writers were imported.
2. **Grounded Source Evidence**: v2 maintains verifiable quotation provenance, character/page offsets, and anchored citations in the curriculum view.
3. **Conflict Comparison**: v2 preserves dirty editor retention, selective field reapplication, and CAS concurrency protection.
4. **Honest Progress Stepper**: Stepper indicators in v2 reflect true canonical job status (empty/idle shows 0 completed; completed checkmarks appear only when canonical evidence confirms completion).
