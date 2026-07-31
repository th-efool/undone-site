# Create Cohort Plan

## Goal

Implement the new `/create-cohort` dashboard route as a premium multi-step wizard that fits the existing SideQuestHQ dashboard architecture. The first delivery must cover `Details` and `Sources`, preserve draft state while moving between steps, and be structured so later steps and future import/publish flows can be added without reworking the foundation.

## Architectural Principles

This flow should follow the same philosophy used across the dashboard screens:

- Screen-first organization: the route renders a single screen entry point, and the screen composes smaller view pieces.
- Presentation-model architecture: components render UI models, not backend-shaped data or raw storage records.
- Hooks orchestrate: hooks own state transitions, derivations, and actions; components stay mostly presentational.
- Mock data first: the page ships with realistic seeded draft data so the screen never feels empty.
- UI models over DTOs: contracts should describe what the UI needs to render, not what an API might eventually return.
- Modular components: keep sections focused and small.
- CSS modules beside components: each component owns its styling locally.
- No backend assumptions: no server actions, no persistence, no fetching, no import pipeline.
- Adapters later: if a future API shape differs, map it in a future adapter layer rather than rewriting the wizard UI.
- Reusable primitives where the dashboard already has them: `Button`, `Badge`, `Heading`, `Text`, layout primitives, and the dashboard shell.

The reason for keeping this structure is simple: the dashboard already uses a screen-root pattern with mock-driven hooks and local component boundaries, and this flow will likely need a backend import pipeline later. A presentation-model boundary now keeps that future change isolated.

## Route Architecture

Create a dedicated dashboard route at:

`src/app/(dashboard)/create-cohort/page.tsx`

That page should only import and render the new screen root. It should not duplicate dashboard chrome, navigation, or layout logic because the dashboard shell already comes from the `(dashboard)` layout.

The route group should remain part of the existing dashboard shell, so navigation continues to feel native and no second layout system is introduced.

## Folder Structure

Create the screen under the same screen family as the existing dashboard modules:

```txt
src/client/components/screens/dashboard/createCohort/
  CreateCohort.tsx
  CreateCohort.module.css
  index.ts
  components/
  hooks/
  models/
  mock/
  providers/
  types/
```

Only create folders that are needed today.

Planned use:

- `CreateCohort.tsx`: screen root that composes the wizard.
- `CreateCohort.module.css`: screen-level layout and page framing.
- `index.ts`: public screen export.
- `providers/`: `WizardProvider` and `useWizard` context.
- `models/`: presentation models and wizard contract types.
- `mock/`: realistic seeded draft data and option catalogs.
- `hooks/`: state orchestration and model derivation.
- `components/`: page sections, wizard navigation, step content, source cards, chips, and shared field controls if they are specific to this screen.
- `types/`: only if the model layer needs a narrow type split; otherwise keep types in `models/`.

This mirrors the existing dashboard pattern without copying folders that do not have a purpose yet.

## Component Hierarchy

The screen should be composed from the top down:

1. `page.tsx`
2. `CreateCohort`
3. `WizardProvider`
4. `CreateCohortView`
5. Step containers
6. Focused field and card components

Recommended structure:

- `CreateCohort` owns the screen shell for this route and pulls the top-level model from the wizard hook/provider.
- `WizardProvider` owns wizard state and actions.
- `CreateCohortView` renders the title block, stepper, current step body, and sticky footer.
- `DetailsStep` renders the creator metadata form.
- `SourcesStep` renders source cards and source actions.
- `WizardStepper` renders the four-step progress indicator.
- `WizardFooter` renders `Previous` and `Continue`, plus current step status.
- `CoverImageField`, `TextField`, `SelectField`, `ChipGroup`, `TagComposer`, `ListComposer`, `SourceCard`, and `SourceCardList` handle specific UI responsibilities.

Why this shape:

- The root screen stays easy to scan.
- The provider is the only state authority.
- Step content can grow independently.
- The footer and stepper remain consistent when later steps are added.

## State Ownership

`WizardProvider` should own all wizard state:

- `currentStep`
- `draft`
- `validation`
- `navigation`

This is the right boundary because the flow needs state to persist as the user moves between steps, and future steps will need the same draft object. Holding the wizard state in one provider keeps the steps synchronized without prop drilling or duplicated local state.

The provider should expose:

- the current step metadata
- the current draft
- validation status for the active step
- field update actions
- step navigation actions
- source item actions
- derived readiness flags for the footer

The provider should not know about backend payloads. It should manage a UI-first draft model.

## Wizard State Model

Use a local wizard state shape that reflects the screen, not an API:

- `details`: title, subtitle, description, difficulty, categories, visibility, completion time, language, primary topic, tags, requirements, learning outcomes, cover image placeholder
- `sources`: ordered collection of source cards
- `meta`: active step and UI validation state

Why this model:

- It matches what the wizard renders.
- It supports autosave by simply writing directly into state.
- It avoids backend naming that would later leak into the UI.
- It leaves room for a future adapter that can translate to an import or publish payload.

Validation should remain local and minimal:

- `Details` requires the minimum fields to continue.
- `Sources` requires at least one source with a supported type and a URL.
- `Curriculum` and `Publish` remain disabled placeholders for now.

## UI Models

Components should receive renderable UI models rather than primitive prop bags or backend-like records.

Examples:

- Stepper receives `StepIndicatorModel[]`.
- Details form receives a `CreateCohortDetailsViewModel`.
- Sources list receives `SourceCardViewModel[]`.
- Footer receives a `WizardNavigationViewModel`.

Why:

- This keeps components dumb and stable.
- It makes the UI easier to refactor when backend integration eventually appears.
- It keeps formatting, labels, and display-only state in one place.

Avoid passing raw draft state directly to many components. The hook should derive the render model and keep the components focused on rendering and local interaction only.

## Hooks

Use hooks to orchestrate state and compute UI models.

Proposed responsibilities:

- `useCreateCohortWizard` or `useWizardState`: create and expose the provider state/actions.
- `useWizardModel`: derive stepper state, footer state, and step-specific render models.
- `useDetailsModel`: normalize categories, chips, learning outcomes, and requirements for the details form.
- `useSourcesModel`: normalize source cards, drag order metadata, collapse state, and empty-state copy.

Why use hooks this way:

- They keep rendering components free of business logic.
- They centralize validation and step transitions.
- They make it easy to plug in a future import pipeline without changing the view tree.

## Mock Data

Seed the wizard with a realistic draft so the screen never opens blank.

The mock should include:

- a cover image placeholder URL or asset reference
- a cohort title and subtitle
- a substantive description
- a chosen difficulty
- multiple categories
- visibility state
- completion estimate
- language
- primary topic
- multiple tags
- multiple requirements
- multiple learning outcomes
- at least three sources of mixed types

Why:

- The page should feel like a real creator workspace from the first render.
- A populated draft makes the premium interactions easy to understand.
- It prevents the wizard from looking like an unfinished form shell.

Keep the mock in a dedicated file so future prompts can replace it or swap in data from a repository without touching components.

## Details Step

The `Details` step should be the richest part of the first release.

Fields to support:

- Cover Image placeholder
- Cohort Title
- Subtitle
- Description
- Difficulty
- Categories
- Visibility
- Estimated Completion Time
- Language
- Primary Topic
- Tags
- Requirements
- Learning Outcomes

Interaction requirements:

- cover image uses a mock upload placeholder only
- categories render as chips
- tags support add/remove
- requirements support multiple entries
- learning outcomes support multiple entries
- autosave updates draft state immediately

Why:

- This is the metadata foundation for the cohort.
- Categories and tags are better represented as interactive chips than as flat text inputs.
- Multiple list fields should be explicit list composers rather than overloaded textareas, because they need structured editing later.

## Sources Step

The `Sources` step should manage source cards only. It should not fetch, parse, or import anything.

Supported source types:

- YouTube Playlist
- YouTube Video
- Website
- PDF
- Markdown
- GitHub Repository
- Custom Link

Source card actions:

- add source
- delete source
- drag reorder
- duplicate source
- collapse source

Why:

- This gives the wizard the shape of a real source management tool without mixing in import logic yet.
- Drag ordering must live in local state now so the later import pipeline can reuse the ordering semantics.
- Collapse/duplicate support makes the step feel like a production authoring surface instead of a list editor.

Each source card should be a compact, self-contained component with its own summary and editable fields.

## Navigation Flow

The flow is:

`Details` -> `Sources`

Only the first two steps are implemented now, while `Curriculum` and `Publish` appear disabled in the stepper.

Navigation rules:

- `Previous` is hidden on the first step.
- `Continue` advances to the next step only when the minimum validation passes.
- state persists when navigating between steps
- step 3 and 4 remain visible but disabled

Why:

- The stepper sets the expectation that the wizard is incomplete but intentionally staged.
- Keeping later steps visible reduces future layout churn and clarifies the roadmap.

## Reusable Components

Prefer reusable components only where they reduce real duplication in this flow.

Likely useful local components:

- `WizardStepper`
- `WizardFooter`
- `StepBadge` or `StepStatus`
- `CategoryChip`
- `TagPillInput`
- `ListComposer`
- `SourceCard`
- `SourceCardHeader`
- `SourceTypeSelect`

Prefer existing dashboard primitives for generic controls rather than creating new ones:

- `Button`
- `Badge`
- `Heading`
- `Text`
- layout primitives like `Section`, `Surface`, `Container`, `Stack`, `Cluster`

Why:

- The dashboard already has a shared UI layer, so the cohort flow should compose it instead of duplicating it.
- Local components stay specific to the wizard and do not become accidental global primitives.

## Styling Approach

Use CSS modules beside each component.

Why:

- That matches the existing screen modules.
- It keeps layout and interaction styling close to the component that owns it.
- It avoids introducing a second styling system.

Use only the project’s semantic tokens, typography tokens, spacing tokens, shadows, and existing layout primitives.

Do not hardcode colors where semantic tokens already exist.

The intended visual language is premium and craft-oriented: restrained, dense, and polished, with strong hierarchy and clear affordances. It should feel native to SideQuestHQ, not like a generic form builder.

## Accessibility

All interactive elements must be keyboard accessible and labeled.

Requirements:

- semantic headings for the page and step sections
- proper `label`/`input` relationships
- ARIA for drag handles, collapsible source cards, and disabled step states
- visible focus states using existing tokenized styles
- buttons should expose clear action names

Why:

- The flow is a high-interaction authoring surface.
- Accessible structure also makes the screen easier to maintain and test.

## Future Extensibility

The architecture should leave room for later prompts to add:

- curriculum generation
- import pipeline
- publish flow
- API integration
- server persistence
- adapter translation to backend payloads

To preserve that flexibility:

- keep the provider as the wizard source of truth
- keep step components presentation-driven
- keep mock data separate from the model layer
- avoid leaking backend terms into component or prop names
- keep source ordering, validation, and field composition in hooks/models rather than in JSX

When an API arrives, the likely insertion point is an adapter layer between the future data source and the existing UI model, not the screen components themselves.

## Implementation Order

1. Add the plan file.
2. Create the screen folder structure.
3. Define the wizard models and mock data.
4. Build the provider and hooks.
5. Add the route page and screen root.
6. Implement `Details`.
7. Implement `Sources`.
8. Add the disabled `Curriculum` and `Publish` states.
9. Verify keyboard and layout behavior.

## Explicit Non-Goals

Do not add:

- YouTube API integration
- parsing
- curriculum generation
- lesson generation
- chunking
- publish mutation logic
- server actions
- persistence
- AI calls
- backend DTOs

The first release is a polished local wizard only.
