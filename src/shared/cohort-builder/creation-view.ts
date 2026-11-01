import type { CohortWorkspace } from './contracts';
import { CREATION_STAGES, deriveStageProgress } from './creation-progress';
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
export function deriveProcessingProgress(workspace: CohortWorkspace): ProcessingProgress {
  const details = deriveStageProgress(workspace);
  const labels: ProcessingStep['label'][] = ['Understanding','Chunking','Analyzing','Building'];
  const steps = CREATION_STAGES.map((stage,index) => ({label:labels[index],isComplete:details[stage].status==='complete',isCurrent:details[stage].status==='running',isFailed:details[stage].status==='failed'}));
  return {steps,currentStepIndex:steps.findIndex(step=>step.isCurrent),needsRebuild:isBuildStale(workspace)||CREATION_STAGES.some(stage=>['failed','canceled'].includes(details[stage].status))};
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
    canReview: capabilities.canOpenReview,
    canReturnToMaterial: capabilities.canReturnToMaterials,
    eyebrow: isReady
      ? 'Your learning experience is ready'
      : 'Building your curriculum',
    heading: isReady ? 'All set.' : 'In progress.',
    subtitle: isReady
      ? "I've turned your material into a learning experience and set it up in your personal feed. You can jump straight in, or review the cohort structure first."
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
