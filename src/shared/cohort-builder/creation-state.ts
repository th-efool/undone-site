import { sha256 } from './hash';
import type {
  CohortWorkspace,
  CohortSource,
} from './contracts';

export interface WorkspaceInvariantReport { valid: boolean; violations: string[]; }

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
    .map(source => [source.id, source.version, source.input ?? null, source.text, source.locations ?? [], source.provenance ?? null]);
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
  if (processing.sourceFingerprint !== computeSourceEvidenceFingerprint(workspace)) return false;
  if (processing.buildInputFingerprint && processing.buildInputFingerprint !== computeBuildInputFingerprint(workspace)) return false;
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
  if (processing.status === 'ready' && !isBuildComplete(workspace)) return true;

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
