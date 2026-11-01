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

export type { CanonicalStage, StageStatus, StageProgressDetails } from '@/src/shared/cohort-builder/creation-progress';
import { deriveStageProgress, type CanonicalStage, type StageProgressDetails } from '@/src/shared/cohort-builder/creation-progress';

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

// ---------------------------------------------------------------------------
// Selector Memoization Caches (WeakMap keyed by workspace reference)
// ---------------------------------------------------------------------------

let effectiveStageCache = new WeakMap<CohortWorkspace, Map<BuilderStage | undefined, BuilderStage>>();
let validChunksCache = new WeakMap<CohortWorkspace, CohortChunk[]>();
let validAnalysesCache = new WeakMap<CohortWorkspace, CohortWorkspace['analyses']>();
let stageProgressDetailsCache = new WeakMap<CohortWorkspace, StageProgressDetails>();
let understandingDataCache = new WeakMap<CohortWorkspace, UnderstandingStageData>();
let chunkingDataCache = new WeakMap<CohortWorkspace, Map<string | undefined, ChunkingStageData>>();
let analysisDataCache = new WeakMap<CohortWorkspace, Map<string | undefined, AnalysisStageData>>();
let assemblyDataCache = new WeakMap<CohortWorkspace, AssemblyStageData>();

/**
 * Reset all selector caches. Primarily used in test isolation.
 */
export function clearStageSelectorsCache(): void {
  effectiveStageCache = new WeakMap();
  validChunksCache = new WeakMap();
  validAnalysesCache = new WeakMap();
  stageProgressDetailsCache = new WeakMap();
  understandingDataCache = new WeakMap();
  chunkingDataCache = new WeakMap();
  analysisDataCache = new WeakMap();
  assemblyDataCache = new WeakMap();
}

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
function computeActiveStage(workspace: CohortWorkspace): BuilderStage {
  return deriveActiveStage(workspace);
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
  return deriveEffectiveStage(workspace, inspectedStage, drafts);
}

export function getEffectiveStage(
  workspace: CohortWorkspace,
  inspectedStage?: BuilderStage | null,
  drafts?: { isAnyDirtyOrOpen: () => boolean; editingStage: BuilderStage | null }
): BuilderStage {
  if (!workspace || typeof workspace !== 'object' || drafts) {
    return computeEffectiveStage(workspace, inspectedStage, drafts);
  }
  let innerMap = effectiveStageCache.get(workspace);
  if (!innerMap) {
    innerMap = new Map();
    effectiveStageCache.set(workspace, innerMap);
  }
  const key: BuilderStage | undefined = inspectedStage ?? undefined;
  const cached = innerMap.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const result = computeEffectiveStage(workspace, inspectedStage);
  innerMap.set(key, result);
  return result;
}

// ---------------------------------------------------------------------------
// Canonical Progress Selectors & Data Filters
// ---------------------------------------------------------------------------

/**
 * Filter valid current chunks matching chunk.sourceVersion === source.version.
 * Chunks from older versions are historical/retained.
 */
function computeValidChunks(workspace: CohortWorkspace): CohortChunk[] {
  const sources = workspace.sources ?? [];
  const sourceVersionMap = new Map(sources.map(s => [s.id, s.version]));
  return (workspace.chunks ?? []).filter(chunk => {
    const currentVersion = sourceVersionMap.get(chunk.sourceId);
    return currentVersion !== undefined && chunk.sourceVersion === currentVersion;
  });
}

export function getValidChunks(workspace: CohortWorkspace): CohortChunk[] {
  if (!workspace || typeof workspace !== 'object') {
    return computeValidChunks(workspace);
  }
  const cached = validChunksCache.get(workspace);
  if (cached !== undefined) {
    return cached;
  }
  const result = computeValidChunks(workspace);
  validChunksCache.set(workspace, result);
  return result;
}

/**
 * Filter valid analyses belonging to valid current chunks.
 */
function computeValidAnalyses(workspace: CohortWorkspace): CohortWorkspace['analyses'] {
  const validChunks = getValidChunks(workspace);
  const validChunkIds = new Set(validChunks.map(c => c.id));
  return (workspace.analyses ?? []).filter(a => validChunkIds.has(a.chunkId));
}

export function getValidAnalyses(workspace: CohortWorkspace): CohortWorkspace['analyses'] {
  if (!workspace || typeof workspace !== 'object') {
    return computeValidAnalyses(workspace);
  }
  const cached = validAnalysesCache.get(workspace);
  if (cached !== undefined) {
    return cached;
  }
  const result = computeValidAnalyses(workspace);
  validAnalysesCache.set(workspace, result);
  return result;
}

/**
 * Robust pure selector verifying if a specific stage has completed canonically.
 * Does not rely on array presence (chunks.length > 0, lessons.length > 0).
 */
export function isStageComplete(workspace: CohortWorkspace, stage: CanonicalStage): boolean {
  return deriveStageProgress(workspace)[stage].status === 'complete';
}
export function getStageProgressDetails(workspace: CohortWorkspace): StageProgressDetails {
  const cached = stageProgressDetailsCache.get(workspace);
  if (cached) return cached;
  const result = deriveStageProgress(workspace);
  stageProgressDetailsCache.set(workspace, result);
  return result;
}

// ---------------------------------------------------------------------------
// Stage Data View Models & Selectors
// ---------------------------------------------------------------------------

/**
 * Returns list of sources with their topics from workspace.understanding and acquired segment count/status.
 * Supports being used directly as an array or via .sources property.
 */
function computeUnderstandingData(workspace: CohortWorkspace): UnderstandingStageData {
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

export function getUnderstandingData(workspace: CohortWorkspace): UnderstandingStageData {
  if (!workspace || typeof workspace !== 'object') {
    return computeUnderstandingData(workspace);
  }
  const cached = understandingDataCache.get(workspace);
  if (cached !== undefined) {
    return cached;
  }
  const result = computeUnderstandingData(workspace);
  understandingDataCache.set(workspace, result);
  return result;
}

/**
 * Returns sources list with chunk counts, and for the selected source, the array of chunks
 * from valid current workspace.chunks with offsets, length, and text snippets.
 */
function computeChunkingData(
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

export function getChunkingData(
  workspace: CohortWorkspace,
  selectedSourceId?: string
): ChunkingStageData {
  if (!workspace || typeof workspace !== 'object') {
    return computeChunkingData(workspace, selectedSourceId);
  }
  let innerMap = chunkingDataCache.get(workspace);
  if (!innerMap) {
    innerMap = new Map();
    chunkingDataCache.set(workspace, innerMap);
  }
  const cached = innerMap.get(selectedSourceId);
  if (cached !== undefined) {
    return cached;
  }
  const result = computeChunkingData(workspace, selectedSourceId);
  innerMap.set(selectedSourceId, result);
  return result;
}

/**
 * Returns sources and valid current chunks joined with valid current workspace.analyses (summary, pedagogical question).
 */
function computeAnalysisData(
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

export function getAnalysisData(
  workspace: CohortWorkspace,
  selectedSourceId?: string
): AnalysisStageData {
  if (!workspace || typeof workspace !== 'object') {
    return computeAnalysisData(workspace, selectedSourceId);
  }
  let innerMap = analysisDataCache.get(workspace);
  if (!innerMap) {
    innerMap = new Map();
    analysisDataCache.set(workspace, innerMap);
  }
  const cached = innerMap.get(selectedSourceId);
  if (cached !== undefined) {
    return cached;
  }
  const result = computeAnalysisData(workspace, selectedSourceId);
  innerMap.set(selectedSourceId, result);
  return result;
}

/**
 * Returns assembly job status, progress counts.
 */
function computeAssemblyData(workspace: CohortWorkspace): AssemblyStageData {
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

export function getAssemblyData(workspace: CohortWorkspace): AssemblyStageData {
  if (!workspace || typeof workspace !== 'object') {
    return computeAssemblyData(workspace);
  }
  const cached = assemblyDataCache.get(workspace);
  if (cached !== undefined) {
    return cached;
  }
  const result = computeAssemblyData(workspace);
  assemblyDataCache.set(workspace, result);
  return result;
}
