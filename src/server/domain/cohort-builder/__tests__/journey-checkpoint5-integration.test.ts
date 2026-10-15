import { describe, expect, it } from 'vitest';
import {
  cohortWorkspaceSchema,
  planCohortAction,
  type CohortWorkspace,
  type CohortLesson,
  type CohortChunk,
} from '@/src/shared/cohort-builder/contracts';
import { initialCohort } from '@/src/shared/cohort-builder/intake';
import { getActiveStage, getEffectiveStage } from '@/src/client/screens/cohortBuilder/stage-selectors';
import { validateCohortReadiness } from '@/src/shared/cohort-builder/readiness';

function dummyContext(ws: CohortWorkspace) {
  return {
    actionId: 'act-1',
    workspaceId: 'ws-test',
    expectedRevision: 1,
    currentRevision: 1,
    entityVersions: new Map(),
  };
}

const sampleChunk1: CohortChunk = {
  id: 'chunk-1',
  sourceId: 's1',
  sourceVersion: 0,
  start: 0,
  end: 100,
  text: 'Sample chunk 1 text',
  checksum: 'b'.repeat(64),
};

const sampleChunk2: CohortChunk = {
  id: 'chunk-2',
  sourceId: 's1',
  sourceVersion: 0,
  start: 100,
  end: 200,
  text: 'Sample chunk 2 text',
  checksum: 'c'.repeat(64),
};

const sampleLesson1: CohortLesson = {
  id: 'lesson-1',
  version: 0,
  title: 'Consensus Basics',
  objective: 'Understand Paxos and Raft quorums.',
  pinned: false,
  sourceChunkIds: ['chunk-1'],
};

const sampleLesson2: CohortLesson = {
  id: 'lesson-2',
  version: 0,
  title: 'Replication Strategies',
  objective: 'Compare synchronous vs asynchronous replication.',
  pinned: true,
  sourceChunkIds: ['chunk-2'],
};

describe('Journey Checkpoint 5 Server Integration & State Invariants', () => {
  describe('Processing Stage Derivation & Navigation Inspection', () => {
    it('derives active processing stage from active and failed durable jobs', () => {
      const ws: CohortWorkspace = {
        ...initialCohort('Distributed Systems'),
        journey: {
          version: 1,
          step: 'processing',
          branch: 'have_material',
          processingStarted: true,
          intentVersion: 0,
        },
        sources: [
          { id: 's1', version: 0, label: 'Doc 1', text: 'Text', checksum: null, state: 'processing' },
        ],
        processing: {
          status: 'processing',
          stage: 'chunking',
          generation: 1,
          sourceFingerprint: null,
          error: null,
          jobs: [
            { id: 'j1', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
            { id: 'j2', sourceId: 's1', stage: 'chunking', status: 'running', attempts: 1, error: null, retryable: false },
          ],
        },
      };

      expect(getActiveStage(ws)).toBe('chunking');

      // If chunking job fails, chunking stage remains active for inspection/retry
      ws.processing.jobs![1].status = 'failed';
      expect(getActiveStage(ws)).toBe('chunking');

      // If chunking is accepted and assembly is running, assembly stage is active
      ws.processing.jobs![1].status = 'accepted';
      ws.processing.jobs!.push({
        id: 'j3',
        sourceId: null,
        stage: 'assembly',
        status: 'running',
        attempts: 1,
        error: null,
        retryable: false,
      });
      expect(getActiveStage(ws)).toBe('assembly');
    });

    it('allows inspecting completed stages during processing without mutating business state', () => {
      const ws: CohortWorkspace = {
        ...initialCohort('Distributed Systems'),
        journey: {
          version: 1,
          step: 'processing',
          branch: 'have_material',
          processingStarted: true,
          intentVersion: 0,
        },
        sources: [
          { id: 's1', version: 0, label: 'Doc 1', text: 'Text', checksum: null, state: 'ready' },
        ],
        processing: {
          status: 'processing',
          stage: 'analysis',
          generation: 1,
          sourceFingerprint: null,
          error: null,
          jobs: [
            { id: 'j1', sourceId: 's1', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
            { id: 'j2', sourceId: 's1', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
            { id: 'j3', sourceId: 's1', stage: 'analysis', status: 'running', attempts: 1, error: null, retryable: false },
          ],
        },
      };

      expect(getActiveStage(ws)).toBe('analysis');

      // User inspects earlier completed stage 'understanding'
      const effective = getEffectiveStage(ws, 'understanding');
      expect(effective).toBe('understanding');

      // Inspecting does NOT modify business state
      expect(ws.processing.status).toBe('processing');
      expect(ws.journey?.step).toBe('processing');
      expect(ws.processing.jobs?.length).toBe(3);

      // Resetting inspection returns to active stage
      expect(getEffectiveStage(ws, null)).toBe('analysis');
    });
  });

  describe('Assembly Completion and ready step', () => {
    it('maps journey.step ready to ready presentation stage', () => {
      const ws: CohortWorkspace = {
        ...initialCohort('Distributed Systems'),
        journey: {
          version: 1,
          step: 'ready',
          branch: 'have_material',
          processingStarted: true,
          intentVersion: 0,
        },
        sources: [
          { id: 's1', version: 0, label: 'Doc 1', text: 'Text', checksum: 'a'.repeat(64), state: 'ready' },
        ],
        lessons: [sampleLesson1, sampleLesson2],
        processing: {
          status: 'ready',
          stage: 'done',
          generation: 1,
          sourceFingerprint: 'fp-123',
          error: null,
        },
      };

      expect(getActiveStage(ws)).toBe('ready');
      expect(getEffectiveStage(ws, null)).toBe('ready');

      // Stepper inspection still works in ready step
      expect(getEffectiveStage(ws, 'chunking')).toBe('chunking');
    });

    it('open_review requires ready assembly and transitions to review', () => {
      const readyWs: CohortWorkspace = {
        ...initialCohort('Distributed Systems'),
        journey: {
          version: 1,
          step: 'ready',
          branch: 'have_material',
          processingStarted: true,
          intentVersion: 0,
        },
        sources: [
          { id: 's1', version: 0, label: 'Doc 1', text: 'Text', checksum: 'a'.repeat(64), state: 'ready' },
        ],
        lessons: [sampleLesson1, sampleLesson2],
        processing: {
          status: 'ready',
          stage: 'done',
          generation: 1,
          sourceFingerprint: 'fp-123',
          error: null,
        },
      };

      const plan = planCohortAction(readyWs, { type: 'open_review' }, dummyContext(readyWs));
      expect(plan.nextState.journey?.step).toBe('review');
      expect(plan.summary).toBe('Curriculum review opened.');

      // open_review rejects if assembly is not ready
      const notReadyWs: CohortWorkspace = {
        ...readyWs,
        processing: { ...readyWs.processing, status: 'processing', sourceFingerprint: null },
      };
      expect(() =>
        planCohortAction(notReadyWs, { type: 'open_review' }, dummyContext(notReadyWs))
      ).toThrow('ASSEMBLY_NOT_READY');

      // open_review rejects if lessons are empty
      const emptyLessonsWs: CohortWorkspace = {
        ...readyWs,
        lessons: [],
      };
      expect(() =>
        planCohortAction(emptyLessonsWs, { type: 'open_review' }, dummyContext(emptyLessonsWs))
      ).toThrow('ASSEMBLY_NOT_READY');

      // open_review rejects from wrong step
      const wrongStepWs: CohortWorkspace = {
        ...readyWs,
        journey: { ...readyWs.journey!, step: 'material_input' },
      };
      expect(() =>
        planCohortAction(wrongStepWs, { type: 'open_review' }, dummyContext(wrongStepWs))
      ).toThrow('INVALID_JOURNEY_TRANSITION');
    });
  });

  describe('Review Stage: Editing, Pinning, and Readiness', () => {
    it('supports editing lessons and pins while in review', () => {
      const reviewWs: CohortWorkspace = {
        ...initialCohort('Distributed Systems'),
        journey: {
          version: 1,
          step: 'review',
          branch: 'have_material',
          processingStarted: true,
          intentVersion: 0,
        },
        sources: [
          { id: 's1', version: 0, label: 'Doc 1', text: 'Text', checksum: 'a'.repeat(64), state: 'ready' },
        ],
        chunks: [sampleChunk1, sampleChunk2],
        lessons: [sampleLesson1, sampleLesson2],
        processing: {
          status: 'ready',
          stage: 'done',
          generation: 1,
          sourceFingerprint: 'fp-123',
          error: null,
        },
      };

      expect(getActiveStage(reviewWs)).toBe('review');

      // Toggle pin on lesson 1
      const pinPlan = planCohortAction(
        reviewWs,
        { type: 'set_lesson_pin', lessonId: 'lesson-1', pinned: true },
        dummyContext(reviewWs)
      );
      const pinnedLesson = pinPlan.nextState.lessons.find(l => l.id === 'lesson-1')!;
      expect(pinnedLesson.pinned).toBe(true);

      // Reorder lessons
      const reorderPlan = planCohortAction(
        reviewWs,
        { type: 'reorder_lessons', lessonIds: ['lesson-2', 'lesson-1'] },
        dummyContext(reviewWs)
      );
      expect(reorderPlan.nextState.lessons.map(l => l.id)).toEqual(['lesson-2', 'lesson-1']);

      // Edit lesson objective
      const editPlan = planCohortAction(
        reviewWs,
        { type: 'edit_lesson', lessonId: 'lesson-1', objective: 'Deep dive into Raft consensus.' },
        dummyContext(reviewWs)
      );
      expect(editPlan.nextState.lessons.find(l => l.id === 'lesson-1')!.objective).toBe(
        'Deep dive into Raft consensus.'
      );
    });

    it('enforces release readiness checks before publication', () => {
      const reviewWs: CohortWorkspace = {
        ...initialCohort('Distributed Systems'),
        journey: {
          version: 1,
          step: 'review',
          branch: 'have_material',
          processingStarted: true,
          intentVersion: 0,
        },
        sources: [
          { id: 's1', version: 0, label: 'Doc 1', text: 'Text', checksum: 'a'.repeat(64), state: 'ready' },
        ],
        chunks: [sampleChunk1, sampleChunk2],
        lessons: [sampleLesson1, sampleLesson2],
        processing: {
          status: 'ready',
          stage: 'done',
          generation: 1,
          sourceFingerprint: 'fp-123',
          error: null,
        },
      };

      // Valid workspace is ready for private activation and public publish
      const readyPrivate = validateCohortReadiness(reviewWs, 'private_activation');
      expect(readyPrivate.ready).toBe(true);
      expect(readyPrivate.blockers).toHaveLength(0);

      const readyPublic = validateCohortReadiness(reviewWs, 'public_publish');
      expect(readyPublic.ready).toBe(true);

      // If lesson has orphaned evidence, public publish is blocked
      const orphanedWs: CohortWorkspace = {
        ...reviewWs,
        lessons: [
          sampleLesson1,
          { ...sampleLesson2, evidenceStatus: 'orphaned' },
        ],
      };
      const orphanedReadiness = validateCohortReadiness(orphanedWs, 'public_publish');
      expect(orphanedReadiness.ready).toBe(false);
      expect(orphanedReadiness.blockers.some(b => b.includes('evidence'))).toBe(true);

      // prepare_release fails with orphaned evidence for public publish
      expect(() =>
        planCohortAction(orphanedWs, { type: 'prepare_release', mode: 'public_publish' }, dummyContext(orphanedWs))
      ).toThrow('PUBLIC_RELEASE_ORPHANED_EVIDENCE');
    });
  });

  describe('Release Commitment and published Step', () => {
    it('commit_release transitions journey.step to published and records receipt', () => {
      const reviewWs: CohortWorkspace = {
        ...initialCohort('Distributed Systems'),
        journey: {
          version: 1,
          step: 'review',
          branch: 'have_material',
          processingStarted: true,
          intentVersion: 0,
        },
        sources: [
          { id: 's1', version: 0, label: 'Doc 1', text: 'Text', checksum: 'a'.repeat(64), state: 'ready' },
        ],
        chunks: [sampleChunk1, sampleChunk2],
        lessons: [sampleLesson1, sampleLesson2],
        processing: {
          status: 'ready',
          stage: 'done',
          generation: 1,
          sourceFingerprint: 'fp-123',
          error: null,
        },
      };

      const receipt = {
        effectKey: 'a'.repeat(64),
        cohortId: 'cohort-published-123',
        workspaceId: 'ws-test',
        mode: 'public_publish' as const,
        releasedAt: new Date().toISOString(),
        contentHash: 'b'.repeat(64),
        destinationUrl: '/cohort/cohort-published-123',
      };

      const plan = planCohortAction(
        reviewWs,
        {
          type: 'commit_release',
          mode: 'public_publish',
          candidateHash: 'b'.repeat(64),
          receipt,
        },
        dummyContext(reviewWs)
      );

      expect(plan.nextState.journey?.step).toBe('published');
      expect(plan.nextState.release?.status).toBe('released');
      expect(plan.nextState.release?.cohortId).toBe('cohort-published-123');
      expect(plan.nextState.release?.receipt).toEqual(receipt);

      // In published state, getActiveStage returns published
      expect(getActiveStage(plan.nextState)).toBe('published');

      // Once published, back navigation actions are strictly forbidden
      expect(() =>
        planCohortAction(plan.nextState, { type: 'back_to_recommendations' }, dummyContext(plan.nextState))
      ).toThrow('INVALID_JOURNEY_TRANSITION');

      expect(() =>
        planCohortAction(plan.nextState, { type: 'back_to_starting_point' }, dummyContext(plan.nextState))
      ).toThrow('INVALID_JOURNEY_TRANSITION');
    });
  });
});
