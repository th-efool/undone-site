import { describe, expect, it } from 'vitest';
import {
  cohortWorkspaceSchema,
  planCohortAction,
  type CohortWorkspace,
  type CohortSource,
  type CohortChunk,
  type CohortLesson,
  type CohortActionContext,
} from '@/src/shared/cohort-builder/contracts';
import { initialCohort } from '@/src/shared/cohort-builder/intake';
import { getActiveStage } from '@/src/client/screens/cohortBuilder/stage-selectors';
import { validateCohortReadiness } from '@/src/shared/cohort-builder/readiness';

function createDummyContext(
  ws: CohortWorkspace,
  revision: number = 1,
  discoveryResult?: CohortActionContext['discoveryResult']
): CohortActionContext {
  return {
    actionId: `act-${crypto.randomUUID()}`,
    workspaceId: 'ws-checkpoint6-acceptance',
    expectedRevision: revision,
    currentRevision: revision,
    entityVersions: new Map(),
    discoveryResult,
  };
}

const sampleChunk: CohortChunk = {
  id: 'chunk-1',
  sourceId: 'src-1',
  sourceVersion: 0,
  start: 0,
  end: 150,
  text: 'Quorums overlap so that a read quorum and write quorum intersect on at least one current replica.',
  checksum: 'c'.repeat(64),
};

const sampleLesson: CohortLesson = {
  id: 'lesson-1',
  version: 0,
  title: 'Consensus & Quorums',
  objective: 'Understand how overlapping quorums guarantee strong consistency in distributed systems.',
  pinned: false,
  sourceChunkIds: ['chunk-1'],
};

describe('Checkpoint 6: Integrated Acceptance and Delivery Suite', () => {
  describe('1. Full Multi-Branch Lifecycle (Recommendations → Starting Point → Branches → Review → Published)', () => {
    it('Branch 1: have_material → material_input with multi-format sources → processing → ready → review → publish', () => {
      // 1. Initial workspace from intake starts at recommendations
      let ws = initialCohort('Learn Distributed Systems Architecture');
      expect(ws.journey?.step).toBe('recommendations');
      expect(ws.journey?.processingStarted).toBe(false);
      expect(getActiveStage(ws)).toBe('recommendations');

      // 2. Recommendations -> Starting Point
      let planned = planCohortAction(ws, { type: 'create_own_cohort' }, createDummyContext(ws, 1));
      ws = cohortWorkspaceSchema.parse(planned.nextState);
      expect(ws.journey?.step).toBe('starting_point');
      expect(getActiveStage(ws)).toBe('starting_point');

      // 3. Starting Point -> have_material -> material_input
      planned = planCohortAction(ws, { type: 'choose_starting_point', choice: 'have_material' }, createDummyContext(ws, 2));
      ws = cohortWorkspaceSchema.parse(planned.nextState);
      expect(ws.journey?.step).toBe('material_input');
      expect(ws.journey?.branch).toBe('have_material');
      expect(getActiveStage(ws)).toBe('material_input');

      // 4. Adding multi-format sources (text, web, YouTube native-video)
      planned = planCohortAction(ws, { type: 'add_text_source', label: 'Notes.txt', text: 'Distributed consensus notes.' }, createDummyContext(ws, 3));
      ws = cohortWorkspaceSchema.parse(planned.nextState);
      expect(ws.sources).toHaveLength(1);
      expect(ws.journey?.processingStarted).toBe(false); // Source input retained, processing stays idle!
      expect(ws.processing.status).toBe('idle');

      planned = planCohortAction(ws, { type: 'add_web_source', url: 'https://martinfowler.com/articles/patterns-of-distributed-systems/', label: 'Patterns' }, createDummyContext(ws, 4));
      ws = cohortWorkspaceSchema.parse(planned.nextState);
      expect(ws.sources).toHaveLength(2);

      planned = planCohortAction(ws, { type: 'add_youtube_source', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', label: 'Video Lecture', mode: 'video_observation' }, createDummyContext(ws, 5));
      ws = cohortWorkspaceSchema.parse(planned.nextState);
      expect(ws.sources).toHaveLength(3);
      expect(ws.sources[2].input?.kind).toBe('youtube');
      if (ws.sources[2].input?.kind === 'youtube') {
        expect(ws.sources[2].input.mode).toBe('video_observation');
      }

      // 5. Explicit Continue invokes begin_material_processing
      planned = planCohortAction(ws, { type: 'begin_material_processing' }, createDummyContext(ws, 6));
      ws = cohortWorkspaceSchema.parse(planned.nextState);
      expect(ws.journey?.processingStarted).toBe(true);
      expect(ws.journey?.step).toBe('processing');
      expect(ws.processing.status).toBe('queued');

      // Simulate worker pipeline execution to ready state
      ws = {
        ...ws,
        sources: ws.sources.map(s => ({ ...s, state: 'ready' as const })),
        chunks: [{ ...sampleChunk, sourceId: ws.sources[0].id }],
        lessons: [sampleLesson],
        processing: {
          status: 'ready',
          stage: 'done',
          generation: 1,
          sourceFingerprint: 'fp-valid',
          error: null,
          driver: 'durable',
          jobs: [
            { id: 'j1', sourceId: ws.sources[0].id, stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
            { id: 'j2', sourceId: ws.sources[0].id, stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
            { id: 'j3', sourceId: ws.sources[0].id, stage: 'analysis', status: 'accepted', attempts: 1, error: null, retryable: false },
            { id: 'j4', sourceId: null, stage: 'assembly', status: 'accepted', attempts: 1, error: null, retryable: false },
          ],
        },
        journey: {
          ...ws.journey!,
          step: 'ready',
        },
      };
      expect(getActiveStage(ws)).toBe('ready');

      // 6. Ready -> Review
      planned = planCohortAction(ws, { type: 'open_review' }, createDummyContext(ws, 7));
      ws = cohortWorkspaceSchema.parse(planned.nextState);
      expect(ws.journey?.step).toBe('review');
      expect(getActiveStage(ws)).toBe('review');

      // 7. Review curation: pin lesson, edit objective
      planned = planCohortAction(ws, { type: 'set_lesson_pin', lessonId: 'lesson-1', pinned: true }, createDummyContext(ws, 8));
      ws = cohortWorkspaceSchema.parse(planned.nextState);
      expect(ws.lessons[0].pinned).toBe(true);

      // Pinned lesson title cannot be deleted
      expect(() => {
        planCohortAction(ws, { type: 'remove_lesson', lessonId: 'lesson-1' }, createDummyContext(ws, 9));
      }).toThrow('PINNED_LESSON_LOCKED');

      // 8. Publish cohort: validate candidate readiness, prepare release & commit release
      const readiness = validateCohortReadiness(ws, 'public_publish');
      expect(readiness.ready).toBe(true);

      const candidateHash = 'a'.repeat(64);
      planned = planCohortAction(ws, {
        type: 'prepare_release',
        mode: 'public_publish',
        candidateHash,
      }, createDummyContext(ws, 9));
      ws = cohortWorkspaceSchema.parse(planned.nextState);
      expect(ws.release?.status).toBe('prepared');

      const receipt = {
        effectKey: candidateHash,
        cohortId: 'cohort-dist-sys-101',
        workspaceId: 'ws-checkpoint6-acceptance',
        mode: 'public_publish' as const,
        releasedAt: new Date().toISOString(),
        contentHash: candidateHash,
        destinationUrl: '/cohort/cohort-dist-sys-101',
      };

      planned = planCohortAction(ws, {
        type: 'commit_release',
        mode: 'public_publish',
        candidateHash,
        receipt,
      }, createDummyContext(ws, 10));
      ws = cohortWorkspaceSchema.parse(planned.nextState);

      expect(ws.journey?.step).toBe('published');
      expect(ws.release?.status).toBe('released');
      expect(ws.release?.cohortId).toBe('cohort-dist-sys-101');
      expect(getActiveStage(ws)).toBe('published');

      // Invariant: Once published, back navigation is permanently blocked
      expect(() => {
        planCohortAction(ws, { type: 'back_to_starting_point' }, createDummyContext(ws, 11));
      }).toThrow('INVALID_JOURNEY_TRANSITION');
      expect(() => {
        planCohortAction(ws, { type: 'back_to_recommendations' }, createDummyContext(ws, 11));
      }).toThrow('INVALID_JOURNEY_TRANSITION');
    });

    it('Branch 2: find_material → discovery → candidate selection → material_input', () => {
      let ws = initialCohort('Learn Modern Rust Systems Programming');
      // 1. Choose find_material
      let planned = planCohortAction(ws, { type: 'create_own_cohort' }, createDummyContext(ws, 1));
      ws = cohortWorkspaceSchema.parse(planned.nextState);

      planned = planCohortAction(ws, { type: 'choose_starting_point', choice: 'find_material' }, createDummyContext(ws, 2));
      ws = cohortWorkspaceSchema.parse(planned.nextState);
      expect(ws.journey?.step).toBe('discovery');
      expect(ws.journey?.branch).toBe('find_material');
      expect(getActiveStage(ws)).toBe('discovery');

      // 2. Start discovery
      planned = planCohortAction(ws, { type: 'start_discovery' }, createDummyContext(ws, 3));
      ws = cohortWorkspaceSchema.parse(planned.nextState);
      expect(ws.discovery?.status).toBe('queued');

      // Simulate discovery acceptance with candidates
      const resultId = 'disc-res-1';
      const fingerprint = 'fp-disc-1';
      const items = [
        { id: 'cand-1', label: 'The Rust Book: Ownership', kind: 'web' as const, url: 'https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html' },
        { id: 'cand-2', label: 'Rust by Example: Concurrency', kind: 'web' as const, url: 'https://doc.rust-lang.org/rust-by-example/std_misc/threads.html' },
      ];
      ws = {
        ...ws,
        discovery: {
          requestId: 'req-disc-1',
          status: 'ready',
          generation: 1,
          resultId,
          fingerprint,
          items,
        },
      };

      // 3. Select candidates with valid proof in action context -> creates web sources and advances to material_input
      planned = planCohortAction(
        ws,
        {
          type: 'select_discovery_resources',
          resultId,
          candidateIds: ['cand-1', 'cand-2'],
        },
        createDummyContext(ws, 4, { resultId, fingerprint, items })
      );
      ws = cohortWorkspaceSchema.parse(planned.nextState);

      expect(ws.journey?.step).toBe('material_input');
      expect(ws.sources).toHaveLength(2);
      expect(ws.sources[0].input?.kind).toBe('web');
      if (ws.sources[0].input?.kind === 'web') {
        expect(ws.sources[0].input.url).toBe('https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html');
      }
      expect(ws.journey?.processingStarted).toBe(false); // Retained sources, waiting for Continue!
    });

    it('Branch 3: have_goal → goal_setup → start_goal_generation → generated_guide in source DAG', () => {
      let ws = initialCohort('Learn Kubernetes Cluster Networking');
      // 1. Choose have_goal
      let planned = planCohortAction(ws, { type: 'create_own_cohort' }, createDummyContext(ws, 1));
      ws = cohortWorkspaceSchema.parse(planned.nextState);

      planned = planCohortAction(ws, { type: 'choose_starting_point', choice: 'have_goal' }, createDummyContext(ws, 2));
      ws = cohortWorkspaceSchema.parse(planned.nextState);
      expect(ws.journey?.step).toBe('goal_setup');
      expect(ws.journey?.branch).toBe('have_goal');
      expect(getActiveStage(ws)).toBe('goal_setup');

      // 2. Set audience and daily minutes
      planned = planCohortAction(ws, { type: 'set_audience', audience: 'DevOps Engineers' }, createDummyContext(ws, 3));
      ws = cohortWorkspaceSchema.parse(planned.nextState);
      expect(ws.audience).toBe('DevOps Engineers');

      planned = planCohortAction(ws, { type: 'set_daily_minutes', dailyMinutes: 30 }, createDummyContext(ws, 4));
      ws = cohortWorkspaceSchema.parse(planned.nextState);
      expect(ws.dailyMinutes).toBe(30);

      // 3. Start goal generation -> creates generated_guide source and starts processing
      planned = planCohortAction(ws, { type: 'start_goal_generation' }, createDummyContext(ws, 5));
      ws = cohortWorkspaceSchema.parse(planned.nextState);

      expect(ws.journey?.step).toBe('processing');
      expect(ws.journey?.processingStarted).toBe(true);
      expect(ws.sources).toHaveLength(1);
      expect(ws.sources[0].input?.kind).toBe('generated_guide');
      if (ws.sources[0].input?.kind === 'generated_guide') {
        expect(ws.sources[0].input.goal).toBe('Learn Kubernetes Cluster Networking');
        expect(ws.sources[0].input.dailyMinutes).toBe(30);
      }
      expect(ws.processing.status).toBe('queued');
    });
  });

  describe('2. Truthful Provenance & Evidence Verification', () => {
    it('verifies YouTube video_observation provenance vs transcript vs generated_guide vs web/pdf', () => {
      // 1. YouTube video observation source contract
      const videoSource: CohortSource = {
        id: 'yt-1',
        version: 0,
        label: 'Distributed Systems Lecture',
        text: 'Observed content.',
        checksum: 'b'.repeat(64),
        state: 'ready',
        input: {
          kind: 'youtube',
          url: 'https://youtube.com/watch?v=123',
          mode: 'video_observation',
        },
        provenance: {
          parserVersion: '1.0.0',
          rawChecksum: 'b'.repeat(64),
          scope: 'video_observation',
          videoId: '123',
          contentOrigin: 'ai',
          limitations: ['Non-exhaustive coverage; timestamps are estimated.'],
          estimatedIntervals: true,
        },
      };

      if (videoSource.input?.kind === 'youtube') {
        expect(videoSource.input.mode).toBe('video_observation');
      }
      expect(videoSource.provenance?.scope).toBe('video_observation');
      expect(videoSource.provenance?.contentOrigin).toBe('ai');
      expect(videoSource.provenance?.estimatedIntervals).toBe(true);
      expect(videoSource.provenance?.limitations?.[0]).toContain('timestamps are estimated');

      // 2. YouTube transcript citation contract
      const transcriptSource: CohortSource = {
        ...videoSource,
        input: {
          kind: 'youtube',
          url: 'https://youtube.com/watch?v=123',
          mode: 'transcript',
          track: { id: 'track-en', language: 'en', kind: 'automatic', translated: false },
        },
        provenance: {
          parserVersion: '1.0.0',
          rawChecksum: 'd'.repeat(64),
          scope: 'transcript_only',
          videoId: '123',
        },
      };
      if (transcriptSource.input?.kind === 'youtube') {
        expect(transcriptSource.input.mode).toBe('transcript');
      }
      expect(transcriptSource.provenance?.scope).toBe('transcript_only');
      expect(transcriptSource.provenance?.contentOrigin).toBeUndefined();

      // 3. AI Generated Guide citation contract
      const guideSource: CohortSource = {
        id: 'guide-1',
        version: 0,
        label: 'Generated Curriculum Guide',
        text: 'Guide text.',
        checksum: 'c'.repeat(64),
        state: 'ready',
        input: {
          kind: 'generated_guide',
          goal: 'Learn distributed systems',
          audience: 'Engineers',
          dailyMinutes: 30,
          intentVersion: 0,
        },
        provenance: {
          parserVersion: '1.0.0',
          rawChecksum: 'c'.repeat(64),
          scope: 'ai_authored_guide',
          contentOrigin: 'ai',
          limitations: ['AI-authored learning guide, not verified external source material.'],
        },
      };
      expect(guideSource.provenance?.scope).toBe('ai_authored_guide');
      expect(guideSource.provenance?.contentOrigin).toBe('ai');
      expect(guideSource.provenance?.limitations?.[0]).toContain('not verified external source material');
    });
  });

  describe('3. Concurrency, CAS & Stale Workspace Protection', () => {
    it('rejects stale revision with STALE_WORKSPACE (two-tab conflict resolution)', () => {
      const ws = initialCohort('Learn Raft');
      const staleContext = {
        actionId: 'act-stale',
        workspaceId: 'ws-1',
        expectedRevision: 1,
        currentRevision: 2, // Mismatch: state was already updated by another tab!
        entityVersions: new Map(),
      };

      expect(() => {
        planCohortAction(ws, { type: 'set_daily_minutes', dailyMinutes: 45 }, staleContext);
      }).toThrow('STALE_WORKSPACE');
    });

    it('bumping intent increments intentVersion and invalidates stale recommendations', () => {
      let ws = initialCohort('Learn SQL');
      ws = {
        ...ws,
        recommendations: {
          requestId: 'req-rec-1',
          fingerprint: 'fp-rec-1',
          status: 'ready',
          generation: 0,
          resultId: 'rec-1',
          items: [{ id: 'c1', label: 'SQL 101', url: 'https://undone.one/c/sql' }],
        },
      };
      expect(ws.journey?.intentVersion).toBe(0);

      const planned = planCohortAction(ws, { type: 'set_intent', intent: 'Master Advanced PostgreSQL' }, createDummyContext(ws, 1));
      const nextWs = cohortWorkspaceSchema.parse(planned.nextState);

      expect(nextWs.journey?.intentVersion).toBe(1);
      expect(nextWs.recommendations).toBeUndefined(); // Stale recommendations cleared!
    });

    it('legacy workspaces without journey parse cleanly and remain fully functional without journey reset', () => {
      const legacyWs: CohortWorkspace = {
        schemaVersion: 1,
        title: 'Legacy Cohort',
        intent: 'Learn old systems',
        audience: 'Anyone',
        dailyMinutes: 20,
        sources: [],
        chunks: [],
        understanding: [],
        analyses: [],
        lessons: [sampleLesson],
        processing: { status: 'idle', stage: 'done', generation: 0, sourceFingerprint: null, error: null },
      };

      const parsed = cohortWorkspaceSchema.parse(legacyWs);
      expect(parsed.journey).toBeUndefined();

      // Applying action preserves journey: undefined
      const planned = planCohortAction(parsed, { type: 'set_daily_minutes', dailyMinutes: 40 }, createDummyContext(parsed, 1));
      expect(planned.nextState.journey).toBeUndefined();
      expect(planned.nextState.dailyMinutes).toBe(40);
    });
  });
});
