# IdiotHandOffGuide — Cohort Creation State-Machine Refactor

## A. Execution Contract

- **Target Outcome**: Replace the fragmented, competing Cohort Creation lifecycle and readiness evaluators across `contracts.ts`, `client-pipeline.ts`, `text-assembly-acceptance.ts`, `stage-selectors.ts`, `CohortWorkspacePane.tsx`, and `ReadyStageView.tsx` with a unified, invariant-checked Cohort Creation State Machine in `src/shared/cohort-builder/` (`creation-state.ts`, `creation-machine.ts`, `creation-view.ts`).
- **Root Directory**: `D:/ThisPC/Documents/SideQuestHQ/undone-site`
- **Operating System / Shell**: `windows` / `powershell`
- **Baseline Commit**: `13944cdf` (`master`)
- **Guide Status**: `READY`

### Operational Sequence
1. Verify git working tree state and baseline file SHA-256 digests (`Pre-Flight Check` below).
2. Apply implementation steps `S1` through `S10` in strict sequential order.
3. Run verification steps `V1` through `V6` in strict sequential order.
4. If any file anchor, checksum, typecheck, lint rule, unit test, or Vercel build check fails, **stop immediately**, do not improvise unverified workarounds, and report the exact failing step ID and command output.
5. Produce the final completion report matching **Section F**.

### Pre-Flight Baseline Check Command
Run this command from `D:/ThisPC/Documents/SideQuestHQ/undone-site` before applying any step:

```powershell
node -e "const fs = require('fs'); const crypto = require('crypto'); const expected = { 'src/shared/cohort-builder/contracts.ts': 'c7f6d9a3f8ec81031993f62f72910400a50b7d22041952bcafe757e35c232ba0', 'src/shared/cohort-builder/client-pipeline.ts': '039c5b55d28017cfcde736c4def19c7f73b6abffaf0ef50a38fa470b34f10cbc', 'src/server/domain/cohort-builder/text-assembly-acceptance.ts': 'e206bb55227aa9fc38aaf06d6a8ae9525e088e1e9ad1a6a300302b11864b9fd9', 'src/client/screens/cohortBuilder/stage-selectors.ts': '5855c73ab90f59fe5b589268d5884a89cb5bb4d6cb6f746b776a810bab0c59cf', 'src/client/screens/cohortBuilder/CohortWorkspacePane.tsx': 'eebde9f0716d5e42d1bf8122d33c7d79694a7e4cb1663b24124b1e86ed636c3b', 'src/client/screens/cohortBuilder/stages/ReadyStageView.tsx': 'a953281a155b7584ce1d8fafe1efd58085b80789398a08c758d7b22ff47ab102' }; for (const [file, exp] of Object.entries(expected)) { const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); if (actual !== exp) { console.error('MISMATCH:', file, 'expected', exp, 'got', actual); process.exit(1); } } console.log('ALL_BASELINE_HASHES_VERIFIED');"
```

Expected output: `ALL_BASELINE_HASHES_VERIFIED` with exit code `0`.

---

## B. Requirements and Acceptance Map

| Requirement ID | Observable Behavior | Implementing Step IDs | Verification IDs |
| :--- | :--- | :--- | :--- |
| `R1` | **Orthogonal State Regions & Invariant Validator (`creation-state.ts`)**: `deriveCreationMachineState`, `isBuildComplete`, `isBuildStale`, `computeSourceEvidenceFingerprint`, `computeBuildInputFingerprint`, and `validateWorkspaceInvariants` deterministically classify discovery, build, and release regions and flag contradictory snapshots (e.g., `journey.step === 'ready'` with incomplete/queued build or missing fingerprint). | `S1`, `S10` | `V1`, `V3`, `V4` |
| `R2` | **Unified Build Completion Projection (`creation-machine.ts`)**: Fast deterministic builds (`client-pipeline.ts#runDeterministicPipeline`) and durable worker assembly acceptance (`text-assembly-acceptance.ts#acceptAssemblyProjection`) share `projectAcceptedBuildCompletion`, guaranteeing identical lesson projection, metadata derivation, SEO generation, source readiness, and `sourceFingerprint` assignment. | `S2`, `S4`, `S5`, `S10` | `V1`, `V2`, `V3` |
| `R3` | **Post-Mutation Lifecycle Normalization (`creation-machine.ts` & `contracts.ts`)**: When source or pedagogical mutations (`add_*_source`, `edit_text_source`, `remove_source`, `set_intent`, `set_audience`, `set_daily_minutes`) queue a rebuild while `journey.step === 'ready'`, `normalizePostMutationLifecycle` transitions `journey.step` to `'processing'` (or `'material_input'` with `processingStarted = false` if all sources are removed), preventing stranded `'ready'` snapshots. | `S2`, `S6`, `S10` | `V1`, `V2`, `V3` |
| `R4` | **Direct Branch Switching & Canonical `open_review` Guard (`contracts.ts`)**: `choose_starting_point` allows switching directly to `'material_input'` or `'discovery'` from `'ready'` and `'review'` (while still rejecting `'processing'` and `'published'`), and `open_review` enforces `isBuildComplete(next)` when transitioning from `'ready'`. | `S2`, `S6`, `S10` | `V1`, `V2`, `V3` |
| `R5` | **Single Authoritative View Model & Stepper Progress (`creation-view.ts`, `stage-selectors.ts`, `CohortWorkspacePane.tsx`)**: `deriveCreationViewModel`, `deriveActiveStage`, `deriveEffectiveStage`, and `deriveProcessingProgress` in `creation-view.ts` replace duplicate stage/progress logic across `stage-selectors.ts` and `CohortWorkspacePane.tsx`. If `journey.step === 'ready'` but `processing.status` is `'queued' | 'processing' | 'failed'`, `getActiveStage` routes to the active/failed processing stage rather than `'ready'`. | `S3`, `S7`, `S8`, `S10` | `V1`, `V2`, `V3`, `V4` |
| `R6` | **Unified Ready Stage View Model (`ReadyStageView.tsx`)**: `ReadyStageView` consumes `deriveReadyStageViewModel(workspace)` from `creation-view.ts` for readiness gating (`isReady`, `canActivate`, `canReview`, `canReturnToMaterial`) and truthful copy (`eyebrow`, `heading`, `subtitle`, `badgeLabel`). | `S3`, `S9`, `S10` | `V1`, `V2`, `V3`, `V4` |
| `R7` | **Zero Regressions Across Full Test Suite & Vercel Build Parity**: All existing unit/integration tests and the 5-stage `npm run verify:vercel` deployment check pass with zero TypeScript, ESLint, or runtime errors. | `S1`–`S10` | `V1`–`V6` |

### Out of Scope
- Modifying database table DDL or Prisma migration files (`CohortWorkspace` JSON snapshot wire format remains 100% backward-compatible with `schemaVersion: 1`).
- Altering AI chat Plan-mode tool boundaries tested in `src/server/domain/cohort-builder/__tests__/external-tools.test.ts` (`start_discovery` and `begin_material_processing` remain excluded when `stage === 'chat'`).
- Visual CSS restyling of stage components (`CohortBuilder.module.css`, `ReadyStageView.module.css`).

---

## C. File-Change Manifest

| Step ID | Operation | File Path | Purpose | Baseline SHA-256 |
| :--- | :--- | :--- | :--- | :--- |
| `S1` | `CREATE` | `src/shared/cohort-builder/creation-state.ts` | Orthogonal state region types, deterministic build/source fingerprints, `isBuildComplete`, `isBuildStale`, `validateWorkspaceInvariants`, and `deriveCreationMachineState`. | *(new file)* |
| `S2` | `CREATE` | `src/shared/cohort-builder/creation-machine.ts` | Pure transition guards (`canSwitchStartingPointBranch`, `getCreationCapabilities`), shared `projectAcceptedBuildCompletion`, and `normalizePostMutationLifecycle`. | *(new file)* |
| `S3` | `CREATE` | `src/shared/cohort-builder/creation-view.ts` | Single authoritative UI view-model and progress derivation (`deriveProcessingProgress`, `deriveActiveStage`, `deriveEffectiveStage`, `deriveReadyStageViewModel`, `deriveCreationViewModel`). | *(new file)* |
| `S4` | `MODIFY` | `src/shared/cohort-builder/client-pipeline.ts` | Delegate `sourceFingerprint` to `computeSourceEvidenceFingerprint` and `runDeterministicPipeline` completion projection to `projectAcceptedBuildCompletion`. | `039c5b55d28017cfcde736c4def19c7f73b6abffaf0ef50a38fa470b34f10cbc` |
| `S5` | `MODIFY` | `src/server/domain/cohort-builder/text-assembly-acceptance.ts` | Delegate durable assembly acceptance completion projection to `projectAcceptedBuildCompletion`. | `e206bb55227aa9fc38aaf06d6a8ae9525e088e1e9ad1a6a300302b11864b9fd9` |
| `S6` | `MODIFY` | `src/shared/cohort-builder/contracts.ts` | Wire `canSwitchStartingPointBranch`, `isBuildComplete`, and `normalizePostMutationLifecycle` into `planCohortAction`. | `c7f6d9a3f8ec81031993f62f72910400a50b7d22041952bcafe757e35c232ba0` |
| `S7` | `MODIFY` | `src/client/screens/cohortBuilder/stage-selectors.ts` | Delegate `computeActiveStage` and `computeEffectiveStage` to `deriveActiveStage` and `deriveEffectiveStage` from `creation-view.ts`. | `5855c73ab90f59fe5b589268d5884a89cb5bb4d6cb6f746b776a810bab0c59cf` |
| `S8` | `MODIFY` | `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx` | Remove duplicate 198-line `getProcessingProgress`, re-export from `creation-view.ts`, consume `deriveCreationViewModel`, and guard compact tab switching. | `eebde9f0716d5e42d1bf8122d33c7d79694a7e4cb1663b24124b1e86ed636c3b` |
| `S9` | `MODIFY` | `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx` | Consume `deriveReadyStageViewModel(workspace)` for readiness gating and header/badge status copy. | `a953281a155b7584ce1d8fafe1efd58085b80789398a08c758d7b22ff47ab102` |
| `S10` | `CREATE` | `src/shared/cohort-builder/__tests__/creation-machine.test.ts` | Comprehensive state-machine test suite covering invariants, transition matrix, post-build mutation normalization, fast vs durable parity, and view-model consistency. | *(new file)* |

---

## D. Ordered Implementation Steps

### Step `S1` — Create `src/shared/cohort-builder/creation-state.ts`

- **Operation**: `CREATE`
- **File Path**: `src/shared/cohort-builder/creation-state.ts`
- **Action**: Create `src/shared/cohort-builder/creation-state.ts` with the following exact full file contents:

```ts
import { sha256 } from './hash';
import type {
  CohortWorkspace,
  CohortSource,
  CohortJourneyStep,
} from './contracts';

export type CreationStep = CohortJourneyStep;
export type CreationBranch = 'have_material' | 'find_material' | null;

export type DiscoveryRegionState =
  | { status: 'idle'; generation: number }
  | {
      status: 'queued' | 'running';
      requestId: string;
      fingerprint: string;
      generation: number;
    }
  | {
      status: 'ready';
      requestId: string;
      fingerprint: string;
      resultId: string;
      generation: number;
      candidateCount: number;
    }
  | {
      status: 'failed' | 'canceled';
      requestId: string;
      fingerprint: string;
      generation: number;
      error: string | null;
    };

export type BuildRegionStatus =
  | 'not_started'
  | 'queued'
  | 'running'
  | 'ready'
  | 'stale'
  | 'failed'
  | 'canceled';

export interface BuildRegionState {
  status: BuildRegionStatus;
  activeStage: CohortWorkspace['processing']['stage'];
  generation: number;
  acceptedSourceFingerprint: string | null;
  currentSourceFingerprint: string;
  currentBuildInputFingerprint: string;
  isBuildComplete: boolean;
  isBuildStale: boolean;
  error: string | null;
}

export interface ReleaseRegionState {
  status: 'draft' | 'prepared' | 'released';
  mode: 'private_activation' | 'public_publish' | null;
  candidateHash: string | null;
  cohortId: string | null;
}

export interface WorkspaceInvariantReport {
  valid: boolean;
  violations: string[];
}

export interface CreationMachineState {
  step: CreationStep | null;
  branch: CreationBranch;
  processingStarted: boolean;
  intentVersion: number;
  discovery: DiscoveryRegionState;
  build: BuildRegionState;
  release: ReleaseRegionState;
  invariants: WorkspaceInvariantReport;
}

type JobItem = NonNullable<CohortWorkspace['processing']['jobs']>[number];

function jobMatchesSourceVersion(job: JobItem, source: CohortSource): boolean {
  if (job.sourceId !== source.id) return false;
  const jobSourceVersion = (job as { sourceVersion?: number }).sourceVersion;
  return jobSourceVersion === undefined || jobSourceVersion === source.version;
}

function areAllJobsAcceptedForSources(
  sources: CohortSource[],
  jobs: JobItem[]
): boolean {
  for (const source of sources) {
    const ownJobs = jobs.filter(j => jobMatchesSourceVersion(j, source));
    const uJobs = ownJobs.filter(j =>
      ['acquisition', 'extraction', 'understanding'].includes(j.stage)
    );
    if (
      uJobs.length === 0 ||
      uJobs.some(j => j.status !== 'accepted')
    ) {
      return false;
    }
    const cJobs = ownJobs.filter(j => j.stage === 'chunking');
    if (
      cJobs.length === 0 ||
      cJobs.some(j => j.status !== 'accepted')
    ) {
      return false;
    }
    const aJobs = ownJobs.filter(j => j.stage === 'analysis');
    if (
      aJobs.length === 0 ||
      aJobs.some(j => j.status !== 'accepted')
    ) {
      return false;
    }
  }
  const assemblyJobs = jobs.filter(
    j => j.stage === 'assembly' || j.sourceId === null
  );
  if (
    assemblyJobs.length === 0 ||
    assemblyJobs.some(j => j.status !== 'accepted')
  ) {
    return false;
  }
  return true;
}

/**
 * Canonical source-evidence fingerprint used across deterministic and durable text stages.
 */
export function computeSourceEvidenceFingerprint(
  state: Pick<CohortWorkspace, 'sources'>
): string {
  const sources = state.sources ?? [];
  return sha256(
    JSON.stringify(sources.map(source => [source.id, source.version, source.text]))
  );
}

/**
 * Full build-input fingerprint covering sources, pedagogical parameters, and pinned/manual lesson overrides.
 */
export function computeBuildInputFingerprint(
  state: Pick<
    CohortWorkspace,
    'sources' | 'intent' | 'audience' | 'dailyMinutes' | 'lessons'
  >
): string {
  const sortedSources = [...(state.sources ?? [])]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(source => [source.id, source.version, source.input ?? source.text]);
  const overrides = (state.lessons ?? [])
    .filter(
      lesson =>
        lesson.manualOverride ||
        lesson.pinned ||
        !lesson.id.startsWith('grounded:')
    )
    .map(lesson => [
      lesson.id,
      lesson.version,
      lesson.title,
      lesson.objective,
      lesson.pinned,
      lesson.sourceChunkIds,
    ]);
  return sha256(
    JSON.stringify({
      sources: sortedSources,
      intent: (state.intent ?? '').trim(),
      audience: (state.audience ?? '').trim(),
      dailyMinutes: state.dailyMinutes ?? 30,
      overrides,
    })
  );
}

/**
 * Single authoritative check for whether a cohort workspace has a complete, accepted build.
 */
export function isBuildComplete(workspace: CohortWorkspace): boolean {
  const sources = workspace.sources ?? [];
  const lessons = workspace.lessons ?? [];
  const processing = workspace.processing;
  if (!processing) return false;
  if (processing.status !== 'ready') return false;
  if (processing.stage !== 'done') return false;
  if (!processing.sourceFingerprint) return false;
  if (sources.length === 0) return false;
  if (sources.some(s => (s.state as string) !== 'ready')) return false;
  if (lessons.length === 0) return false;

  const jobs = processing.jobs;
  if (jobs && jobs.length > 0) {
    return areAllJobsAcceptedForSources(sources, jobs);
  }
  return true;
}

/**
 * Single authoritative check for whether a workspace build is stale or requires a rebuild.
 */
export function isBuildStale(workspace: CohortWorkspace): boolean {
  const sources = workspace.sources ?? [];
  const lessons = workspace.lessons ?? [];
  const processing = workspace.processing;
  if (!processing || sources.length === 0) return false;

  const jobs = processing.jobs ?? [];
  const isCanceled =
    processing.error === 'PROCESSING_CANCELED' ||
    jobs.some(j => j.status === 'canceled');
  if (isCanceled) return true;

  if (
    sources.some(
      s => (s.state as string) === 'pending' || s.state === 'stale'
    )
  ) {
    return true;
  }

  const processingStarted = workspace.journey
    ? workspace.journey.processingStarted
    : true;

  if (processing.status === 'idle' && processingStarted) {
    return true;
  }

  if (
    (processing.status === 'queued' || processing.status === 'processing') &&
    lessons.length > 0 &&
    Boolean(processing.sourceFingerprint)
  ) {
    return true;
  }

  if (
    processing.status === 'ready' &&
    (!processing.sourceFingerprint || lessons.length === 0)
  ) {
    return true;
  }

  return false;
}

/**
 * Validates cross-region invariants on a workspace snapshot and reports any contradictions.
 */
export function validateWorkspaceInvariants(
  workspace: CohortWorkspace
): WorkspaceInvariantReport {
  const violations: string[] = [];
  const step = workspace.journey?.step;
  const complete = isBuildComplete(workspace);

  if (step === 'ready' && !complete) {
    violations.push('READY_WITHOUT_COMPLETE_BUILD');
  }
  if (
    step === 'review' &&
    !complete &&
    (workspace.lessons ?? []).length === 0
  ) {
    violations.push('REVIEW_WITHOUT_LESSONS');
  }
  if (step === 'published' && workspace.release?.status !== 'released') {
    violations.push('PUBLISHED_WITHOUT_RELEASE');
  }
  if (step === 'processing' && workspace.journey?.processingStarted === false) {
    violations.push('PROCESSING_STEP_WITHOUT_STARTED_FLAG');
  }
  if (
    workspace.processing?.status === 'ready' &&
    !workspace.processing.sourceFingerprint
  ) {
    violations.push('READY_STATUS_WITHOUT_FINGERPRINT');
  }
  if (
    workspace.processing?.status === 'ready' &&
    workspace.processing.stage !== 'done'
  ) {
    violations.push('READY_STATUS_WITH_NON_DONE_STAGE');
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Normalizes legacy branch values ('have_goal' -> 'find_material').
 */
export function normalizeCreationBranch(
  branch: CohortWorkspace['journey'] extends { branch: infer B } | undefined
    ? B
    : null
): CreationBranch {
  if (branch === 'have_material') return 'have_material';
  if (branch === 'find_material' || branch === 'have_goal') {
    return 'find_material';
  }
  return null;
}

/**
 * Extracts the orthogonal state-machine representation from a CohortWorkspace snapshot.
 */
export function deriveCreationMachineState(
  workspace: CohortWorkspace
): CreationMachineState {
  const step: CreationStep | null = workspace.journey?.step ?? null;
  const branch = normalizeCreationBranch(workspace.journey?.branch ?? null);
  const processingStarted = workspace.journey
    ? workspace.journey.processingStarted
    : (workspace.sources ?? []).length > 0 ||
      (workspace.lessons ?? []).length > 0;
  const intentVersion = workspace.journey?.intentVersion ?? 0;

  let discovery: DiscoveryRegionState = { status: 'idle', generation: 0 };
  if (workspace.discovery) {
    const d = workspace.discovery;
    if (d.status === 'queued' || d.status === 'running') {
      discovery = {
        status: d.status,
        requestId: d.requestId,
        fingerprint: d.fingerprint,
        generation: d.generation,
      };
    } else if (d.status === 'ready') {
      discovery = {
        status: 'ready',
        requestId: d.requestId,
        fingerprint: d.fingerprint,
        resultId: d.resultId ?? '',
        generation: d.generation,
        candidateCount: d.items.length,
      };
    } else if (d.status === 'failed' || d.status === 'canceled') {
      discovery = {
        status: d.status,
        requestId: d.requestId,
        fingerprint: d.fingerprint,
        generation: d.generation,
        error: d.error ?? null,
      };
    }
  }

  const complete = isBuildComplete(workspace);
  const stale = isBuildStale(workspace);
  const jobs = workspace.processing?.jobs ?? [];
  const isCanceled =
    workspace.processing?.error === 'PROCESSING_CANCELED' ||
    jobs.some(j => j.status === 'canceled');

  let buildStatus: BuildRegionStatus = 'not_started';
  if (isCanceled) {
    buildStatus = 'canceled';
  } else if (workspace.processing?.status === 'failed') {
    buildStatus = 'failed';
  } else if (workspace.processing?.status === 'processing') {
    buildStatus = 'running';
  } else if (workspace.processing?.status === 'queued') {
    buildStatus = 'queued';
  } else if (complete) {
    buildStatus = 'ready';
  } else if (stale) {
    buildStatus = 'stale';
  } else {
    buildStatus = 'not_started';
  }

  const build: BuildRegionState = {
    status: buildStatus,
    activeStage: workspace.processing?.stage ?? 'done',
    generation: workspace.processing?.generation ?? 0,
    acceptedSourceFingerprint: workspace.processing?.sourceFingerprint ?? null,
    currentSourceFingerprint: computeSourceEvidenceFingerprint(workspace),
    currentBuildInputFingerprint: computeBuildInputFingerprint(workspace),
    isBuildComplete: complete,
    isBuildStale: stale,
    error: workspace.processing?.error ?? null,
  };

  const release: ReleaseRegionState = {
    status: workspace.release?.status ?? 'draft',
    mode: workspace.release?.mode ?? null,
    candidateHash: workspace.release?.candidateHash ?? null,
    cohortId: workspace.release?.cohortId ?? null,
  };

  return {
    step,
    branch,
    processingStarted,
    intentVersion,
    discovery,
    build,
    release,
    invariants: validateWorkspaceInvariants(workspace),
  };
}
```

---

### Step `S2` — Create `src/shared/cohort-builder/creation-machine.ts`

- **Operation**: `CREATE`
- **File Path**: `src/shared/cohort-builder/creation-machine.ts`
- **Action**: Create `src/shared/cohort-builder/creation-machine.ts` with the following exact full file contents:

```ts
import { sha256 } from './hash';
import type {
  CohortWorkspace,
  CohortChunk,
  CohortLesson,
  CohortJourneyStep,
} from './contracts';
import {
  deriveCohortTitle,
  deriveCohortDescription,
} from './cohort-metadata';
import { buildCohortSeo } from './seo';
import { validateCohortReadiness } from './readiness';
import {
  computeSourceEvidenceFingerprint,
  isBuildComplete,
} from './creation-state';

export interface CreationCapabilities {
  canChooseStartingPoint: boolean;
  canBackToStartingPoint: boolean;
  canBackToRecommendations: boolean;
  canStartDiscovery: boolean;
  canCancelDiscovery: boolean;
  canSelectDiscoveryResources: boolean;
  canBeginMaterialProcessing: boolean;
  canRetryProcessing: boolean;
  canCancelProcessing: boolean;
  canOpenReview: boolean;
  canPreparePrivateRelease: boolean;
  canPreparePublicRelease: boolean;
  canReturnToMaterials: boolean;
}

export interface AcceptedBuildProjectionOptions {
  sources: Array<{ id: string; version: number; checksum: string }>;
  understanding: CohortWorkspace['understanding'];
  chunks: CohortChunk[];
  analyses: CohortWorkspace['analyses'];
  generatedLessons: CohortLesson[];
  generation: number;
  driver?: CohortWorkspace['processing']['driver'];
  jobs?: CohortWorkspace['processing']['jobs'];
  forceReadyJourneyStep?: boolean;
}

const SWITCHABLE_STARTING_POINT_STEPS: ReadonlySet<CohortJourneyStep> = new Set([
  'material_input',
  'discovery',
  'goal_setup',
  'ready',
  'review',
]);

/**
 * Returns true when `choose_starting_point` may switch branches from the given step.
 * Rejects 'processing' and 'published' while allowing direct return from 'ready' or 'review'.
 */
export function canSwitchStartingPointBranch(step: CohortJourneyStep): boolean {
  return SWITCHABLE_STARTING_POINT_STEPS.has(step);
}

/**
 * Validates that every generated lesson cites every retained chunk exactly once.
 */
export function validateAcceptedLessonCoverage(
  lessons: CohortLesson[],
  chunks: CohortChunk[]
): boolean {
  const chunkIds = new Set(chunks.map(chunk => chunk.id));
  const cited = lessons.flatMap(lesson => lesson.sourceChunkIds);
  return (
    cited.length === chunks.length &&
    new Set(cited).size === cited.length &&
    cited.every(id => chunkIds.has(id))
  );
}

/**
 * Projects newly generated lessons alongside retained manual/pinned lessons.
 */
export function projectAcceptedLessons(
  existing: CohortLesson[],
  generated: CohortLesson[],
  validChunkIds: ReadonlySet<string>
): CohortLesson[] {
  const authored = existing
    .filter(
      lesson =>
        lesson.pinned ||
        lesson.manualOverride ||
        !lesson.id.startsWith('grounded:')
    )
    .map(lesson =>
      lesson.sourceChunkIds.some(id => !validChunkIds.has(id))
        ? { ...lesson, evidenceStatus: 'orphaned' as const }
        : { ...lesson, evidenceStatus: 'valid' as const }
    );
  const protectedIds = new Set(authored.map(lesson => lesson.id));
  return [
    ...authored,
    ...generated
      .filter(lesson => !protectedIds.has(lesson.id))
      .map(lesson => {
        const prior = existing.find(item => item.id === lesson.id);
        const changed =
          prior &&
          (prior.title !== lesson.title ||
            prior.objective !== lesson.objective ||
            JSON.stringify(prior.sourceChunkIds) !==
              JSON.stringify(lesson.sourceChunkIds));
        return {
          ...lesson,
          version: prior ? prior.version + (changed ? 1 : 0) : lesson.version,
          evidenceStatus: 'valid' as const,
        };
      }),
  ];
}

/**
 * Single authoritative build-completion projector shared by synchronous `runDeterministicPipeline`
 * and durable `acceptAssemblyProjection`.
 */
export function projectAcceptedBuildCompletion(
  state: CohortWorkspace,
  options: AcceptedBuildProjectionOptions
): CohortWorkspace {
  if (!validateAcceptedLessonCoverage(options.generatedLessons, options.chunks)) {
    throw new Error('FABRICATED_LESSON_EVIDENCE');
  }

  const next = structuredClone(state);
  for (const source of next.sources) {
    const accepted = options.sources.find(
      item => item.id === source.id && item.version === source.version
    );
    source.checksum = accepted ? accepted.checksum : sha256(source.text);
    source.state = 'ready';
  }

  next.understanding = options.understanding;
  next.title = deriveCohortTitle(next);
  next.description = deriveCohortDescription(next);
  next.chunks = options.chunks;
  next.analyses = options.analyses;
  next.lessons = projectAcceptedLessons(
    next.lessons ?? [],
    options.generatedLessons,
    new Set(options.chunks.map(chunk => chunk.id))
  );
  next.seo = buildCohortSeo(next);

  const fingerprint = computeSourceEvidenceFingerprint(next);
  next.processing = {
    status: 'ready',
    stage: 'done',
    generation: options.generation,
    sourceFingerprint: fingerprint,
    error: null,
    ...(options.driver !== undefined ? { driver: options.driver } : {}),
    ...(options.jobs !== undefined ? { jobs: options.jobs } : {}),
  };

  if (options.forceReadyJourneyStep) {
    next.journey = {
      version: 1,
      step: 'ready',
      branch: next.journey?.branch ?? null,
      processingStarted: true,
      intentVersion: next.journey?.intentVersion ?? 0,
    };
  } else if (next.journey?.step === 'processing') {
    next.journey = {
      ...next.journey,
      step: 'ready',
      processingStarted: true,
    };
  }

  return next;
}

/**
 * Normalizes `next.journey` after any source or pedagogical preference mutation so that:
 * 1. Removing the last source while in 'processing' or 'ready' returns the workspace to 'material_input' with `processingStarted = false`.
 * 2. Queuing a rebuild while in 'ready' transitions `journey.step` to 'processing' instead of stranding the user on ReadyStageView.
 */
export function normalizePostMutationLifecycle(next: CohortWorkspace): void {
  if (!next.journey) return;
  if (next.journey.step === 'published') return;

  if (next.sources.length === 0) {
    if (next.journey.step === 'processing' || next.journey.step === 'ready') {
      next.journey.step = 'material_input';
      next.journey.processingStarted = false;
    }
    return;
  }

  if (
    next.journey.processingStarted &&
    (next.processing.status === 'queued' ||
      next.processing.status === 'processing') &&
    next.journey.step === 'ready'
  ) {
    next.journey.step = 'processing';
  }
}

/**
 * Computes the set of allowed domain/UI capabilities for a given workspace snapshot.
 */
export function getCreationCapabilities(
  workspace: CohortWorkspace
): CreationCapabilities {
  const step = workspace.journey?.step ?? null;
  const isPublished =
    step === 'published' || workspace.release?.status === 'released';
  const buildComplete = isBuildComplete(workspace);
  const processingStarted = workspace.journey
    ? workspace.journey.processingStarted
    : (workspace.sources ?? []).length > 0;
  const isProcessingActive =
    workspace.processing?.status === 'queued' ||
    workspace.processing?.status === 'processing' ||
    (workspace.processing?.jobs ?? []).some(
      j => j.status === 'queued' || j.status === 'running'
    );

  const canChooseStartingPoint =
    !isPublished &&
    (step === null ||
      step === 'chat' ||
      step === 'recommendations' ||
      step === 'starting_point' ||
      canSwitchStartingPointBranch(step));

  const canBackToStartingPoint = !isPublished;
  const canBackToRecommendations = !isPublished;

  const canStartDiscovery =
    !isPublished &&
    (step === 'discovery' ||
      step === 'goal_setup' ||
      step === 'material_input' ||
      step === 'review' ||
      step === 'chat');

  const canCancelDiscovery =
    step === 'discovery' &&
    workspace.journey?.branch === 'find_material' &&
    Boolean(
      workspace.discovery &&
        (workspace.discovery.status === 'queued' ||
          workspace.discovery.status === 'running')
    );

  const canSelectDiscoveryResources =
    step === 'discovery' &&
    workspace.journey?.branch === 'find_material' &&
    workspace.discovery?.status === 'ready' &&
    Boolean(workspace.discovery.resultId);

  const canBeginMaterialProcessing =
    !isPublished &&
    (workspace.sources ?? []).length > 0 &&
    (step === 'material_input' ||
      step === 'goal_setup' ||
      step === 'review' ||
      step === 'chat');

  const canRetryProcessing =
    !isPublished &&
    processingStarted &&
    (workspace.sources ?? []).length > 0;

  const canCancelProcessing = !isPublished && isProcessingActive;

  const canOpenReview =
    !isPublished &&
    ((step === 'ready' && buildComplete) ||
      (step === 'chat' &&
        (workspace.lessons ?? []).length > 0 &&
        !isProcessingActive));

  const privateReadiness = buildComplete
    ? validateCohortReadiness(workspace, 'private_activation')
    : null;
  const publicReadiness = buildComplete
    ? validateCohortReadiness(workspace, 'public_publish')
    : null;

  return {
    canChooseStartingPoint,
    canBackToStartingPoint,
    canBackToRecommendations,
    canStartDiscovery,
    canCancelDiscovery,
    canSelectDiscoveryResources,
    canBeginMaterialProcessing,
    canRetryProcessing,
    canCancelProcessing,
    canOpenReview,
    canPreparePrivateRelease: Boolean(privateReadiness?.ready),
    canPreparePublicRelease: Boolean(publicReadiness?.ready),
    canReturnToMaterials: !isPublished,
  };
}
```

---

### Step `S3` — Create `src/shared/cohort-builder/creation-view.ts`

- **Operation**: `CREATE`
- **File Path**: `src/shared/cohort-builder/creation-view.ts`
- **Action**: Create `src/shared/cohort-builder/creation-view.ts` with the following exact full file contents:

```ts
import type { CohortWorkspace } from './contracts';
import {
  isBuildComplete,
  isBuildStale,
  validateWorkspaceInvariants,
  type WorkspaceInvariantReport,
} from './creation-state';
import {
  getCreationCapabilities,
  type CreationCapabilities,
} from './creation-machine';

export type BuilderStage =
  | 'chat'
  | 'recommendations'
  | 'starting_point'
  | 'material_input'
  | 'discovery'
  | 'goal_setup'
  | 'intake'
  | 'understanding'
  | 'chunking'
  | 'analysis'
  | 'assembly'
  | 'curriculum'
  | 'review'
  | 'ready'
  | 'published';

export interface ProcessingStep {
  label: 'Understanding' | 'Chunking' | 'Analyzing' | 'Building';
  isComplete: boolean;
  isCurrent: boolean;
  isFailed: boolean;
}

export interface ProcessingProgress {
  currentStepIndex: number;
  steps: ProcessingStep[];
  needsRebuild: boolean;
}

export const STEP_TO_STAGE_MAP: Record<ProcessingStep['label'], BuilderStage> = {
  Understanding: 'understanding',
  Chunking: 'chunking',
  Analyzing: 'analysis',
  Building: 'assembly',
};

export interface ReadyStageViewModel {
  isReady: boolean;
  isStale: boolean;
  isFailed: boolean;
  canActivate: boolean;
  canReview: boolean;
  canReturnToMaterial: boolean;
  eyebrow: string;
  heading: string;
  subtitle: string;
  badgeLabel: string;
  sourceCount: number;
  chunkCount: number;
  lessonCount: number;
}

export interface CreationViewModel {
  activeStage: BuilderStage;
  effectiveStage: BuilderStage;
  effectiveInspectedStage: BuilderStage | null;
  hideStepper: boolean;
  progress: ProcessingProgress;
  readyStage: ReadyStageViewModel;
  capabilities: CreationCapabilities;
  invariants: WorkspaceInvariantReport;
}

/**
 * Derives the active processing sub-stage ('understanding' | 'chunking' | 'analysis' | 'assembly')
 * from canonical jobs or the fallback `processing.stage` field.
 */
export function deriveProcessingStage(
  workspace: CohortWorkspace,
  doneFallback: BuilderStage = 'assembly'
): BuilderStage {
  const jobs = workspace.processing?.jobs;
  if (jobs && jobs.length > 0) {
    const failedJobs = jobs.filter(j => j.status === 'failed');
    if (failedJobs.length > 0) {
      if (
        failedJobs.some(j =>
          ['understanding', 'acquisition', 'extraction'].includes(j.stage)
        )
      ) {
        return 'understanding';
      }
      if (failedJobs.some(j => j.stage === 'chunking')) {
        return 'chunking';
      }
      if (failedJobs.some(j => j.stage === 'analysis')) {
        return 'analysis';
      }
      if (failedJobs.some(j => j.stage === 'assembly')) {
        return 'assembly';
      }
    }

    const activeJobs = jobs.filter(
      j => j.status === 'running' || j.status === 'queued'
    );
    if (activeJobs.length > 0) {
      if (
        activeJobs.some(j =>
          ['understanding', 'acquisition', 'extraction'].includes(j.stage)
        )
      ) {
        return 'understanding';
      }
      if (activeJobs.some(j => j.stage === 'chunking')) {
        return 'chunking';
      }
      if (activeJobs.some(j => j.stage === 'analysis')) {
        return 'analysis';
      }
      if (activeJobs.some(j => j.stage === 'assembly')) {
        return 'assembly';
      }
    }
  }

  switch (workspace.processing?.stage) {
    case 'acquisition':
    case 'extraction':
    case 'understanding':
      return 'understanding';
    case 'chunking':
      return 'chunking';
    case 'analysis':
      return 'analysis';
    case 'assembly':
      return 'assembly';
    case 'done':
      return doneFallback;
  }
  return 'understanding';
}

/**
 * Single authoritative selector for the active stage of a cohort workspace.
 * Prevents contradictory 'ready' routing when a build is queued, running, or failed.
 */
export function deriveActiveStage(workspace: CohortWorkspace): BuilderStage {
  if (workspace.journey) {
    if (workspace.journey.step === 'chat') {
      return 'chat';
    }
    if (workspace.journey.step === 'recommendations') {
      return 'recommendations';
    }
    if (workspace.journey.step === 'starting_point') {
      return 'starting_point';
    }
    if (workspace.journey.step === 'material_input') {
      return 'material_input';
    }
    if (workspace.journey.step === 'discovery') {
      return 'discovery';
    }
    if (workspace.journey.step === 'goal_setup') {
      return 'goal_setup';
    }
    if (workspace.journey.step === 'published') {
      return 'published';
    }
    if (workspace.journey.step === 'review') {
      return 'review';
    }
    if (workspace.journey.step === 'ready') {
      if (isBuildComplete(workspace)) {
        return 'ready';
      }
      if (
        (workspace.sources ?? []).length === 0 &&
        (workspace.lessons ?? []).length === 0
      ) {
        return 'material_input';
      }
      if (
        workspace.processing.status === 'processing' ||
        workspace.processing.status === 'queued' ||
        workspace.processing.status === 'failed'
      ) {
        return deriveProcessingStage(workspace, 'assembly');
      }
      return 'ready';
    }
    if (workspace.journey.step === 'processing') {
      return deriveProcessingStage(workspace, 'assembly');
    }
  }

  const sources = workspace.sources ?? [];
  const lessons = workspace.lessons ?? [];
  const processing = workspace.processing;

  if (sources.length === 0 && lessons.length === 0) {
    return 'intake';
  }

  if (processing.status === 'ready') {
    if (workspace.release && workspace.release.status !== 'draft') {
      return 'review';
    }
    return 'curriculum';
  }

  if (
    processing.status === 'processing' ||
    processing.status === 'queued' ||
    processing.status === 'failed'
  ) {
    return deriveProcessingStage(workspace, 'curriculum');
  }

  return lessons.length > 0 ? 'curriculum' : 'intake';
}

/**
 * Pure selector returning the effective stage for navigation/inspection.
 */
export function deriveEffectiveStage(
  workspace: CohortWorkspace,
  inspectedStage?: BuilderStage | null,
  drafts?: {
    isAnyDirtyOrOpen: () => boolean;
    editingStage: BuilderStage | null;
  }
): BuilderStage {
  const active = deriveActiveStage(workspace);
  if (
    active === 'chat' ||
    active === 'recommendations' ||
    active === 'starting_point' ||
    active === 'material_input' ||
    active === 'discovery' ||
    active === 'goal_setup'
  ) {
    return active;
  }
  if (inspectedStage) return inspectedStage;
  if (drafts && drafts.isAnyDirtyOrOpen() && drafts.editingStage) {
    return drafts.editingStage;
  }
  return active;
}

/**
 * Single authoritative 4-step stepper progress derivation.
 */
export function deriveProcessingProgress(
  workspace: CohortWorkspace
): ProcessingProgress {
  const stepLabels: Array<ProcessingStep['label']> = [
    'Understanding',
    'Chunking',
    'Analyzing',
    'Building',
  ];

  const status = workspace.processing.status as string;
  const stage = workspace.processing.stage as string;
  const error = workspace.processing.error;
  const sources = workspace.sources ?? [];
  const jobs = workspace.processing.jobs ?? [];
  const isCanceled =
    error === 'PROCESSING_CANCELED' || jobs.some(j => j.status === 'canceled');

  if (
    sources.length === 0 ||
    (status === 'idle' &&
      workspace.processing.sourceFingerprint === null &&
      jobs.length === 0)
  ) {
    return {
      currentStepIndex: -1,
      steps: stepLabels.map(label => ({
        label,
        isComplete: false,
        isCurrent: false,
        isFailed: false,
      })),
      needsRebuild: false,
    };
  }

  if (jobs.length > 0) {
    const isSourceStageAccepted = (
      sourceId: string,
      stageName: 'understanding' | 'chunking' | 'analysis'
    ) => {
      return jobs.some(
        j =>
          j.sourceId === sourceId &&
          j.stage === stageName &&
          j.status === 'accepted'
      );
    };

    const isSourceStageFailed = (
      sourceId: string,
      stageName: 'understanding' | 'chunking' | 'analysis'
    ) => {
      if (stageName === 'understanding') {
        return jobs.some(
          j =>
            j.sourceId === sourceId &&
            ['acquisition', 'extraction', 'understanding'].includes(j.stage) &&
            j.status === 'failed'
        );
      }
      return jobs.some(
        j =>
          j.sourceId === sourceId &&
          j.stage === stageName &&
          j.status === 'failed'
      );
    };

    const isSourceStageActive = (
      sourceId: string,
      stageName: 'understanding' | 'chunking' | 'analysis'
    ) => {
      if (stageName === 'understanding') {
        return jobs.some(
          j =>
            j.sourceId === sourceId &&
            ['acquisition', 'extraction', 'understanding'].includes(j.stage) &&
            (j.status === 'running' || j.status === 'queued')
        );
      }
      return jobs.some(
        j =>
          j.sourceId === sourceId &&
          j.stage === stageName &&
          (j.status === 'running' || j.status === 'queued')
      );
    };

    const assemblyJob = jobs.find(
      j => j.stage === 'assembly' || j.sourceId === null
    );
    const assemblyAccepted = assemblyJob?.status === 'accepted';
    const assemblyFailed = assemblyJob?.status === 'failed';
    const assemblyActive =
      assemblyJob?.status === 'running' || assemblyJob?.status === 'queued';

    const step0Complete =
      sources.length > 0 &&
      sources.every(s => isSourceStageAccepted(s.id, 'understanding'));
    const step0Failed = sources.some(s =>
      isSourceStageFailed(s.id, 'understanding')
    );
    const step0Active =
      !step0Complete &&
      !step0Failed &&
      sources.some(s => isSourceStageActive(s.id, 'understanding'));

    const step1Complete =
      step0Complete &&
      sources.every(s => isSourceStageAccepted(s.id, 'chunking'));
    const step1Failed =
      step0Complete &&
      sources.some(s => isSourceStageFailed(s.id, 'chunking'));
    const step1Active =
      step0Complete &&
      !step1Complete &&
      !step1Failed &&
      sources.some(s => isSourceStageActive(s.id, 'chunking'));

    const step2Complete =
      step1Complete &&
      sources.every(s => isSourceStageAccepted(s.id, 'analysis'));
    const step2Failed =
      step1Complete &&
      sources.some(s => isSourceStageFailed(s.id, 'analysis'));
    const step2Active =
      step1Complete &&
      !step2Complete &&
      !step2Failed &&
      sources.some(s => isSourceStageActive(s.id, 'analysis'));

    const step3Complete = step2Complete && assemblyAccepted;
    const step3Failed = step2Complete && assemblyFailed;
    const step3Active =
      step2Complete && !step3Complete && !step3Failed && assemblyActive;

    const anySourcePending = sources.some(
      s => (s.state as string) === 'pending'
    );
    const needsRebuild =
      anySourcePending ||
      isCanceled ||
      Boolean(step0Failed || step1Failed || step2Failed || step3Failed);

    let currentStepIndex = -1;
    if (
      !isCanceled &&
      !step0Failed &&
      !step1Failed &&
      !step2Failed &&
      !step3Failed
    ) {
      if (step0Active) currentStepIndex = 0;
      else if (step1Active) currentStepIndex = 1;
      else if (step2Active) currentStepIndex = 2;
      else if (step3Active) currentStepIndex = 3;
    }

    return {
      currentStepIndex,
      steps: [
        {
          label: 'Understanding',
          isComplete: step0Complete,
          isCurrent: !isCanceled && currentStepIndex === 0,
          isFailed: Boolean(step0Failed),
        },
        {
          label: 'Chunking',
          isComplete: step1Complete,
          isCurrent: !isCanceled && currentStepIndex === 1,
          isFailed: Boolean(step1Failed),
        },
        {
          label: 'Analyzing',
          isComplete: step2Complete,
          isCurrent: !isCanceled && currentStepIndex === 2,
          isFailed: Boolean(step2Failed),
        },
        {
          label: 'Building',
          isComplete: Boolean(step3Complete),
          isCurrent: !isCanceled && currentStepIndex === 3,
          isFailed: Boolean(step3Failed),
        },
      ],
      needsRebuild,
    };
  }

  const stageToIndex = (st: string): number => {
    switch (st) {
      case 'acquisition':
      case 'extraction':
      case 'understanding':
        return 0;
      case 'chunking':
        return 1;
      case 'analysis':
        return 2;
      case 'assembly':
      case 'building':
      case 'done':
        return 3;
      default:
        return 0;
    }
  };

  if (isCanceled) {
    return {
      currentStepIndex: -1,
      steps: stepLabels.map(label => ({
        label,
        isComplete: false,
        isCurrent: false,
        isFailed: false,
      })),
      needsRebuild: true,
    };
  }

  if (status === 'failed') {
    const failingIndex = stageToIndex(stage);
    return {
      currentStepIndex: -1,
      steps: stepLabels.map((label, index) => ({
        label,
        isComplete: index < failingIndex,
        isCurrent: false,
        isFailed: index === failingIndex,
      })),
      needsRebuild: true,
    };
  }

  if (status === 'running' || status === 'queued' || status === 'processing') {
    const activeIndex = stageToIndex(stage);
    return {
      currentStepIndex: activeIndex,
      steps: stepLabels.map((label, index) => ({
        label,
        isComplete: index < activeIndex,
        isCurrent: index === activeIndex,
        isFailed: false,
      })),
      needsRebuild: false,
    };
  }

  const anySourceNotReady = sources.some(
    s => (s.state as string) === 'pending' || s.state !== 'ready'
  );
  if (anySourceNotReady || (status === 'idle' && sources.length > 0)) {
    return {
      currentStepIndex: -1,
      steps: stepLabels.map(label => ({
        label,
        isComplete: false,
        isCurrent: false,
        isFailed: false,
      })),
      needsRebuild: true,
    };
  }

  if (
    status === 'ready' &&
    sources.length > 0 &&
    sources.every(s => (s.state as string) === 'ready')
  ) {
    return {
      currentStepIndex: -1,
      steps: stepLabels.map(label => ({
        label,
        isComplete: true,
        isCurrent: false,
        isFailed: false,
      })),
      needsRebuild: false,
    };
  }

  return {
    currentStepIndex: -1,
    steps: stepLabels.map(label => ({
      label,
      isComplete: false,
      isCurrent: false,
      isFailed: false,
    })),
    needsRebuild: sources.length > 0,
  };
}

/**
 * Derives the view model for `ReadyStageView` from the canonical build readiness state.
 */
export function deriveReadyStageViewModel(
  workspace: CohortWorkspace
): ReadyStageViewModel {
  const isReady = isBuildComplete(workspace);
  const isStale = isBuildStale(workspace);
  const isFailed = workspace.processing?.status === 'failed';
  const capabilities = getCreationCapabilities(workspace);

  return {
    isReady,
    isStale,
    isFailed,
    canActivate: isReady && capabilities.canPreparePrivateRelease,
    canReview: isReady,
    canReturnToMaterial: capabilities.canReturnToMaterials,
    eyebrow: isReady
      ? 'Your learning experience is ready'
      : 'Building your curriculum',
    heading: isReady ? 'All set.' : 'In progress.',
    subtitle: isReady
      ? 'I’ve turned your material into a learning experience and set it up in your personal feed. You can jump straight in, or review the cohort structure first.'
      : 'Your material is still being processed into a curriculum. You can wait for completion or go back to adjust your sources.',
    badgeLabel: isReady ? 'Processed' : 'Build not complete',
    sourceCount: (workspace.sources ?? []).length,
    chunkCount: (workspace.chunks ?? []).length,
    lessonCount: (workspace.lessons ?? []).length,
  };
}

/**
 * Computes the complete view model for `CohortWorkspacePane`.
 */
export function deriveCreationViewModel(
  workspace: CohortWorkspace,
  inspectedStage?: BuilderStage | null,
  drafts?: {
    isAnyDirtyOrOpen: () => boolean;
    editingStage: BuilderStage | null;
  }
): CreationViewModel {
  const progress = deriveProcessingProgress(workspace);
  const isInspectedStageAccessible = Boolean(
    inspectedStage &&
      progress.steps.some(
        s =>
          STEP_TO_STAGE_MAP[s.label] === inspectedStage &&
          (s.isComplete || s.isCurrent || s.isFailed)
      )
  );
  const effectiveInspectedStage = isInspectedStageAccessible
    ? (inspectedStage ?? null)
    : null;
  const activeStage = deriveActiveStage(workspace);
  const effectiveStage = deriveEffectiveStage(
    workspace,
    effectiveInspectedStage,
    drafts
  );
  const isJourneyInitialStep =
    effectiveStage === 'recommendations' ||
    effectiveStage === 'starting_point' ||
    effectiveStage === 'material_input' ||
    effectiveStage === 'discovery' ||
    effectiveStage === 'goal_setup';
  const hideStepper = isJourneyInitialStep || effectiveStage === 'published';

  return {
    activeStage,
    effectiveStage,
    effectiveInspectedStage,
    hideStepper,
    progress,
    readyStage: deriveReadyStageViewModel(workspace),
    capabilities: getCreationCapabilities(workspace),
    invariants: validateWorkspaceInvariants(workspace),
  };
}
```

---

### Step `S4` — Modify `src/shared/cohort-builder/client-pipeline.ts`

- **Operation**: `MODIFY`
- **File Path**: `src/shared/cohort-builder/client-pipeline.ts`
- **Baseline SHA-256**: `039c5b55d28017cfcde736c4def19c7f73b6abffaf0ef50a38fa470b34f10cbc`

#### Edit `S4.1` — Import state-machine helpers and delegate `sourceFingerprint`
Replace this exact target block in `src/shared/cohort-builder/client-pipeline.ts` (lines 7–29):

```ts
import { sha256 } from './hash';
import type { CohortWorkspace, CohortChunk, CohortLesson } from './contracts';
import { extractSourceConceptTopics, deriveCohortTitle, deriveCohortDescription } from './cohort-metadata';
import { buildCohortSeo } from './seo';

export const MAX_UNIT_BYTES = 24 * 1024;
export const MIN_VIDEO_CHUNK_MS = 60_000; // 1 minute target for video chunks

/**
 * Computes UTF-8 byte length isomorphically without Node's `Buffer.byteLength`.
 */
export function byteLengthUtf8(str: string): number {
  return new TextEncoder().encode(str).byteLength;
}

/**
 * Fingerprints source contents and versions.
 * Matches `text-pipeline.ts` output exactly.
 */
export function sourceFingerprint(state: Pick<CohortWorkspace, 'sources'>): string {
  return sha256(JSON.stringify(state.sources.map(source => [source.id, source.version, source.text])));
}
```

With this exact replacement block:

```ts
import { sha256 } from './hash';
import type { CohortWorkspace, CohortChunk, CohortLesson } from './contracts';
import { extractSourceConceptTopics } from './cohort-metadata';
import { computeSourceEvidenceFingerprint } from './creation-state';
import {
  projectAcceptedBuildCompletion,
  projectAcceptedLessons,
  validateAcceptedLessonCoverage,
} from './creation-machine';

export const MAX_UNIT_BYTES = 24 * 1024;
export const MIN_VIDEO_CHUNK_MS = 60_000; // 1 minute target for video chunks

/**
 * Computes UTF-8 byte length isomorphically without Node's `Buffer.byteLength`.
 */
export function byteLengthUtf8(str: string): number {
  return new TextEncoder().encode(str).byteLength;
}

/**
 * Fingerprints source contents and versions.
 * Matches `text-pipeline.ts` output exactly.
 */
export function sourceFingerprint(state: Pick<CohortWorkspace, 'sources'>): string {
  return computeSourceEvidenceFingerprint(state);
}
```

#### Edit `S4.2` — Delegate lesson validation/projection and `runDeterministicPipeline` completion to `creation-machine.ts`
Replace this exact target block in `src/shared/cohort-builder/client-pipeline.ts` (lines 191–323):

```ts
/** Generated lessons must cite every retained chunk exactly once, in source order. */
export function validateGeneratedLessonCoverage(lessons: CohortLesson[], chunks: CohortChunk[]): boolean {
  const chunkIds = new Set(chunks.map(chunk => chunk.id));
  const cited = lessons.flatMap(lesson => lesson.sourceChunkIds);
  return cited.length === chunks.length && new Set(cited).size === cited.length && cited.every(id => chunkIds.has(id));
}

/**
 * Checks whether a workspace's sources are all pre-extracted and eligible for
 * synchronous, instant on-device curriculum assembly (<15ms).
 */
export function canRunDeterministicPipeline(state: CohortWorkspace): boolean {
  if (!state.sources || state.sources.length === 0) return false;
  return state.sources.every(source =>
    Boolean(source.text && source.text.trim().length > 0 && Array.isArray(source.locations))
  );
}

/**
 * Merges generated lessons with existing authored lessons.
 */
export function projectGeneratedLessons(
  existing: CohortLesson[],
  generated: CohortLesson[],
  validChunkIds: ReadonlySet<string>
): CohortLesson[] {
  const authored = existing
    .filter(lesson => lesson.pinned || lesson.manualOverride || !lesson.id.startsWith('grounded:'))
    .map(lesson => lesson.sourceChunkIds.some(id => !validChunkIds.has(id))
      ? { ...lesson, evidenceStatus: 'orphaned' as const }
      : { ...lesson, evidenceStatus: 'valid' as const });
  const protectedIds = new Set(authored.map(lesson => lesson.id));
  return [
    ...authored,
    ...generated.filter(lesson => !protectedIds.has(lesson.id)).map(lesson => {
      const prior = existing.find(item => item.id === lesson.id);
      const changed = prior && (prior.title !== lesson.title || prior.objective !== lesson.objective
        || JSON.stringify(prior.sourceChunkIds) !== JSON.stringify(lesson.sourceChunkIds));
      return {
        ...lesson,
        version: prior ? prior.version + (changed ? 1 : 0) : lesson.version,
        evidenceStatus: 'valid' as const,
      };
    }),
  ];
}

/**
 * Runs all 4 deterministic stages (understanding -> chunking -> analysis -> assembly)
 * synchronously in <15ms over already-extracted sources.
 *
 * Produces a fully valid, ready-to-review CohortWorkspace without triggering
 * multi-step server background DB jobs.
 */
export function runDeterministicPipeline(state: CohortWorkspace): CohortWorkspace {
  if (!canRunDeterministicPipeline(state)) {
    throw new Error('SOURCES_NOT_EXTRACTED_FOR_DETERMINISTIC_PIPELINE');
  }

  const next = structuredClone(state);

  // 1. Acquisition & Checksums
  for (const source of next.sources) {
    source.checksum = sha256(source.text);
    source.state = 'ready';
  }

  // 2. Understanding & Derived Metadata
  next.understanding = next.sources.map(source => {
    const existing = next.understanding?.find(item => item.sourceId === source.id && item.sourceVersion === source.version);
    return existing ?? {
      sourceId: source.id,
      sourceVersion: source.version,
      topics: extractSourceConceptTopics(source),
    };
  });
  next.title = deriveCohortTitle(next);
  next.description = deriveCohortDescription(next);

  // 3. Chunking
  const allChunks: CohortChunk[] = next.sources.flatMap(splitSource);
  if (allChunks.length > 1_000) throw new Error('TOO_MANY_CHUNKS');
  allChunks.forEach(chunk => validateChunk(next, chunk));
  for (const source of next.sources) {
    validateCoverage(source.text, allChunks.filter(chunk => chunk.sourceId === source.id));
  }
  next.chunks = allChunks;

  // 4. Analysis
  next.analyses = allChunks.map(chunk => {
    const existing = next.analyses?.find(item => item.chunkId === chunk.id);
    return existing ?? {
      chunkId: chunk.id,
      summary: chunk.text.slice(0, 300),
      question: `How would you apply this passage: ${chunk.text.slice(0, 160)}?`,
    };
  });

  // 5. Lesson Assembly
  const generatedLessons = buildGeneratedLessons(next);
  if (!validateGeneratedLessonCoverage(generatedLessons, next.chunks)) {
    throw new Error('FABRICATED_LESSON_EVIDENCE');
  }
  next.lessons = projectGeneratedLessons(
    next.lessons ?? [],
    generatedLessons,
    new Set(allChunks.map(c => c.id))
  );

  // 6. SEO
  next.seo = buildCohortSeo(next);

  // 7. Complete Processing State
  const fingerprint = sourceFingerprint(next);
  next.processing = {
    status: 'ready',
    stage: 'done',
    generation: (next.processing?.generation ?? 0) + 1,
    sourceFingerprint: fingerprint,
    error: null,
    driver: 'durable',
  };

  next.journey = {
    version: 1,
    step: 'ready',
    branch: next.journey?.branch ?? null,
    processingStarted: true,
    intentVersion: next.journey?.intentVersion ?? 0,
  };

  return next;
}
```

With this exact replacement block:

```ts
/** Generated lessons must cite every retained chunk exactly once, in source order. */
export function validateGeneratedLessonCoverage(lessons: CohortLesson[], chunks: CohortChunk[]): boolean {
  return validateAcceptedLessonCoverage(lessons, chunks);
}

/**
 * Checks whether a workspace's sources are all pre-extracted and eligible for
 * synchronous, instant on-device curriculum assembly (<15ms).
 */
export function canRunDeterministicPipeline(state: CohortWorkspace): boolean {
  if (!state.sources || state.sources.length === 0) return false;
  return state.sources.every(source =>
    Boolean(source.text && source.text.trim().length > 0 && Array.isArray(source.locations))
  );
}

/**
 * Merges generated lessons with existing authored lessons.
 */
export function projectGeneratedLessons(
  existing: CohortLesson[],
  generated: CohortLesson[],
  validChunkIds: ReadonlySet<string>
): CohortLesson[] {
  return projectAcceptedLessons(existing, generated, validChunkIds);
}

/**
 * Runs all 4 deterministic stages (understanding -> chunking -> analysis -> assembly)
 * synchronously in <15ms over already-extracted sources.
 *
 * Produces a fully valid, ready-to-review CohortWorkspace without triggering
 * multi-step server background DB jobs.
 */
export function runDeterministicPipeline(state: CohortWorkspace): CohortWorkspace {
  if (!canRunDeterministicPipeline(state)) {
    throw new Error('SOURCES_NOT_EXTRACTED_FOR_DETERMINISTIC_PIPELINE');
  }

  const working = structuredClone(state);

  // 1. Acquisition & Checksums
  const acceptedSources = working.sources.map(source => ({
    id: source.id,
    version: source.version,
    checksum: sha256(source.text),
  }));

  // 2. Understanding
  const understanding = working.sources.map(source => {
    const existing = working.understanding?.find(
      item => item.sourceId === source.id && item.sourceVersion === source.version
    );
    return (
      existing ?? {
        sourceId: source.id,
        sourceVersion: source.version,
        topics: extractSourceConceptTopics(source),
      }
    );
  });

  // 3. Chunking
  const allChunks: CohortChunk[] = working.sources.flatMap(splitSource);
  if (allChunks.length > 1_000) throw new Error('TOO_MANY_CHUNKS');
  allChunks.forEach(chunk => validateChunk(working, chunk));
  for (const source of working.sources) {
    validateCoverage(source.text, allChunks.filter(chunk => chunk.sourceId === source.id));
  }
  working.chunks = allChunks;

  // 4. Analysis
  const analyses = allChunks.map(chunk => {
    const existing = working.analyses?.find(item => item.chunkId === chunk.id);
    return (
      existing ?? {
        chunkId: chunk.id,
        summary: chunk.text.slice(0, 300),
        question: `How would you apply this passage: ${chunk.text.slice(0, 160)}?`,
      }
    );
  });
  working.analyses = analyses;

  // 5. Lesson Assembly & Unified Completion Projection
  const generatedLessons = buildGeneratedLessons(working);
  return projectAcceptedBuildCompletion(state, {
    sources: acceptedSources,
    understanding,
    chunks: allChunks,
    analyses,
    generatedLessons,
    generation: (state.processing?.generation ?? 0) + 1,
    driver: 'durable',
    forceReadyJourneyStep: true,
  });
}
```

---

### Step `S5` — Modify `src/server/domain/cohort-builder/text-assembly-acceptance.ts`

- **Operation**: `MODIFY` (Full File Replacement)
- **File Path**: `src/server/domain/cohort-builder/text-assembly-acceptance.ts`
- **Baseline SHA-256**: `e206bb55227aa9fc38aaf06d6a8ae9525e088e1e9ad1a6a300302b11864b9fd9`
- **Action**: Replace the entire contents of `src/server/domain/cohort-builder/text-assembly-acceptance.ts` with the following exact full file contents:

```ts
import { randomUUID } from 'node:crypto';
import {
  cohortWorkspaceSchema,
  type CohortLesson,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import { projectAcceptedBuildCompletion } from '@/src/shared/cohort-builder/creation-machine';
import type { TextArtifactRef } from './text-artifacts';
import {
  computeAssemblyLessons,
  loadAcceptedSourceArtifacts,
} from './text-assembly-processor';
import { planTextJobs } from './text-job-plan';
import type { TextJobTransactionPort } from './text-job-scheduler';
import type { ClaimedTextJob } from './text-jobs';

export async function acceptAssemblyProjection(
  port: TextJobTransactionPort,
  job: ClaimedTextJob,
  artifact: TextArtifactRef,
  now = new Date()
): Promise<boolean> {
  return port.transaction(async sql => {
    const ws = await sql.query<{ snapshot: unknown; revision: number }>(
      `SELECT "snapshot", "revision" FROM "interaction_workspaces" WHERE "id" = $1 FOR UPDATE`,
      [job.workspaceId]
    );
    if (!ws.rows[0]) return false;
    const state = cohortWorkspaceSchema.parse(ws.rows[0].snapshot);
    const currentPlan = planTextJobs(state).find(
      item => item.stage === 'assembly'
    );
    if (!currentPlan || currentPlan.jobKey !== job.jobKey) return false;
    const artifacts = await loadAcceptedSourceArtifacts(sql, job, state);
    if (!artifacts) return false;
    for (const source of state.sources) {
      const accepted = artifacts.sources.find(
        item => item.id === source.id && item.version === source.version
      );
      if (!accepted) return false;
    }
    const bytes = await sql.query<{ payload: Buffer }>(
      `SELECT "payload" FROM "cohort_text_artifacts" WHERE "id" = $1 AND "workspaceId" = $2`,
      [artifact.id, job.workspaceId]
    );
    if (!bytes.rows[0]) return false;
    const lessons = JSON.parse(
      bytes.rows[0].payload.toString('utf8')
    ) as CohortLesson[];
    const expected = computeAssemblyLessons(state, artifacts.chunks);
    if (
      !Array.isArray(lessons) ||
      lessons.length > 1_000 ||
      JSON.stringify(lessons) !== JSON.stringify(expected)
    ) {
      return false;
    }

    let nextSnapshot: CohortWorkspace;
    try {
      nextSnapshot = projectAcceptedBuildCompletion(state, {
        sources: artifacts.sources,
        understanding: artifacts.understanding,
        chunks: artifacts.chunks,
        analyses: artifacts.analyses,
        generatedLessons: lessons,
        generation: state.processing.generation,
        forceReadyJourneyStep: false,
      });
    } catch {
      return false;
    }

    const accepted = await sql.query<{ id: string }>(
      `UPDATE "cohort_text_jobs" SET "status" = 'accepted', "resultArtifactId" = $1, "claimToken" = NULL,
       "claimedBy" = NULL, "leaseExpiresAt" = NULL, "lastError" = NULL, "updatedAt" = $2
       WHERE "id" = $3 AND "status" = 'running' AND "claimToken" = $4 AND "leaseExpiresAt" > $2 RETURNING "id"`,
      [artifact.id, now, job.id, job.claimToken]
    );
    if (!accepted.rows[0]) return false;

    const baseRevision = Number(ws.rows[0].revision);
    const nextRevision = baseRevision + 1;
    await sql.query(
      `UPDATE "interaction_workspaces"
       SET "snapshot" = $1::jsonb, "revision" = $2, "sequence" = $2, "contextEpoch" = $2, "updatedAt" = $3
       WHERE "id" = $4`,
      [JSON.stringify(nextSnapshot), nextRevision, now, job.workspaceId]
    );
    await sql.query(
      `INSERT INTO "interaction_events" ("id", "workspaceId", "sequence", "protocolVersion", "type", "revision", "payload")
       VALUES ($1, $2, $3, 1, 'action.result', $3, $4::jsonb)`,
      [
        randomUUID(),
        job.workspaceId,
        nextRevision,
        JSON.stringify({
          actionId: `text-assembly:${job.id}:${job.attempts}`,
          status: 'applied',
          revision: nextRevision,
          baseRevision,
          summary: 'Text assembly accepted.',
          changed: [],
          invalidated: ['sources', 'chunks', 'analysis', 'curriculum'],
        }),
      ]
    );
    return true;
  });
}
```

---

### Step `S6` — Modify `src/shared/cohort-builder/contracts.ts`

- **Operation**: `MODIFY`
- **File Path**: `src/shared/cohort-builder/contracts.ts`
- **Baseline SHA-256**: `c7f6d9a3f8ec81031993f62f72910400a50b7d22041952bcafe757e35c232ba0`

#### Edit `S6.1` — Import state-machine guards and lifecycle normalizer
Replace this exact target block in `src/shared/cohort-builder/contracts.ts` (lines 1–9):

```ts
import { z } from 'zod';
import { entityRefSchema, type DomainActionPlan } from 'interaction-builder/core';
import { youtubeVideoUrlSchema, youtubeTrackSchema, youtubeTimeScopeSchema } from './youtube-transcript';
import { githubRepoUrlSchema, githubRefSchema, githubPathsSchema } from './github-source';
import { cohortSeoSchema } from './seo';
import { sha256 } from './hash';
import { canRunDeterministicPipeline, runDeterministicPipeline } from './client-pipeline';

const text = z.string().trim().min(1).max(4_000);
```

With this exact replacement block:

```ts
import { z } from 'zod';
import { entityRefSchema, type DomainActionPlan } from 'interaction-builder/core';
import { youtubeVideoUrlSchema, youtubeTrackSchema, youtubeTimeScopeSchema } from './youtube-transcript';
import { githubRepoUrlSchema, githubRefSchema, githubPathsSchema } from './github-source';
import { cohortSeoSchema } from './seo';
import { sha256 } from './hash';
import { canRunDeterministicPipeline, runDeterministicPipeline } from './client-pipeline';
import { isBuildComplete } from './creation-state';
import {
  canSwitchStartingPointBranch,
  normalizePostMutationLifecycle,
} from './creation-machine';

const text = z.string().trim().min(1).max(4_000);
```

#### Edit `S6.2` — Allow `choose_starting_point` branch switching from `ready` and `review` via `canSwitchStartingPointBranch`
Replace this exact target block in `src/shared/cohort-builder/contracts.ts` (lines 401–410):

```ts
    if (current.step === 'goal_setup' && action.choice === 'have_goal') {
      return navigationResult('Goal setup already active.');
    }
    if (['material_input', 'discovery', 'goal_setup'].includes(current.step)) {
      current.branch = action.choice === 'have_material' ? 'have_material' : 'find_material';
      current.step = action.choice === 'have_material' ? 'material_input' : 'discovery';
      return navigationResult('Starting point switched.');
    }
    throw new Error('INVALID_JOURNEY_TRANSITION');
  }
```

With this exact replacement block:

```ts
    if (current.step === 'goal_setup' && action.choice === 'have_goal') {
      return navigationResult('Goal setup already active.');
    }
    if (canSwitchStartingPointBranch(current.step)) {
      current.branch = action.choice === 'have_material' ? 'have_material' : 'find_material';
      current.step = action.choice === 'have_material' ? 'material_input' : 'discovery';
      return navigationResult('Starting point switched.');
    }
    throw new Error('INVALID_JOURNEY_TRANSITION');
  }
```

#### Edit `S6.3` — Use `isBuildComplete(next)` in `open_review` and normalize post-mutation lifecycle in `queueAfterPreferenceChange` and `queueProcessing`
Replace this exact target block in `src/shared/cohort-builder/contracts.ts` (lines 506–581):

```ts
  if (action.type === 'open_review') {
    const current = requireStep('ready', 'chat');
    if (current.step === 'ready') {
      if (next.processing.status !== 'ready' || !next.processing.sourceFingerprint || !next.lessons.length) {
        throw new Error('ASSEMBLY_NOT_READY');
      }
    } else {
      if (!next.lessons.length) throw new Error('NO_LESSONS');
      if (['queued', 'processing'].includes(next.processing.status) ||
          next.processing.jobs?.some(job => ['queued', 'running'].includes(job.status))) {
        throw new Error('PROCESSING_ACTIVE');
      }
      if (next.processing.status !== 'ready') {
        next.processing = { ...next.processing, status: 'ready', stage: 'done', error: null };
      }
    }
    current.step = 'review';
    return navigationResult('Curriculum review opened.');
  }
  if (next.journey && !next.journey.processingStarted && (action.type === 'retry_processing' || action.type === 'retry_text_job')) throw new Error('PROCESSING_NOT_STARTED');
  if (action.type === 'retry_text_job') {
    const job = next.processing.jobs?.find(item => item.id === action.jobId);
    if (!job || job.status !== 'failed' || !job.retryable) throw new Error('JOB_NOT_RETRYABLE');
    next.processing.status = 'queued'; next.processing.error = null;
    return { nextState: next, changed: [], invalidated: [], summary: 'Failed source job queued for retry.', undoable: false };
  }
  if (action.type === 'cancel_text_processing') {
    next.processing.status = 'idle';
    next.processing.error = null;
    return { nextState: next, changed: [], invalidated: [], summary: 'Source processing canceled.', undoable: false };
  }
  if(action.type==='cancel_source_processing') {
    const source=next.sources.find(item=>item.id===action.sourceId);if(!source) throw new Error('UNKNOWN_SOURCE');
    const expected=context.entityVersions.get(source.id);if(expected!==undefined && expected!==source.version) throw new Error('STALE_ENTITY');
    if(!next.processing.jobs?.some(job=>job.sourceId===source.id && ['queued','running','failed'].includes(job.status))) throw new Error('NO_ACTIVE_SOURCE_JOBS');
    return {nextState:next,changed:[],invalidated:[],summary:'Selected source processing stopped; other sources continue.',undoable:false};
  }
  const queueAfterPreferenceChange = (readyStage: 'analysis' | 'assembly') => {
    invalidateRelease();
    if (!next.sources.length || (next.journey && !next.journey.processingStarted)) return;
    const stage = next.processing.status === 'ready' ? readyStage : next.processing.status === 'failed' ? 'acquisition' : next.processing.stage;
    next.processing = { ...next.processing, status: 'queued', stage, generation: next.processing.generation + 1, error: null };
  };

  if (action.type === 'set_intent') { invalidateRelease(); if (next.intent !== action.intent && next.journey) { next.journey.intentVersion++; delete next.recommendations; delete next.discovery; } next.intent = action.intent; invalidated.push('curriculum'); queueAfterPreferenceChange('assembly'); return { nextState: next, changed: [], invalidated, summary: 'Learning intent updated.', undoable: true }; }
  if (action.type === 'set_audience') { invalidateRelease(); next.audience = action.audience; invalidated.push('analysis', 'curriculum'); queueAfterPreferenceChange('analysis'); return { nextState: next, changed: [], invalidated, summary: 'Audience updated.', undoable: true }; }
  if (action.type === 'set_daily_minutes') { invalidateRelease(); next.dailyMinutes = action.dailyMinutes; invalidated.push('curriculum'); queueAfterPreferenceChange('assembly'); return { nextState: next, changed: [], invalidated, summary: 'Daily learning time updated.', undoable: true }; }
  if (action.type === 'edit_presentation') {
    invalidateRelease();
    const { type: actionType, title, description, coverImage, ...presentation } = action;
    void actionType;
    if (title !== undefined) next.title = title;
    if (description !== undefined) next.description = description;
    const current = next.presentation ?? {};
    next.presentation = { ...current, ...presentation, ...(coverImage === null ? { coverImage: undefined } : coverImage !== undefined ? { coverImage } : {}) };
    return { nextState: next, changed: [], invalidated: ['release'], summary: 'Cohort presentation updated.', undoable: true };
  }
  if (action.type === 'set_season_title') {
    invalidateRelease();
    next.presentation = { ...(next.presentation ?? {}), seasonTitles: { ...(next.presentation?.seasonTitles ?? {}), [action.seasonKey]: action.title } };
    return { nextState: next, changed: [], invalidated: ['release'], summary: 'Season title updated.', undoable: true };
  }

  const queueProcessing = () => {
    if (next.journey && !next.journey.processingStarted) {
      next.processing = { ...next.processing, status: 'idle', stage: 'done', error: null };
      return;
    }
    if (canRunDeterministicPipeline(next)) {
      const processed = runDeterministicPipeline(next);
      Object.assign(next, processed);
      return;
    }
    next.processing = { status: 'queued', stage: 'acquisition', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
  };
```

With this exact replacement block:

```ts
  if (action.type === 'open_review') {
    const current = requireStep('ready', 'chat');
    if (current.step === 'ready') {
      if (!isBuildComplete(next)) {
        throw new Error('ASSEMBLY_NOT_READY');
      }
    } else {
      if (!next.lessons.length) throw new Error('NO_LESSONS');
      if (['queued', 'processing'].includes(next.processing.status) ||
          next.processing.jobs?.some(job => ['queued', 'running'].includes(job.status))) {
        throw new Error('PROCESSING_ACTIVE');
      }
      if (next.processing.status !== 'ready') {
        next.processing = { ...next.processing, status: 'ready', stage: 'done', error: null };
      }
    }
    current.step = 'review';
    return navigationResult('Curriculum review opened.');
  }
  if (next.journey && !next.journey.processingStarted && (action.type === 'retry_processing' || action.type === 'retry_text_job')) throw new Error('PROCESSING_NOT_STARTED');
  if (action.type === 'retry_text_job') {
    const job = next.processing.jobs?.find(item => item.id === action.jobId);
    if (!job || job.status !== 'failed' || !job.retryable) throw new Error('JOB_NOT_RETRYABLE');
    next.processing.status = 'queued'; next.processing.error = null;
    return { nextState: next, changed: [], invalidated: [], summary: 'Failed source job queued for retry.', undoable: false };
  }
  if (action.type === 'cancel_text_processing') {
    next.processing.status = 'idle';
    next.processing.error = null;
    return { nextState: next, changed: [], invalidated: [], summary: 'Source processing canceled.', undoable: false };
  }
  if(action.type==='cancel_source_processing') {
    const source=next.sources.find(item=>item.id===action.sourceId);if(!source) throw new Error('UNKNOWN_SOURCE');
    const expected=context.entityVersions.get(source.id);if(expected!==undefined && expected!==source.version) throw new Error('STALE_ENTITY');
    if(!next.processing.jobs?.some(job=>job.sourceId===source.id && ['queued','running','failed'].includes(job.status))) throw new Error('NO_ACTIVE_SOURCE_JOBS');
    return {nextState:next,changed:[],invalidated:[],summary:'Selected source processing stopped; other sources continue.',undoable:false};
  }
  const queueAfterPreferenceChange = (readyStage: 'analysis' | 'assembly') => {
    invalidateRelease();
    if (!next.sources.length || (next.journey && !next.journey.processingStarted)) return;
    const stage = next.processing.status === 'ready' ? readyStage : next.processing.status === 'failed' ? 'acquisition' : next.processing.stage;
    next.processing = { ...next.processing, status: 'queued', stage, generation: next.processing.generation + 1, error: null };
    normalizePostMutationLifecycle(next);
  };

  if (action.type === 'set_intent') { invalidateRelease(); if (next.intent !== action.intent && next.journey) { next.journey.intentVersion++; delete next.recommendations; delete next.discovery; } next.intent = action.intent; invalidated.push('curriculum'); queueAfterPreferenceChange('assembly'); return { nextState: next, changed: [], invalidated, summary: 'Learning intent updated.', undoable: true }; }
  if (action.type === 'set_audience') { invalidateRelease(); next.audience = action.audience; invalidated.push('analysis', 'curriculum'); queueAfterPreferenceChange('analysis'); return { nextState: next, changed: [], invalidated, summary: 'Audience updated.', undoable: true }; }
  if (action.type === 'set_daily_minutes') { invalidateRelease(); next.dailyMinutes = action.dailyMinutes; invalidated.push('curriculum'); queueAfterPreferenceChange('assembly'); return { nextState: next, changed: [], invalidated, summary: 'Daily learning time updated.', undoable: true }; }
  if (action.type === 'edit_presentation') {
    invalidateRelease();
    const { type: actionType, title, description, coverImage, ...presentation } = action;
    void actionType;
    if (title !== undefined) next.title = title;
    if (description !== undefined) next.description = description;
    const current = next.presentation ?? {};
    next.presentation = { ...current, ...presentation, ...(coverImage === null ? { coverImage: undefined } : coverImage !== undefined ? { coverImage } : {}) };
    return { nextState: next, changed: [], invalidated: ['release'], summary: 'Cohort presentation updated.', undoable: true };
  }
  if (action.type === 'set_season_title') {
    invalidateRelease();
    next.presentation = { ...(next.presentation ?? {}), seasonTitles: { ...(next.presentation?.seasonTitles ?? {}), [action.seasonKey]: action.title } };
    return { nextState: next, changed: [], invalidated: ['release'], summary: 'Season title updated.', undoable: true };
  }

  const queueProcessing = () => {
    if (next.journey && !next.journey.processingStarted) {
      next.processing = { ...next.processing, status: 'idle', stage: 'done', error: null };
      return;
    }
    if (canRunDeterministicPipeline(next)) {
      const processed = runDeterministicPipeline(next);
      Object.assign(next, processed);
      return;
    }
    next.processing = { status: 'queued', stage: 'acquisition', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
    normalizePostMutationLifecycle(next);
  };
```

#### Edit `S6.4` — Normalize lifecycle after `remove_source`
Replace this exact target block in `src/shared/cohort-builder/contracts.ts` (lines 768–775):

```ts
    if (next.journey && !next.journey.processingStarted) {
      next.processing = { ...next.processing, status: 'idle', stage: 'done', error: null };
    } else {
      next.processing = { status: next.sources.length ? 'queued' : 'idle', stage: next.sources.length ? 'acquisition' : 'done', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
    }
    return { nextState: next, changed: [], invalidated: ['sources', 'chunks', 'analysis', 'curriculum'], summary: `Removed source: ${source.label}`, undoable: true };
  }
```

With this exact replacement block:

```ts
    if (next.journey && !next.journey.processingStarted) {
      next.processing = { ...next.processing, status: 'idle', stage: 'done', error: null };
    } else {
      next.processing = { status: next.sources.length ? 'queued' : 'idle', stage: next.sources.length ? 'acquisition' : 'done', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
      normalizePostMutationLifecycle(next);
    }
    return { nextState: next, changed: [], invalidated: ['sources', 'chunks', 'analysis', 'curriculum'], summary: `Removed source: ${source.label}`, undoable: true };
  }
```

---

### Step `S7` — Modify `src/client/screens/cohortBuilder/stage-selectors.ts`

- **Operation**: `MODIFY`
- **File Path**: `src/client/screens/cohortBuilder/stage-selectors.ts`
- **Baseline SHA-256**: `5855c73ab90f59fe5b589268d5884a89cb5bb4d6cb6f746b776a810bab0c59cf`

#### Edit `S7.1` — Import `deriveActiveStage`, `deriveEffectiveStage`, and `BuilderStage` from `creation-view.ts`
Replace this exact target block in `src/client/screens/cohortBuilder/stage-selectors.ts` (lines 1–44):

```ts
import type {
  CohortWorkspace,
  CohortSource,
  CohortChunk,
} from '@/src/shared/cohort-builder/contracts';

export type CohortTextJob = NonNullable<CohortWorkspace['processing']['jobs']>[number];
export type CohortTextJobView = CohortTextJob;

export type CanonicalStage = 'understanding' | 'chunking' | 'analysis' | 'assembly';

export interface StageStatus {
  status: 'complete' | 'running' | 'failed' | 'canceled' | 'pending';
  completedCount: number;
  totalCount: number;
  failedCount: number;
  retryable: boolean;
  isCanceled: boolean;
}

export type StageProgressDetails = {
  understanding: StageStatus;
  chunking: StageStatus;
  analysis: StageStatus;
  assembly: StageStatus;
};

export type BuilderStage =
  | 'chat'
  | 'recommendations'
  | 'starting_point'
  | 'material_input'
  | 'discovery'
  | 'goal_setup'
  | 'intake'
  | 'understanding'
  | 'chunking'
  | 'analysis'
  | 'assembly'
  | 'curriculum'
  | 'review'
  | 'ready'
  | 'published';
```

With this exact replacement block:

```ts
import type {
  CohortWorkspace,
  CohortSource,
  CohortChunk,
} from '@/src/shared/cohort-builder/contracts';
import {
  deriveActiveStage,
  deriveEffectiveStage,
  type BuilderStage,
} from '@/src/shared/cohort-builder/creation-view';

export type { BuilderStage };
export type CohortTextJob = NonNullable<CohortWorkspace['processing']['jobs']>[number];
export type CohortTextJobView = CohortTextJob;

export type CanonicalStage = 'understanding' | 'chunking' | 'analysis' | 'assembly';

export interface StageStatus {
  status: 'complete' | 'running' | 'failed' | 'canceled' | 'pending';
  completedCount: number;
  totalCount: number;
  failedCount: number;
  retryable: boolean;
  isCanceled: boolean;
}

export type StageProgressDetails = {
  understanding: StageStatus;
  chunking: StageStatus;
  analysis: StageStatus;
  assembly: StageStatus;
};
```

#### Edit `S7.2` — Delegate `computeActiveStage` and `computeEffectiveStage` to `creation-view.ts`
Replace this exact target block in `src/client/screens/cohortBuilder/stage-selectors.ts` (lines 203–396):

```ts
function computeActiveStage(workspace: CohortWorkspace): BuilderStage {
  if (workspace.journey) {
    if (workspace.journey.step === 'chat') {
      return 'chat';
    }
    if (workspace.journey.step === 'recommendations') {
      return 'recommendations';
    }
    if (workspace.journey.step === 'starting_point') {
      return 'starting_point';
    }
    if (workspace.journey.step === 'material_input') {
      return 'material_input';
    }
    if (workspace.journey.step === 'discovery') {
      return 'discovery';
    }
    if (workspace.journey.step === 'goal_setup') {
      return 'goal_setup';
    }
    if (workspace.journey.step === 'ready') {
      return 'ready';
    }
    if (workspace.journey.step === 'review') {
      return 'review';
    }
    if (workspace.journey.step === 'published') {
      return 'published';
    }
    if (workspace.journey.step === 'processing') {
      const jobs = workspace.processing.jobs;
      if (jobs && jobs.length > 0) {
        const failedJobs = jobs.filter(j => j.status === 'failed');
        if (failedJobs.length > 0) {
          if (failedJobs.some(j => ['understanding', 'acquisition', 'extraction'].includes(j.stage))) {
            return 'understanding';
          }
          if (failedJobs.some(j => j.stage === 'chunking')) {
            return 'chunking';
          }
          if (failedJobs.some(j => j.stage === 'analysis')) {
            return 'analysis';
          }
          if (failedJobs.some(j => j.stage === 'assembly')) {
            return 'assembly';
          }
        }
        const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'queued');
        if (activeJobs.length > 0) {
          if (activeJobs.some(j => ['understanding', 'acquisition', 'extraction'].includes(j.stage))) {
            return 'understanding';
          }
          if (activeJobs.some(j => j.stage === 'chunking')) {
            return 'chunking';
          }
          if (activeJobs.some(j => j.stage === 'analysis')) {
            return 'analysis';
          }
          if (activeJobs.some(j => j.stage === 'assembly')) {
            return 'assembly';
          }
        }
      }
      switch (workspace.processing.stage) {
        case 'acquisition':
        case 'extraction':
        case 'understanding':
          return 'understanding';
        case 'chunking':
          return 'chunking';
        case 'analysis':
          return 'analysis';
        case 'assembly':
          return 'assembly';
        case 'done':
          return 'assembly';
      }
      return 'understanding';
    }
  }

  const sources = workspace.sources ?? [];
  const lessons = workspace.lessons ?? [];
  const processing = workspace.processing;

  // 1. If workspace.sources.length === 0 and lessons.length === 0: return 'intake'
  if (sources.length === 0 && lessons.length === 0) {
    return 'intake';
  }

  // 2. If workspace.processing.status === 'ready':
  if (processing.status === 'ready') {
    if (workspace.release && workspace.release.status !== 'draft') {
      return 'review';
    }
    return 'curriculum';
  }

  // 3. If workspace.processing.status === 'processing' | 'queued' | 'failed':
  if (
    processing.status === 'processing' ||
    processing.status === 'queued' ||
    processing.status === 'failed'
  ) {
    const jobs = processing.jobs;

    if (jobs && jobs.length > 0) {
      // Priority 1: Check for failed jobs
      const failedJobs = jobs.filter(j => j.status === 'failed');
      if (failedJobs.length > 0) {
        if (failedJobs.some(j => ['understanding', 'acquisition', 'extraction'].includes(j.stage))) {
          return 'understanding';
        }
        if (failedJobs.some(j => j.stage === 'chunking')) {
          return 'chunking';
        }
        if (failedJobs.some(j => j.stage === 'analysis')) {
          return 'analysis';
        }
        if (failedJobs.some(j => j.stage === 'assembly')) {
          return 'assembly';
        }
      }

      // Priority 2: Check for active jobs (running or queued)
      const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'queued');
      if (activeJobs.length > 0) {
        if (activeJobs.some(j => ['understanding', 'acquisition', 'extraction'].includes(j.stage))) {
          return 'understanding';
        }
        if (activeJobs.some(j => j.stage === 'chunking')) {
          return 'chunking';
        }
        if (activeJobs.some(j => j.stage === 'analysis')) {
          return 'analysis';
        }
        if (activeJobs.some(j => j.stage === 'assembly')) {
          return 'assembly';
        }
      }
    }

    // Fallback: If no jobs array or no active/failed jobs in the jobs array, use workspace.processing.stage
    switch (processing.stage) {
      case 'acquisition':
      case 'extraction':
      case 'understanding':
        return 'understanding';
      case 'chunking':
        return 'chunking';
      case 'analysis':
        return 'analysis';
      case 'assembly':
        return 'assembly';
      case 'done':
        return 'curriculum';
    }
  }

  // 4. Default: 'curriculum' if lessons exist, else 'intake'
  return lessons.length > 0 ? 'curriculum' : 'intake';
}

export function getActiveStage(workspace: CohortWorkspace): BuilderStage {
  return computeActiveStage(workspace);
}

/**
 * Pure selector returning the effective stage for navigation/inspection.
 * If inspectedStage is set, it overrides active stage without any side-effects.
 */
function computeEffectiveStage(
  workspace: CohortWorkspace,
  inspectedStage?: BuilderStage | null,
  drafts?: { isAnyDirtyOrOpen: () => boolean; editingStage: BuilderStage | null }
): BuilderStage {
  const active = getActiveStage(workspace);
  if (
    active === 'chat' ||
    active === 'recommendations' ||
    active === 'starting_point' ||
    active === 'material_input' ||
    active === 'discovery' ||
    active === 'goal_setup'
  ) {
    return active;
  }
  if (inspectedStage) return inspectedStage;
  if (drafts && drafts.isAnyDirtyOrOpen() && drafts.editingStage) {
    return drafts.editingStage;
  }
  return active;
}
```

With this exact replacement block:

```ts
function computeActiveStage(workspace: CohortWorkspace): BuilderStage {
  return deriveActiveStage(workspace);
}

export function getActiveStage(workspace: CohortWorkspace): BuilderStage {
  if (!workspace || typeof workspace !== 'object') {
    return computeActiveStage(workspace);
  }
  const cached = activeStageCache.get(workspace);
  if (cached !== undefined) {
    return cached;
  }
  const result = computeActiveStage(workspace);
  activeStageCache.set(workspace, result);
  return result;
}

/**
 * Pure selector returning the effective stage for navigation/inspection.
 * If inspectedStage is set, it overrides active stage without any side-effects.
 */
function computeEffectiveStage(
  workspace: CohortWorkspace,
  inspectedStage?: BuilderStage | null,
  drafts?: { isAnyDirtyOrOpen: () => boolean; editingStage: BuilderStage | null }
): BuilderStage {
  return deriveEffectiveStage(workspace, inspectedStage, drafts);
}
```

---

### Step `S8` — Modify `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx`

- **Operation**: `MODIFY` (Full File Replacement)
- **File Path**: `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx`
- **Baseline SHA-256**: `eebde9f0716d5e42d1bf8122d33c7d79694a7e4cb1663b24124b1e86ed636c3b`
- **Action**: Replace the entire contents of `src/client/screens/cohortBuilder/CohortWorkspacePane.tsx` with the following exact full file contents:

```tsx
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Check, AlertCircle, ArrowLeft } from 'lucide-react';
import {
  useWorkspaceView,
  useDispatchAction,
  useInteractionState,
} from '@/src/client/interaction/hooks';
import {
  cohortWorkspaceSchema,
  type CohortWorkspace,
  type CohortAction,
} from '@/src/shared/cohort-builder/contracts';
import {
  STEP_TO_STAGE_MAP,
  deriveCreationViewModel,
  deriveProcessingProgress,
  type ProcessingStep,
  type ProcessingProgress,
} from '@/src/shared/cohort-builder/creation-view';
import type { EntityRef } from 'interaction-builder/core';
import styles from './CohortBuilder.module.css';
import startingStyles from '@/src/client/screens/cohortCreation/components/StartingPoint.module.css';

import { UnderstandingStageView } from './stages/UnderstandingStageView';
import { ChunkingStageView } from './stages/ChunkingStageView';
import { AnalysisStageView } from './stages/AnalysisStageView';
import { AssemblyStageView } from './stages/AssemblyStageView';
import { CurriculumStageView } from './stages/CurriculumStageView';
import { IntakeStageView } from './stages/IntakeStageView';
import { RecommendationsStageView } from './stages/RecommendationsStageView';
import { StartingPointStageView } from './stages/StartingPointStageView';
import { MaterialStageView } from './stages/MaterialStageView';
import { DiscoveryStageView } from './stages/DiscoveryStageView';
import { CohortDraftProvider, useCohortDrafts } from './draft-context';
import {
  getActiveStage,
  getEffectiveStage,
  type BuilderStage,
} from './stage-selectors';

import { ReadyStageView } from './stages/ReadyStageView';

const PublicationStageView = dynamic(
  () =>
    import('./stages/PublicationStageView').then(m => m.PublicationStageView),
  { ssr: false }
);

export type Stage = BuilderStage;
export type { ProcessingStep, ProcessingProgress };
export { getActiveStage, getEffectiveStage };

export function getProcessingProgress(
  workspace: CohortWorkspace
): ProcessingProgress {
  return deriveProcessingProgress(workspace);
}

interface CohortWorkspacePaneProps {
  workspaceId?: string;
  ownerId?: string;
  onSelectLessonForChat: (attached: { entity: EntityRef; label: string }) => void;
  onNavigateToDestination?: (url: string) => void;
}

export function CohortWorkspacePane(props: CohortWorkspacePaneProps) {
  const interactionState = useInteractionState<CohortWorkspace>();
  const workspaceId =
    props.workspaceId ?? interactionState?.workspaceId ?? '';
  return (
    <CohortDraftProvider workspaceId={workspaceId} ownerId={props.ownerId}>
      <InnerCohortWorkspacePane {...props} />
    </CohortDraftProvider>
  );
}

function InnerCohortWorkspacePane({
  workspaceId: propWorkspaceId,
  ownerId: propOwnerId,
  onSelectLessonForChat,
  onNavigateToDestination,
}: CohortWorkspacePaneProps) {
  const drafts = useCohortDrafts();
  const interactionState = useInteractionState<CohortWorkspace>();
  const workspaceId =
    propWorkspaceId ?? interactionState?.workspaceId ?? '';
  const rawWorkspace = useWorkspaceView<CohortWorkspace>();
  const parsed = rawWorkspace
    ? cohortWorkspaceSchema.safeParse(rawWorkspace)
    : null;
  const workspace = parsed?.success
    ? parsed.data
    : (rawWorkspace as CohortWorkspace | null);
  const dispatchAction = useDispatchAction<CohortAction>();

  const [inspectedStage, setInspectedStage] = useState<Stage | null>(null);

  if (!workspace) {
    return <div className={styles.rightPane}>Loading workspace state...</div>;
  }

  const viewModel = deriveCreationViewModel(workspace, inspectedStage, drafts);
  const {
    progress,
    effectiveInspectedStage,
    effectiveStage,
    hideStepper,
  } = viewModel;

  return (
    <main
      className={styles.rightPane}
      aria-label="Cohort Curriculum Workspace"
    >
      {/* Stepper Navigation */}
      {!hideStepper && (
        <div className={styles.stepperNav}>
          <ol
            className={styles.creationSteps}
            aria-label="Creation journey progress"
          >
            {progress.steps.map((step, index) => {
              const stepStage = STEP_TO_STAGE_MAP[step.label];
              const isInspected = effectiveInspectedStage === stepStage;
              const isCurrent = effectiveInspectedStage
                ? isInspected
                : step.isCurrent;
              const isAccessible =
                step.isComplete || step.isCurrent || step.isFailed;
              return (
                <li
                  key={step.label}
                  role="button"
                  tabIndex={isAccessible ? 0 : -1}
                  aria-disabled={!isAccessible || undefined}
                  data-disabled={!isAccessible || undefined}
                  aria-current={isCurrent ? 'step' : undefined}
                  data-complete={step.isComplete}
                  data-failed={step.isFailed || undefined}
                  data-inspected={isInspected || undefined}
                  onClick={() => {
                    if (!isAccessible) return;
                    setInspectedStage(current =>
                      current === stepStage ? null : stepStage
                    );
                  }}
                  onKeyDown={e => {
                    if (!isAccessible) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setInspectedStage(current =>
                        current === stepStage ? null : stepStage
                      );
                    }
                  }}
                  style={{
                    cursor: isAccessible ? 'pointer' : 'not-allowed',
                    opacity: isAccessible ? 1 : 0.45,
                  }}
                >
                  <span>
                    {step.isComplete ? (
                      <Check size={13} aria-label="Complete" />
                    ) : step.isFailed ? (
                      <AlertCircle size={13} aria-label="Failed" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  {step.label}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Stage Inspection Banner */}
      {!hideStepper && inspectedStage && (
        <div
          data-testid="stage-inspection-banner"
          className={styles.inspectingBanner}
          role="status"
        >
          <span>
            Inspecting <strong>{inspectedStage}</strong> stage.
          </span>
          <button
            type="button"
            className={styles.resetStageBtn}
            aria-label="Reset to active stage"
            onClick={() => setInspectedStage(null)}
          >
            Return to active stage
          </button>
        </div>
      )}

      {/* Top starting point tabs for material_input */}
      {effectiveStage === 'material_input' && (
        <nav aria-label="Starting point" className={startingStyles.compact}>
          <button
            type="button"
            onClick={() =>
              void dispatchAction({ type: 'back_to_starting_point' })
            }
            aria-label="Back to starting point"
          >
            <ArrowLeft size={16} />
          </button>
          {[
            {
              value: 'have_material' as const,
              label: 'I already have material',
            },
            { value: 'find_material' as const, label: 'Start with a goal' },
          ].map(choice => (
            <button
              key={choice.value}
              type="button"
              aria-pressed={
                (workspace.journey?.branch ?? 'have_material') === choice.value
              }
              onClick={async () => {
                if (workspace.journey?.branch === choice.value) return;
                const backed = await dispatchAction({
                  type: 'back_to_starting_point',
                });
                if (!backed) return;
                await dispatchAction({
                  type: 'choose_starting_point',
                  choice: choice.value,
                });
              }}
            >
              {choice.label}
            </button>
          ))}
        </nav>
      )}

      {/* Stage Specific Views */}
      {effectiveStage === 'recommendations' && (
        <RecommendationsStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'starting_point' && (
        <StartingPointStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'material_input' && (
        <MaterialStageView
          workspace={workspace}
          workspaceId={workspaceId}
          revision={interactionState?.revision}
          ownerId={propOwnerId}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'discovery' && (
        <DiscoveryStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'goal_setup' && (
        <DiscoveryStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'intake' && (
        <IntakeStageView
          workspace={workspace}
          needsRebuild={progress.needsRebuild}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'understanding' && (
        <UnderstandingStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'chunking' && (
        <ChunkingStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'analysis' && (
        <AnalysisStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'assembly' && (
        <AssemblyStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'ready' && (
        <ReadyStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {(effectiveStage === 'curriculum' || effectiveStage === 'review') && (
        <CurriculumStageView
          workspace={workspace}
          workspaceId={workspaceId}
          revision={interactionState?.revision}
          needsRebuild={progress.needsRebuild}
          dispatchAction={dispatchAction}
          onSelectLessonForChat={onSelectLessonForChat}
          onNavigateToDestination={onNavigateToDestination}
        />
      )}
      {effectiveStage === 'published' && (
        <PublicationStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
          onNavigateToDestination={onNavigateToDestination}
        />
      )}
    </main>
  );
}
```

---

### Step `S9` — Modify `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx`

- **Operation**: `MODIFY` (Full File Replacement)
- **File Path**: `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx`
- **Baseline SHA-256**: `a953281a155b7584ce1d8fafe1efd58085b80789398a08c758d7b22ff47ab102`
- **Action**: Replace the entire contents of `src/client/screens/cohortBuilder/stages/ReadyStageView.tsx` with the following exact full file contents:

```tsx
'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  FileText,
  Layers,
  Lock,
  Sparkles,
  Target,
} from 'lucide-react';
import type {
  CohortAction,
  CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import { deriveReadyStageViewModel } from '@/src/shared/cohort-builder/creation-view';
import type { ExpectedVersion } from '@/src/client/interaction/transport';
import styles from './ReadyStageView.module.css';

export interface ReadyStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (
    action: CohortAction,
    expectedEntities?: ExpectedVersion[]
  ) => Promise<boolean>;
}

const FEATURES = [
  {
    icon: Layers,
    title: 'Learning pieces',
    text: 'Your material has been organized into clear learning units.',
  },
  {
    icon: BookOpen,
    title: 'Source evidence',
    text: 'Relevant passages and references stay attached to each concept.',
  },
  {
    icon: Target,
    title: 'Learning objectives',
    text: 'Each lesson includes a concrete takeaway to focus your study.',
  },
  {
    icon: Lock,
    title: 'Private by default',
    text: 'This cohort is set up for your personal feed until you choose to publish.',
  },
] as const;

const NOTES = [
  {
    icon: FileText,
    title: 'Your material',
    text: 'Everything comes directly from the sources you attached.',
  },
  {
    icon: Clock,
    title: 'Your own pace',
    text: 'Move through lessons whenever you have a focused window.',
  },
  {
    icon: Sparkles,
    title: 'Review first, if you like',
    text: 'Inspect lessons, adjust titles, or pin key objectives before publishing.',
  },
] as const;

export function ReadyStageView({
  workspace,
  dispatchAction,
}: ReadyStageViewProps) {
  const [busy, setBusy] = useState(false);
  const viewModel = deriveReadyStageViewModel(workspace);

  const act = async (
    work: () => Promise<unknown>,
    requiresReady = true
  ) => {
    if (busy || (requiresReady && !viewModel.isReady)) return;
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = () =>
    act(async () => {
      const prepared = await dispatchAction({
        type: 'prepare_release',
        mode: 'private_activation',
      });
      if (!prepared) return;
      await dispatchAction({ type: 'open_review' });
    });

  const handleReview = () =>
    act(() => dispatchAction({ type: 'open_review' }));

  const handleBack = async () => {
    const backed = await dispatchAction({ type: 'back_to_starting_point' });
    if (!backed) return;
    await dispatchAction({
      type: 'choose_starting_point',
      choice: 'have_material',
    });
  };

  return (
    <section className={styles.stage} aria-label="Curriculum ready">
      <div className={styles.rays} aria-hidden="true">
        {Array.from({ length: 8 }).map((_, index) => (
          <span key={index} className={styles.ray} />
        ))}
      </div>

      <header className={styles.header}>
        <div className={styles.checkBadge} aria-hidden="true">
          <Check size={28} />
        </div>
        <span className={styles.eyebrow}>{viewModel.eyebrow}</span>
        <h1 className={styles.title}>
          <em>{viewModel.heading}</em>
        </h1>
        <p className={styles.subtitle}>{viewModel.subtitle}</p>
      </header>

      <article className={styles.materialCard} aria-label="Material summary">
        <div className={styles.materialIcon} aria-hidden="true">
          <FileText size={20} />
        </div>
        <div className={styles.materialBody}>
          <h2>{workspace.title || workspace.intent}</h2>
          <p>
            {viewModel.sourceCount}{' '}
            {viewModel.sourceCount === 1 ? 'source' : 'sources'} ·{' '}
            {viewModel.chunkCount} learning pieces · {viewModel.lessonCount}{' '}
            {viewModel.lessonCount === 1 ? 'lesson' : 'lessons'}
          </p>
        </div>
        <span className={styles.processedBadge}>
          <Check size={13} aria-hidden="true" />
          {viewModel.badgeLabel}
        </span>
      </article>

      <section
        className={styles.section}
        aria-labelledby="ready-included-heading"
      >
        <span id="ready-included-heading" className={styles.sectionLabel}>
          What’s included
        </span>
        <div className={styles.featureGrid}>
          {FEATURES.map(feature => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className={styles.featureCard}>
                <div className={styles.featureIcon} aria-hidden="true">
                  <Icon size={18} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <div className={styles.notesRow} aria-label="Experience notes">
        {NOTES.map(note => {
          const Icon = note.icon;
          return (
            <div key={note.title} className={styles.noteItem}>
              <Icon size={16} aria-hidden="true" />
              <div>
                <strong>{note.title}</strong>
                <span>{note.text}</span>
              </div>
            </div>
          );
        })}
      </div>

      <footer className={styles.actions}>
        <button
          type="button"
          className={styles.primaryAction}
          disabled={!viewModel.canActivate || busy}
          onClick={handleActivate}
        >
          Go to my feed
          <ArrowRight size={17} aria-hidden="true" />
        </button>
        <div className={styles.secondaryActions}>
          <button
            type="button"
            className={styles.secondaryAction}
            disabled={!viewModel.canReview || busy}
            onClick={handleReview}
          >
            Review cohort
          </button>
          <button
            type="button"
            className={styles.ghostAction}
            disabled={!viewModel.canReturnToMaterial || busy}
            onClick={() => act(handleBack, false)}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back to material
          </button>
        </div>
      </footer>
    </section>
  );
}
```

---

### Step `S10` — Create `src/shared/cohort-builder/__tests__/creation-machine.test.ts`

- **Operation**: `CREATE`
- **File Path**: `src/shared/cohort-builder/__tests__/creation-machine.test.ts`
- **Action**: Create `src/shared/cohort-builder/__tests__/creation-machine.test.ts` with the following exact full file contents:

```ts
import { describe, expect, it } from 'vitest';
import {
  cohortWorkspaceSchema,
  planCohortAction,
  type CohortActionContext,
  type CohortWorkspace,
} from '../contracts';
import { initialCohort } from '../intake';
import {
  computeBuildInputFingerprint,
  computeSourceEvidenceFingerprint,
  deriveCreationMachineState,
  isBuildComplete,
  isBuildStale,
  validateWorkspaceInvariants,
} from '../creation-state';
import {
  canSwitchStartingPointBranch,
  getCreationCapabilities,
  projectAcceptedBuildCompletion,
} from '../creation-machine';
import {
  deriveActiveStage,
  deriveCreationViewModel,
  deriveReadyStageViewModel,
} from '../creation-view';
import {
  buildGeneratedLessons,
  runDeterministicPipeline,
  splitSource,
} from '../client-pipeline';
import { extractSourceConceptTopics } from '../cohort-metadata';
import { sha256 } from '../hash';

const workspaceId = '00000000-0000-4000-8000-000000000099';

function createContext(
  overrides?: Partial<CohortActionContext>
): CohortActionContext {
  return {
    actionId: 'act-machine-1',
    workspaceId,
    expectedRevision: 0,
    currentRevision: 0,
    entityVersions: new Map(),
    ...overrides,
  };
}

function createReadySourceWorkspace(): CohortWorkspace {
  const ws = initialCohort('Master Distributed Consensus');
  ws.audience = 'Systems Engineers';
  ws.dailyMinutes = 30;
  ws.journey = {
    version: 1,
    step: 'material_input',
    branch: 'have_material',
    processingStarted: false,
    intentVersion: 0,
  };
  ws.sources = [
    {
      id: 'src-raft',
      version: 0,
      label: 'Raft Paper Notes',
      text: 'Raft achieves consensus via leader election and log replication. Quorums overlap on every committed entry.',
      checksum: sha256(
        'Raft achieves consensus via leader election and log replication. Quorums overlap on every committed entry.'
      ),
      state: 'ready',
      locations: [{ start: 0, end: 105 }],
    },
  ];
  return ws;
}

describe('Cohort Creation State Machine (creation-state, creation-machine, creation-view)', () => {
  describe('R1: Orthogonal State Regions, Fingerprints & Invariant Validation', () => {
    it('computes distinct source-evidence and build-input fingerprints that change when intent, audience, or dailyMinutes change', () => {
      const ws1 = createReadySourceWorkspace();
      const ws2 = structuredClone(ws1);
      ws2.intent = 'Master Byzantine Fault Tolerance';

      const ws3 = structuredClone(ws1);
      ws3.audience = 'Staff Architects';

      const ws4 = structuredClone(ws1);
      ws4.dailyMinutes = 45;

      // Source evidence fingerprint depends only on [id, version, text]
      expect(computeSourceEvidenceFingerprint(ws1)).toBe(
        computeSourceEvidenceFingerprint(ws2)
      );
      expect(computeSourceEvidenceFingerprint(ws1)).toBe(
        computeSourceEvidenceFingerprint(ws3)
      );

      // Build input fingerprint changes whenever pedagogical parameters change
      const fp1 = computeBuildInputFingerprint(ws1);
      expect(computeBuildInputFingerprint(ws2)).not.toBe(fp1);
      expect(computeBuildInputFingerprint(ws3)).not.toBe(fp1);
      expect(computeBuildInputFingerprint(ws4)).not.toBe(fp1);
    });

    it('detects contradictory workspace snapshots in validateWorkspaceInvariants', () => {
      const ws = runDeterministicPipeline(createReadySourceWorkspace());
      expect(validateWorkspaceInvariants(ws)).toEqual({
        valid: true,
        violations: [],
      });

      // Contradiction 1: step === 'ready' with queued processing
      const queuedOnReady: CohortWorkspace = {
        ...ws,
        processing: {
          ...ws.processing,
          status: 'queued',
          stage: 'assembly',
        },
      };
      const report1 = validateWorkspaceInvariants(queuedOnReady);
      expect(report1.valid).toBe(false);
      expect(report1.violations).toContain('READY_WITHOUT_COMPLETE_BUILD');

      // Contradiction 2: processing.status === 'ready' without sourceFingerprint
      const missingFp: CohortWorkspace = {
        ...ws,
        processing: {
          ...ws.processing,
          sourceFingerprint: null,
        },
      };
      const report2 = validateWorkspaceInvariants(missingFp);
      expect(report2.valid).toBe(false);
      expect(report2.violations).toContain('READY_WITHOUT_COMPLETE_BUILD');
      expect(report2.violations).toContain('READY_STATUS_WITHOUT_FINGERPRINT');

      // Contradiction 3: step === 'published' with draft release
      const fakePublished: CohortWorkspace = {
        ...ws,
        journey: { ...ws.journey!, step: 'published' },
        release: { status: 'draft' },
      };
      const report3 = validateWorkspaceInvariants(fakePublished);
      expect(report3.valid).toBe(false);
      expect(report3.violations).toContain('PUBLISHED_WITHOUT_RELEASE');
    });
  });

  describe('R2: Fast vs Durable Build Completion Parity', () => {
    it('produces identical completed curriculum state through runDeterministicPipeline and projectAcceptedBuildCompletion', () => {
      const base = createReadySourceWorkspace();
      base.journey!.step = 'processing';
      base.journey!.processingStarted = true;
      base.processing.generation = 2;

      const fastResult = runDeterministicPipeline(base);

      const chunks = base.sources.flatMap(splitSource);
      const understanding = base.sources.map(source => ({
        sourceId: source.id,
        sourceVersion: source.version,
        topics: extractSourceConceptTopics(source),
      }));
      const analyses = chunks.map(chunk => ({
        chunkId: chunk.id,
        summary: chunk.text.slice(0, 300),
        question: `How would you apply this passage: ${chunk.text.slice(0, 160)}?`,
      }));
      const workingForLessons: CohortWorkspace = {
        ...structuredClone(base),
        chunks,
        analyses,
      };
      const generatedLessons = buildGeneratedLessons(workingForLessons);

      const durableResult = projectAcceptedBuildCompletion(base, {
        sources: base.sources.map(s => ({
          id: s.id,
          version: s.version,
          checksum: sha256(s.text),
        })),
        understanding,
        chunks,
        analyses,
        generatedLessons,
        generation: base.processing.generation + 1,
        driver: 'durable',
        forceReadyJourneyStep: false,
      });

      expect(durableResult.lessons).toEqual(fastResult.lessons);
      expect(durableResult.chunks).toEqual(fastResult.chunks);
      expect(durableResult.understanding).toEqual(fastResult.understanding);
      expect(durableResult.analyses).toEqual(fastResult.analyses);
      expect(durableResult.title).toBe(fastResult.title);
      expect(durableResult.description).toBe(fastResult.description);
      expect(durableResult.seo).toEqual(fastResult.seo);
      expect(durableResult.processing.sourceFingerprint).toBe(
        fastResult.processing.sourceFingerprint
      );
      expect(durableResult.journey?.step).toBe('ready');
      expect(isBuildComplete(durableResult)).toBe(true);
      expect(isBuildComplete(fastResult)).toBe(true);
    });
  });

  describe('R3 & R4: Post-Mutation Lifecycle Normalization & Direct Branch Switching', () => {
    it('transitions journey.step from ready to processing when set_intent, set_audience, set_daily_minutes, or add_web_source queues a rebuild', () => {
      const readyWs = runDeterministicPipeline(createReadySourceWorkspace());
      expect(readyWs.journey?.step).toBe('ready');
      expect(isBuildComplete(readyWs)).toBe(true);

      // 1. set_intent after ready
      const afterIntent = planCohortAction(
        readyWs,
        { type: 'set_intent', intent: 'Learn Paxos and Viewstamped Replication' },
        createContext()
      ).nextState;
      expect(afterIntent.processing.status).toBe('queued');
      expect(afterIntent.processing.stage).toBe('assembly');
      expect(afterIntent.journey?.step).toBe('processing');
      expect(deriveActiveStage(afterIntent)).toBe('assembly');

      // 2. set_audience after ready
      const afterAudience = planCohortAction(
        readyWs,
        { type: 'set_audience', audience: 'Principal Engineers' },
        createContext()
      ).nextState;
      expect(afterAudience.processing.status).toBe('queued');
      expect(afterAudience.processing.stage).toBe('analysis');
      expect(afterAudience.journey?.step).toBe('processing');
      expect(deriveActiveStage(afterAudience)).toBe('analysis');

      // 3. set_daily_minutes after ready
      const afterMinutes = planCohortAction(
        readyWs,
        { type: 'set_daily_minutes', dailyMinutes: 45 },
        createContext()
      ).nextState;
      expect(afterMinutes.processing.status).toBe('queued');
      expect(afterMinutes.processing.stage).toBe('assembly');
      expect(afterMinutes.journey?.step).toBe('processing');

      // 4. add_web_source after ready
      const afterWebSource = planCohortAction(
        readyWs,
        {
          type: 'add_web_source',
          sourceId: 'src-web-2',
          label: 'Raft Visualization',
          url: 'https://raft.github.io',
        },
        createContext()
      ).nextState;
      expect(afterWebSource.processing.status).toBe('queued');
      expect(afterWebSource.processing.stage).toBe('acquisition');
      expect(afterWebSource.journey?.step).toBe('processing');
      expect(deriveActiveStage(afterWebSource)).toBe('understanding');
    });

    it('returns journey.step to material_input with processingStarted=false if the last source is removed from ready or processing', () => {
      const readyWs = runDeterministicPipeline(createReadySourceWorkspace());
      const afterRemoveAll = planCohortAction(
        readyWs,
        { type: 'remove_source', sourceId: 'src-raft' },
        createContext()
      ).nextState;

      expect(afterRemoveAll.sources).toHaveLength(0);
      expect(afterRemoveAll.processing.status).toBe('idle');
      expect(afterRemoveAll.journey?.step).toBe('material_input');
      expect(afterRemoveAll.journey?.processingStarted).toBe(false);
      expect(deriveActiveStage(afterRemoveAll)).toBe('material_input');
    });

    it('allows direct choose_starting_point transition from ready and review while rejecting processing and published', () => {
      expect(canSwitchStartingPointBranch('ready')).toBe(true);
      expect(canSwitchStartingPointBranch('review')).toBe(true);
      expect(canSwitchStartingPointBranch('processing')).toBe(false);
      expect(canSwitchStartingPointBranch('published')).toBe(false);

      const readyWs = runDeterministicPipeline(createReadySourceWorkspace());
      const toMaterial = planCohortAction(
        readyWs,
        { type: 'choose_starting_point', choice: 'have_material' },
        createContext()
      ).nextState;
      expect(toMaterial.journey?.step).toBe('material_input');
      expect(toMaterial.journey?.branch).toBe('have_material');

      const toDiscovery = planCohortAction(
        readyWs,
        { type: 'choose_starting_point', choice: 'find_material' },
        createContext()
      ).nextState;
      expect(toDiscovery.journey?.step).toBe('discovery');
      expect(toDiscovery.journey?.branch).toBe('find_material');
    });
  });

  describe('R5 & R6: View Model Consistency & Contradictory Snapshot Recovery', () => {
    it('routes contradictory step=ready snapshots with queued/failed processing to the active processing stage', () => {
      const readyWs = runDeterministicPipeline(createReadySourceWorkspace());
      const contradictoryQueued: CohortWorkspace = {
        ...readyWs,
        processing: {
          status: 'queued',
          stage: 'chunking',
          generation: 3,
          sourceFingerprint: null,
          error: null,
        },
      };

      // Instead of trapping the user on 'ready', deriveActiveStage routes to 'chunking'
      expect(deriveActiveStage(contradictoryQueued)).toBe('chunking');

      // And ReadyStageViewModel truthfully reports not-ready if mounted directly
      const readyVm = deriveReadyStageViewModel(contradictoryQueued);
      expect(readyVm.isReady).toBe(false);
      expect(readyVm.canActivate).toBe(false);
      expect(readyVm.canReview).toBe(false);
      expect(readyVm.canReturnToMaterial).toBe(true);
      expect(readyVm.heading).toBe('In progress.');
      expect(readyVm.badgeLabel).toBe('Build not complete');
    });

    it('derives complete CreationViewModel and CreationMachineState for a ready workspace', () => {
      const readyWs = runDeterministicPipeline(createReadySourceWorkspace());
      const machineState = deriveCreationMachineState(readyWs);
      const viewModel = deriveCreationViewModel(readyWs, null);

      expect(machineState.build.status).toBe('ready');
      expect(machineState.build.isBuildComplete).toBe(true);
      expect(machineState.build.isBuildStale).toBe(false);
      expect(machineState.invariants.valid).toBe(true);

      expect(viewModel.activeStage).toBe('ready');
      expect(viewModel.effectiveStage).toBe('ready');
      expect(viewModel.readyStage.isReady).toBe(true);
      expect(viewModel.readyStage.canActivate).toBe(true);
      expect(viewModel.readyStage.canReview).toBe(true);
      expect(viewModel.readyStage.heading).toBe('All set.');
      expect(viewModel.readyStage.badgeLabel).toBe('Processed');
      expect(viewModel.progress.steps.every(s => s.isComplete)).toBe(true);
      expect(viewModel.progress.needsRebuild).toBe(false);
    });

    it('flags isBuildStale when a source is pending or processing was canceled', () => {
      const readyWs = runDeterministicPipeline(createReadySourceWorkspace());
      const staleWs: CohortWorkspace = {
        ...readyWs,
        sources: [
          {
            ...readyWs.sources[0],
            state: 'stale',
          },
        ],
        processing: {
          ...readyWs.processing,
          status: 'idle',
          error: 'PROCESSING_CANCELED',
        },
      };

      expect(isBuildComplete(staleWs)).toBe(false);
      expect(isBuildStale(staleWs)).toBe(true);
      const capabilities = getCreationCapabilities(staleWs);
      expect(capabilities.canOpenReview).toBe(false);
      expect(capabilities.canPreparePrivateRelease).toBe(false);
    });
  });
});
```

---

## E. Verification and Failure Handling

Execute the following verification commands from `D:/ThisPC/Documents/SideQuestHQ/undone-site` in PowerShell in strict order.

### `V1` — New State-Machine Unit Test Suite
```powershell
npx vitest run src/shared/cohort-builder/__tests__/creation-machine.test.ts
```
- **Expected Result**: Exit code `0`, all tests in `creation-machine.test.ts` pass.

### `V2` — Core Cohort Builder Domain, Pipeline, and UI Test Suites
```powershell
npx vitest run src/shared/cohort-builder/__tests__/client-pipeline.test.ts src/shared/cohort-builder/__tests__/journey-actions.test.ts src/server/domain/cohort-builder/__tests__/text-assembly-acceptance.test.ts src/server/domain/cohort-builder/__tests__/text-pipeline.test.ts src/server/domain/cohort-builder/__tests__/journey-checkpoint5-integration.test.ts src/client/screens/cohortBuilder/__tests__/stage-selectors.test.ts src/client/screens/cohortBuilder/__tests__/stage-canonical-progress.test.ts src/client/screens/cohortBuilder/__tests__/CohortWorkspacePane.test.tsx src/client/screens/cohortBuilder/__tests__/ready-stage-view.test.tsx src/client/screens/cohortBuilder/__tests__/journey-checkpoint5-processing.test.tsx src/client/screens/cohortBuilder/__tests__/journey-checkpoint5-review.test.tsx
```
- **Expected Result**: Exit code `0`, all 11 test files pass with zero failures.

### `V3` — TypeScript Typecheck (`tsc --noEmit`)
```powershell
npx tsc --noEmit --incremental false
```
- **Expected Result**: Exit code `0`, zero diagnostics output.

### `V4` — ESLint Check on All Created & Modified Files
```powershell
npx eslint src/shared/cohort-builder/creation-state.ts src/shared/cohort-builder/creation-machine.ts src/shared/cohort-builder/creation-view.ts src/shared/cohort-builder/client-pipeline.ts src/shared/cohort-builder/contracts.ts src/server/domain/cohort-builder/text-assembly-acceptance.ts src/client/screens/cohortBuilder/stage-selectors.ts src/client/screens/cohortBuilder/CohortWorkspacePane.tsx src/client/screens/cohortBuilder/stages/ReadyStageView.tsx src/shared/cohort-builder/__tests__/creation-machine.test.ts
```
- **Expected Result**: Exit code `0`, zero errors and zero warnings.

### `V5` — Git Diff Hygiene & Full Repository Vitest Run
```powershell
git diff --check
npx vitest run
```
- **Expected Result**: `git diff --check` exits `0` with no whitespace/conflict issues; full repository Vitest run passes all 151 test files (`150` existing + `1` new).

### `V6` — Full 5-Stage Vercel Deployment Verification
```powershell
npm run verify:vercel
```
- **Expected Result**: Exit code `0`, passing Prisma validate, TypeScript check, Next.js production webpack build, route contract check, and runtime smoke test.

### Failure Handling & Recovery Protocol
- **If Pre-Flight Baseline Check fails**: Stop before modifying any file. Report the mismatched file path and SHA-256 digest.
- **If an edit target anchor in `S4`–`S9` does not match**: Normalize CRLF to LF on the target file only if line endings caused the mismatch, re-verify the SHA-256 content, and apply the exact block. Never guess or approximate replacement boundaries.
- **If any verification `V1`–`V6` fails**: Inspect the exact compiler/test diagnostic, verify that Steps `S1`–`S10` were applied verbatim without omissions, fix only the discrepancy against the specification in Section D, and re-run all verifications from `V1`.

---

## F. Completion Report Contract

Upon completing execution of this guide, the implementing agent must return a structured report containing:

1. **Execution Status**: `COMPLETE` or `BLOCKED` (with failing step ID if blocked).
2. **Step Application Table**: Status (`APPLIED` / `SKIPPED` / `FAILED`) and post-change SHA-256 digest for each file in `S1`–`S10`.
3. **Verification Results Table**: Exit code, duration, and summary for `V1`, `V2`, `V3`, `V4`, `V5`, and `V6`.
4. **Requirement Coverage Confirmation**: Confirmation that `R1` through `R7` are satisfied with test counts.
5. **Unplanned Deviations**: Explicit `None` (or exact description if any recovery was required).
