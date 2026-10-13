import { createHash } from 'node:crypto';
import type { DomainActionPlan } from 'interaction-builder/core';
import type { CohortWorkspace, CohortChunk, CohortLesson } from '@/src/shared/cohort-builder/contracts';

export type TextStage = 'acquisition' | 'understanding' | 'chunking' | 'analysis' | 'assembly';

export interface TextStageAction {
  type: 'accept_text_stage';
  stage: TextStage;
  generation: number;
  fingerprint: string;
  result: unknown;
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const MAX_UNIT_BYTES = 24 * 1024;

/** Includes retained content, so even a versioning bug cannot accept changed bytes. */
export function sourceFingerprint(state: CohortWorkspace): string {
  return digest(JSON.stringify(state.sources.map(source => [source.id, source.version, source.text])));
}

function splitSource(source: CohortWorkspace['sources'][number]): CohortChunk[] {
  const chunks: CohortChunk[] = [];
  const matches = source.text.matchAll(/[^.!?\n]*(?:[.!?]+|$)/g);
  for (const match of matches) {
    const raw = match[0];
    const leading = raw.length - raw.trimStart().length;
    const value = raw.trim();
    if (!value) continue;
    const start = (match.index ?? 0) + leading;
    for (let offset = 0; offset < value.length;) {
      let end = offset;
      let bytes = 0;
      for (const codePoint of value.slice(offset)) {
        const nextBytes = Buffer.byteLength(codePoint, 'utf8');
        if (end > offset && bytes + nextBytes > MAX_UNIT_BYTES) break;
        end += codePoint.length;
        bytes += nextBytes;
      }
      const text = value.slice(offset, end);
      const anchor = start + offset;
      chunks.push({
        id: `${source.id}:v${source.version}:${anchor}`,
        sourceId: source.id,
        sourceVersion: source.version,
        start: anchor,
        end: anchor + text.length,
        text,
        checksum: digest(text),
      });
      if (chunks.length > 100) throw new Error('TOO_MANY_CHUNKS');
      offset = end;
    }
  }
  validateCoverage(source.text, chunks);
  return chunks;
}

function validateCoverage(text: string, chunks: CohortChunk[]): void {
  let coveredUntil = 0;
  for (const chunk of chunks) {
    if (chunk.start < coveredUntil || Buffer.byteLength(chunk.text, 'utf8') > MAX_UNIT_BYTES) throw new Error('INVALID_SELECTED_UNIT');
    for (let index = coveredUntil; index < chunk.start; index += 1) {
      if (!/\s/u.test(text[index])) throw new Error('INCOMPLETE_SOURCE_COVERAGE');
    }
    coveredUntil = chunk.end;
  }
  for (let index = coveredUntil; index < text.length; index += 1) {
    if (!/\s/u.test(text[index])) throw new Error('INCOMPLETE_SOURCE_COVERAGE');
  }
}

function validateChunk(state: CohortWorkspace, chunk: CohortChunk): void {
  const source = state.sources.find(item => item.id === chunk.sourceId && item.version === chunk.sourceVersion);
  if (!source || chunk.end > source.text.length || chunk.start >= chunk.end) throw new Error('FOREIGN_OR_STALE_SOURCE_ANCHOR');
  if (source.text.slice(chunk.start, chunk.end) !== chunk.text || digest(chunk.text) !== chunk.checksum) throw new Error('FABRICATED_SOURCE_ANCHOR');
}

/** Deterministic, bounded stage computation. No model owns evidence IDs. */
export function computeTextStage(state: CohortWorkspace): TextStageAction {
  const stage = state.processing.stage;
  if (stage === 'done') throw new Error('NO_PENDING_STAGE');
  const fingerprint = sourceFingerprint(state);
  let result: unknown;
  if (stage === 'acquisition') {
    result = state.sources.map(source => ({ id: source.id, version: source.version, checksum: source.checksum ?? digest(source.text) }));
  } else if (stage === 'understanding') {
    result = state.sources.map(source => state.understanding.find(item => item.sourceId === source.id && item.sourceVersion === source.version) ?? ({
      sourceId: source.id, sourceVersion: source.version,
      topics: source.text.split(/\n\s*\n|(?<=[.!?])\s+/).map(item => item.trim().slice(0, 120)).filter(Boolean).slice(0, 40),
    }));
  } else if (stage === 'chunking') {
    result = state.sources.flatMap(source => {
      const retained = state.chunks.filter(chunk => chunk.sourceId === source.id && chunk.sourceVersion === source.version);
      const expected = splitSource(source);
      return retained.length === expected.length && retained.every((item, index) => JSON.stringify(item) === JSON.stringify(expected[index])) ? retained : expected;
    });
    if ((result as CohortChunk[]).length > 100) throw new Error('TOO_MANY_CHUNKS');
  } else if (stage === 'analysis') {
    result = state.chunks.map(chunk => state.analyses.find(item => item.chunkId === chunk.id) ?? ({
      chunkId: chunk.id, summary: chunk.text.slice(0, 300),
      question: `How would you apply this passage: ${chunk.text.slice(0, 160)}?`,
    }));
  } else {
    result = state.chunks.map((chunk, index) => ({
      id: `grounded:${chunk.id}`,
      version: 0,
      title: `Source study ${index + 1}: ${chunk.text.slice(0, 72).replace(/\s+/g, ' ')}`,
      objective: `For ${state.audience.slice(0, 80)}, apply this evidence toward ${state.intent.slice(0, 100)} in a ${state.dailyMinutes}-minute study session: ${chunk.text.slice(0, 120)}`,
      sourceChunkIds: [chunk.id],
      pinned: false,
    }));
  }
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
      if (!row || row.checksum !== digest(source.text)) throw new Error('INVALID_ACQUISITION');
      source.checksum = row.checksum;
      source.state = 'ready';
    }
  } else if (action.stage === 'understanding') {
    const expected = computeTextStage({ ...state, processing: { ...state.processing, stage: 'understanding' } }).result;
    if (JSON.stringify(action.result) !== JSON.stringify(expected)) throw new Error('INVALID_UNDERSTANDING');
    next.understanding = action.result as CohortWorkspace['understanding'];
  } else if (action.stage === 'chunking') {
    const chunks = action.result as CohortChunk[];
    if (!Array.isArray(chunks) || chunks.length === 0 || chunks.length > 100) throw new Error('INVALID_CHUNKS');
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
    if (!Array.isArray(lessons) || lessons.length !== next.chunks.length || lessons.length > 100) throw new Error('INVALID_ASSEMBLY');
    for (const lesson of lessons) {
      if (!lesson.sourceChunkIds.length || lesson.sourceChunkIds.some(id => !next.chunks.some(chunk => chunk.id === id))) throw new Error('FABRICATED_LESSON_EVIDENCE');
    }
    const expected = computeTextStage({ ...state, processing: { ...state.processing, stage: 'assembly' } }).result;
    if (JSON.stringify(lessons) !== JSON.stringify(expected)) throw new Error('INVALID_ASSEMBLY');
    const pinned = next.lessons.filter(lesson => lesson.pinned);
    const manuallyEdited = next.lessons.filter(lesson => !lesson.pinned && (lesson.manualOverride || !lesson.id.startsWith('grounded:')));
    next.lessons = [...pinned, ...manuallyEdited, ...lessons.filter(lesson => !pinned.some(item => item.id === lesson.id) && !manuallyEdited.some(item => item.id === lesson.id))];
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
