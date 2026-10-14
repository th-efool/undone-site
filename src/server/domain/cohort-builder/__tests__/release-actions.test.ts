import { describe, expect, it, vi } from 'vitest';
import {
  cohortWorkspaceSchema,
  planCohortAction,
  type CohortWorkspace,
  type CohortActionContext,
} from '@/src/shared/cohort-builder/contracts';
import { createCohortAiTools } from '../tools';
import { cohortDomain } from '../domain';

function createReadyWorkspace(overrides?: Partial<CohortWorkspace>): CohortWorkspace {
  return cohortWorkspaceSchema.parse({
    schemaVersion: 1,
    title: 'Functional TypeScript',
    intent: 'Master functional patterns in TypeScript',
    audience: 'TypeScript developers',
    dailyMinutes: 25,
    lessons: [
      {
        id: 'l1',
        version: 1,
        title: 'Pure Functions',
        objective: 'Write deterministic pure functions',
        sourceChunkIds: ['c1'],
        pinned: false,
        evidenceStatus: 'valid',
      },
      {
        id: 'l2',
        version: 1,
        title: 'Immutability',
        objective: 'Use readonly and deep frozen types',
        sourceChunkIds: ['c1'],
        pinned: true,
        evidenceStatus: 'valid',
      },
    ],
    sources: [
      {
        id: 's1',
        version: 0,
        label: 'Source 1',
        text: 'Functional programming concepts and pure functions.',
        checksum: 'b'.repeat(64),
        state: 'ready',
      },
    ],
    chunks: [
      {
        id: 'c1',
        sourceId: 's1',
        sourceVersion: 0,
        start: 0,
        end: 50,
        text: 'Functional programming concepts and pure functions.',
        checksum: 'c'.repeat(64),
      },
    ],
    understanding: [],
    analyses: [],
    processing: { status: 'idle', stage: 'done', generation: 1, sourceFingerprint: null, error: null },
    ...overrides,
  });
}

const mockContext: CohortActionContext = {
  actionId: 'act-1',
  workspaceId: 'ws-123',
  expectedRevision: 1,
  currentRevision: 1,
  entityVersions: new Map([['l1', 1], ['l2', 1], ['s1', 0]]),
};

describe('Cohort release actions planning', () => {
  it('prepares release successfully in private_activation mode', () => {
    const ws = createReadyWorkspace();
    const plan = planCohortAction(ws, {
      type: 'prepare_release',
      mode: 'private_activation',
      candidateHash: 'd'.repeat(64),
    }, mockContext);

    expect(plan.nextState.release?.status).toBe('prepared');
    expect(plan.nextState.release?.mode).toBe('private_activation');
    expect(plan.nextState.release?.candidateHash).toBe('d'.repeat(64));
    expect(plan.invalidated).toContain('release');
    expect(plan.undoable).toBe(true);
  });

  it('prepares release successfully in public_publish mode when clean', () => {
    const ws = createReadyWorkspace();
    const plan = planCohortAction(ws, {
      type: 'prepare_release',
      mode: 'public_publish',
      candidateHash: 'e'.repeat(64),
    }, mockContext);

    expect(plan.nextState.release?.status).toBe('prepared');
    expect(plan.nextState.release?.mode).toBe('public_publish');
  });

  it('rejects public_publish if lessons have orphaned evidence', () => {
    const ws = createReadyWorkspace({
      lessons: [
        {
          id: 'l1',
          version: 1,
          title: 'Pure Functions',
          objective: 'Write deterministic pure functions',
          sourceChunkIds: [],
          pinned: false,
          evidenceStatus: 'orphaned',
        },
      ],
    });

    expect(() => planCohortAction(ws, {
      type: 'prepare_release',
      mode: 'public_publish',
    }, mockContext)).toThrow('PUBLIC_RELEASE_ORPHANED_EVIDENCE');
  });

  it('rejects public_publish if sources are restricted', () => {
    const ws = createReadyWorkspace({
      sources: [
        {
          id: 's1',
          version: 0,
          label: 'Private Manual',
          text: 'Restricted proprietary content.',
          checksum: 'b'.repeat(64),
          state: 'ready',
          isRestricted: true,
        },
      ],
    });

    expect(() => planCohortAction(ws, {
      type: 'prepare_release',
      mode: 'public_publish',
    }, mockContext)).toThrow('PUBLIC_RELEASE_RESTRICTED_SOURCE');
  });

  it('rejects prepare_release if background processing is active', () => {
    const ws = createReadyWorkspace({
      processing: { status: 'processing', stage: 'analysis', generation: 1, sourceFingerprint: null, error: null },
    });

    expect(() => planCohortAction(ws, {
      type: 'prepare_release',
      mode: 'private_activation',
    }, mockContext)).toThrow('PROCESSING_NOT_COMPLETE');
  });

  it('rejects prepare_release if curriculum has no lessons', () => {
    const ws = createReadyWorkspace({
      lessons: [],
    });

    expect(() => planCohortAction(ws, {
      type: 'prepare_release',
      mode: 'private_activation',
    }, mockContext)).toThrow('NO_LESSONS');
  });

  it('commits release and transitions release state to released', () => {
    const ws = createReadyWorkspace({
      release: {
        status: 'prepared',
        mode: 'private_activation',
        candidateHash: 'd'.repeat(64),
      },
    });

    const receipt = {
      effectKey: 'f'.repeat(64),
      cohortId: 'cohort_123',
      workspaceId: 'ws-123',
      contentHash: 'd'.repeat(64),
      mode: 'private_activation' as const,
      releasedAt: new Date().toISOString(),
      destinationUrl: '/play?cohort=cohort_123',
    };

    const plan = planCohortAction(ws, {
      type: 'commit_release',
      mode: 'private_activation',
      candidateHash: 'd'.repeat(64),
      receipt,
    }, mockContext);

    expect(plan.nextState.release?.status).toBe('released');
    expect(plan.nextState.release?.cohortId).toBe('cohort_123');
    expect(plan.nextState.release?.receipt).toEqual(receipt);
    expect(plan.undoable).toBe(false);
  });

  it('invalidates prepared release status when curriculum content is edited', () => {
    const ws = createReadyWorkspace({
      release: {
        status: 'prepared',
        mode: 'private_activation',
        candidateHash: 'd'.repeat(64),
      },
    });

    // 1. Edit lesson
    const editPlan = planCohortAction(ws, {
      type: 'edit_lesson',
      lessonId: 'l1',
      title: 'New Pure Function Title',
    }, mockContext);

    expect(editPlan.nextState.release?.status).toBe('draft');
    expect(editPlan.invalidated).toContain('release');

    // 2. Set intent
    const intentPlan = planCohortAction(ws, {
      type: 'set_intent',
      intent: 'Brand new intent for this workspace',
    }, mockContext);

    expect(intentPlan.nextState.release?.status).toBe('draft');
    expect(intentPlan.invalidated).toContain('release');

    // 3. Add lesson
    const addPlan = planCohortAction(ws, {
      type: 'add_lesson',
      title: 'Composition',
      objective: 'Compose functions together',
    }, mockContext);

    expect(addPlan.nextState.release?.status).toBe('draft');
    expect(addPlan.invalidated).toContain('release');
  });
});

describe('Cohort release AI tools registration', () => {
  it('registers prepare_release and commit_release tools', async () => {
    const commitActionMock = vi.fn().mockResolvedValue({
      revision: 2,
      receipt: { summary: 'Prepared', changed: [] },
    });

    const mockRepo: any = {
      loadWorkspace: vi.fn().mockResolvedValue({ revision: 1 }),
      commitAction: commitActionMock,
    };

    const tools = createCohortAiTools({
      workspaceId: 'ws-123',
      ownerId: 'user-1',
      repo: mockRepo,
      domain: cohortDomain,
      observedRevision: 1,
    });

    expect(tools.prepare_release).toBeDefined();
    expect(tools.commit_release).toBeDefined();

    // Test execute prepare_release
    const res = await (tools.prepare_release as any).execute({ mode: 'private_activation' });
    expect(res.success).toBe(true);
    expect(commitActionMock).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'ws-123',
      ownerId: 'user-1',
      envelope: expect.objectContaining({
        action: { type: 'prepare_release', mode: 'private_activation' },
      }),
    }));
  });
});
