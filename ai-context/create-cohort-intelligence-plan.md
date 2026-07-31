# Create Cohort Creator Intelligence Plan

## Scope
This document defines Prompt 4 of the Create Cohort flow: the Creator Intelligence Layer. Prompt 4 builds directly upon Step 3 (Curriculum Generation & Editor) and transforms the auto-generated curriculum into a polished, professional Creator Curriculum Studio.

The architecture strictly adheres to SideQuestHQ screen-first conventions:

- Screen-first module structure inside `src/client/components/screens/dashboard/createCohort/`
- Presentation-model-driven UI
- Small focused components
- Hooks orchestrating state, quality evaluation, undo/redo, and bulk actions
- CSS Modules beside components
- Local provider state (`WizardProvider`), no Redux overhead
- Presentation models decoupled from raw backend DTOs

---

## Creator Workflow

The creator workflow in the Creator Curriculum Studio centers on refinement, quality optimization, and publishing preparation:

1. **Auto-Generation Baseline**: Step 3 produced initial 10-hour balanced seasons, lessons, and 5-minute learning chunks.
2. **Quality & Validation Audit**: The top status panel computes a live Curriculum Quality Score (0–100%) and renders a live Publishing Readiness Checklist with direct focus links.
3. **Inspector & Rich Metadata Refinement**: Creators refine rich lesson, season, and journey-level metadata (objectives, prerequisites, XP rewards, completion messages, resources, and custom thumbnails).
4. **Bulk Intelligence & Automation**: Creators perform instant bulk operations (auto-renaming, duration normalization, merging empty items, bulk tag/difficulty/XP application).
5. **Multi-Selection & Productivity**: Multi-item selection, right-click context menus, keyboard shortcuts (Cmd+K search, Cmd+Z undo, Cmd+Shift+Z redo, Cmd+D duplicate, Delete), and live dirty state tracking ("Saved" / "Unsaved Changes").

---

## Metadata Architecture

The metadata layer is structured into three presentation domains:

### 1. Curriculum (Journey) Metadata
- `journeyName`, `journeyDescription`, `journeyThumbnail`, `estimatedCompletion`, `difficulty`, `categories`, `primaryLanguage`, `targetAudience`, `requiredExperience`, `creatorNotes`, `journeyOutcomes`

### 2. Season Metadata
- `id`, `title`, `subtitle`, `description`, `summary`, `thumbnail`, `color`, `difficulty`, `estimatedHours`, `seasonObjectives` (string array), `seasonCompletionMessage`

### 3. Lesson Metadata
- `id`, `title`, `subtitle`, `description`, `thumbnail`, `difficulty`, `xp`, `duration`, `tags`, `resources`, `assignments`, `prerequisites`, `notes`, `visibility`, `learningObjectives`, `completionMessage`, `chunks`

All metadata models remain strictly view/presentation models with typed mutation actions exposed via `WizardProvider`.

---

## Curriculum Quality Scoring System

The Quality Score is calculated dynamically on every edit with zero latency:

$$\text{Quality Score} = \max\left(0, 100 - \sum \text{Deductions}\right)$$

### Scoring Penalties Matrix:
- Missing lesson thumbnail: -3 points per lesson
- Empty lesson description: -4 points per lesson
- Zero / invalid lesson duration: -10 points per lesson
- Missing lesson learning objectives: -2 points per lesson
- Missing lesson prerequisites: -1 point per lesson
- Unnamed / placeholder season title: -5 points per season
- Empty season (0 lessons): -10 points per season
- Season length anomaly (< 2h or > 13h): -4 points per season
- Duplicate lesson titles: -8 points per set
- Missing cohort tags / categories: -5 points
- Missing cohort requirements / outcomes: -5 points

### Quality Tiers:
- **90% – 100%**: Excellent (Publish Ready)
- **75% – 89%**: Good (Minor Improvements Recommended)
- **50% – 74%**: Needs Attention (Validation Warnings Present)
- **0% – 49%**: Incomplete (Blocking Issues Present)

---

## Publishing Readiness Checklist

The persistent live checklist evaluates mandatory rules:
1. `[x]` Cover image configured
2. `[x]` Journey description provided
3. `[x]` At least 1 primary category selected
4. `[x]` Learning outcomes defined
5. `[x]` Curriculum generated & structured
6. `[x]` All lessons contain thumbnails
7. `[x]` No empty seasons
8. `[x]` No zero-duration lessons
9. `[x]` Cohort tags added
10. `[x]` Total duration verified

Badge state transitions between:
- `<Badge variant="success">Ready to Publish</Badge>`
- `<Badge variant="warning">Needs Attention (X checks remaining)</Badge>`

---

## AI Enhancement & Layer Boundaries

Responsibilities are strictly compartmentalized:

- **Client Presentation & Editor Layer**: Owns rendering, local undo/redo history stack, selection state, drag/drop state, keyboard shortcuts, inline inspector editing, and UI feedback.
- **Provider & Domain Action Layer (`WizardProvider`)**: Owns state transitions, quality scoring calculation, checklist rules, bulk operation algorithms, and history stack management.
- **Shared Pure Helper Layer (`src/shared/curriculum`)**: Pure deterministic algorithms for auto-renaming, duration normalization, chunking, auto-balancing, and quality evaluation logic.
- **API & AI Boundary Layer (`/api/curriculum/...`)**: Clean endpoint interface so future LLM or server-side intelligence (Prompt 5/6) can plug in AI season naming, AI lesson summary generation, and auto-chunk labeling without mutating client presentation contracts.

---

## Directory & Folder Additions

```
src/client/components/screens/dashboard/createCohort/
├── components/
│   ├── CurriculumBoard/        (Enhanced with multi-select, context menu, animations)
│   ├── CurriculumInspector/    (Expanded with multi-tab rich metadata & season/journey tabs)
│   ├── CurriculumQuality/      (Quality Score badge & live breakdown drawer)
│   ├── CurriculumChecklist/    (Persistent Live Publishing Checklist)
│   ├── CurriculumBulkBar/      (Floating bulk action bar for multi-selected items)
│   ├── CurriculumContextMenu/ (Right-click context menu for seasons/lessons)
│   └── CurriculumShortcuts/   (Keyboard shortcuts modal & trigger)
├── hooks/
│   ├── useCurriculumQuality.ts (Hook for computing quality score & checklist)
│   ├── useCurriculumHistory.ts (Hook for local Undo / Redo stack)
│   └── useKeyboardShortcuts.ts (Hook for global studio shortcuts: Cmd+K, Cmd+Z, Delete, etc.)
├── models/
│   └── intelligence.ts         (Types for quality score, checklist, multi-selection, history)
└── services/
    └── bulkOperationsService.ts (Pure client helpers for bulk renaming, duration normalization, etc.)
```

---

## Conclusion & Prompt 5 Preparation

This design ensures creators operate inside a state-of-the-art Curriculum Studio. Prompt 5 will build directly on top of this studio to implement final publishing, privacy controls, preview mode, and deployment.
