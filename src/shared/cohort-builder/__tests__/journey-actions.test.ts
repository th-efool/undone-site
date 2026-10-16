import { describe, expect, it } from 'vitest';
import {
  cohortWorkspaceSchema,
  planCohortAction,
  type CohortWorkspace,
  type CohortActionContext,
  type CohortDiscovery,
  type CohortRecommendations,
} from '../contracts';
import { initialCohort } from '../intake';

const workspaceId = '00000000-0000-4000-8000-000000000001';

function createActionContext(overrides?: Partial<CohortActionContext>): CohortActionContext {
  return {
    actionId: 'action-test-1',
    workspaceId,
    expectedRevision: 0,
    currentRevision: 0,
    entityVersions: new Map(),
    ...overrides,
  };
}

function createLegacyWorkspace(): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Legacy Draft',
    intent: 'Learn Distributed Systems',
    audience: 'Engineers',
    dailyMinutes: 30,
    lessons: [
      { id: 'l1', version: 0, title: 'Consensus', objective: 'Understand Paxos and Raft', sourceChunkIds: ['c1'], pinned: false },
      { id: 'l2', version: 0, title: 'Replication', objective: 'Primary-backup replication', sourceChunkIds: ['c2'], pinned: false },
    ],
    sources: [
      { id: 's1', version: 0, label: 'Raft Paper', text: 'Raft is a consensus algorithm...', checksum: 'a'.repeat(64), state: 'ready' },
    ],
    chunks: [
      { id: 'c1', sourceId: 's1', sourceVersion: 0, start: 0, end: 30, text: 'Raft is a consensus algorithm...', checksum: 'b'.repeat(64) },
      { id: 'c2', sourceId: 's1', sourceVersion: 0, start: 31, end: 60, text: 'Replication handles crashes...', checksum: 'c'.repeat(64) },
    ],
    processing: {
      status: 'idle',
      stage: 'done',
      generation: 1,
      sourceFingerprint: 'fp-legacy',
      error: null,
    },
  });
}

function createReadyAssemblyWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Ready Workspace',
    intent: 'Master Distributed Systems',
    audience: 'Engineers',
    dailyMinutes: 25,
    lessons: [
      { id: 'l1', version: 0, title: 'Lesson 1', objective: 'Objective 1', sourceChunkIds: ['c1'], pinned: false },
    ],
    sources: [
      { id: 's1', version: 0, label: 'Source 1', text: 'Content of source 1', checksum: 'a'.repeat(64), state: 'ready' },
    ],
    chunks: [
      { id: 'c1', sourceId: 's1', sourceVersion: 0, start: 0, end: 20, text: 'Content of source 1', checksum: 'b'.repeat(64) },
    ],
    processing: {
      status: 'ready',
      stage: 'done',
      generation: 1,
      sourceFingerprint: 'fp-ready-123',
      error: null,
    },
    journey: {
      version: 1,
      step: 'ready',
      branch: 'have_material',
      processingStarted: true,
      intentVersion: 0,
    },
    ...overrides,
  });
}

describe('Cohort Journey: Old snapshots compatibility', () => {
  it('parses legacy snapshot cleanly without journey property', () => {
    const legacy = createLegacyWorkspace();
    expect(legacy.journey).toBeUndefined();
    const parsed = cohortWorkspaceSchema.parse(legacy);
    expect(parsed.journey).toBeUndefined();
  });

  it('preserves journey=undefined across non-journey actions on legacy snapshots', () => {
    const legacy = createLegacyWorkspace();
    const ctx = createActionContext();

    // add_text_source
    const afterAdd = planCohortAction(legacy, {
      type: 'add_text_source',
      sourceId: 's2',
      label: 'Paxos Notes',
      text: 'Paxos achieves consensus through two phases.',
    }, ctx).nextState;
    expect(afterAdd.journey).toBeUndefined();
    expect(afterAdd.processing.status).toBe('queued');

    // set_intent
    const afterIntent = planCohortAction(afterAdd, {
      type: 'set_intent',
      intent: 'New goal for systems',
    }, ctx).nextState;
    expect(afterIntent.journey).toBeUndefined();

    // edit_lesson
    const afterEditLesson = planCohortAction(afterIntent, {
      type: 'edit_lesson',
      lessonId: 'l1',
      title: 'Advanced Consensus',
    }, ctx).nextState;
    expect(afterEditLesson.journey).toBeUndefined();

    // remove_lesson
    const afterRemoveLesson = planCohortAction(afterEditLesson, {
      type: 'remove_lesson',
      lessonId: 'l2',
    }, ctx).nextState;
    expect(afterRemoveLesson.journey).toBeUndefined();

    // add_lesson
    const afterAddLesson = planCohortAction(afterRemoveLesson, {
      type: 'add_lesson',
      title: 'Transactions',
      objective: 'Two-phase commit',
    }, ctx).nextState;
    expect(afterAddLesson.journey).toBeUndefined();

    // set_audience
    const afterAudience = planCohortAction(afterAddLesson, {
      type: 'set_audience',
      audience: 'Senior Architects',
    }, ctx).nextState;
    expect(afterAudience.journey).toBeUndefined();

    // set_daily_minutes
    const afterMinutes = planCohortAction(afterAudience, {
      type: 'set_daily_minutes',
      dailyMinutes: 45,
    }, ctx).nextState;
    expect(afterMinutes.journey).toBeUndefined();

    // retry_processing
    const afterRetry = planCohortAction(afterMinutes, {
      type: 'retry_processing',
    }, ctx).nextState;
    expect(afterRetry.journey).toBeUndefined();
    expect(afterRetry.processing.status).toBe('queued');
  });

  it('resumes journey cleanly if a journey action is invoked on a legacy workspace with existing content', () => {
    const legacy = createLegacyWorkspace();
    const ctx = createActionContext();

    // Navigating back to starting point initializes journey with processingStarted=true because sources exist
    const plan = planCohortAction(legacy, { type: 'back_to_starting_point' }, ctx);
    expect(plan.nextState.journey).toBeDefined();
    expect(plan.nextState.journey?.step).toBe('starting_point');
    expect(plan.nextState.journey?.processingStarted).toBe(true);
    expect(plan.nextState.sources).toHaveLength(legacy.sources.length);
  });

  it('resumes journey with processingStarted=false if invoked on an empty legacy workspace', () => {
    const emptyLegacy = cohortWorkspaceSchema.parse({
      schemaVersion: 1,
      title: 'Empty Draft',
      intent: 'Learn Go',
      audience: '',
      dailyMinutes: 20,
      lessons: [],
      sources: [],
    });
    const ctx = createActionContext();

    const plan = planCohortAction(emptyLegacy, { type: 'create_own_cohort' }, ctx);
    expect(plan.nextState.journey).toBeDefined();
    expect(plan.nextState.journey?.step).toBe('starting_point');
    expect(plan.nextState.journey?.processingStarted).toBe(false);
  });
});

describe('Cohort Journey: New initial state', () => {
  it('creates workspace with initial recommendations step and processingStarted=false', () => {
    const ws = initialCohort('Learn Rust in 30 Days');
    expect(ws.intent).toBe('Learn Rust in 30 Days');
    expect(ws.journey).toBeDefined();
    expect(ws.journey).toEqual({
      version: 1,
      step: 'recommendations',
      branch: null,
      processingStarted: false,
      intentVersion: 0,
    });
    expect(ws.processing.status).toBe('idle');
    expect(ws.processing.stage).toBe('done');
    expect(ws.sources).toHaveLength(0);
    expect(ws.lessons).toHaveLength(0);
  });
});

describe('Cohort Journey: Step transitions & prerequisites', () => {
  it('transitions recommendations -> starting_point via create_own_cohort', () => {
    const ws = initialCohort('Learn Python');
    const ctx = createActionContext();

    const plan = planCohortAction(ws, { type: 'create_own_cohort' }, ctx);
    expect(plan.nextState.journey?.step).toBe('starting_point');
    expect(plan.nextState.journey?.branch).toBeNull();
    expect(plan.summary).toBe('Starting point opened.');
  });

  it('rejects create_own_cohort if called from any step other than recommendations', () => {
    const ws = initialCohort('Learn Python');
    ws.journey!.step = 'starting_point';
    const ctx = createActionContext();

    expect(() => planCohortAction(ws, { type: 'create_own_cohort' }, ctx)).toThrow('INVALID_JOURNEY_TRANSITION');

    ws.journey!.step = 'material_input';
    expect(() => planCohortAction(ws, { type: 'create_own_cohort' }, ctx)).toThrow('INVALID_JOURNEY_TRANSITION');

    ws.journey!.step = 'processing';
    expect(() => planCohortAction(ws, { type: 'create_own_cohort' }, ctx)).toThrow('INVALID_JOURNEY_TRANSITION');
  });

  it('branches correctly at choose_starting_point', () => {
    const baseStartingPoint = () => {
      const ws = initialCohort('Learn Haskell');
      ws.journey!.step = 'starting_point';
      return ws;
    };
    const ctx = createActionContext();

    // have_material -> material_input
    const planMat = planCohortAction(baseStartingPoint(), { type: 'choose_starting_point', choice: 'have_material' }, ctx);
    expect(planMat.nextState.journey?.step).toBe('material_input');
    expect(planMat.nextState.journey?.branch).toBe('have_material');

    // find_material -> discovery
    const planDisc = planCohortAction(baseStartingPoint(), { type: 'choose_starting_point', choice: 'find_material' }, ctx);
    expect(planDisc.nextState.journey?.step).toBe('discovery');
    expect(planDisc.nextState.journey?.branch).toBe('find_material');

    // have_goal -> goal_setup
    const planGoal = planCohortAction(baseStartingPoint(), { type: 'choose_starting_point', choice: 'have_goal' }, ctx);
    expect(planGoal.nextState.journey?.step).toBe('goal_setup');
    expect(planGoal.nextState.journey?.branch).toBe('have_goal');
  });

  it('rejects choose_starting_point from wrong step', () => {
    const ws = initialCohort('Learn Haskell');
    const ctx = createActionContext();

    // In recommendations step
    expect(() => planCohortAction(ws, { type: 'choose_starting_point', choice: 'have_material' }, ctx)).toThrow('INVALID_JOURNEY_TRANSITION');

    // In material_input step
    ws.journey!.step = 'material_input';
    expect(() => planCohortAction(ws, { type: 'choose_starting_point', choice: 'have_material' }, ctx)).toThrow('INVALID_JOURNEY_TRANSITION');
  });

  it('handles back navigation to recommendations and starting_point', () => {
    const ws = initialCohort('Learn SQL');
    ws.journey!.step = 'material_input';
    ws.journey!.branch = 'have_material';
    ws.journey!.processingStarted = true;
    ws.sources.push({
      id: 's1',
      version: 0,
      label: 'SQL Basics',
      text: 'SELECT * FROM users;',
      checksum: 'd'.repeat(64),
      state: 'ready',
    });
    const ctx = createActionContext();

    // Back to starting_point
    const toStart = planCohortAction(ws, { type: 'back_to_starting_point' }, ctx).nextState;
    expect(toStart.journey?.step).toBe('starting_point');
    expect(toStart.journey?.processingStarted).toBe(true);
    expect(toStart.sources).toHaveLength(1);

    // Back to recommendations
    const toRec = planCohortAction(toStart, { type: 'back_to_recommendations' }, ctx).nextState;
    expect(toRec.journey?.step).toBe('recommendations');
    expect(toRec.journey?.processingStarted).toBe(true);
    expect(toRec.sources).toHaveLength(1);
  });

  it('rejects back navigation once cohort is published', () => {
    const ws = initialCohort('Published cohort');
    ws.journey!.step = 'published';
    const ctx = createActionContext();

    expect(() => planCohortAction(ws, { type: 'back_to_recommendations' }, ctx)).toThrow('INVALID_JOURNEY_TRANSITION');
    expect(() => planCohortAction(ws, { type: 'back_to_starting_point' }, ctx)).toThrow('INVALID_JOURNEY_TRANSITION');
  });

  it('enqueues discovery when step=discovery and branch=find_material', () => {
    const ws = initialCohort('Search resources for Docker');
    ws.journey!.step = 'discovery';
    ws.journey!.branch = 'find_material';
    const ctx = createActionContext({ actionId: 'action-disc-1' });

    const plan = planCohortAction(ws, { type: 'start_discovery' }, ctx);
    expect(plan.nextState.discovery).toBeDefined();
    expect(plan.nextState.discovery?.status).toBe('queued');
    expect(plan.nextState.discovery?.requestId).toBe('action-disc-1');
    expect(plan.nextState.discovery?.fingerprint).toBe('pending:0:action-disc-1');
    expect(plan.nextState.discovery?.generation).toBe(0);

    // Calling again while queued retains existing discovery
    const planRetained = planCohortAction(plan.nextState, { type: 'start_discovery' }, createActionContext({ actionId: 'action-disc-2' }));
    expect(planRetained.summary).toBe('Existing discovery retained.');
    expect(planRetained.nextState.discovery?.requestId).toBe('action-disc-1');
  });

  it('rejects start_discovery from wrong step or branch', () => {
    const ws = initialCohort('Docker');
    const ctx = createActionContext();

    // Wrong step
    ws.journey!.step = 'material_input';
    ws.journey!.branch = 'find_material';
    expect(() => planCohortAction(ws, { type: 'start_discovery' }, ctx)).toThrow('INVALID_JOURNEY_TRANSITION');

    // Wrong branch
    ws.journey!.step = 'discovery';
    ws.journey!.branch = 'have_material';
    expect(() => planCohortAction(ws, { type: 'start_discovery' }, ctx)).toThrow('INVALID_JOURNEY_BRANCH');
  });

  it('select_discovery_resources validates proof, projection, candidates, and transitions to material_input', () => {
    const ws = initialCohort('Docker Guides');
    ws.journey!.step = 'discovery';
    ws.journey!.branch = 'find_material';
    const discoveryItems = [
      { id: 'cand-1', label: 'Docker Docs', kind: 'web' as const, url: 'https://docs.docker.com/engine' },
      { id: 'cand-2', label: 'Docker Compose', kind: 'web' as const, url: 'https://docs.docker.com/compose' },
    ];
    const projection: CohortDiscovery = {
      requestId: 'req-1',
      fingerprint: 'fp-disc-123',
      status: 'ready',
      resultId: 'res-1',
      generation: 0,
      items: discoveryItems,
    };
    ws.discovery = projection;

    const ctx = createActionContext({
      actionId: 'action-select-1',
      discoveryResult: {
        resultId: 'res-1',
        fingerprint: 'fp-disc-123',
        items: discoveryItems,
      },
    });

    const plan = planCohortAction(ws, {
      type: 'select_discovery_resources',
      resultId: 'res-1',
      candidateIds: ['cand-1', 'cand-2'],
    }, ctx);

    expect(plan.nextState.journey?.step).toBe('material_input');
    expect(plan.nextState.sources).toHaveLength(2);
    expect(plan.nextState.sources[0].input).toEqual({ kind: 'web', url: 'https://docs.docker.com/engine' });
    expect(plan.nextState.sources[1].input).toEqual({ kind: 'web', url: 'https://docs.docker.com/compose' });
    // processingStarted is false, so processing stays idle
    expect(plan.nextState.processing.status).toBe('idle');
  });

  it('select_discovery_resources rejects invalid results or candidates', () => {
    const baseDisc = () => {
      const ws = initialCohort('Docker');
      ws.journey!.step = 'discovery';
      ws.journey!.branch = 'find_material';
      ws.discovery = {
        requestId: 'req-1',
        fingerprint: 'fp-valid',
        status: 'ready',
        resultId: 'res-valid',
        generation: 0,
        items: [{ id: 'cand-1', label: 'Valid', kind: 'web', url: 'https://docker.com' }],
      };
      return ws;
    };

    // Missing proof
    expect(() => planCohortAction(baseDisc(), {
      type: 'select_discovery_resources',
      resultId: 'res-valid',
      candidateIds: ['cand-1'],
    }, createActionContext())).toThrow('INVALID_DISCOVERY_RESULT');

    // Mismatched resultId in proof
    expect(() => planCohortAction(baseDisc(), {
      type: 'select_discovery_resources',
      resultId: 'res-valid',
      candidateIds: ['cand-1'],
    }, createActionContext({
      discoveryResult: { resultId: 'mismatched', fingerprint: 'fp-valid', items: [] },
    }))).toThrow('INVALID_DISCOVERY_RESULT');

    // Mismatched fingerprint
    expect(() => planCohortAction(baseDisc(), {
      type: 'select_discovery_resources',
      resultId: 'res-valid',
      candidateIds: ['cand-1'],
    }, createActionContext({
      discoveryResult: { resultId: 'res-valid', fingerprint: 'fp-tampered', items: [] },
    }))).toThrow('INVALID_DISCOVERY_RESULT');

    // Unknown candidateId
    expect(() => planCohortAction(baseDisc(), {
      type: 'select_discovery_resources',
      resultId: 'res-valid',
      candidateIds: ['cand-unknown'],
    }, createActionContext({
      discoveryResult: {
        resultId: 'res-valid',
        fingerprint: 'fp-valid',
        items: [{ id: 'cand-1', label: 'Valid', kind: 'web', url: 'https://docker.com' }],
      },
    }))).toThrow('INVALID_DISCOVERY_CANDIDATE');
  });

  it('start_goal_generation creates generated-guide source and begins processing', () => {
    const ws = initialCohort('Master Kubernetes Architecture');
    ws.journey!.step = 'goal_setup';
    ws.journey!.branch = 'have_goal';
    ws.audience = 'DevOps Engineers';
    ws.dailyMinutes = 30;
    const ctx = createActionContext({ actionId: 'action-goal-1' });

    const plan = planCohortAction(ws, { type: 'start_goal_generation' }, ctx);
    expect(plan.nextState.journey?.step).toBe('processing');
    expect(plan.nextState.journey?.processingStarted).toBe(true);
    expect(plan.nextState.processing.status).toBe('queued');
    expect(plan.nextState.processing.stage).toBe('acquisition');

    expect(plan.nextState.sources).toHaveLength(1);
    const guideSource = plan.nextState.sources[0];
    expect(guideSource.id).toBe('generated-guide:0');
    expect(guideSource.input).toEqual({
      kind: 'generated_guide',
      goal: 'Master Kubernetes Architecture',
      audience: 'DevOps Engineers',
      dailyMinutes: 30,
      intentVersion: 0,
    });
  });

  it('start_goal_generation rejects wrong branch or wrong step', () => {
    const ctx = createActionContext();

    // Wrong branch (have_material instead of have_goal)
    const wsWrongBranch = initialCohort('Master Kubernetes');
    wsWrongBranch.journey!.step = 'goal_setup';
    wsWrongBranch.journey!.branch = 'have_material';
    expect(() => planCohortAction(wsWrongBranch, { type: 'start_goal_generation' }, ctx)).toThrow('GOAL_NOT_CONFIRMED');

    // Wrong step (material_input instead of goal_setup)
    const wsWrongStep = initialCohort('Master Kubernetes');
    wsWrongStep.journey!.step = 'material_input';
    wsWrongStep.journey!.branch = 'have_goal';
    expect(() => planCohortAction(wsWrongStep, { type: 'start_goal_generation' }, ctx)).toThrow('INVALID_JOURNEY_TRANSITION');
  });

  it('begin_material_processing requires material_input step, valid branch, and at least one source', () => {
    const ws = initialCohort('Learn Linux Internals');
    ws.journey!.step = 'material_input';
    ws.journey!.branch = 'have_material';
    const ctx = createActionContext();

    // No sources yet -> NO_SOURCES
    expect(() => planCohortAction(ws, { type: 'begin_material_processing' }, ctx)).toThrow('NO_SOURCES');

    // Add a source
    ws.sources.push({
      id: 'src-1',
      version: 0,
      label: 'Kernel Notes',
      text: 'Linux kernel subsystems include memory management and scheduling.',
      checksum: 'e'.repeat(64),
      state: 'ready',
    });

    // Wrong branch (have_goal on material_input)
    ws.journey!.branch = 'have_goal';
    expect(() => planCohortAction(ws, { type: 'begin_material_processing' }, ctx)).toThrow('NO_SOURCES');

    // Valid branch -> succeeds
    ws.journey!.branch = 'have_material';
    const plan = planCohortAction(ws, { type: 'begin_material_processing' }, ctx);
    expect(plan.nextState.journey?.step).toBe('processing');
    expect(plan.nextState.journey?.processingStarted).toBe(true);
    expect(plan.nextState.processing.status).toBe('queued');
    expect(plan.nextState.processing.stage).toBe('acquisition');
  });

  it('open_review requires step=ready, accepted assembly (ready status, fingerprint, lessons > 0)', () => {
    const ws = createReadyAssemblyWorkspace();
    const ctx = createActionContext();

    const plan = planCohortAction(ws, { type: 'open_review' }, ctx);
    expect(plan.nextState.journey?.step).toBe('review');
    expect(plan.summary).toBe('Curriculum review opened.');
  });

  it('open_review rejects unready assembly or wrong step', () => {
    const ctx = createActionContext();

    // Step not ready
    const wrongStep = createReadyAssemblyWorkspace();
    wrongStep.journey!.step = 'processing';
    expect(() => planCohortAction(wrongStep, { type: 'open_review' }, ctx)).toThrow('INVALID_JOURNEY_TRANSITION');

    // Processing status not ready
    const notReadyStatus = createReadyAssemblyWorkspace();
    notReadyStatus.processing.status = 'processing';
    expect(() => planCohortAction(notReadyStatus, { type: 'open_review' }, ctx)).toThrow('ASSEMBLY_NOT_READY');

    // Missing fingerprint
    const noFp = createReadyAssemblyWorkspace();
    noFp.processing.sourceFingerprint = null;
    expect(() => planCohortAction(noFp, { type: 'open_review' }, ctx)).toThrow('ASSEMBLY_NOT_READY');

    // Zero lessons
    const noLessons = createReadyAssemblyWorkspace();
    noLessons.lessons = [];
    expect(() => planCohortAction(noLessons, { type: 'open_review' }, ctx)).toThrow('ASSEMBLY_NOT_READY');
  });

  it('marks journey.step=published when release is committed', () => {
    const ws = createReadyAssemblyWorkspace({
      release: {
        status: 'prepared',
        mode: 'public_publish',
        candidateHash: 'f'.repeat(64),
      },
    });
    ws.journey!.step = 'review';
    const ctx = createActionContext();

    const plan = planCohortAction(ws, {
      type: 'commit_release',
      mode: 'public_publish',
      candidateHash: 'f'.repeat(64),
    }, ctx);

    expect(plan.nextState.journey?.step).toBe('published');
    expect(plan.nextState.release?.status).toBe('released');

    // Further navigation from published is rejected
    expect(() => planCohortAction(plan.nextState, { type: 'back_to_starting_point' }, ctx)).toThrow('INVALID_JOURNEY_TRANSITION');
    expect(() => planCohortAction(plan.nextState, { type: 'back_to_recommendations' }, ctx)).toThrow('INVALID_JOURNEY_TRANSITION');
  });
});

describe('Cohort Journey: Processing started behavior gate', () => {
  it('retains source inputs without queuing processing before explicit Continue', () => {
    const ws = initialCohort('Learn Rust');
    ws.journey!.step = 'material_input';
    ws.journey!.branch = 'have_material';
    expect(ws.journey!.processingStarted).toBe(false);
    expect(ws.processing.status).toBe('idle');

    const ctx = createActionContext({ actionId: 'act-add-text' });

    // Add text source
    const state1 = planCohortAction(ws, {
      type: 'add_text_source',
      label: 'Rust Borrow Checker',
      text: 'Lifetimes ensure memory safety at compile time without a garbage collector.',
    }, ctx).nextState;
    expect(state1.sources).toHaveLength(1);
    expect(state1.processing.status).toBe('idle');
    expect(state1.journey?.processingStarted).toBe(false);

    // Add web source
    const state2 = planCohortAction(state1, {
      type: 'add_web_source',
      sourceId: 'web-src',
      label: 'Rust Book',
      url: 'https://doc.rust-lang.org/book',
    }, createActionContext({ actionId: 'act-add-web' })).nextState;
    expect(state2.sources).toHaveLength(2);
    expect(state2.processing.status).toBe('idle');

    // Edit text source
    const state3 = planCohortAction(state2, {
      type: 'edit_text_source',
      sourceId: state1.sources[0].id,
      label: 'Rust Borrow Checker v2',
      text: 'Updated lifetime notes.',
    }, createActionContext({ actionId: 'act-edit-text' })).nextState;
    expect(state3.sources[0].label).toBe('Rust Borrow Checker v2');
    expect(state3.processing.status).toBe('idle');

    // Remove a source
    const state4 = planCohortAction(state3, {
      type: 'remove_source',
      sourceId: 'web-src',
    }, createActionContext({ actionId: 'act-remove' })).nextState;
    expect(state4.sources).toHaveLength(1);
    expect(state4.processing.status).toBe('idle');

    // retry_processing / retry_text_job throws PROCESSING_NOT_STARTED while processingStarted is false
    expect(() => planCohortAction(state4, { type: 'retry_processing' }, ctx)).toThrow('PROCESSING_NOT_STARTED');
    expect(() => planCohortAction(state4, { type: 'retry_text_job', jobId: 'job-1' }, ctx)).toThrow('PROCESSING_NOT_STARTED');
  });

  it('queues processing on subsequent source mutations once processingStarted=true', () => {
    const ws = initialCohort('Learn Rust');
    ws.journey!.step = 'material_input';
    ws.journey!.branch = 'have_material';
    ws.sources.push({
      id: 's1',
      version: 0,
      label: 'Initial notes',
      text: 'Rust concurrency concepts.',
      checksum: 'a'.repeat(64),
      state: 'ready',
    });

    const ctx = createActionContext({ actionId: 'continue-action' });

    // Click Continue (begin_material_processing)
    const continued = planCohortAction(ws, { type: 'begin_material_processing' }, ctx).nextState;
    expect(continued.journey?.processingStarted).toBe(true);
    expect(continued.processing.status).toBe('queued');

    // Now adding another source queues processing
    const withNewSource = planCohortAction(continued, {
      type: 'add_text_source',
      sourceId: 's2',
      label: 'Channels',
      text: 'Channels transfer data across threads.',
    }, createActionContext({ actionId: 'add-more' })).nextState;
    expect(withNewSource.sources).toHaveLength(2);
    expect(withNewSource.processing.status).toBe('queued');

    // Removing a source also triggers queue
    const afterRemove = planCohortAction(withNewSource, {
      type: 'remove_source',
      sourceId: 's1',
    }, createActionContext({ actionId: 'remove-s1' })).nextState;
    expect(afterRemove.sources).toHaveLength(1);
    expect(afterRemove.processing.status).toBe('queued');

    // retry_processing succeeds
    const afterRetry = planCohortAction(afterRemove, { type: 'retry_processing' }, createActionContext({ actionId: 'retry' }));
    expect(afterRetry.nextState.processing.status).toBe('queued');
  });

  it('back navigation preserves processingStarted=true and retains sources & accepted lessons', () => {
    const ws = createReadyAssemblyWorkspace();
    expect(ws.journey?.processingStarted).toBe(true);
    const ctx = createActionContext();

    // Go back to starting_point
    const atStart = planCohortAction(ws, { type: 'back_to_starting_point' }, ctx).nextState;
    expect(atStart.journey?.step).toBe('starting_point');
    expect(atStart.journey?.processingStarted).toBe(true);
    expect(atStart.sources).toHaveLength(1);
    expect(atStart.lessons).toHaveLength(1);

    // Go back to recommendations
    const atRec = planCohortAction(atStart, { type: 'back_to_recommendations' }, ctx).nextState;
    expect(atRec.journey?.step).toBe('recommendations');
    expect(atRec.journey?.processingStarted).toBe(true);
    expect(atRec.sources).toHaveLength(1);
    expect(atRec.lessons).toHaveLength(1);
  });
});

describe('Cohort Journey: Intent changes & projection invalidation', () => {
  it('increments intentVersion and clears recommendations & discovery projections on intent change', () => {
    const ws = initialCohort('Initial Goal');
    const recommendations: CohortRecommendations = {
      requestId: 'req-rec-1',
      fingerprint: 'fp-rec',
      status: 'ready',
      generation: 0,
      items: [{ id: 'rec-1', label: 'Existing cohort', url: 'https://example.com/cohort' }],
    };
    const discovery: CohortDiscovery = {
      requestId: 'req-disc-1',
      fingerprint: 'fp-disc',
      status: 'ready',
      resultId: 'res-disc-1',
      generation: 0,
      items: [{ id: 'd-1', label: 'Discovery item', kind: 'web', url: 'https://example.com/article' }],
    };
    ws.recommendations = recommendations;
    ws.discovery = discovery;
    expect(ws.journey?.intentVersion).toBe(0);

    const ctx = createActionContext();

    // Change intent to something new
    const plan = planCohortAction(ws, { type: 'set_intent', intent: 'Completely New Goal' }, ctx);
    expect(plan.nextState.intent).toBe('Completely New Goal');
    expect(plan.nextState.journey?.intentVersion).toBe(1);
    expect(plan.nextState.recommendations).toBeUndefined();
    expect(plan.nextState.discovery).toBeUndefined();
  });

  it('does NOT bump intentVersion or delete projections if intent is identical', () => {
    const ws = initialCohort('Unchanged Goal');
    ws.recommendations = {
      requestId: 'req-rec-1',
      fingerprint: 'fp-rec',
      status: 'ready',
      generation: 0,
      items: [],
    };
    const ctx = createActionContext();

    const plan = planCohortAction(ws, { type: 'set_intent', intent: 'Unchanged Goal' }, ctx);
    expect(plan.nextState.journey?.intentVersion).toBe(0);
    expect(plan.nextState.recommendations).toBeDefined();
  });
});

describe('Cohort Journey: Concurrency & CAS guarantees', () => {
  it('rejects action with STALE_WORKSPACE when expectedRevision !== currentRevision', () => {
    const ws = initialCohort('Learn Concurrency');
    const staleContext = createActionContext({
      expectedRevision: 1,
      currentRevision: 2,
    });

    expect(() => planCohortAction(ws, { type: 'create_own_cohort' }, staleContext)).toThrow('STALE_WORKSPACE');
    expect(() => planCohortAction(ws, { type: 'choose_starting_point', choice: 'have_material' }, staleContext)).toThrow('STALE_WORKSPACE');
    expect(() => planCohortAction(ws, { type: 'back_to_recommendations' }, staleContext)).toThrow('STALE_WORKSPACE');
    expect(() => planCohortAction(ws, { type: 'begin_material_processing' }, staleContext)).toThrow('STALE_WORKSPACE');
  });

  it('rejects entity updates with STALE_ENTITY when entity version does not match', () => {
    const ws = createReadyAssemblyWorkspace();
    const staleEntityContext = createActionContext({
      entityVersions: new Map([['l1', 99]]),
    });

    expect(() => planCohortAction(ws, {
      type: 'edit_lesson',
      lessonId: 'l1',
      title: 'New Title',
    }, staleEntityContext)).toThrow('STALE_ENTITY');
  });

  it('rejects duplicate or stale actions when expectedRevision does not match currentRevision', () => {
    const ws = initialCohort('Learn Concurrency');
    const ctx0 = createActionContext({ expectedRevision: 0, currentRevision: 0 });

    // First action succeeds
    const res1 = planCohortAction(ws, { type: 'create_own_cohort' }, ctx0);
    expect(res1.nextState.journey?.step).toBe('starting_point');

    // Duplicate action attempting to replay revision 0 when workspace is at revision 1
    const ctxStale = createActionContext({ expectedRevision: 0, currentRevision: 1 });
    expect(() => planCohortAction(res1.nextState, { type: 'create_own_cohort' }, ctxStale)).toThrow('STALE_WORKSPACE');
  });
});

describe('Cohort Journey: Detailed Source & Discovery Edge Cases', () => {
  it('updates existing generated-guide source and increments its version when goal details change', () => {
    const ws = initialCohort('Original Goal');
    ws.journey!.step = 'goal_setup';
    ws.journey!.branch = 'have_goal';
    ws.audience = 'Beginners';
    ws.dailyMinutes = 20;

    const ctx1 = createActionContext({ actionId: 'goal-1' });
    const plan1 = planCohortAction(ws, { type: 'start_goal_generation' }, ctx1);
    expect(plan1.nextState.sources[0].version).toBe(0);

    // Now change audience/goal in workspace
    const ws2 = plan1.nextState;
    ws2.journey!.step = 'goal_setup';
    ws2.audience = 'Advanced';

    const ctx2 = createActionContext({ actionId: 'goal-2' });
    const plan2 = planCohortAction(ws2, { type: 'start_goal_generation' }, ctx2);
    expect(plan2.nextState.sources).toHaveLength(1);
    expect(plan2.nextState.sources[0].version).toBe(1);
    expect(plan2.nextState.sources[0].input).toMatchObject({ audience: 'Advanced' });
  });

  it('rejects start_goal_generation if workspace already has 20 sources', () => {
    const ws = initialCohort('Many Sources Goal');
    ws.journey!.step = 'goal_setup';
    ws.journey!.branch = 'have_goal';
    for (let i = 0; i < 20; i++) {
      ws.sources.push({
        id: `s-${i}`,
        version: 0,
        label: `Source ${i}`,
        text: `Content ${i}`,
        checksum: 'a'.repeat(64),
        state: 'ready',
      });
    }

    const ctx = createActionContext({ actionId: 'goal-overflow' });
    expect(() => planCohortAction(ws, { type: 'start_goal_generation' }, ctx)).toThrow('TOO_MANY_SOURCES');
  });

  it('select_discovery_resources queues processing if processingStarted was already true', () => {
    const ws = initialCohort('Docker Guides');
    ws.journey!.step = 'discovery';
    ws.journey!.branch = 'find_material';
    ws.journey!.processingStarted = true; // previously started
    const discoveryItems = [
      { id: 'cand-1', label: 'Docker Docs', kind: 'web' as const, url: 'https://docs.docker.com/engine' },
    ];
    ws.discovery = {
      requestId: 'req-1',
      fingerprint: 'fp-disc-123',
      status: 'ready',
      resultId: 'res-1',
      generation: 0,
      items: discoveryItems,
    };

    const ctx = createActionContext({
      actionId: 'action-select-queued',
      discoveryResult: {
        resultId: 'res-1',
        fingerprint: 'fp-disc-123',
        items: discoveryItems,
      },
    });

    const plan = planCohortAction(ws, {
      type: 'select_discovery_resources',
      resultId: 'res-1',
      candidateIds: ['cand-1'],
    }, ctx);

    expect(plan.nextState.journey?.step).toBe('material_input');
    expect(plan.nextState.sources).toHaveLength(1);
    expect(plan.nextState.processing.status).toBe('queued');
  });

  it('select_discovery_resources rejects if sources would exceed 20', () => {
    const ws = initialCohort('Docker Guides');
    ws.journey!.step = 'discovery';
    ws.journey!.branch = 'find_material';
    for (let i = 0; i < 20; i++) {
      ws.sources.push({
        id: `s-${i}`,
        version: 0,
        label: `Source ${i}`,
        text: `Content ${i}`,
        checksum: 'a'.repeat(64),
        state: 'ready',
      });
    }
    const discoveryItems = [
      { id: 'cand-1', label: 'Docker Docs', kind: 'web' as const, url: 'https://docs.docker.com/engine' },
    ];
    ws.discovery = {
      requestId: 'req-1',
      fingerprint: 'fp-disc-123',
      status: 'ready',
      resultId: 'res-1',
      generation: 0,
      items: discoveryItems,
    };

    const ctx = createActionContext({
      discoveryResult: {
        resultId: 'res-1',
        fingerprint: 'fp-disc-123',
        items: discoveryItems,
      },
    });

    expect(() => planCohortAction(ws, {
      type: 'select_discovery_resources',
      resultId: 'res-1',
      candidateIds: ['cand-1'],
    }, ctx)).toThrow('TOO_MANY_SOURCES');
  });

  it('select_discovery_resources rejects duplicate candidates in action payload', () => {
    const ws = initialCohort('Docker Guides');
    ws.journey!.step = 'discovery';
    ws.journey!.branch = 'find_material';
    const discoveryItems = [
      { id: 'cand-1', label: 'Docker Docs', kind: 'web' as const, url: 'https://docs.docker.com/engine' },
    ];
    ws.discovery = {
      requestId: 'req-1',
      fingerprint: 'fp-disc-123',
      status: 'ready',
      resultId: 'res-1',
      generation: 0,
      items: discoveryItems,
    };

    const ctx = createActionContext({
      discoveryResult: {
        resultId: 'res-1',
        fingerprint: 'fp-disc-123',
        items: discoveryItems,
      },
    });

    expect(() => planCohortAction(ws, {
      type: 'select_discovery_resources',
      resultId: 'res-1',
      candidateIds: ['cand-1', 'cand-1'],
    }, ctx)).toThrow(); // Zod refine rejects duplicates
  });

  it('begin_material_processing succeeds with find_material branch when sources exist', () => {
    const ws = initialCohort('Learn Linux');
    ws.journey!.step = 'material_input';
    ws.journey!.branch = 'find_material';
    ws.sources.push({
      id: 'src-web-1',
      version: 0,
      label: 'Kernel docs',
      text: '',
      input: { kind: 'web', url: 'https://kernel.org/doc' },
      checksum: null,
      state: 'queued',
    });

    const ctx = createActionContext({ actionId: 'begin-proc' });
    const plan = planCohortAction(ws, { type: 'begin_material_processing' }, ctx);
    expect(plan.nextState.journey?.step).toBe('processing');
    expect(plan.nextState.journey?.processingStarted).toBe(true);
    expect(plan.nextState.processing.status).toBe('queued');
  });

  it('all input source types (pdf, youtube, github) stay idle before Continue', () => {
    const ws = initialCohort('Multi Source Intake');
    ws.journey!.step = 'material_input';
    ws.journey!.branch = 'have_material';
    expect(ws.journey!.processingStarted).toBe(false);

    // PDF source
    const s1 = planCohortAction(ws, {
      type: 'add_pdf_source',
      sourceId: 'pdf-1',
      label: 'Paper PDF',
      uploadId: '00000000-0000-4000-8000-000000000010',
    }, createActionContext({ actionId: 'a1' })).nextState;
    expect(s1.processing.status).toBe('idle');

    // YouTube source
    const s2 = planCohortAction(s1, {
      type: 'add_youtube_source',
      sourceId: 'yt-1',
      label: 'Lecture Video',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      track: { id: 'en-track', language: 'en', kind: 'automatic', translated: false },
    }, createActionContext({ actionId: 'a2' })).nextState;
    expect(s2.processing.status).toBe('idle');

    // GitHub source
    const s3 = planCohortAction(s2, {
      type: 'add_github_source',
      sourceId: 'gh-1',
      label: 'Code Repo',
      repoUrl: 'https://github.com/octocat/Hello-World',
      ref: 'main',
    }, createActionContext({ actionId: 'a3' })).nextState;
    expect(s3.processing.status).toBe('idle');
    expect(s3.sources).toHaveLength(3);

    // Scope update on PDF
    const s4 = planCohortAction(s3, {
      type: 'set_pdf_pages',
      sourceId: 'pdf-1',
      pages: [1, 2, 3],
    }, createActionContext({ actionId: 'a4' })).nextState;
    expect(s4.processing.status).toBe('idle');

    // Scope update on YouTube
    const s5 = planCohortAction(s4, {
      type: 'set_youtube_scope',
      sourceId: 'yt-1',
      scope: { startMs: 1000, endMs: 5000 },
    }, createActionContext({ actionId: 'a5' })).nextState;
    expect(s5.processing.status).toBe('idle');

    // Scope update on GitHub
    const s6 = planCohortAction(s5, {
      type: 'set_github_scope',
      sourceId: 'gh-1',
      paths: ['src/index.ts'],
    }, createActionContext({ actionId: 'a6' })).nextState;
    expect(s6.processing.status).toBe('idle');

    // Refresh web source stays idle too
    const sWeb = planCohortAction(s6, {
      type: 'add_web_source',
      sourceId: 'web-1',
      label: 'Docs',
      url: 'https://example.com/guide',
    }, createActionContext({ actionId: 'a7' })).nextState;
    const s7 = planCohortAction(sWeb, {
      type: 'refresh_web_source',
      sourceId: 'web-1',
      url: 'https://example.com/guide#updated',
    }, createActionContext({ actionId: 'a8' })).nextState;
    expect(s7.processing.status).toBe('idle');
  });

  describe('retry_recommendations action', () => {
    it('bumps generation, resets status to queued, and clears items', () => {
      const ws = initialCohort('Learn Distributed Systems');
      ws.recommendations = {
        requestId: 'req-old',
        fingerprint: 'fp-old',
        status: 'failed',
        generation: 0,
        items: [],
      };
      const ctx = createActionContext({ actionId: 'retry-1' });
      const plan = planCohortAction(ws, { type: 'retry_recommendations' }, ctx);
      expect(plan.nextState.recommendations?.status).toBe('queued');
      expect(plan.nextState.recommendations?.generation).toBe(1);
      expect(plan.nextState.recommendations?.requestId).toBe('retry-1');
      expect(plan.nextState.recommendations?.items).toEqual([]);
      expect(plan.summary).toBe('Recommendations queued for retry.');
    });

    it('rejects retry_recommendations if not in recommendations step', () => {
      const ws = initialCohort('Learn Distributed Systems');
      ws.journey!.step = 'starting_point';
      const ctx = createActionContext();
      expect(() => planCohortAction(ws, { type: 'retry_recommendations' }, ctx))
        .toThrow('INVALID_JOURNEY_TRANSITION');
    });
  });

  describe('cancel_discovery action', () => {
    it('sets discovery status to canceled when discovery is queued or running', () => {
      const ws = initialCohort('Learn Distributed Systems');
      ws.journey!.step = 'discovery';
      ws.journey!.branch = 'find_material';
      ws.discovery = {
        requestId: 'req-1',
        fingerprint: 'fp-1',
        status: 'running',
        generation: 0,
        items: [],
      };
      const ctx = createActionContext({ actionId: 'cancel-1' });
      const plan = planCohortAction(ws, { type: 'cancel_discovery' }, ctx);
      expect(plan.nextState.discovery?.status).toBe('canceled');
      expect(plan.summary).toBe('Resource discovery canceled.');
    });

    it('rejects cancel_discovery if not in discovery step or wrong branch', () => {
      const ws = initialCohort('Learn Distributed Systems');
      ws.journey!.step = 'material_input';
      ws.journey!.branch = 'have_material';
      ws.discovery = {
        requestId: 'req-1',
        fingerprint: 'fp-1',
        status: 'running',
        generation: 0,
        items: [],
      };
      const ctx = createActionContext();
      expect(() => planCohortAction(ws, { type: 'cancel_discovery' }, ctx))
        .toThrow('INVALID_JOURNEY_TRANSITION');
    });

    it('rejects cancel_discovery if no active discovery is running or queued', () => {
      const ws = initialCohort('Learn Distributed Systems');
      ws.journey!.step = 'discovery';
      ws.journey!.branch = 'find_material';
      ws.discovery = {
        requestId: 'req-1',
        fingerprint: 'fp-1',
        status: 'ready',
        resultId: 'res-1',
        generation: 0,
        items: [],
      };
      const ctx = createActionContext();
      expect(() => planCohortAction(ws, { type: 'cancel_discovery' }, ctx))
        .toThrow('NO_ACTIVE_DISCOVERY');
    });

    it('allows start_discovery to re-queue discovery after cancellation', () => {
      const ws = initialCohort('Learn Distributed Systems');
      ws.journey!.step = 'discovery';
      ws.journey!.branch = 'find_material';
      ws.discovery = {
        requestId: 'req-1',
        fingerprint: 'fp-1',
        status: 'canceled',
        generation: 0,
        items: [],
      };
      const ctx = createActionContext({ actionId: 'restart-1' });
      const plan = planCohortAction(ws, { type: 'start_discovery' }, ctx);
      expect(plan.nextState.discovery?.status).toBe('queued');
      expect(plan.nextState.discovery?.generation).toBe(1);
    });
  });
});

