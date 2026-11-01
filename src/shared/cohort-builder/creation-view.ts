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
