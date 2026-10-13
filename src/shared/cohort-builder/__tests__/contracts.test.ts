import { describe, expect, it } from 'vitest';
import { cohortWorkspaceSchema, planCohortAction, type CohortWorkspace } from '../contracts';

const workspaceId = '00000000-0000-4000-8000-000000000001';
const base = (): CohortWorkspace => cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Draft', intent: 'Learn TypeScript', audience: 'Beginner', dailyMinutes: 20, lessons: [
  { id: 'l1', version: 0, title: 'Types', objective: 'Use types', sourceChunkIds: ['c1'], pinned: false },
  { id: 'l2', version: 0, title: 'Functions', objective: 'Use functions', sourceChunkIds: ['c2'], pinned: false },
] });
const context = { actionId: workspaceId, workspaceId, expectedRevision: 0, currentRevision: 0, entityVersions: new Map() };

describe('cohort builder action plan', () => {
  it('edits lesson through typed action and returns invalidation', () => {
    const result = planCohortAction(base(), { type: 'edit_lesson', lessonId: 'l1', objective: 'Explain type narrowing' }, context);
    expect(result.nextState.lessons[0].objective).toBe('Explain type narrowing');
    expect(result.changed[0]).toMatchObject({ kind: 'lesson', id: 'l1', version: 1 });
    expect(result.undoable).toBe(true);
  });
  it('keeps pinned title protected', () => {
    const pinned = base(); pinned.lessons[0].pinned = true;
    expect(() => planCohortAction(pinned, { type: 'edit_lesson', lessonId: 'l1', title: 'Unsafe rewrite' }, context)).toThrow('PINNED_LESSON_TITLE');
  });
  it('rejects stale revision and malformed order', () => {
    expect(() => planCohortAction(base(), { type: 'set_intent', intent: 'New' }, { ...context, expectedRevision: 1 })).toThrow('STALE_WORKSPACE');
    expect(() => planCohortAction(base(), { type: 'reorder_lessons', lessonIds: ['l1', 'l1'] }, context)).toThrow('INVALID_LESSON_ORDER');
    expect(() => planCohortAction(base(), { type: 'edit_lesson', lessonId: 'l1', objective: 'New' }, { ...context, entityVersions: new Map([['l1', 4]]) })).toThrow('STALE_ENTITY');
  });
});
