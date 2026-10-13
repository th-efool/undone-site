import { z } from 'zod';
import { entityRefSchema, type DomainActionPlan } from 'interaction-builder/core';

const text = z.string().trim().min(1).max(4_000);
const id = z.string().min(1).max(200);
const sourceText = z.string().trim().min(1).max(200_000);

export const cohortSourceSchema = z.strictObject({
  id,
  version: z.number().int().nonnegative(),
  label: z.string().trim().min(1).max(300),
  text: sourceText,
  checksum: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  state: z.enum(['queued', 'ready', 'processing', 'failed', 'stale']),
});
export type CohortSource = z.infer<typeof cohortSourceSchema>;

export const cohortChunkSchema = z.strictObject({
  id,
  sourceId: id,
  sourceVersion: z.number().int().nonnegative(),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  text: z.string().min(1).max(8_000),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
export type CohortChunk = z.infer<typeof cohortChunkSchema>;

export const cohortLessonSchema = z.strictObject({
  id,
  version: z.number().int().nonnegative(),
  title: text,
  objective: text,
  sourceChunkIds: z.array(id).max(200),
  pinned: z.boolean(),
  manualOverride: z.boolean().optional(),
  evidenceStatus: z.enum(['valid', 'orphaned']).optional(),
});
export type CohortLesson = z.infer<typeof cohortLessonSchema>;

export const cohortWorkspaceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  title: z.string().max(300),
  intent: text,
  audience: z.string().max(500),
  dailyMinutes: z.number().int().min(1).max(1_440),
  lessons: z.array(cohortLessonSchema).max(200),
  sources: z.array(cohortSourceSchema).max(20).default([]),
  chunks: z.array(cohortChunkSchema).max(2_000).default([]),
  understanding: z.array(z.strictObject({ sourceId: id, sourceVersion: z.number().int().nonnegative(), topics: z.array(z.string().max(120)).max(40) })).default([]),
  analyses: z.array(z.strictObject({ chunkId: id, summary: z.string().max(500), question: z.string().max(500) })).default([]),
  processing: z.strictObject({
    status: z.enum(['idle', 'queued', 'processing', 'ready', 'failed']),
    stage: z.enum(['acquisition', 'understanding', 'chunking', 'analysis', 'assembly', 'done']).default('done'),
    generation: z.number().int().nonnegative().default(0),
    sourceFingerprint: z.string().nullable(),
    error: z.string().nullable(),
  }).default({ status: 'idle', stage: 'done', generation: 0, sourceFingerprint: null, error: null }),
});
export type CohortWorkspace = z.infer<typeof cohortWorkspaceSchema>;

export const cohortActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('set_intent'), intent: text }),
  z.strictObject({ type: z.literal('set_audience'), audience: z.string().trim().max(500) }),
  z.strictObject({ type: z.literal('set_daily_minutes'), dailyMinutes: z.number().int().min(1).max(1_440) }),
  z.strictObject({ type: z.literal('edit_lesson'), lessonId: id, title: text.optional(), objective: text.optional() }).refine(value => value.title !== undefined || value.objective !== undefined, 'Lesson edit needs title or objective'),
  z.strictObject({ type: z.literal('add_lesson'), lessonId: id.optional(), title: text, objective: text }),
  z.strictObject({ type: z.literal('remove_lesson'), lessonId: id }),
  z.strictObject({ type: z.literal('reorder_lessons'), lessonIds: z.array(id).min(1).max(200) }),
  z.strictObject({ type: z.literal('set_lesson_pin'), lessonId: id, pinned: z.boolean() }),
  z.strictObject({ type: z.literal('add_text_source'), sourceId: id.optional(), label: z.string().trim().min(1).max(300), text: sourceText }),
  z.strictObject({ type: z.literal('edit_text_source'), sourceId: id, label: z.string().trim().min(1).max(300), text: sourceText }),
  z.strictObject({ type: z.literal('remove_source'), sourceId: id }),
  z.strictObject({ type: z.literal('retry_processing') }),
]);
export type CohortAction = z.infer<typeof cohortActionSchema>;

export interface CohortActionContext {
  actionId: string;
  workspaceId: string;
  expectedRevision: number;
  currentRevision: number;
  entityVersions: ReadonlyMap<string, number>;
}

function ref(workspaceId: string, lesson: CohortLesson) {
  return entityRefSchema.parse({ kind: 'lesson', id: lesson.id, version: lesson.version });
}

export function planCohortAction(state: CohortWorkspace, actionInput: unknown, context: CohortActionContext): DomainActionPlan<CohortWorkspace> {
  const action = cohortActionSchema.parse(actionInput);
  if (context.expectedRevision !== context.currentRevision) throw new Error('STALE_WORKSPACE');
  const next = cohortWorkspaceSchema.parse(structuredClone(state));
  const changed: ReturnType<typeof ref>[] = [];
  const invalidated: string[] = [];
  const touch = (lesson: CohortLesson) => { lesson.version += 1; changed.push(ref(context.workspaceId, lesson)); };
  const queueAfterPreferenceChange = (readyStage: 'analysis' | 'assembly') => {
    if (!next.sources.length) return;
    const stage = next.processing.status === 'ready' ? readyStage : next.processing.status === 'failed' ? 'acquisition' : next.processing.stage;
    next.processing = { ...next.processing, status: 'queued', stage, generation: next.processing.generation + 1, error: null };
  };

  if (action.type === 'set_intent') { next.intent = action.intent; invalidated.push('curriculum'); queueAfterPreferenceChange('assembly'); return { nextState: next, changed: [], invalidated, summary: 'Learning intent updated.', undoable: true }; }
  if (action.type === 'set_audience') { next.audience = action.audience; invalidated.push('analysis', 'curriculum'); queueAfterPreferenceChange('analysis'); return { nextState: next, changed: [], invalidated, summary: 'Audience updated.', undoable: true }; }
  if (action.type === 'set_daily_minutes') { next.dailyMinutes = action.dailyMinutes; invalidated.push('curriculum'); queueAfterPreferenceChange('assembly'); return { nextState: next, changed: [], invalidated, summary: 'Daily learning time updated.', undoable: true }; }

  if (action.type === 'add_text_source') {
    const sourceId = action.sourceId ?? context.actionId;
    if (next.sources.some(source => source.id === sourceId)) throw new Error('DUPLICATE_SOURCE');
    if (next.sources.length >= 20) throw new Error('TOO_MANY_SOURCES');
    if (new TextEncoder().encode(action.text).byteLength > 200_000) throw new Error('SOURCE_TOO_LARGE');
    next.sources.push({ id: sourceId, version: 0, label: action.label, text: action.text, checksum: null, state: 'queued' });
    next.processing = { status: 'queued', stage: 'acquisition', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
    return { nextState: next, changed: [], invalidated: ['sources', 'chunks', 'analysis', 'curriculum'], summary: `Added source: ${action.label}`, undoable: true };
  }
  if (action.type === 'edit_text_source') {
    const source = next.sources.find(item => item.id === action.sourceId);
    if (!source) throw new Error('UNKNOWN_SOURCE');
    if (new TextEncoder().encode(action.text).byteLength > 200_000) throw new Error('SOURCE_TOO_LARGE');
    source.version += 1;
    source.label = action.label;
    source.text = action.text;
    source.checksum = null;
    source.state = 'queued';
    next.chunks = next.chunks.filter(chunk => chunk.sourceId !== source.id);
    next.understanding = next.understanding.filter(unit => unit.sourceId !== source.id);
    const validChunks = new Set(next.chunks.map(chunk => chunk.id));
    next.analyses = next.analyses.filter(item => validChunks.has(item.chunkId));
    next.lessons = next.lessons.filter(lesson => lesson.pinned || lesson.manualOverride || lesson.sourceChunkIds.every(chunkId => validChunks.has(chunkId)));
    next.lessons.forEach(lesson => { if (lesson.sourceChunkIds.some(chunkId => !validChunks.has(chunkId))) lesson.evidenceStatus = 'orphaned'; });
    next.processing = { status: 'queued', stage: 'acquisition', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
    return { nextState: next, changed: [], invalidated: ['sources', 'chunks', 'analysis', 'curriculum'], summary: `Updated source: ${source.label}`, undoable: true };
  }
  if (action.type === 'remove_source') {
    const source = next.sources.find(item => item.id === action.sourceId);
    if (!source) throw new Error('UNKNOWN_SOURCE');
    next.sources = next.sources.filter(item => item.id !== action.sourceId);
    next.chunks = next.chunks.filter(chunk => chunk.sourceId !== action.sourceId);
    next.understanding = next.understanding.filter(unit => unit.sourceId !== action.sourceId);
    const validChunks = new Set(next.chunks.map(chunk => chunk.id));
    next.analyses = next.analyses.filter(item => validChunks.has(item.chunkId));
    next.lessons = next.lessons.filter(lesson => lesson.pinned || lesson.manualOverride || lesson.sourceChunkIds.every(chunkId => validChunks.has(chunkId)));
    next.lessons.forEach(lesson => { if (lesson.sourceChunkIds.some(chunkId => !validChunks.has(chunkId))) lesson.evidenceStatus = 'orphaned'; });
    next.processing = { status: next.sources.length ? 'queued' : 'idle', stage: next.sources.length ? 'acquisition' : 'done', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
    return { nextState: next, changed: [], invalidated: ['sources', 'chunks', 'analysis', 'curriculum'], summary: `Removed source: ${source.label}`, undoable: true };
  }
  if (action.type === 'retry_processing') {
    if (next.sources.length === 0) throw new Error('NO_SOURCES');
    next.processing = { status: 'queued', stage: 'acquisition', generation: next.processing.generation + 1, sourceFingerprint: null, error: null };
    return { nextState: next, changed: [], invalidated: [], summary: 'Source processing queued.', undoable: false };
  }

  if (action.type === 'add_lesson') {
    const newLesson: CohortLesson = {
      id: action.lessonId ?? crypto.randomUUID(),
      version: 0,
      title: action.title,
      objective: action.objective,
      sourceChunkIds: [],
      pinned: false,
    };
    next.lessons.push(newLesson);
    touch(newLesson);
    invalidated.push('curriculum');
    return { nextState: next, changed, invalidated, summary: `Added lesson: ${newLesson.title}`, undoable: true };
  }

  if (action.type === 'remove_lesson') {
    const targetIdx = next.lessons.findIndex(item => item.id === action.lessonId);
    if (targetIdx === -1) throw new Error('UNKNOWN_LESSON');
    const target = next.lessons[targetIdx];
    if (target.pinned) throw new Error('PINNED_LESSON_LOCKED');
    next.lessons.splice(targetIdx, 1);
    invalidated.push('curriculum');
    return { nextState: next, changed: [], invalidated, summary: `Removed lesson: ${target.title}`, undoable: true };
  }

  const lessonId = action.type === 'reorder_lessons' ? null : action.lessonId;
  const lesson = lessonId === null ? undefined : next.lessons.find(item => item.id === lessonId);
  if (action.type !== 'reorder_lessons' && !lesson) throw new Error('UNKNOWN_LESSON');
  if (lesson) {
    const expectedVersion = context.entityVersions.get(lesson.id);
    if (expectedVersion !== undefined && expectedVersion !== lesson.version) throw new Error('STALE_ENTITY');
  }
  if (action.type === 'edit_lesson' && lesson) {
    if (action.title !== undefined && lesson.pinned) throw new Error('PINNED_LESSON_TITLE');
    if (action.title !== undefined) lesson.title = action.title;
    if (action.objective !== undefined) lesson.objective = action.objective;
    lesson.manualOverride = true;
    touch(lesson); return { nextState: next, changed, invalidated: [], summary: `Lesson ${lesson.id} updated.`, undoable: true };
  }
  if (action.type === 'set_lesson_pin' && lesson) { lesson.pinned = action.pinned; touch(lesson); return { nextState: next, changed, invalidated: [], summary: action.pinned ? `Lesson ${lesson.id} pinned.` : `Lesson ${lesson.id} unpinned.`, undoable: true }; }
  if (action.type === 'reorder_lessons') {
    const current = new Set(next.lessons.map(item => item.id));
    if (action.lessonIds.length !== next.lessons.length || action.lessonIds.some(item => !current.has(item)) || new Set(action.lessonIds).size !== action.lessonIds.length) throw new Error('INVALID_LESSON_ORDER');
    const byId = new Map(next.lessons.map(item => [item.id, item]));
    next.lessons = action.lessonIds.map(item => byId.get(item)!);
    next.lessons.forEach(touch); invalidated.push('curriculum-order');
    return { nextState: next, changed, invalidated, summary: 'Lesson order updated.', undoable: true };
  }
  throw new Error('UNSUPPORTED_ACTION');
}
