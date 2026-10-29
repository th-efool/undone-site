import type { DomainActionPlan } from 'interaction-builder/core';
import type { CohortWorkspace, CohortChunk, CohortLesson } from '@/src/shared/cohort-builder/contracts';
import { extractSourceConceptTopics, deriveCohortTitle, deriveCohortDescription } from '@/src/shared/cohort-builder/cohort-metadata';
import { buildCohortSeo } from '@/src/shared/cohort-builder/seo';
import { sha256 } from '@/src/shared/cohort-builder/hash';
import {
  MAX_UNIT_BYTES,
  MIN_VIDEO_CHUNK_MS,
  sourceFingerprint,
  splitSource,
  validateCoverage,
  validateChunk,
  buildGeneratedLessons,
  validateGeneratedLessonCoverage,
  projectGeneratedLessons,
} from '@/src/shared/cohort-builder/client-pipeline';

export {
  MAX_UNIT_BYTES,
  MIN_VIDEO_CHUNK_MS,
  sourceFingerprint,
  splitSource,
  validateCoverage,
  validateChunk,
  buildGeneratedLessons,
  validateGeneratedLessonCoverage,
};

export type TextStage = 'acquisition' | 'understanding' | 'chunking' | 'analysis' | 'assembly';

export interface TextStageAction {
  type: 'accept_text_stage';
  stage: TextStage;
  generation: number;
  fingerprint: string;
  result: unknown;
}

/** Deterministic, bounded stage computation. No model owns evidence IDs. */
export function computeTextStage(state: CohortWorkspace): TextStageAction {
  const stage = state.processing.stage;
  if (stage === 'done') throw new Error('NO_PENDING_STAGE');
  if (stage === 'extraction') throw new Error('SOURCE_REQUIRES_DURABLE_DRIVER');
  const fingerprint = sourceFingerprint(state);
  let result: unknown;
  if (stage === 'acquisition') {
    result = state.sources.map(source => ({ id: source.id, version: source.version, checksum: source.checksum ?? sha256(source.text) }));
  } else if (stage === 'understanding') {
    result = state.sources.map(source => state.understanding.find(item => item.sourceId === source.id && item.sourceVersion === source.version) ?? ({
      sourceId: source.id, sourceVersion: source.version,
      topics: extractSourceConceptTopics(source),
    }));
  } else if (stage === 'chunking') {
    result = state.sources.flatMap(source => {
      const retained = state.chunks.filter(chunk => chunk.sourceId === source.id && chunk.sourceVersion === source.version);
      const expected = splitSource(source);
      return retained.length === expected.length && retained.every((item, index) => JSON.stringify(item) === JSON.stringify(expected[index])) ? retained : expected;
    });
    if ((result as CohortChunk[]).length > 1_000) throw new Error('TOO_MANY_CHUNKS');
  } else if (stage === 'analysis') {
    result = state.chunks.map(chunk => state.analyses.find(item => item.chunkId === chunk.id) ?? ({
      chunkId: chunk.id, summary: chunk.text.slice(0, 300),
      question: `How would you apply this passage: ${chunk.text.slice(0, 160)}?`,
    }));
  } else result = buildGeneratedLessons(state);
  return { type: 'accept_text_stage', stage, generation: state.processing.generation, fingerprint, result };
}

const nextStage: Record<TextStage, TextStage | 'done'> = {
  acquisition: 'understanding', understanding: 'chunking', chunking: 'analysis', analysis: 'assembly', assembly: 'done',
};

/** Server-only action planner. Never register this planner on the public API. */
export function planTextStage(state: CohortWorkspace, input: unknown, context: { expectedRevision: number; currentRevision: number }): DomainActionPlan<CohortWorkspace> {
  const action = input as TextStageAction;
  if (action?.type !== 'accept_text_stage' || !Object.hasOwn(nextStage, action.stage)) throw new Error('INVALID_STAGE_ACTION');
  if (context.expectedRevision !== context.currentRevision) throw new Error('STALE_WORKSPACE');
  if (state.processing.stage !== action.stage || state.processing.generation !== action.generation || sourceFingerprint(state) !== action.fingerprint) throw new Error('STALE_SOURCE_RESULT');
  if (state.processing.status !== 'queued' && state.processing.status !== 'processing') throw new Error('PROCESSING_NOT_ACTIVE');
  const next = structuredClone(state);
  if (action.stage === 'acquisition') {
    const rows = action.result as Array<{ id: string; version: number; checksum: string }>;
    if (!Array.isArray(rows) || rows.length !== next.sources.length) throw new Error('INVALID_ACQUISITION');
    for (const source of next.sources) {
      const row = rows.find(item => item.id === source.id && item.version === source.version);
      if (!row || row.checksum !== sha256(source.text)) throw new Error('INVALID_ACQUISITION');
      source.checksum = row.checksum;
      source.state = 'ready';
    }
  } else if (action.stage === 'understanding') {
    const expected = computeTextStage({ ...state, processing: { ...state.processing, stage: 'understanding' } }).result;
    if (JSON.stringify(action.result) !== JSON.stringify(expected)) throw new Error('INVALID_UNDERSTANDING');
    next.understanding = action.result as CohortWorkspace['understanding'];
    next.title = deriveCohortTitle(next);
    next.description = deriveCohortDescription(next);
  } else if (action.stage === 'chunking') {
    const chunks = action.result as CohortChunk[];
    if (!Array.isArray(chunks) || chunks.length === 0 || chunks.length > 1_000) throw new Error('INVALID_CHUNKS');
    chunks.forEach(chunk => validateChunk(next, chunk));
    for (const source of next.sources) validateCoverage(source.text, chunks.filter(chunk => chunk.sourceId === source.id));
    if (JSON.stringify(chunks) !== JSON.stringify(next.sources.flatMap(splitSource))) throw new Error('FABRICATED_SOURCE_ANCHOR');
    next.chunks = chunks;
  } else if (action.stage === 'analysis') {
    const expected = computeTextStage({ ...state, processing: { ...state.processing, stage: 'analysis' } }).result;
    if (JSON.stringify(action.result) !== JSON.stringify(expected)) throw new Error('INVALID_ANALYSIS');
    next.analyses = action.result as CohortWorkspace['analyses'];
  } else {
    const lessons = action.result as CohortLesson[];
    if (!Array.isArray(lessons) || lessons.length > 1_000 || !validateGeneratedLessonCoverage(lessons, next.chunks)) throw new Error('FABRICATED_LESSON_EVIDENCE');
    const expected = computeTextStage({ ...state, processing: { ...state.processing, stage: 'assembly' } }).result;
    if (JSON.stringify(lessons) !== JSON.stringify(expected)) throw new Error('INVALID_ASSEMBLY');
    next.lessons = projectGeneratedLessons(next.lessons, lessons, new Set(next.chunks.map(chunk => chunk.id)));
  }
  if (action.stage !== 'acquisition') {
    next.seo = buildCohortSeo(next);
  }
  next.processing = {
    status: nextStage[action.stage] === 'done' ? 'ready' : 'queued',
    stage: nextStage[action.stage],
    generation: state.processing.generation,
    sourceFingerprint: action.fingerprint,
    error: null,
  };
  return { nextState: next, changed: [], invalidated: [], summary: `Text ${action.stage} accepted.`, undoable: false };
}

export function planTextFailure(state: CohortWorkspace, input: unknown, context: { expectedRevision: number; currentRevision: number }): DomainActionPlan<CohortWorkspace> {
  const action = input as { type: string; generation: number; fingerprint: string; error: string };
  if (action?.type !== 'fail_text_stage' || context.expectedRevision !== context.currentRevision || action.generation !== state.processing.generation || action.fingerprint !== sourceFingerprint(state)) throw new Error('STALE_SOURCE_RESULT');
  const next = structuredClone(state);
  next.processing.status = 'failed';
  next.processing.error = action.error.slice(0, 300);
  return { nextState: next, changed: [], invalidated: [], summary: 'Text processing failed.', undoable: false };
}
