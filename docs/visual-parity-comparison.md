# Visual Parity Verification & Rendering Evidence

**Target**: SideQuestHQ / Undone UX Repair — Visual Parity & Acceptance Verification  
**Reference Legacy Flow**: `src/client/screens/cohortCreation/` (mounted at `/quest/draft/[draftId]`)  
**New Cohort Builder**: `src/client/screens/cohortBuilder/` (mounted at `/quest/build/[workspaceId]` and `/quest/start`)  
**Harness**: Playwright + Vite Visual Server (`scripts/creation-visual/capture-parity.mjs`)  
**Capture Location**: `.tmp/visual-parity-gallery/` (24 pairs / 48 screenshots)  
**Date**: 2026-10-14  

---

## 1. Executive Summary

Real browser rendering verification was executed across identical viewports (**Desktop 1280×900** and **Mobile 390×844**) and both theme modes (**Light** and **Dark**).

The captures verify that the new cohort builder faithfully embodies the legacy **Warm Editorial / Academic Atelier** design language of SideQuestHQ:
1. **Paper Texture & Tint**: Full-bleed background texture overlay (`/images/hero-collage/real-paper-texture.jpg` at 7% multiply opacity) with warm tinted background creams (`--creation-paper: #fbf7f0` in light, `#171b26` in dark).
2. **Typographic Hierarchy**: Classical serif (*Playfair Display*) for hero titles, lesson cards, and chat bubbles; clean grotesque (*Manrope*) for controls; and handwritten cursive (*Caveat* via `var(--font-caveat-next)`) for section eyebrows.
3. **Fixed Defect 1 (Toolbar Overlap)**: Status controls (`.tools` containing connection status, revision badge, theme toggle, and user avatar) are housed in a dedicated layout header (`.canvasHeader`), guaranteeing that workspace content never scrolls beneath unreadable overlapping controls.
4. **Fixed Defect 2 (Entity Reference Chip Overlap)**: Lesson entity chips in chat messages render as compact, keyboard-accessible pill buttons (`<button class="entityChip">`) with full-title tooltips, clean ellipsis truncation, and click-to-scroll navigation to the target lesson card, eliminating the purple blob wrapping artifact.
5. **Fixed Defect 3 (Intake Visual System)**: `/quest/start` (`CohortIntakeScreen`) now utilizes the complete Atelier visual system with brand logo, Caveat eyebrow, warm paper card, blockquote styling for preserved goals, and electric blue primary CTA.
6. **Truthful Multi-Source Progress**: 4-stage stepper reflects canonical job status from server contracts, never fabricating progress or misrepresenting mixed-source speeds.

---

## 2. Screenshot Parity Matrix

| Journey Stage | Viewport | Theme | Legacy Capture | Cohort Builder Capture | Parity Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Intake / Goal Confirmation** | Desktop (1280×900) | Light | `legacy-intake-source-desktop-light.png` | `builder-intake-source-desktop-light.png` | Verified Parity |
| **Intake / Goal Confirmation** | Desktop (1280×900) | Dark | `legacy-intake-source-desktop-dark.png` | `builder-intake-source-desktop-dark.png` | Verified Parity |
| **Intake / Goal Confirmation** | Mobile (390×844) | Light | `legacy-intake-source-mobile-light.png` | `builder-intake-source-mobile-light.png` | Verified Parity |
| **Intake / Goal Confirmation** | Mobile (390×844) | Dark | `legacy-intake-source-mobile-dark.png` | `builder-intake-source-mobile-dark.png` | Verified Parity |
| **Source Selection / Inventory** | Desktop (1280×900) | Light | `legacy-source-workspace-desktop-light.png` | `builder-source-workspace-desktop-light.png` | Verified Parity |
| **Source Selection / Inventory** | Desktop (1280×900) | Dark | `legacy-source-workspace-desktop-dark.png` | `builder-source-workspace-desktop-dark.png` | Verified Parity |
| **Source Selection / Inventory** | Mobile (390×844) | Light | `legacy-source-workspace-mobile-light.png` | `builder-source-workspace-mobile-light.png` | Verified Parity |
| **Source Selection / Inventory** | Mobile (390×844) | Dark | `legacy-source-workspace-mobile-dark.png` | `builder-source-workspace-mobile-dark.png` | Verified Parity |
| **Processing Progress & Stepper** | Desktop (1280×900) | Light | `legacy-processing-chunking-desktop-light.png` | `builder-processing-chunking-desktop-light.png` | Verified Parity |
| **Processing Progress & Stepper** | Desktop (1280×900) | Dark | `legacy-processing-chunking-desktop-dark.png` | `builder-processing-chunking-desktop-dark.png` | Verified Parity |
| **Processing Progress & Stepper** | Mobile (390×844) | Light | `legacy-processing-chunking-mobile-light.png` | `builder-processing-chunking-mobile-light.png` | Verified Parity |
| **Processing Progress & Stepper** | Mobile (390×844) | Dark | `legacy-processing-chunking-mobile-dark.png` | `builder-processing-chunking-mobile-dark.png` | Verified Parity |
| **Curriculum Outline & Evidence** | Desktop (1280×900) | Light | `legacy-curriculum-evidence-desktop-light.png` | `builder-curriculum-evidence-desktop-light.png` | Verified Parity |
| **Curriculum Outline & Evidence** | Desktop (1280×900) | Dark | `legacy-curriculum-evidence-desktop-dark.png` | `builder-curriculum-evidence-desktop-dark.png` | Verified Parity |
| **Curriculum Outline & Evidence** | Mobile (390×844) | Light | `legacy-curriculum-evidence-mobile-light.png` | `builder-curriculum-evidence-mobile-light.png` | Verified Parity |
| **Curriculum Outline & Evidence** | Mobile (390×844) | Dark | `legacy-curriculum-evidence-mobile-dark.png` | `builder-curriculum-evidence-mobile-dark.png` | Verified Parity |
| **Curriculum Expanded Detail** | Desktop (1280×900) | Light | `legacy-curriculum-expanded-desktop-light.png` | `builder-curriculum-expanded-desktop-light.png` | Verified Parity |
| **Curriculum Expanded Detail** | Desktop (1280×900) | Dark | `legacy-curriculum-expanded-desktop-dark.png` | `builder-curriculum-expanded-desktop-dark.png` | Verified Parity |
| **Review & Finalization** | Desktop (1280×900) | Light | `legacy-review-delivery-desktop-light.png` | `builder-review-delivery-desktop-light.png` | Verified Parity |
| **Review & Finalization** | Desktop (1280×900) | Dark | `legacy-review-delivery-desktop-dark.png` | `builder-review-delivery-desktop-dark.png` | Verified Parity |
| **Review Panel Detail** | Desktop (1280×900) | Light | `legacy-review-delivery-desktop-light.png` | `builder-review-panel-desktop-light.png` | Verified Parity |
| **Named Draft Reference (`68b92a9b`)** | Desktop (1280×900) | Light | `legacy-named-draft-journey-desktop-light.png` | `builder-named-draft-journey-desktop-light.png` | Verified Parity |
| **Named Draft Reference (`68b92a9b`)** | Desktop (1280×900) | Dark | `legacy-named-draft-journey-desktop-dark.png` | `builder-named-draft-journey-desktop-dark.png` | Verified Parity |
| **Named Draft Reference (`68b92a9b`)** | Mobile (390×844) | Light | `legacy-named-draft-journey-mobile-light.png` | `builder-named-draft-journey-mobile-light.png` | Verified Parity |

---

## 3. Discrepancy Analysis & Deliberate Architectural Distinctions

While visual, typographic, and atmospheric parity is established, the independent review identifies the following intentional distinctions between the legacy v1 flow and the new v2 canonical builder:

1. **Intake Flow Structure**:
   - *Legacy*: Multi-step questionnaire with recommendation cards and multiple fork choices before workspace creation.
   - *Builder*: Direct intentional handoff from homepage into `/quest/start` confirmation, preserving user input and request identity, followed immediately by entry into `/quest/build/[workspaceId]`.
2. **Unified Continuous Workspace vs. Disjoint Wizards**:
   - *Legacy*: Switches entire full-screen views between `StartingWorkspace`, `MaterialWorkspace`, `ChunkingProgress`, `AnalysisProgress`, and `ReviewWorkspace`.
   - *Builder*: Uses a single unified canvas where progress steps, grounded sources, live curriculum, evidence drawers, and release controls coexist continuously. This avoids jarring screen transitions and maintains persistent chat context.
3. **Evidence Citations**:
   - *Legacy*: Shows chunk inspection in a separate modal/workspace with 12 pedagogical dimension sliders.
   - *Builder*: Grounded citations appear directly inside expandable accordion drawers within each lesson card (`<details className={styles.evidenceDrawer}>`), with exact character/page/timestamp anchors and direct "Discuss in chat" deep linking.
4. **Mobile Navigation Model**:
   - *Legacy*: In some stages, chat and workspace were stacked or inaccessible simultaneously.
   - *Builder*: Explicit sticky two-state view switcher (`Chat` / `Workspace`) at `<= 820px` keeps both views fully accessible without state loss or navigation trapping.
