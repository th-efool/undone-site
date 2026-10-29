/**
 * Shared Deterministic Pipeline for Cohort Building.
 * Isomorphic: Runs identically on the user's device (browser / Web Worker)
 * and in Vercel Serverless Lambdas with zero Node.js built-ins.
 */

import { sha256 } from './hash';
import type { CohortWorkspace, CohortChunk, CohortLesson } from './contracts';
import { extractSourceConceptTopics, deriveCohortTitle, deriveCohortDescription } from './cohort-metadata';
import { buildCohortSeo } from './seo';

export const MAX_UNIT_BYTES = 24 * 1024;
export const MIN_VIDEO_CHUNK_MS = 60_000; // 1 minute target for video chunks

/**
 * Computes UTF-8 byte length isomorphically without Node's `Buffer.byteLength`.
 */
export function byteLengthUtf8(str: string): number {
  return new TextEncoder().encode(str).byteLength;
}

/**
 * Fingerprints source contents and versions.
 * Matches `text-pipeline.ts` output exactly.
 */
export function sourceFingerprint(state: Pick<CohortWorkspace, 'sources'>): string {
  return sha256(JSON.stringify(state.sources.map(source => [source.id, source.version, source.text])));
}

function pushBoundedTextChunks(
  chunks: CohortChunk[],
  source: CohortWorkspace['sources'][number],
  fullText: string,
  spanStart: number,
  spanEnd: number
): void {
  const raw = fullText.slice(spanStart, spanEnd);
  const leading = raw.length - raw.trimStart().length;
  const value = raw.trim();
  if (!value) return;
  const start = spanStart + leading;
  for (let offset = 0; offset < value.length;) {
    let end = offset;
    let bytes = 0;
    for (const codePoint of value.slice(offset)) {
      const nextBytes = byteLengthUtf8(codePoint);
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
      checksum: sha256(text),
    });
    if (chunks.length > 100) throw new Error('TOO_MANY_CHUNKS');
    offset = end;
  }
}

/**
 * Splits a source into bounded chunks adhering to 100% text coverage.
 * For videos, merges timed observations to >= 60 seconds.
 * For text, splits along sentence boundaries.
 */
export function splitSource(source: CohortWorkspace['sources'][number]): CohortChunk[] {
  const chunks: CohortChunk[] = [];
  const timedLocations = (source.locations ?? []).filter(
    loc => loc.startMs !== undefined && loc.endMs !== undefined && loc.end > loc.start
  );

  if (timedLocations.length > 0) {
    const sorted = [...timedLocations].sort((a, b) => a.start - b.start);
    let groupStartChar = 0;
    let groupStartMs = sorted[0].startMs!;
    let groupEndMs = sorted[0].endMs!;

    for (let i = 1; i < sorted.length; i++) {
      const loc = sorted[i];
      const currentDurationMs = groupEndMs - groupStartMs;
      const combinedBytes = byteLengthUtf8(source.text.slice(groupStartChar, loc.end));

      if (currentDurationMs < MIN_VIDEO_CHUNK_MS && combinedBytes <= MAX_UNIT_BYTES) {
        groupEndMs = Math.max(groupEndMs, loc.endMs!);
      } else {
        pushBoundedTextChunks(chunks, source, source.text, groupStartChar, loc.start);
        groupStartChar = loc.start;
        groupStartMs = loc.startMs!;
        groupEndMs = loc.endMs!;
      }
    }
    pushBoundedTextChunks(chunks, source, source.text, groupStartChar, source.text.length);
    validateCoverage(source.text, chunks);
    return chunks;
  }

  const matches = source.text.matchAll(/[^.!?\n]*(?:[.!?]+|(?=\n)|$)/g);
  for (const match of matches) {
    const raw = match[0];
    if (!raw.trim()) continue;
    const spanStart = match.index ?? 0;
    const spanEnd = spanStart + raw.length;
    pushBoundedTextChunks(chunks, source, source.text, spanStart, spanEnd);
  }
  validateCoverage(source.text, chunks);
  return chunks;
}

export function validateCoverage(text: string, chunks: CohortChunk[]): void {
  let coveredUntil = 0;
  for (const chunk of chunks) {
    if (chunk.start < coveredUntil || byteLengthUtf8(chunk.text) > MAX_UNIT_BYTES) {
      throw new Error('INVALID_SELECTED_UNIT');
    }
    for (let index = coveredUntil; index < chunk.start; index += 1) {
      if (!/\s/u.test(text[index])) throw new Error('INCOMPLETE_SOURCE_COVERAGE');
    }
    coveredUntil = chunk.end;
  }
  for (let index = coveredUntil; index < text.length; index += 1) {
    if (!/\s/u.test(text[index])) throw new Error('INCOMPLETE_SOURCE_COVERAGE');
  }
}

export function validateChunk(state: CohortWorkspace, chunk: CohortChunk): void {
  const source = state.sources.find(item => item.id === chunk.sourceId && item.version === chunk.sourceVersion);
  if (!source || chunk.end > source.text.length || chunk.start >= chunk.end) {
    throw new Error('FOREIGN_OR_STALE_SOURCE_ANCHOR');
  }
  if (source.text.slice(chunk.start, chunk.end) !== chunk.text || sha256(chunk.text) !== chunk.checksum) {
    throw new Error('FABRICATED_SOURCE_ANCHOR');
  }
}

function isVideoSource(source: CohortWorkspace['sources'][number] | undefined): boolean {
  return source?.input?.kind === 'youtube'
    || Boolean(source?.provenance?.videoId)
    || Boolean(source?.locations?.some(location => location.startMs !== undefined && location.endMs !== undefined));
}

function lessonCopy(state: CohortWorkspace, chunk: CohortChunk, index: number) {
  const source = state.sources.find(item => item.id === chunk.sourceId);
  const cleanChunk = chunk.text.replace(/^[#*\-•\s\d.)]+/, '').replace(/[\r\n\t]+/g, ' ').trim();
  const firstSentence = cleanChunk.split(/(?<=[.!?])\s+/)[0]?.trim() || cleanChunk;
  const coreTitle = firstSentence.length > 68 ? `${firstSentence.slice(0, 65).replace(/\s+\S*$/, '')}...` : firstSentence;
  const title = coreTitle
    ? (source?.label && state.sources.length > 1 && !coreTitle.toLowerCase().includes(source.label.toLowerCase()) ? `${source.label}: ${coreTitle}` : coreTitle)
    : (source?.label ? `${source.label} (Part ${index + 1})` : `Part ${index + 1}: Key Concept`);
  return { cleanChunk, title };
}

/** Video evidence is one learner lesson per source; bounded evidence chunks become its parts. */
export function buildGeneratedLessons(state: CohortWorkspace): CohortLesson[] {
  const lessons: CohortLesson[] = [];
  for (const source of state.sources) {
    const chunks = state.chunks.filter(chunk => chunk.sourceId === source.id && chunk.sourceVersion === source.version);
    if (!chunks.length) continue;
    if (isVideoSource(source)) {
      const first = lessonCopy(state, chunks[0], 0).cleanChunk;
      lessons.push({
        id: `grounded:video:${source.id}:v${source.version}`,
        version: 0,
        title: source.provenance?.videoTitle || source.label,
        objective: `For ${state.audience.slice(0, 80)}, use this complete video toward ${state.intent.slice(0, 100)} in a ${state.dailyMinutes}-minute study session: ${first.slice(0, 120)}`,
        sourceChunkIds: chunks.map(chunk => chunk.id),
        pinned: false,
      });
      continue;
    }
    chunks.forEach((chunk, index) => {
      const { cleanChunk, title } = lessonCopy(state, chunk, index);
      lessons.push({
        id: `grounded:${chunk.id}`,
        version: 0,
        title,
        objective: `For ${state.audience.slice(0, 80)}, apply this evidence toward ${state.intent.slice(0, 100)} in a ${state.dailyMinutes}-minute study session: ${cleanChunk.slice(0, 120)}`,
        sourceChunkIds: [chunk.id],
        pinned: false,
      });
    });
  }
  return lessons;
}

/** Generated lessons must cite every retained chunk exactly once, in source order. */
export function validateGeneratedLessonCoverage(lessons: CohortLesson[], chunks: CohortChunk[]): boolean {
  const chunkIds = new Set(chunks.map(chunk => chunk.id));
  const cited = lessons.flatMap(lesson => lesson.sourceChunkIds);
  return cited.length === chunks.length && new Set(cited).size === cited.length && cited.every(id => chunkIds.has(id));
}

/**
 * Checks whether a workspace's sources are all pre-extracted and eligible for
 * synchronous, instant on-device curriculum assembly (<15ms).
 */
export function canRunDeterministicPipeline(state: CohortWorkspace): boolean {
  if (!state.sources || state.sources.length === 0) return false;
  return state.sources.every(source =>
    Boolean(source.text && source.text.trim().length > 0 && Array.isArray(source.locations))
  );
}

/**
 * Merges generated lessons with existing authored lessons.
 */
export function projectGeneratedLessons(
  existing: CohortLesson[],
  generated: CohortLesson[],
  validChunkIds: ReadonlySet<string>
): CohortLesson[] {
  const authored = existing
    .filter(lesson => lesson.pinned || lesson.manualOverride || !lesson.id.startsWith('grounded:'))
    .map(lesson => lesson.sourceChunkIds.some(id => !validChunkIds.has(id))
      ? { ...lesson, evidenceStatus: 'orphaned' as const }
      : { ...lesson, evidenceStatus: 'valid' as const });
  const protectedIds = new Set(authored.map(lesson => lesson.id));
  return [
    ...authored,
    ...generated.filter(lesson => !protectedIds.has(lesson.id)).map(lesson => {
      const prior = existing.find(item => item.id === lesson.id);
      const changed = prior && (prior.title !== lesson.title || prior.objective !== lesson.objective
        || JSON.stringify(prior.sourceChunkIds) !== JSON.stringify(lesson.sourceChunkIds));
      return {
        ...lesson,
        version: prior ? prior.version + (changed ? 1 : 0) : lesson.version,
        evidenceStatus: 'valid' as const,
      };
    }),
  ];
}

/**
 * Runs all 4 deterministic stages (understanding -> chunking -> analysis -> assembly)
 * synchronously in <15ms over already-extracted sources.
 *
 * Produces a fully valid, ready-to-review CohortWorkspace without triggering
 * multi-step server background DB jobs.
 */
export function runDeterministicPipeline(state: CohortWorkspace): CohortWorkspace {
  if (!canRunDeterministicPipeline(state)) {
    throw new Error('SOURCES_NOT_EXTRACTED_FOR_DETERMINISTIC_PIPELINE');
  }

  const next = structuredClone(state);

  // 1. Acquisition & Checksums
  for (const source of next.sources) {
    source.checksum = sha256(source.text);
    source.state = 'ready';
  }

  // 2. Understanding & Derived Metadata
  next.understanding = next.sources.map(source => {
    const existing = next.understanding?.find(item => item.sourceId === source.id && item.sourceVersion === source.version);
    return existing ?? {
      sourceId: source.id,
      sourceVersion: source.version,
      topics: extractSourceConceptTopics(source),
    };
  });
  next.title = deriveCohortTitle(next);
  next.description = deriveCohortDescription(next);

  // 3. Chunking
  const allChunks: CohortChunk[] = next.sources.flatMap(splitSource);
  if (allChunks.length > 1_000) throw new Error('TOO_MANY_CHUNKS');
  allChunks.forEach(chunk => validateChunk(next, chunk));
  for (const source of next.sources) {
    validateCoverage(source.text, allChunks.filter(chunk => chunk.sourceId === source.id));
  }
  next.chunks = allChunks;

  // 4. Analysis
  next.analyses = allChunks.map(chunk => {
    const existing = next.analyses?.find(item => item.chunkId === chunk.id);
    return existing ?? {
      chunkId: chunk.id,
      summary: chunk.text.slice(0, 300),
      question: `How would you apply this passage: ${chunk.text.slice(0, 160)}?`,
    };
  });

  // 5. Lesson Assembly
  const generatedLessons = buildGeneratedLessons(next);
  if (!validateGeneratedLessonCoverage(generatedLessons, next.chunks)) {
    throw new Error('FABRICATED_LESSON_EVIDENCE');
  }
  next.lessons = projectGeneratedLessons(
    next.lessons ?? [],
    generatedLessons,
    new Set(allChunks.map(c => c.id))
  );

  // 6. SEO
  next.seo = buildCohortSeo(next);

  // 7. Complete Processing State
  const fingerprint = sourceFingerprint(next);
  next.processing = {
    status: 'ready',
    stage: 'done',
    generation: (next.processing?.generation ?? 0) + 1,
    sourceFingerprint: fingerprint,
    error: null,
    driver: 'durable',
  };

  next.journey = {
    version: 1,
    step: 'ready',
    branch: next.journey?.branch ?? null,
    processingStarted: true,
    intentVersion: next.journey?.intentVersion ?? 0,
  };

  return next;
}
