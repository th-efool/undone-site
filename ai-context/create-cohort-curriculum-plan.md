# Create Cohort Curriculum Plan

## Scope
This document defines Step 3 of the Create Cohort flow: taking the imported source payload produced by Prompt 2 and turning it into a fully generated, editable curriculum.

The architecture stays inside the existing SideQuestHQ dashboard conventions:

- screen-first module structure
- presentation-model-driven UI
- small focused components
- hooks orchestrate state and actions
- CSS Modules beside components
- local provider state, not Redux
- no backend DTOs exposed to the UI
- no React component owns generation logic

## Current Baseline

Prompt 1 established the wizard shell, Details step, Sources step, and `WizardProvider`.

Prompt 2 added:

- real YouTube playlist import
- import service boundary on the client
- Next.js API route for YouTube import
- streamed import events
- imported source presentation models

Step 3 must extend that architecture, not replace it.

## Architectural Decision

The curriculum system will be split into three layers:

1. `WizardProvider` on the client owns current wizard state, imported sources, curriculum draft state, selection state, and editor actions.
2. A shared pure generator module computes curriculum structure from imported sources.
3. A Next.js API route exposes the generator through an application-owned contract.

This split is intentional.

- The client stays provider-agnostic and only deals in renderable presentation models.
- The server owns the generation boundary so future AI or backend enrichment can replace the heuristic generator without reworking the editor.
- The shared pure generator keeps the exact same transformation logic available to both the API route and local regeneration actions, avoiding duplicated business rules.

## Screen Architecture

The Create Cohort screen remains the root screen.

The step flow becomes:

1. Details
2. Sources
3. Curriculum
4. Publish

Step 3 is the new curriculum editor. It is not a separate route. It remains inside the existing dashboard shell and wizard frame so navigation, layout, and state persistence stay consistent with Prompt 1 and Prompt 2.

The Curriculum step will render:

- a top summary strip with curriculum statistics and generation tools
- a season/lesson/chunk board
- a right-side inspector for the selected season or lesson
- validation warnings

## Folder Structure

Only the folders that are needed now will be created.

### Client screen module

- `src/client/components/screens/dashboard/createCohort/components/CurriculumStep/`
- `src/client/components/screens/dashboard/createCohort/components/CurriculumBoard/`
- `src/client/components/screens/dashboard/createCohort/components/CurriculumInspector/`
- `src/client/components/screens/dashboard/createCohort/components/CurriculumToolbar/`
- `src/client/components/screens/dashboard/createCohort/components/CurriculumWarnings/`
- `src/client/components/screens/dashboard/createCohort/components/CurriculumStats/`
- `src/client/components/screens/dashboard/createCohort/hooks/`
- `src/client/components/screens/dashboard/createCohort/models/`
- `src/client/components/screens/dashboard/createCohort/services/`

### Shared generator layer

- `src/shared/curriculum/`

### Server layer

- `src/server/curriculum/`
- `src/app/api/curriculum/generate/route.ts`

This keeps responsibilities isolated while preserving the project’s existing screen-first organization.

## Data Flow

The flow is:

`ImportedSource` -> `CurriculumGenerationService` -> `Next.js API route` -> `shared generator` -> `GeneratedCurriculum`

For editing:

`GeneratedCurriculum` -> `WizardProvider` -> `CurriculumStep` presentation models -> editor actions -> updated `GeneratedCurriculum`

This matters because the UI should never reconstruct structure from raw lesson arrays. It should consume the same model the generator produced, then edit that model in place.

## Curriculum Models

The curriculum layer will use presentation models, not backend DTOs.

Core models:

- `GeneratedCurriculum`
- `Season`
- `Lesson`
- `Chunk`
- `CurriculumWarning`

Editor-support models:

- `CurriculumEditorModel`
- `CurriculumStatsModel`
- `CurriculumToolbarModel`
- `CurriculumInspectorModel`
- `CurriculumSelectionModel`

These models exist to describe what the UI renders. They are not a wire protocol.

Key rule:

- generator input can be shaped from imported sources
- generator output is the source of truth for the editor
- UI models may add view-only flags like `collapsed`, `selected`, `dragging`, or `warningCount`

## Generation Responsibilities

### Shared generator module

The shared generator module will:

- convert imported lesson durations into numeric minutes
- group lessons into seasons using a 10 hour target
- keep playlist order unless an explicit regeneration action changes it
- create chunk structures for every lesson
- generate curriculum statistics
- build warnings

Why shared:

- the API route and the editor actions need identical rules
- regeneration buttons must behave the same way as initial generation
- moving the logic into one pure module avoids drift

### Server responsibilities

The server route will:

- validate incoming requests
- normalize imported source input
- call the shared generator
- return clean curriculum presentation models

Why server:

- future AI generation can be added without changing the UI contract
- the route becomes the only network boundary the client needs to know about
- expensive or provider-backed generation can later move behind the same endpoint

### Client responsibilities

The client service will:

- call the API route
- surface loading and error states
- keep the UI unaware of provider details

Why client service:

- the screen only knows about one service boundary
- the provider stays clean and orchestration-focused
- the UI does not couple to fetch logic or response shapes

## Season Balancing Algorithm

The generator will balance seasons by duration, not by lesson count.

Target:

- 10 hours per season

Approach:

- convert all lesson durations to minutes
- estimate how many seasons are needed from total duration
- iterate lessons in playlist order
- keep adding lessons until the current season is close to the target band
- start a new season when adding another lesson would make the current season materially over target
- never split a lesson between seasons

Why this approach:

- it preserves playlist order by default, which matches creator expectations
- it avoids a robotic lesson-count split
- it stays deterministic, which matters for editing and regeneration

The UI can later support explicit drag-and-drop redistribution, but the starting structure should already be balanced enough to look intentional.

## Chunk Generation Algorithm

Every lesson becomes a chunked structure immediately.

Target:

- approximately 4 to 6 minutes per chunk

Approach:

- derive a chunk count from lesson duration
- bias toward 5 minute segments
- add a small deterministic variance so every lesson does not look machine-cut
- normalize chunk durations so the total matches the lesson duration
- name chunks `Part 1`, `Part 2`, etc. for now

Why:

- Prompt 4 can later replace the titles with AI-assisted chunk labels
- the editor needs a complete chunk hierarchy now, even if chunk intelligence is basic

## Editing Architecture

Editing will remain local to `WizardProvider`.

State owned there:

- generated curriculum
- selected season
- selected lesson
- collapsed state
- drag state
- warnings

Actions exposed by the provider:

- rename curriculum
- rename season
- rename lesson
- edit descriptions and thumbnails
- create, delete, duplicate, merge, and split seasons
- duplicate and delete lessons
- move lessons between seasons
- auto balance seasons
- regenerate seasons
- regenerate chunks
- restore playlist order

Why provider-owned:

- it keeps the wizard cohesive
- it avoids prop drilling
- it lets the editor remain a pure rendering layer

## Drag and Drop Architecture

Drag and drop will be implemented with lightweight native browser drag/drop behavior.

Scope now:

- reorder seasons
- reorder lessons
- move lessons between seasons

Future scope:

- chunk dragging

Why this choice:

- the repo does not currently carry a DnD library
- native DnD is enough for the current interaction set
- the state model will already support chunk-level drag expansion later

The drag state will live in the provider so components only render drag affordances and dispatch actions.

## UI Layout

The Curriculum step will be composed of:

- `CurriculumToolbar`
- `CurriculumStats`
- `CurriculumWarnings`
- `CurriculumBoard`
- `CurriculumInspector`

Board hierarchy:

`Curriculum` -> `Season` -> `Lesson` -> `Chunk`

This mirrors the conceptual structure the creator is editing and keeps each component focused.

## Validation and Warnings

Warnings will be non-blocking and visible in the editor.

Examples:

- empty seasons
- lessons without thumbnails
- very short seasons
- very long seasons
- duplicate lesson names
- zero duration lessons

Why warnings instead of blocking validation:

- creators need to keep editing even when the generated structure is imperfect
- the curriculum should feel editable, not brittle

## Future AI Extensibility

The generator must remain replaceable.

That means:

- the UI consumes `GeneratedCurriculum`, not raw API response shapes
- the server route owns the generation contract
- shared pure transformation helpers isolate the heuristic logic
- AI-assisted chunking or season naming can replace the internals without changing the editor model

Future prompts can plug in:

- better lesson summarization
- AI season naming
- AI chunk titles
- metadata enrichment
- publishing

without changing the dashboard editor architecture.

## YouTube API Key

`YOUTUBE_API_KEY` stays in `.env.local`.

Example:

```bash
YOUTUBE_API_KEY=YOUR_KEY_HERE
```

The key is only for the import pipeline from Prompt 2. The curriculum generator does not read it directly.

## Implementation Order

1. Create shared curriculum models and generator helpers.
2. Add the curriculum generation API route.
3. Add the client curriculum service.
4. Extend `WizardProvider` to store generated curriculum and editor state.
5. Replace the temporary curriculum summary with the editor surface.
6. Add stats, warnings, toolbar actions, inspector, and drag/drop.

The order matters because the UI should be built against stable presentation models, not assembled first and corrected later.
