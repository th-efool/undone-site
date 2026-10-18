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

/**
 * Pure presentation selector to derive the current active stage of a cohort workspace.
 *
 * Rules:
 * 1. If workspace.sources.length === 0: return 'intake'
 * 2. If workspace.processing.status === 'ready':
 *    - If workspace.release && workspace.release.status !== 'draft': return 'review'
 *    - Otherwise return 'curriculum'
 * 3. If workspace.processing.status === 'processing' | 'queued' | 'failed':
 *    - Look at workspace.processing.jobs:
 *      Find the most active or failing job:
 *      - If an active or failed job is in understanding | acquisition | extraction: return 'understanding'
 *      - If in chunking: return 'chunking'
 *      - If in analysis: return 'analysis'
 *      - If in assembly: return 'assembly'
 *    - If no jobs array, use workspace.processing.stage:
 *      - 'acquisition' | 'extraction' | 'understanding' -> 'understanding'
 *      - 'chunking' -> 'chunking'
 *      - 'analysis' -> 'analysis'
 *      - 'assembly' -> 'assembly'
 *      - 'done' -> 'curriculum'
 * 4. Default: 'curriculum' if lessons exist, else 'intake'
 */
export function getActiveStage(workspace: CohortWorkspace): BuilderStage {
  if (workspace.journey) {
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

/**
 * Pure selector returning the effective stage for navigation/inspection.
 * If inspectedStage is set, it overrides active stage without any side-effects.
 */
export function getEffectiveStage(
  workspace: CohortWorkspace,
  inspectedStage: BuilderStage | null
): BuilderStage {
  const active = getActiveStage(workspace);
  if (
    active === 'recommendations' ||
    active === 'starting_point' ||
    active === 'material_input' ||
    active === 'discovery' ||
    active === 'goal_setup'
  ) {
    return active;
  }
  return inspectedStage ?? active;
}

// ---------------------------------------------------------------------------
// Canonical Progress Selectors & Data Filters
// ---------------------------------------------------------------------------

const STAGE_ORDER_MAP: Record<string, number> = {
  acquisition: 0,
  extraction: 0,
  understanding: 0,
  chunking: 1,
  analysis: 2,
  assembly: 3,
  building: 3,
  done: 4,
};

function getLegacyStageIndex(stage: string): number {
  return STAGE_ORDER_MAP[stage] ?? 0;
}

function jobMatchesSource(j: CohortTextJob, s: CohortSource): boolean {
  if (j.sourceId !== s.id) return false;
  const jVersion = (j as any).sourceVersion;
  return jVersion === undefined || jVersion === s.version;
}

function isSourceUnderstandingAccepted(s: CohortSource, jobs: CohortTextJob[]): boolean {
  const ownJobs = jobs.filter(j => jobMatchesSource(j, s));
  const stageJobs = ownJobs.filter(j => ['acquisition', 'extraction', 'understanding'].includes(j.stage));
  if (stageJobs.length === 0) return false;
  const hasIncomplete = stageJobs.some(
    j => j.status === 'running' || j.status === 'queued' || j.status === 'failed' || j.status === 'canceled'
  );
  if (hasIncomplete) return false;
  const uJob = stageJobs.find(j => j.stage === 'understanding');
  if (uJob) {
    return uJob.status === 'accepted';
  }
  return stageJobs.some(j => j.status === 'accepted');
}

function isSourceChunkingAccepted(s: CohortSource, jobs: CohortTextJob[]): boolean {
  const ownJobs = jobs.filter(j => jobMatchesSource(j, s));
  const chunkingJobs = ownJobs.filter(j => j.stage === 'chunking');
  if (chunkingJobs.length === 0) return false;
  const hasIncomplete = chunkingJobs.some(
    j => j.status === 'running' || j.status === 'queued' || j.status === 'failed' || j.status === 'canceled'
  );
  if (hasIncomplete) return false;
  return chunkingJobs.some(j => j.status === 'accepted');
}

function isSourceAnalysisAccepted(s: CohortSource, jobs: CohortTextJob[]): boolean {
  const ownJobs = jobs.filter(j => jobMatchesSource(j, s));
  const analysisJobs = ownJobs.filter(j => j.stage === 'analysis');
  if (analysisJobs.length === 0) return false;
  const hasIncomplete = analysisJobs.some(
    j => j.status === 'running' || j.status === 'queued' || j.status === 'failed' || j.status === 'canceled'
  );
  if (hasIncomplete) return false;
  return analysisJobs.some(j => j.status === 'accepted');
}

function isAssemblyAccepted(jobs: CohortTextJob[]): boolean {
  const assemblyJobs = jobs.filter(j => j.stage === 'assembly' || j.sourceId === null);
  if (assemblyJobs.length === 0) return false;
  const hasIncomplete = assemblyJobs.some(
    j => j.status === 'running' || j.status === 'queued' || j.status === 'failed' || j.status === 'canceled'
  );
  if (hasIncomplete) return false;
  return assemblyJobs.some(j => j.status === 'accepted');
}

/**
 * Filter valid current chunks matching chunk.sourceVersion === source.version.
 * Chunks from older versions are historical/retained.
 */
export function getValidChunks(workspace: CohortWorkspace): CohortChunk[] {
  const sources = workspace.sources ?? [];
  const sourceVersionMap = new Map(sources.map(s => [s.id, s.version]));
  return (workspace.chunks ?? []).filter(chunk => {
    const currentVersion = sourceVersionMap.get(chunk.sourceId);
    return currentVersion !== undefined && chunk.sourceVersion === currentVersion;
  });
}

/**
 * Filter valid analyses belonging to valid current chunks.
 */
export function getValidAnalyses(workspace: CohortWorkspace): CohortWorkspace['analyses'] {
  const validChunks = getValidChunks(workspace);
  const validChunkIds = new Set(validChunks.map(c => c.id));
  return (workspace.analyses ?? []).filter(a => validChunkIds.has(a.chunkId));
}

/**
 * Robust pure selector verifying if a specific stage has completed canonically.
 * Does not rely on array presence (chunks.length > 0, lessons.length > 0).
 */
export function isStageComplete(
  workspace: CohortWorkspace,
  stage: 'understanding' | 'chunking' | 'analysis' | 'assembly'
): boolean {
  const sources = workspace.sources ?? [];
  if (sources.length === 0) return false;

  const jobs = workspace.processing?.jobs;
  if (jobs && jobs.length > 0) {
    const uComplete = sources.every(s => isSourceUnderstandingAccepted(s, jobs));
    if (stage === 'understanding') return uComplete;

    const cComplete = uComplete && sources.every(s => isSourceChunkingAccepted(s, jobs));
    if (stage === 'chunking') return cComplete;

    const aComplete = cComplete && sources.every(s => isSourceAnalysisAccepted(s, jobs));
    if (stage === 'analysis') return aComplete;

    const asComplete = aComplete && isAssemblyAccepted(jobs);
    if (stage === 'assembly') return asComplete;

    return false;
  }

  // Conservative legacy fallback without jobs
  if (workspace.processing?.status === 'ready') return true;
  if (workspace.processing?.status === 'idle') return false;

  const currentIdx = getLegacyStageIndex(workspace.processing?.stage ?? 'done');
  const targetIdx = stage === 'understanding' ? 0 : stage === 'chunking' ? 1 : stage === 'analysis' ? 2 : 3;
  return targetIdx < currentIdx;
}

/**
 * Returns detailed per-stage status based strictly on canonical job evidence
 * or conservative legacy fallback.
 */
export function getStageProgressDetails(workspace: CohortWorkspace): StageProgressDetails {
  const sources = workspace.sources ?? [];
  const jobs = workspace.processing?.jobs ?? [];
  const error = workspace.processing?.error;
  const isServerCanceled = workspace.processing?.status === 'idle' && error === 'PROCESSING_CANCELED';
  const hasJobs = jobs.length > 0;

  if (sources.length === 0) {
    const emptyStatus: StageStatus = {
      status: 'pending',
      completedCount: 0,
      totalCount: 0,
      failedCount: 0,
      retryable: false,
      isCanceled: false,
    };
    return {
      understanding: { ...emptyStatus },
      chunking: { ...emptyStatus },
      analysis: { ...emptyStatus },
      assembly: { ...emptyStatus, totalCount: 1 },
    };
  }

  if (hasJobs) {
    // Stage 0: Understanding
    const uTotal = sources.length;
    const uCompleted = sources.filter(s => isSourceUnderstandingAccepted(s, jobs)).length;
    const uFailed = sources.filter(s => {
      const own = jobs.filter(j => jobMatchesSource(j, s));
      return own.some(j => ['acquisition', 'extraction', 'understanding'].includes(j.stage) && j.status === 'failed');
    }).length;
    const uRetryable = jobs.some(j => ['acquisition', 'extraction', 'understanding'].includes(j.stage) && j.status === 'failed' && j.retryable);
    const uHasCanceled = jobs.some(j => ['acquisition', 'extraction', 'understanding'].includes(j.stage) && j.status === 'canceled');
    const uHasRunning = jobs.some(j => ['acquisition', 'extraction', 'understanding'].includes(j.stage) && (j.status === 'running' || (j.status === 'queued' && getActiveStage(workspace) === 'understanding')));
    const uComplete = isStageComplete(workspace, 'understanding');
    const uCanceled = !uComplete && (uHasCanceled || isServerCanceled);

    let uStatus: StageStatus['status'] = 'pending';
    if (uComplete) uStatus = 'complete';
    else if (uFailed > 0) uStatus = 'failed';
    else if (uCanceled) uStatus = 'canceled';
    else if (uHasRunning) uStatus = 'running';

    const understandingStatus: StageStatus = {
      status: uStatus,
      completedCount: uCompleted,
      totalCount: uTotal,
      failedCount: uFailed,
      retryable: uRetryable,
      isCanceled: uCanceled,
    };

    // Stage 1: Chunking
    const cTotal = sources.length;
    const cCompleted = sources.filter(s => isSourceChunkingAccepted(s, jobs)).length;
    const cFailed = sources.filter(s => {
      const own = jobs.filter(j => jobMatchesSource(j, s));
      return own.some(j => j.stage === 'chunking' && j.status === 'failed');
    }).length;
    const cRetryable = jobs.some(j => j.stage === 'chunking' && j.status === 'failed' && j.retryable);
    const cHasCanceled = jobs.some(j => j.stage === 'chunking' && j.status === 'canceled');
    const cHasRunning = jobs.some(j => j.stage === 'chunking' && (j.status === 'running' || (j.status === 'queued' && getActiveStage(workspace) === 'chunking')));
    const cComplete = isStageComplete(workspace, 'chunking');
    const cCanceled = !cComplete && (cHasCanceled || (isServerCanceled && uComplete));

    let cStatus: StageStatus['status'] = 'pending';
    if (cComplete) cStatus = 'complete';
    else if (cFailed > 0) cStatus = 'failed';
    else if (cCanceled) cStatus = 'canceled';
    else if (cHasRunning) cStatus = 'running';

    const chunkingStatus: StageStatus = {
      status: cStatus,
      completedCount: cCompleted,
      totalCount: cTotal,
      failedCount: cFailed,
      retryable: cRetryable,
      isCanceled: cCanceled,
    };

    // Stage 2: Analysis
    const aTotal = sources.length;
    const aCompleted = sources.filter(s => isSourceAnalysisAccepted(s, jobs)).length;
    const aFailed = sources.filter(s => {
      const own = jobs.filter(j => jobMatchesSource(j, s));
      return own.some(j => j.stage === 'analysis' && j.status === 'failed');
    }).length;
    const aRetryable = jobs.some(j => j.stage === 'analysis' && j.status === 'failed' && j.retryable);
    const aHasCanceled = jobs.some(j => j.stage === 'analysis' && j.status === 'canceled');
    const aHasRunning = jobs.some(j => j.stage === 'analysis' && (j.status === 'running' || (j.status === 'queued' && getActiveStage(workspace) === 'analysis')));
    const aComplete = isStageComplete(workspace, 'analysis');
    const aCanceled = !aComplete && (aHasCanceled || (isServerCanceled && cComplete));

    let aStatus: StageStatus['status'] = 'pending';
    if (aComplete) aStatus = 'complete';
    else if (aFailed > 0) aStatus = 'failed';
    else if (aCanceled) aStatus = 'canceled';
    else if (aHasRunning) aStatus = 'running';

    const analysisStatus: StageStatus = {
      status: aStatus,
      completedCount: aCompleted,
      totalCount: aTotal,
      failedCount: aFailed,
      retryable: aRetryable,
      isCanceled: aCanceled,
    };

    // Stage 3: Assembly
    const asTotal = 1;
    const assemblyJob = jobs.find(j => j.stage === 'assembly' || j.sourceId === null);
    const asCompleted = assemblyJob?.status === 'accepted' ? 1 : 0;
    const asFailed = assemblyJob?.status === 'failed' ? 1 : 0;
    const asRetryable = Boolean(assemblyJob?.status === 'failed' && assemblyJob?.retryable);
    const asHasCanceled = assemblyJob?.status === 'canceled';
    const asHasRunning = assemblyJob?.status === 'running' || (assemblyJob?.status === 'queued' && getActiveStage(workspace) === 'assembly');
    const asComplete = isStageComplete(workspace, 'assembly');
    const asCanceled = !asComplete && (asHasCanceled || (isServerCanceled && aComplete));

    let asStatus: StageStatus['status'] = 'pending';
    if (asComplete) asStatus = 'complete';
    else if (asFailed > 0) asStatus = 'failed';
    else if (asCanceled) asStatus = 'canceled';
    else if (asHasRunning) asStatus = 'running';

    const assemblyStatus: StageStatus = {
      status: asStatus,
      completedCount: asCompleted,
      totalCount: asTotal,
      failedCount: asFailed,
      retryable: asRetryable,
      isCanceled: asCanceled,
    };

    return {
      understanding: understandingStatus,
      chunking: chunkingStatus,
      analysis: analysisStatus,
      assembly: assemblyStatus,
    };
  }

  // Conservative legacy fallback without jobs
  const status = workspace.processing?.status;
  const stage = workspace.processing?.stage;
  const isCanceled = isServerCanceled || error === 'PROCESSING_CANCELED';

  if (isCanceled) {
    return {
      understanding: { status: 'canceled', completedCount: 0, totalCount: sources.length, failedCount: 0, retryable: false, isCanceled: true },
      chunking: { status: 'canceled', completedCount: 0, totalCount: sources.length, failedCount: 0, retryable: false, isCanceled: true },
      analysis: { status: 'canceled', completedCount: 0, totalCount: sources.length, failedCount: 0, retryable: false, isCanceled: true },
      assembly: { status: 'canceled', completedCount: 0, totalCount: 1, failedCount: 0, retryable: false, isCanceled: true },
    };
  }

  if (status === 'ready') {
    return {
      understanding: { status: 'complete', completedCount: sources.length, totalCount: sources.length, failedCount: 0, retryable: false, isCanceled: false },
      chunking: { status: 'complete', completedCount: sources.length, totalCount: sources.length, failedCount: 0, retryable: false, isCanceled: false },
      analysis: { status: 'complete', completedCount: sources.length, totalCount: sources.length, failedCount: 0, retryable: false, isCanceled: false },
      assembly: { status: 'complete', completedCount: 1, totalCount: 1, failedCount: 0, retryable: false, isCanceled: false },
    };
  }

  if (status === 'idle') {
    return {
      understanding: { status: 'pending', completedCount: 0, totalCount: sources.length, failedCount: 0, retryable: false, isCanceled: false },
      chunking: { status: 'pending', completedCount: 0, totalCount: sources.length, failedCount: 0, retryable: false, isCanceled: false },
      analysis: { status: 'pending', completedCount: 0, totalCount: sources.length, failedCount: 0, retryable: false, isCanceled: false },
      assembly: { status: 'pending', completedCount: 0, totalCount: 1, failedCount: 0, retryable: false, isCanceled: false },
    };
  }

  const activeIdx = getLegacyStageIndex(stage ?? 'done');

  const mapLegacyStageStatus = (idx: number, isAssemblyStage: boolean): StageStatus => {
    const total = isAssemblyStage ? 1 : sources.length;
    if (idx < activeIdx) {
      return { status: 'complete', completedCount: total, totalCount: total, failedCount: 0, retryable: false, isCanceled: false };
    }
    if (idx === activeIdx) {
      if (status === 'failed') {
        return { status: 'failed', completedCount: 0, totalCount: total, failedCount: 1, retryable: true, isCanceled: false };
      }
      return { status: 'running', completedCount: 0, totalCount: total, failedCount: 0, retryable: false, isCanceled: false };
    }
    return { status: 'pending', completedCount: 0, totalCount: total, failedCount: 0, retryable: false, isCanceled: false };
  };

  return {
    understanding: mapLegacyStageStatus(0, false),
    chunking: mapLegacyStageStatus(1, false),
    analysis: mapLegacyStageStatus(2, false),
    assembly: mapLegacyStageStatus(3, true),
  };
}

// ---------------------------------------------------------------------------
// Stage Data View Models & Selectors
// ---------------------------------------------------------------------------

export interface UnderstandingSourceItem {
  id: string;
  sourceId: string;
  label: string;
  kind: string;
  status: CohortSource['state'];
  segmentCount: number;
  topics: string[];
}

export interface UnderstandingStageData extends Array<UnderstandingSourceItem> {
  sources: UnderstandingSourceItem[];
  totalTopics: number;
  totalSegments: number;
}

/**
 * Returns list of sources with their topics from workspace.understanding and acquired segment count/status.
 * Supports being used directly as an array or via .sources property.
 */
export function getUnderstandingData(workspace: CohortWorkspace): UnderstandingStageData {
  const sources = workspace.sources ?? [];
  const sourceVersionMap = new Map(sources.map(s => [s.id, s.version]));
  const understandingMap = new Map<string, string[]>();
  for (const entry of workspace.understanding ?? []) {
    const currentVersion = sourceVersionMap.get(entry.sourceId);
    if (currentVersion === undefined || entry.sourceVersion === undefined || entry.sourceVersion === currentVersion) {
      understandingMap.set(entry.sourceId, entry.topics);
    }
  }

  const items: UnderstandingSourceItem[] = sources.map(source => {
    const topics = understandingMap.get(source.id) ?? [];
    const segmentCount = source.locations?.length ?? (source.text && source.text.trim().length > 0 ? 1 : 0);
    return {
      id: source.id,
      sourceId: source.id,
      label: source.label,
      kind: source.input?.kind ?? 'text',
      status: source.state,
      segmentCount,
      topics,
    };
  });

  const totalTopics = items.reduce((sum, item) => sum + item.topics.length, 0);
  const totalSegments = items.reduce((sum, item) => sum + item.segmentCount, 0);

  const result = [...items] as UnderstandingStageData;
  result.sources = items;
  result.totalTopics = totalTopics;
  result.totalSegments = totalSegments;
  return result;
}

export interface ChunkingSourceItem {
  id: string;
  sourceId: string;
  label: string;
  status: CohortSource['state'];
  chunkCount: number;
}

export interface ChunkItemView {
  id: string;
  sourceId: string;
  sourceVersion: number;
  start: number;
  end: number;
  offset: number;
  length: number;
  text: string;
  snippet: string;
  textSnippet: string;
}

export interface ChunkingStageData {
  sources: ChunkingSourceItem[];
  selectedSourceId: string | null;
  chunks: ChunkItemView[];
  totalChunks: number;
  allChunks: ChunkItemView[];
}

/**
 * Returns sources list with chunk counts, and for the selected source, the array of chunks
 * from valid current workspace.chunks with offsets, length, and text snippets.
 */
export function getChunkingData(
  workspace: CohortWorkspace,
  selectedSourceId?: string
): ChunkingStageData {
  const sources = workspace.sources ?? [];
  const validChunks = getValidChunks(workspace);

  const chunkCountBySource = new Map<string, number>();
  for (const chunk of validChunks) {
    chunkCountBySource.set(chunk.sourceId, (chunkCountBySource.get(chunk.sourceId) ?? 0) + 1);
  }

  const sourceItems: ChunkingSourceItem[] = sources.map(source => ({
    id: source.id,
    sourceId: source.id,
    label: source.label,
    status: source.state,
    chunkCount: chunkCountBySource.get(source.id) ?? 0,
  }));

  const effectiveSelectedSourceId =
    selectedSourceId !== undefined
      ? selectedSourceId
      : sources[0]?.id ?? null;

  const mapChunk = (chunk: CohortChunk): ChunkItemView => {
    const length = Math.max(0, chunk.end - chunk.start);
    const snippet = chunk.text.length > 160 ? chunk.text.slice(0, 160) + '...' : chunk.text;
    return {
      id: chunk.id,
      sourceId: chunk.sourceId,
      sourceVersion: chunk.sourceVersion,
      start: chunk.start,
      end: chunk.end,
      offset: chunk.start,
      length,
      text: chunk.text,
      snippet,
      textSnippet: snippet,
    };
  };

  const allChunks = validChunks.map(mapChunk);
  const chunks = effectiveSelectedSourceId
    ? allChunks.filter(c => c.sourceId === effectiveSelectedSourceId)
    : allChunks;

  return {
    sources: sourceItems,
    selectedSourceId: effectiveSelectedSourceId,
    chunks,
    totalChunks: validChunks.length,
    allChunks,
  };
}

export interface AnalysisSourceItem {
  id: string;
  sourceId: string;
  label: string;
  status: CohortSource['state'];
  chunkCount: number;
  analyzedCount: number;
}

export interface AnalyzedChunkView {
  id: string;
  chunkId: string;
  sourceId: string;
  sourceVersion: number;
  start: number;
  end: number;
  offset: number;
  length: number;
  text: string;
  snippet: string;
  summary: string | null;
  question: string | null;
  hasAnalysis: boolean;
  analysis: { summary: string; question: string } | null;
}

export interface AnalysisStageData {
  sources: AnalysisSourceItem[];
  selectedSourceId: string | null;
  chunks: AnalyzedChunkView[];
  totalAnalyses: number;
  totalChunks: number;
  allChunks: AnalyzedChunkView[];
}

/**
 * Returns sources and valid current chunks joined with valid current workspace.analyses (summary, pedagogical question).
 */
export function getAnalysisData(
  workspace: CohortWorkspace,
  selectedSourceId?: string
): AnalysisStageData {
  const sources = workspace.sources ?? [];
  const validChunks = getValidChunks(workspace);
  const validAnalyses = getValidAnalyses(workspace);

  const analysisByChunkId = new Map<string, { summary: string; question: string }>();
  for (const analysis of validAnalyses) {
    analysisByChunkId.set(analysis.chunkId, {
      summary: analysis.summary,
      question: analysis.question,
    });
  }

  const chunkCountBySource = new Map<string, number>();
  const analyzedCountBySource = new Map<string, number>();
  for (const chunk of validChunks) {
    chunkCountBySource.set(chunk.sourceId, (chunkCountBySource.get(chunk.sourceId) ?? 0) + 1);
    if (analysisByChunkId.has(chunk.id)) {
      analyzedCountBySource.set(
        chunk.sourceId,
        (analyzedCountBySource.get(chunk.sourceId) ?? 0) + 1
      );
    }
  }

  const sourceItems: AnalysisSourceItem[] = sources.map(source => ({
    id: source.id,
    sourceId: source.id,
    label: source.label,
    status: source.state,
    chunkCount: chunkCountBySource.get(source.id) ?? 0,
    analyzedCount: analyzedCountBySource.get(source.id) ?? 0,
  }));

  const effectiveSelectedSourceId =
    selectedSourceId !== undefined
      ? selectedSourceId
      : sources[0]?.id ?? null;

  const mapAnalyzedChunk = (chunk: CohortChunk): AnalyzedChunkView => {
    const analysis = analysisByChunkId.get(chunk.id) ?? null;
    const length = Math.max(0, chunk.end - chunk.start);
    const snippet = chunk.text.length > 160 ? chunk.text.slice(0, 160) + '...' : chunk.text;
    return {
      id: chunk.id,
      chunkId: chunk.id,
      sourceId: chunk.sourceId,
      sourceVersion: chunk.sourceVersion,
      start: chunk.start,
      end: chunk.end,
      offset: chunk.start,
      length,
      text: chunk.text,
      snippet,
      summary: analysis?.summary ?? null,
      question: analysis?.question ?? null,
      hasAnalysis: Boolean(analysis),
      analysis,
    };
  };

  const allChunks = validChunks.map(mapAnalyzedChunk);
  const chunks = effectiveSelectedSourceId
    ? allChunks.filter(c => c.sourceId === effectiveSelectedSourceId)
    : allChunks;

  return {
    sources: sourceItems,
    selectedSourceId: effectiveSelectedSourceId,
    chunks,
    totalAnalyses: validAnalyses.length,
    totalChunks: validChunks.length,
    allChunks,
  };
}

export interface AssemblyProgressCounts {
  totalLessons: number;
  totalSources: number;
  readySources: number;
  totalChunks: number;
  totalAnalyses: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  runningJobs: number;
  queuedJobs: number;
}

export interface AssemblyStageData {
  status: string;
  stage: string;
  job: CohortTextJobView | null;
  progress: AssemblyProgressCounts;
  progressCounts: AssemblyProgressCounts;
  totalLessons: number;
  totalChunks: number;
  totalAnalyses: number;
}

/**
 * Returns assembly job status, progress counts.
 */
export function getAssemblyData(workspace: CohortWorkspace): AssemblyStageData {
  const sources = workspace.sources ?? [];
  const lessons = workspace.lessons ?? [];
  const chunks = workspace.chunks ?? [];
  const analyses = workspace.analyses ?? [];
  const jobs = workspace.processing?.jobs ?? [];

  const assemblyJob = jobs.find(j => j.stage === 'assembly' || j.sourceId === null) ?? null;

  let status: string = 'idle';
  if (assemblyJob) {
    status = assemblyJob.status;
  } else if (workspace.processing?.stage === 'assembly') {
    status = workspace.processing.status;
  } else if (workspace.processing?.status === 'ready') {
    status = 'accepted';
  } else if (workspace.processing?.status === 'failed') {
    status = 'failed';
  } else if (workspace.processing?.status === 'processing' || workspace.processing?.status === 'queued') {
    status = workspace.processing.status;
  }

  const progressCounts: AssemblyProgressCounts = {
    totalLessons: lessons.length,
    totalSources: sources.length,
    readySources: sources.filter(s => s.state === 'ready').length,
    totalChunks: chunks.length,
    totalAnalyses: analyses.length,
    totalJobs: jobs.length,
    completedJobs: jobs.filter(j => j.status === 'accepted').length,
    failedJobs: jobs.filter(j => j.status === 'failed').length,
    runningJobs: jobs.filter(j => j.status === 'running').length,
    queuedJobs: jobs.filter(j => j.status === 'queued').length,
  };

  return {
    status,
    stage: 'assembly',
    job: assemblyJob,
    progress: progressCounts,
    progressCounts,
    totalLessons: lessons.length,
    totalChunks: chunks.length,
    totalAnalyses: analyses.length,
  };
}
