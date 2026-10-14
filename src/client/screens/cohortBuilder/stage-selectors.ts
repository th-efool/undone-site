import type {
  CohortWorkspace,
  CohortSource,
  CohortChunk,
} from '@/src/shared/cohort-builder/contracts';

export type CohortTextJob = NonNullable<CohortWorkspace['processing']['jobs']>[number];
export type CohortTextJobView = CohortTextJob;

export type BuilderStage =
  | 'intake'
  | 'understanding'
  | 'chunking'
  | 'analysis'
  | 'assembly'
  | 'curriculum'
  | 'review';

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
  const sources = workspace.sources ?? [];
  const lessons = workspace.lessons ?? [];
  const processing = workspace.processing;

  // 1. If workspace.sources.length === 0: return 'intake'
  if (sources.length === 0) {
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
  return inspectedStage ?? getActiveStage(workspace);
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
  const understandingMap = new Map<string, string[]>();
  for (const entry of workspace.understanding ?? []) {
    understandingMap.set(entry.sourceId, entry.topics);
  }

  const items: UnderstandingSourceItem[] = (workspace.sources ?? []).map(source => {
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
 * from workspace.chunks with offsets, length, and text snippets.
 */
export function getChunkingData(
  workspace: CohortWorkspace,
  selectedSourceId?: string
): ChunkingStageData {
  const sources = workspace.sources ?? [];
  const rawChunks = workspace.chunks ?? [];

  const chunkCountBySource = new Map<string, number>();
  for (const chunk of rawChunks) {
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

  const allChunks = rawChunks.map(mapChunk);
  const chunks = effectiveSelectedSourceId
    ? allChunks.filter(c => c.sourceId === effectiveSelectedSourceId)
    : allChunks;

  return {
    sources: sourceItems,
    selectedSourceId: effectiveSelectedSourceId,
    chunks,
    totalChunks: rawChunks.length,
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
 * Returns sources and chunks joined with workspace.analyses (summary, pedagogical question).
 */
export function getAnalysisData(
  workspace: CohortWorkspace,
  selectedSourceId?: string
): AnalysisStageData {
  const sources = workspace.sources ?? [];
  const rawChunks = workspace.chunks ?? [];
  const analyses = workspace.analyses ?? [];

  const analysisByChunkId = new Map<string, { summary: string; question: string }>();
  for (const analysis of analyses) {
    analysisByChunkId.set(analysis.chunkId, {
      summary: analysis.summary,
      question: analysis.question,
    });
  }

  const chunkCountBySource = new Map<string, number>();
  const analyzedCountBySource = new Map<string, number>();
  for (const chunk of rawChunks) {
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

  const allChunks = rawChunks.map(mapAnalyzedChunk);
  const chunks = effectiveSelectedSourceId
    ? allChunks.filter(c => c.sourceId === effectiveSelectedSourceId)
    : allChunks;

  return {
    sources: sourceItems,
    selectedSourceId: effectiveSelectedSourceId,
    chunks,
    totalAnalyses: analyses.length,
    totalChunks: rawChunks.length,
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
