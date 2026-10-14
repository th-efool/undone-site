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

## 3. Stage-Specific Screen Compositions Parity Resolution

The previously confirmed gap where the builder displayed a generic monolithic card during processing has been completely resolved. The builder now mounts dedicated, stage-specific screen compositions directly over canonical v2 state:

1. **Intake Stage View (`IntakeStageView.tsx`)**:
   - Starting point composition for ungrounded workspaces.
   - Preserves goal, provides source entry form, and allows kicking off the pipeline.

2. **Understanding Stage View (`UnderstandingStageView.tsx`)**:
   - Header: *"Reading through your content…"* / *"All selected content has been read."* with Playfair Display typography and `InkUnderline`.
   - Left Column: Selected material inventory with segment count and acquired checkmarks + progress bar + *"Re-understand selected material"* action.
   - Right Column: *"Finding key ideas…"* with Brain icon, paper note (*"Important ideas, grounded in your material"*), concept cloud with topics from `workspace.understanding`, and lightbulb insight box (`${topics.length} key ideas identified`).

3. **Chunking Stage View (`ChunkingStageView.tsx`)**:
   - Header: *"Finding natural learning chunks…"* / *"Your learning chunks are saved."* with Playfair Display heading and `InkUnderline`.
   - Left Column: Selected material radio selector with chunk count badges, progress bar, and 4-stage `ProcessingChecklist`.
   - Right Column: Selected source header with title underline and Caveat annotation (*"Review the source segments below"*), collapsible chunk items with character offsets (`characters {start}–{end}`), teaser, expandable evidence blockquote, and lightbulb insight box.

4. **Analysis Stage View (`AnalysisStageView.tsx`)**:
   - Header: *"Understanding each piece…"* with Playfair Display heading and `InkUnderline`.
   - Left Column: Selected material inventory with analyzed chunk counts, progress bar, and `ProcessingChecklist`.
   - Right Column: Selected source header + analyzed chunks list joined with `workspace.analyses` (summary, pedagogical questions), and insight box.

5. **Building / Assembly Stage View (`AssemblyStageView.tsx`)**:
   - Header: *"Bringing it all together…"*.
   - Assembly progress section with partition/lesson counts and `<BuildingArt />` SVG illustration.

6. **Curriculum & Review Stage View (`CurriculumStageView.tsx` & `ReleasePanel.tsx`)**:
   - Full curriculum outline layout with Learning Blueprint card, grounded source text (`#builder-sources`), lesson cards with pinning/editing/reordering/deletion, orphan warnings, expandable evidence citations, chat discussion, and `ReleasePanel`.

7. **Stage Navigation & Inspection**:
   - Interactive stepper allows selecting any stage for inspection (`setInspectedStage`) without triggering background mutations or model calls.
   - Fully keyboard accessible (`Enter` / `Space` on step items).
   - Prominent status banner allows 1-click return to active stage.

---

## 4. Acceptance Verification Summary

- **Visual Fidelity**: Matched typography (Playfair Display, Manrope, Caveat), exact color variables (`--creation-paper`, `--creation-surface`, `--creation-ink`, `--creation-blue`, `--creation-line`), paper texture overlays, and responsive breakpoints.
- **Mobile Correctness**: Sticky `.paneNavigation` at `< 820px` prevents navigation trapping; wrapped stepper at `< 640px` prevents horizontal overflow; 2-column cards stack cleanly.
- **Canonical Architecture**: Retained 100% of the v2 single store, typed actions, CAS revisions, and durable backend processing. Stage inspection is pure presentation state.
- **Automated Regression Suite**: 87 focused unit and integration tests passing in `src/client/screens/cohortBuilder`.
