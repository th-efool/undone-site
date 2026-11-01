# Cohort Creation State-Machine Refactor Proposal

**Baseline analyzed:** `13944cdf` (`master`) — updated from initial `eeb7077a` analysis after Guide G3 (`8ab41a00..0603c64f`) and G3-QA Remediation (`d2afeb11..13944cdf`)
**Scope:** Cohort Creation Journey, Material Intake, Processing Pipeline, Readiness/Review, Release Activation, and AI Tool/State Coupling
**Companion Execution Guide:** `IdiotHandOffGuide.md`

---

## 0. Delta Since `eeb7077a` (What Changed in `8ab41a00..13944cdf`)

Between `eeb7077a` and `13944cdf`, Guide G3 (`IdiotHandOffGuide-cohort-material-intake.md`) and its QA remediation wave landed several UI and local handler repairs that were originally listed under Section 2.C and Phase 5:

1. **2-Option Entry & Merged Goal Discovery (Formerly Phase 5 — Completed)**:
   - `src/client/screens/cohortCreation/components/StartingPoint.tsx` now presents the 2-option entry (`have_material`, `find_material`), and `src/shared/cohort-builder/contracts.ts` normalizes legacy `have_goal` to `find_material` / `discovery`.
   - `src/client/screens/cohortBuilder/stages/MaterialStageView.tsx` now implements URL-first material entry, compact source previews above the form, disabled file/text pills (`Unavailable in this flow`), and a sticky `Continue to curriculum →` bar.
   - `src/client/screens/cohortBuilder/stages/DiscoveryStageView.tsx` now implements goal input + explicit candidate selection checkboxes (`select_discovery_resources`).
   - `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx` routes legacy `goal_setup` to `DiscoveryStageView` and computes `effectiveInspectedStage` purely during render without a conditional `useEffect` hook (`d2afeb11`).
2. **Local `ReadyStageView` Handler Repairs (Formerly Section 2.C — Partially Completed)**:
   - `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx` now passes `requiresReady = false` to `act(handleBack, false)` so `Back to material` is not blocked when `!ready`.
   - `ReadyStageView.tsx#handleActivate` now checks `const prepared = await dispatchAction({ type: 'prepare_release', mode: 'private_activation' }); if (!prepared) return;` before dispatching `open_review` (`4d2a602f`).
   - `ReadyStageView.tsx` now conditionally renders `'All set.'` vs `'In progress.'` based on local `ready` (`4d2a602f`).
3. **AI Tool Availability Boundary Verification (Section 2.D Refinement)**:
   - `src/server/domain/cohort-builder/__tests__/external-tools.test.ts` enforces a security/product invariant that `chat` (Plan mode) bounds AI tools to conversational planning and excludes lifecycle triggers (`start_discovery`, `begin_material_processing`). Therefore, capability guards must preserve the Plan-mode boundary while unifying domain transition guards across `contracts.ts` and `creation-machine.ts`.

### What Remains Unresolved at `13944cdf` (Target of `IdiotHandOffGuide.md`)

1. **Five Competing Readiness & Progress Authorities**:
   - `stage-selectors.ts#computeActiveStage` still blindly returns `'ready'` whenever `workspace.journey.step === 'ready'`, even if `processing.status` is `'queued' | 'processing' | 'failed'`, `sourceFingerprint` is `null`, or `lessons.length === 0`.
   - `ReadyStageView.tsx` still defines its own local `const ready = workspace.processing.status === 'ready' && workspace.lessons.length > 0` without checking `sourceFingerprint`, source states, job completion, or `validateCohortReadiness`.
   - `CohortWorkspacePane.tsx#getProcessingProgress` (~198 lines) still duplicates stage/job/source progress interpretation separately from `stage-selectors.ts`.
2. **Post-Build Mutation Stranding (`journey.step === 'ready'` with `processing.status === 'queued'`)**:
   - When `add_*_source`, `edit_text_source`, `remove_source`, `set_intent`, `set_audience`, or `set_daily_minutes` runs after a build has reached `journey.step === 'ready'`, `contracts.ts` sets `processing.status = 'queued'` (or `'idle'` if all sources are removed) while leaving `journey.step = 'ready'`.
3. **Dual Completion Writers (`client-pipeline.ts` vs `text-assembly-acceptance.ts`)**:
   - Fast synchronous completion (`runDeterministicPipeline`) and durable worker acceptance (`acceptAssemblyProjection`) still construct completed workspace state independently rather than sharing one validated completion projection helper (`projectAcceptedBuildCompletion`).
4. **Missing Shared State-Machine & View-Model Layer**:
   - `src/shared/cohort-builder/creation-state.ts`, `src/shared/cohort-builder/creation-machine.ts`, and `src/shared/cohort-builder/creation-view.ts` do not exist yet.

---

## 1. Executive Summary

 Cohort Creation currently spreads lifecycle state across **four overlapping structures** in `CohortWorkspace` and **five separate readiness/stage evaluators** across client and server files:

1. **`workspace.journey`** (`step`, `branch`, `processingStarted`, `intentVersion`)
2. **`workspace.processing`** (`status`, `stage`, `generation`, `sourceFingerprint`, `error`, `jobs[]`)
3. **`workspace.discovery` / `workspace.recommendations`** (`status`, `requestId`, `fingerprint`, `resultId`, `generation`, `items[]`)
4. **`workspace.release`** (`status`, `mode`, `candidateHash`, `cohortId`, `receipt`)

Because these four sub-states are mutated independently by `planCohortAction`, `runDeterministicPipeline`, `planTextStage`, `acceptAssemblyProjection`, and durable background workers—without a single state-machine authority enforcing cross-field invariants—the application can enter **contradictory states** (for example: `journey.step === 'ready'` while `processing.status === 'queued'` or `lessons.length === 0`, or `processing.status === 'ready'` while `sources` have been edited or `intent`/`audience`/`dailyMinutes` changed).

This proposal replaces the implicit, scattered transition rules with an **explicit, hierarchical, invariant-checked Cohort Creation State Machine** shared between server and client.

---

## 2. Root-Cause Diagnosis of Current Architecture

### A. Five Competing Authorities for "What Stage Is Active / Is the Build Ready?"

| Authority | File & Function | What It Checks | Where It Diverges |
| :--- | :--- | :--- | :--- |
| **1. UI Active Stage** | `src/client/screens/cohortBuilder/stage-selectors.ts` (`computeActiveStage`) | Returns `workspace.journey.step` directly if set (`'ready'`, `'review'`, `'material_input'`, etc.); only inspects `processing.jobs` when `journey.step === 'processing'` or `journey` is undefined. | If `journey.step === 'ready'` but a source/intent edit sets `processing.status = 'queued'`, `computeActiveStage` **still returns `'ready'`**, trapping the user on `ReadyStageView` with `"Build not complete"`. |
| **2. Stepper Progress** | `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx` (`getProcessingProgress`) | Independently inspects `sources`, `processing.status`, `processing.stage`, and `processing.jobs` (lines 55–252) to compute `steps[]` and `needsRebuild`. | Completely separate implementation from `stage-selectors.ts` (`getStageProgressDetails` / `isStageComplete`). Can report `needsRebuild: true` while `ReadyStageView` or `CurriculumStageView` is mounted. |
| **3. Ready Screen Gate** | `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx` | `const ready = workspace.processing.status === 'ready' && workspace.lessons.length > 0;` | Ignores `processing.sourceFingerprint`, ignores whether sources are `'pending'`/`'stale'`, and ignores `validateCohortReadiness`. |
| **4. Action Guard (`open_review`)** | `src/shared/cohort-builder/contracts.ts` | Checks `current.step === 'ready'` AND `processing.status === 'ready' && processing.sourceFingerprint && lessons.length > 0`. | Checks `Boolean(sourceFingerprint)` where `ReadyStageView` did not. |
| **5. Release Gate (`prepare_release`)** | `src/shared/cohort-builder/readiness.ts` (`validateCohortReadiness`) | Checks `intent`, `title`, `dailyMinutes`, `lessons`, `chunks`, `orphaned` evidence, `processing.status`, `sources.every(s => s.state === 'ready')`, and restricted source rights. | Can reject `prepare_release` even when `ReadyStageView` and `open_review` both claim the cohort is `"Ready"`. |

### B. Dual Completion Paths (`runDeterministicPipeline` vs Durable Workers)

In `contracts.ts` (`begin_material_processing`), there are two completely different execution paths:
1. **Synchronous Fast Path (`canRunDeterministicPipeline`)**: Runs `runDeterministicPipeline(next)` inside `planCohortAction`, synthesizing accepted `jobs`, setting `processing.status = 'ready'`, `processing.stage = 'done'`, and `journey.step = 'ready'` in a single action revision.
2. **Asynchronous Durable Worker Path**: Sets `journey.step = 'processing'` and `processing.status = 'queued'`. Background workers (`text-source-processor`, `text-assembly-processor`, `text-assembly-acceptance.ts`) advance jobs across multiple DB transactions and only set `journey.step = 'ready'` when `acceptAssemblyProjection` commits.

**Why this causes bugs:**
- If a user is on `journey.step === 'ready'` (or `'review'`) and mutates a source or changes `intent`, `audience`, or `dailyMinutes`, `contracts.ts` sets `processing.status = 'queued'`, **but leaves `journey.step = 'ready'`**!
- As a result, `journey.step` says `'ready'`, `processing.status` says `'queued'`, and `CohortWorkspacePane` renders `ReadyStageView` in a broken half-state (`"Build not complete"`).

---

## 3. Target Architecture: Orthogonal Regions + Derived View State

### Core Design Principle
**Never store a derived UI screen name (`'ready'`, `'processing'`) that can contradict the underlying data.**
Instead, model the workspace lifecycle as **three explicit, orthogonal state regions** plus **one pure selector (`deriveCreationViewModel`)** that computes the active screen, stepper state, and allowed user capabilities from a single source of truth.

```
+-----------------------------------------------------------------------+
|                    CohortCreationMachine (Pure Core)                  |
|                                                                       |
|  Region 1: Intent & Intake Mode                                       |
|    mode: 'chat' | 'recommendations' | 'starting_point'                |
|          | 'discovery' | 'material_input' | 'workspace'               |
|    branch: 'have_material' | 'find_material' | null                   |
|                                                                       |
|  Region 2: Build Artifact Lifecycle (Deterministic Evidence State)    |
|    state: 'not_started'                                               |
|         | 'queued'      (generation, stage, targetInputHash)          |
|         | 'running'     (generation, stage, jobs[])                   |
|         | 'ready'       (generation, acceptedInputHash, lessons > 0)  |
|         | 'stale'       (priorAcceptedHash != currentInputHash)       |
|         | 'failed'      (generation, stage, error, retryable)         |
|         | 'canceled'    (generation, stage)                           |
|                                                                       |
|  Region 3: Release Lifecycle                                          |
|    state: 'draft'                                                     |
|         | 'prepared'    (mode, candidateHash)                         |
|         | 'released'    (mode, cohortId, receipt)                     |
+-----------------------------------------------------------------------+
                                   |
                                   v
         deriveCreationViewModel(workspace, inspectedStage, drafts)
                                   |
                                   v
  { activeStage, effectiveStage, readyStageViewModel,
    capabilities, progress, invariants }
```

---

## 4. Formal State & Transition Specification

### 4.1 Canonical Build Input Fingerprint (`computeBuildInputFingerprint`)
Alongside `computeSourceEvidenceFingerprint(workspace)` (which hashes `[source.id, source.version, source.text]` for stage-level text pipeline verification), `creation-state.ts` defines `computeBuildInputFingerprint(workspace)` over **all inputs that affect the generated curriculum**:
- Sorted `sources`: `[source.id, source.version, source.input ?? source.text]`
- `intent` (trimmed)
- `audience` (trimmed)
- `dailyMinutes`
- Pinned/manual lesson overrides (`[lesson.id, lesson.version, lesson.title, lesson.objective, lesson.pinned, lesson.sourceChunkIds]`)

### 4.2 Authoritative Transition Table

| Current State | Event / Action | Guard | Next State |
| :--- | :--- | :--- | :--- |
| Any `step !== 'published'` | `back_to_recommendations` | `release.status !== 'released'` | `step = 'recommendations'` (preserves `sources`, `lessons`, `processing`) |
| Any `step !== 'published'` | `back_to_starting_point` | `release.status !== 'released'` | `step = 'starting_point'` (preserves `sources`, `lessons`, `processing`) |
| `recommendations \| starting_point \| material_input \| discovery \| goal_setup \| ready \| review` | `choose_starting_point(choice)` | `release.status !== 'released'` | If `choice === 'have_material'`: `step = 'material_input', branch = 'have_material'`. If `'find_material' \| 'have_goal'`: `step = 'discovery', branch = 'find_material'`. |
| `discovery \| goal_setup` | `start_discovery` | `intent.trim().length > 0` | `step = 'discovery'`, `branch = 'find_material'`, `discovery.status = 'queued'` |
| `discovery` | `select_discovery_resources` | Valid `discoveryResult` proof & candidate IDs | Attaches selected sources; `step = 'material_input'`; if `processingStarted`, queues build |
| `material_input \| discovery \| goal_setup` | `begin_material_processing` | `sources.length > 0` | `processingStarted = true`; if `canRunDeterministicPipeline(ws)` -> `projectAcceptedBuildCompletion` (`step = 'ready'`, `processing.status = 'ready'`); else `step = 'processing'`, `processing.status = 'queued'` |
| `processing` | `projectAcceptedBuildCompletion` | All sources `'ready'`, valid chunks/analyses/lessons | `processing.status = 'ready'`, `processing.stage = 'done'`, `step = 'ready'` |
| `ready` | Source / Pedagogical Mutation (`add_*_source`, `edit_text_source`, `remove_source`, `set_intent`, `set_audience`, `set_daily_minutes`) | `processingStarted === true` | `normalizePostMutationLifecycle`: if `sources.length === 0`, `step = 'material_input'`, `processingStarted = false`, `processing.status = 'idle'`; else if `processing.status === 'queued'`, `step = 'processing'` |
| `ready` | `open_review` | `isBuildComplete(ws)` | `step = 'review'` |
| `ready \| review` | `prepare_release(mode)` | `validateCohortReadiness(ws, mode).ready` | `release = { status: 'prepared', mode, candidateHash }` |
| `ready \| review` | `commit_release(mode, hash, receipt)` | `release.status === 'prepared'` & matching `candidateHash` | `release = { status: 'released', ... }`, `step = 'published'` |

---

## 5. Module Layout & Migration Plan

### 5.1 New Shared Modules (`src/shared/cohort-builder/`)
1. **`src/shared/cohort-builder/creation-state.ts`**:
   - Defines `CreationStep`, `CreationBranch`, `DiscoveryRegionState`, `BuildRegionState`, `ReleaseRegionState`, `CreationMachineState`, and `WorkspaceInvariantReport`.
   - Implements `computeSourceEvidenceFingerprint`, `computeBuildInputFingerprint`, `isBuildComplete`, `isBuildStale`, `validateWorkspaceInvariants`, and `deriveCreationMachineState`.
2. **`src/shared/cohort-builder/creation-machine.ts`**:
   - Defines `CreationCapabilities` and `AcceptedBuildArtifacts`.
   - Implements `getCreationCapabilities(workspace)`, `canChooseStartingPointFromStep(step)`, `projectAcceptedBuildCompletion(state, artifacts)`, and `normalizePostMutationLifecycle(state)`.
3. **`src/shared/cohort-builder/creation-view.ts`**:
   - Defines `BuilderStage`, `ProcessingStep`, `ProcessingProgress`, `ReadyStageViewModel`, `CreationViewModel`, and `STEP_TO_STAGE_MAP`.
   - Implements `deriveProcessingProgress(workspace)`, `deriveActiveStage(workspace)`, `deriveEffectiveStage(workspace, inspectedStage, drafts)`, `deriveReadyStageViewModel(workspace)`, and `deriveCreationViewModel(workspace, inspectedStage, drafts)`.

### 5.2 Refactored Existing Modules
1. **`src/shared/cohort-builder/client-pipeline.ts`**:
   - Delegates `sourceFingerprint` to `computeSourceEvidenceFingerprint` and delegates the final assembly projection in `runDeterministicPipeline` to `projectAcceptedBuildCompletion`.
2. **`src/server/domain/cohort-builder/text-assembly-acceptance.ts`**:
   - Delegates workspace completion projection in `acceptAssemblyProjection` to `projectAcceptedBuildCompletion` so fast and durable builds share one completion writer.
3. **`src/shared/cohort-builder/contracts.ts`**:
   - Uses `canChooseStartingPointFromStep` to allow direct branch switching from `'ready'` and `'review'` as well as intake steps.
   - Uses `isBuildComplete(next)` for the `open_review` readiness guard.
   - Calls `normalizePostMutationLifecycle(next)` after source and pedagogical mutations so post-build edits never strand the workspace on `journey.step === 'ready'` while `processing.status === 'queued'`.
4. **`src/client/screens/cohortBuilder/stage-selectors.ts`**:
   - Delegates `computeActiveStage` and `computeEffectiveStage` to `deriveActiveStage` and `deriveEffectiveStage` from `@/src/shared/cohort-builder/creation-view`, eliminating contradictory `'ready'` stage routing when a build is incomplete or actively rebuilding.
5. **`src/client/screens/cohortBuilder/CohortWorkspacePane.tsx`**:
   - Replaces its duplicate 198-line `getProcessingProgress` implementation with a re-export of `deriveProcessingProgress` from `@/src/shared/cohort-builder/creation-view` and consumes `deriveCreationViewModel`.
   - Guards compact starting-point tab switching with `const backed = await dispatchAction({ type: 'back_to_starting_point' }); if (!backed) return;`.
6. **`src/client/screens/cohortBuilder/stages/ReadyStageView.tsx`**:
   - Replaces ad-hoc `const ready = ...` and inline header/badge ternary logic with `deriveReadyStageViewModel(workspace)` from `@/src/shared/cohort-builder/creation-view`.
