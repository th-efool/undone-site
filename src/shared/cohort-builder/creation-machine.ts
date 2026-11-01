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
  computeBuildInputFingerprint,
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

  if (options.sources.length !== state.sources.length || new Set(options.sources.map(s => s.id)).size !== options.sources.length) throw new Error('INVALID_ACCEPTED_SOURCE');
  for (const chunk of options.chunks) {
    const source = state.sources.find(s => s.id === chunk.sourceId && s.version === chunk.sourceVersion);
    if (!source || chunk.start < 0 || chunk.end <= chunk.start || chunk.end > source.text.length || source.text.slice(chunk.start, chunk.end) !== chunk.text || sha256(chunk.text) !== chunk.checksum) throw new Error('INVALID_ACCEPTED_CHUNK');
  }
  const next = structuredClone(state);
  for (const source of next.sources) {
    const accepted = options.sources.find(
      item => item.id === source.id && item.version === source.version
    );
    if (!accepted || (accepted.checksum !== source.checksum && accepted.checksum !== sha256(source.text))) throw new Error('INVALID_ACCEPTED_SOURCE');
    source.checksum = accepted.checksum;
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
    buildInputFingerprint: computeBuildInputFingerprint(next),
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
        (workspace.sources.length === 0 || buildComplete) &&
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
