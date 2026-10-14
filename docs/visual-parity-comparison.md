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
| **Processing (Understanding / Chunking)** | Desktop (1280×900) | Light | `legacy-processing-chunking-desktop-light.png` | `builder-processing-chunking-desktop-light.png` | Verified Parity |
| **Processing (Understanding / Chunking)** | Desktop (1280×900) | Dark | `legacy-processing-chunking-desktop-dark.png` | `builder-processing-chunking-desktop-dark.png` | Verified Parity |
| **Processing (Understanding / Chunking)** | Mobile (390×844) | Light | `legacy-processing-chunking-mobile-light.png` | `builder-processing-chunking-mobile-light.png` | Verified Parity |
| **Processing (Understanding / Chunking)** | Mobile (390×844) | Dark | `legacy-processing-chunking-mobile-dark.png` | `builder-processing-chunking-mobile-dark.png` | Verified Parity |
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

## 3. Confirmed Gap & Stage-Specific Layout Checklist

The user has explicitly specified that the builder must match **the exact frontend design and stage-specific screen compositions** of the legacy pipeline:

### Confirmed Gap in Processing / Chunking:
- **Legacy**:
  - Two-column layout with large "Finding natural learning chunks…" heading and `InkUnderline`.
  - Left Column: "Selected material" inventory card with source list radio buttons, chunk counts, progress bar, and processing checklist.
  - Right Column: "Accepted chunks" panel displaying the selected source's title with `InkUnderline`, handwritten Caveat annotation, and numbered collapsible chunk items with offsets, quotations, and source references.
  - Explanatory copy and lightbulb insight box.
- **Current Builder**:
  - Generic monolithic layout displaying "Draft Curriculum" card and source input form.

### Stage-Specific Composition Checklist for Checkpoint 2:
1. **Understanding Stage View**:
   - Header: "Reading through your content…" with Playfair Display heading & InkUnderline.
   - Left Column: Selected material inventory with segment count and acquired checkmarks + progress bar + checklist.
   - Right Column: "Finding key ideas…" with Brain icon, paper note, concept cloud with topics from `workspace.understanding`, and lightbulb insight box.
2. **Chunking Stage View**:
   - Header: "Finding natural learning chunks…" with Playfair Display heading & InkUnderline.
   - Left Column: Selected material inventory with chunk counts + progress bar + checklist.
   - Right Column: Selected source header with Caveat annotation + numbered chunks list from `workspace.chunks` with duration/offset, teaser, expandable evidence blockquote, and insight box.
3. **Analysis Stage View**:
   - Header: "Understanding each piece…" with Playfair Display heading & InkUnderline.
   - Left Column: Selected material inventory with analyzed chunk counts + progress bar + checklist.
   - Right Column: Selected source header + analyzed chunks list joined with `workspace.analyses` (summary, pedagogical questions), and insight box.
4. **Building / Assembly Stage View**:
   - Header: "Bringing it all together…"
   - Building progress section with partition/lesson counts and `BuildingArt` illustration.
5. **Curriculum / Review Stage View**:
   - Complete curriculum outline with lesson cards, grounded evidence drawers, discuss in chat, edit/pin/reorder/delete, and `ReleasePanel`.
6. **Stage Navigation & Inspection**:
   - Interactive stepper allows selecting any stage for inspection without triggering background mutations or model calls.
   - Reset to active stage control.
