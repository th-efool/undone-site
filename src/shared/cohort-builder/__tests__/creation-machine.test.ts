import { describe, expect, it } from 'vitest';
import {
  planCohortAction,
  type CohortActionContext,
  type CohortWorkspace,
} from '../contracts';
import { initialCohort } from '../intake';
import {
  computeBuildInputFingerprint,
  computeSourceEvidenceFingerprint,
  isBuildComplete,
  isBuildStale,
  validateWorkspaceInvariants,
} from '../creation-state';
import {
  canSwitchStartingPointBranch,
  getCreationCapabilities,
  projectAcceptedBuildCompletion,
} from '../creation-machine';
import {
  deriveActiveStage,
  deriveCreationViewModel,
  deriveReadyStageViewModel,
} from '../creation-view';
import {
  buildGeneratedLessons,
  runDeterministicPipeline,
  splitSource,
} from '../client-pipeline';
import { extractSourceConceptTopics } from '../cohort-metadata';
import { sha256 } from '../hash';

const workspaceId = '00000000-0000-4000-8000-000000000099';

function createContext(
  overrides?: Partial<CohortActionContext>
): CohortActionContext {
  return {
    actionId: 'act-machine-1',
    workspaceId,
    expectedRevision: 0,
    currentRevision: 0,
    entityVersions: new Map(),
    ...overrides,
  };
}

function createReadySourceWorkspace(): CohortWorkspace {
  const ws = initialCohort('Master Distributed Consensus');
  ws.audience = 'Systems Engineers';
  ws.dailyMinutes = 30;
  ws.journey = {
    version: 1,
    step: 'material_input',
    branch: 'have_material',
    processingStarted: false,
    intentVersion: 0,
  };
  ws.sources = [
    {
      id: 'src-raft',
      version: 0,
      label: 'Raft Paper Notes',
      text: 'Raft achieves consensus via leader election and log replication. Quorums overlap on every committed entry.',
      checksum: sha256(
        'Raft achieves consensus via leader election and log replication. Quorums overlap on every committed entry.'
      ),
      state: 'ready',
      locations: [{ start: 0, end: 105 }],
    },
  ];
  return ws;
}

describe('Cohort Creation State Machine (creation-state, creation-machine, creation-view)', () => {
  describe('R1: Orthogonal State Regions, Fingerprints & Invariant Validation', () => {
    it('computes distinct source-evidence and build-input fingerprints that change when intent, audience, or dailyMinutes change', () => {
      const ws1 = createReadySourceWorkspace();
      const ws2 = structuredClone(ws1);
      ws2.intent = 'Master Byzantine Fault Tolerance';

      const ws3 = structuredClone(ws1);
      ws3.audience = 'Staff Architects';

      const ws4 = structuredClone(ws1);
      ws4.dailyMinutes = 45;

      // Source evidence fingerprint depends only on [id, version, text]
      expect(computeSourceEvidenceFingerprint(ws1)).toBe(
        computeSourceEvidenceFingerprint(ws2)
      );
      expect(computeSourceEvidenceFingerprint(ws1)).toBe(
        computeSourceEvidenceFingerprint(ws3)
      );

      // Build input fingerprint changes whenever pedagogical parameters change
      const fp1 = computeBuildInputFingerprint(ws1);
      expect(computeBuildInputFingerprint(ws2)).not.toBe(fp1);
      expect(computeBuildInputFingerprint(ws3)).not.toBe(fp1);
      expect(computeBuildInputFingerprint(ws4)).not.toBe(fp1);
    });

    it('detects contradictory workspace snapshots in validateWorkspaceInvariants', () => {
      const ws = runDeterministicPipeline(createReadySourceWorkspace());
      expect(validateWorkspaceInvariants(ws)).toEqual({
        valid: true,
        violations: [],
      });

      // Contradiction 1: step === 'ready' with queued processing
      const queuedOnReady: CohortWorkspace = {
        ...ws,
        processing: {
          ...ws.processing,
          status: 'queued',
          stage: 'assembly',
        },
      };
      const report1 = validateWorkspaceInvariants(queuedOnReady);
      expect(report1.valid).toBe(false);
      expect(report1.violations).toContain('READY_WITHOUT_COMPLETE_BUILD');

      // Contradiction 2: processing.status === 'ready' without sourceFingerprint
      const missingFp: CohortWorkspace = {
        ...ws,
        processing: {
          ...ws.processing,
          sourceFingerprint: null,
        },
      };
      const report2 = validateWorkspaceInvariants(missingFp);
      expect(report2.valid).toBe(false);
      expect(report2.violations).toContain('READY_WITHOUT_COMPLETE_BUILD');
      expect(report2.violations).toContain('READY_STATUS_WITHOUT_FINGERPRINT');

      // Contradiction 3: step === 'published' with draft release
      const fakePublished: CohortWorkspace = {
        ...ws,
        journey: { ...ws.journey!, step: 'published' },
        release: { status: 'draft' },
      };
      const report3 = validateWorkspaceInvariants(fakePublished);
      expect(report3.valid).toBe(false);
      expect(report3.violations).toContain('PUBLISHED_WITHOUT_RELEASE');
    });
  });

  describe('R2: Fast vs Durable Build Completion Parity', () => {
    it('produces identical completed curriculum state through runDeterministicPipeline and projectAcceptedBuildCompletion', () => {
      const base = createReadySourceWorkspace();
      base.journey!.step = 'processing';
      base.journey!.processingStarted = true;
      base.processing.generation = 2;

      const fastResult = runDeterministicPipeline(base);

      const chunks = base.sources.flatMap(splitSource);
      const understanding = base.sources.map(source => ({
        sourceId: source.id,
        sourceVersion: source.version,
        topics: extractSourceConceptTopics(source),
      }));
      const analyses = chunks.map(chunk => ({
        chunkId: chunk.id,
        summary: chunk.text.slice(0, 300),
        question: `How would you apply this passage: ${chunk.text.slice(0, 160)}?`,
      }));
      const workingForLessons: CohortWorkspace = {
        ...structuredClone(base),
        chunks,
        analyses,
      };
      const generatedLessons = buildGeneratedLessons(workingForLessons);

      const durableResult = projectAcceptedBuildCompletion(base, {
        sources: base.sources.map(s => ({
          id: s.id,
          version: s.version,
          checksum: sha256(s.text),
        })),
        understanding,
        chunks,
        analyses,
        generatedLessons,
        generation: base.processing.generation + 1,
        driver: 'durable',
        forceReadyJourneyStep: false,
      });

      expect(durableResult.lessons).toEqual(fastResult.lessons);
      expect(durableResult.chunks).toEqual(fastResult.chunks);
      expect(durableResult.understanding).toEqual(fastResult.understanding);
      expect(durableResult.analyses).toEqual(fastResult.analyses);
      expect(durableResult.title).toBe(fastResult.title);
      expect(durableResult.description).toBe(fastResult.description);
      expect(durableResult.seo).toEqual(fastResult.seo);
      expect(durableResult.processing.sourceFingerprint).toBe(
        fastResult.processing.sourceFingerprint
      );
      expect(durableResult.journey?.step).toBe('ready');
      expect(isBuildComplete(durableResult)).toBe(true);
      expect(isBuildComplete(fastResult)).toBe(true);
    });
  });

  describe('R3 & R4: Post-Mutation Lifecycle Normalization & Direct Branch Switching', () => {
    it('transitions journey.step from ready to processing when set_intent, set_audience, set_daily_minutes, or add_web_source queues a rebuild', () => {
      const readyWs = runDeterministicPipeline(createReadySourceWorkspace());
      expect(readyWs.journey?.step).toBe('ready');
      expect(isBuildComplete(readyWs)).toBe(true);

      // 1. set_intent after ready
      const afterIntent = planCohortAction(
        readyWs,
        { type: 'set_intent', intent: 'Learn Paxos and Viewstamped Replication' },
        createContext()
      ).nextState;
      expect(afterIntent.processing.status).toBe('queued');
      expect(afterIntent.processing.stage).toBe('assembly');
      expect(afterIntent.journey?.step).toBe('processing');
      expect(deriveActiveStage(afterIntent)).toBe('assembly');

      // 2. set_audience after ready
      const afterAudience = planCohortAction(
        readyWs,
        { type: 'set_audience', audience: 'Principal Engineers' },
        createContext()
      ).nextState;
      expect(afterAudience.processing.status).toBe('queued');
      expect(afterAudience.processing.stage).toBe('analysis');
      expect(afterAudience.journey?.step).toBe('processing');
      expect(deriveActiveStage(afterAudience)).toBe('analysis');

      // 3. set_daily_minutes after ready
      const afterMinutes = planCohortAction(
        readyWs,
        { type: 'set_daily_minutes', dailyMinutes: 45 },
        createContext()
      ).nextState;
      expect(afterMinutes.processing.status).toBe('queued');
      expect(afterMinutes.processing.stage).toBe('assembly');
      expect(afterMinutes.journey?.step).toBe('processing');

      // 4. add_web_source after ready
      const afterWebSource = planCohortAction(
        readyWs,
        {
          type: 'add_web_source',
          sourceId: 'src-web-2',
          label: 'Raft Visualization',
          url: 'https://raft.github.io',
        },
        createContext()
      ).nextState;
      expect(afterWebSource.processing.status).toBe('queued');
      expect(afterWebSource.processing.stage).toBe('acquisition');
      expect(afterWebSource.journey?.step).toBe('processing');
      expect(deriveActiveStage(afterWebSource)).toBe('understanding');
    });

    it('returns journey.step to material_input with processingStarted=false if the last source is removed from ready or processing', () => {
      const readyWs = runDeterministicPipeline(createReadySourceWorkspace());
      const afterRemoveAll = planCohortAction(
        readyWs,
        { type: 'remove_source', sourceId: 'src-raft' },
        createContext()
      ).nextState;

      expect(afterRemoveAll.sources).toHaveLength(0);
      expect(afterRemoveAll.processing.status).toBe('idle');
      expect(afterRemoveAll.journey?.step).toBe('material_input');
      expect(afterRemoveAll.journey?.processingStarted).toBe(false);
      expect(deriveActiveStage(afterRemoveAll)).toBe('material_input');
    });

    it('allows direct choose_starting_point transition from ready and review while rejecting processing and published', () => {
      expect(canSwitchStartingPointBranch('ready')).toBe(true);
      expect(canSwitchStartingPointBranch('review')).toBe(true);
      expect(canSwitchStartingPointBranch('processing')).toBe(false);
      expect(canSwitchStartingPointBranch('published')).toBe(false);

      const readyWs = runDeterministicPipeline(createReadySourceWorkspace());
      const toMaterial = planCohortAction(
        readyWs,
        { type: 'choose_starting_point', choice: 'have_material' },
        createContext()
      ).nextState;
      expect(toMaterial.journey?.step).toBe('material_input');
      expect(toMaterial.journey?.branch).toBe('have_material');

      const toDiscovery = planCohortAction(
        readyWs,
        { type: 'choose_starting_point', choice: 'find_material' },
        createContext()
      ).nextState;
      expect(toDiscovery.journey?.step).toBe('discovery');
      expect(toDiscovery.journey?.branch).toBe('find_material');
    });
  });

  describe('R5 & R6: View Model Consistency & Contradictory Snapshot Recovery', () => {
    it('routes contradictory step=ready snapshots with queued/failed processing to the active processing stage', () => {
      const readyWs = runDeterministicPipeline(createReadySourceWorkspace());
      const contradictoryQueued: CohortWorkspace = {
        ...readyWs,
        processing: {
          status: 'queued',
          stage: 'chunking',
          generation: 3,
          sourceFingerprint: null,
          error: null,
        },
      };

      // Instead of trapping the user on 'ready', deriveActiveStage routes to 'chunking'
      expect(deriveActiveStage(contradictoryQueued)).toBe('chunking');

      // And ReadyStageViewModel truthfully reports not-ready if mounted directly
      const readyVm = deriveReadyStageViewModel(contradictoryQueued);
      expect(readyVm.isReady).toBe(false);
      expect(readyVm.canActivate).toBe(false);
      expect(readyVm.canReview).toBe(false);
      expect(readyVm.canReturnToMaterial).toBe(true);
      expect(readyVm.heading).toBe('In progress.');
      expect(readyVm.badgeLabel).toBe('Build not complete');
    });

    it('derives the authoritative view from current build evidence', () => {
      const readyWs = runDeterministicPipeline(createReadySourceWorkspace());
      const viewModel = deriveCreationViewModel(readyWs, null);

      expect(isBuildComplete(readyWs)).toBe(true);
      expect(isBuildStale(readyWs)).toBe(false);
      expect(validateWorkspaceInvariants(readyWs).valid).toBe(true);

      expect(viewModel.activeStage).toBe('ready');
      expect(viewModel.effectiveStage).toBe('ready');
      expect(viewModel.readyStage.isReady).toBe(true);
      expect(viewModel.readyStage.canActivate).toBe(true);
      expect(viewModel.readyStage.canReview).toBe(true);
      expect(viewModel.readyStage.heading).toBe('All set.');
      expect(viewModel.readyStage.badgeLabel).toBe('Processed');
      expect(viewModel.progress.steps.every(s => s.isComplete)).toBe(true);
      expect(viewModel.progress.needsRebuild).toBe(false);
    });

    it('flags isBuildStale when a source is pending or processing was canceled', () => {
      const readyWs = runDeterministicPipeline(createReadySourceWorkspace());
      const staleWs: CohortWorkspace = {
        ...readyWs,
        sources: [
          {
            ...readyWs.sources[0],
            state: 'stale',
          },
        ],
        processing: {
          ...readyWs.processing,
          status: 'idle',
          error: 'PROCESSING_CANCELED',
        },
      };

      expect(isBuildComplete(staleWs)).toBe(false);
      expect(isBuildStale(staleWs)).toBe(true);
      const capabilities = getCreationCapabilities(staleWs);
      expect(capabilities.canOpenReview).toBe(false);
      expect(capabilities.canPreparePrivateRelease).toBe(false);
    });

    it('rejects open_review from chat, allows begin_material_processing from discovery, and hides stepper on unbuilt review', () => {
      const chatWs = createReadySourceWorkspace();
      chatWs.journey!.step = 'chat';
      const withLesson = planCohortAction(
        chatWs,
        {
          type: 'add_lesson',
          lessonId: 'l1',
          title: 'Lesson 1',
          objective: 'Learn basics',
        },
        createContext()
      ).nextState;

      expect(getCreationCapabilities(withLesson).canOpenReview).toBe(false);
      expect(() =>
        planCohortAction(withLesson, { type: 'open_review' }, createContext())
      ).toThrow('INVALID_JOURNEY_TRANSITION');

      const discoveryWs = createReadySourceWorkspace();
      discoveryWs.journey!.step = 'discovery';
      discoveryWs.journey!.branch = 'find_material';
      expect(getCreationCapabilities(discoveryWs).canBeginMaterialProcessing).toBe(true);

      const unbuiltReviewWs: CohortWorkspace = {
        ...withLesson,
        journey: { ...withLesson.journey!, step: 'review' },
      };
      expect(deriveCreationViewModel(unbuiltReviewWs, null).hideStepper).toBe(true);
    });
  });
});
