import { describe, expect, it } from 'vitest';
import { cohortWorkspaceSchema, planCohortAction, type CohortWorkspace } from '../contracts';

const workspaceId = '00000000-0000-4000-8000-000000000001';
const base = (): CohortWorkspace => cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Draft', intent: 'Learn TypeScript', audience: 'Beginner', dailyMinutes: 20, lessons: [
  { id: 'l1', version: 0, title: 'Types', objective: 'Use types', sourceChunkIds: ['c1'], pinned: false },
  { id: 'l2', version: 0, title: 'Functions', objective: 'Use functions', sourceChunkIds: ['c2'], pinned: false },
] });
const context = { actionId: workspaceId, workspaceId, expectedRevision: 0, currentRevision: 0, entityVersions: new Map() };

describe('cohort builder action plan', () => {
  it('retains exact pasted whitespace while rejecting blank material', () => {
    const raw = '\n  Quorums overlap. \n';
    expect(planCohortAction(base(), { type:'add_text_source', sourceId:'raw', label:'Notes', text:raw }, context).nextState.sources[0].text).toBe(raw);
    expect(() => planCohortAction(base(), { type:'add_text_source', label:'Blank', text:' \n ' }, context)).toThrow();
  });
  it('edits lesson through typed action and returns invalidation', () => {
    const result = planCohortAction(base(), { type: 'edit_lesson', lessonId: 'l1', objective: 'Explain type narrowing' }, context);
    expect(result.nextState.lessons[0].objective).toBe('Explain type narrowing');
    expect(result.changed[0]).toMatchObject({ kind: 'lesson', id: 'l1', version: 1 });
    expect(result.undoable).toBe(true);
  });
  it('allows an explicit title edit for a pinned lesson while retaining its pin', () => {
    const pinned = base(); pinned.lessons[0].pinned = true;
    const result = planCohortAction(pinned, { type: 'edit_lesson', lessonId: 'l1', title: 'Deliberate rewrite' }, context);
    expect(result.nextState.lessons[0]).toMatchObject({ title: 'Deliberate rewrite', pinned: true, manualOverride: true });
  });
  it('updates presentation without queuing source processing', () => {
    const ready = base(); ready.processing = { status: 'ready', stage: 'done', generation: 2, sourceFingerprint: 'a'.repeat(64), error: null };
    const result = planCohortAction(ready, { type: 'edit_presentation', title: 'My course', description: 'My public description' }, context);
    expect(result.nextState).toMatchObject({ title: 'My course', description: 'My public description', processing: ready.processing });
  });
  it('rejects stale revision and malformed order', () => {
    expect(() => planCohortAction(base(), { type: 'set_intent', intent: 'New' }, { ...context, expectedRevision: 1 })).toThrow('STALE_WORKSPACE');
    expect(() => planCohortAction(base(), { type: 'reorder_lessons', lessonIds: ['l1', 'l1'] }, context)).toThrow('INVALID_LESSON_ORDER');
    expect(() => planCohortAction(base(), { type: 'edit_lesson', lessonId: 'l1', objective: 'New' }, { ...context, entityVersions: new Map([['l1', 4]]) })).toThrow('STALE_ENTITY');
  });
  it('adds and removes lessons while respecting locks', () => {
    const added = planCohortAction(base(), { type: 'add_lesson', title: 'Generics', objective: 'Learn generics' }, context);
    expect(added.nextState.lessons).toHaveLength(3);
    expect(added.nextState.lessons[2].title).toBe('Generics');

    const removed = planCohortAction(base(), { type: 'remove_lesson', lessonId: 'l1' }, context);
    expect(removed.nextState.lessons).toHaveLength(1);
    expect(removed.nextState.lessons[0].id).toBe('l2');

    const pinned = base(); pinned.lessons[0].pinned = true;
    expect(() => planCohortAction(pinned, { type: 'remove_lesson', lessonId: 'l1' }, context)).toThrow('PINNED_LESSON_LOCKED');
  });

  it('queues retained text without inventing evidence during the user action', () => {
    const withSource = planCohortAction(base(), {
      type: 'add_text_source', sourceId: 'source-1', label: 'Systems notes',
      text: 'Consensus makes replicas agree on order. Quorums tolerate a minority of failures.',
    }, context).nextState;
    expect(withSource.processing).toMatchObject({ status: 'queued', stage: 'acquisition' });
    expect(withSource.sources[0].checksum).toBeNull();
    expect(withSource.chunks).toHaveLength(0);
  });

  it('does not process a workspace without retained source text', () => {
    expect(() => planCohortAction(base(), { type: 'retry_processing' }, context)).toThrow('NO_SOURCES');
  });
});

describe('conversational co-design transitions', () => {
  const chat = () => ({ ...base(), lessons: [], journey: { version: 1 as const, step: 'chat' as const, branch: null, processingStarted: false, intentVersion: 0 } });
  it('opens requested navigation directly from chat', () => {
    expect(planCohortAction(chat(), { type: 'create_own_cohort' }, context).nextState.journey?.step).toBe('starting_point');
    for (const choice of ['have_goal', 'have_material', 'find_material'] as const) {
      expect(planCohortAction(chat(), { type: 'choose_starting_point', choice }, context).nextState.journey?.branch).toBe(choice);
    }
  });
  it('opens review when drafting without masking active processing', () => {
    const action = { type: 'add_lesson' as const, title: 'Foundations', objective: 'Apply foundations' };
    expect(planCohortAction(chat(), action, context).nextState).toMatchObject({ journey: { step: 'review' }, processing: { status: 'ready' } });
    const busy = chat(); busy.processing.status = 'queued';
    expect(planCohortAction(busy, action, context).nextState.processing.status).toBe('queued');
  });
  it.each(['chat', 'review'] as const)('generates a guide directly from %s', step => {
    const state: CohortWorkspace = chat(); state.journey!.step = step;
    const result = planCohortAction(state, { type: 'start_goal_generation' }, context).nextState;
    expect(result.journey).toMatchObject({ branch: 'have_goal', processingStarted: true });
    expect(result.sources[0].input).toMatchObject({ kind: 'generated_guide', dailyMinutes: 20 });
  });
  it.each(['chat', 'review'] as const)('processes retained sources directly from %s and rejects missing sources', step => {
    const state: CohortWorkspace = chat(); state.journey!.step = step;
    expect(() => planCohortAction(state, { type: 'begin_material_processing' }, context)).toThrow('NO_SOURCES');
    const retained = planCohortAction(state, { type: 'add_text_source', label: 'Notes', text: 'Quorum consensus requires overlapping majorities.' }, context).nextState;
    const result = planCohortAction(retained, { type: 'begin_material_processing' }, context).nextState;
    expect(result.journey).toMatchObject({ processingStarted: true, branch: 'have_material' });
    expect(result.processing.status).not.toBe('idle');
  });
  it('starts resource discovery directly from chat', () => {
    expect(planCohortAction(chat(), { type: 'start_discovery' }, context).nextState).toMatchObject({ journey: { step: 'discovery', branch: 'find_material' }, discovery: { status: 'queued' } });
  });
});
