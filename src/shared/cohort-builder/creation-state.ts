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
        error: (d as { error?: string | null }).error ?? null,
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
