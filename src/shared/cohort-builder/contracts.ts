import { z } from 'zod';
import { entityRefSchema, type DomainActionPlan } from '@/src/shared/interaction/contracts';

const text = z.string().trim().min(1).max(4_000);
const id = z.string().min(1).max(200);

export const cohortLessonSchema = z.strictObject({
  id,
  version: z.number().int().nonnegative(),
  title: text,
  objective: text,
  sourceChunkIds: z.array(id).max(200),
  pinned: z.boolean(),
});
export type CohortLesson = z.infer<typeof cohortLessonSchema>;

export const cohortWorkspaceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  title: z.string().max(300),
  intent: text,
  audience: z.string().max(500),
  dailyMinutes: z.number().int().min(1).max(1_440),
  lessons: z.array(cohortLessonSchema).max(200),
});
export type CohortWorkspace = z.infer<typeof cohortWorkspaceSchema>;

export const cohortActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('set_intent'), intent: text }),
  z.strictObject({ type: z.literal('set_audience'), audience: z.string().trim().max(500) }),
  z.strictObject({ type: z.literal('set_daily_minutes'), dailyMinutes: z.number().int().min(1).max(1_440) }),
  z.strictObject({ type: z.literal('edit_lesson'), lessonId: id, title: text.optional(), objective: text.optional() }).refine(value => value.title !== undefined || value.objective !== undefined, 'Lesson edit needs title or objective'),
  z.strictObject({ type: z.literal('reorder_lessons'), lessonIds: z.array(id).min(1).max(200) }),
  z.strictObject({ type: z.literal('set_lesson_pin'), lessonId: id, pinned: z.boolean() }),
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
  const next = structuredClone(state);
  const changed: ReturnType<typeof ref>[] = [];
  const invalidated: string[] = [];
  const touch = (lesson: CohortLesson) => { lesson.version += 1; changed.push(ref(context.workspaceId, lesson)); };

  if (action.type === 'set_intent') { next.intent = action.intent; invalidated.push('curriculum'); return { nextState: next, changed: [], invalidated, summary: 'Learning intent updated.', undoable: true }; }
  if (action.type === 'set_audience') { next.audience = action.audience; invalidated.push('analysis', 'curriculum'); return { nextState: next, changed: [], invalidated, summary: 'Audience updated.', undoable: true }; }
  if (action.type === 'set_daily_minutes') { next.dailyMinutes = action.dailyMinutes; invalidated.push('curriculum'); return { nextState: next, changed: [], invalidated, summary: 'Daily learning time updated.', undoable: true }; }

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
